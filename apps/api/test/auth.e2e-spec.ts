/**
 * Parcours complet contre une vraie base PostgreSQL :
 * connexion, profil, contrôle des rôles, rotation des refresh tokens, déconnexion.
 * Lancement : npm run test:e2e (après db:migrate et db:seed).
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { createAppModule } from "../src/app.module";
import { loadEnv } from "../src/config/env";

const ADMIN = { email: process.env.SEED_ADMIN_EMAIL!, password: process.env.SEED_ADMIN_PASSWORD! };
const ANALYST = {
  email: `analyste-${Date.now()}@exemple.fr`,
  fullName: "Ana Lyste",
  password: "AnalysteSOC2026",
  role: "ANALYST",
};

describe("Authentification (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [createAppModule(loadEnv())] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health est public", async () => {
    await http.get("/api/health").expect(200, { status: "ok" });
  });

  it("refuse l'accès sans jeton", async () => {
    await http.get("/api/auth/me").expect(401);
  });

  it("refuse un mauvais mot de passe avec un message générique", async () => {
    const res = await http.post("/api/auth/login").send({ email: ADMIN.email, password: "Mauvais123456" }).expect(401);
    expect(res.body.message).toBe("Identifiants invalides");
  });

  it("parcours complet admin → création d'un analyste → contrôle des rôles", async () => {
    const login = await http.post("/api/auth/login").send(ADMIN).expect(200);
    const adminToken = login.body.accessToken as string;

    const me = await http.get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(me.body).toMatchObject({ email: ADMIN.email, role: "ADMIN" });
    expect(me.body.passwordHash).toBeUndefined();

    // Champ non prévu dans le DTO → refusé (anti mass assignment).
    await http
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...ANALYST, isAdmin: true })
      .expect(400);

    const created = await http.post("/api/users").set("Authorization", `Bearer ${adminToken}`).send(ANALYST).expect(201);
    expect(created.body.role).toBe("ANALYST");
    expect(created.body.passwordHash).toBeUndefined();

    const analystLogin = await http
      .post("/api/auth/login")
      .send({ email: ANALYST.email, password: ANALYST.password })
      .expect(200);
    // Un analyste ne peut pas gérer les comptes.
    await http.get("/api/users").set("Authorization", `Bearer ${analystLogin.body.accessToken}`).expect(403);
  });

  it("fait tourner les refresh tokens et détecte leur réutilisation", async () => {
    const login = await http.post("/api/auth/login").send(ADMIN).expect(200);
    const first = login.body.refreshToken as string;

    const refreshed = await http.post("/api/auth/refresh").send({ refreshToken: first }).expect(200);
    const second = refreshed.body.refreshToken as string;
    expect(second).not.toEqual(first);

    // Réutiliser l'ancien jeton = vol probable → refusé, et toutes les sessions sont coupées.
    await http.post("/api/auth/refresh").send({ refreshToken: first }).expect(401);
    await http.post("/api/auth/refresh").send({ refreshToken: second }).expect(401);
  });

  it("déconnexion : le refresh token n'est plus utilisable", async () => {
    const login = await http.post("/api/auth/login").send(ADMIN).expect(200);
    await http
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);
    await http.post("/api/auth/refresh").send({ refreshToken: login.body.refreshToken }).expect(401);
  });

  it("bloque le brute-force sur /auth/login (429 après 5 essais)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await http.post("/api/auth/login").send({ email: "x@exemple.fr", password: "Mauvais123456" });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
