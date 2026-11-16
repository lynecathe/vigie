import { canBeNotRequired, canHandleObligation, dueDate, obligationStatus, type ObligationTiming } from "./obligation-rules";

const aware = new Date("2026-11-16T10:00:00.000Z");
const o = (kind: ObligationTiming["kind"], extra: Partial<ObligationTiming> = {}): ObligationTiming => ({
  kind,
  awareAt: aware,
  decision: "PENDING",
  submittedAt: null,
  ...extra,
});

describe("échéances réglementaires", () => {
  it("RGPD : 72 h après la prise de connaissance", () => {
    expect(dueDate(o("GDPR_NOTIFICATION")).toISOString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("NIS2 : alerte précoce 24 h, notification 72 h", () => {
    expect(dueDate(o("NIS2_EARLY_WARNING")).toISOString()).toBe("2026-11-17T10:00:00.000Z");
    expect(dueDate(o("NIS2_NOTIFICATION")).toISOString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("NIS2 : rapport final 1 mois après l'échéance de la notification tant qu'elle n'est pas envoyée", () => {
    expect(dueDate(o("NIS2_FINAL_REPORT"), o("NIS2_NOTIFICATION")).toISOString()).toBe("2026-12-19T10:00:00.000Z");
  });

  it("NIS2 : rapport final 1 mois après l'envoi effectif de la notification", () => {
    const sent = o("NIS2_NOTIFICATION", { submittedAt: new Date("2026-11-17T08:00:00.000Z") });
    expect(dueDate(o("NIS2_FINAL_REPORT"), sent).toISOString()).toBe("2026-12-17T08:00:00.000Z");
  });
});

describe("statut d'une obligation", () => {
  const due = dueDate(o("GDPR_NOTIFICATION"));

  it("en attente avant l'échéance, en retard après", () => {
    expect(obligationStatus(o("GDPR_NOTIFICATION"), due, new Date("2026-11-18T10:00:00Z"))).toBe("PENDING");
    expect(obligationStatus(o("GDPR_NOTIFICATION"), due, new Date("2026-11-19T10:00:01Z"))).toBe("OVERDUE");
  });

  it("envoyée dans les temps ou en retard", () => {
    expect(obligationStatus(o("GDPR_NOTIFICATION", { submittedAt: new Date("2026-11-18T09:00:00Z") }), due)).toBe("SUBMITTED");
    expect(obligationStatus(o("GDPR_NOTIFICATION", { submittedAt: new Date("2026-11-20T09:00:00Z") }), due)).toBe(
      "SUBMITTED_LATE",
    );
  });

  it("non requise", () => {
    expect(obligationStatus(o("GDPR_NOTIFICATION", { decision: "NOT_REQUIRED" }), due)).toBe("NOT_REQUIRED");
  });
});

describe("qui décide", () => {
  it("le DPO gère le RGPD mais pas NIS2", () => {
    expect(canHandleObligation("GDPR_NOTIFICATION", "DPO")).toBe(true);
    expect(canHandleObligation("NIS2_NOTIFICATION", "DPO")).toBe(false);
  });

  it("l'analyste ne gère aucune notification réglementaire", () => {
    expect(canHandleObligation("GDPR_NOTIFICATION", "ANALYST")).toBe(false);
    expect(canHandleObligation("NIS2_EARLY_WARNING", "ANALYST")).toBe(false);
  });

  it("seule la notification RGPD peut être jugée non requise", () => {
    expect(canBeNotRequired("GDPR_NOTIFICATION")).toBe(true);
    expect(canBeNotRequired("NIS2_EARLY_WARNING")).toBe(false);
  });
});
