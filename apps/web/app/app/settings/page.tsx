import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/billing-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { McpTokenManager } from "@/components/mcp-token-manager";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { effectivePlanForOrganization } from "@/lib/billing";
import { requireCurrentUser } from "@/lib/auth";
import { parseMcpScopes } from "@/lib/mcp-tokens";
import { manualScanUsageForOrganization } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/settings");
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: {
      brands: {
        include: {
          promptSets: {
            where: { status: "active" },
            include: { prompts: true },
          },
        },
      },
      billingSubscription: true,
    },
  });
  const manualScanUsageByOrganization = new Map(
    await Promise.all(
      organizations.map(async (organization) => {
        const effectivePlan = effectivePlanForOrganization(organization);
        return [
          organization.id,
          await manualScanUsageForOrganization(organization.id, effectivePlan),
        ] as const;
      }),
    ),
  );
  const mcpTokens = await prisma.mcpApiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const appUrl = getConfig().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Organizations, plan limits and billing status.
        </p>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>MCP access</CardTitle>
        </CardHeader>
        <CardContent>
          <McpTokenManager
            endpoint={`${appUrl}/mcp`}
            initialTokens={mcpTokens.map((token) => ({
              id: token.id,
              name: token.name,
              tokenPrefix: token.tokenPrefix,
              scopes: parseMcpScopes(token.scopes),
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
              revokedAt: token.revokedAt?.toISOString() ?? null,
            }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Plan</TH>
                <TH>Brands</TH>
                <TH>Prompt limit</TH>
                <TH>Manual scans</TH>
                <TH>Prompt runs</TH>
                <TH>Payments</TH>
                <TH>Manage</TH>
              </TR>
            </THead>
            <TBody>
              {organizations.map((organization) => {
                const effectivePlan =
                  effectivePlanForOrganization(organization);
                const limits = PLAN_LIMITS[effectivePlan];
                const manualScanUsage = manualScanUsageByOrganization.get(
                  organization.id,
                );
                return (
                  <TR key={organization.id}>
                    <TD className="font-medium">{organization.name}</TD>
                    <TD>
                      <Badge>{effectivePlan}</Badge>
                    </TD>
                    <TD>
                      {organization.brands.length}/{limits.brandCount}
                    </TD>
                    <TD>{limits.promptsPerBrand} per brand</TD>
                    <TD>
                      {manualScanUsage
                        ? `${manualScanUsage.used}/${manualScanUsage.limit} - reset ${manualScanUsage.resetAt.toLocaleDateString("en-US")}`
                        : "-"}
                    </TD>
                    <TD>{cadenceLabel(limits.scanCadence)}</TD>
                    <TD>
                      {organization.billingSubscription?.status ?? "inactive"}
                    </TD>
                    <TD>
                      <BillingActions
                        organizationId={organization.id}
                        hasStripeCustomer={Boolean(
                          organization.stripeCustomerId,
                        )}
                        disabled={effectivePlan === "disabled"}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function cadenceLabel(value: "none" | "manual" | "weekly") {
  if (value === "weekly") return "automatic weekly";
  if (value === "manual") return "manual";
  return "disabled";
}
