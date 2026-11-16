# Application web Vigie

Interface de l'équipe sécurité : analystes SOC, RSSI, DPO et administrateurs.

## Lancer en local

L'API doit tourner (voir [apps/api/README.md](../api/README.md)), puis, depuis la racine du dépôt :

```bash
npm install
npm run dev -w @vigie/api     # terminal 1 : API sur http://localhost:3000
npm run dev -w @vigie/web     # terminal 2 : web sur http://localhost:5173
```

Vite redirige `/api` vers l'API : le navigateur ne parle qu'à une seule origine, ce qui permet au cookie de session d'être `SameSite=Strict`.

## Écrans

| Écran | Pour qui | Ce qu'on y fait |
|---|---|---|
| Tableau de bord | tous | Bandeau « quart en cours » avec les comptes à rebours CNIL / ANSSI de la semaine, MTTA, MTTR, alertes à trier, taux de notifications dans les délais, contrôles ISO les plus touchés |
| Incidents | tous (DPO : données personnelles seulement) | Liste filtrable, déclaration d'un incident |
| Fiche incident | tous | Changer le statut (note obligatoire pour résoudre ou clore), assigner, cocher RGPD / NIS2, rattacher des contrôles ISO 27001, chronologie et notes, notifications aux autorités (brouillon, décision, déclaration d'envoi) |
| Alertes à trier | analyste, RSSI, admin | Regrouper des alertes dans un nouvel incident ou les rattacher à un incident existant |
| Échéances légales | tous | Toutes les notifications en cours, de la plus urgente à la moins urgente |
| Registre | RSSI, DPO, admin | Registre des incidents et des violations de données, export CSV |
| Comptes | admin | Créer un compte et choisir son rôle |

## Sécurité côté navigateur

- **Access token en mémoire seulement** (jamais dans `localStorage` ou `sessionStorage`) : une faille XSS ne permet pas de le voler pour plus tard.
- **Refresh token dans un cookie `HttpOnly`** posé par l'API : JavaScript ne peut pas le lire. À l'ouverture de l'appli, la session est reprise par ce cookie sans redemander le mot de passe.
- **Rafraîchissement automatique** : après une réponse 401, le client demande un nouveau jeton une seule fois puis rejoue la requête ; en cas d'échec, retour à l'écran de connexion.
- **Aucune ressource externe** : la police (Atkinson Hyperlegible, conçue pour la lisibilité) est servie par l'appli elle-même, pas par Google Fonts, pour ne pas transmettre l'adresse IP des utilisateurs à un tiers (RGPD).
- Les droits sont vérifiés par l'API ; l'interface masque seulement ce que le rôle ne peut pas faire.

## Tests

```bash
npm test -w @vigie/web    # Vitest : formats, compte à rebours, client API (rafraîchissement, perte de session)
npm run lint -w @vigie/web
npm run build -w @vigie/web
```
