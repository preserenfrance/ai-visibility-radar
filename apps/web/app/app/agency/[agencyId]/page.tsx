import { notFound, redirect } from "next/navigation";
import type React from "react";
import {
  Building2,
  ExternalLink,
  Gauge,
  Link2,
  Palette,
  Plus,
  Settings2,
  Target,
  Users,
} from "lucide-react";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireCurrentUser } from "@/lib/auth";
import {
  AGENCY_MANAGER_ROLES,
  normalizeHexColor,
  normalizeOptionalText,
  requireAgencyMembership,
} from "@/lib/agency";
import { effectivePlanForOrganization } from "@/lib/billing";
import { getBrandOnboardingSummary } from "@/lib/onboarding";
import {
  generateBrandChatGptInsightsSafely,
  recurringScanActivationData,
} from "@/lib/services";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function updateAgencyBranding(formData: FormData) {
  "use server";

  const { agencyId } = await requireAgencyManagerFromForm(formData);
  const name = String(formData.get("name") ?? "").trim();
  const productName = String(formData.get("productName") ?? "").trim();
  if (name.length < 2 || productName.length < 2) {
    throw new Error("Bad Request: name and product name are required");
  }

  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      name,
      productName,
      logoUrl: normalizeOptionalText(formData.get("logoUrl")),
      primaryColor: normalizeHexColor(formData.get("primaryColor"), "#2563eb"),
      accentColor: normalizeHexColor(formData.get("accentColor"), "#0f766e"),
      customDomain: normalizeDomainLike(formData.get("customDomain")),
      supportEmail: normalizeOptionalText(formData.get("supportEmail")),
      senderName: normalizeOptionalText(formData.get("senderName")),
      senderEmail: normalizeOptionalText(formData.get("senderEmail")),
      reportFooter: normalizeOptionalText(formData.get("reportFooter")),
    },
  });

  redirect(`/app/agency/${agencyId}?saved=branding`);
}

async function createAgencyClient(formData: FormData) {
  "use server";

  const { agencyId } = await requireAgencyManagerFromForm(formData);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Bad Request: client name required");

  const clientOwnerEmail = normalizeOptionalText(
    formData.get("clientOwnerEmail"),
  )?.toLowerCase();
  const clientOwner = clientOwnerEmail
    ? await prisma.user.findUnique({ where: { email: clientOwnerEmail } })
    : null;

  await prisma.organization.create({
    data: {
      name,
      agencyId,
      agencyClientCode: normalizeOptionalText(formData.get("agencyClientCode")),
      memberships: clientOwner
        ? {
            create: {
              userId: clientOwner.id,
              role: "member",
            },
          }
        : undefined,
    },
  });

  redirect(`/app/agency/${agencyId}?saved=client`);
}

async function attachClientOrganization(formData: FormData) {
  "use server";

  const { agencyId, user } = await requireAgencyManagerFromForm(formData);
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Bad Request: organization required");

  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      agencyId: null,
      memberships: {
        some: {
          userId: user.id,
          role: { in: ["owner", "admin"] },
        },
      },
    },
    select: { id: true },
  });
  if (!organization) {
    throw new Error("Forbidden: organization owner/admin access required");
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      agencyId,
      agencyClientCode: normalizeOptionalText(formData.get("agencyClientCode")),
    },
  });

  redirect(`/app/agency/${agencyId}?saved=attached`);
}

