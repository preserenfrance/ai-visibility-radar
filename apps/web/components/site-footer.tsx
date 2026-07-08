import Link from "next/link";
import { Radar } from "lucide-react";

export function SiteFooter({
  messages,
}: {
  messages: {
    common: {
      freeAudit: string;
      pricing: string;
      faq: string;
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
          <Link href="/ai-visibility-checker" className="hover:text-foreground">
            {messages.common.freeAudit}
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            {messages.common.pricing}
          </Link>
          <Link href="/faq" className="hover:text-foreground">
            {messages.common.faq}
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            {messages.common.contact}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {messages.common.privacy}
          </Link>
          <Link href="/login" className="hover:text-foreground">
            {messages.common.login}
          </Link>
        </div>
        <div>© 2026 AI Visibility Radar. {messages.footer.rights}</div>
      </div>
    </footer>
  );
}
