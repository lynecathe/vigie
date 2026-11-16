import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, notInArray, SQL } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/decorators";
import { DB, Database } from "../db/db.module";
import { alerts, incidentEvents, incidents, users, type Severity } from "../db/schema";
import { CreateIncidentDto, ListIncidentsQuery, UpdateIncidentDto } from "./dto/incident.dto";
import { allowedTransitions, canTransition, formatIncidentRef, RESPONDER_ROLES } from "./incident-rules";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Tx;
type IncidentRow = typeof incidents.$inferSelect;

export interface AlertForIncident {
  id: string;
  source: string;
  ruleId: string | null;
  title: string;
  severity: Severity;
  host: string | null;
  occurredAt: Date;
}

const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  // --- Lecture ---------------------------------------------------------------

  async list(query: ListIncidentsQuery, user: AuthUser) {
    const filters: SQL[] = [];
    if (query.status) filters.push(eq(incidents.status, query.status));
    if (query.severity) filters.push(eq(incidents.severity, query.severity));
    if (query.assigneeId) filters.push(eq(incidents.assigneeId, query.assigneeId === "me" ? user.id : query.assigneeId));
    if (query.personalData !== undefined) filters.push(eq(incidents.personalData, query.personalData));
    // Le DPO ne voit que les incidents qui touchent des données personnelles (moindre privilège).
    if (user.role === "DPO") filters.push(eq(incidents.personalData, true));

    const rows = await this.db
      .select({ incident: incidents, assigneeName: users.fullName })
      .from(incidents)
      .leftJoin(users, eq(users.id, incidents.assigneeId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(incidents.createdAt))
      .limit(200);
    return rows.map((r) => this.present(r.incident, r.assigneeName));
  }

  async get(id: string, user: AuthUser) {
    const incident = await this.findVisible(id, user);
    const [assignee] = incident.assigneeId
      ? await this.db.select({ fullName: users.fullName }).from(users).where(eq(users.id, incident.assigneeId))
      : [];
    const linkedAlerts = await this.db
      .select({
        id: alerts.id,
        source: alerts.source,
        ruleId: alerts.ruleId,
        title: alerts.title,
        severity: alerts.severity,
        host: alerts.host,
        occurredAt: alerts.occurredAt,
      })
      .from(alerts)
      .where(eq(alerts.incidentId, id))
      .orderBy(asc(alerts.occurredAt));
    const timeline = await this.db
      .select({
        id: incidentEvents.id,
        type: incidentEvents.type,
        data: incidentEvents.data,
        createdAt: incidentEvents.createdAt,
        actorName: users.fullName,
      })
      .from(incidentEvents)
      .leftJoin(users, eq(users.id, incidentEvents.actorId))
      .where(eq(incidentEvents.incidentId, id))
      .orderBy(asc(incidentEvents.createdAt));

    return {
      ...this.present(incident, assignee?.fullName ?? null),
      allowedTransitions: allowedTransitions(incident.status, user.role),
      alerts: linkedAlerts,
      timeline: timeline.map((e) => ({ ...e, actorName: e.actorName ?? "Système" })),
    };
  }

  // --- Écriture ----------------------------------------------------------------

  async create(dto: CreateIncidentDto, actor: AuthUser, ip?: string) {
    const created = await this.db.transaction(async (tx) => {
      const [incident] = await tx
        .insert(incidents)
        .values({
          title: dto.title,
          description: dto.description,
          severity: dto.severity,
          personalData: dto.personalData ?? false,
          createdById: actor.id,
        })
        .returning();
      await this.event(tx, incident.id, actor.id, "CREATED", { severity: incident.severity });
      if (dto.alertIds?.length) await this.attachAlerts(tx, incident.id, dto.alertIds, actor.id);
      return incident;
    });
    await this.audit.log({ action: "INCIDENT_CREATED", actorId: actor.id, target: created.id, ip });
    return this.get(created.id, actor);
  }

  /**
   * Rattache une alerte à un incident ouvert « semblable » (même source, même règle, même machine),
   * sinon ouvre un nouvel incident. Évite de créer 50 incidents pour 50 alertes identiques.
   */
  async openOrGroupFromAlert(tx: Tx, alert: AlertForIncident): Promise<{ incidentId: string; grouped: boolean }> {
    const sameAlert = await tx
      .select({ incidentId: alerts.incidentId })
      .from(alerts)
      .innerJoin(incidents, eq(incidents.id, alerts.incidentId))
      .where(
        and(
          eq(alerts.source, alert.source),
          alert.ruleId ? eq(alerts.ruleId, alert.ruleId) : isNull(alerts.ruleId),
          alert.host ? eq(alerts.host, alert.host) : isNull(alerts.host),
          notInArray(incidents.status, ["RESOLVED", "CLOSED"]),
        ),
      )
      .orderBy(desc(incidents.createdAt))
      .limit(1);

    if (sameAlert[0]?.incidentId) {
      const incidentId = sameAlert[0].incidentId;
      await tx.update(alerts).set({ incidentId }).where(eq(alerts.id, alert.id));
      await this.event(tx, incidentId, null, "ALERT_LINKED", { alertId: alert.id, title: alert.title });
      await this.raiseSeverityIfNeeded(tx, incidentId, alert.severity);
      return { incidentId, grouped: true };
    }

    const [incident] = await tx
      .insert(incidents)
      .values({
        title: alert.host ? `${alert.title} (${alert.host})` : alert.title,
        severity: alert.severity,
        detectedAt: alert.occurredAt,
      })
      .returning();
    await this.event(tx, incident.id, null, "CREATED", { severity: alert.severity, fromAlert: alert.id });
    await tx.update(alerts).set({ incidentId: incident.id }).where(eq(alerts.id, alert.id));
    await this.event(tx, incident.id, null, "ALERT_LINKED", { alertId: alert.id, title: alert.title });
    return { incidentId: incident.id, grouped: false };
  }

  async update(id: string, dto: UpdateIncidentDto, actor: AuthUser, ip?: string) {
    const incident = await this.findVisible(id, actor);
    const changes: Partial<typeof incidents.$inferInsert> = {};
    const events: Array<[Parameters<IncidentsService["event"]>[3], Record<string, unknown>]> = [];

    if (dto.status && dto.status !== incident.status) {
      if (!canTransition(incident.status, dto.status, actor.role)) {
        throw new BadRequestException(
          `Transition impossible : ${incident.status} → ${dto.status}. Possibles : ${
            allowedTransitions(incident.status, actor.role).join(", ") || "aucune"
          }`,
        );
      }
      if ((dto.status === "RESOLVED" || dto.status === "CLOSED") && !dto.note?.trim()) {
        throw new BadRequestException("Une note est obligatoire pour résoudre ou clore un incident");
      }
      changes.status = dto.status;
      changes.closedAt = dto.status === "CLOSED" ? new Date() : null;
      events.push(["STATUS_CHANGED", { from: incident.status, to: dto.status, note: dto.note }]);
    }

    if (dto.severity && dto.severity !== incident.severity) {
      changes.severity = dto.severity;
      events.push(["SEVERITY_CHANGED", { from: incident.severity, to: dto.severity }]);
    }

    if (dto.assigneeId !== undefined && dto.assigneeId !== incident.assigneeId) {
      let assigneeName: string | null = null;
      if (dto.assigneeId) {
        const [assignee] = await this.db.select().from(users).where(eq(users.id, dto.assigneeId));
        if (!assignee || assignee.disabledAt || !RESPONDER_ROLES.includes(assignee.role)) {
          throw new BadRequestException("L'incident ne peut être assigné qu'à un analyste, un RSSI ou un admin actif");
        }
        assigneeName = assignee.fullName;
      }
      changes.assigneeId = dto.assigneeId;
      events.push(["ASSIGNED", { to: dto.assigneeId, name: assigneeName }]);
    }

    if (dto.personalData !== undefined && dto.personalData !== incident.personalData) {
      changes.personalData = dto.personalData;
      events.push(["PERSONAL_DATA_CHANGED", { to: dto.personalData }]);
    }

    if (events.length === 0) return this.get(id, actor);

    await this.db.transaction(async (tx) => {
      await tx
        .update(incidents)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(incidents.id, id));
      for (const [type, data] of events) await this.event(tx, id, actor.id, type, data);
    });
    await this.audit.log({
      action: "INCIDENT_UPDATED",
      actorId: actor.id,
      target: id,
      ip,
      metadata: { changes: events.map(([type]) => type) },
    });
    return this.get(id, actor);
  }

  async comment(id: string, text: string, actor: AuthUser) {
    await this.findVisible(id, actor);
    await this.event(this.db, id, actor.id, "COMMENT", { text });
    await this.db.update(incidents).set({ updatedAt: new Date() }).where(eq(incidents.id, id));
    return this.get(id, actor);
  }

  async linkAlerts(id: string, alertIds: string[], actor: AuthUser) {
    await this.findVisible(id, actor);
    await this.db.transaction((tx) => this.attachAlerts(tx, id, alertIds, actor.id));
    return this.get(id, actor);
  }

  // --- Interne -----------------------------------------------------------------

  private async findVisible(id: string, user: AuthUser): Promise<IncidentRow> {
    const [incident] = await this.db.select().from(incidents).where(eq(incidents.id, id));
    // 404 (et non 403) pour le DPO : on ne révèle pas l'existence d'un incident qu'il ne doit pas voir.
    if (!incident || (user.role === "DPO" && !incident.personalData)) {
      throw new NotFoundException("Incident introuvable");
    }
    return incident;
  }

  private async attachAlerts(tx: Tx, incidentId: string, alertIds: string[], actorId: string) {
    const free = await tx
      .select({ id: alerts.id, title: alerts.title, severity: alerts.severity })
      .from(alerts)
      .where(and(inArray(alerts.id, alertIds), isNull(alerts.incidentId)));
    if (free.length !== new Set(alertIds).size) {
      throw new BadRequestException("Certaines alertes n'existent pas ou sont déjà rattachées à un incident");
    }
    await tx.update(alerts).set({ incidentId }).where(inArray(alerts.id, alertIds));
    for (const a of free) {
      await this.event(tx, incidentId, actorId, "ALERT_LINKED", { alertId: a.id, title: a.title });
      await this.raiseSeverityIfNeeded(tx, incidentId, a.severity);
    }
  }

  /** Une alerte plus grave que l'incident remonte automatiquement sa sévérité. */
  private async raiseSeverityIfNeeded(tx: Tx, incidentId: string, severity: Severity) {
    const [incident] = await tx.select({ severity: incidents.severity }).from(incidents).where(eq(incidents.id, incidentId));
    if (incident && SEVERITY_RANK[severity] > SEVERITY_RANK[incident.severity]) {
      await tx.update(incidents).set({ severity, updatedAt: new Date() }).where(eq(incidents.id, incidentId));
      await this.event(tx, incidentId, null, "SEVERITY_CHANGED", { from: incident.severity, to: severity, auto: true });
    }
  }

  private async event(
    executor: Executor,
    incidentId: string,
    actorId: string | null,
    type: (typeof incidentEvents.$inferInsert)["type"],
    data: Record<string, unknown>,
  ) {
    await executor.insert(incidentEvents).values({ incidentId, actorId, type, data });
  }

  private present(incident: IncidentRow, assigneeName: string | null) {
    return { ...incident, ref: formatIncidentRef(incident.number), assigneeName };
  }
}
