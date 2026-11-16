/**
 * Parcours gouvernance contre une vraie base PostgreSQL :
 * contrôles ISO 27001, obligations RGPD / NIS2, décision, brouillon, envoi, retard, registre.
 */
import { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { ADMIN, startApp } from "./helpers";

const run = Date.now();
const people = {
  analyst: { email: `gov-soc-${run}@exemple.fr`, fullName: "Gael Analyste", password: "AnalysteSOC2026", role: "ANALYST" },
  dpo: { email: `gov-dpo-${run}@exemple.fr`, fullName: "Dana DPO", password: "DeleguePD2026x", role: "DPO" },
  ciso: { email: `gov-rssi-${run}@exemple.fr`, fullName: "Remi RSSI", password: "ResponsableSSI2026", role: "CISO" },
};

describe("Gouvernance (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const token: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const auth = (who: string) => ({ Authorization: `Bearer ${token[who]}` });

  beforeAll(async () => {
    ({ app, http } = await startApp());
    token.admin = (await http.post("/api/auth/login").send(ADMIN).expect(200)).body.accessToken;
    for (const [who, p] of Object.entries(people)) {
      ids[who] = (await http.post("/api/users").set(auth("admin")).send(p).expect(201)).body.id;
      token[who] = (await http.post("/api/auth/login").send({ email: p.email, password: p.password }).expect(200)).body
        .accessToken;
    }
    ids.incident = (
      await http
        .post("/api/incidents")
        .set(auth("analyst"))
        .send({ title: "Export clients envoyé au mauvais destinataire", severity: "HIGH" })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  describe("contrôles ISO 27001", () => {
    it("liste le référentiel", async () => {
      const res = await http.get("/api/controls").set(auth("analyst")).expect(200);
      const codes = res.body.map((c: { code: string }) => c.code);
      expect(codes).toEqual(expect.arrayContaining(["5.24", "5.26", "5.34", "8.12", "8.15"]));
      ids.c812 = res.body.find((c: { code: string }) => c.code === "8.12").id;
      ids.c534 = res.body.find((c: { code: string }) => c.code === "5.34").id;
    });

    it("l'analyste rattache des contrôles à l'incident, visibles dans le détail", async () => {
      await http
        .put(`/api/incidents/${ids.incident}/controls`)
        .set(auth("analyst"))
        .send({ controlIds: [ids.c812, ids.c534] })
        .expect(200);
      const detail = await http.get(`/api/incidents/${ids.incident}`).set(auth("analyst")).expect(200);
      expect(detail.body.controls.map((c: { code: string }) => c.code)).toEqual(["5.34", "8.12"]);
    });

    it("refuse un contrôle inconnu ; seul l'admin enrichit le référentiel", async () => {
      await http
        .put(`/api/incidents/${ids.incident}/controls`)
        .set(auth("analyst"))
        .send({ controlIds: ["00000000-0000-4000-8000-000000000000"] })
        .expect(400);
      await http.post("/api/controls").set(auth("analyst")).send({ framework: "ISO27001:2022", code: "8.9", title: "Configuration" }).expect(403);
      await http.post("/api/controls").set(auth("admin")).send({ framework: "ISO27001:2022", code: `T${run % 1e6}`, title: "Contrôle de test" }).expect(201);
    });
  });

  describe("RGPD : notification CNIL sous 72 h", () => {
    it("aucune obligation tant que l'incident ne touche pas de données personnelles", async () => {
      const res = await http.get(`/api/incidents/${ids.incident}/obligations`).set(auth("ciso")).expect(200);
      expect(res.body).toEqual([]);
    });

    it("cocher « données personnelles » démarre le compte à rebours de 72 h", async () => {
      await http.patch(`/api/incidents/${ids.incident}`).set(auth("analyst")).send({ personalData: true }).expect(200);
      const res = await http.get(`/api/incidents/${ids.incident}/obligations`).set(auth("dpo")).expect(200);
      expect(res.body).toHaveLength(1);
      const o = res.body[0];
      expect(o).toMatchObject({ kind: "GDPR_NOTIFICATION", authority: "CNIL", status: "PENDING", canHandle: true });
      const hours = (new Date(o.dueAt).getTime() - new Date(o.awareAt).getTime()) / 3600_000;
      expect(hours).toBe(72);
      expect(o.remainingSeconds).toBeGreaterThan(71 * 3600);
    });

    it("l'échéance apparaît dans les comptes à rebours du DPO", async () => {
      const res = await http.get("/api/obligations/upcoming").set(auth("dpo")).expect(200);
      const mine = res.body.find((o: { incident: { id: string } }) => o.incident.id === ids.incident);
      expect(mine.incident.ref).toMatch(/^INC-/);
    });

    it("l'analyste ne peut ni décider ni voir les comptes à rebours globaux", async () => {
      await http
        .post(`/api/incidents/${ids.incident}/obligations/GDPR_NOTIFICATION/decision`)
        .set(auth("analyst"))
        .send({ decision: "NOTIFY" })
        .expect(403);
      await http.get("/api/obligations/upcoming").set(auth("analyst")).expect(403);
    });

    it("« non requise » exige une justification (registre des violations)", async () => {
      await http
        .post(`/api/incidents/${ids.incident}/obligations/GDPR_NOTIFICATION/decision`)
        .set(auth("dpo"))
        .send({ decision: "NOT_REQUIRED" })
        .expect(400);
    });

    it("le brouillon CNIL est prérempli", async () => {
      const res = await http
        .get(`/api/incidents/${ids.incident}/obligations/GDPR_NOTIFICATION/draft`)
        .set(auth("dpo"))
        .expect(200);
      expect(res.body.text).toContain("RGPD, art. 33");
      expect(res.body.text).toContain("8.12 (Prévention des fuites de données)");
      expect(res.body.text).toMatch(/Délégué à la protection des données : .+ — .+@exemple\.fr/);
    });

    it("le DPO décide de notifier puis déclare l'envoi avec le n° CNIL", async () => {
      await http
        .post(`/api/incidents/${ids.incident}/obligations/GDPR_NOTIFICATION/decision`)
        .set(auth("dpo"))
        .send({ decision: "NOTIFY" })
        .expect(201);
      const res = await http
        .post(`/api/incidents/${ids.incident}/obligations/GDPR_NOTIFICATION/submission`)
        .set(auth("dpo"))
        .send({ reference: "CNIL-2026-12345" })
        .expect(201);
      expect(res.body[0]).toMatchObject({ status: "SUBMITTED", reference: "CNIL-2026-12345", remainingSeconds: null });
      // Pas de double envoi.
      await http
        .post(`/api/incidents/${ids.incident}/obligations/GDPR_NOTIFICATION/submission`)
        .set(auth("dpo"))
        .send({})
        .expect(400);
    });

    it("un envoi en retard exige le motif du retard", async () => {
      const late = (
        await http
          .post("/api/incidents")
          .set(auth("analyst"))
          .send({ title: "Ransomware sur le serveur RH", severity: "CRITICAL", personalData: true })
          .expect(201)
      ).body.id;
      // On simule une prise de connaissance il y a 4 jours.
      await pool.query("update obligations set aware_at = now() - interval '4 days' where incident_id = $1", [late]);
      const before = await http.get(`/api/incidents/${late}/obligations`).set(auth("ciso")).expect(200);
      expect(before.body[0].status).toBe("OVERDUE");
      await http.post(`/api/incidents/${late}/obligations/GDPR_NOTIFICATION/submission`).set(auth("ciso")).send({}).expect(400);
      const after = await http
        .post(`/api/incidents/${late}/obligations/GDPR_NOTIFICATION/submission`)
        .set(auth("ciso"))
        .send({ delayReason: "Analyse forensique nécessaire pour identifier les données touchées." })
        .expect(201);
      expect(after.body[0].status).toBe("SUBMITTED_LATE");
    });

    it("décocher « données personnelles » retire une obligation pas encore traitée", async () => {
      const tmp = (
        await http.post("/api/incidents").set(auth("analyst")).send({ title: "Faux positif", severity: "LOW", personalData: true }).expect(201)
      ).body.id;
      await http.patch(`/api/incidents/${tmp}`).set(auth("analyst")).send({ personalData: false }).expect(200);
      const res = await http.get(`/api/incidents/${tmp}/obligations`).set(auth("ciso")).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("NIS2 : 24 h / 72 h / 1 mois", () => {
    it("un incident NIS2 important crée les trois échéances, que le DPO ne voit pas", async () => {
      await http.patch(`/api/incidents/${ids.incident}`).set(auth("ciso")).send({ nis2Significant: true }).expect(200);
      const ciso = await http.get(`/api/incidents/${ids.incident}/obligations`).set(auth("ciso")).expect(200);
      const kinds = ciso.body.map((o: { kind: string }) => o.kind);
      expect(kinds).toEqual(expect.arrayContaining(["NIS2_EARLY_WARNING", "NIS2_NOTIFICATION", "NIS2_FINAL_REPORT"]));
      const early = ciso.body.find((o: { kind: string }) => o.kind === "NIS2_EARLY_WARNING");
      expect((new Date(early.dueAt).getTime() - new Date(early.awareAt).getTime()) / 3600_000).toBe(24);
      const dpo = await http.get(`/api/incidents/${ids.incident}/obligations`).set(auth("dpo")).expect(200);
      expect(dpo.body.every((o: { kind: string }) => o.kind === "GDPR_NOTIFICATION")).toBe(true);
    });

    it("le DPO ne peut pas traiter une obligation NIS2", async () => {
      await http
        .post(`/api/incidents/${ids.incident}/obligations/NIS2_EARLY_WARNING/submission`)
        .set(auth("dpo"))
        .send({})
        .expect(403);
    });

    it("le rapport final n'est possible qu'après la notification, et son échéance suit l'envoi", async () => {
      await http
        .post(`/api/incidents/${ids.incident}/obligations/NIS2_FINAL_REPORT/submission`)
        .set(auth("ciso"))
        .send({})
        .expect(400);
      await http.post(`/api/incidents/${ids.incident}/obligations/NIS2_EARLY_WARNING/submission`).set(auth("ciso")).send({}).expect(201);
      const res = await http
        .post(`/api/incidents/${ids.incident}/obligations/NIS2_NOTIFICATION/submission`)
        .set(auth("ciso"))
        .send({ reference: "CSIRT-42" })
        .expect(201);
      const notif = res.body.find((o: { kind: string }) => o.kind === "NIS2_NOTIFICATION");
      const final = res.body.find((o: { kind: string }) => o.kind === "NIS2_FINAL_REPORT");
      const expected = new Date(notif.submittedAt);
      expected.setUTCMonth(expected.getUTCMonth() + 1);
      expect(new Date(final.dueAt).toISOString()).toBe(expected.toISOString());
    });

    it("une obligation NIS2 ne peut pas être jugée « non requise »", async () => {
      await http
        .post(`/api/incidents/${ids.incident}/obligations/NIS2_FINAL_REPORT/decision`)
        .set(auth("ciso"))
        .send({ decision: "NOT_REQUIRED", justification: "test" })
        .expect(400);
    });

    it("la chronologie trace les décisions et les envois", async () => {
      const res = await http.get(`/api/incidents/${ids.incident}`).set(auth("ciso")).expect(200);
      const types = res.body.timeline.map((e: { type: string }) => e.type);
      expect(types).toEqual(
        expect.arrayContaining(["CONTROLS_UPDATED", "PERSONAL_DATA_CHANGED", "NIS2_CHANGED", "OBLIGATION_DECIDED", "OBLIGATION_SUBMITTED"]),
      );
    });
  });

  describe("registre des incidents", () => {
    it("export JSON pour le RSSI, avec contrôles et suivi RGPD", async () => {
      const res = await http.get("/api/register").set(auth("ciso")).expect(200);
      const row = res.body.find((r: { id: string }) => r.id === ids.incident);
      expect(row).toMatchObject({ personalData: true, nis2Significant: true, controls: ["5.34", "8.12"] });
      expect(row.gdpr).toMatchObject({ decision: "NOTIFY", reference: "CNIL-2026-12345", status: "SUBMITTED" });
    });

    it("export CSV téléchargeable, protégé contre l'injection de formules", async () => {
      await http
        .post("/api/incidents")
        .set(auth("analyst"))
        .send({ title: "=HYPERLINK(\"http://evil.example\",\"clic\")", severity: "LOW", personalData: true })
        .expect(201);
      const res = await http.get("/api/register?format=csv").set(auth("ciso")).expect(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.text).toContain("Référence;Titre");
      expect(res.text).toContain("'=HYPERLINK");
      expect(res.text).not.toMatch(/;=HYPERLINK/);
    });

    it("le DPO ne voit que les incidents avec données personnelles ; l'analyste n'y a pas accès", async () => {
      const res = await http.get("/api/register").set(auth("dpo")).expect(200);
      expect(res.body.every((r: { personalData: boolean }) => r.personalData)).toBe(true);
      await http.get("/api/register").set(auth("analyst")).expect(403);
    });
  });
});
