import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Activity, LockKeyhole, UserPlus } from "lucide-react";
import { normalizeEmail } from "@/lib/accounts";
import { getCurrentUser, setUserSession } from "@/lib/auth";
import {
  emailConsentData,
  ensureEmailPreferencesToken,
} from "@/lib/email-preferences";
import { triggerUserRegisteredWebhook } from "@/lib/make-webhooks";
import { hashPassword } from "@/lib/password";
import { AutoRefresh } from "@/components/auto-refresh";
import { ScanRunner } from "@/components/scan-runner";
import { PasswordInput } from "@/components/password-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type ClaimableLead = {
  id: string;
  organizationId: string | null;
  auditScanRunId: string | null;
  companyName: string | null;
  brandName: string;
};

async function ensureLeadMembership(lead: ClaimableLead, userId: string) {
  let organizationId = lead.organizationId;

  if (!organizationId && lead.auditScanRunId) {
    const scan = await prisma.scanRun.findUnique({
      where: { id: lead.auditScanRunId },
      select: { brand: { select: { organizationId: true } } },
    });
    organizationId = scan?.brand.organizationId ?? null;
  }

  if (!organizationId) {
    organizationId = (
      await prisma.organization.create({
        data: {
          name: lead.companyName || lead.brandName || "Moja organizacija",
        },
      })
    ).id;
  }

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: { role: "owner" },
    create: {
      userId,
      organizationId,
      role: "owner",
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      organizationId,
      status: "converted",
    },
  });

  return organizationId;
}

async function createAuditAccount(formData: FormData) {
  "use server";

  const leadId = String(formData.get("leadId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");
  const marketingEmailConsent = formData.get("marketingEmailConsent") === "on";
  const scanEmailConsent = formData.get("scanEmailConsent") === "on";

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { auditScanRun: true, organization: true },
  });
  if (!lead) redirect("/ai-visibility-checker?error=unknown");

  if (password.length < 8) {
    redirect(`/audit/${leadId}?accountError=short`);
  }
  if (password !== passwordRepeat) {
    redirect(`/audit/${leadId}?accountError=mismatch`);
  }

  const email = normalizeEmail(lead.email);
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.passwordHash) {
    redirect(`/audit/${leadId}?accountError=exists`);
  }

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: name || existingUser.name,
          passwordHash: await hashPassword(password),
          ...emailConsentData(
            { marketingEmailConsent, scanEmailConsent },
            existingUser,
          ),
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: name || undefined,
          passwordHash: await hashPassword(password),
          ...emailConsentData({ marketingEmailConsent, scanEmailConsent }),
        },
      });

  const organizationId = await ensureLeadMembership(lead, user.id);
  await ensureEmailPreferencesToken(user.id);
  const registeredUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      memberships: {
        where: { organizationId },
        include: { organization: true },
      },
    },
  });
  await triggerUserRegisteredWebhook({
    source: "free_audit",
    user: registeredUser,
    organization: registeredUser.memberships[0]?.organization ?? null,
  });
  await setUserSession(user.id);
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      organizationId,
      action: "login",
    },
  });

  redirect(monitoringPathForLead(lead));
}

