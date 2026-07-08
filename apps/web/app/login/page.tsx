import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { prisma } from "@ai-radar/db";
import { authenticateUser, safeRedirectPath } from "@/lib/accounts";
import { setUserSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(
    String(formData.get("next") ?? "/app/dashboard"),
  );

  try {
    const user = await authenticateUser(email, password);
    await setUserSession(user.id);
    await prisma.auditLog.create({
      data: { userId: user.id, action: "login" },
    });
  } catch {
    redirect(
      `/login?error=invalid&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    email?: string;
    next?: string;
    reset?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params?.next, "/app/dashboard");
  const { dictionary } = await getI18n();
  const auth = dictionary.auth;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Radar className="h-5 w-5" />
            AI Visibility Radar
          </div>
          <CardTitle>{auth.loginTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.error === "invalid" && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {auth.invalidLogin}
            </div>
          )}
          {params?.reset === "ok" && (
            <div className="mb-4 rounded-md border bg-secondary p-3 text-sm">
              {auth.resetOk}
            </div>
          )}
          <form action={login} className="grid gap-3">
            <input type="hidden" name="next" value={next} />
            <Input
              name="email"
              type="email"
              placeholder="ime@podjetje.si"
              defaultValue={params?.email ?? ""}
              required
            />
            <Input
              name="password"
              type="password"
              placeholder={dictionary.common.password}
              required
            />
            <Button type="submit">{auth.loginTitle}</Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link className="text-primary" href="/forgot-password">
              {auth.forgotPassword}
            </Link>
            <Link
              className="text-primary"
              href={`/signup?next=${encodeURIComponent(next)}`}
            >
              {auth.createAccount}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
