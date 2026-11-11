# API Vigie

API REST de Vigie : NestJS, PostgreSQL (via Drizzle ORM), authentification JWT et contrôle d'accès par rôle.

## Lancer en local

Depuis la racine du dépôt :

```bash
cp .env.example .env          # puis remplis JWT_ACCESS_SECRET et les mots de passe
docker compose up -d          # démarre PostgreSQL
npm install
npm run db:migrate -w @vigie/api   # crée les tables
npm run db:seed -w @vigie/api      # crée le premier administrateur
npm run dev -w @vigie/api          # API sur http://localhost:3000/api
```

## Routes

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/health` | public | Vérifier que l'API répond |
| POST | `/api/auth/login` | public (5 essais/min) | Connexion → access token + refresh token |
| POST | `/api/auth/refresh` | public | Nouveau couple de jetons (rotation) |
| POST | `/api/auth/logout` | connecté | Révoque le refresh token |
| GET | `/api/auth/me` | connecté | Profil de l'utilisateur connecté |
| GET | `/api/users` | ADMIN | Liste des comptes |
| POST | `/api/users` | ADMIN | Créer un compte (ANALYST, CISO, DPO, ADMIN) |

## Choix de sécurité

- **Refus par défaut** : toutes les routes exigent un jeton, sauf celles marquées `@Public()`.
- **Mots de passe** : hachés avec scrypt (sel aléatoire, comparaison en temps constant), 12 caractères minimum.
- **Access token** court (15 min) ; **refresh token** stocké uniquement sous forme d'empreinte SHA-256, renouvelé à chaque usage. Réutiliser un ancien refresh token coupe toutes les sessions de l'utilisateur.
- **Anti brute-force** : 5 tentatives de connexion par minute et par IP ; message d'erreur générique ; temps de réponse identique que l'e-mail existe ou non.
- **Validation stricte** des entrées : tout champ non prévu est refusé (protection contre le mass assignment).
- **En-têtes HTTP de sécurité** (Helmet) et CORS limité aux origines configurées.
- **Journal d'audit** en base et en logs JSON (collectables par un SIEM) : connexions, échecs, déconnexions, réutilisation de jeton, création de comptes.
- **Configuration validée au démarrage** : l'API refuse de démarrer si un secret manque ou est trop court.

## Tests

```bash
npm test -w @vigie/api        # tests unitaires (lancés par la CI)
npm run test:e2e -w @vigie/api   # parcours complet, nécessite PostgreSQL + db:migrate + db:seed
```
