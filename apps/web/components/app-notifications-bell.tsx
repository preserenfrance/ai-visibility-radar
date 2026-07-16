"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import type { SupportedLocale } from "@ai-radar/shared";
import { Button } from "@/components/ui/button";
import { localizedPath } from "@/lib/locale-path";

type NotificationMessages = {
  aria: string;
  title: string;
  empty: string;
  markAllRead: string;
  unreadLabel: string;
  loading: string;
};

type ProductNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  publishedAt: string;
  readAt: string | null;
  isUnread: boolean;
};

export function AppNotificationsBell({
  locale,
  messages,
  mobile = false,
}: {
  locale: SupportedLocale;
  messages: NotificationMessages;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState<ProductNotification[]>([]);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);

    fetch(`/api/notifications?locale=${locale}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        const nextNotifications = Array.isArray(data.notifications)
          ? data.notifications.filter(isProductNotification)
          : [];
        setNotifications(nextNotifications);
      })
      .catch(() => {
        if (!ignore) setNotifications([]);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [locale]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.isUnread).length,
    [notifications],
  );

  async function markAllRead() {
    if (unreadCount === 0) return;
    await markNotificationsRead(
      notifications.map((notification) => notification.id),
    );
  }

  async function markNotificationsRead(notificationIds: string[]) {
    if (notificationIds.length === 0) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      if (response.ok) {
        const readAt = new Date().toISOString();
        const readIds = new Set(notificationIds);
        setNotifications((items) =>
          items.map((item) =>
            readIds.has(item.id) ? { ...item, isUnread: false, readAt } : item,
          ),
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={mobile ? "relative w-full" : "relative"}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={mobile ? "w-full justify-start" : "relative px-3"}
        aria-label={messages.aria}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {mobile && <span>{messages.title}</span>}
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={
            mobile
              ? "mt-2 grid gap-2 rounded-md border bg-white p-3 shadow-sm"
              : "absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-2 rounded-lg border bg-white p-3 text-sm shadow-lg"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{messages.title}</div>
              {unreadCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {unreadCount} {messages.unreadLabel}
                </div>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={markAllRead}
              disabled={unreadCount === 0 || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {messages.markAllRead}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {messages.loading}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
              {messages.empty}
            </div>
          ) : (
            <div className="grid max-h-96 gap-2 overflow-auto">
              {notifications.slice(0, 5).map((notification) => (
                <a
                  key={notification.id}
                  href={localizedPath(
                    notification.href ?? "/app/dashboard",
                    locale,
                  )}
                  onClick={() => {
                    if (notification.isUnread) {
                      void markNotificationsRead([notification.id]);
                    }
                  }}
                  className="grid gap-1 rounded-md border bg-background p-3 transition hover:border-primary/50 hover:bg-secondary/30"
                >
                  <div className="flex items-start gap-2">
                    {notification.isUnread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium">{notification.title}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isProductNotification(value: unknown): value is ProductNotification {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.body === "string" &&
    typeof record.publishedAt === "string" &&
    typeof record.isUnread === "boolean"
  );
}
