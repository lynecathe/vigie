import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("client API", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("rafraîchit la session une seule fois puis rejoue la requête après un 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { message: "expiré" }))
      .mockResolvedValueOnce(json(200, { accessToken: "neuf" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("../api");

    await expect(api("/incidents")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[1][1].headers["X-Vigie-Client"]).toBe("web");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer neuf");
  });

  it("signale la perte de session si le rafraîchissement échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(401, {}))
        .mockResolvedValueOnce(json(401, {}))
        .mockResolvedValue(json(401, { message: "Non authentifié" })),
    );
    const { api, setSessionLostHandler } = await import("../api");
    const lost = vi.fn();
    setSessionLostHandler(lost);

    await expect(api("/incidents")).rejects.toMatchObject({ status: 401 });
    expect(lost).toHaveBeenCalledOnce();
  });

  it("ne stocke jamais le jeton dans le navigateur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { accessToken: "secret" })));
    const { login } = await import("../api");
    await login("a@b.fr", "x");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("assemble les messages de validation de l'API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(400, { message: ["titre trop court", "sévérité invalide"] })));
    const { api } = await import("../api");
    await expect(api("/incidents", { method: "POST", body: {} })).rejects.toThrow("titre trop court ; sévérité invalide");
  });
});
