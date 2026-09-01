import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { getCurrentUserSummary } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import {
  normalizeAnalyticsPath,
  sanitizeAnalyticsProperties,
  shouldRecordPageView,
} from "@/lib/website-analytics";

export const maxDuration = 10;

const analyticsValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const schema = z.object({
  eventName: z.string().min(1).max(80),
  visitorId: z.string().min(8).max(120),
  sessionId: z.string().min(8).max(120).optional(),
  path: z.string().min(1).max(500),
  search: z.string().max(500).optional(),
  referrer: z.string().max(1000).optional(),
  locale: z.string().max(16).optional(),
  properties: z.record(analyticsValueSchema).optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const normalizedPath = normalizeAnalyticsPath(input.path);

    if (
      input.eventName === "page_view" &&
      !shouldRecordPageView(normalizedPath)
    ) {
      return ok({ recorded: false });
    }

    const user = await getCurrentUserSummary().catch(() => null);

    await prisma.websiteEvent.create({
      data: {
        eventName: input.eventName,
        visitorId: input.visitorId,
        sessionId: input.sessionId,
        userId: user?.id,
        path: input.path,
        normalizedPath,
        search: normalizeOptional(input.search),
        referrer: normalizeOptional(input.referrer),
        locale: normalizeOptional(input.locale),
        userAgent: normalizeOptional(request.headers.get("user-agent")),
        properties: sanitizeAnalyticsProperties(input.properties),
      },
    });

    return ok({ recorded: true }, 201);
  });
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, 1000) : null;
}
