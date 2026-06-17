# Git to Vercel

Ta vodic opisuje pot od lokalnega repozitorija do prvega Vercel deploya.

## 1. Pripravi lokalno okolje

Namesti Node.js 22 in pnpm. Ce imas Node, lahko pnpm vklopis prek Corepack:

```powershell
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm --version
```

Nato namesti dependencies:

```powershell
pnpm install
```

Ce se ustvari `pnpm-lock.yaml`, ga committaj. Lockfile je priporocen, ceprav Vercel install command trenutno dovoljuje deploy brez njega.

## 2. Ustvari GitHub repo

V GitHubu ustvari nov prazen repository, na primer:

```text
ai-visibility-radar
```

Ne dodajaj README, `.gitignore` ali licence v GitHub UI, ker te datoteke ze obstajajo lokalno.

## 3. Prvi commit in push

V root mapi projekta:

```powershell
git status
git add .
git commit -m "Initial AI Visibility Radar MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-visibility-radar.git
git push -u origin main
```

Ce remote ze obstaja:

```powershell
git remote -v
git remote set-url origin https://github.com/YOUR_USERNAME/ai-visibility-radar.git
git push -u origin main
```

Ne commitaj `.env`, `.env.local` ali skrivnosti. Committaj samo `.env.example` in `.env.vercel.example`.

## 4. Pripravi produkcijsko bazo

Ustvari hosted PostgreSQL bazo. Najbolj enostavne opcije:

- Vercel Postgres
- Neon
- Supabase
- Railway Postgres

Kopiraj `DATABASE_URL`.

Za prvi produkcijski deploy mora obstajati Prisma migration. Ustvari jo z dev bazo ali lokalno PostgreSQL bazo:

```powershell
$env:DATABASE_URL="postgresql://..."
pnpm db:migrate:init
```

To ustvari mapo:

```text
packages/db/prisma/migrations
```

Committaj migracije:

```powershell
git add packages/db/prisma/migrations package.json
git commit -m "Add initial Prisma migration"
git push
```

Nato na produkcijski bazi zazeni deploy migracij:

```powershell
$env:DATABASE_URL="postgresql://PRODUCTION_DATABASE_URL"
pnpm db:deploy
```

Vercel build generira Prisma Client, ne izvaja pa migracij samodejno.

## 5. Import v Vercel

V Vercel:

1. Izberi `Add New...` -> `Project`.
2. Importaj GitHub repo `ai-visibility-radar`.
3. Root Directory pusti na repository root.
4. Framework Preset naj bo `Next.js`.
5. Nastavitve naj pridejo iz `vercel.json`:

```text
Install Command: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --legacy-peer-deps
Build Command: npm run vercel:build
Output Directory: apps/web/.next
Node.js Version: 22.x
```

## 6. Nastavi Vercel environment variables

V Vercel Project Settings -> Environment Variables dodaj vrednosti iz:

```text
.env.vercel.example
```

Za prvi deploy lahko pustis:

```bash
PARSER_PROVIDER=mock
PARSER_MODEL=mock-parser
```

Za Production nastavi:

```bash
DATABASE_URL=
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

Za Preview lahko `NEXT_PUBLIC_APP_URL` izpustis, ker aplikacija uporabi Vercel `VERCEL_URL`.

## 7. Prvi deploy

Ko so env vars nastavljene:

1. Klikni `Deploy`.
2. Po deployu odpri Vercel URL.
3. Preveri strani:

```text
/
/ai-visibility-checker
/app/dashboard
/pricing
```

Free audit z mock providerjem bi moral delovati tudi brez Redis workerja.

## 8. Deploy po spremembah

Vsaka sprememba na `main` branchu sprozi nov Production deploy:

```powershell
git add .
git commit -m "Describe change"
git push
```

Ce uporabljas feature branche, Vercel ustvari Preview deploy za vsak branch ali pull request.

## 9. Worker pozneje

Vercel ni primeren za stalni BullMQ worker. Ko bos dodal live provider scans:

1. Ustvari Redis instanco.
2. Nastavi `REDIS_URL` v Vercel in worker hostu.
3. Worker host naj poganja:

```bash
pnpm install
pnpm db:generate
npm --workspace @ai-radar/worker run start
```

Primer worker hostov: Railway, Render, Fly.io, VPS ali container platform.
