import { allowedTransitions, canTransition, formatIncidentRef, opensIncidentAutomatically, severityFromWazuhLevel } from "./incident-rules";

describe("cycle de vie d'un incident", () => {
  it("suit le chemin normal NEW → IN_PROGRESS → CONTAINED → RESOLVED → CLOSED", () => {
    expect(canTransition("NEW", "IN_PROGRESS", "ANALYST")).toBe(true);
    expect(canTransition("IN_PROGRESS", "CONTAINED", "ANALYST")).toBe(true);
    expect(canTransition("CONTAINED", "RESOLVED", "ANALYST")).toBe(true);
    expect(canTransition("RESOLVED", "CLOSED", "ANALYST")).toBe(true);
  });

  it("interdit de sauter des étapes", () => {
    expect(canTransition("NEW", "CLOSED", "ADMIN")).toBe(false);
    expect(canTransition("NEW", "RESOLVED", "CISO")).toBe(false);
  });

  it("seuls le RSSI et l'admin peuvent rouvrir un incident clos", () => {
    expect(canTransition("CLOSED", "IN_PROGRESS", "ANALYST")).toBe(false);
    expect(canTransition("CLOSED", "IN_PROGRESS", "CISO")).toBe(true);
    expect(allowedTransitions("CLOSED", "ANALYST")).toEqual([]);
  });
});

describe("sévérité des alertes Wazuh", () => {
  it.each([
    [3, "LOW"],
    [6, "LOW"],
    [7, "MEDIUM"],
    [10, "MEDIUM"],
    [11, "HIGH"],
    [13, "HIGH"],
    [14, "CRITICAL"],
    [15, "CRITICAL"],
  ])("niveau %i → %s", (level, expected) => {
    expect(severityFromWazuhLevel(level)).toBe(expected);
  });

  it("ouvre un incident automatiquement à partir de HIGH", () => {
    expect(opensIncidentAutomatically("MEDIUM")).toBe(false);
    expect(opensIncidentAutomatically("HIGH")).toBe(true);
    expect(opensIncidentAutomatically("CRITICAL")).toBe(true);
  });
});

it("formate la référence lisible", () => {
  expect(formatIncidentRef(7)).toBe("INC-0007");
  expect(formatIncidentRef(12345)).toBe("INC-12345");
});
