import { Link } from "react-router-dom";
import { Countdown, ErrorBox, ObligationBadge, SeverityBadge, urgency } from "../components";
import { formatDate } from "../format";
import { useNow, useResource } from "../hooks";
import type { Obligation } from "../types";

export default function ObligationsPage() {
  const now = useNow();
  const { data, error } = useResource<Obligation[]>("/obligations/upcoming");

  return (
    <>
      <div className="entete">
        <div>
          <h1>Échéances légales</h1>
          <p>Notifications à envoyer à la CNIL (RGPD) et au CSIRT / ANSSI (NIS2), de la plus urgente à la moins urgente.</p>
        </div>
      </div>
      <ErrorBox message={error} />
      <section className="panneau" style={{ padding: 0, overflowX: "auto" }}>
        {data && data.length === 0 ? (
          <p className="vide">Aucune notification en attente.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Temps restant</th>
                <th>Notification</th>
                <th>Incident</th>
                <th>Échéance</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((o) => (
                <tr key={o.id}>
                  <td className={`echeance-cellule ${urgency(o.dueAt, now)}`}>
                    <strong>
                      <Countdown dueAt={o.dueAt} />
                    </strong>
                  </td>
                  <td>
                    {o.label}
                    <div className="discret">
                      {o.authority}, {o.legalBasis}
                    </div>
                  </td>
                  <td>
                    <Link to={`/incidents/${o.incident!.id}`}>
                      {o.incident!.ref} — {o.incident!.title}
                    </Link>
                    <div>
                      <SeverityBadge value={o.incident!.severity} />
                    </div>
                  </td>
                  <td className="ref">{formatDate(o.dueAt)}</td>
                  <td>
                    <ObligationBadge value={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
