# API Vigie

API REST de Vigie : NestJS, PostgreSQL (via Drizzle ORM), authentification JWT et contrôle d'accès par rôle.

## Lancer en local

**Le plus simple (Windows)** : lance Docker Desktop, puis depuis la racine du dépôt :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1   # .env, base, tables, compte admin
npm run dev -w @vigie/api                                          # API sur http://localhost:3000/api
```

Le script génère des secrets aléatoires et demande le mot de passe admin au clavier (il n'est jamais écrit dans un fichier).

**À la main** (toutes plateformes), depuis la racine du dépôt :

```bash
cp .env.example .env          # puis remplis JWT_ACCESS_SECRET et les mots de passe
docker compose up -d          # démarre PostgreSQL
npm install
npm run db:migrate -w @vigie/api   # crée les tables
SEED_ADMIN_PASSWORD=... npm run db:seed -w @vigie/api   # crée le premier administrateur
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
| GET | `/api/users/assignable` | ANALYST, CISO, ADMIN | Personnes à qui on peut assigner un incident |
| POST | `/api/alerts` | clé d'API (`X-API-Key`) | Webhook : reçoit une alerte (format Wazuh ou générique) |
| GET | `/api/alerts/untriaged` | ANALYST, CISO, ADMIN | File d'attente : alertes sans incident |
| GET | `/api/incidents` | ANALYST, CISO, DPO\*, ADMIN | Liste filtrable (`status`, `severity`, `assigneeId=me`, `personalData`) |
| GET | `/api/incidents/:id` | ANALYST, CISO, DPO\*, ADMIN | Détail : alertes, chronologie, transitions possibles |
| POST | `/api/incidents` | ANALYST, CISO, ADMIN | Créer un incident (avec alertes éventuelles) |
| PATCH | `/api/incidents/:id` | ANALYST, CISO, ADMIN | Statut, sévérité, assignation, données personnelles |
| POST | `/api/incidents/:id/comments` | ANALYST, CISO, DPO\*, ADMIN | Commenter |
| POST | `/api/incidents/:id/alerts` | ANALYST, CISO, ADMIN | Rattacher des alertes |

