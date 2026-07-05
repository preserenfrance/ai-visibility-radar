# Railway scan worker

Use this service for long-running scan execution. The web app stays on Vercel;
Railway only drains queued `ScanRun` rows from the database.

## Deploy

1. Create a new Railway project from the GitHub repository.
2. If Railway stages both `web` and `worker`, deploy only `worker`.
   Delete or discard the `web` service because the web app stays on Vercel.
3. Keep the worker service connected to the repository root. Railway's monorepo
   import may show the package as `apps/worker`, but the build must still run
   from the workspace root so local packages resolve correctly.
4. Railway reads `apps/worker/railway.json` for the worker service and starts it
   with:

```bash
npm run worker:railway
```

If Railway ignores the config file and uses its auto-detected commands instead,
that is also supported:

```bash
pnpm --filter @ai-radar/worker build
pnpm --filter @ai-radar/worker start
```

## Required variables

Set these variables on the Railway service:

```bash
WORKER_QUEUE_DRIVER=database
DATABASE_URL=<same Prisma/Supabase database URL used by production>
NEXT_PUBLIC_APP_URL=https://www.llmvisio.com
RESEND_API_KEY=<resend key>
RESEND_FROM_EMAIL=<verified sender>
PARSER_PROVIDER=<openai|google|anthropic|mock>
PARSER_MODEL=<parser model>
OPENAI_API_KEY=<if OpenAI engines are enabled>
OPENAI_MODEL=<if OpenAI engines are enabled>
GEMINI_API_KEY=<if Gemini engines are enabled>
GEMINI_MODEL=<if Gemini engines are enabled>
ANTHROPIC_API_KEY=<if Claude engines are enabled>
CLAUDE_MODEL=<if Claude engines are enabled>
```

Optional tuning:

```bash
DB_WORKER_POLL_MS=3000
DB_WORKER_IDLE_POLL_MS=10000
DB_WORKER_BATCH_LIMIT=1
SCAN_CONCURRENCY_LIMIT=1
PROMPT_RUN_CONCURRENCY_LIMIT=2
```

After the Railway worker is live, keep Vercel cron enabled for scheduling
recurring scans, but set this on the Vercel web project:

```bash
CRON_PROCESS_SCAN_QUEUE=false
```

With that split, Vercel creates scheduled scans and Railway processes manual,
scheduled, and free-audit scans without a browser being open.
