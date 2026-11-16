import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./auth.guard";
import { IS_PUBLIC, ROLES } from "./decorators";
import { RolesGuard } from "./roles.guard";

function contextWith(req: Record<string, unknown>, meta: Record<string, unknown> = {}) {
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC, meta[IS_PUBLIC], handler);
  Reflect.defineMetadata(ROLES, meta[ROLES], handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  const jwt = new JwtService({ secret: "x".repeat(32) });
  const guard = new JwtAuthGuard(jwt, new Reflector());

  it("laisse passer une route @Public()", async () => {
    await expect(guard.canActivate(contextWith({ headers: {} }, { [IS_PUBLIC]: true }))).resolves.toBe(true);
  });

  it("refuse une requête sans jeton", async () => {
    await expect(guard.canActivate(contextWith({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("refuse un jeton signé avec un autre secret", async () => {
    const forged = await new JwtService({ secret: "y".repeat(32) }).signAsync({ sub: "1", role: "ADMIN" });
    const ctx = contextWith({ headers: { authorization: `Bearer ${forged}` } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepte un jeton valide et attache l'utilisateur à la requête", async () => {
    const token = await jwt.signAsync({ sub: "u1", email: "a@b.fr", role: "ANALYST" });
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(contextWith(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: "u1", email: "a@b.fr", role: "ANALYST" });
  });
});

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  it("laisse passer quand aucun rôle n'est exigé", () => {
    expect(guard.canActivate(contextWith({ user: { role: "ANALYST" } }))).toBe(true);
  });

  it("laisse passer un ADMIN sur une route ADMIN", () => {
    expect(guard.canActivate(contextWith({ user: { role: "ADMIN" } }, { [ROLES]: ["ADMIN"] }))).toBe(true);
  });

  it("refuse un ANALYST sur une route ADMIN", () => {
    expect(() => guard.canActivate(contextWith({ user: { role: "ANALYST" } }, { [ROLES]: ["ADMIN"] }))).toThrow(
      ForbiddenException,
    );
  });
});
