# AI Visibility Radar

SaaS MVP for measuring how a brand, domain, and offer appear in AI assistant answers across ChatGPT, Gemini, Claude, and a deterministic mock provider.

The implementation keeps provider calls on official APIs:

- OpenAI Responses API with the `web_search` tool.
- Google Gemini API with Grounding with Google Search.
- Anthropic Messages API with the web search tool and citation-aware content blocks.
- No browser automation and no scraping of ChatGPT, Gemini, or Claude web UIs.

## Workspace

- `apps/web`: Next.js app, API routes, dashboard, public audit, admin leads.
- `apps/worker`: BullMQ worker for scans, parsing, scoring, recommendations, and email reports.
- `packages/db`: Prisma schema and database client.
- `packages/ai`: Provider adapters for OpenAI, Gemini, Claude, and mock.
- `packages/crawler`: Legacy crawler package, currently disabled in the product flow.
- `packages/prompts`: Legacy prompt generator package, currently disabled in the product flow.
- `packages/parser`: Strict parser schema and extraction helpers.
- `packages/scoring`: AI Visibility Score formulas.
- `packages/email`: Email sender abstraction.
- `packages/reports`: HTML report generator.
- `packages/shared`: Shared types and constants.

## Local start

```bash
pnpm install
cp .env.example .env.local
pnpm db:generate
pnpm db:migrate
pnpm web:dev
pnpm worker:dev
```

Use `PARSER_PROVIDER=mock` and the mock engine for local end-to-end tests before adding live API keys.

## Vercel

The web app is prepared for Vercel from the repository root. Vercel should run:

```bash
npm run vercel:build
```

That command generates Prisma Client and builds the web app plus its workspace package dependencies.

See [docs/git-to-vercel.md](docs/git-to-vercel.md) for the full GitHub -> Vercel flow, [docs/git-to-vercel-cmd.md](docs/git-to-vercel-cmd.md) for the Windows CMD version, and [docs/vercel.md](docs/vercel.md) for Vercel settings, env vars, database migration notes, and the separate worker runtime.
