import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  DollarSign,
  HelpCircle,
  LogOut,
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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href={user ? "/app/dashboard" : "/"}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Radar className="h-5 w-5 text-primary" />
          AI Visibility Radar
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
          {user ? (
            <>
              <Nav
                href="/app/dashboard"
                icon={<BarChart3 className="h-4 w-4" />}
                label="Moje znamke"
              />
              <Nav
                href="/ai-visibility-checker"
                icon={<SearchCheck className="h-4 w-4" />}
                label="Nova znamka"
              />
              <Nav
                href="/faq"
                icon={<HelpCircle className="h-4 w-4" />}
                label="FAQ"
              />
              {admin && (
                <Nav
                  href="/admin/leads"
                  icon={<ClipboardList className="h-4 w-4" />}
                  label="Admin"
                />
              )}
              {admin && (
                <Nav
                  href="/admin/users"
                  icon={<Users className="h-4 w-4" />}
                  label="Uporabniki"
                />
              )}
              {admin && (
                <Nav
                  href="/admin/llm-costs"
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Stroški"
                />
              )}
              {admin && (
                <Nav
                  href="/admin/system-prompts"
                  icon={<SlidersHorizontal className="h-4 w-4" />}
                  label="Prompti"
                />
              )}
              <Nav
                href="/app/settings"
                icon={<Settings className="h-4 w-4" />}
                label="Nastavitve"
              />
              <span className="hidden px-2 text-muted-foreground lg:inline">
                {user.email}
              </span>
              <form action={logout}>
                <Button type="submit" variant="ghost" size="sm">
                  <LogOut className="h-4 w-4" />
                  Odjava
                </Button>
              </form>
            </>
          ) : (
            <>
              <Nav href="/ai-visibility-checker" label="Brezplačen audit" />
              <Nav href="/pricing" label="Cenik" />
              <Nav href="/faq" label="FAQ" />
              <Button asChild size="sm">
                <Link href="/login">Vstop</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Nav({
  href,
  icon,
  label,
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-secondary"
    >
      {icon}
      {label}
    </Link>
  );
}
