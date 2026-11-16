import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ErrorBox, SeverityBadge } from "../components";
import { formatDate } from "../format";
import { useResource } from "../hooks";
import type { Alert, Incident, IncidentDetail, Severity } from "../types";

const RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export default function AlertsPage() {
  const navigate = useNavigate();
  const alerts = useResource<Alert[]>("/alerts/untriaged");
  const openIncidents = useResource<Incident[]>("/incidents");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const picked = (alerts.data ?? []).filter((a) => selected.has(a.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  async function createIncident() {
    const worst = picked.reduce((w, a) => (RANK[a.severity] > RANK[w] ? a.severity : w), "LOW" as Severity);
    try {
      const created = await api<IncidentDetail>("/incidents", {
        method: "POST",
        body: { title: picked[0].title.slice(0, 200), severity: worst, alertIds: [...selected] },
      });
      navigate(`/incidents/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function linkTo() {
    try {
      await api(`/incidents/${target}/alerts`, { method: "POST", body: { alertIds: [...selected] } });
      navigate(`/incidents/${target}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const active = (openIncidents.data ?? []).filter((i) => i.status !== "CLOSED");

  return (
    <>
      <div className="entete">
        <div>
          <h1>Alertes à trier</h1>
          <p>
            Alertes de faible ou moyenne gravité qui n'ont pas ouvert d'incident automatiquement. Regroupez-les dans un incident
            ou rattachez-les à un incident existant.
          </p>
        </div>
      </div>

      {selected.size > 0 && (
        <section className="panneau pile">
          <p>
            <strong>{selected.size}</strong> alerte{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
          </p>
          <div className="actions" style={{ alignItems: "end" }}>
            <button onClick={createIncident}>Ouvrir un incident</button>
            <label style={{ minWidth: 280 }}>
              ou rattacher à
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choisir un incident…</option>
                {active.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.ref} — {i.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="second" disabled={!target} onClick={linkTo}>
              Rattacher
            </button>
          </div>
        </section>
      )}

      <ErrorBox message={error ?? alerts.error} />

      <section className="panneau" style={{ padding: 0, overflowX: "auto" }}>
        {alerts.data && alerts.data.length === 0 ? (
          <p className="vide">File vide : toutes les alertes reçues sont rattachées à un incident.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>
                  <span className="visually-hidden">Sélection</span>
                </th>
                <th>Alerte</th>
                <th>Sévérité</th>
                <th>Source</th>
                <th>Machine</th>
                <th>Survenue le</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${a.title}`}
                      checked={selected.has(a.id)}
                      onChange={(e) => toggle(a.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    {a.title}
                    {a.ruleId && <span className="discret"> (règle {a.ruleId})</span>}
                  </td>
                  <td>
                    <SeverityBadge value={a.severity} />
                  </td>
                  <td>{a.source}</td>
                  <td>{a.host ?? "—"}</td>
                  <td className="ref">{formatDate(a.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
