import { getConfig } from "@ai-radar/config";
import { fail, ok, route } from "@/lib/http";
import { processScanQueueTick } from "@/lib/services";

export const maxDuration = 300;

export async function GET(request: Request) {
  return runProcessQueue(request);
}

export async function POST(request: Request) {
  return runProcessQueue(request);
}

function runProcessQueue(request: Request) {
  return route(async () => {
    if (!isAuthorizedCronRequest(request))
      return fail("Cron ni avtoriziran.", 401);

    const result = await processScanQueueTick();
    return ok(result);
  });
}

function isAuthorizedCronRequest(request: Request) {
  const config = getConfig();
  if (!config.CRON_SECRET) return true;
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  return token === config.CRON_SECRET || querySecret === config.CRON_SECRET;
}
