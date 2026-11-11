import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Role } from "../db/schema";

export const IS_PUBLIC = "isPublic";
/** Route accessible sans être connecté (ex. login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = "roles";
/** Restreint une route à certains rôles. Ex. : @Roles("ADMIN"). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Injecte l'utilisateur connecté dans un paramètre de contrôleur. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
