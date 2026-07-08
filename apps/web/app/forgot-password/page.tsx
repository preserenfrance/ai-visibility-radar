import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { requestPasswordReset } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function forgotPassword(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  let result: Awaited<ReturnType<typeof requestPasswordReset>>;

  try {
    result = await requestPasswordReset(email);
  } catch {
    redirect("/forgot-password?error=email");
  }

  if (
    result.skipped &&
    process.env.NODE_ENV !== "production" &&
    result.resetUrl
  ) {
    redirect(
      `/forgot-password?sent=1&dev=${encodeURIComponent(result.resetUrl)}`,
    );
  }
  if (result.skipped && process.env.NODE_ENV === "production") {
    redirect("/forgot-password?error=email");
  }
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ sent?: string; error?: string; dev?: string }>;
}) {
  const params = await searchParams;
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
          <CardTitle>{auth.forgotTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.sent === "1" && (
            <div className="mb-4 rounded-md border bg-secondary p-3 text-sm">
              {auth.forgotSent}
              {params.dev && (
                <div className="mt-2 break-all">
                  {auth.devLink}{" "}
                  <Link className="text-primary" href={params.dev}>
                    {params.dev}
                  </Link>
                </div>
              )}
            </div>
          )}
          {params?.error === "email" && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {auth.emailNotConfigured}
            </div>
          )}
          <form action={forgotPassword} className="grid gap-3">
            <Input
              name="email"
              type="email"
              placeholder="ime@podjetje.si"
              required
            />
            <Button type="submit">{auth.sendResetLink}</Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            {auth.rememberPassword}{" "}
            <Link className="text-primary" href="/login">
              {dictionary.common.backToLogin}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
