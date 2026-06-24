import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  DollarSign,
  HelpCircle,
  LogOut,
  Menu,
  Radar,
  SearchCheck,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearUserSession, getCurrentUser, isAdminUser } from "@/lib/auth";

async function logout() {
  "use server";
  await clearUserSession();
  redirect("/login");
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const admin = isAdminUser(user);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-sm font-semibold"
        >
          <Radar className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate">AI Visibility Radar</span>
        </Link>
        <nav className="site-header-desktop-nav hidden flex-wrap items-center justify-end gap-1 text-sm md:flex">
          <HeaderNavContent userEmail={user?.email} admin={admin} />
        </nav>
        <details className="site-header-mobile-menu group md:hidden">
          <summary
            aria-label="Odpri meni"
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border bg-white text-foreground transition hover:bg-secondary [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" />
          </summary>
          <nav className="absolute right-5 top-[calc(100%+0.5rem)] z-50 grid w-[min(calc(100vw-2.5rem),22rem)] gap-1 rounded-lg border bg-white p-2 text-sm shadow-lg">
            <HeaderNavContent userEmail={user?.email} admin={admin} mobile />
          </nav>
        </details>
      </div>
    </header>
  );
}

function HeaderNavContent({
  userEmail,
  admin,
  mobile = false,
}: {
  userEmail?: string;
  admin: boolean;
  mobile?: boolean;
}) {
  const navClassName = mobile ? "w-full justify-start" : undefined;
  const buttonClassName = mobile ? "w-full justify-start" : undefined;

  if (userEmail) {
    return (
      <>
        <Nav
          href="/app/dashboard"
          icon={<BarChart3 className="h-4 w-4" />}
          label="Moje znamke"
          className={navClassName}
        />
        <Nav
          href="/ai-visibility-checker"
          icon={<SearchCheck className="h-4 w-4" />}
          label="Nova znamka"
          className={navClassName}
        />
        <Nav
          href="/faq"
          icon={<HelpCircle className="h-4 w-4" />}
          label="FAQ"
          className={navClassName}
        />
        {admin && (
          <Nav
            href="/admin/leads"
            icon={<ClipboardList className="h-4 w-4" />}
            label="Admin"
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href="/admin/users"
            icon={<Users className="h-4 w-4" />}
            label="Uporabniki"
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href="/admin/llm-costs"
            icon={<DollarSign className="h-4 w-4" />}
            label="Analitika"
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href="/admin/faqs"
            icon={<HelpCircle className="h-4 w-4" />}
            label="FAQ admin"
            className={navClassName}
          />
        )}
        {admin && (
          <Nav
            href="/admin/system-prompts"
            icon={<SlidersHorizontal className="h-4 w-4" />}
            label="Prompti"
            className={navClassName}
          />
        )}
        <Nav
          href="/app/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Nastavitve"
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
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className={buttonClassName}
          >
            <LogOut className="h-4 w-4" />
            Odjava
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Nav
        href="/ai-visibility-checker"
        label="Brezplačen audit"
        className={navClassName}
      />
      <Nav href="/pricing" label="Cenik" className={navClassName} />
      <Nav href="/faq" label="FAQ" className={navClassName} />
      <Button asChild size="sm" className={buttonClassName}>
        <Link href="/login">Vstop</Link>
      </Button>
    </>
  );
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
    <Link
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
    </Link>
  );
}
