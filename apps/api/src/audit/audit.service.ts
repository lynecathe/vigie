import { Inject, Injectable, Logger } from "@nestjs/common";
import { DB, Database } from "../db/db.module";
import { auditLogs } from "../db/schema";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "REFRESH_TOKEN_REUSE"
  | "USER_CREATED";

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  target?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(@Inject(DB) private readonly db: Database) {}

  async log(entry: AuditEntry): Promise<void> {
    // Écrit aussi dans les logs applicatifs (format JSON) pour qu'un SIEM puisse les collecter.
    this.logger.log(JSON.stringify({ type: "audit", ...entry }));
    await this.db.insert(auditLogs).values({
      action: entry.action,
      actorId: entry.actorId ?? null,
      target: entry.target,
      ip: entry.ip,
      metadata: entry.metadata ?? {},
    });
  }
}
