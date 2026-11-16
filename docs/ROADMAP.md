# Feuille de route du MVP

Ordre choisi : **web d'abord, mobile ensuite**. Durée indicative : ~12 semaines à temps partiel.
Chaque case peut devenir une *issue* GitHub.

---

## Phase 0 — Mise en place du dépôt (semaine 1)
- [x] Créer le dépôt GitHub et pousser cette structure
- [x] Protéger la branche `main` (PR obligatoire, CI verte obligatoire)
- [x] Configurer les npm workspaces (monorepo)
- [x] CI GitHub Actions : lint + tests à chaque PR (+ détection de secrets avec gitleaks)
- [x] Dependabot (mises à jour npm + GitHub Actions)
- [x] CodeQL (analyse de code à chaque PR et chaque semaine)
- [x] `docker-compose.yml` avec PostgreSQL
- [x] `.env.example` documenté

**Compétence DevSecOps travaillée :** sécurité de la chaîne CI/CD dès le premier jour.

## Phase 1 — Backend et authentification (semaines 2-3)
- [x] Initialiser l'API NestJS + base de données (Drizzle ORM : pur TypeScript, aucun binaire natif)
- [x] Modèle `User` avec rôles : `ANALYST`, `CISO` (RSSI), `DPO`, `ADMIN`
- [x] Connexion / déconnexion avec JWT (access token court + refresh token avec rotation)
- [x] Mots de passe hachés (scrypt, sel aléatoire, comparaison en temps constant)
- [x] Contrôle d'accès par rôle (guards NestJS, refus par défaut)
- [x] Limitation du nombre de tentatives de connexion (rate limiting)
- [x] Journal d'audit : qui a fait quoi, quand
- [x] Tests unitaires (CI) + tests de bout en bout contre PostgreSQL
- [ ] *(bonus)* MFA par TOTP

## Phase 2 — Incidents, côté SOC (semaines 4-5)
- [x] Modèles `Alert`, `Incident`, chronologie (`IncidentEvent`, commentaires inclus)
- [x] Webhook `POST /api/alerts` protégé par clé d'API
- [x] Format Wazuh reconnu (niveau de règle → sévérité) + format générique
- [x] Ouverture automatique d'un incident pour les alertes HIGH/CRITICAL, regroupement des alertes semblables, dédoublonnage
- [x] Cycle de vie : nouveau → en analyse → contenu → résolu → clos (note obligatoire pour résoudre/clore)
- [x] Sévérité (faible / moyenne / élevée / critique) et assignation
- [x] Droits : le DPO ne voit que les incidents touchant des données personnelles
- [x] Web : liste filtrable + page de détail d'un incident avec sa chronologie
- [ ] Brancher un vrai Wazuh (homelab)

## Phase 3 — Gouvernance et conformité (semaines 6-7)
- [x] Référentiel de contrôles ISO 27001:2022 (18 mesures, libellés reformulés) + ajout par l'admin
- [x] Rattacher un incident à un ou plusieurs contrôles
- [x] Case « données personnelles concernées » → compte à rebours de 72 h pour la notification CNIL (art. 33 RGPD)
- [x] Case « incident NIS2 important » → échéances : alerte précoce 24 h, notification 72 h, rapport final 1 mois
- [x] Décision « notifier / non requise » (justification obligatoire), motif obligatoire en cas de retard
- [x] Brouillon de notification prérempli à partir de l'incident (CNIL + 3 étapes NIS2)
- [x] Registre des incidents exportable (JSON / CSV, protégé contre l'injection de formules)

## Phase 4 — Tableaux de bord et application web (semaine 8)
- [x] Indicateurs : MTTA (délai de prise en charge), MTTR (délai de résolution) — `GET /api/metrics`
- [x] Incidents par sévérité et par statut, incidents créés par jour
- [x] Contrôles ISO les plus touchés
- [x] Délais de notification respectés / dépassés
- [x] Application web : connexion, tableau de bord (bandeau « quart en cours » avec les comptes à rebours légaux), incidents, alertes à trier, échéances, registre, comptes
- [x] Session web sécurisée : refresh token en cookie `HttpOnly` + `SameSite=Strict`, access token en mémoire
- [ ] Rapport mensuel exportable pour la direction

## Phase 5 — Application mobile (semaines 9-11)
- [ ] Initialiser l'app Expo, partager les types via `packages/shared`
- [ ] Connexion sécurisée (tokens dans SecureStore, pas dans AsyncStorage)
- [ ] Liste « mes incidents » + détail
- [ ] Notifications push pour les incidents élevés ou critiques
- [ ] Actions rapides : prendre en charge, changer le statut, commenter
- [ ] Validation RSSI / DPO : « notifier l'autorité » oui / non
- [ ] Affichage du compte à rebours réglementaire

## Phase 6 — Durcissement et présentation (semaine 12)
- [ ] Modélisation des menaces de l'appli elle-même (STRIDE)
- [ ] Vérification avec la checklist OWASP ASVS (niveau 1)
- [ ] Scan des images Docker (Trivy) et scan dynamique (OWASP ZAP) dans la CI
- [ ] Tests : unitaires sur l'API, end-to-end sur les parcours critiques
- [ ] README final : captures d'écran, schéma d'architecture, démo
- [ ] Données de démo réalistes (incidents fictifs)

---

## Après le MVP (idées)
- Multi-organisation (plusieurs entreprises clientes)
- Corrélation automatique d'alertes
- Import de scans de vulnérabilités → registre des risques (EBIOS RM)
- Playbooks de réponse à incident
