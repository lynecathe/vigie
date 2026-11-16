import { Module } from "@nestjs/common";
import { MetricsController } from "../metrics/metrics.controller";
import { MetricsService } from "../metrics/metrics.service";
import { GovernanceController } from "./governance.controller";
import { GovernanceService } from "./governance.service";

@Module({ controllers: [GovernanceController, MetricsController], providers: [GovernanceService, MetricsService] })
export class GovernanceModule {}
