import type { ObligationDecision, ObligationKind, Role } from "../db/schema";

const HOUR = 3600 * 1000;

/** Ce que déclenche chaque indicateur d'un incident. */
export const GDPR_KINDS: ObligationKind[] = ["GDPR_NOTIFICATION"];
export const NIS2_KINDS: ObligationKind[] = ["NIS2_EARLY_WARNING", "NIS2_NOTIFICATION", "NIS2_FINAL_REPORT"];

export const OBLIGATION_LABELS: Record<ObligationKind, { label: string; authority: string; legalBasis: string }> = {
  GDPR_NOTIFICATION: { label: "Notification de violation de données", authority: "CNIL", legalBasis: "RGPD, art. 33" },
  NIS2_EARLY_WARNING: { label: "Alerte précoce", authority: "CSIRT / ANSSI", legalBasis: "NIS2, art. 23(4)(a)" },
  NIS2_NOTIFICATION: { label: "Notification d'incident", authority: "CSIRT / ANSSI", legalBasis: "NIS2, art. 23(4)(b)" },
  NIS2_FINAL_REPORT: { label: "Rapport final", authority: "CSIRT / ANSSI", legalBasis: "NIS2, art. 23(4)(d)" },
};

export interface ObligationTiming {
  kind: ObligationKind;
  awareAt: Date;
  decision: ObligationDecision;
  submittedAt: Date | null;
}

function addCalendarMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/**
 * Échéance légale d'une obligation.
 * - RGPD : 72 h après la prise de connaissance.
 * - NIS2 : alerte précoce 24 h, notification 72 h, rapport final 1 mois après l'envoi de la notification
 *   (ou après l'échéance de la notification tant qu'elle n'est pas envoyée).
 */
export function dueDate(o: ObligationTiming, nis2Notification?: ObligationTiming): Date {
  const aware = o.awareAt.getTime();
  switch (o.kind) {
    case "GDPR_NOTIFICATION":
    case "NIS2_NOTIFICATION":
      return new Date(aware + 72 * HOUR);
    case "NIS2_EARLY_WARNING":
      return new Date(aware + 24 * HOUR);
    case "NIS2_FINAL_REPORT": {
      const base = nis2Notification?.submittedAt ?? (nis2Notification ? dueDate(nis2Notification) : new Date(aware + 72 * HOUR));
      return addCalendarMonth(base);
    }
  }
}

export type ObligationStatus = "PENDING" | "OVERDUE" | "SUBMITTED" | "SUBMITTED_LATE" | "NOT_REQUIRED";

export function obligationStatus(o: ObligationTiming, due: Date, now = new Date()): ObligationStatus {
  if (o.decision === "NOT_REQUIRED") return "NOT_REQUIRED";
  if (o.submittedAt) return o.submittedAt > due ? "SUBMITTED_LATE" : "SUBMITTED";
  return now > due ? "OVERDUE" : "PENDING";
}

/** Qui peut décider / déclarer l'envoi d'une obligation. */
export function canHandleObligation(kind: ObligationKind, role: Role): boolean {
  if (kind === "GDPR_NOTIFICATION") return ["DPO", "CISO", "ADMIN"].includes(role);
  return ["CISO", "ADMIN"].includes(role);
}

/** Seule la notification RGPD peut être jugée « non requise » (risque improbable, art. 33.1) — à justifier. */
export const canBeNotRequired = (kind: ObligationKind) => kind === "GDPR_NOTIFICATION";
