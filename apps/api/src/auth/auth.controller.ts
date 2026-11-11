import { Body, Controller, Get, HttpCode, Inject, Ip, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { eq } from "drizzle-orm";
import { DB, Database } from "../db/db.module";
import { users } from "../db/schema";
import { AuthService } from "./auth.service";
import { AuthUser, CurrentUser, Public } from "./decorators";
import { LoginDto, RefreshDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(DB) private readonly db: Database,
  ) {}

  /** Connexion : 5 tentatives par minute et par IP maximum (anti brute-force). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Ip() ip: string) {
    return this.auth.refresh(dto.refreshToken, ip);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    await this.auth.logout(dto.refreshToken, user.id, ip);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    const [row] = await this.db
      .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role })
      .from(users)
      .where(eq(users.id, user.id));
    return row;
  }
}
