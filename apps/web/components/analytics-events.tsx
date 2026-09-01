"use client";

import * as React from "react";
import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;
type MetaPixelProperties = Record<string, string | number | boolean>;

const VISITOR_STORAGE_KEY = "air_analytics_visitor_id";
const SESSION_STORAGE_KEY = "air_analytics_session_id";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackAnalyticsEvent(
  name: string,
  properties?: AnalyticsProperties,
) {
  track(name, properties);
  trackMetaPixelEvent(name, properties);
  trackInternalAnalyticsEvent(name, { properties });
}

export function trackInternalAnalyticsEvent(
  eventName: string,
  input: {
    path?: string;
    search?: string;
    referrer?: string;
    locale?: string;
    properties?: AnalyticsProperties;
  } = {},
) {
  if (typeof window === "undefined") return;

  const payload = {
    eventName,
    visitorId: browserStoredId("localStorage", VISITOR_STORAGE_KEY, "v"),
    sessionId: browserStoredId("sessionStorage", SESSION_STORAGE_KEY, "s"),
    path: input.path ?? window.location.pathname,
    search: input.search ?? window.location.search,
    referrer: input.referrer ?? document.referrer,
    locale:
      input.locale ??
      document.documentElement.lang ??
      navigator.language?.slice(0, 12),
    properties: sanitizeInternalProperties(input.properties),
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/events", blob)) return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => null);
}

function trackMetaPixelEvent(name: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined" || !window.fbq) return;

  const metaProperties = sanitizeMetaProperties(properties);

  if (name === "first_scan_cta_click") {
    window.fbq("trackCustom", "FirstScanCtaClick", metaProperties);
    return;
  }

  if (name === "free_audit_cta_click") {
    window.fbq("trackCustom", "FreeAuditCtaClick", metaProperties);

    if (properties?.valid_prompt_count === true) {
      window.fbq("track", "Lead", {
        ...metaProperties,
        content_name: "free_audit",
        content_category: "audit",
      });
    }
    return;
  }

  if (name === "upgrade_plan_click") {
    const plan =
      typeof properties?.plan === "string" ? properties.plan : "unknown";

    window.fbq("trackCustom", "UpgradePlanClick", metaProperties);
    window.fbq("track", "InitiateCheckout", {
      ...metaProperties,
      content_name: plan,
      content_category: "subscription",
      currency: "EUR",
    });
  }
}

function browserStoredId(
  storageName: "localStorage" | "sessionStorage",
  key: string,
  prefix: string,
) {
  try {
    const storage = window[storageName];
    const existing = storage.getItem(key);
    if (existing) return existing;

    const value = `${prefix}_${randomId()}`;
    storage.setItem(key, value);
    return value;
  } catch {
    return `${prefix}_${randomId()}`;
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function sanitizeInternalProperties(properties?: AnalyticsProperties) {
  if (!properties) return {};

  return Object.fromEntries(
    Object.entries(properties).filter((entry) => {
      const value = entry[1];
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      );
    }),
  );
}

function sanitizeMetaProperties(
  properties?: AnalyticsProperties,
): MetaPixelProperties {
  if (!properties) return {};

  return Object.fromEntries(
    Object.entries(properties).filter(
      (entry): entry is [string, string | number | boolean] => {
        const value = entry[1];
        return (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        );
      },
    ),
  );
}

export const TrackedAnchor = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    eventName: string;
    eventProperties?: AnalyticsProperties;
  }
>(({ eventName, eventProperties, onClick, ...props }, ref) => {
  return (
    <a
      ref={ref}
      {...props}
      onClick={(event) => {
        trackAnalyticsEvent(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
});

TrackedAnchor.displayName = "TrackedAnchor";
