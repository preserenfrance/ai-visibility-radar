import { Queue } from "bullmq";
import { getConfig } from "@ai-radar/config";
import { JOB_NAMES, type JobName } from "@ai-radar/shared";

let queue: Queue | null | undefined;

export function getRadarQueue(): Queue | null {
  const config = getConfig();
  if (!config.REDIS_URL) return null;
  if (queue !== undefined) return queue;
  queue = new Queue("ai-visibility-radar", { connection: redisConnectionOptions(config.REDIS_URL) });
  return queue;
}

export async function enqueueJob(name: JobName, data: Record<string, unknown>, jobId?: string) {
  const radarQueue = getRadarQueue();
  if (!radarQueue) return { skipped: true };
  const job = await radarQueue.add(name, data, {
    jobId,
    attempts: name === JOB_NAMES.parseResponse ? 2 : 3,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: 500,
    removeOnFail: 1000
  });
  return { skipped: false, id: job.id };
}

function redisConnectionOptions(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null
  };
}
