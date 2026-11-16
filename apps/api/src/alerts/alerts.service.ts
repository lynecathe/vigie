import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DB, Database } from "../db/db.module";
import { alerts, incidents } from "../db/schema";
import { formatIncidentRef, opensIncidentAutomatically } from "../incidents/incident-rules";
import { IncidentsService } from "../incidents/incidents.service";
import { NormalizedAlert } from "./alert-normalizer";

export interface IngestResult {
  alertId: string;
  duplicate: boolean;
  incidentId: string | null;
  incidentRef: string | null;
  groupedIntoExistingIncident: boolean;
}

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly incidentsService: IncidentsService,
  ) {}

  /** Enregistre une alerte ; les doublons (même source + même id) sont ignorés. */
  async ingest(alert: NormalizedAlert): Promise<IngestResult> {
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(alerts)
        .values(alert)
        .onConflictDoNothing({ target: [alerts.source, alerts.externalId] })
        .returning();

      if (!inserted) {
        const [existing] = await tx
          .select({ id: alerts.id, incidentId: alerts.incidentId })
          .from(alerts)
          .where(and(eq(alerts.source, alert.source), eq(alerts.externalId, alert.externalId)));
        return this.result(tx, existing.id, true, existing.incidentId, false);
      }

      if (!opensIncidentAutomatically(inserted.severity)) {
        return this.result(tx, inserted.id, false, null, false);
      }
      const { incidentId, grouped } = await this.incidentsService.openOrGroupFromAlert(tx, inserted);
      return this.result(tx, inserted.id, false, incidentId, grouped);
    });
  }

  /** Alertes pas encore rattachées à un incident : la file d'attente de l'analyste. */
  listUntriaged() {
    return this.db
      .select({
        id: alerts.id,
        source: alerts.source,
        ruleId: alerts.ruleId,
        title: alerts.title,
        severity: alerts.severity,
        host: alerts.host,
        occurredAt: alerts.occurredAt,
        receivedAt: alerts.receivedAt,
      })
      .from(alerts)
      .where(isNull(alerts.incidentId))
      .orderBy(desc(alerts.occurredAt))
      .limit(200);
  }

  private async result(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    alertId: string,
    duplicate: boolean,
    incidentId: string | null,
    grouped: boolean,
  ): Promise<IngestResult> {
    let incidentRef: string | null = null;
    if (incidentId) {
      const [row] = await tx.select({ number: incidents.number }).from(incidents).where(eq(incidents.id, incidentId));
      incidentRef = row ? formatIncidentRef(row.number) : null;
    }
    return { alertId, duplicate, incidentId, incidentRef, groupedIntoExistingIncident: grouped };
  }
}
