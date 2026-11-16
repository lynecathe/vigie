import { csvCell, toCsv } from "./csv";

describe("export CSV", () => {
  it.each(["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)"])("neutralise la formule %s", (v) => {
    expect(csvCell(v).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
  });

  it("échappe les guillemets, points-virgules et retours à la ligne", () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "bonjour"')).toBe('"dit ""bonjour"""');
    expect(csvCell("ligne1\nligne2")).toBe('"ligne1\nligne2"');
  });

  it("gère null, dates et nombres", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-11-16T10:00:00Z"))).toBe("2026-11-16T10:00:00.000Z");
    expect(csvCell(42)).toBe("42");
  });

  it("produit un fichier avec BOM et séparateur point-virgule", () => {
    const csv = toCsv(["A", "B"], [["1", "2"]]);
    expect(csv.startsWith("﻿A;B\r\n1;2")).toBe(true);
  });
});
