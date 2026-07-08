import { redirect } from "next/navigation";
import {
  getEmailPreferencesByToken,
  type EmailPreferenceType,
  unsubscribeByToken,
  updateEmailPreferencesByToken,
} from "@/lib/email-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";

const unsubscribeCopy = {
  sl: {
    title: "Nastavitve e-mail obvestil",
    invalid: "Povezava za odjavo ni veljavna ali je potekla. Pišite nam na",
    invalidSuffix: ", če želite ročno urediti obvestila.",
    appliesTo: "Nastavitve veljajo za naslov",
    scanTitle: "Obvestila o scanih",
    scanText:
      "Prejemanje e-mailov o zaključenih ročnih, scheduled in novih scan rezultatih.",
    marketingTitle: "Marketinška obvestila",
    marketingText:
      "Novosti, nasveti in občasna vsebinska obvestila o izboljšanju AI vidnosti.",
    save: "Shrani nastavitve",
    status: {
      saved: "Nastavitve so shranjene.",
      scansOff: "Odjavljeni ste od e-mail obvestil o scanih.",
      marketingOff: "Odjavljeni ste od marketinških e-mail obvestil.",
    },
  },
  en: {
    title: "Email notification settings",
    invalid: "The unsubscribe link is invalid or has expired. Email us at",
    invalidSuffix: " if you want to update notifications manually.",
    appliesTo: "These settings apply to",
    scanTitle: "Scan notifications",
    scanText:
      "Receive emails about completed manual, scheduled and new scan results.",
    marketingTitle: "Marketing emails",
    marketingText:
      "Product news, tips and occasional content about improving AI visibility.",
    save: "Save settings",
    status: {
      saved: "Settings saved.",
      scansOff: "You are unsubscribed from scan notification emails.",
      marketingOff: "You are unsubscribed from marketing emails.",
    },
  },
} as const;

export const dynamic = "force-dynamic";

async function savePreferences(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const marketingEmailConsent = formData.get("marketingEmailConsent") === "on";
  const scanEmailConsent = formData.get("scanEmailConsent") === "on";

  if (!token) redirect("/unsubscribe?status=invalid");

  try {
    await updateEmailPreferencesByToken(token, {
      marketingEmailConsent,
      scanEmailConsent,
    });
  } catch {
    redirect("/unsubscribe?status=invalid");
  }

  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&status=saved`);
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{
    token?: string;
    type?: EmailPreferenceType;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const { locale } = await getI18n();
  const copy = unsubscribeCopy[locale];
  const token = params?.token ?? "";
  const requestedType = isPreferenceType(params?.type) ? params?.type : null;
  let preferences = token ? await getEmailPreferencesByToken(token) : null;
  let status = params?.status ?? "";

  if (token && preferences && requestedType) {
    try {
      preferences = await unsubscribeByToken(token, requestedType);
      status = requestedType === "marketing" ? "marketing-off" : "scans-off";
    } catch {
      preferences = null;
      status = "invalid";
    }
  }

  return (
    <main className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center px-5 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {statusMessage(status, copy.status)}
          {!preferences ? (
            <p className="text-sm text-muted-foreground">
              {copy.invalid}{" "}
              <a className="text-primary" href="mailto:hey@llmvisio.com">
                hey@llmvisio.com
              </a>
              {copy.invalidSuffix}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {copy.appliesTo}{" "}
                <span className="font-medium text-foreground">
                  {preferences.email}
                </span>
                .
              </p>
              <form action={savePreferences} className="grid gap-4">
                <input type="hidden" name="token" value={token} />
                <label className="flex gap-3 rounded-md border bg-secondary/40 p-4 text-sm">
                  <input
                    name="scanEmailConsent"
                    type="checkbox"
                    defaultChecked={preferences.scanEmailConsent}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block font-medium">{copy.scanTitle}</span>
                    {copy.scanText}
                  </span>
                </label>
                <label className="flex gap-3 rounded-md border bg-secondary/40 p-4 text-sm">
                  <input
                    name="marketingEmailConsent"
                    type="checkbox"
                    defaultChecked={preferences.marketingEmailConsent}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block font-medium">
                      {copy.marketingTitle}
                    </span>
                    {copy.marketingText}
                  </span>
                </label>
                <Button type="submit">{copy.save}</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function isPreferenceType(value: unknown): value is EmailPreferenceType {
  return value === "marketing" || value === "scans";
}

function statusMessage(
  status: string,
  messages: {
    saved: string;
    scansOff: string;
    marketingOff: string;
  },
) {
  switch (status) {
    case "saved":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {messages.saved}
        </div>
      );
    case "scans-off":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {messages.scansOff}
        </div>
      );
    case "marketing-off":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {messages.marketingOff}
        </div>
      );
    case "invalid":
      return null;
    default:
      return null;
  }
}
