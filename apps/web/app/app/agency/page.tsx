import { redirect } from "next/navigation";
import type React from "react";
import { Building2, Plus, Settings2, Users } from "lucide-react";
import { prisma } from "@ai-radar/db";
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
import { isAdminUser, requireCurrentUser } from "@/lib/auth";
import { normalizeOptionalText, uniqueAgencySlug } from "@/lib/agency";

export const dynamic = "force-dynamic";

async function createAgencyWorkspace(formData: FormData) {
  "use server";

  const user = await requireCurrentUser();
  if (!isAdminUser(user) && user.agencyMemberships.length === 0) {
    throw new Error("Forbidden: agency creation requires platform access");
  }
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Bad Request: agency name required");

  const agency = await prisma.agency.create({
    data: {
      name,
      slug: await uniqueAgencySlug(name),
      productName:
        normalizeOptionalText(formData.get("productName")) ??
        `${name} AI Visibility`,
      supportEmail:
        normalizeOptionalText(formData.get("supportEmail")) ?? user.email,
      memberships: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });

  redirect(`/app/agency/${agency.id}?created=1`);
}

export default async function AgencyPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/agency");

  const memberships = await prisma.agencyMembership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      agency: {
        include: {
          _count: {
            select: {
              memberships: true,
              organizations: true,
            },
          },
          organizations: {
            select: {
              id: true,
              _count: { select: { brands: true } },
            },
          },
        },
      },
    },
  });
  const canCreateAgency =
    isAdminUser(user) || user.agencyMemberships.length > 0;

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Building2 className="h-5 w-5" />
            Agency white-label
          </div>
          <h1 className="text-3xl font-semibold">Agency workspaces</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Manage client organizations, brand onboarding and white-label
            presentation from one place.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Your agencies</CardTitle>
            <CardDescription>
              Agencies you can manage or access as a team member.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {memberships.map((membership) => {
                const brandCount = membership.agency.organizations.reduce(
                  (sum, organization) => sum + organization._count.brands,
                  0,
                );
                return (
                  <a
                    key={membership.agencyId}
                    href={`/app/agency/${membership.agencyId}`}
                    className="grid gap-3 rounded-md border p-4 transition hover:border-primary/60 hover:bg-secondary/40 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">
                          {membership.agency.name}
                        </div>
                        <Badge variant="secondary">{membership.role}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {membership.agency.productName}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:justify-end">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {membership.agency._count.organizations} clients
                      </span>
                      <span>{brandCount} brands</span>
                    </div>
                  </a>
                );
              })}
              {memberships.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  You do not have an agency workspace yet. Create one to start
                  managing white-label clients.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Create agency workspace
            </CardTitle>
            <CardDescription>
              The creator becomes the agency owner and can add client
              organizations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAgencyWorkspace} className="grid gap-4">
              <Field label="Agency name">
                <Input
                  name="name"
                  placeholder="Example Agency"
                  disabled={!canCreateAgency}
                  required
                />
              </Field>
              <Field label="White-label product name">
                <Input
                  name="productName"
                  placeholder="Example AI Visibility Monitor"
                  disabled={!canCreateAgency}
                />
              </Field>
              <Field label="Support email">
                <Input
                  name="supportEmail"
                  type="email"
                  placeholder={user.email}
                  disabled={!canCreateAgency}
                />
              </Field>
              <Button type="submit" disabled={!canCreateAgency}>
                <Plus className="h-4 w-4" />
                Create agency
              </Button>
            </form>
            {!canCreateAgency && (
              <p className="mt-3 text-sm text-muted-foreground">
                Agency workspace creation is enabled by the platform team.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
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
