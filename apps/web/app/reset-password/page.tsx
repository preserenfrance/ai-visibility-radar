import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { resetPasswordWithToken } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function resetPassword(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");

  if (password.length < 8)
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=short`);
  if (password !== passwordRepeat)
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=mismatch`,
    );

  try {
    await resetPasswordWithToken(token, password);
  } catch {
    redirect("/reset-password?error=invalid");
  }

  redirect("/login?reset=ok");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token ?? "";
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
          <CardTitle>{auth.resetTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {resetError(params.error, auth)}
            </div>
          )}
          {!token ? (
            <p className="text-sm text-muted-foreground">
              {auth.invalidResetLink}{" "}
              <Link className="text-primary" href="/forgot-password">
                {auth.requestNewLink}
              </Link>
              .
            </p>
          ) : (
            <form action={resetPassword} className="grid gap-3">
              <input type="hidden" name="token" value={token} />
              <Input
                name="password"
                type="password"
                placeholder={auth.newPassword}
                required
              />
              <Input
                name="passwordRepeat"
                type="password"
                placeholder={auth.repeatNewPassword}
                required
              />
              <Button type="submit">{auth.saveNewPassword}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function resetError(
  error: string,
  auth: {
    errors: { short: string; mismatch: string };
    resetErrors: { invalid: string; default: string };
  },
) {
  switch (error) {
    case "short":
      return auth.errors.short;
    case "mismatch":
      return auth.errors.mismatch;
    case "invalid":
      return auth.resetErrors.invalid;
    default:
      return auth.resetErrors.default;
  }
}
