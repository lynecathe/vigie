import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { AuthUser } from "../auth/decorators";
import { DB, Database } from "../db/db.module";
import { GovernanceService } from "../governance/governance.service";

export interface Metrics {
  periodDays: number;
  openIncidents: { total: number; bySeverity: Record<string, number>; byStatus: Record<string, number> };
  /** Délai moyen de prise en charge (création → passage « en analyse »), en secondes. */
  mtta: { averageSeconds: number | null; sample: number };
  /** Délai moyen de résolution (création → « résolu »), en secondes. */
  mttr: { averageSeconds: number | null; sample: number };
  incidentsPerDay: { day: string; count: number }[];
  untriagedAlerts: number;
  obligations: { pending: number; overdue: number; submittedOnTime: number; submittedLate: number; onTimeRate: number | null };
  topControls: { code: string; title: string; incidents: number }[];
}

const n = (v: unknown) => Number(v ?? 0);

@Injectable()
export class MetricsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly governance: GovernanceService,
  ) {}

  async compute(user: AuthUser, periodDays: number): Promise<Metrics> {
    // Le DPO ne voit que les incidents qui touchent des données personnelles.
    const scope = user.role === "DPO" ? sql`i.personal_data = true` : sql`true`;
    const since = sql`now() - make_interval(days => ${periodDays})`;

    const open = await this.db.execute<{ severity: string; status: string; count: string }>(sql`
      select i.severity, i.status, count(*)::int as count
      from incidents i
      where i.status not in ('RESOLVED', 'CLOSED') and ${scope}
      group by i.severity, i.status`);
    const bySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const byStatus: Record<string, number> = { NEW: 0, IN_PROGRESS: 0, CONTAINED: 0 };
    for (const r of open.rows) {
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + n(r.count);
      byStatus[r.status] = (byStatus[r.status] ?? 0) + n(r.count);
    }

    const [mtta] = (
      await this.db.execute<{ avg: string | null; sample: string }>(sql`
        select avg(extract(epoch from first_ack.at - i.created_at)) as avg, count(*) as sample
        from incidents i
        join lateral (
          select min(e.created_at) as at from incident_events e
          where e.incident_id = i.id and e.type = 'STATUS_CHANGED' and e.data->>'from' = 'NEW'
        ) first_ack on first_ack.at is not null
        where i.created_at >= ${since} and ${scope}`)
    ).rows;

    const [mttr] = (
      await this.db.execute<{ avg: string | null; sample: string }>(sql`
        select avg(extract(epoch from first_res.at - i.created_at)) as avg, count(*) as sample
        from incidents i
        join lateral (
          select min(e.created_at) as at from incident_events e
          where e.incident_id = i.id and e.type = 'STATUS_CHANGED' and e.data->>'to' = 'RESOLVED'
        ) first_res on first_res.at is not null
        where first_res.at >= ${since} and ${scope}`)
    ).rows;

    const perDay = await this.db.execute<{ day: string; count: string }>(sql`
      select to_char(d.day, 'YYYY-MM-DD') as day, count(i.id)::int as count
      from generate_series(date_trunc('day', ${since}), date_trunc('day', now()), interval '1 day') as d(day)
      left join incidents i on date_trunc('day', i.created_at) = d.day and ${scope}
      group by d.day order by d.day`);

    const [untriaged] = (
      await this.db.execute<{ count: string }>(sql`select count(*)::int as count from alerts where incident_id is null`)
    ).rows;

    const top = await this.db.execute<{ code: string; title: string; incidents: string }>(sql`
      select c.code, c.title, count(*)::int as incidents
      from incident_controls ic
      join controls c on c.id = ic.control_id
      join incidents i on i.id = ic.incident_id
      where i.created_at >= ${since} and ${scope}
      group by c.code, c.title
      order by incidents desc, c.code
      limit 5`);

    // Les statuts des obligations dépendent de règles métier (échéances NIS2 chaînées) : on réutilise le registre.
    const register = await this.governance.register(user);
    const all = register.flatMap((r) => [...(r.gdpr ? [r.gdpr] : []), ...r.nis2]);
    const count = (s: string) => all.filter((o) => o.status === s).length;
    const submittedOnTime = count("SUBMITTED");
    const submittedLate = count("SUBMITTED_LATE");

    return {
      periodDays,
      openIncidents: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), bySeverity, byStatus },
      mtta: { averageSeconds: mtta?.avg == null ? null : Math.round(n(mtta.avg)), sample: n(mtta?.sample) },
      mttr: { averageSeconds: mttr?.avg == null ? null : Math.round(n(mttr.avg)), sample: n(mttr?.sample) },
      incidentsPerDay: perDay.rows.map((r) => ({ day: r.day, count: n(r.count) })),
      untriagedAlerts: user.role === "DPO" ? 0 : n(untriaged?.count),
      obligations: {
        pending: count("PENDING"),
        overdue: count("OVERDUE"),
        submittedOnTime,
        submittedLate,
        onTimeRate: submittedOnTime + submittedLate ? submittedOnTime / (submittedOnTime + submittedLate) : null,
      },
      topControls: top.rows.map((r) => ({ code: r.code, title: r.title, incidents: n(r.incidents) })),
    };
  }
}
