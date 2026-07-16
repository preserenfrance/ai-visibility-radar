import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@ai-radar/db";
import { requireCurrentUser } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import {
  defaultNotificationLocale,
  isProductNotificationId,
  productNotificationIds,
  productNotificationsForLocale,
} from "@/lib/product-notifications";
import { z } from "zod";

const readSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

type ReadRow = {
  notificationId: string;
  readAt: Date;
};

export async function GET(request: Request) {
  return route(async () => {
    const user = await requireCurrentUser();
    const url = new URL(request.url);
    const locale =
      url.searchParams.get("locale") ??
      user.preferredLocale ??
      defaultNotificationLocale();
    const notifications = productNotificationsForLocale(locale);
    const reads = await prisma.$queryRaw<ReadRow[]>`
      SELECT "notificationId", "readAt"
      FROM "UserNotificationRead"
      WHERE "userId" = ${user.id}
    `;
    const readById = new Map(
      reads.map((read) => [read.notificationId, read.readAt.toISOString()]),
    );
    const items = notifications.map((notification) => ({
      ...notification,
      readAt: readById.get(notification.id) ?? null,
      isUnread: !readById.has(notification.id),
    }));

    return ok({
      notifications: items,
      unreadCount: items.filter((notification) => notification.isUnread).length,
    });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireCurrentUser();
    const body = await parseBody(request, readSchema);
    const notificationIds = body.all
      ? productNotificationIds()
      : (body.notificationIds ?? []).filter(isProductNotificationId);

    if (notificationIds.length > 0) {
      const now = new Date();
      const values = notificationIds.map(
        (notificationId) =>
          Prisma.sql`(${randomUUID()}, ${user.id}, ${notificationId}, ${now})`,
      );
      await prisma.$executeRaw`
        INSERT INTO "UserNotificationRead" ("id", "userId", "notificationId", "readAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("userId", "notificationId")
        DO UPDATE SET "readAt" = EXCLUDED."readAt"
      `;
    }

    return ok({ success: true });
  });
}
