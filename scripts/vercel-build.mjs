import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.DATABASE_URL) {
  run("npm", ["run", "db:deploy"]);
} else {
  console.warn(
    "Skipping Prisma migrate deploy because DATABASE_URL is not set.",
  );
}

run("npm", ["run", "db:generate"]);
run("turbo", ["run", "build", "--filter=@ai-radar/web..."]);
