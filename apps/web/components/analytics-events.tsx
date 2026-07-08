"use client";

import * as React from "react";
import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;

export function trackAnalyticsEvent(
  name: string,
  properties?: AnalyticsProperties,
) {
  track(name, properties);
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
