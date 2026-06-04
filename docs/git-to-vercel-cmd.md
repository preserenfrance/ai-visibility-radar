# Git to Vercel - CMD

Ta vodic je za Windows Command Prompt (`cmd.exe`), ne PowerShell.

## 1. Odpri CMD v projektu

Odpri Command Prompt in pojdi v mapo projekta:

```cmd
cd "C:\Users\HP\OneDrive - seos.si\Dokumenti\AI Radar"
```

## 2. Preveri Node in pnpm

```cmd
node --version
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

Ce dobis:

```text
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
```

uporabi eno od spodnjih resitev.

### Resitev A: Corepack

V CMD zazeni:

```cmd
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

Zapri CMD, odpri nov CMD in preveri:

```cmd
pnpm --version
```

Ce `corepack enable` zahteva admin pravice, odpri CMD kot Administrator in ponovi ukaza.

### Resitev B: npm global install

Ce Corepack ne dela, namesti pnpm prek npm:

```cmd
npm install -g pnpm@9.15.0
```

Zapri CMD, odpri nov CMD in preveri:

```cmd
pnpm --version
```

Ce se se vedno ne najde, v isti CMD seji dodaj npm global folder v PATH:

```cmd
set "PATH=%APPDATA%\npm;%PATH%"
pnpm --version
```

Namesti dependencies:

```cmd
pnpm install
```

Ce se ustvari `pnpm-lock.yaml`, ga dodaj v Git.

## 3. Ustvari GitHub repository

Na GitHubu ustvari nov prazen repository, na primer:

```text
ai-visibility-radar
```

V GitHub UI ne dodajaj README, `.gitignore` ali licence, ker te datoteke ze obstajajo lokalno.

## 4. Prvi commit in push

V CMD:

```cmd
git status
git add .
git commit -m "Initial AI Visibility Radar MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-visibility-radar.git
git push -u origin main
```

Zamenjaj `YOUR_USERNAME` s svojim GitHub uporabniskim imenom.

Ce remote ze obstaja:

```cmd
git remote -v
git remote set-url origin https://github.com/YOUR_USERNAME/ai-visibility-radar.git
git push -u origin main
```

Ne commitaj `.env`, `.env.local` ali API kljucev. Committaj samo `.env.example` in `.env.vercel.example`.

## 5. Pripravi PostgreSQL bazo

Ustvari hosted PostgreSQL bazo, na primer:

- Vercel Postgres
- Neon
- Supabase
- Railway Postgres

Kopiraj `DATABASE_URL`.

## 6. Ustvari prvo Prisma migracijo

V CMD nastavis env var tako:

```cmd
set "DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
pnpm db:migrate:init
```

To ustvari:

```text
packages\db\prisma\migrations
```

Committaj migracijo:

```cmd
git add packages/db/prisma/migrations package.json packages/db/package.json
git commit -m "Add initial Prisma migration"
git push
```

## 7. Deploy migracij na produkcijsko bazo

V isti CMD seji ali novi CMD seji nastavi produkcijski `DATABASE_URL`:

```cmd
set "DATABASE_URL=postgresql://PRODUCTION_DATABASE_URL"
pnpm db:deploy
```

Vercel build generira Prisma Client, ne izvaja pa migracij samodejno.

## 8. Import v Vercel

V Vercel:

1. Klikni `Add New...`.
2. Izberi `Project`.
3. Importaj GitHub repo `ai-visibility-radar`.
4. Root Directory pusti na repository root.
5. Framework Preset naj bo `Next.js`.

Nastavitve so ze v `vercel.json`:

```text
Install Command: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --no-frozen-lockfile
Build Command: pnpm vercel:build
Output Directory: apps/web/.next
Node.js Version: 22.x
```

## 9. Vercel environment variables

V Vercel pojdi v:

```text
Project Settings -> Environment Variables
```

Dodaj vrednosti iz:

```text
.env.vercel.example
```

Za prvi deploy so najbolj pomembne:

```text
DATABASE_URL
NEXT_PUBLIC_APP_URL
PARSER_PROVIDER=mock
PARSER_MODEL=mock-parser
```

Za Production nastavi:

```text
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

Za Preview lahko `NEXT_PUBLIC_APP_URL` izpustis, ker aplikacija uporabi Vercel `VERCEL_URL`.

## 10. Prvi deploy

Ko so env vars nastavljene, klikni `Deploy`.

Po deployu preveri:

```text
/
/ai-visibility-checker
/app/onboarding
/pricing
```

Free audit z mock providerjem mora delovati tudi brez Redis workerja.

## 11. Deploy po spremembah

Vsak nov commit na `main` sprozi nov Vercel Production deploy:

```cmd
git add .
git commit -m "Describe change"
git push
```

## 12. Worker pozneje

Vercel ni primeren za stalni BullMQ worker. Ko bos dodal live provider scans, worker poganjaj loceno, na primer na Railway, Render, Fly.io ali VPS.

Worker command:

```cmd
pnpm install
pnpm db:generate
pnpm --filter @ai-radar/worker start
```

Worker potrebuje vsaj:

```text
DATABASE_URL
REDIS_URL
OPENAI_API_KEY
OPENAI_MODEL
GEMINI_API_KEY
GEMINI_MODEL
ANTHROPIC_API_KEY
CLAUDE_MODEL
PARSER_PROVIDER
PARSER_MODEL
NEXT_PUBLIC_APP_URL
```
