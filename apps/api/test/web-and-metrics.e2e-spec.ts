/** Client web (refresh token en cookie httpOnly) et indicateurs du tableau de bord. */
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ADMIN, startApp } from "./helpers";

describe("Client web et indicateurs (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const WEB = { "X-Vigie-Client": "web" };

  beforeAll(async () => {
    ({ app, http } = await startApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe("refresh token en cookie httpOnly", () => {
    let cookie: string;

    it("le client web reçoit un cookie httpOnly, SameSite=Strict, et pas de refresh token dans la réponse", async () => {
      const res = await http.post("/api/auth/login").set(WEB).send(ADMIN).expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeUndefined();
      const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
      cookie = setCookie.find((c) => c.startsWith("vigie_rt="))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
    });

    it("le cookie permet d'obtenir un nouveau jeton… seulement avec l'en-tête du client web", async () => {
      await http.post("/api/auth/refresh").set("Cookie", cookie.split(";")[0]).send({}).expect(401);
      const res = await http.post("/api/auth/refresh").set(WEB).set("Cookie", cookie.split(";")[0]).send({}).expect(200);
      expect(res.body.accessToken).toBeDefined();
      const rotated = ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("vigie_rt="))!;
      expect(rotated.split(";")[0]).not.toEqual(cookie.split(";")[0]);
      cookie = rotated;
    });

    it("la déconnexion efface le cookie et révoque le jeton", async () => {
      const token = (await http.post("/api/auth/refresh").set(WEB).set("Cookie", cookie.split(";")[0]).send({}).expect(200));
      const current = ([] as string[]).concat(token.headers["set-cookie"] ?? []).find((c) => c.startsWith("vigie_rt="))!;
      const res = await http
        .post("/api/auth/logout")
        .set(WEB)
        .set("Authorization", `Bearer ${token.body.accessToken}`)
        .set("Cookie", current.split(";")[0])
        .send({})
        .expect(204);
      expect(([] as string[]).concat(res.headers["set-cookie"] ?? []).join()).toMatch(/vigie_rt=;/);
      await http.post("/api/auth/refresh").set(WEB).set("Cookie", current.split(";")[0]).send({}).expect(401);
    });

    it("le client mobile garde le refresh token dans la réponse", async () => {
      const res = await http.post("/api/auth/login").send(ADMIN).expect(200);
      expect(res.body.refreshToken).toBeDefined();
      expect(res.headers["set-cookie"]).toBeUndefined();
    });
  });

  describe("indicateurs", () => {
    it("calcule MTTA, MTTR, incidents par jour et échéances", async () => {
      const token = (await http.post("/api/auth/login").send(ADMIN).expect(200)).body.accessToken;
      const auth = { Authorization: `Bearer ${token}` };
      const me = (await http.get("/api/auth/me").set(auth).expect(200)).body;
      const inc = (await http.post("/api/incidents").set(auth).send({ title: "Mesure MTTA", severity: "MEDIUM" }).expect(201)).body;
      await http.patch(`/api/incidents/${inc.id}`).set(auth).send({ status: "IN_PROGRESS", assigneeId: me.id }).expect(200);
      await http.patch(`/api/incidents/${inc.id}`).set(auth).send({ status: "RESOLVED", note: "Corrigé." }).expect(200);

      const res = await http.get("/api/metrics?days=7").set(auth).expect(200);
      expect(res.body.periodDays).toBe(7);
      expect(res.body.incidentsPerDay).toHaveLength(8);
      expect(res.body.incidentsPerDay.at(-1).count).toBeGreaterThan(0);
      expect(res.body.mtta.sample).toBeGreaterThan(0);
      expect(res.body.mtta.averageSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.mttr.sample).toBeGreaterThan(0);
      expect(res.body.openIncidents.bySeverity).toEqual(expect.objectContaining({ LOW: expect.any(Number), CRITICAL: expect.any(Number) }));
      expect(res.body.obligations).toEqual(
        expect.objectContaining({ pending: expect.any(Number), overdue: expect.any(Number) }),
      );
    });

    it("refuse une période invalide", async () => {
      const token = (await http.post("/api/auth/login").send(ADMIN).expect(200)).body.accessToken;
      await http.get("/api/metrics?days=0").set("Authorization", `Bearer ${token}`).expect(400);
    });
  });
});
