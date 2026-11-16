import { CanActivate, ExecutionContext, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { ENV, Env } from "../config/env";

const digest = (v: string) => createHash("sha256").update(v).digest();

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
    // On compare des empreintes de même longueur pour ne rien révéler par le temps de réponse.
    if (!timingSafeEqual(digest(provided), digest(this.env.alertsWebhookApiKey))) {
      await this.audit.log({ action: "ALERT_WEBHOOK_REJECTED", ip: req.ip });
      throw new UnauthorizedException();
    }
    return true;
  }
}
