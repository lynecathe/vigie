/**
 * Échappe une valeur pour un fichier CSV ouvert dans Excel.
 * Protège contre l'injection de formules (CSV injection) : une cellule qui commence
 * par = + - @ (ou tabulation / retour chariot) serait exécutée comme une formule.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Point-virgule : séparateur attendu par Excel en français. BOM UTF-8 pour les accents. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
