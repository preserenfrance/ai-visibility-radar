import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { sendOnboardingReminderEmail } from "@ai-radar/email";
import {
  emailPreferencesUrl,
  ensureEmailPreferencesToken,
} from "@/lib/email-preferences";
import { getUserOnboardingSummary } from "@/lib/onboarding";

export const ONBOARDING_REMINDER_SUBJECT_PREFIXES = [
  "Naslednji korak v AI Visibility Radar:",
  "Your next AI Visibility Radar step:",
] as const;

const DEFAULT_CANDIDATE_LIMIT = 100;
const DEFAULT_SEND_LIMIT = 25;
const MIN_ACCOUNT_AGE_DAYS = 1;
const COOLDOWN_DAYS = 5;
const MAX_SENT_REMINDERS = 4;

type ReminderDecision =
  | { canSend: true }
  | {
      canSend: false;
      reason: "too_new" | "cooldown" | "limit_reached";
    };

type SendOnboardingReminderOptions = {
  now?: Date;
  candidateLimit?: number;
  sendLimit?: number;
};

export type OnboardingReminderRunResult = {
  candidates: number;
  complete: number;
  sent: number;
  failed: number;
  skippedTooNew: number;
  skippedCooldown: number;
  skippedLimitReached: number;
};

export async function sendOnboardingReminderEmails(
  options: SendOnboardingReminderOptions = {},
): Promise<OnboardingReminderRunResult> {
  const now = options.now ?? new Date();
  const candidateLimit = options.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
  const sendLimit = options.sendLimit ?? DEFAULT_SEND_LIMIT;
  const result: OnboardingReminderRunResult = {
    candidates: 0,
    complete: 0,
    sent: 0,
    failed: 0,
    skippedTooNew: 0,
    skippedCooldown: 0,
    skippedLimitReached: 0,
  };

  const users = await prisma.user.findMany({
    where: {
      scanEmailConsent: true,
      memberships: {
        some: {
          organization: {
            plan: { not: "disabled" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: candidateLimit,
    select: {
      id: true,
      email: true,
      name: true,
      preferredLocale: true,
      createdAt: true,
    },
  });

  result.candidates = users.length;

  for (const user of users) {
    if (result.sent >= sendLimit) break;

    const summary = await getUserOnboardingSummary(user.id);
    const nextStep = summary.nextStep;
    if (!nextStep) {
      result.complete += 1;
      continue;
    }

    const previousReminders = await previousOnboardingReminders(user.id);
    const decision = onboardingReminderCanSend({
      userCreatedAt: user.createdAt,
      remindersSent: previousReminders.length,
      lastReminderAt: previousReminders[0]?.createdAt ?? null,
      now,
    });

    if (!decision.canSend) {
      if (decision.reason === "too_new") result.skippedTooNew += 1;
      if (decision.reason === "cooldown") result.skippedCooldown += 1;
      if (decision.reason === "limit_reached") result.skippedLimitReached += 1;
      continue;
    }

    try {
      const preferencesToken = await ensureEmailPreferencesToken(user.id);
      const email = await sendOnboardingReminderEmail({
        to: user.email,
        locale: user.preferredLocale,
        recipientName: user.name,
        nextStepTitle: nextStep.title,
        nextStepDescription: nextStep.description,
        completionPercent: summary.completionPercent,
        ctaUrl: absoluteAppUrl(nextStep.href),
        unsubscribeUrl: emailPreferencesUrl(preferencesToken, "scans"),
      });

      await prisma.emailEvent.create({
        data: {
          userId: user.id,
          type: email.skipped ? "queued" : "sent",
          provider: "resend",
          providerId: email.id,
          subject: email.subject,
        },
      });
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      await recordFailedOnboardingReminder(user.id, nextStep.title, error);
    }
  }

  return result;
}

export function onboardingReminderCanSend(input: {
  userCreatedAt: Date;
  remindersSent: number;
  lastReminderAt?: Date | null;
  now?: Date;
}): ReminderDecision {
  const now = input.now ?? new Date();

  if (input.userCreatedAt > addDays(now, -MIN_ACCOUNT_AGE_DAYS)) {
    return { canSend: false, reason: "too_new" };
  }

  if (input.remindersSent >= MAX_SENT_REMINDERS) {
    return { canSend: false, reason: "limit_reached" };
  }

  if (
    input.lastReminderAt &&
    input.lastReminderAt > addDays(now, -COOLDOWN_DAYS)
  ) {
    return { canSend: false, reason: "cooldown" };
  }

  return { canSend: true };
}

async function previousOnboardingReminders(userId: string) {
  return prisma.emailEvent.findMany({
    where: {
      userId,
      type: { in: ["queued", "sent"] },
      OR: ONBOARDING_REMINDER_SUBJECT_PREFIXES.map((prefix) => ({
        subject: { startsWith: prefix },
      })),
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

function absoluteAppUrl(path: string) {
  const base = getConfig().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function recordFailedOnboardingReminder(
  userId: string,
  nextStepTitle: string,
  error: unknown,
) {
  try {
    await prisma.emailEvent.create({
      data: {
        userId,
        type: "failed",
        provider: "resend",
        subject: `Onboarding reminder failed: ${nextStepTitle}`,
        errorMessage: errorMessage(error),
      },
    });
  } catch (loggingError) {
    console.warn("Onboarding reminder failure logging failed", loggingError);
  }
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
