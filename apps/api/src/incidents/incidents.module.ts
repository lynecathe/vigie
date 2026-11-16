import { Module } from "@nestjs/common";
import { AlertsController } from "../alerts/alerts.controller";
import { AlertsService } from "../alerts/alerts.service";
import { AlertsApiKeyGuard } from "../alerts/api-key.guard";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  controllers: [IncidentsController, AlertsController],
  providers: [IncidentsService, AlertsService, AlertsApiKeyGuard],
})
export class IncidentsModule {}
