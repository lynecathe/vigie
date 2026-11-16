import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { AuditService } from "../audit/audit.service";
import type { Env } from "../config/env";
import { AlertsApiKeyGuard } from "./api-key.guard";

const KEY = "k".repeat(40);
const audit = { log: jest.fn() } as unknown as AuditService;
const ctx = (key?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ header: () => key, ip: "1.2.3.4" }) }),
  }) as unknown as ExecutionContext;

describe("AlertsApiKeyGuard", () => {
  const guard = new AlertsApiKeyGuard({ alertsWebhookApiKey: KEY } as Env, audit);

  it("accepte la bonne clé", async () => {
    await expect(guard.canActivate(ctx(KEY))).resolves.toBe(true);
  });

  it("refuse une clé absente ou fausse, et le trace dans l'audit", async () => {
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx("mauvaise"))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "ALERT_WEBHOOK_REJECTED" }));
  });

  it("répond 503 si aucune clé n'est configurée", async () => {
    const disabled = new AlertsApiKeyGuard({ alertsWebhookApiKey: null } as Env, audit);
    await expect(disabled.canActivate(ctx(KEY))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
