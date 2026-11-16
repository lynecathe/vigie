import type { incidents, ObligationKind } from "../db/schema";
import { formatIncidentRef } from "../incidents/incident-rules";

interface DraftContext {
  incident: typeof incidents.$inferSelect;
  controls: { code: string; title: string }[];
  timeline: { type: string; data: Record<string, unknown>; createdAt: Date }[];
  dpo?: { fullName: string; email: string };
  awareAt: Date;
}

const TODO = "[à compléter]";
const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : TODO;
const SEVERITY_FR = { LOW: "faible", MEDIUM: "moyenne", HIGH: "élevée", CRITICAL: "critique" } as const;

function measures(ctx: DraftContext): string {
  const notes = ctx.timeline
    .filter((e) => e.type === "COMMENT" || (e.type === "STATUS_CHANGED" && e.data.note))
    .map((e) => `- ${fmt(e.createdAt)} : ${String(e.data.text ?? e.data.note)}`);
  return notes.length ? notes.join("\n") : `- ${TODO}`;
}

function header(ctx: DraftContext, title: string): string {
  const i = ctx.incident;
  return [
    `# ${title}`,
    "",
    `Incident interne : ${formatIncidentRef(i.number)} — ${i.title}`,
    `Détecté le : ${fmt(i.detectedAt)}`,
    `Pris connaissance le : ${fmt(ctx.awareAt)}`,
    `Sévérité interne : ${SEVERITY_FR[i.severity]}`,
    "",
  ].join("\n");
}

/**
 * Brouillons de notification préremplis à partir de l'incident.
 * Les champs que Vigie ne peut pas connaître sont marqués « [à compléter] ».
 * Le texte est un point de départ : l'envoi se fait sur le téléservice de l'autorité.
 */
export function renderDraft(kind: ObligationKind, ctx: DraftContext): string {
  const i = ctx.incident;
  const controlsLine = ctx.controls.length
    ? ctx.controls.map((c) => `${c.code} (${c.title})`).join(", ")
    : TODO;

  switch (kind) {
    case "GDPR_NOTIFICATION":
      return [
        header(ctx, "Notification de violation de données personnelles — CNIL (RGPD, art. 33)"),
        "## 1. Nature de la violation",
        i.description ?? TODO,
        "Type d'atteinte (confidentialité / intégrité / disponibilité) : " + TODO,
        "",
        "## 2. Personnes et données concernées",
        `Catégories de personnes : ${TODO}`,
        `Nombre approximatif de personnes : ${TODO}`,
        `Catégories de données : ${TODO}`,
        `Nombre approximatif d'enregistrements : ${TODO}`,
        "",
        "## 3. Contact",
        ctx.dpo ? `Délégué à la protection des données : ${ctx.dpo.fullName} — ${ctx.dpo.email}` : `DPO : ${TODO}`,
        "",
        "## 4. Conséquences probables pour les personnes",
        TODO,
        "",
        "## 5. Mesures prises ou envisagées",
        measures(ctx),
        "",
        "## 6. Information des personnes concernées (art. 34)",
        `Risque élevé pour les personnes ? ${TODO} — si oui, préparer leur information.`,
        "",
        `Mesures de sécurité concernées (ISO 27001) : ${controlsLine}`,
      ].join("\n");

    case "NIS2_EARLY_WARNING":
      return [
        header(ctx, "Alerte précoce — CSIRT / ANSSI (NIS2, art. 23(4)(a))"),
        `Résumé : ${i.title}`,
        `L'incident semble-t-il causé par un acte illicite ou malveillant ? ${TODO}`,
        `Peut-il avoir un impact transfrontière ? ${TODO}`,
        `Services touchés : ${TODO}`,
      ].join("\n");

    case "NIS2_NOTIFICATION":
      return [
        header(ctx, "Notification d'incident — CSIRT / ANSSI (NIS2, art. 23(4)(b))"),
        "## Mise à jour de l'alerte précoce",
        i.description ?? TODO,
        "",
        "## Évaluation initiale",
        `Gravité : ${SEVERITY_FR[i.severity]} (interne) — ${TODO}`,
        `Impact (services, utilisateurs, durée) : ${TODO}`,
        `Indicateurs de compromission disponibles : ${TODO}`,
        "",
        "## Mesures en cours",
        measures(ctx),
      ].join("\n");

    case "NIS2_FINAL_REPORT":
      return [
        header(ctx, "Rapport final — CSIRT / ANSSI (NIS2, art. 23(4)(d))"),
        "## Description détaillée et gravité",
        i.description ?? TODO,
        "",
        "## Type de menace ou cause profonde",
        TODO,
        "",
        "## Mesures d'atténuation appliquées et en cours",
        measures(ctx),
        "",
        "## Impact transfrontière",
        TODO,
        "",
        `Mesures de sécurité concernées (ISO 27001) : ${controlsLine}`,
        `Clôture interne : ${fmt(i.closedAt)}`,
      ].join("\n");
  }
}
