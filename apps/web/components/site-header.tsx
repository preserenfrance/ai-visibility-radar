"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock3,
  ClipboardList,
  DollarSign,
  HelpCircle,
  LogOut,
  Menu,
  Plug,
  Radar,
  SearchCheck,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import type { SupportedLocale } from "@ai-radar/shared";
import { AppNotificationsBell } from "@/components/app-notifications-bell";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { localizedPath } from "@/lib/locale-path";

type HeaderUser = {
  email: string;
};

type SiteHeaderMessages = {
  common: {
    openMenu: string;
    faq: string;
    blog: string;
    contact: string;
    pricing: string;
    mcp: string;
    login: string;
    logout: string;
    freeAudit: string;
    language: string;
  };
  nav: {
    myBrands: string;
    newBrand: string;
    admin: string;
    operations: string;
    monitor: string;
    analytics: string;
    faqAdmin: string;
    prompts: string;
    settings: string;
  };
  notifications: {
    aria: string;
    title: string;
    empty: string;
    markAllRead: string;
    unreadLabel: string;
    loading: string;
  };
  localeNames: Record<SupportedLocale, string>;
};

export function SiteHeader({
  locale,
  messages,
}: {
  locale: SupportedLocale;
  messages: SiteHeaderMessages;
}) {
  const [session, setSession] = useState<{
    user: HeaderUser | null;
    isAdmin: boolean;
  }>({ user: null, isAdmin: false });

  useEffect(() => {
    let ignore = false;

    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!ignore && data) {
          setSession({
            user: data.user ? { email: String(data.user.email) } : null,
            isAdmin: Boolean(data.isAdmin),
          });
        }
      })
      .catch(() => {
        if (!ignore) setSession({ user: null, isAdmin: false });
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <a
          href={localizedPath("/", locale)}
          className="flex min-w-0 items-center gap-2 text-sm font-semibold"
        >
          <Radar className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate">AI Visibility Radar</span>
        </a>
        <nav className="site-header-desktop-nav hidden flex-wrap items-center justify-end gap-1 text-sm md:flex">
          <HeaderNavContent
            userEmail={session.user?.email}
            admin={session.isAdmin}
            locale={locale}
            messages={messages}
          />
        </nav>
        <details className="site-header-mobile-menu group md:hidden">
          <summary
            aria-label={messages.common.openMenu}
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border bg-white text-foreground transition hover:bg-secondary [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" />
          </summary>
          <nav className="absolute right-5 top-[calc(100%+0.5rem)] z-50 grid w-[min(calc(100vw-2.5rem),22rem)] gap-1 rounded-lg border bg-white p-2 text-sm shadow-lg">
            <HeaderNavContent
              userEmail={session.user?.email}
              admin={session.isAdmin}
              locale={locale}
              messages={messages}
              mobile
            />
          </nav>
        </details>
      </div>
    </header>
  );
}

function HeaderNavContent({
  userEmail,
  admin,
  locale,
  messages,
  mobile = false,
}: {
  userEmail?: string;
  admin: boolean;
  locale: SupportedLocale;
  messages: SiteHeaderMessages;
  mobile?: boolean;
}) {
  const navClassName = mobile ? "w-full justify-start" : undefined;
  const buttonClassName = mobile ? "w-full justify-start" : undefined;

  if (userEmail) {
    return (
      <>
        <Nav
          href={localizedPath("/app/dashboard", locale)}
          icon={<BarChart3 className="h-4 w-4" />}
          label={messages.nav.myBrands}
          className={navClassName}
        />
        <Nav
          href={localizedPath("/ai-visibility-checker", locale)}
          icon={<SearchCheck className="h-4 w-4" />}
          label={messages.nav.newBrand}
          className={navClassName}
        />
        <Nav
          href={localizedPath("/mcp-access", locale)}
          icon={<Plug className="h-4 w-4" />}
          label={messages.common.mcp}
          className={navClassName}
        />
        <AppNotificationsBell
          locale={locale}
          messages={messages.notifications}
          mobile={mobile}
        />
        <Nav
          href={localizedPath("/faq", locale)}
          icon={<HelpCircle className="h-4 w-4" />}
          label={messages.common.faq}
          className={navClassName}
        />
        <Nav
          href={localizedPath("/blog", locale)}
          icon={<ClipboardList className="h-4 w-4" />}
          label={messages.common.blog}
          className={navClassName}
        />
        {admin && (
          <Nav
            href={localizedPath("/admin", locale)}
            icon={<Activity className="h-4 w-4" />}
            label={messages.nav.admin}
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href={localizedPath("/admin/operations", locale)}
            icon={<BarChart3 className="h-4 w-4" />}
            label={messages.nav.operations}
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href={localizedPath("/admin/scan-monitor", locale)}
            icon={<Clock3 className="h-4 w-4" />}
            label={messages.nav.monitor}
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href={localizedPath("/admin/llm-costs", locale)}
            icon={<DollarSign className="h-4 w-4" />}
            label={messages.nav.analytics}
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href={localizedPath("/admin/faqs", locale)}
            icon={<HelpCircle className="h-4 w-4" />}
            label={messages.nav.faqAdmin}
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href={localizedPath("/admin/system-prompts", locale)}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            label={messages.nav.prompts}
            className={navClassName}
          />
        )}
        <Nav
          href={localizedPath("/app/settings", locale)}
          icon={<Settings className="h-4 w-4" />}
          label={messages.nav.settings}
          className={navClassName}
        />
        <span
          className={
            mobile
              ? "break-all px-3 py-2 text-xs text-muted-foreground"
              : "hidden px-2 text-muted-foreground lg:inline"
          }
        >
          {userEmail}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={buttonClassName}
          onClick={() => logout(locale)}
        >
          <LogOut className="h-4 w-4" />
          {messages.common.logout}
        </Button>
        <LocaleSwitcher
          locale={locale}
          label={messages.common.language}
          localeNames={messages.localeNames}
        />
      </>
    );
  }

  return (
    <>
      <Nav
        href={localizedPath("/ai-visibility-checker", locale)}
        label={messages.common.freeAudit}
        className={navClassName}
      />
      <Nav
        href={localizedPath("/pricing", locale)}
        label={messages.common.pricing}
        className={navClassName}
      />
      <Nav
        href={localizedPath("/mcp-access", locale)}
        label={messages.common.mcp}
        className={navClassName}
      />
      <Nav
        href={localizedPath("/faq", locale)}
        label={messages.common.faq}
        className={navClassName}
      />
      <Nav
        href={localizedPath("/blog", locale)}
        label={messages.common.blog}
        className={navClassName}
      />
      <Nav
        href={localizedPath("/contact", locale)}
        label={messages.common.contact}
        className={navClassName}
      />
      <Button asChild size="sm" className={buttonClassName}>
        <a href={localizedPath("/login", locale)}>{messages.common.login}</a>
      </Button>
      <LocaleSwitcher
        locale={locale}
        label={messages.common.language}
        localeNames={messages.localeNames}
      />
    </>
  );
}

async function logout(locale: SupportedLocale) {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => null);
  window.location.href = localizedPath("/login", locale);
}

function Nav({
  href,
  icon,
  label,
  className,
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={[
        "inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-secondary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {label}
    </a>
  );
}
