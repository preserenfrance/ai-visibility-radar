import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { FreeAuditForm } from "@/components/free-audit-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";
import { createFreeAudit } from "@/lib/services";

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
      locale: String(formData.get("locale") ?? "sl"),
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
  const { locale, dictionary } = await getI18n();
  const errorCode = (await searchParams)?.error;
  const errorMessage = errorCode
    ? auditErrorMessage(errorCode, dictionary.checker.errors)
    : null;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <Radar className="h-5 w-5" />
            AI Visibility Radar
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            {dictionary.checker.headline}
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            {dictionary.checker.intro}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.checker.title}</CardTitle>
          </CardHeader>
          <FreeAuditForm
            action={startAudit}
            errorMessage={errorMessage}
            locale={locale}
            messages={dictionary.freeAuditForm}
          />
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

type AuditErrorMessages = {
  openai: string;
  prompts: string;
  database: string;
  schema: string;
  pooler: string;
  timeout: string;
  unknown: string;
};

function auditErrorMessage(errorCode: string, messages: AuditErrorMessages) {
  switch (errorCode) {
    case "openai":
      return messages.openai;
    case "prompts":
      return messages.prompts;
    case "database":
      return messages.database;
    case "schema":
      return messages.schema;
    case "pooler":
      return messages.pooler;
    case "timeout":
      return messages.timeout;
    default:
      return messages.unknown;
  }
}