| GET | `/api/controls` | ANALYST, CISO, DPO, ADMIN | Référentiel de contrôles (ISO 27001:2022, sélection) |
| POST | `/api/controls` | ADMIN | Ajouter un contrôle au référentiel |
| PUT | `/api/incidents/:id/controls` | ANALYST, CISO, ADMIN | Rattacher des contrôles à un incident |
| GET | `/api/incidents/:id/obligations` | ANALYST, CISO, DPO\*\*, ADMIN | Obligations réglementaires et comptes à rebours |
| GET | `/api/obligations/upcoming` | CISO, DPO\*\*, ADMIN | Toutes les échéances en cours, de la plus urgente à la moins urgente |
| POST | `/api/incidents/:id/obligations/:kind/decision` | DPO (RGPD), CISO, ADMIN | Notifier / non requise (justification obligatoire) |
| GET | `/api/incidents/:id/obligations/:kind/draft` | DPO (RGPD), CISO, ADMIN | Brouillon de notification prérempli |
| POST | `/api/incidents/:id/obligations/:kind/submission` | DPO (RGPD), CISO, ADMIN | Déclarer l'envoi (n° de dossier, motif si retard) |
| GET | `/api/register?format=json\|csv` | CISO, DPO\*, ADMIN | Registre des incidents (preuve d'audit) |

\* Le DPO ne voit que les incidents qui touchent des données personnelles.
\*\* Le DPO ne voit que les obligations RGPD.

## Incidents

**Cycle de vie** : `NEW` → `IN_PROGRESS` → `CONTAINED` → `RESOLVED` → `CLOSED` (une note est obligatoire pour résoudre ou clore ; seuls le RSSI et l'admin peuvent rouvrir un incident clos).

**Alertes** : une alerte `HIGH` ou `CRITICAL` ouvre automatiquement un incident ; une alerte semblable (même source, même règle, même machine) est regroupée dans l'incident encore ouvert ; les alertes `LOW` et `MEDIUM` vont dans la file d'attente. La même alerte reçue deux fois n'est enregistrée qu'une fois. Sévérité Wazuh : niveau 0-6 → LOW, 7-10 → MEDIUM, 11-13 → HIGH, 14-15 → CRITICAL.

**Chronologie** : chaque création, changement de statut, de sévérité, assignation, rattachement d'alerte et commentaire est horodaté et attribué.

## Gouvernance

**Contrôles ISO 27001** : 18 mesures de l'annexe A utiles pour qualifier un incident (libellés reformulés — le texte de la norme est payant) ; un admin peut en ajouter.

**Obligations réglementaires**, déclenchées automatiquement par les indicateurs de l'incident :

| Indicateur | Obligation | Autorité | Échéance |
|---|---|---|---|
| `personalData` | Notification de violation (RGPD art. 33) | CNIL | 72 h après la prise de connaissance |
| `nis2Significant` | Alerte précoce (NIS2 art. 23(4)(a)) | CSIRT / ANSSI | 24 h |
| `nis2Significant` | Notification d'incident (art. 23(4)(b)) | CSIRT / ANSSI | 72 h |
| `nis2Significant` | Rapport final (art. 23(4)(d)) | CSIRT / ANSSI | 1 mois après la notification |

Le compte à rebours démarre quand l'indicateur est coché. Statuts : `PENDING`, `OVERDUE`, `SUBMITTED`, `SUBMITTED_LATE`, `NOT_REQUIRED`. Ne pas notifier la CNIL exige une justification (elle figure au registre, RGPD art. 33.5) ; un envoi en retard exige le motif du retard (art. 33.1). Les brouillons sont préremplis avec l'incident, le DPO, les mesures prises et les contrôles ; les champs inconnus sont marqués `[à compléter]`. L'envoi lui-même se fait sur le téléservice de l'autorité : Vigie trace la date et le numéro de dossier.

**Registre** : export JSON ou CSV (séparateur `;`, compatible Excel), protégé contre l'injection de formules.

Tester le webhook depuis PowerShell (la clé est dans ton `.env`) :

```powershell
$key = (Get-Content .env | Select-String '^ALERTS_WEBHOOK_API_KEY=').ToString().Split('=')[1]
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/alerts -Headers @{ 'X-API-Key' = $key } -ContentType 'application/json' -Body '{"source":"demo","externalId":"demo-1","title":"Connexion suspecte","severity":"HIGH","host":"poste-42"}'
```

## Choix de sécurité

- **Refus par défaut** : toutes les routes exigent un jeton, sauf celles marquées `@Public()`.
- **Mots de passe** : hachés avec scrypt (sel aléatoire, comparaison en temps constant), 12 caractères minimum.
- **Access token** court (15 min) ; **refresh token** stocké uniquement sous forme d'empreinte SHA-256, renouvelé à chaque usage. Réutiliser un ancien refresh token coupe toutes les sessions de l'utilisateur.
- **Anti brute-force** : 5 tentatives de connexion par minute et par IP ; message d'erreur générique ; temps de réponse identique que l'e-mail existe ou non.
- **Validation stricte** des entrées : tout champ non prévu est refusé (protection contre le mass assignment).
- **En-têtes HTTP de sécurité** (Helmet) et CORS limité aux origines configurées.
- **Journal d'audit** en base et en logs JSON (collectables par un SIEM) : connexions, échecs, déconnexions, réutilisation de jeton, création de comptes, refus du webhook, création et modification d'incidents.
- **Webhook d'alertes** protégé par une clé d'API comparée en temps constant ; le DPO reçoit une 404 (et non 403) sur les incidents qu'il ne doit pas voir, pour ne pas révéler leur existence.
- **Configuration validée au démarrage** : l'API refuse de démarrer si un secret manque ou est trop court.

## Tests

```bash
npm test -w @vigie/api        # tests unitaires (lancés par la CI)
npm run test:e2e -w @vigie/api   # parcours complet, nécessite PostgreSQL + db:migrate + db:seed
```