async function createAgencyClientBrand(formData: FormData) {
  "use server";

  const { agencyId, user } = await requireAgencyManagerFromForm(formData);
  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  if (!organizationId || name.length < 1 || domain.length < 3) {
    throw new Error("Bad Request: client, brand and domain are required");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, agencyId },
    include: { _count: { select: { brands: true } } },
  });
  if (!organization) throw new Error("Forbidden: agency client required");

  const effectivePlan = effectivePlanForOrganization(organization);
  const brandLimit = PLAN_LIMITS[effectivePlan].brandCount;
  if (organization._count.brands >= brandLimit) {
    throw new Error(
      `Bad Request: this plan allows up to ${brandLimit} brands.`,
    );
  }

  const normalizedDomain = normalizeDomain(domain);
  const country = normalizeOptionalText(formData.get("country")) ?? "Slovenia";
  const language = normalizeOptionalText(formData.get("language")) ?? "sl";
  const description = normalizeOptionalText(formData.get("description"));
  const industry = normalizeOptionalText(formData.get("industry"));
  const chatGptInsights = await generateBrandChatGptInsightsSafely({
    name,
    domain: normalizedDomain,
    description,
    industry,
    country,
    language,
  });
  const recurringScanData = recurringScanActivationData(organization.plan);

  const brand = await prisma.brand.create({
    data: {
      organizationId,
      name,
      domain: normalizedDomain,
      description,
      chatGptBrandSummary: chatGptInsights.brandSummary,
      chatGptBrandSummaryUpdatedAt: chatGptInsights.brandSummary
        ? new Date()
        : undefined,
      chatGptCustomerConcernsSummary: chatGptInsights.customerConcernsSummary,
      chatGptCustomerConcernsSummaryUpdatedAt:
        chatGptInsights.customerConcernsSummary ? new Date() : undefined,
      chatGptProductSummary: chatGptInsights.productSummary,
      chatGptProductSummaryUpdatedAt: chatGptInsights.productSummary
        ? new Date()
        : undefined,
      industry,
      country,
      language,
      aliases: [],
      ...(recurringScanData ?? {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: user.id,
      action: "brand_created",
      entityType: "Brand",
      entityId: brand.id,
    },
  });

  redirect(`/app/agency/${agencyId}?saved=brand`);
}

export default async function AgencyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>;
  searchParams?: Promise<{ saved?: string; created?: string }>;
}) {
  const { agencyId } = await params;
  const query = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect(`/login?next=/app/agency/${agencyId}`);

  const membership = await requireAgencyMembership(user.id, agencyId).catch(
    () => null,
  );
  if (!membership) notFound();

  const [agency, attachableOrganizations] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        memberships: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
        organizations: {
          orderBy: { createdAt: "desc" },
          include: {
            billingSubscription: true,
            memberships: {
              include: {
                user: { select: { id: true, email: true, name: true } },
              },
            },
            brands: {
              orderBy: { createdAt: "desc" },
              include: {
                scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
                scanRuns: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    }),
    prisma.organization.findMany({
      where: {
        agencyId: null,
        memberships: {
          some: {
            userId: user.id,
            role: { in: ["owner", "admin"] },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!agency) notFound();

  const brands = agency.organizations.flatMap((organization) =>
    organization.brands.map((brand) => ({ ...brand, organization })),
  );
  const onboardingSummaries = await Promise.all(
    brands.map((brand) => getBrandOnboardingSummary(brand.id)),
  );
  const onboardingByBrandId = new Map(
    onboardingSummaries.map((summary) => [summary.stats.brandId, summary]),
  );
  const averageOnboarding =
    onboardingSummaries.length === 0
      ? 0
      : Math.round(
          onboardingSummaries.reduce(
            (sum, summary) => sum + summary.completionPercent,
            0,
          ) / onboardingSummaries.length,
        );
  const clientUsers = new Set(
    agency.organizations.flatMap((organization) =>
      organization.memberships.map((item) => item.userId),
    ),
  );
  const canManageAgency = AGENCY_MANAGER_ROLES.includes(membership.role);
  const savedMessage = savedMessageFor(query?.saved ?? query?.created);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 grid gap-4 rounded-md border bg-card p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <AgencyLogo agency={agency} />
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
              <Building2 className="h-5 w-5" />
              Agency white-label
              <Badge variant="secondary">{membership.role}</Badge>
            </div>
            <h1 className="truncate text-3xl font-semibold">{agency.name}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {agency.productName} for {agency.organizations.length} client
              organizations.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {agency.customDomain && <span>{agency.customDomain}</span>}
              {agency.supportEmail && <span>{agency.supportEmail}</span>}
              <ColorSwatch label="Primary" value={agency.primaryColor} />
              <ColorSwatch label="Accent" value={agency.accentColor} />
            </div>
          </div>
        </div>
        <Button asChild variant="outline">
          <a href="/app/agency">All agencies</a>
        </Button>
      </div>

      {savedMessage && (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {savedMessage}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Clients"
          value={agency.organizations.length}
          detail="client organizations"
        />
        <MetricCard
          icon={<Building2 className="h-5 w-5" />}
          label="Brands"
          value={brands.length}
          detail="managed brands"
        />
        <MetricCard
          icon={<Target className="h-5 w-5" />}
          label="Onboarding"
          value={`${averageOnboarding}%`}
          detail="average brand progress"
        />
        <MetricCard
          icon={<Gauge className="h-5 w-5" />}
          label="Client users"
          value={clientUsers.size}
          detail="direct client logins"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              White-label settings
            </CardTitle>
            <CardDescription>
              Used in the client portal, agency dashboard and branded PDF
              reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAgencyBranding} className="grid gap-4">
              <input type="hidden" name="agencyId" value={agency.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Agency name">
                  <Input
                    name="name"
                    defaultValue={agency.name}
                    disabled={!canManageAgency}
                    required
                  />
                </Field>
                <Field label="Product name">
                  <Input
                    name="productName"
                    defaultValue={agency.productName}
                    disabled={!canManageAgency}
                    required
                  />
                </Field>
                <Field label="Logo URL">
                  <Input
                    name="logoUrl"
                    defaultValue={agency.logoUrl ?? ""}
                    disabled={!canManageAgency}
                    placeholder="https://..."
                  />
                </Field>
                <Field label="Custom domain">
                  <Input
                    name="customDomain"
                    defaultValue={agency.customDomain ?? ""}
                    disabled={!canManageAgency}
                    placeholder="portal.agency.com"
                  />
                </Field>
                <Field label="Primary color">
                  <Input
                    name="primaryColor"
                    defaultValue={agency.primaryColor}
                    disabled={!canManageAgency}
                    placeholder="#2563eb"
                  />
                </Field>
                <Field label="Accent color">
                  <Input
                    name="accentColor"
                    defaultValue={agency.accentColor}
                    disabled={!canManageAgency}
                    placeholder="#0f766e"
                  />
                </Field>
                <Field label="Support email">
                  <Input
                    name="supportEmail"
                    type="email"
                    defaultValue={agency.supportEmail ?? ""}
                    disabled={!canManageAgency}
                  />
                </Field>
                <Field label="Email sender">
                  <Input
                    name="senderName"
                    defaultValue={agency.senderName ?? ""}
                    disabled={!canManageAgency}
                    placeholder="Agency team"
                  />
                </Field>
                <Field label="Sender email">
                  <Input
                    name="senderEmail"
                    type="email"
                    defaultValue={agency.senderEmail ?? ""}
                    disabled={!canManageAgency}
                    placeholder="reports@agency.com"
                  />
                </Field>
              </div>
              <Field label="Report footer">
                <Textarea
                  name="reportFooter"
                  defaultValue={agency.reportFooter ?? ""}
                  disabled={!canManageAgency}
                  placeholder="Prepared for clients by Example Agency."
                />
              </Field>
              <Button type="submit" disabled={!canManageAgency}>
                <Settings2 className="h-4 w-4" />
                Save white-label
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Create client</CardTitle>
              <CardDescription>
                Creates a client organization managed by this agency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAgencyClient} className="grid gap-4">
                <input type="hidden" name="agencyId" value={agency.id} />
                <Field label="Client organization">
                  <Input name="name" disabled={!canManageAgency} required />
                </Field>
                <Field label="Client code">
                  <Input
                    name="agencyClientCode"
                    disabled={!canManageAgency}
                    placeholder="optional"
                  />
                </Field>
                <Field label="Client owner email">
                  <Input
                    name="clientOwnerEmail"
                    type="email"
                    disabled={!canManageAgency}
                    placeholder="only if user already exists"
                  />
                </Field>
                <Button type="submit" disabled={!canManageAgency}>
                  <Plus className="h-4 w-4" />
                  Add client
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attach existing organization</CardTitle>
              <CardDescription>
                Move an organization you own under this agency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={attachClientOrganization} className="grid gap-4">
                <input type="hidden" name="agencyId" value={agency.id} />
                <Field label="Organization">
                  <select
                    name="organizationId"
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      !canManageAgency || attachableOrganizations.length === 0
                    }
                    required
                  >
                    <option value="">Choose organization</option>
                    {attachableOrganizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Client code">
                  <Input
                    name="agencyClientCode"
                    disabled={!canManageAgency}
                    placeholder="optional"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    !canManageAgency || attachableOrganizations.length === 0
                  }
                >
                  <Link2 className="h-4 w-4" />
                  Attach organization
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create brand for client</CardTitle>
          <CardDescription>
            Adds a brand under a client organization, with the normal recurring
            scan defaults for that client's plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createAgencyClientBrand}
            className="grid gap-4 lg:grid-cols-3"
          >
            <input type="hidden" name="agencyId" value={agency.id} />
            <Field label="Client">
              <select
                name="organizationId"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canManageAgency || agency.organizations.length === 0}
                required
              >
                <option value="">Choose client</option>
                {agency.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand name">
              <Input name="name" disabled={!canManageAgency} required />
            </Field>
            <Field label="Domain">
              <Input
                name="domain"
                disabled={!canManageAgency}
                placeholder="example.com"
                required
              />
            </Field>
            <Field label="Country">
              <Input
                name="country"
                defaultValue="Slovenia"
                disabled={!canManageAgency}
              />
            </Field>
            <Field label="Language">
              <Input
                name="language"
                defaultValue="sl"
                disabled={!canManageAgency}
              />
            </Field>
            <Field label="Industry">
              <Input name="industry" disabled={!canManageAgency} />
            </Field>
            <label className="grid gap-1 text-sm font-medium lg:col-span-3">
              <span>Description</span>
              <Textarea name="description" disabled={!canManageAgency} />
            </label>
            <div className="lg:col-span-3">
              <Button
                type="submit"
                disabled={!canManageAgency || agency.organizations.length === 0}
              >
                <Plus className="h-4 w-4" />
                Create brand
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Client organizations</CardTitle>
          <CardDescription>
            Each client organization can contain one or more brands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Client</TH>
                <TH>Plan</TH>
                <TH>Brands</TH>
                <TH>Users</TH>
                <TH>Latest scan</TH>
                <TH>Portal</TH>
              </TR>
            </THead>
            <TBody>
              {agency.organizations.map((organization) => {
                const latestScan = organization.brands
                  .flatMap((brand) => brand.scanRuns)
                  .sort(
                    (left, right) =>
                      right.createdAt.getTime() - left.createdAt.getTime(),
                  )[0];
                const firstBrand = organization.brands[0];

                return (
                  <TR key={organization.id}>
                    <TD>
                      <div className="font-medium">{organization.name}</div>
                      {organization.agencyClientCode && (
                        <div className="text-xs text-muted-foreground">
                          {organization.agencyClientCode}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <Badge>
                        {effectivePlanForOrganization(organization)}
                      </Badge>
                    </TD>
                    <TD>{organization.brands.length}</TD>
                    <TD>{organization.memberships.length}</TD>
                    <TD>{formatDate(latestScan?.createdAt)}</TD>
                    <TD>
                      {firstBrand ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={`/app/brands/${firstBrand.id}`}>
                            Open
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          no brand
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
              {agency.organizations.length === 0 && (
                <TR>
                  <TD colSpan={6} className="text-muted-foreground">
                    No client organizations yet.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client brands and onboarding</CardTitle>
          <CardDescription>
            Brand-level onboarding remains the operational unit for agencies and
            clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Brand</TH>
                <TH>Client</TH>
                <TH>Score</TH>
                <TH>Onboarding</TH>
                <TH>Next step</TH>
                <TH>Latest scan</TH>
                <TH>Open</TH>
              </TR>
            </THead>
            <TBody>
              {brands.map((brand) => {
                const onboarding = onboardingByBrandId.get(brand.id);
                return (
                  <TR key={brand.id}>
                    <TD>
                      <div className="font-medium">{brand.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {brand.domain}
                      </div>
                    </TD>
                    <TD>{brand.organization.name}</TD>
                    <TD>{brand.scoreSnapshots[0]?.visibilityScore ?? "-"}</TD>
                    <TD>
                      <Badge
                        variant={onboardingVariant(
                          onboarding?.completionPercent ?? 0,
                        )}
                      >
                        {onboarding?.completionPercent ?? 0}%
                      </Badge>
                    </TD>
                    <TD>{onboarding?.nextStep?.title ?? "Complete"}</TD>
                    <TD>{formatDate(brand.scanRuns[0]?.createdAt)}</TD>
                    <TD>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/app/brands/${brand.id}`}>
                          Open
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TD>
                  </TR>
                );
              })}
              {brands.length === 0 && (
                <TR>
                  <TD colSpan={7} className="text-muted-foreground">
                    No client brands yet.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

async function requireAgencyManagerFromForm(formData: FormData) {
  const agencyId = String(formData.get("agencyId") ?? "");
  if (!agencyId) throw new Error("Bad Request: agency required");
  const user = await requireCurrentUser();
  const membership = await requireAgencyMembership(
    user.id,
    agencyId,
    AGENCY_MANAGER_ROLES,
  );
  return { user, agencyId, membership };
}

function AgencyLogo({
  agency,
}: {
  agency: { name: string; logoUrl: string | null; primaryColor: string };
}) {
  if (agency.logoUrl) {
    return (
      <img
        src={agency.logoUrl}
        alt=""
        className="h-14 w-14 rounded-md border object-contain"
      />
    );
  }

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md text-lg font-semibold text-white"
      style={{ backgroundColor: agency.primaryColor }}
    >
      {agency.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ColorSwatch({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-3 w-3 rounded-full border"
        style={{ backgroundColor: value }}
      />
      {label} {value}
    </span>
  );
}

function normalizeDomainLike(value: FormDataEntryValue | null) {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return text
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
}

function onboardingVariant(value: number) {
  if (value >= 80) return "success";
  if (value >= 50) return "warning";
  return "secondary";
}

function savedMessageFor(value?: string) {
  if (value === "1") return "Agency workspace created.";
  if (value === "branding") return "White-label settings saved.";
  if (value === "client") return "Client organization created.";
  if (value === "attached") return "Organization attached to agency.";
  if (value === "brand") return "Client brand created.";
  return null;
}
