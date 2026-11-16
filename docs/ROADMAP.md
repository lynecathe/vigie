# Feuille de route du MVP

Ordre choisi : **web d'abord, mobile ensuite**. Durée indicative : ~12 semaines à temps partiel.
Chaque case peut devenir une *issue* GitHub.

---

## Phase 0 — Mise en place du dépôt (semaine 1)
- [x] Créer le dépôt GitHub et pousser cette structure
- [ ] Protéger la branche `main` (PR obligatoire, CI verte obligatoire)
- [x] Configurer les npm workspaces (monorepo)
- [x] CI GitHub Actions : lint + tests à chaque PR (+ détection de secrets avec gitleaks)
- [x] Dependabot (mises à jour npm + GitHub Actions)
- [ ] CodeQL : workflow prêt, s'active quand le dépôt passe en public
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
- [ ] Modèles `Alert`, `Incident`, `Comment`, `TimelineEvent`
- [ ] Endpoint webhook `POST /api/alerts` protégé par clé d'API
- [ ] Connecteur Wazuh (alertes au format JSON)
- [ ] Regrouper plusieurs alertes dans un incident
- [ ] Cycle de vie : nouveau → en analyse → contenu → résolu → clos
- [ ] Sévérité (faible / moyenne / élevée / critique) et assignation
- [ ] Web : liste filtrable + page de détail d'un incident avec sa chronologie

## Phase 3 — Gouvernance et conformité (semaines 6-7)
- [ ] Référentiel de contrôles ISO 27001:2022 (numéros + résumés rédigés par toi)
- [ ] Rattacher un incident à un ou plusieurs contrôles
- [ ] Case « données personnelles concernées » → compte à rebours de 72 h pour la notification CNIL (art. 33 RGPD)
- [ ] Case « entité NIS2 » → échéances : alerte précoce 24 h, notification 72 h, rapport final 1 mois
- [ ] Brouillon de notification prérempli à partir de l'incident
- [ ] Registre des incidents exportable (CSV / PDF)

## Phase 4 — Tableaux de bord et rapports (semaine 8)
- [ ] Indicateurs : MTTA (délai de prise en charge), MTTR (délai de résolution)
- [ ] Incidents par sévérité et par statut dans le temps
- [ ] Contrôles ISO les plus touchés
- [ ] Délais de notification respectés / dépassés
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
