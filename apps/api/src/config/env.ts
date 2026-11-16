/**
 * Lecture et validation des variables d'environnement au démarrage.
 * L'API refuse de démarrer si une variable obligatoire manque ou est trop faible :
 * mieux vaut planter tout de suite qu'exposer une API mal configurée.
 */
export interface Env {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  corsOrigins: string[];
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function loadEnv(): Env {
  const jwtAccessSecret = required("JWT_ACCESS_SECRET");
  if (jwtAccessSecret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET doit faire au moins 32 caractères");
  }
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.API_PORT ?? 3000),
    databaseUrl: required("DATABASE_URL"),
    jwtAccessSecret,
    accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

export const ENV = Symbol("ENV");
