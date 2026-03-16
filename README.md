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
- scheduler Vercel lundi, mercredi et vendredi a 06:00 Toronto
- verification stricte: un programme n’est `OPEN` que si la source officielle le confirme

## Variables d’environnement

Copier `.env.example` vers `.env.local` puis remplir:

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
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
- si SMTP n’est pas configure en local, le magic link est logge en console.
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

- auth interne par magic link email
- premier utilisateur cree devient `ADMIN`
- les autres utilisateurs sont `ANALYST` par defaut

## Cron Vercel

Le cron est defini dans `vercel.json` avec une double fenetre UTC pour couvrir l’heure locale Toronto en ete et en hiver. La route `/api/cron/fetch` filtre ensuite pour n’executer qu’un vrai scan a `06:00 America/Toronto`.

## Limites actuelles

- les parseurs de sources sont heuristiques et extensibles, pas encore source-par-source
- les donnees par defaut servent de bootstrap et de filet de secours
- les tests E2E demandent l’installation des navigateurs Playwright via `npx playwright install`