async function openMonitoring(formData: FormData) {
  "use server";

  const leadId = String(formData.get("leadId") ?? "");
  const next = `/audit/${leadId}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { auditScanRun: true },
  });
  if (!lead) redirect("/ai-visibility-checker?error=unknown");

  const hasMembership = Boolean(
    lead.organizationId &&
    user.memberships.some(
      (membership) => membership.organizationId === lead.organizationId,
    ),
  );
  const emailMatches =
    normalizeEmail(user.email) === normalizeEmail(lead.email);

  if (!hasMembership) {
    if (!emailMatches) redirect(next);
    await ensureLeadMembership(lead, user.id);
  }

  redirect(monitoringPathForLead({ auditScanRun: lead.auditScanRun }));
}

function monitoringPathForLead(lead: {
  auditScanRun?: { brandId: string; id?: string } | null;
}) {
  const scanId = lead.auditScanRun?.id;
  const brandId = lead.auditScanRun?.brandId;
  if (brandId && scanId) return `/app/brands/${brandId}/scans/${scanId}`;
  return brandId ? `/app/brands/${brandId}` : "/app/dashboard";
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ accountError?: string }>;
}) {
  const { id } = await params;
  const [lead, user, query] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        auditScanRun: {
          include: {
            scoreSnapshot: true,
            recommendations: true,
            promptRuns: {
              include: {
                prompt: true,
                engine: true,
                aiResponse: { include: { parsedResult: true } },
              },
              take: 15,
            },
          },
        },
      },
    }),
    getCurrentUser(),
    searchParams,
  ]);

  if (!lead) return <main className="p-8">Audit ni najden.</main>;
  const score = lead.auditScanRun?.scoreSnapshot;
  const reportPending =
    !score ||
    lead.auditScanRun?.status === "queued" ||
    lead.auditScanRun?.status === "running";
  const runFromBrowser =
    reportPending && lead.auditScanRunId && !process.env.REDIS_URL;
  const hasLeadMembership = Boolean(
    user &&
    lead.organizationId &&
    user.memberships.some(
      (membership) => membership.organizationId === lead.organizationId,
    ),
  );
  const emailMatchesLead = Boolean(
    user && normalizeEmail(user.email) === normalizeEmail(lead.email),
  );
  const canViewResult = Boolean(
    user && (emailMatchesLead || hasLeadMembership),
  );

  if (canViewResult && lead.auditScanRun) {
    if (user && emailMatchesLead && !hasLeadMembership) {
      await ensureLeadMembership(lead, user.id);
    }
    redirect(monitoringPathForLead({ auditScanRun: lead.auditScanRun }));
  }

  if (!canViewResult) {
    return (
      <AuditAccountGate
        lead={lead}
        reportPending={reportPending}
        runFromBrowser={Boolean(runFromBrowser)}
        accountError={query?.accountError}
      />
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      {reportPending &&
        (runFromBrowser ? (
          <ScanRunner endpoint={`/api/public/audit/${lead.id}/run-next`} />
        ) : (
          <AutoRefresh />
        ))}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="secondary">Brezplačen audit</Badge>
          <h1 className="mt-3 text-3xl font-semibold">{lead.brandName}</h1>
          <p className="text-muted-foreground">{lead.domain}</p>
        </div>
        <form action={openMonitoring}>
          <input type="hidden" name="leadId" value={lead.id} />
          <Button type="submit">Odpri celoten monitoring</Button>
        </form>
      </div>
      {reportPending && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 animate-pulse text-primary" />
              Pripravljamo prvi report
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Audit teče v ozadju: pošiljamo tvoje prompte na izbrane AI modele in
            računamo rezultat. Stran se bo samodejno osvežila.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="AI Visibility Score"
          value={score?.visibilityScore ?? 0}
        />
        <Metric label="Delež omemb" value={score?.mentionScore ?? 0} />
        <Metric label="Ocena citatov" value={score?.citationScore ?? 0} />
        <Metric label="Ocena točnosti" value={score?.accuracyScore ?? 0} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Primeri promptov</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Prompt</TH>
                  <TH>AI model</TH>
                  <TH>Omenjeno</TH>
                  <TH>Rang</TH>
                </TR>
              </THead>
              <TBody>
                {lead.auditScanRun?.promptRuns.slice(0, 3).map((run) => {
                  const parsed = run.aiResponse?.parsedResult
                    ?.parsedJson as any;
                  return (
                    <TR key={run.id}>
                      <TD>{run.prompt.text}</TD>
                      <TD>{run.engine.engineName}</TD>
                      <TD>{parsed?.brandMentioned ? "Da" : "Ne"}</TD>
                      <TD>{parsed?.brandRank ?? "-"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Priporočene naloge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.auditScanRun?.recommendations.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="font-medium">{item.title}</div>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function AuditAccountGate({
  lead,
  reportPending,
  runFromBrowser,
  accountError,
}: {
  lead: {
    id: string;
    email: string;
    brandName: string;
    domain: string;
  };
  reportPending: boolean;
  runFromBrowser: boolean;
  accountError?: string;
}) {
  const next = `/audit/${lead.id}`;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-10">
      {runFromBrowser && (
        <ScanRunner
          endpoint={`/api/public/audit/${lead.id}/run-next`}
          refreshOnStep={false}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_32%)]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-center">
          <Badge className="mb-4 w-fit" variant="secondary">
            Brezplačen audit
          </Badge>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {reportPending
              ? "Pregledujemo tvoje prompte."
              : "Tvoj rezultat je pripravljen."}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Za ogled rezultatov najprej ustvari račun. Tako rezultat povežemo s
            tvojo organizacijo in ga lahko varno pokažemo samo tebi.
          </p>
          <div className="mt-6 rounded-md border bg-white/80 p-4 text-sm shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <Activity className="h-4 w-4 animate-pulse text-primary" />
              {reportPending ? "Audit še teče v ozadju" : "Audit je zaključen"}
            </div>
            <p className="mt-2 text-muted-foreground">
              {lead.brandName} · {lead.domain}
            </p>
          </div>
        </section>

        <Card className="w-full shadow-lg">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <CardTitle>Ustvari račun za ogled rezultata</CardTitle>
          </CardHeader>
          <CardContent>
            {accountError && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {accountGateError(accountError)}
              </div>
            )}
            <form action={createAuditAccount} className="grid gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <Input name="email" type="email" value={lead.email} readOnly />
              <Input name="name" placeholder="Ime in priimek" />
              <PasswordInput
                name="password"
                placeholder="Geslo"
                minLength={8}
                aria-describedby="audit-password-help"
                required
              />
              <p
                id="audit-password-help"
                className="-mt-2 text-xs text-muted-foreground"
              >
                Geslo mora vsebovati vsaj 8 znakov. Posebni znaki niso obvezni.
              </p>
              <PasswordInput
                name="passwordRepeat"
                placeholder="Ponovi geslo"
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
                <span>
                  Želim prejemati e-mail obvestila o zaključenih scanih in novih
                  rezultatih.
                </span>
              </label>
              <label className="flex gap-2 rounded-md border bg-secondary/40 p-3 text-sm">
                <input
                  name="marketingEmailConsent"
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                />
                <span>
                  Strinjam se s prejemanjem marketinških obvestil, novosti in
                  nasvetov za izboljšanje AI vidnosti.
                </span>
              </label>
              <Button type="submit">
                <UserPlus className="h-4 w-4" />
                Ustvari račun in pokaži rezultat
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Že imaš račun?{" "}
              <Link
                className="text-primary"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                Prijavi se za ogled rezultata
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function accountGateError(error: string) {
  switch (error) {
    case "short":
      return "Geslo mora imeti vsaj 8 znakov.";
    case "mismatch":
      return "Gesli se ne ujemata.";
    case "exists":
      return "Račun s tem emailom že obstaja. Prijavi se in rezultat se bo odklenil.";
    default:
      return "Računa trenutno ni bilo mogoče ustvariti. Poskusi ponovno.";
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}/100</div>
      </CardContent>
    </Card>
  );
}
