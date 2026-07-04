import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { FreeAuditForm } from "@/components/free-audit-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
      competitors: String(formData.get("competitors") ?? ""),
      prompts: formData.getAll("prompts").map((prompt) => String(prompt)),
      providers: ["openai"],
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
  searchParams,
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
            Preveri, kako ChatGPT vidi tvojo znamko.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            Brezplačni pregled uporabi 3 do 5 vprašanj, ki jih vneseš sam ali
            jih predlaga Radar. ChatGPT odgovore pretvori v začetno oceno AI
            vidnosti, prikaže omembe znamke, konkurente in vire, v aplikaciji pa
            lahko pozneje spremljaš tudi rezultate iz Gemini, Claude in modelov
            z iskanjem.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Zaženi brezplačen pregled</CardTitle>
          </CardHeader>
          <FreeAuditForm action={startAudit} errorMessage={errorMessage} />
        </Card>
      </section>
    </main>
  );
}

function auditErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("openai_api_key") ||
    lower.includes("openai responses api error") ||
    lower.includes("rate limit") ||
    lower.includes("insufficient_quota")
  ) {
    return "openai";
  }
  if (lower.includes("prompt") || lower.includes("vpra")) {
    return "prompts";
  }
  if (
    lower.includes("prepared statement") ||
    lower.includes("pgbouncer") ||
    lower.includes("supavisor")
  ) {
    return "pooler";
  }
  if (
    lower.includes("does not exist in the current database") ||
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("p2021") ||
    lower.includes("p2022")
  ) {
    return "schema";
  }
  if (
    lower.includes("database_url") ||
    lower.includes("prisma") ||
    lower.includes("p1000") ||
    lower.includes("p1001") ||
    lower.includes("can't reach database") ||
    lower.includes("authentication failed")
  ) {
    return "database";
  }
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "timeout";
  return "unknown";
}

function auditErrorMessage(errorCode: string) {
  switch (errorCode) {
    case "openai":
      return "Pregleda trenutno ni bilo mogoče zagnati, ker OpenAI API ni pravilno nastavljen ali nima dovolj kvote. Na Vercelu preveri OPENAI_API_KEY in po želji OPENAI_MODEL.";
    case "prompts":
      return "Za pregled moraš vnesti vsaj 3 in največ 5 vprašanj, vsako z vsaj 3 znaki.";
    case "database":
      return "Pregleda trenutno ni bilo mogoče zagnati, ker povezava z bazo ali migracije niso pripravljene. Preveri Vercel okoljske spremenljivke in produkcijsko bazo.";
    case "schema":
      return "Pregleda trenutno ni bilo mogoče zagnati, ker produkcijska baza še nima vseh tabel ali stolpcev. Zaženi Prisma db push na Supabase bazo.";
    case "pooler":
      return "Pregleda trenutno ni bilo mogoče zagnati zaradi Supabase pooler povezave. Za DATABASE_URL uporabi POSTGRES_PRISMA_URL oziroma Transaction pooler z nastavljenim pgbouncer=true.";
    case "timeout":
      return "Pregled je trajal predolgo. Poskusi z drugo domeno ali ponovno čez nekaj minut.";
    default:
      return "Pregleda trenutno ni bilo mogoče zagnati. Preveri Vercel Function loge za natančen razlog in poskusi ponovno.";
  }
}
