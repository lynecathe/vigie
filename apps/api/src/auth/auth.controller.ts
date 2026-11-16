import { Body, Controller, Get, HttpCode, Inject, Ip, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { DB, Database } from "../db/db.module";
import { users } from "../db/schema";
import { ENV, Env } from "../config/env";
import { AuthService, TokenPair } from "./auth.service";
import { AuthUser, CurrentUser, Public } from "./decorators";
import { LoginDto, RefreshDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Connexion : 5 tentatives par minute et par IP maximum (anti brute-force). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(await this.auth.login(dto.email, dto.password, ip), req, res);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(await this.auth.refresh(this.refreshTokenFrom(dto, req), ip), req, res);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Body() dto: RefreshDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.refreshTokenFrom(dto, req), user.id, ip);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  /**
   * Client web (en-tête X-Vigie-Client: web) : le refresh token part dans un cookie httpOnly,
   * illisible par JavaScript (protection contre le vol par XSS), et n'apparaît pas dans la réponse.
   * Client mobile : il reste dans la réponse, à stocker dans le coffre sécurisé du téléphone.
   */
  private deliver(tokens: TokenPair, req: Request, res: Response) {
    if (!isWebClient(req)) return tokens;
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.env.refreshTokenTtlDays * 24 * 3600 * 1000,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  private refreshTokenFrom(dto: RefreshDto, req: Request): string {
    if (dto.refreshToken) return dto.refreshToken;
    // Le cookie n'est accepté qu'avec l'en-tête du client web : un site tiers ne peut pas l'ajouter
    // sans déclencher une requête CORS préalable (défense en profondeur contre le CSRF, en plus de SameSite=Strict).
    const fromCookie = isWebClient(req) ? (req.cookies?.[REFRESH_COOKIE] as string | undefined) : undefined;
    if (!fromCookie) throw new UnauthorizedException();
    return fromCookie;
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: "strict", secure: this.env.nodeEnv === "production", path: "/api/auth" };
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

const REFRESH_COOKIE = "vigie_rt";
const isWebClient = (req: Request) => req.header("x-vigie-client") === "web";
