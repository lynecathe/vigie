import { renderDraft } from "./notification-drafts";

const incident = {
  id: "x",
  number: 3,
  title: "Fuite d'un export clients",
  description: "Un export CSV a été envoyé à un mauvais destinataire.",
  severity: "HIGH" as const,
  status: "IN_PROGRESS" as const,
  personalData: true,
  nis2Significant: false,
  assigneeId: null,
  createdById: null,
  detectedAt: new Date("2026-11-16T09:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
};

describe("brouillons de notification", () => {
  it("préremplit la notification CNIL avec l'incident, le DPO, les mesures et les contrôles", () => {
    const text = renderDraft("GDPR_NOTIFICATION", {
      incident,
      controls: [{ code: "8.12", title: "Prévention des fuites de données" }],
      timeline: [{ type: "COMMENT", data: { text: "Destinataire contacté, fichier supprimé." }, createdAt: new Date() }],
      dpo: { fullName: "Dana DPO", email: "dpo@exemple.fr" },
      awareAt: new Date("2026-11-16T10:00:00Z"),
    });
    expect(text).toContain("RGPD, art. 33");
    expect(text).toContain("INC-0003");
    expect(text).toContain("Dana DPO — dpo@exemple.fr");
    expect(text).toContain("Destinataire contacté, fichier supprimé.");
    expect(text).toContain("8.12 (Prévention des fuites de données)");
    expect(text).toContain("[à compléter]");
  });

  it("produit un brouillon pour chaque étape NIS2", () => {
    const ctx = { incident, controls: [], timeline: [], awareAt: new Date() };
    expect(renderDraft("NIS2_EARLY_WARNING", ctx)).toContain("art. 23(4)(a)");
    expect(renderDraft("NIS2_NOTIFICATION", ctx)).toContain("art. 23(4)(b)");
    expect(renderDraft("NIS2_FINAL_REPORT", ctx)).toContain("art. 23(4)(d)");
  });
});
