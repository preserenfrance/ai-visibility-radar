import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getConfig } from "@ai-radar/config";
import { JOB_NAMES, type JobName } from "@ai-radar/shared";

let queue: Queue | null | undefined;

export function getRadarQueue(): Queue | null {
  const config = getConfig();
  if (!config.REDIS_URL) return null;
  if (queue !== undefined) return queue;
  const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null
  });
  queue = new Queue("ai-visibility-radar", { connection });
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
