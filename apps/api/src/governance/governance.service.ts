import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, SQL } from "drizzle-orm";
import type { AuthUser } from "../auth/decorators";
import { DB, Database } from "../db/db.module";
import {
  controls,
  incidentControls,
  incidentEvents,
  incidents,
  obligations,
  users,
  type ObligationKind,
} from "../db/schema";
import { formatIncidentRef } from "../incidents/incident-rules";
import { toCsv } from "./csv";
import { CreateControlDto, DecideDto, SubmitDto } from "./dto/governance.dto";
import { renderDraft } from "./notification-drafts";
import {
  canBeNotRequired,
  canHandleObligation,
  dueDate,
  OBLIGATION_LABELS,
  obligationStatus,
  type ObligationTiming,
} from "./obligation-rules";

type ObligationRow = typeof obligations.$inferSelect;
type IncidentRow = typeof incidents.$inferSelect;

@Injectable()
export class GovernanceService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // --- Contrôles ---------------------------------------------------------------

  listControls() {
    return this.db.select().from(controls).orderBy(asc(controls.framework), asc(controls.code));
  }

  async createControl(dto: CreateControlDto) {
    const [created] = await this.db.insert(controls).values(dto).onConflictDoNothing().returning();
    if (!created) throw new ConflictException("Ce contrôle existe déjà dans ce référentiel");
    return created;
  }

  async controlsOf(incidentId: string) {
    return this.db
      .select({ id: controls.id, framework: controls.framework, code: controls.code, title: controls.title })
      .from(incidentControls)
      .innerJoin(controls, eq(controls.id, incidentControls.controlId))
      .where(eq(incidentControls.incidentId, incidentId))
      .orderBy(asc(controls.code));
  }

  async setControls(incidentId: string, controlIds: string[], actor: AuthUser) {
    await this.findVisible(incidentId, actor);
    const unique = [...new Set(controlIds)];
    if (unique.length) {
      const found = await this.db.select({ id: controls.id }).from(controls).where(inArray(controls.id, unique));
      if (found.length !== unique.length) throw new BadRequestException("Contrôle inconnu");
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(incidentControls).where(eq(incidentControls.incidentId, incidentId));
      if (unique.length) await tx.insert(incidentControls).values(unique.map((controlId) => ({ incidentId, controlId })));
      await tx.insert(incidentEvents).values({
        incidentId,
        actorId: actor.id,
        type: "CONTROLS_UPDATED",
        data: { controlIds: unique },
      });
    });
    return this.controlsOf(incidentId);
  }

  // --- Obligations ---------------------------------------------------------------

  async obligationsOf(incidentId: string, user: AuthUser) {
    await this.findVisible(incidentId, user);
    const rows = await this.db.select().from(obligations).where(eq(obligations.incidentId, incidentId));
    return this.present(rows, user);
  }

  /** Toutes les obligations en cours, de la plus urgente à la moins urgente (pour le tableau de bord et le mobile). */
  async upcoming(user: AuthUser) {
    const filters: SQL[] = [isNull(obligations.submittedAt)];
    if (user.role === "DPO") filters.push(eq(obligations.kind, "GDPR_NOTIFICATION"));
    const rows = await this.db
      .select({ obligation: obligations, incident: incidents })
      .from(obligations)
      .innerJoin(incidents, eq(incidents.id, obligations.incidentId))
      .where(and(...filters));
    const all = await this.db.select().from(obligations).where(
      inArray(
        obligations.incidentId,
        rows.length ? [...new Set(rows.map((r) => r.incident.id))] : ["00000000-0000-0000-0000-000000000000"],
      ),
    );
    const presented = this.present(all, user);
    const byId = new Map(rows.map((r) => [r.obligation.id, r.incident]));
    return presented
      .filter((o) => byId.has(o.id) && o.status !== "NOT_REQUIRED")
      .map((o) => {
        const inc = byId.get(o.id)!;
        return { ...o, incident: { id: inc.id, ref: formatIncidentRef(inc.number), title: inc.title, severity: inc.severity } };
      })
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  async decide(incidentId: string, kind: ObligationKind, dto: DecideDto, actor: AuthUser) {
    const o = await this.findObligation(incidentId, kind, actor);
    if (o.submittedAt) throw new BadRequestException("La notification a déjà été envoyée");
    if (dto.decision === "NOT_REQUIRED") {
      if (!canBeNotRequired(kind)) throw new BadRequestException("Cette obligation ne peut pas être écartée");
      if (!dto.justification?.trim()) {
        throw new BadRequestException("Une justification est obligatoire pour ne pas notifier (registre des violations, RGPD art. 33.5)");
      }
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(obligations)
        .set({ decision: dto.decision, justification: dto.justification ?? null, decidedById: actor.id, decidedAt: new Date() })
        .where(eq(obligations.id, o.id));
      await tx.insert(incidentEvents).values({
        incidentId,
        actorId: actor.id,
        type: "OBLIGATION_DECIDED",
        data: { kind, decision: dto.decision, justification: dto.justification },
      });
    });
    return this.obligationsOf(incidentId, actor);
  }

  async submit(incidentId: string, kind: ObligationKind, dto: SubmitDto, actor: AuthUser) {
    const o = await this.findObligation(incidentId, kind, actor);
    if (o.decision === "NOT_REQUIRED") throw new BadRequestException("Cette notification a été jugée non requise");
    if (o.submittedAt) throw new BadRequestException("Déjà envoyée");

    const all = await this.db.select().from(obligations).where(eq(obligations.incidentId, incidentId));
    const notif = all.find((x) => x.kind === "NIS2_NOTIFICATION");
    if (kind === "NIS2_FINAL_REPORT" && !notif?.submittedAt) {
      throw new BadRequestException("Le rapport final ne peut être envoyé qu'après la notification d'incident");
    }

    const submittedAt = dto.submittedAt ? new Date(dto.submittedAt) : new Date();
    if (submittedAt > new Date(Date.now() + 60_000)) throw new BadRequestException("La date d'envoi ne peut pas être dans le futur");
    if (submittedAt < o.awareAt) throw new BadRequestException("La date d'envoi est antérieure au début du délai");
    const due = dueDate(o, notif);
    if (submittedAt > due && !dto.delayReason?.trim()) {
      throw new BadRequestException("Envoi en retard : indique le motif du retard (RGPD art. 33.1)");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(obligations)
        .set({
          submittedAt,
          submittedById: actor.id,
          reference: dto.reference ?? null,
          delayReason: dto.delayReason ?? null,
          decision: "NOTIFY",
          decidedById: o.decidedById ?? actor.id,
          decidedAt: o.decidedAt ?? new Date(),
        })
        .where(eq(obligations.id, o.id));
      await tx.insert(incidentEvents).values({
        incidentId,
        actorId: actor.id,
        type: "OBLIGATION_SUBMITTED",
        data: { kind, reference: dto.reference, late: submittedAt > due },
      });
    });
    return this.obligationsOf(incidentId, actor);
  }

  async draft(incidentId: string, kind: ObligationKind, actor: AuthUser) {
    const o = await this.findObligation(incidentId, kind, actor);
    const incident = await this.findVisible(incidentId, actor);
    const linkedControls = await this.controlsOf(incidentId);
    const timeline = await this.db
      .select({ type: incidentEvents.type, data: incidentEvents.data, createdAt: incidentEvents.createdAt })
      .from(incidentEvents)
      .where(eq(incidentEvents.incidentId, incidentId))
      .orderBy(asc(incidentEvents.createdAt));
    const [dpo] = await this.db
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(and(eq(users.role, "DPO"), isNull(users.disabledAt)))
      .limit(1);
    const all = await this.db.select().from(obligations).where(eq(obligations.incidentId, incidentId));
    const notif = all.find((x) => x.kind === "NIS2_NOTIFICATION");
    return {
      kind,
      ...OBLIGATION_LABELS[kind],
      dueAt: dueDate(o, notif),
      text: renderDraft(kind, { incident, controls: linkedControls, timeline, dpo, awareAt: o.awareAt }),
    };
  }

  // --- Registre ------------------------------------------------------------------

  async register(user: AuthUser, personalDataOnly = false) {
    const filters: SQL[] = [];
    if (personalDataOnly || user.role === "DPO") filters.push(eq(incidents.personalData, true));
    const rows = await this.db
      .select()
      .from(incidents)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(incidents.number));
    const ids = rows.map((r) => r.id);
    const none = ["00000000-0000-0000-0000-000000000000"];
    const allObligations = await this.db.select().from(obligations).where(inArray(obligations.incidentId, ids.length ? ids : none));
    const allControls = await this.db
      .select({ incidentId: incidentControls.incidentId, code: controls.code })
      .from(incidentControls)
      .innerJoin(controls, eq(controls.id, incidentControls.controlId))
      .where(inArray(incidentControls.incidentId, ids.length ? ids : none));

    return rows.map((inc) => {
      const own = allObligations.filter((o) => o.incidentId === inc.id);
      const presented = this.present(own, { ...user, role: "ADMIN" });
      const gdpr = presented.find((o) => o.kind === "GDPR_NOTIFICATION");
      const nis2 = presented.filter((o) => o.kind.startsWith("NIS2"));
      return {
        id: inc.id,
        ref: formatIncidentRef(inc.number),
        title: inc.title,
        detectedAt: inc.detectedAt,
        severity: inc.severity,
        status: inc.status,
        closedAt: inc.closedAt,
        personalData: inc.personalData,
        nis2Significant: inc.nis2Significant,
        controls: allControls.filter((c) => c.incidentId === inc.id).map((c) => c.code).sort(),
        gdpr: gdpr
          ? {
              decision: gdpr.decision,
              justification: gdpr.justification,
              dueAt: gdpr.dueAt,
              submittedAt: gdpr.submittedAt,
              reference: gdpr.reference,
              status: gdpr.status,
            }
          : null,
        nis2: nis2.map((o) => ({ kind: o.kind, dueAt: o.dueAt, submittedAt: o.submittedAt, status: o.status })),
      };
    });
  }

  async registerCsv(user: AuthUser, personalDataOnly = false) {
    const rows = await this.register(user, personalDataOnly);
    return toCsv(
      [
        "Référence",
        "Titre",
        "Détecté le",
        "Sévérité",
        "Statut",
        "Clos le",
        "Données personnelles",
        "NIS2 important",
        "Contrôles ISO 27001",
        "RGPD : décision",
        "RGPD : justification",
        "RGPD : échéance",
        "RGPD : notifié le",
        "RGPD : n° CNIL",
        "RGPD : état",
      ],
      rows.map((r) => [
        r.ref,
        r.title,
        r.detectedAt,
        r.severity,
        r.status,
        r.closedAt,
        r.personalData ? "oui" : "non",
        r.nis2Significant ? "oui" : "non",
        r.controls.join(", "),
        r.gdpr?.decision,
        r.gdpr?.justification,
        r.gdpr?.dueAt,
        r.gdpr?.submittedAt,
        r.gdpr?.reference,
        r.gdpr?.status,
      ]),
    );
  }

  // --- Interne -------------------------------------------------------------------

  private present(rows: ObligationRow[], user: AuthUser) {
    const now = new Date();
    const notif = rows.find((o) => o.kind === "NIS2_NOTIFICATION");
    return rows
      .filter((o) => user.role !== "DPO" || o.kind === "GDPR_NOTIFICATION")
      .map((o) => {
        const due = dueDate(o as ObligationTiming, notif as ObligationTiming | undefined);
        const status = obligationStatus(o as ObligationTiming, due, now);
        return {
          ...o,
          ...OBLIGATION_LABELS[o.kind],
          dueAt: due,
          status,
          remainingSeconds: status === "PENDING" ? Math.floor((due.getTime() - now.getTime()) / 1000) : null,
          canHandle: canHandleObligation(o.kind, user.role),
        };
      })
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  private async findVisible(id: string, user: AuthUser): Promise<IncidentRow> {
    const [incident] = await this.db.select().from(incidents).where(eq(incidents.id, id));
    if (!incident || (user.role === "DPO" && !incident.personalData)) throw new NotFoundException("Incident introuvable");
    return incident;
  }

  private async findObligation(incidentId: string, kind: ObligationKind, user: AuthUser): Promise<ObligationRow> {
    await this.findVisible(incidentId, user);
    if (!canHandleObligation(kind, user.role)) throw new ForbiddenException();
    const [o] = await this.db
      .select()
      .from(obligations)
      .where(and(eq(obligations.incidentId, incidentId), eq(obligations.kind, kind)));
    if (!o) throw new NotFoundException("Aucune obligation de ce type pour cet incident");
    return o;
  }
}
