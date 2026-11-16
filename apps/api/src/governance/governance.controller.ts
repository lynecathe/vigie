import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthUser, CurrentUser, Roles } from "../auth/decorators";
import { RESPONDER_ROLES, VIEWER_ROLES } from "../incidents/incident-rules";
import { CreateControlDto, DecideDto, IncidentObligationParams, RegisterQuery, SetControlsDto, SubmitDto } from "./dto/governance.dto";
import { GovernanceService } from "./governance.service";

@Controller()
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  // --- Référentiel de contrôles ---

  @Roles(...VIEWER_ROLES)
  @Get("controls")
  listControls() {
    return this.governance.listControls();
  }

  @Roles("ADMIN")
  @Post("controls")
  createControl(@Body() dto: CreateControlDto) {
    return this.governance.createControl(dto);
  }

  @Roles(...RESPONDER_ROLES)
  @Put("incidents/:id/controls")
  setControls(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetControlsDto, @CurrentUser() user: AuthUser) {
    return this.governance.setControls(id, dto.controlIds, user);
  }

  // --- Obligations réglementaires ---

  @Roles(...VIEWER_ROLES)
  @Get("incidents/:id/obligations")
  obligations(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.governance.obligationsOf(id, user);
  }

  /** Comptes à rebours en cours, du plus urgent au moins urgent. */
  @Roles("CISO", "DPO", "ADMIN")
  @Get("obligations/upcoming")
  upcoming(@CurrentUser() user: AuthUser) {
    return this.governance.upcoming(user);
  }

  @Roles("CISO", "DPO", "ADMIN")
  @Post("incidents/:id/obligations/:kind/decision")
  decide(
    @Param("id", ParseUUIDPipe) id: string,
    @Param() params: IncidentObligationParams,
    @Body() dto: DecideDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.decide(id, params.kind, dto, user);
  }

  @Roles("CISO", "DPO", "ADMIN")
  @Post("incidents/:id/obligations/:kind/submission")
  submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Param() params: IncidentObligationParams,
    @Body() dto: SubmitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.submit(id, params.kind, dto, user);
  }

  @Roles("CISO", "DPO", "ADMIN")
  @Get("incidents/:id/obligations/:kind/draft")
  draft(@Param("id", ParseUUIDPipe) id: string, @Param() params: IncidentObligationParams, @CurrentUser() user: AuthUser) {
    return this.governance.draft(id, params.kind, user);
  }

  // --- Registre des incidents (preuve d'audit, RGPD art. 33.5) ---

  @Roles("CISO", "DPO", "ADMIN")
  @Get("register")
  @Header("Cache-Control", "no-store")
  async register(@Query() query: RegisterQuery, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    if (query.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="registre-incidents-${new Date().toISOString().slice(0, 10)}.csv"`);
      return this.governance.registerCsv(user, query.personalDataOnly);
    }
    return this.governance.register(user, query.personalDataOnly);
  }
}
