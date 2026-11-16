import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Countdown, ErrorBox, ObligationBadge, Panel, SeverityBadge, StatusBadge } from "../components";
import { SEVERITY_LABEL, STATUS_LABEL, describeEvent, formatDate } from "../format";
import { useResource } from "../hooks";
import type { Control, IncidentDetail, IncidentStatus, Obligation, Severity } from "../types";

const NEEDS_NOTE: IncidentStatus[] = ["RESOLVED", "CLOSED"];
const ACTION_LABEL: Record<IncidentStatus, string> = {
  NEW: "Remettre en nouveau",
  IN_PROGRESS: "Prendre en charge",
  CONTAINED: "Marquer comme contenu",
  RESOLVED: "Marquer comme résolu",
  CLOSED: "Clore",
};

interface Assignable {
  id: string;
  fullName: string;
}

function StatusActions({ incident, onChange }: { incident: IncidentDetail; onChange: (i: IncidentDetail) => void }) {
  const [target, setTarget] = useState<IncidentStatus | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function apply(status: IncidentStatus, withNote?: string) {
    try {
      onChange(await api<IncidentDetail>(`/incidents/${incident.id}`, { method: "PATCH", body: { status, note: withNote } }));
      setTarget(null);
      setNote("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (incident.allowedTransitions.length === 0) return null;
  return (
    <div className="pile">
      <div className="actions">
        {incident.allowedTransitions.map((s) => (
          <button
            key={s}
            className={s === "IN_PROGRESS" || s === "CONTAINED" ? undefined : "second"}
            onClick={() => (NEEDS_NOTE.includes(s) ? setTarget(s) : apply(s))}
          >
            {ACTION_LABEL[s]}
          </button>
        ))}
      </div>
      {target && (
        <form
          className="pile"
          onSubmit={(e) => {
            e.preventDefault();
            apply(target, note);
          }}
        >
          <label>
            Ce qui a été fait (obligatoire pour « {STATUS_LABEL[target]} »)
            <textarea required maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            <button type="submit">{ACTION_LABEL[target]}</button>
            <button type="button" className="second" onClick={() => setTarget(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}
      <ErrorBox message={error} />
    </div>
  );
}

function Properties({ incident, onChange }: { incident: IncidentDetail; onChange: (i: IncidentDetail) => void }) {
  const { can } = useAuth();
  const editable = can("ANALYST", "CISO", "ADMIN");
  const assignable = useResource<Assignable[]>(editable ? "/users/assignable" : null);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    try {
      onChange(await api<IncidentDetail>(`/incidents/${incident.id}`, { method: "PATCH", body }));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel title="Qualification">
      <div className="pile">
        <label>
          Sévérité
          <select disabled={!editable} value={incident.severity} onChange={(e) => patch({ severity: e.target.value as Severity })}>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigné à
          <select
            disabled={!editable}
            value={incident.assigneeId ?? ""}
            onChange={(e) => patch({ assigneeId: e.target.value || null })}
          >
            <option value="">Personne</option>
            {!assignable.data && incident.assigneeId && <option value={incident.assigneeId}>{incident.assigneeName}</option>}
            {assignable.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="case">
          <input
            type="checkbox"
            disabled={!editable}
            checked={incident.personalData}
            onChange={(e) => patch({ personalData: e.target.checked })}
          />
          Données personnelles concernées
        </label>
        <label className="case">
          <input
            type="checkbox"
            disabled={!editable}
            checked={incident.nis2Significant}
            onChange={(e) => patch({ nis2Significant: e.target.checked })}
          />
          Incident important (NIS2)
        </label>
        <p className="discret">Détecté le {formatDate(incident.detectedAt)}</p>
        {incident.closedAt && <p className="discret">Clos le {formatDate(incident.closedAt)}</p>}
        <ErrorBox message={error} />
      </div>
    </Panel>
  );
}

function ObligationCard({
  incidentId,
  o,
  blocked,
  onChange,
}: {
  incidentId: string;
  o: Obligation;
  /** Raison pour laquelle l'envoi n'est pas encore possible (ex. rapport final avant la notification). */
  blocked: string | null;
  onChange: (list: Obligation[]) => void;
}) {
  const [mode, setMode] = useState<"none" | "skip" | "submit">("none");
  const [justification, setJustification] = useState("");
  const [reference, setReference] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/incidents/${incidentId}/obligations/${o.kind}`;
  const open = o.status === "PENDING" || o.status === "OVERDUE";

  async function run(path: string, body: unknown) {
    try {
      onChange(await api<Obligation[]>(path, { method: "POST", body }));
      setMode("none");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function showDraft() {
    try {
      setDraft((await api<{ text: string }>(`${base}/draft`)).text);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className={`obligation ${o.status}`}>
      <div className="entete" style={{ alignItems: "baseline" }}>
        <h3>
          {o.label} — {o.authority}
        </h3>
        <ObligationBadge value={o.status} />
      </div>
      {open ? (
        <>
          <Countdown dueAt={o.dueAt} />
          <p className="discret">
            Échéance le {formatDate(o.dueAt)} ({o.legalBasis})
          </p>
        </>
      ) : (
        <p className="discret">
          {o.status === "NOT_REQUIRED"
            ? `Non requise : ${o.justification}`
            : `Envoyée le ${formatDate(o.submittedAt)}${o.reference ? `, n° ${o.reference}` : ""}`}
        </p>
      )}

      {open && o.canHandle && (
        <div className="actions">
          <button onClick={() => setMode("submit")} disabled={!!blocked} title={blocked ?? undefined}>
            Déclarer l'envoi
          </button>
          <button className="second" onClick={showDraft}>
            Préparer le brouillon
          </button>
          {o.kind === "GDPR_NOTIFICATION" && (
            <button className="second" onClick={() => setMode("skip")}>
              Pas de notification requise
            </button>
          )}
        </div>
      )}
      {open && o.canHandle && blocked && <p className="discret">{blocked}</p>}
      {open && !o.canHandle && (
        <p className="discret">À traiter par {o.kind === "GDPR_NOTIFICATION" ? "le DPO ou le RSSI" : "le RSSI"}.</p>
      )}

      {mode === "skip" && (
        <form
          className="pile"
          onSubmit={(e) => {
            e.preventDefault();
            run(`${base}/decision`, { decision: "NOT_REQUIRED", justification });
          }}
        >
          <label>
            Pourquoi la violation ne présente pas de risque pour les personnes
            <textarea required maxLength={5000} value={justification} onChange={(e) => setJustification(e.target.value)} />
          </label>
          <p className="discret">Cette justification est conservée dans le registre des violations (RGPD, art. 33.5).</p>
          <div className="actions">
            <button type="submit">Enregistrer la décision</button>
            <button type="button" className="second" onClick={() => setMode("none")}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {mode === "submit" && (
        <form
          className="pile"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            run(`${base}/submission`, { reference: reference || undefined, delayReason: delayReason || undefined });
          }}
        >
          <label>
            Numéro de dossier donné par l'autorité (facultatif)
            <input maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          {o.status === "OVERDUE" && (
            <label>
              Motif du retard (obligatoire)
              <textarea required maxLength={5000} value={delayReason} onChange={(e) => setDelayReason(e.target.value)} />
            </label>
          )}
          <div className="actions">
            <button type="submit">Confirmer l'envoi</button>
            <button type="button" className="second" onClick={() => setMode("none")}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {draft && (
        <div className="pile">
          <pre className="brouillon">{draft}</pre>
          <div className="actions">
            <button className="second" onClick={() => navigator.clipboard?.writeText(draft)}>
              Copier le texte
            </button>
            <button className="second" onClick={() => setDraft(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
      <ErrorBox message={error} />
    </div>
  );
}

function ControlsEditor({ incident, onSaved }: { incident: IncidentDetail; onSaved: () => void }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const catalogue = useResource<Control[]>(editing ? "/controls" : null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setSelected(new Set(incident.controls.map((c) => c.id)));
    setEditing(true);
  };

  async function save() {
    try {
      await api(`/incidents/${incident.id}/controls`, { method: "PUT", body: { controlIds: [...selected] } });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel
      title="Contrôles ISO 27001"
      actions={can("ANALYST", "CISO", "ADMIN") && !editing && <button className="second" onClick={start}>Modifier</button>}
    >
      {!editing &&
        (incident.controls.length === 0 ? (
          <p className="discret">Aucun contrôle rattaché. Indiquez quelles mesures ont été mises en défaut ou mobilisées.</p>
        ) : (
          <ul className="chrono-liste">
            {incident.controls.map((c) => (
              <li key={c.id} style={{ gridTemplateColumns: "56px 1fr" }}>
                <span className="ref">{c.code}</span>
                <span>{c.title}</span>
              </li>
            ))}
          </ul>
        ))}
      {editing && (
        <div className="pile">
          <div style={{ maxHeight: 320, overflow: "auto", display: "grid", gap: 6 }}>
            {catalogue.data?.map((c) => (
              <label key={c.id} className="case">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setSelected(next);
                  }}
                />
                <span>
                  <span className="ref">{c.code}</span> {c.title}
                </span>
              </label>
            ))}
          </div>
          <div className="actions">
            <button onClick={save}>Enregistrer</button>
            <button className="second" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
          <ErrorBox message={error ?? catalogue.error} />
        </div>
      )}
    </Panel>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams();
  const incident = useResource<IncidentDetail>(`/incidents/${id}`);
  const obligations = useResource<Obligation[]>(`/incidents/${id}/obligations`);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  if (incident.error) {
    return (
      <>
        <ErrorBox message={incident.error} />
        <Link to="/incidents">Retour aux incidents</Link>
      </>
    );
  }
  const i = incident.data;
  if (!i) return <p className="vide">Chargement…</p>;

  // Toute modification de l'incident peut créer ou retirer des obligations (RGPD, NIS2) : on les recharge.
  const changed = (next: IncidentDetail) => {
    incident.setData(next);
    obligations.reload();
  };
  const obligationsChanged = (list: Obligation[]) => {
    obligations.setData(list);
    incident.reload();
  };

  async function addComment(e: FormEvent) {
    e.preventDefault();
    try {
      incident.setData(await api<IncidentDetail>(`/incidents/${id}/comments`, { method: "POST", body: { text: comment } }));
      setComment("");
      setCommentError(null);
    } catch (err) {
      setCommentError((err as Error).message);
    }
  }

  return (
    <>
      <div className="entete">
        <div className="pile" style={{ gap: 8 }}>
          <Link to="/incidents" className="discret">
            Incidents
          </Link>
          <h1>
            <span className="ref" style={{ fontSize: "1rem", marginRight: 12 }}>
              {i.ref}
            </span>
            {i.title}
          </h1>
          <div className="actions" style={{ alignItems: "center" }}>
            <SeverityBadge value={i.severity} />
            <StatusBadge value={i.status} />
            {i.personalData && <span className="drapeau">RGPD</span>}
            {i.nis2Significant && <span className="drapeau">NIS2</span>}
          </div>
        </div>
      </div>

      <div className="deux">
        <div className="pile">
          <Panel title="Traitement">
            <div className="pile">
              {i.description && <p style={{ whiteSpace: "pre-wrap" }}>{i.description}</p>}
              <StatusActions incident={i} onChange={changed} />
            </div>
          </Panel>

          {obligations.data && obligations.data.length > 0 && (
            <Panel title="Notifications aux autorités">
              <div className="pile">
                {obligations.data.map((o) => (
                  <ObligationCard
                    key={o.id}
                    incidentId={i.id}
                    o={o}
                    blocked={
                      o.kind === "NIS2_FINAL_REPORT" &&
                      !obligations.data!.some((x) => x.kind === "NIS2_NOTIFICATION" && x.submittedAt)
                        ? "Le rapport final s'envoie après la notification d'incident ; son délai d'un mois court à partir de cet envoi."
                        : null
                    }
                    onChange={obligationsChanged}
                  />
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Chronologie">
            <ol className="chrono-liste">
              {i.timeline.map((ev) => (
                <li key={ev.id} className={ev.type}>
                  <time dateTime={ev.createdAt}>{formatDate(ev.createdAt)}</time>
                  <div>
                    <p>{describeEvent(ev.type, ev.data)}</p>
                    <span className="qui">{ev.actorName}</span>
                  </div>
                </li>
              ))}
            </ol>
            <form className="pile" onSubmit={addComment} style={{ marginTop: 16 }}>
              <label>
                Ajouter une note
                <textarea required maxLength={5000} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
              <ErrorBox message={commentError} />
              <div>
                <button type="submit">Ajouter à la chronologie</button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="pile">
          <Properties incident={i} onChange={changed} />
          <ControlsEditor incident={i} onSaved={incident.reload} />
          <Panel title={`Alertes rattachées (${i.alerts.length})`}>
            {i.alerts.length === 0 ? (
              <p className="discret">Incident déclaré manuellement, sans alerte.</p>
            ) : (
              <ul className="chrono-liste">
                {i.alerts.map((a) => (
                  <li key={a.id} style={{ gridTemplateColumns: "1fr" }}>
                    <div>
                      <p>{a.title}</p>
                      <span className="qui">
                        <SeverityBadge value={a.severity} /> {a.source}
                        {a.host ? `, ${a.host}` : ""} — {formatDate(a.occurredAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
