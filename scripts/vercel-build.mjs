import { spawnSync } from "node:child_process";

const MIGRATION_DATABASE_URL_ENV_NAMES = [
  "DIRECT_DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_DIRECT_URL",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function migrationDatabaseUrl() {
  for (const envName of MIGRATION_DATABASE_URL_ENV_NAMES) {
    const value = process.env[envName];
    if (value) return { envName, value };
  }
  return null;
}

function isSupabaseTransactionPooler(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("pooler.supabase.com") && parsed.port === "6543"
    );
  } catch {
    return false;
  }
}

const migrationUrl = migrationDatabaseUrl();

if (migrationUrl) {
  console.log(`Running Prisma migrate deploy with ${migrationUrl.envName}.`);
  run("npm", ["run", "db:deploy"], {
    env: {
      ...process.env,
      DATABASE_URL: migrationUrl.value,
    },
    timeout: 120_000,
  });
} else if (process.env.DATABASE_URL) {
  if (isSupabaseTransactionPooler(process.env.DATABASE_URL)) {
    console.error(
      [
        "Refusing to run Prisma migrate deploy with the Supabase transaction pooler.",
        "Prisma migrations need a direct/non-pooling database URL.",
        "Set DIRECT_DATABASE_URL, DIRECT_URL, POSTGRES_URL_NON_POOLING, or DATABASE_DIRECT_URL in Vercel.",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("Running Prisma migrate deploy with DATABASE_URL.");
  run("npm", ["run", "db:deploy"], { timeout: 120_000 });
} else {
  console.warn(
    "Skipping Prisma migrate deploy because DATABASE_URL is not set.",
  );
}

run("npm", ["run", "db:generate"]);
run("turbo", ["run", "build", "--filter=@ai-radar/web..."]);
