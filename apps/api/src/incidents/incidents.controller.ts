import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { AuthUser, CurrentUser, Roles } from "../auth/decorators";
import { CommentDto, CreateIncidentDto, LinkAlertsDto, ListIncidentsQuery, UpdateIncidentDto } from "./dto/incident.dto";
import { RESPONDER_ROLES, VIEWER_ROLES } from "./incident-rules";
import { IncidentsService } from "./incidents.service";

@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Roles(...VIEWER_ROLES)
  @Get()
  list(@Query() query: ListIncidentsQuery, @CurrentUser() user: AuthUser) {
    return this.incidents.list(query, user);
  }

  @Roles(...VIEWER_ROLES)
  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.incidents.get(id, user);
  }

  @Roles(...RESPONDER_ROLES)
  @Post()
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.incidents.create(dto, user, ip);
  }

  @Roles(...RESPONDER_ROLES)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.incidents.update(id, dto, user, ip);
  }

  /** Le DPO peut commenter les incidents qu'il voit (ex. : analyse d'impact RGPD). */
  @Roles(...VIEWER_ROLES)
  @Post(":id/comments")
  comment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CommentDto, @CurrentUser() user: AuthUser) {
    return this.incidents.comment(id, dto.text, user);
  }

  @Roles(...RESPONDER_ROLES)
  @Post(":id/alerts")
  linkAlerts(@Param("id", ParseUUIDPipe) id: string, @Body() dto: LinkAlertsDto, @CurrentUser() user: AuthUser) {
    return this.incidents.linkAlerts(id, dto.alertIds, user);
  }
}
