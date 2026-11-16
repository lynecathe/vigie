import { CanActivate, ExecutionContext, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { ENV, Env } from "../config/env";

/**
 * Comparaison en temps constant, sans hachage : on compare les octets eux-mêmes.
 * Seule la longueur peut fuiter, ce qui ne révèle rien d'une clé aléatoire de longueur fixe.
 */
function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Protège le webhook d'alertes par une clé d'API (en-tête X-API-Key), comparée en temps constant. */
@Injectable()
export class AlertsApiKeyGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.env.alertsWebhookApiKey) {
      throw new ServiceUnavailableException("Webhook d'alertes désactivé (ALERTS_WEBHOOK_API_KEY absente)");
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header("x-api-key") ?? "";
    if (!safeEqual(provided, this.env.alertsWebhookApiKey)) {
      await this.audit.log({ action: "ALERT_WEBHOOK_REJECTED", ip: req.ip });
      throw new UnauthorizedException();
    }
    return true;
  }
}
