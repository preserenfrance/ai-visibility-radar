import { redirect } from "next/navigation";
import { ArrowRight, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFreeAudit } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function startAudit(formData: FormData) {
  "use server";
  let leadId: string | undefined;

  try {
    const lead = await createFreeAudit({
      domain: String(formData.get("domain") ?? ""),
      brandName: String(formData.get("brandName") ?? ""),
      email: String(formData.get("email") ?? ""),
      country: String(formData.get("country") ?? "Slovenija"),
      language: String(formData.get("language") ?? "sl"),
      competitors: String(formData.get("competitors") ?? "")
    });
    leadId = lead?.id;
  } catch (error) {
    console.error("Free audit failed", error);
    redirect(`/ai-visibility-checker?error=${auditErrorCode(error)}`);
  }

  if (!leadId) redirect("/ai-visibility-checker?error=unknown");
  redirect(`/audit/${leadId}`);
}

export default async function CheckerPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const errorCode = (await searchParams)?.error;
  const errorMessage = errorCode ? auditErrorMessage(errorCode) : null;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <Radar className="h-5 w-5" />
            AI Visibility Radar
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Preveri, ali te ChatGPT, Gemini in Claude priporočajo.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            Brezplačni audit ustvari lead, pregleda do 10 strani, generira 5 promptov in pokaže začetni rezultat.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Zaženi brezplačen audit</CardTitle>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <form action={startAudit} className="grid gap-3">
              <Input name="domain" placeholder="domain.com" required />
              <Input name="brandName" placeholder="Ime znamke" required />
              <Input name="email" type="email" placeholder="ime@podjetje.si" required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="country" defaultValue="Slovenija" />
                <Input name="language" defaultValue="sl" />
              </div>
              <Input name="competitors" placeholder="Konkurent A, Konkurent B" />
              <Button type="submit">
                Zaženi brezplačen audit <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function auditErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("DATABASE_URL") || message.includes("Prisma")) return "database";
  if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("timed out")) return "timeout";
  return "unknown";
}

function auditErrorMessage(errorCode: string) {
  switch (errorCode) {
    case "database":
      return "Audita trenutno ni bilo mogoče zagnati, ker povezava z bazo ali migracije niso pripravljene. Preveri Vercel okoljske spremenljivke in produkcijsko bazo.";
    case "timeout":
      return "Audit je trajal predolgo. Poskusi z drugo domeno ali ponovno čez nekaj minut.";
    default:
      return "Audita trenutno ni bilo mogoče zagnati. Preveri Vercel Function loge za natančen razlog in poskusi ponovno.";
  }
}
