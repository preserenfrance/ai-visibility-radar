"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { SupportedLocale } from "@ai-radar/shared";
import { trackInternalAnalyticsEvent } from "@/components/analytics-events";

export function AnalyticsPageTracker({ locale }: { locale: SupportedLocale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    trackInternalAnalyticsEvent("page_view", {
      path: pathname || "/",
      search: search ? `?${search}` : "",
      referrer: document.referrer || "",
      locale,
      properties: {
        title: document.title,
      },
    });
  }, [locale, pathname, search]);

  return null;
}
