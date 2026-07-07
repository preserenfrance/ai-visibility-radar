import { redirect } from "next/navigation";
import {
  getEmailPreferencesByToken,
  type EmailPreferenceType,
  unsubscribeByToken,
  updateEmailPreferencesByToken,
} from "@/lib/email-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <CardTitle>Nastavitve e-mail obvestil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {statusMessage(status)}
          {!preferences ? (
            <p className="text-sm text-muted-foreground">
              Povezava za odjavo ni veljavna ali je potekla. Pišite nam na{" "}
              <a className="text-primary" href="mailto:hey@llmvisio.com">
                hey@llmvisio.com
              </a>
              , če želite ročno urediti obvestila.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Nastavitve veljajo za naslov{" "}
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
                    <span className="block font-medium">
                      Obvestila o scanih
                    </span>
                    Prejemanje e-mailov o zaključenih ročnih, scheduled in novih
                    scan rezultatih.
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
                      Marketinška obvestila
                    </span>
                    Novosti, nasveti in občasna vsebinska obvestila o
                    izboljšanju AI vidnosti.
                  </span>
                </label>
                <Button type="submit">Shrani nastavitve</Button>
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

function statusMessage(status: string) {
  switch (status) {
    case "saved":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Nastavitve so shranjene.
        </div>
      );
    case "scans-off":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Odjavljeni ste od e-mail obvestil o scanih.
        </div>
      );
    case "marketing-off":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Odjavljeni ste od marketinških e-mail obvestil.
        </div>
      );
    case "invalid":
      return null;
    default:
      return null;
  }
}
