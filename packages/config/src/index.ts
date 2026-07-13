import { z } from "zod";

const CANONICAL_APP_URL = "https://www.llmvisio.com";
const LOCAL_APP_URL = "http://localhost:3000";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ADMIN_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_ADMIN_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().optional(),
  PARSER_PROVIDER: z
    .enum(["openai", "google", "anthropic", "mock"])
    .default("mock"),
  PARSER_MODEL: z.string().default("mock-parser"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_STARTER_PRICE_ID: z.string().optional(),
  STRIPE_GROWTH_PRICE_ID: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  MAKE_USER_REGISTERED_WEBHOOK_URL: z.string().url().optional(),
  MAKE_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
});

export type AppConfig = Omit<
  z.infer<typeof envSchema>,
  "NEXT_PUBLIC_APP_URL"
> & {
  NEXT_PUBLIC_APP_URL: string;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    NEXT_PUBLIC_APP_URL: publicAppUrl(parsed.NEXT_PUBLIC_APP_URL, env.NODE_ENV),
  };
}

export function requireEnv(name: keyof AppConfig): string {
  const value = getConfig()[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value);
}

function publicAppUrl(
  configuredUrl: string | undefined,
  nodeEnv: string | undefined,
) {
  const fallback =
    nodeEnv === "development" ? LOCAL_APP_URL : CANONICAL_APP_URL;
  const normalized = normalizeAppUrl(configuredUrl) ?? fallback;

  if (nodeEnv !== "development" && isVercelDeploymentUrl(normalized)) {
    return CANONICAL_APP_URL;
  }

  return normalized;
}

function normalizeAppUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const protocol =
    trimmed.startsWith("localhost") || trimmed.startsWith("127.")
      ? "http"
      : "https";
  return `${protocol}://${trimmed}`;
}

function isVercelDeploymentUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
  } catch {
    return value.toLowerCase().includes(".vercel.app");
  }
}
