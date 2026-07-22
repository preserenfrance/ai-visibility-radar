import { prisma, resetStaleScanWork } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { sendFreeUserReactivationEmail } from "@ai-radar/email";
import { freeRecurringScanNeedsPortalVisit } from "@ai-radar/shared";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { fail, ok, route } from "@/lib/http";
import {
  emailPreferencesUrl,
  ensureEmailPreferencesToken,
} from "@/lib/email-preferences";
import {
  createScanForBrand,
  nextRecurringScanDate,
  recurringScanActivationData,
  recurringScanCadenceForPlan,
  recurringScanEngineVariantsFromJson,
} from "@/lib/services";
import {
  processScanQueueUntilBudget,
  SCAN_QUEUE_TRIGGER_TYPES,
} from "@/lib/scan-queue";

export const maxDuration = 300;

const MAX_NEW_SCANS_PER_TICK = 20;
const CRON_SCHEDULE = "* * * * *";
const RECURRING_SCAN_PLANS = ["free", "starter", "growth"] as const;
const PORTAL_ACTIVITY_ACTIONS = [
  "login",
  "report_viewed",
  "brand_created",
  "billing_checkout_started",
] as const;
const ACTIVE_LEAD_STATUSES = ["opened", "demo_clicked", "converted"] as const;

type FreeReactivationRecipient = {
  kind: "user" | "lead";
  id: string;
  email: string;
  locale?: string | null;
  name?: string | null;
  path: string;
  unsubscribeUrl?: string;
};

export async function GET(request: Request) {
  return runRegularScans(request);
}

export async function POST(request: Request) {
  return runRegularScans(request);
}

