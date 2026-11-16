import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorBox, ObligationBadge, SeverityBadge, StatusBadge } from "../components";
import { formatDate } from "../format";
import { useResource } from "../hooks";
import type { IncidentStatus, ObligationStatus, Severity } from "../types";

interface RegisterRow {
  id: string;
  ref: string;
  title: string;
  detectedAt: string;
  severity: Severity;
  status: IncidentStatus;
  personalData: boolean;
  nis2Significant: boolean;
  controls: string[];
  gdpr: { status: ObligationStatus; submittedAt: string | null; justification: string | null } | null;
  nis2: { kind: string; status: ObligationStatus }[];
}

const NIS2_SHORT: Record<string, string> = {
  NIS2_EARLY_WARNING: "24 h",
  NIS2_NOTIFICATION: "72 h",
  NIS2_FINAL_REPORT: "1 mois",
};

export default function RegisterPage() {
  const { me } = useAuth();
  const [onlyPersonal, setOnlyPersonal] = useState(me?.role === "DPO");
  const { data, error } = useResource<RegisterRow[]>(`/register${onlyPersonal ? "?personalDataOnly=true" : ""}`);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download() {
    try {
      const blob = await api<Blob>(`/register?format=csv${onlyPersonal ? "&personalDataOnly=true" : ""}`, { raw: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registre-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError((err as Error).message);
    }
  }

  return (
    <>
      <div className="entete">
        <div>
          <h1>Registre des incidents</h1>
          <p>
            Trace de chaque incident et des décisions de notification. Le registre des violations de données est exigé par le RGPD
            (art. 33.5), même quand la CNIL n'a pas été notifiée.
          </p>
        </div>
        <button onClick={download}>Télécharger en CSV</button>
      </div>

      {me?.role !== "DPO" && (
        <label className="case">
          <input type="checkbox" checked={onlyPersonal} onChange={(e) => setOnlyPersonal(e.target.checked)} />
          Seulement les violations de données personnelles
        </label>
      )}

      <ErrorBox message={error ?? downloadError} />

      <section className="panneau" style={{ padding: 0, overflowX: "auto" }}>
        {data && data.length === 0 ? (
          <p className="vide">Le registre est vide.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Incident</th>
                <th>Statut</th>
                <th>Contrôles</th>
                <th>CNIL</th>
                <th>ANSSI</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((r) => (
                <tr key={r.id}>
                  <td className="ref">{r.ref}</td>
                  <td>
                    <Link to={`/incidents/${r.id}`}>{r.title}</Link>
                    <div className="discret">
                      <SeverityBadge value={r.severity} /> détecté le {formatDate(r.detectedAt)}
                    </div>
                  </td>
                  <td>
                    <StatusBadge value={r.status} />
                  </td>
                  <td className="ref">{r.controls.join(", ") || "—"}</td>
                  <td>{r.gdpr ? <ObligationBadge value={r.gdpr.status} /> : <span className="discret">—</span>}</td>
                  <td>
                    {r.nis2.length === 0 ? (
                      <span className="discret">—</span>
                    ) : (
                      <div className="pile" style={{ gap: 4 }}>
                        {r.nis2.map((n) => (
                          <span key={n.kind} className="discret" style={{ whiteSpace: "nowrap" }}>
                            {NIS2_SHORT[n.kind] ?? n.kind} <ObligationBadge value={n.status} />
                          </span>
                        ))}
                      </div>
                    )}
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
