/**
 * Parcours SOC complet contre une vraie base PostgreSQL :
 * réception d'alertes (webhook), ouverture/regroupement automatique d'incidents,
 * traitement par un analyste, droits du DPO, chronologie.
 */
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ADMIN, startApp } from "./helpers";

const KEY = process.env.ALERTS_WEBHOOK_API_KEY!;
const run = Date.now();
const people = {
  analyst: { email: `soc-${run}@exemple.fr`, fullName: "Sam Analyste", password: "AnalysteSOC2026", role: "ANALYST" },
  dpo: { email: `dpo-${run}@exemple.fr`, fullName: "Dana DPO", password: "DeleguePD2026x", role: "DPO" },
  ciso: { email: `rssi-${run}@exemple.fr`, fullName: "Remi RSSI", password: "ResponsableSSI2026", role: "CISO" },
};

const wazuh = (id: string, level: number, host = `srv-${run}`) => ({
  timestamp: new Date().toISOString(),
  id: `${run}.${id}`,
  rule: { level, description: "Multiple authentication failures", id: `57${level}` },
  agent: { id: "001", name: host },
});

describe("Incidents (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe("webhook d'alertes", () => {
    it("refuse une requête sans clé ou avec une mauvaise clé", async () => {
      await http.post("/api/alerts").send(wazuh("k0", 12)).expect(401);
      await http.post("/api/alerts").set("X-API-Key", "mauvaise-cle").send(wazuh("k0", 12)).expect(401);
    });

    it("n'accepte pas un jeton utilisateur à la place de la clé", async () => {
      await http.post("/api/alerts").set(auth("admin")).send(wazuh("k0", 12)).expect(401);
    });

    it("une alerte MEDIUM va dans la file d'attente, sans incident", async () => {
      const res = await http.post("/api/alerts").set("X-API-Key", KEY).send(wazuh("m1", 8)).expect(202);
      expect(res.body).toMatchObject({ duplicate: false, incidentId: null });
      ids.mediumAlert = res.body.alertId;
      const queue = await http.get("/api/alerts/untriaged").set(auth("analyst")).expect(200);
      expect(queue.body.map((a: { id: string }) => a.id)).toContain(ids.mediumAlert);
    });

    it("le DPO n'a pas accès à la file d'alertes", async () => {
      await http.get("/api/alerts/untriaged").set(auth("dpo")).expect(403);
    });

    it("une alerte HIGH ouvre automatiquement un incident", async () => {
      const res = await http.post("/api/alerts").set("X-API-Key", KEY).send(wazuh("h1", 12)).expect(202);
      expect(res.body.incidentRef).toMatch(/^INC-\d{4,}$/);
      expect(res.body.groupedIntoExistingIncident).toBe(false);
      ids.autoIncident = res.body.incidentId;
    });

    it("la même alerte renvoyée deux fois n'est enregistrée qu'une fois", async () => {
      const res = await http.post("/api/alerts").set("X-API-Key", KEY).send(wazuh("h1", 12)).expect(202);
      expect(res.body).toMatchObject({ duplicate: true, incidentId: ids.autoIncident });
    });

    it("une alerte semblable (même règle, même machine) est regroupée dans l'incident ouvert", async () => {
      const res = await http.post("/api/alerts").set("X-API-Key", KEY).send(wazuh("h2", 12)).expect(202);
      expect(res.body).toMatchObject({ incidentId: ids.autoIncident, groupedIntoExistingIncident: true });
    });
  });

  describe("traitement d'un incident", () => {
    it("l'analyste prend l'incident et le passe en analyse", async () => {
      const res = await http
        .patch(`/api/incidents/${ids.autoIncident}`)
        .set(auth("analyst"))
        .send({ assigneeId: ids.analyst, status: "IN_PROGRESS" })
        .expect(200);
      expect(res.body).toMatchObject({ status: "IN_PROGRESS", assigneeName: "Sam Analyste" });
      expect(res.body.allowedTransitions).toEqual(["CONTAINED", "RESOLVED"]);
    });

    it("refuse une transition invalide", async () => {
      const res = await http
        .patch(`/api/incidents/${ids.autoIncident}`)
        .set(auth("analyst"))
        .send({ status: "NEW" })
        .expect(400);
      expect(res.body.message).toContain("Transition impossible");
    });

    it("refuse d'assigner l'incident au DPO", async () => {
      await http.patch(`/api/incidents/${ids.autoIncident}`).set(auth("analyst")).send({ assigneeId: ids.dpo }).expect(400);
    });

    it("exige une note pour résoudre", async () => {
      await http.patch(`/api/incidents/${ids.autoIncident}`).set(auth("analyst")).send({ status: "RESOLVED" }).expect(400);
    });

    it("rattache l'alerte MEDIUM à l'incident, commente, résout puis clôt", async () => {
      await http
        .post(`/api/incidents/${ids.autoIncident}/alerts`)
        .set(auth("analyst"))
        .send({ alertIds: [ids.mediumAlert] })
        .expect(201);
      // Une alerte ne peut pas être rattachée deux fois.
      await http
        .post(`/api/incidents/${ids.autoIncident}/alerts`)
        .set(auth("analyst"))
        .send({ alertIds: [ids.mediumAlert] })
        .expect(400);
      await http
        .post(`/api/incidents/${ids.autoIncident}/comments`)
        .set(auth("analyst"))
        .send({ text: "IP source bloquée sur le pare-feu." })
        .expect(201);
      await http
        .patch(`/api/incidents/${ids.autoIncident}`)
        .set(auth("analyst"))
        .send({ status: "RESOLVED", note: "Brute-force SSH bloqué, mots de passe vérifiés." })
        .expect(200);
      const closed = await http
        .patch(`/api/incidents/${ids.autoIncident}`)
        .set(auth("analyst"))
        .send({ status: "CLOSED", note: "Aucun accès réussi constaté." })
        .expect(200);
      expect(closed.body.closedAt).not.toBeNull();
    });

    it("un analyste ne peut pas rouvrir un incident clos, le RSSI oui", async () => {
      await http
        .patch(`/api/incidents/${ids.autoIncident}`)
        .set(auth("analyst"))
        .send({ status: "IN_PROGRESS" })
        .expect(400);
      const reopened = await http
        .patch(`/api/incidents/${ids.autoIncident}`)
        .set(auth("ciso"))
        .send({ status: "IN_PROGRESS" })
        .expect(200);
      expect(reopened.body.closedAt).toBeNull();
    });

    it("la chronologie retrace tout, dans l'ordre", async () => {
      const res = await http.get(`/api/incidents/${ids.autoIncident}`).set(auth("ciso")).expect(200);
      const types = res.body.timeline.map((e: { type: string }) => e.type);
      expect(types[0]).toBe("CREATED");
      expect(types).toEqual(expect.arrayContaining(["ALERT_LINKED", "ASSIGNED", "STATUS_CHANGED", "COMMENT"]));
      expect(res.body.timeline[0].actorName).toBe("Système");
      expect(res.body.alerts).toHaveLength(3);
    });
  });

  describe("droits du DPO (moindre privilège)", () => {
    it("le DPO ne voit pas un incident sans données personnelles (404, pas 403)", async () => {
      await http.get(`/api/incidents/${ids.autoIncident}`).set(auth("dpo")).expect(404);
      const list = await http.get("/api/incidents").set(auth("dpo")).expect(200);
      expect(list.body.every((i: { personalData: boolean }) => i.personalData)).toBe(true);
    });

    it("dès qu'un incident touche des données personnelles, le DPO le voit et peut commenter", async () => {
      const created = await http
        .post("/api/incidents")
        .set(auth("analyst"))
        .send({ title: "Fuite d'un export clients", severity: "HIGH", personalData: true })
        .expect(201);
      await http.get(`/api/incidents/${created.body.id}`).set(auth("dpo")).expect(200);
      await http
        .post(`/api/incidents/${created.body.id}/comments`)
        .set(auth("dpo"))
        .send({ text: "Analyse d'impact RGPD en cours." })
        .expect(201);
      // Mais il ne peut pas modifier l'incident.
      await http.patch(`/api/incidents/${created.body.id}`).set(auth("dpo")).send({ severity: "LOW" }).expect(403);
    });

    it("le DPO ne peut pas créer d'incident", async () => {
      await http.post("/api/incidents").set(auth("dpo")).send({ title: "Test", severity: "LOW" }).expect(403);
    });
  });

  it("filtre « mes incidents »", async () => {
    const res = await http.get("/api/incidents?assigneeId=me").set(auth("analyst")).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((i: { assigneeId: string }) => i.assigneeId === ids.analyst)).toBe(true);
  });

  it("liste les personnes assignables (sans le DPO)", async () => {
    const res = await http.get("/api/users/assignable").set(auth("analyst")).expect(200);
    const roles = new Set(res.body.map((u: { role: string }) => u.role));
    expect(roles.has("DPO")).toBe(false);
    expect(res.body[0].passwordHash).toBeUndefined();
  });
});
