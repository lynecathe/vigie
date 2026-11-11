import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
