import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient } from "@prisma/client";
export * from "@prisma/client";

export type ScanStartResult =
  | {
      started: true;
      reason: "started" | "already_running";
      limit: number;
      runningCount: number;
    }
  | {
      started: false;
      reason: "limit_reached" | "terminal";
      limit: number;
      runningCount: number;
    };

export function scanConcurrencyLimit(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.SCAN_CONCURRENCY_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 1) return 2;
  return Math.floor(parsed);
}

export function promptRunConcurrencyLimit(
  env: NodeJS.ProcessEnv = process.env,
) {
  const parsed = Number(env.PROMPT_RUN_CONCURRENCY_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 1) return 2;
  return Math.floor(parsed);
}

export function promptRunStaleMs(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.PROMPT_RUN_STALE_MS);
  if (!Number.isFinite(parsed) || parsed < 30_000) return 1000 * 60 * 2;
  return Math.floor(parsed);
}

export function scanRunStaleMs(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.SCAN_RUN_STALE_MS);
  if (!Number.isFinite(parsed) || parsed < 60_000) return 1000 * 60 * 10;
  return Math.floor(parsed);
}

export async function resetStaleScanWork() {
  const promptCutoff = new Date(Date.now() - promptRunStaleMs());
  const scanCutoff = new Date(Date.now() - scanRunStaleMs());

  await prisma.promptRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: promptCutoff },
    },
    data: {
      status: "queued",
      errorMessage: "Retry after stale execution timeout.",
    },
  });

  await prisma.scanRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: scanCutoff },
      promptRuns: { none: { status: "running" } },
    },
    data: { status: "queued" },
  });
}

export async function tryStartScanRun(
  scanRunId: string,
): Promise<ScanStartResult> {
  const limit = scanConcurrencyLimit();
  await resetStaleScanWork();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const scan = await tx.scanRun.findUnique({
            where: { id: scanRunId },
            select: { status: true, startedAt: true },
          });
          if (!scan) throw new Error("Scan not found");

          const runningCount = await tx.scanRun.count({
            where: { status: "running" },
          });

          if (scan.status === "running") {
            return {
              started: true,
              reason: "already_running",
              limit,
              runningCount,
            };
          }

          if (
            scan.status === "completed" ||
            scan.status === "failed" ||
            scan.status === "canceled"
          ) {
            return {
              started: false,
              reason: "terminal",
              limit,
              runningCount,
            };
          }

          if (runningCount >= limit) {
            return {
              started: false,
              reason: "limit_reached",
              limit,
              runningCount,
            };
          }

          await tx.scanRun.update({
            where: { id: scanRunId },
            data: {
              status: "running",
              startedAt: scan.startedAt ?? new Date(),
            },
          });

          return {
            started: true,
            reason: "started",
            limit,
            runningCount: runningCount + 1,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isTransactionConflict(error) && attempt === 0) continue;
      throw error;
    }
  }

  return {
    started: false,
    reason: "limit_reached",
    limit,
    runningCount: limit,
  };
}

function isTransactionConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function assertMembership(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden: organization membership required");
  }

  return membership;
}