function runRegularScans(request: Request) {
  return route(async () => {
    if (!isAuthorizedCronRequest(request))
      return fail("Cron ni avtoriziran.", 401);

    await resetStaleScanWork();

    const now = new Date();
    const deactivatedWithoutAutomation = await prisma.brand.updateMany({
      where: {
        recurringScanActive: true,
        organization: {
          plan: { notIn: [...RECURRING_SCAN_PLANS] },
        },
      },
      data: {
        recurringScanActive: false,
        recurringScanPlan: null,
        recurringScanCadence: null,
        recurringScanNextRunAt: null,
      },
    });
    let activatedRecurringBrands = 0;
    for (const plan of RECURRING_SCAN_PLANS) {
      const recurringData = recurringScanActivationData(plan, now);
      if (!recurringData) continue;

      const result = await prisma.brand.updateMany({
        where: {
          organization: {
            plan,
          },
          OR: [
            { recurringScanActive: false },
            { recurringScanCadence: null },
            { recurringScanCadence: { not: "weekly" } },
            { recurringScanPlan: null },
            { recurringScanPlan: { not: plan } },
            { recurringScanNextRunAt: null },
          ],
        },
        data: recurringData,
      });
      activatedRecurringBrands += result.count;
    }

    const dueBrands = await prisma.brand.findMany({
      where: {
        recurringScanActive: true,
        recurringScanNextRunAt: { lte: now },
        organization: {
          plan: {
            in: [...RECURRING_SCAN_PLANS],
          },
        },
        promptSets: {
          some: {
            status: "active",
            prompts: { some: { isActive: true } },
          },
        },
      },
      include: {
        organization: {
          include: {
            billingSubscription: true,
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    preferredLocale: true,
                    scanEmailConsent: true,
                    lastSeenAt: true,
                    createdAt: true,
                  },
                },
              },
            },
            leads: {
              select: {
                id: true,
                email: true,
                locale: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        },
      },
      orderBy: { recurringScanNextRunAt: "asc" },
      take: MAX_NEW_SCANS_PER_TICK,
    });

    const createdScans: string[] = [];
    const failedBrands: string[] = [];
    const skippedInactiveFreeBrands: string[] = [];
    let reactivationEmails = 0;
    let reactivationEmailFailures = 0;
    for (const brand of dueBrands) {
      const cadence =
        brand.recurringScanCadence ??
        recurringScanCadenceForPlan(brand.organization.plan);
      if (!cadence) continue;
      try {
        if (brand.organization.plan === "free") {
          const lastActivityAt = await latestFreePortalActivity(brand);
          if (freeRecurringScanNeedsPortalVisit(lastActivityAt, now)) {
            skippedInactiveFreeBrands.push(brand.id);
            const result = await notifyInactiveFreeBrand(brand);
            reactivationEmails += result.sent;
            reactivationEmailFailures += result.failed;
            await prisma.brand.update({
              where: { id: brand.id },
              data: {
                recurringScanNextRunAt: nextRecurringScanDate(cadence, now),
              },
            });
            continue;
          }
        }

        const limits = PLAN_LIMITS[brand.organization.plan];
        const scan = await createScanForBrand(brand.id, {
          triggerType: "scheduled",
          promptLimit: limits.promptsPerBrand,
          repeatCount: 1,
          runNow: false,
          engineVariants: recurringScanEngineVariantsFromJson(
            brand.recurringScanProviderVariants,
          ),
        });
        if (scan?.id) createdScans.push(scan.id);

        await prisma.brand.update({
          where: { id: brand.id },
          data: {
            recurringScanLastRunAt: now,
            recurringScanNextRunAt: nextRecurringScanDate(cadence, now),
          },
        });
      } catch (error) {
        failedBrands.push(brand.id);
        console.error("Regular scan creation failed", {
          brandId: brand.id,
          error,
        });
      }
    }

    const scanQueue =
      process.env.CRON_PROCESS_SCAN_QUEUE === "false"
        ? {
            attemptedSteps: 0,
            processedSteps: [],
            failedSteps: [],
            settledExpired: 0,
            remaining: await queuedScanCount(),
            exhaustedBudget: false,
            skipped: "dedicated_worker_enabled",
          }
        : await processScanQueueUntilBudget();

    return ok({
      deactivatedWithoutAutomation: deactivatedWithoutAutomation.count,
      activatedRecurringBrands,
      createdScans,
      failedBrands,
      skippedInactiveFreeBrands,
      reactivationEmails,
      reactivationEmailFailures,
      scanQueue,
    });

    async function latestFreePortalActivity(
      brand: (typeof dueBrands)[number],
    ) {
      const users = brand.organization.memberships.map(
        (membership) => membership.user,
      );
      const userIds = users.map((user) => user.id);
      const latestTrackedUserActivity = latestDate(
        users.map((user) => user.lastSeenAt ?? user.createdAt),
      );
      const latestLeadActivity = latestDate(
        brand.organization.leads.flatMap((lead) => [
          lead.createdAt,
          ACTIVE_LEAD_STATUSES.includes(
            lead.status as (typeof ACTIVE_LEAD_STATUSES)[number],
          )
            ? lead.updatedAt
            : null,
        ]),
      );

      const auditLogFilters = [
        {
          organizationId: brand.organizationId,
          action: { in: [...PORTAL_ACTIVITY_ACTIONS] },
        },
        ...(userIds.length
          ? [
              {
                userId: { in: userIds },
                action: { in: [...PORTAL_ACTIVITY_ACTIONS] },
              },
            ]
          : []),
      ];
      const latestAuditLog = await prisma.auditLog.findFirst({
        where: { OR: auditLogFilters },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      return latestDate([
        latestTrackedUserActivity,
        latestLeadActivity,
        latestAuditLog?.createdAt,
      ]);
    }

    async function notifyInactiveFreeBrand(brand: (typeof dueBrands)[number]) {
      let sent = 0;
      let failed = 0;
      for (const recipient of await inactiveFreeBrandRecipients(brand)) {
        try {
          const email = await sendFreeUserReactivationEmail({
            to: recipient.email,
            locale: recipient.locale,
            recipientName: recipient.name,
            brandName: brand.name,
            brandDomain: brand.domain,
            ctaUrl: absoluteAppUrl(recipient.path),
            unsubscribeUrl: recipient.unsubscribeUrl,
          });
          await prisma.emailEvent.create({
            data: {
              userId: recipient.kind === "user" ? recipient.id : undefined,
              leadId: recipient.kind === "lead" ? recipient.id : undefined,
              type: email.skipped ? "queued" : "sent",
              provider: "resend",
              providerId: email.id,
              subject: email.subject,
            },
          });
          sent += 1;
        } catch (error) {
          failed += 1;
          console.warn("Free reactivation email failed", {
            brandId: brand.id,
            recipientId: recipient.id,
            error,
          });
          await recordFailedFreeReactivationEmail(
            recipient,
            brand.name,
            error,
          );
        }
      }

      return { sent, failed };
    }

    async function inactiveFreeBrandRecipients(
      brand: (typeof dueBrands)[number],
    ) {
      const recipients: FreeReactivationRecipient[] = [];
      const seenEmails = new Set<string>();

      for (const membership of brand.organization.memberships) {
        const user = membership.user;
        const email = user.email.trim().toLowerCase();
        if (!email || seenEmails.has(email) || !user.scanEmailConsent) continue;
        seenEmails.add(email);
        recipients.push({
          kind: "user",
          id: user.id,
          email,
          locale: user.preferredLocale,
          name: user.name,
          path: `/app/brands/${brand.id}`,
          unsubscribeUrl: emailPreferencesUrl(
            await ensureEmailPreferencesToken(user.id),
            "scans",
          ),
        });
      }

      for (const lead of brand.organization.leads) {
        const email = lead.email.trim().toLowerCase();
        if (!email || seenEmails.has(email) || lead.status === "archived")
          continue;
        seenEmails.add(email);
        recipients.push({
          kind: "lead",
          id: lead.id,
          email,
          locale: lead.locale,
          path: `/audit/${lead.id}`,
        });
      }

      return recipients;
    }
  });
}

async function queuedScanCount() {
  return prisma.scanRun.count({
    where: {
      triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
      status: { in: ["queued", "running"] },
    },
  });
}

function latestDate(values: Array<Date | null | undefined>) {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value || Number.isNaN(value.getTime())) continue;
    if (!latest || value.getTime() > latest.getTime()) latest = value;
  }
  return latest;
}

function absoluteAppUrl(path: string) {
  const base = getConfig().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function recordFailedFreeReactivationEmail(
  recipient: FreeReactivationRecipient,
  brandName: string,
  error: unknown,
) {
  try {
    await prisma.emailEvent.create({
      data: {
        userId: recipient.kind === "user" ? recipient.id : undefined,
        leadId: recipient.kind === "lead" ? recipient.id : undefined,
        type: "failed",
        provider: "resend",
        subject: `Free AI monitoring reminder for ${brandName}`,
        errorMessage: errorMessage(error),
      },
    });
  } catch (loggingError) {
    console.warn("Free reactivation email event logging failed", loggingError);
  }
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
