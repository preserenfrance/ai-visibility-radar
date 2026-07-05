import { Queue } from "bullmq";
import { getConfig } from "@ai-radar/config";
import { JOB_NAMES, type JobName } from "@ai-radar/shared";

let queue: Queue | null | undefined;

const ENQUEUE_TIMEOUT_MS = 1500;

export function getRadarQueue(): Queue | null {
  const config = getConfig();
  if (!config.REDIS_URL) return null;
  if (queue !== undefined) return queue;
  queue = new Queue("ai-visibility-radar", {
    connection: redisConnectionOptions(config.REDIS_URL),
  });
  return queue;
}

export async function enqueueJob(
  name: JobName,
  data: Record<string, unknown>,
  jobId?: string,
) {
  const radarQueue = getRadarQueue();
  if (!radarQueue) return { skipped: true };

  const addJob = radarQueue
    .add(name, data, {
      jobId,
      attempts: name === JOB_NAMES.parseResponse ? 2 : 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 500,
      removeOnFail: 1000,
    })
    .then((job) => ({ skipped: false, id: job.id }))
    .catch((error) => {
      console.warn("Queue enqueue failed; database queue will be used", {
        name,
        jobId,
        error,
      });
      return { skipped: true, error: errorMessage(error) };
    });

  return timeoutAfter(addJob, ENQUEUE_TIMEOUT_MS, () => {
    console.warn("Queue enqueue timed out; database queue will be used", {
      name,
      jobId,
    });
    return { skipped: true, error: "enqueue timeout" };
  });
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
    connectTimeout: 1000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
  };
}

function timeoutAfter<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => resolve(onTimeout()), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
