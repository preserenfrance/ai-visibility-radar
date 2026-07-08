"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@ai-radar/shared";

export function LocaleSwitcher({
  locale,
  label,
  localeNames,
}: {
  locale: SupportedLocale;
  label: string;
  localeNames: Record<SupportedLocale, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeLocale(nextLocale: SupportedLocale) {
    startTransition(async () => {
      document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      }).catch(() => null);
      const query = searchParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={locale}
        disabled={isPending}
        onChange={(event) =>
          changeLocale(event.currentTarget.value as SupportedLocale)
        }
        className="bg-transparent text-foreground outline-none"
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>
            {localeNames[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
