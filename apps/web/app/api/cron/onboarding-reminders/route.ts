import { getConfig } from "@ai-radar/config";
import { fail, ok, route } from "@/lib/http";
import { sendOnboardingReminderEmails } from "@/lib/onboarding-reminders";

export const maxDuration = 120;

const CRON_SCHEDULE = "0 8 * * *";

export async function GET(request: Request) {
  return runOnboardingReminders(request);
}

export async function POST(request: Request) {
  return runOnboardingReminders(request);
}

function runOnboardingReminders(request: Request) {
  return route(async () => {
    if (!isAuthorizedCronRequest(request)) {
      return fail("Cron ni avtoriziran.", 401);
    }

    const result = await sendOnboardingReminderEmails();
    return ok(result);
  });
}

function isAuthorizedCronRequest(request: Request) {
  const config = getConfig();
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  if (
    config.CRON_SECRET &&
    (token === config.CRON_SECRET || querySecret === config.CRON_SECRET)
  ) {
    return true;
  }
  if (isVercelCronRequest(request)) return true;
  return !config.CRON_SECRET;
}

function isVercelCronRequest(request: Request) {
  return (
    request.headers.get("x-vercel-cron-schedule") === CRON_SCHEDULE &&
    request.headers.get("user-agent")?.includes("vercel-cron/1.0") === true
  );
}
