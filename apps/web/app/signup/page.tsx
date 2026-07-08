import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { prisma } from "@ai-radar/db";
import { createUserAccount, safeRedirectPath } from "@/lib/accounts";
import { setUserSession } from "@/lib/auth";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function signup(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");
  const name = String(formData.get("name") ?? "");
  const organizationName = String(formData.get("organizationName") ?? "");
  const locale = String(formData.get("locale") ?? "sl");
  const marketingEmailConsent = formData.get("marketingEmailConsent") === "on";
  const scanEmailConsent = formData.get("scanEmailConsent") === "on";
  const next = safeRedirectPath(
    String(formData.get("next") ?? "/app/dashboard"),
    "/app/dashboard",
  );

  if (password.length < 8) {
    redirect(
      `/signup?error=short&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }
  if (password !== passwordRepeat) {
    redirect(
      `/signup?error=mismatch&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }

  try {
    const user = await createUserAccount({
      email,
      password,
      name,
      organizationName,
      locale,
      marketingEmailConsent,
      scanEmailConsent,
      source: "signup",
    });
    await setUserSession(user.id);
    await prisma.auditLog.create({
      data: { userId: user.id, action: "login" },
    });
  } catch {
    redirect(
      `/signup?error=exists&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params?.next, "/app/dashboard");
  const { locale, dictionary } = await getI18n();
  const auth = dictionary.auth;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Radar className="h-5 w-5" />
            AI Visibility Radar
          </div>
          <CardTitle>{auth.signupTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {signupError(params.error, auth.errors)}
            </div>
          )}
          <form action={signup} className="grid gap-3">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="locale" value={locale} />
            <Input
              name="email"
              type="email"
              placeholder="ime@podjetje.si"
              defaultValue={params?.email ?? ""}
              required
            />
            <Input name="name" placeholder={auth.namePlaceholder} />
            <Input
              name="organizationName"
              placeholder={auth.organizationPlaceholder}
            />
            <PasswordInput
              name="password"
              placeholder={dictionary.common.password}
              minLength={8}
              aria-describedby="signup-password-help"
              required
            />
            <p
              id="signup-password-help"
              className="-mt-2 text-xs text-muted-foreground"
            >
              {auth.passwordHelp}
            </p>
            <PasswordInput
              name="passwordRepeat"
              placeholder={auth.repeatPassword}
              minLength={8}
              required
            />
            <label className="flex gap-2 rounded-md border bg-secondary/40 p-3 text-sm">
              <input
                name="scanEmailConsent"
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4"
              />
              <span>{auth.scanConsent}</span>
            </label>
            <label className="flex gap-2 rounded-md border bg-secondary/40 p-3 text-sm">
              <input
                name="marketingEmailConsent"
                type="checkbox"
                className="mt-1 h-4 w-4"
              />
              <span>{auth.marketingConsent}</span>
            </label>
            <Button type="submit">{auth.createAccount}</Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            {auth.alreadyHaveAccount}{" "}
            <Link
              className="text-primary"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              {auth.signupLink}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function signupError(
  error: string,
  messages: {
    short: string;
    mismatch: string;
    exists: string;
    signupDefault: string;
  },
) {
  switch (error) {
    case "short":
      return messages.short;
    case "mismatch":
      return messages.mismatch;
    case "exists":
      return messages.exists;
    default:
      return messages.signupDefault;
  }
}
