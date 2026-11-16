import type { IncidentStatus, Role, Severity } from "../db/schema";

/**
 * Transitions autorisées du cycle de vie d'un incident.
 * NEW → IN_PROGRESS → (CONTAINED →) RESOLVED → CLOSED, avec réouverture possible.
 */
const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  NEW: ["IN_PROGRESS"],
  IN_PROGRESS: ["CONTAINED", "RESOLVED"],
  CONTAINED: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["IN_PROGRESS"],
};

/** Seuls le RSSI et l'admin peuvent rouvrir un incident clos. */
const REOPEN_CLOSED_ROLES: Role[] = ["CISO", "ADMIN"];

export function canTransition(from: IncidentStatus, to: IncidentStatus, role: Role): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (from === "CLOSED" && !REOPEN_CLOSED_ROLES.includes(role)) return false;
  return true;
}

export function allowedTransitions(from: IncidentStatus, role: Role): IncidentStatus[] {
  return TRANSITIONS[from].filter((to) => canTransition(from, to, role));
}

/**
 * Niveau de règle Wazuh (0 à 15) → sévérité Vigie.
 * Repères Wazuh : 7+ = événement notable, 12+ = haute importance, 15 = attaque sévère.
 */
export function severityFromWazuhLevel(level: number): Severity {
  if (level >= 14) return "CRITICAL";
  if (level >= 11) return "HIGH";
  if (level >= 7) return "MEDIUM";
  return "LOW";
}

/** Les alertes HIGH et CRITICAL ouvrent automatiquement un incident. */
export function opensIncidentAutomatically(severity: Severity): boolean {
  return severity === "HIGH" || severity === "CRITICAL";
}

export const formatIncidentRef = (n: number) => `INC-${String(n).padStart(4, "0")}`;

/** Qui peut traiter les incidents (créer, modifier, être assigné). */
export const RESPONDER_ROLES: Role[] = ["ANALYST", "CISO", "ADMIN"];
/** Qui peut consulter les incidents. Le DPO ne voit que ceux touchant des données personnelles. */
export const VIEWER_ROLES: Role[] = ["ANALYST", "CISO", "DPO", "ADMIN"];
