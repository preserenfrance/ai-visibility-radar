import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { prisma } from "@ai-radar/db";
import { createUserAccount, safeRedirectPath } from "@/lib/accounts";
import { setUserSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

async function signup(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");
  const name = String(formData.get("name") ?? "");
  const organizationName = String(formData.get("organizationName") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? "/app/dashboard"), "/app/dashboard");

  if (password.length < 8) {
    redirect(`/signup?error=short&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }
  if (password !== passwordRepeat) {
    redirect(`/signup?error=mismatch&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  try {
    const user = await createUserAccount({ email, password, name, organizationName });
    await setUserSession(user.id);
    await prisma.auditLog.create({ data: { userId: user.id, action: "login" } });
  } catch {
    redirect(`/signup?error=exists&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; email?: string; next?: string }>;
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
          <CardTitle>Ustvari račun</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {signupError(params.error)}
            </div>
          )}
          <form action={signup} className="grid gap-3">
            <input type="hidden" name="next" value={next} />
            <Input name="email" type="email" placeholder="ime@podjetje.si" defaultValue={params?.email ?? ""} required />
            <Input name="name" placeholder="Ime in priimek" />
            <Input name="organizationName" placeholder="Ime organizacije" />
            <Input name="password" type="password" placeholder="Geslo" required />
            <Input name="passwordRepeat" type="password" placeholder="Ponovi geslo" required />
            <Button type="submit">Ustvari račun</Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Že imaš račun? <Link className="text-primary" href={`/login?next=${encodeURIComponent(next)}`}>Prijava</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function signupError(error: string) {
  switch (error) {
    case "short":
      return "Geslo mora imeti vsaj 8 znakov.";
    case "mismatch":
      return "Gesli se ne ujemata.";
    case "exists":
      return "Račun s tem emailom že obstaja. Poskusi s prijavo ali ponastavitvijo gesla.";
    default:
      return "Računa trenutno ni bilo mogoče ustvariti.";
  }
}
