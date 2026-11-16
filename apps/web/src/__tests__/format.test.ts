import { describe, expect, it } from "vitest";
import { describeEvent, formatCountdown, formatDuration } from "../format";

describe("formatCountdown", () => {
  it("affiche les heures cumulées sous 100 h", () => {
    expect(formatCountdown(72 * 3600 - 30)).toBe("71:59:30");
  });
  it("passe aux jours au-delà de 99 h", () => {
    expect(formatCountdown(30 * 86400 + 3600 * 4 + 61)).toBe("30 j 04:01:01");
  });
  it("ne descend jamais sous zéro", () => {
    expect(formatCountdown(-5)).toBe("00:00:00");
  });
});

describe("formatDuration", () => {
  it.each([
    [null, "—"],
    [45, "45 s"],
    [125, "2 min"],
    [3 * 3600 + 12 * 60, "3 h 12 min"],
    [2 * 86400 + 4 * 3600, "2 j 4 h"],
  ])("%s s → %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("describeEvent", () => {
  it("traduit un changement de statut avec sa note", () => {
    expect(describeEvent("STATUS_CHANGED", { from: "CONTAINED", to: "RESOLVED", note: "Poste réinstallé" })).toBe(
      "Statut : Contenu → Résolu — Poste réinstallé",
    );
  });
  it("garde le type brut pour un événement inconnu", () => {
    expect(describeEvent("FUTUR", {})).toBe("FUTUR");
  });
});
