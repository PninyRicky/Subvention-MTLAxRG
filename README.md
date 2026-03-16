# MTLA Subventions

Back-office interne MTLA pour detecter, verifier et classer les subventions selon deux profils:

- `OBNL - Essence de Marque`
- `MTLA - Production vidéo`

L’app est construite avec `Next.js`, `TypeScript`, `Tailwind`, `Prisma`, `PostgreSQL` et `next-auth`.

## Ce que la V1 fait

- dashboard noir sur blanc style MTLA
- catalogue de programmes avec filtres et detail
- profils de matching modifiables
- scans manuels depuis l’interface
- scheduler Vercel lundi, mercredi et vendredi, une fois par jour
- verification stricte: un programme n’est `OPEN` que si la source officielle le confirme

## Variables d’environnement

Copier `.env.example` vers `.env.local` puis remplir:

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
APP_PASSWORD="MTLAxRG"
RESEND_API_KEY=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="noreply@mtla.productions"
CRON_SECRET="..."
DEV_AUTH_BYPASS="false"
```

Notes:

- `DATABASE_URL` est requis pour utiliser Prisma en runtime.
- `APP_PASSWORD` protege l’acces a l’app avec un mot de passe partage.
- `RESEND_API_KEY` et `SMTP_*` ne sont plus requis si tu utilises seulement le mot de passe partage.
- `DEV_AUTH_BYPASS=true` permet d’ouvrir l’app sans session pour du dev local.

## Installation

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run db:generate
npm run db:push
npm run db:seed
```

## Auth

- acces protege par un mot de passe partage
- le mot de passe est defini via `APP_PASSWORD`
- aucune connexion email n’est requise pour la V1

## Cron Vercel

Le cron est defini dans `vercel.json` avec une seule execution les lundis, mercredis et vendredis pour rester compatible avec le plan Hobby de Vercel. Sur Hobby, les cron jobs sont limites a une execution par jour et peuvent partir a n’importe quel moment dans l’heure planifiee. En pratique, le scan automatique se fera environ a `06:00` ou `07:00` Toronto selon la saison.

## Limites actuelles

- les parseurs de sources sont heuristiques et extensibles, pas encore source-par-source
- les donnees par defaut servent de bootstrap et de filet de secours
- les tests E2E demandent l’installation des navigateurs Playwright via `npx playwright install`
