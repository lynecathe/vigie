# Vigie — Plateforme SOC & Gouvernance

> Application **web + mobile** qui relie la **détection d'incidents (SOC)** et la **conformité (GRC)** : chaque incident de sécurité est qualifié, suivi, rattaché aux exigences ISO 27001 / RGPD / NIS2 concernées, et déclenche automatiquement les délais de notification réglementaires.

## Le problème

Dans beaucoup d'organisations (PME, entités soumises à NIS2), le SOC et la gouvernance travaillent dans des outils séparés :
- le SOC voit des alertes techniques, sans savoir quelles obligations réglementaires elles déclenchent ;
- le RSSI / DPO découvre les incidents tard et reconstruit le registre à la main ;
- les délais légaux (72 h CNIL, 24 h / 72 h NIS2) sont suivis sur Excel… ou pas du tout.

## La solution

| | Web (ordinateur) | Mobile (iOS / Android) |
|---|---|---|
| **Pour qui** | Analyste SOC, RSSI, DPO, admin | Analyste d'astreinte, RSSI, DPO |
| **Usage** | Analyse, tableaux de bord, rapports, conformité | Alertes push, prise en charge, validation rapide |

### Fonctionnalités du MVP
- Réception des alertes (webhook, ex. Wazuh) et regroupement en incidents
- Cycle de vie d'un incident : nouveau → en analyse → contenu → résolu → clos
- Sévérité, assignation, chronologie, commentaires
- Rattachement d'un incident aux contrôles ISO 27001 et obligations RGPD / NIS2
- Compte à rebours des délais de notification + brouillon de déclaration
- Registre des incidents exportable (preuve d'audit)
- Tableau de bord : MTTA, MTTR, incidents par sévérité, état de conformité
- Journal d'audit de toutes les actions utilisateurs

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Web | React + Vite + TypeScript | Expérience React existante |
| Mobile | React Native (Expo) + TypeScript | Réutilisation du code et des compétences React |
| API | NestJS (Node.js, TypeScript) | Même langage partout, structure claire, guards pour les rôles |
| Base de données | PostgreSQL + Prisma | Relationnel, migrations versionnées |
| Auth | JWT + rôles (RBAC), MFA TOTP | Analyste / RSSI / DPO / Admin |
| Infra locale | Docker Compose | Lancement en une commande |
| CI/CD | GitHub Actions | Lint, tests, scans de sécurité |

## Structure du dépôt (monorepo)

```
vigie/
├── apps/
│   ├── api/        # Backend NestJS (REST + webhooks)
│   ├── web/        # Application web React
│   └── mobile/     # Application mobile Expo
├── packages/
│   └── shared/     # Types, constantes et validations partagés
├── docs/
│   └── ROADMAP.md  # Feuille de route du MVP
├── .github/
│   └── workflows/  # CI GitHub Actions
├── SECURITY.md
└── README.md
```

## Démarrage

*(à compléter au fil du développement — voir [docs/ROADMAP.md](docs/ROADMAP.md))*

## Conventions Git

- `main` est protégée : on n'y pousse jamais directement, tout passe par une Pull Request.
- Une branche par fonctionnalité : `feat/auth-jwt`, `fix/incident-status`, `docs/readme`…
- Messages de commit au format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `feat: ajout du compte à rebours CNIL`.
- Aucun secret dans le code : variables dans `.env` (ignoré par Git), modèle dans `.env.example`.

## Auteure

Catherine Ngango — étudiante ingénieure en cybersécurité (ECE Paris)
