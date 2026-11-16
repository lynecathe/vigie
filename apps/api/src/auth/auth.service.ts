import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { ENV, Env } from "../config/env";
import { DB, Database } from "../db/db.module";
import { refreshTokens, users } from "../db/schema";
import { AuthUser } from "./decorators";
import { hashPassword, verifyPassword } from "./password";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class AuthService {
  // Hash factice : on vérifie quand même un mot de passe quand l'e-mail est inconnu,
  // pour que le temps de réponse ne révèle pas quels comptes existent.
  private readonly dummyHash = hashPassword(randomBytes(16).toString("hex"));

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string): Promise<TokenPair> {
    const normalized = email.trim().toLowerCase();
    const [user] = await this.db.select().from(users).where(eq(users.email, normalized));

    const valid = user
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyPassword(password, await this.dummyHash), false);

    if (!user || !valid || user.disabledAt) {
      await this.audit.log({ action: "LOGIN_FAILURE", actorId: user?.id, target: normalized, ip });
      // Message volontairement générique (ne pas indiquer si l'e-mail existe).
      throw new UnauthorizedException("Identifiants invalides");
    }

    await this.audit.log({ action: "LOGIN_SUCCESS", actorId: user.id, ip });
    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));

    if (!stored) throw new UnauthorizedException();

    if (stored.revokedAt) {
      // Jeton déjà utilisé : probablement volé. On coupe toutes les sessions de l'utilisateur.
      await this.revokeAll(stored.userId);
      await this.audit.log({ action: "REFRESH_TOKEN_REUSE", actorId: stored.userId, ip });
      throw new UnauthorizedException();
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException();

    const [user] = await this.db.select().from(users).where(eq(users.id, stored.userId));
    if (!user || user.disabledAt) throw new UnauthorizedException();

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(refreshToken: string, userId: string, ip?: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, sha256(refreshToken)),
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
        ),
      );
    await this.audit.log({ action: "LOGOUT", actorId: userId, ip });
  }

  private async revokeAll(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + this.env.refreshTokenTtlDays * 24 * 3600 * 1000);
    await this.db.insert(refreshTokens).values({ userId: user.id, tokenHash: sha256(refreshToken), expiresAt });
    return { accessToken, refreshToken, expiresIn: this.env.accessTokenTtlSeconds };
  }
}
