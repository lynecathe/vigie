import type { IncidentStatus, ObligationStatus, Role, Severity } from "./types";

export const SEVERITY_LABEL: Record<Severity, string> = { LOW: "Faible", MEDIUM: "Moyenne", HIGH: "Élevée", CRITICAL: "Critique" };
export const STATUS_LABEL: Record<IncidentStatus, string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En analyse",
  CONTAINED: "Contenu",
  RESOLVED: "Résolu",
  CLOSED: "Clos",
};
export const ROLE_LABEL: Record<Role, string> = { ANALYST: "Analyste SOC", CISO: "RSSI", DPO: "DPO", ADMIN: "Administrateur" };
export const OBLIGATION_STATUS_LABEL: Record<ObligationStatus, string> = {
  PENDING: "À faire",
  OVERDUE: "En retard",
  SUBMITTED: "Envoyée",
  SUBMITTED_LATE: "Envoyée en retard",
  NOT_REQUIRED: "Non requise",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "—");

/** Durée lisible : « 2 j 4 h », « 3 h 12 min », « 45 s ». */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/** Compte à rebours précis : « 71:59:30 » (heures cumulées), ou « 3 j 04:12:09 » au-delà de 99 h. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 99) return `${Math.floor(h / 24)} j ${pad(h % 24)}:${pad(m)}:${pad(sec)}`;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

const EVENT_LABEL: Record<string, (d: Record<string, unknown>) => string> = {
  CREATED: (d) => (d.fromAlert ? "Incident ouvert automatiquement par une alerte" : "Incident créé"),
  STATUS_CHANGED: (d) =>
    `Statut : ${STATUS_LABEL[d.from as IncidentStatus]} → ${STATUS_LABEL[d.to as IncidentStatus]}${d.note ? ` — ${d.note}` : ""}`,
  SEVERITY_CHANGED: (d) =>
    `Sévérité : ${SEVERITY_LABEL[d.from as Severity]} → ${SEVERITY_LABEL[d.to as Severity]}${d.auto ? " (alerte plus grave reçue)" : ""}`,
  ASSIGNED: (d) => (d.name ? `Assigné à ${d.name}` : "Désassigné"),
  PERSONAL_DATA_CHANGED: (d) => (d.to ? "Données personnelles concernées : compte à rebours CNIL lancé" : "Plus de données personnelles concernées"),
  NIS2_CHANGED: (d) => (d.to ? "Incident NIS2 important : échéances 24 h / 72 h / 1 mois lancées" : "N'est plus un incident NIS2 important"),
  ALERT_LINKED: (d) => `Alerte rattachée : ${d.title}`,
  COMMENT: (d) => String(d.text),
  CONTROLS_UPDATED: (d) => `Contrôles ISO 27001 mis à jour (${(d.controlIds as string[]).length})`,
  OBLIGATION_DECIDED: (d) =>
    d.decision === "NOT_REQUIRED" ? `Notification jugée non requise — ${d.justification}` : "Décision : notifier l'autorité",
  OBLIGATION_SUBMITTED: (d) => `Notification envoyée${d.reference ? ` (n° ${d.reference})` : ""}${d.late ? " — en retard" : ""}`,
};

export const describeEvent = (type: string, data: Record<string, unknown>) => EVENT_LABEL[type]?.(data) ?? type;
