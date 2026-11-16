import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public, Roles } from "../auth/decorators";
import { RESPONDER_ROLES } from "../incidents/incident-rules";
import { normalizeAlert } from "./alert-normalizer";
import { AlertsService } from "./alerts.service";
import { AlertsApiKeyGuard } from "./api-key.guard";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /**
   * Webhook appelé par les outils de détection (Wazuh, scripts…).
   * Pas de JWT ici : l'outil s'authentifie avec la clé d'API (en-tête X-API-Key).
   */
  @Public()
  @UseGuards(AlertsApiKeyGuard)
  // Limite plus large que le reste de l'API : un SIEM peut envoyer des rafales d'alertes.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post()
  @HttpCode(202)
  ingest(@Body() body: unknown) {
    return this.alerts.ingest(normalizeAlert(body));
  }

  /** File d'attente : alertes qui ne sont rattachées à aucun incident. */
  @Roles(...RESPONDER_ROLES)
  @Get("untriaged")
  untriaged() {
    return this.alerts.listUntriaged();
  }
}
