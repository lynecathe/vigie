import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Countdown, ErrorBox, Panel, urgency } from "../components";
import { SEVERITY_LABEL, formatDuration } from "../format";
import { useNow, useResource } from "../hooks";
import type { Metrics, Obligation, Severity } from "../types";

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const WEEK_MS = 7 * 86400 * 1000;

function WatchStrip({ obligations }: { obligations: Obligation[] | null }) {
  const now = useNow();
  const all = (obligations ?? []).filter((o) => o.status === "PENDING" || o.status === "OVERDUE");
  // Le bandeau montre ce qui se joue dans la semaine ; les échéances lointaines (rapport final NIS2) restent dans « Échéances ».
  const open = all.filter((o) => new Date(o.dueAt).getTime() - now < WEEK_MS);
  const later = all.length - open.length;
  return (
    <section className="quart" aria-labelledby="quart-titre">
      <div className="quart-titre">
        <h2 id="quart-titre">Quart en cours</h2>
        <p>
          {open.length === 0
            ? "Aucune notification à envoyer cette semaine."
            : `${open.length} notification${open.length > 1 ? "s" : ""} à envoyer aux autorités cette semaine`}
          {later > 0 && (
            <>
              {" "}
              (<Link to="/echeances" style={{ color: "inherit" }}>
                {later} plus lointaine{later > 1 ? "s" : ""}
              </Link>
              )
            </>
          )}
        </p>
      </div>
      {open.length === 0 ? (
        <p className="quart-vide">Les comptes à rebours CNIL et ANSSI apparaîtront ici dès qu'un incident les déclenche.</p>
      ) : (
        <div className="quart-rail">
          {open.map((o) => (
            <Link key={o.id} to={`/incidents/${o.incident!.id}`} className={`echeance ${urgency(o.dueAt, now)}`}>
              <Countdown dueAt={o.dueAt} />
              <span className="quoi">
                {o.label} ({o.authority})
              </span>
              <span className="ou">
                {o.incident!.ref} · {o.incident!.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PerDayChart({ data }: { data: Metrics["incidentsPerDay"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const fmt = (day: string) => new Date(day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return (
    <>
      <div className="barres" role="img" aria-label={`Incidents ouverts par jour, maximum ${max}`}>
        {data.map((d) => (
          <div
            key={d.day}
            className={d.count === 0 ? "zero" : undefined}
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${fmt(d.day)} : ${d.count} incident${d.count > 1 ? "s" : ""}`}
          />
        ))}
      </div>
      {data.length > 0 && (
        <div className="barres-legende">
          <span>{fmt(data[0].day)}</span>
          <span>{fmt(data[data.length - 1].day)}</span>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { me, can } = useAuth();
  const metrics = useResource<Metrics>("/metrics?days=30");
  const upcoming = useResource<Obligation[]>("/obligations/upcoming");
  const m = metrics.data;
  const rate = m?.obligations.onTimeRate;

  return (
    <>
      <div className="entete">
        <div>
          <h1>Bonjour {me?.fullName.split(" ")[0]}</h1>
          <p>Situation des 30 derniers jours</p>
        </div>
      </div>

      <WatchStrip obligations={upcoming.data} />
      <ErrorBox message={metrics.error ?? upcoming.error} />

      {m && (
        <>
          <div className="releves">
            <div className="releve">
              <span className="valeur">{m.openIncidents.total}</span>
              <span className="libelle">Incidents ouverts</span>
              <span className="detail">
                {SEVERITIES.filter((s) => m.openIncidents.bySeverity[s])
                  .map((s) => `${m.openIncidents.bySeverity[s]} ${SEVERITY_LABEL[s].toLowerCase()}`)
                  .join(", ") || "aucun"}
              </span>
            </div>
            {can("ANALYST", "CISO", "ADMIN") && (
              <div className={`releve ${m.untriagedAlerts > 0 ? "alerte" : ""}`}>
                <span className="valeur">{m.untriagedAlerts}</span>
                <span className="libelle">Alertes à trier</span>
                <Link className="detail" to="/alertes">
                  Voir la file
                </Link>
              </div>
            )}
            <div className="releve">
              <span className="valeur">{formatDuration(m.mtta.averageSeconds)}</span>
              <span className="libelle">Délai moyen de prise en charge</span>
              <span className="detail">MTTA, sur {m.mtta.sample} incident{m.mtta.sample > 1 ? "s" : ""}</span>
            </div>
            <div className="releve">
              <span className="valeur">{formatDuration(m.mttr.averageSeconds)}</span>
              <span className="libelle">Délai moyen de résolution</span>
              <span className="detail">MTTR, sur {m.mttr.sample} incident{m.mttr.sample > 1 ? "s" : ""}</span>
            </div>
            <div className={`releve ${m.obligations.overdue > 0 ? "alerte" : ""}`}>
              <span className="valeur">{rate == null ? "—" : `${Math.round(rate * 100)} %`}</span>
              <span className="libelle">Notifications dans les délais</span>
              <span className="detail">
                {m.obligations.overdue > 0 ? `${m.obligations.overdue} en retard` : `${m.obligations.pending} en cours`}
              </span>
            </div>
          </div>

          <div className="deux">
            <Panel title="Incidents ouverts par jour">
              <PerDayChart data={m.incidentsPerDay} />
            </Panel>
            <Panel title="Contrôles ISO 27001 les plus sollicités">
              {m.topControls.length === 0 ? (
                <p className="discret">Rattachez des contrôles aux incidents pour voir où portent les efforts.</p>
              ) : (
                <table>
                  <tbody>
                    {m.topControls.map((c) => (
                      <tr key={c.code}>
                        <td className="ref">{c.code}</td>
                        <td>{c.title}</td>
                        <td style={{ textAlign: "right" }}>{c.incidents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

        </>
      )}
    </>
  );
}
