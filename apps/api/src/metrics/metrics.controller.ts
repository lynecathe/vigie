import { Controller, Get, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { AuthUser, CurrentUser, Roles } from "../auth/decorators";
import { VIEWER_ROLES } from "../incidents/incident-rules";
import { MetricsService } from "./metrics.service";

class MetricsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /** Indicateurs du tableau de bord sur les N derniers jours (30 par défaut). */
  @Roles(...VIEWER_ROLES)
  @Get()
  get(@Query() query: MetricsQuery, @CurrentUser() user: AuthUser) {
    return this.metrics.compute(user, query.days ?? 30);
  }
}
