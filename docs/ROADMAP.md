# Feuille de route du MVP

Ordre choisi : **web d'abord, mobile ensuite**. Durée indicative : ~12 semaines à temps partiel.
Chaque case peut devenir une *issue* GitHub.

---

## Phase 0 — Mise en place du dépôt (semaine 1)
- [ ] Créer le dépôt GitHub et pousser cette structure
- [ ] Protéger la branche `main` (PR obligatoire, CI verte obligatoire)
- [ ] Configurer les npm workspaces (monorepo)
- [ ] CI GitHub Actions : lint + tests à chaque PR
- [ ] Activer Dependabot, le secret scanning et CodeQL
- [ ] `docker-compose.yml` avec PostgreSQL
- [ ] `.env.example` documenté

**Compétence DevSecOps travaillée :** sécurité de la chaîne CI/CD dès le premier jour.

## Phase 1 — Backend et authentification (semaines 2-3)
- [ ] Initialiser l'API NestJS + Prisma
- [ ] Modèle `User` avec rôles : `ANALYST`, `CISO` (RSSI), `DPO`, `ADMIN`
- [ ] Connexion / déconnexion avec JWT (access + refresh token)
- [ ] Mots de passe hachés (argon2 ou bcrypt)
- [ ] Contrôle d'accès par rôle (guards NestJS)
- [ ] Limitation du nombre de tentatives de connexion (rate limiting)
- [ ] Journal d'audit : qui a fait quoi, quand
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
