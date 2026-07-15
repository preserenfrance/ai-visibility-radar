import Link from "next/link";
import { Radar } from "lucide-react";
import type { SupportedLocale } from "@ai-radar/shared";
import { localizedPath } from "@/lib/locale-path";

export function SiteFooter({
  locale,
  messages,
}: {
  locale: SupportedLocale;
  messages: {
    common: {
      freeAudit: string;
      pricing: string;
      mcp: string;
      faq: string;
      blog: string;
      contact: string;
      privacy: string;
      login: string;
    };
    footer: { rights: string };
  };
}) {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Radar className="h-4 w-4 text-primary" />
          AI Visibility Radar
        </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href={localizedPath("/ai-visibility-checker", locale)}
            className="hover:text-foreground"
          >
            {messages.common.freeAudit}
          </Link>
          <Link
            href={localizedPath("/pricing", locale)}
            className="hover:text-foreground"
          >
            {messages.common.pricing}
          </Link>
          <Link
            href={localizedPath("/mcp-access", locale)}
            className="hover:text-foreground"
          >
            {messages.common.mcp}
          </Link>
          <Link
            href={localizedPath("/faq", locale)}
            className="hover:text-foreground"
          >
            {messages.common.faq}
          </Link>
          <Link
            href={localizedPath("/blog", locale)}
            className="hover:text-foreground"
          >
            {messages.common.blog}
          </Link>
          <Link
            href={localizedPath("/contact", locale)}
            className="hover:text-foreground"
          >
            {messages.common.contact}
          </Link>
          <Link
            href={localizedPath("/privacy", locale)}
            className="hover:text-foreground"
          >
            {messages.common.privacy}
          </Link>
          <Link
            href={localizedPath("/login", locale)}
            className="hover:text-foreground"
          >
            {messages.common.login}
          </Link>
        </div>
        <div>&copy; 2026 AI Visibility Radar. {messages.footer.rights}</div>
      </div>
    </footer>
  );
}
