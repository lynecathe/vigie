import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/** Rôles de Vigie : analyste SOC, RSSI, DPO, administrateur. */
export const roleEnum = pgEnum("role", ["ANALYST", "CISO", "DPO", "ADMIN"]);
export type Role = (typeof roleEnum.enumValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("ANALYST"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
});

/**
 * Refresh tokens : on ne stocke que leur empreinte SHA-256, jamais le jeton lui-même.
 * Chaque utilisation crée un nouveau jeton (rotation) ; réutiliser un ancien jeton
 * révoque toute la famille (signe probable de vol).
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId)],
);

/** Journal d'audit : trace de toutes les actions sensibles (preuve pour l'ISO 27001, A.8.15). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    target: text("target"),
    ip: text("ip"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Phase 2 : alertes et incidents
// ---------------------------------------------------------------------------

export const severityEnum = pgEnum("severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type Severity = (typeof severityEnum.enumValues)[number];

/** Cycle de vie d'un incident (inspiré du NIST SP 800-61). */
export const incidentStatusEnum = pgEnum("incident_status", ["NEW", "IN_PROGRESS", "CONTAINED", "RESOLVED", "CLOSED"]);
export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Numéro lisible, affiché sous la forme INC-0001. */
    number: serial("number").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    severity: severityEnum("severity").notNull(),
    status: incidentStatusEnum("status").notNull().default("NEW"),
    /** Des données personnelles sont concernées → visible par le DPO, déclenchera le délai CNIL (phase 3). */
    personalData: boolean("personal_data").notNull().default(false),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("incidents_status_idx").on(t.status), index("incidents_assignee_idx").on(t.assigneeId)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Outil d'origine : "wazuh", "manual", etc. */
    source: text("source").notNull(),
    /** Identifiant de l'alerte dans l'outil d'origine (sert au dédoublonnage). */
    externalId: text("external_id").notNull(),
    ruleId: text("rule_id"),
    title: text("title").notNull(),
    severity: severityEnum("severity").notNull(),
    host: text("host"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("alerts_source_external_id_uq").on(t.source, t.externalId),
    index("alerts_incident_idx").on(t.incidentId),
  ],
);

/** Chronologie d'un incident : tout ce qui s'y passe, dans l'ordre (preuve pour le retour d'expérience). */
export const incidentEventTypeEnum = pgEnum("incident_event_type", [
  "CREATED",
  "STATUS_CHANGED",
  "SEVERITY_CHANGED",
  "ASSIGNED",
  "PERSONAL_DATA_CHANGED",
  "ALERT_LINKED",
  "COMMENT",
]);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: incidentEventTypeEnum("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("incident_events_incident_idx").on(t.incidentId, t.createdAt)],
);
