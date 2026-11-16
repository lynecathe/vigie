import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorBox, Panel, SeverityBadge, StatusBadge } from "../components";
import { SEVERITY_LABEL, STATUS_LABEL, formatDate } from "../format";
import { useResource } from "../hooks";
import type { Incident, IncidentDetail, IncidentStatus, Severity } from "../types";

const FILTERS = ["status", "severity", "assigneeId", "personalData"] as const;

function NewIncidentForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [personalData, setPersonalData] = useState(false);
  const [nis2Significant, setNis2] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await api<IncidentDetail>("/incidents", {
        method: "POST",
        body: { title, description: description || undefined, severity, personalData, nis2Significant },
      });
      navigate(`/incidents/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel title="Déclarer un incident">
      <form className="pile" onSubmit={submit}>
        <label>
          Titre
          <input required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Description
          <textarea maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label style={{ maxWidth: 240 }}>
          Sévérité
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="case">
          <input type="checkbox" checked={personalData} onChange={(e) => setPersonalData(e.target.checked)} />
          Des données personnelles sont concernées (lance le délai CNIL de 72 h)
        </label>
        <label className="case">
          <input type="checkbox" checked={nis2Significant} onChange={(e) => setNis2(e.target.checked)} />
          Incident important au sens de NIS2 (lance les échéances ANSSI)
        </label>
        <ErrorBox message={error} />
        <div className="actions">
          <button type="submit">Déclarer l'incident</button>
          <button type="button" className="second" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function IncidentsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const query = new URLSearchParams();
  for (const k of FILTERS) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }
  const { data, error } = useResource<Incident[]>(`/incidents${query.size ? `?${query}` : ""}`);

  const setFilter = (key: (typeof FILTERS)[number], value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="entete">
        <div>
          <h1>Incidents</h1>
          <p>{data ? `${data.length} incident${data.length > 1 ? "s" : ""}` : "Chargement…"}</p>
        </div>
        {can("ANALYST", "CISO", "ADMIN") && !creating && <button onClick={() => setCreating(true)}>Déclarer un incident</button>}
      </div>

      {creating && <NewIncidentForm onCancel={() => setCreating(false)} />}

      <div className="filtres" role="search">
        <label>
          Statut
          <select value={params.get("status") ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">Tous</option>
            {(Object.keys(STATUS_LABEL) as IncidentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sévérité
          <select value={params.get("severity") ?? ""} onChange={(e) => setFilter("severity", e.target.value)}>
            <option value="">Toutes</option>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {can("ANALYST", "CISO", "ADMIN") && (
          <label className="case" style={{ minWidth: 0 }}>
            <input
              type="checkbox"
              checked={params.get("assigneeId") === "me"}
              onChange={(e) => setFilter("assigneeId", e.target.checked ? "me" : "")}
            />
            Mes incidents
          </label>
        )}
        <label className="case" style={{ minWidth: 0 }}>
          <input
            type="checkbox"
            checked={params.get("personalData") === "true"}
            onChange={(e) => setFilter("personalData", e.target.checked ? "true" : "")}
          />
          Données personnelles
        </label>
      </div>

      <ErrorBox message={error} />

      <section className="panneau" style={{ padding: 0, overflowX: "auto" }}>
        {data && data.length === 0 ? (
          <p className="vide">Aucun incident ne correspond à ces filtres.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Incident</th>
                <th>Sévérité</th>
                <th>Statut</th>
                <th>Assigné à</th>
                <th>Détecté le</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((i) => (
                <tr key={i.id}>
                  <td className="ref">{i.ref}</td>
                  <td>
                    <Link to={`/incidents/${i.id}`}>{i.title}</Link>
                    {i.personalData && <span className="drapeau">RGPD</span>}
                    {i.nis2Significant && <span className="drapeau">NIS2</span>}
                  </td>
                  <td>
                    <SeverityBadge value={i.severity} />
                  </td>
                  <td>
                    <StatusBadge value={i.status} />
                  </td>
                  <td>{i.assigneeName ?? <span className="discret">Personne</span>}</td>
                  <td className="ref">{formatDate(i.detectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
