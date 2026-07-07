import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { sendEmail } from "@ai-radar/email";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "hey@llmvisio.com";

async function sendContactMessage(formData: FormData) {
  "use server";

  const website = String(formData.get("website") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (website) redirect("/contact?status=sent");
  if (!name || !email || !subject || !message) {
    redirect("/contact?status=missing");
  }

  const emailSubject = `Kontakt LLM Visio: ${subject}`;

  try {
    const result = await sendEmail({
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: emailSubject,
      html: [
        "<p>Prejeto je novo sporočilo prek kontaktnega obrazca.</p>",
        "<table>",
        `<tr><td><strong>Ime</strong></td><td>${escapeHtml(name)}</td></tr>`,
        `<tr><td><strong>E-mail</strong></td><td>${escapeHtml(email)}</td></tr>`,
        `<tr><td><strong>Zadeva</strong></td><td>${escapeHtml(subject)}</td></tr>`,
        "</table>",
        `<p style="white-space:pre-wrap;">${escapeHtml(message)}</p>`,
      ].join(""),
      text: [
        "Novo sporočilo prek kontaktnega obrazca.",
        `Ime: ${name}`,
        `E-mail: ${email}`,
        `Zadeva: ${subject}`,
        "",
        message,
      ].join("\n"),
    });
    await recordContactEmailEvent({
      type: result.skipped ? "queued" : "sent",
      providerId: result.id,
      subject: emailSubject,
    });
  } catch (error) {
    await recordContactEmailEvent({
      type: "failed",
      subject: emailSubject,
      error,
    });
    redirect("/contact?status=failed");
  }

  redirect("/contact?status=sent");
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="pt-2">
        <p className="text-sm font-semibold text-primary">Kontakt</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">
          Pišite nam
        </h1>
        <p className="mt-4 text-muted-foreground">
          Za vprašanja o AI Visibility Radarju, paketih, poročilih ali podpori
          smo dosegljivi na{" "}
          <a className="text-primary" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Kontaktni obrazec</CardTitle>
        </CardHeader>
        <CardContent>
          {statusAlert(params?.status)}
          <form action={sendContactMessage} className="mt-4 grid gap-4">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
            />
            <Input name="name" placeholder="Ime in priimek" required />
            <Input
              name="email"
              type="email"
              placeholder="ime@podjetje.si"
              required
            />
            <Input name="subject" placeholder="Zadeva" required />
            <Textarea
              name="message"
              placeholder="Kako vam lahko pomagamo?"
              rows={7}
              required
            />
            <Button type="submit">Pošlji sporočilo</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

async function recordContactEmailEvent(input: {
  type: "queued" | "sent" | "failed";
  providerId?: string;
  subject: string;
  error?: unknown;
}) {
  try {
    await prisma.emailEvent.create({
      data: {
        type: input.type,
        provider: "resend",
        providerId: input.providerId,
        subject: input.subject,
        errorMessage: input.error ? errorMessage(input.error) : undefined,
      },
    });
  } catch (error) {
    console.warn("Contact email event logging failed", error);
  }
}

function statusAlert(status?: string) {
  switch (status) {
    case "sent":
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Sporočilo je poslano. Odgovorimo čim prej.
        </div>
      );
    case "missing":
      return (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Izpolnite vsa obvezna polja.
        </div>
      );
    case "failed":
      return (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Sporočila trenutno ni bilo mogoče poslati. Lahko nam pišete neposredno
          na hey@llmvisio.com.
        </div>
      );
    default:
      return null;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
