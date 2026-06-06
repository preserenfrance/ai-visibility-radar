import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Building2, ClipboardList, Radar, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearUserSession, getCurrentUser, isAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await clearUserSession();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const admin = isAdminUser(user);
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link href="/app/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <Radar className="h-5 w-5 text-primary" />
            AI Visibility Radar
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Nav href="/app/dashboard" icon={<BarChart3 className="h-4 w-4" />} label="Pregled" />
            <Nav href="/app/onboarding" icon={<Building2 className="h-4 w-4" />} label="Dodaj znamko" />
            {admin && <Nav href="/admin/leads" icon={<ClipboardList className="h-4 w-4" />} label="Admin" />}
            <Nav href="/app/settings" icon={<Settings className="h-4 w-4" />} label="Nastavitve" />
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden text-sm text-muted-foreground sm:block">{user?.email ?? "Niste prijavljeni"}</div>
            {user && (
              <form action={logout}>
                <Button type="submit" variant="ghost" size="sm">Odjava</Button>
              </form>
            )}
          </div>
        </div>
      </div>
      {children}
    </main>
  );
}

function Nav({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-secondary">
      {icon}
      {label}
    </Link>
  );
}
