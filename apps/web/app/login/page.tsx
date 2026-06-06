import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { prisma } from "@ai-radar/db";
import { authenticateUser, safeRedirectPath } from "@/lib/accounts";
import { setUserSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? "/app/dashboard"));

  try {
    const user = await authenticateUser(email, password);
    await setUserSession(user.id);
    await prisma.auditLog.create({ data: { userId: user.id, action: "login" } });
  } catch {
    redirect(`/login?error=invalid&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; email?: string; next?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params?.next, "/app/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Radar className="h-5 w-5" />
            AI Visibility Radar
          </div>
          <CardTitle>Prijava</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.error === "invalid" && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Email ali geslo ni pravilno.
            </div>
          )}
          {params?.reset === "ok" && (
            <div className="mb-4 rounded-md border bg-secondary p-3 text-sm">
              Geslo je bilo uspešno spremenjeno. Zdaj se lahko prijaviš.
            </div>
          )}
          <form action={login} className="grid gap-3">
            <input type="hidden" name="next" value={next} />
            <Input name="email" type="email" placeholder="ime@podjetje.si" defaultValue={params?.email ?? ""} required />
            <Input name="password" type="password" placeholder="Geslo" required />
            <Button type="submit">Prijava</Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link className="text-primary" href="/forgot-password">Pozabljeno geslo?</Link>
            <Link className="text-primary" href={`/signup?next=${encodeURIComponent(next)}`}>Ustvari račun</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
