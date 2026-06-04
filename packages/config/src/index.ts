import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().optional(),
  PARSER_PROVIDER: z.enum(["openai", "google", "anthropic", "mock"]).default("mock"),
  PARSER_MODEL: z.string().default("mock-parser"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_STARTER_PRICE_ID: z.string().optional(),
  STRIPE_GROWTH_PRICE_ID: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  POSTHOG_KEY: z.string().optional()
});

export type AppConfig = Omit<z.infer<typeof envSchema>, "NEXT_PUBLIC_APP_URL"> & {
  NEXT_PUBLIC_APP_URL: string;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    NEXT_PUBLIC_APP_URL:
      parsed.NEXT_PUBLIC_APP_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000")
  };
}

export function requireEnv(name: keyof AppConfig): string {
  const value = getConfig()[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value);
}
