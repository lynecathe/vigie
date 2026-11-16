import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ENV, Env } from "./config/env";
import { DbModule } from "./db/db.module";
import { HealthController } from "./health/health.controller";
import { UsersModule } from "./users/users.module";

export function createAppModule(env: Env) {
  @Module({
    imports: [
      { module: class EnvModule {}, global: true, providers: [{ provide: ENV, useValue: env }], exports: [ENV] },
      // Limite globale : 100 requêtes par minute et par IP.
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      DbModule,
      AuditModule,
      AuthModule,
      UsersModule,
    ],
    controllers: [HealthController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  class AppModule {}
  return AppModule;
}
