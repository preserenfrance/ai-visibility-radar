"use client";

import * as React from "react";
import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;
type MetaPixelProperties = Record<string, string | number | boolean>;

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
}

function trackMetaPixelEvent(
  name: string,
  properties?: AnalyticsProperties,
) {
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
