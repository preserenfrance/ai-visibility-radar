# Vercel Deploy

AI Visibility Radar je monorepo, zato naj bo Vercel projekt povezan na root repozitorija. Root build gradi samo `apps/web`; `apps/worker` je locen proces za Redis/BullMQ jobe.

Za celoten postopek od lokalnega Git commita do Vercel importa glej [Git to Vercel](git-to-vercel.md). Za Windows Command Prompt uporabi [Git to Vercel - CMD](git-to-vercel-cmd.md).

## Vercel Project Settings

- Framework Preset: `Next.js`
- Root Directory: repository root
- Install Command: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --legacy-peer-deps`
- Build Command: `npm run vercel:build`
- Output Directory: `apps/web/.next`
- Node.js Version: `22.x`

`vercel.json` te vrednosti ze nastavi, zato jih v UI spremeni samo, ce Vercel zahteva rocni override. Build command najprej generira Prisma Client, nato zgradi `apps/web` in njegove workspace package dependencies.

## Production Environment Variables

Set these in Vercel for Production:

```bash
DATABASE_URL=
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=
PARSER_PROVIDER=mock
PARSER_MODEL=mock-parser
LLM_OPENAI_INPUT_USD_PER_1M=
LLM_OPENAI_OUTPUT_USD_PER_1M=
LLM_GEMINI_INPUT_USD_PER_1M=
LLM_GEMINI_OUTPUT_USD_PER_1M=
LLM_CLAUDE_INPUT_USD_PER_1M=
LLM_CLAUDE_OUTPUT_USD_PER_1M=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_GROWTH_PRICE_ID=

RESEND_API_KEY=
SENTRY_DSN=
POSTHOG_KEY=
```

For Preview deploys, `NEXT_PUBLIC_APP_URL` can be omitted because the app falls back to Vercel's `VERCEL_URL`. Set it explicitly for Production and custom domains.

Optional for the web deploy:

```bash
REDIS_URL=
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
```

If `REDIS_URL` is not set, web routes that enqueue background scans will skip queue creation. Synchronous mock/free-audit paths still work. For live provider scans, run the worker separately and set `REDIS_URL` in both Vercel and the worker runtime.

## Database

Use a hosted PostgreSQL database such as Vercel Postgres, Neon, Supabase, or Railway Postgres.

Before the first production deploy, run migrations from a trusted machine or CI job:

```bash
npm install --legacy-peer-deps
npm run db:generate
npm run db:deploy
```

The Vercel build runs `pnpm db:generate`, but it does not run migrations automatically.

## Worker Runtime

Vercel Serverless Functions are not suitable for the long-running BullMQ worker. Run `apps/worker` on a worker host such as Railway, Render, Fly.io, a VPS, or a container platform.

Worker command:

```bash
npm install --legacy-peer-deps
npm run db:generate
npm --workspace @ai-radar/worker run start
```

Required worker env:

```bash
DATABASE_URL=
REDIS_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=
PARSER_PROVIDER=mock
PARSER_MODEL=mock-parser
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Notes

- OpenAI, Gemini, and Claude adapters use official APIs only.
- The MVP free audit route has `maxDuration: 60` because it runs the user's 5 submitted prompts through the selected model flow.
- Provider scans should be queued and processed by the external worker once Redis is configured.
