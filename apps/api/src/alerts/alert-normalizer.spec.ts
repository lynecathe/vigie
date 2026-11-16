import { BadRequestException } from "@nestjs/common";
import { normalizeAlert } from "./alert-normalizer";

const wazuhAlert = {
  timestamp: "2026-11-16T10:12:00.000+0000",
  id: "1763287920.123456",
  rule: { level: 12, description: "Multiple authentication failures", id: "5720", groups: ["authentication_failures"] },
  agent: { id: "001", name: "srv-web-01" },
};

describe("normalizeAlert", () => {
  it("reconnaît une alerte Wazuh", () => {
    const a = normalizeAlert(wazuhAlert);
    expect(a).toMatchObject({
      source: "wazuh",
      externalId: "1763287920.123456",
      ruleId: "5720",
      title: "Multiple authentication failures",
      severity: "HIGH",
      host: "srv-web-01",
    });
    expect(a.occurredAt.toISOString()).toBe("2026-11-16T10:12:00.000Z");
    expect(a.raw).toBe(wazuhAlert);
  });

  it("reconnaît le format générique", () => {
    const a = normalizeAlert({ source: "Script", externalId: "x-1", title: "Test", severity: "LOW" });
    expect(a).toMatchObject({ source: "script", externalId: "x-1", severity: "LOW", host: null });
  });

  it.each([
    ["un tableau", []],
    ["null", null],
    ["une alerte sans sévérité valide", { source: "s", externalId: "1", title: "t", severity: "URGENT" }],
    ["une alerte Wazuh sans id", { rule: { level: 5, description: "x" } }],
  ])("refuse %s", (_, body) => {
    expect(() => normalizeAlert(body)).toThrow(BadRequestException);
  });

  it("tronque les champs trop longs", () => {
    const a = normalizeAlert({ source: "s", externalId: "1", title: "x".repeat(10_000), severity: "LOW" });
    expect(a.title.length).toBe(500);
  });
});
