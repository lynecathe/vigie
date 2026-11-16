import { BadRequestException } from "@nestjs/common";
import type { Severity } from "../db/schema";
import { severityFromWazuhLevel } from "../incidents/incident-rules";

export interface NormalizedAlert {
  source: string;
  externalId: string;
  ruleId: string | null;
  title: string;
  severity: Severity;
  host: string | null;
  occurredAt: Date;
  raw: Record<string, unknown>;
}

const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const str = (v: unknown, max = 500): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : null;

function parseDate(v: unknown): Date {
  const d = typeof v === "string" || typeof v === "number" ? new Date(v) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Accepte deux formats :
 *  - une alerte Wazuh brute (champs rule.level, rule.description, agent.name, id, timestamp) ;
 *  - un format générique Vigie : { source, externalId, title, severity, host?, occurredAt? }.
 */
export function normalizeAlert(body: unknown): NormalizedAlert {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("Le corps doit être un objet JSON");
  }
  const raw = body as Record<string, unknown>;
  const rule = raw.rule as Record<string, unknown> | undefined;

  if (rule && typeof rule === "object" && typeof rule.level === "number") {
    const agent = (raw.agent ?? {}) as Record<string, unknown>;
    const externalId = str(raw.id, 200);
    const title = str(rule.description);
    if (!externalId || !title) throw new BadRequestException("Alerte Wazuh incomplète (id et rule.description requis)");
    return {
      source: "wazuh",
      externalId,
      ruleId: str(rule.id, 50),
      title,
      severity: severityFromWazuhLevel(rule.level),
      host: str(agent.name, 200),
      occurredAt: parseDate(raw.timestamp),
      raw,
    };
  }

  const source = str(raw.source, 50);
  const externalId = str(raw.externalId, 200);
  const title = str(raw.title);
  const severity = raw.severity as Severity;
  if (!source || !externalId || !title || !SEVERITIES.includes(severity)) {
    throw new BadRequestException(
      "Format non reconnu : envoie une alerte Wazuh ou { source, externalId, title, severity (LOW|MEDIUM|HIGH|CRITICAL) }",
    );
  }
  return {
    source: source.toLowerCase(),
    externalId,
    ruleId: str(raw.ruleId, 50),
    title,
    severity,
    host: str(raw.host, 200),
    occurredAt: parseDate(raw.occurredAt),
    raw,
  };
}
