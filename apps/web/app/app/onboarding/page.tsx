import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { ArrowRight, Globe, ListChecks, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth";
import { crawlBrand, generatePromptsForBrand } from "@/lib/services";

export const dynamic = "force-dynamic";

const steps: Array<{ step: string; label: string; Icon: typeof Globe }> = [
  { step: "1", label: "Vnos domene", Icon: Globe },
  { step: "2", label: "Analiza domene", Icon: ScanSearch },
  { step: "3", label: "Set promptov", Icon: ListChecks }
];

async function onboard(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  const organizationName = String(formData.get("organizationName") ?? "");
  const brandName = String(formData.get("brandName") ?? "");
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  const competitors = String(formData.get("competitors") ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);

  const organization =
    organizationName || user.memberships.length === 0
      ? await prisma.organization.create({
          data: {
            name: organizationName || brandName,
            memberships: {
              create: {
                userId: user.id,
                role: "owner"
              }
            }
          }
        })
      : user.memberships[0]!.organization;

  const brand = await prisma.brand.create({
    data: {
      organizationId: organization.id,
      name: brandName,
      domain,
      industry: String(formData.get("industry") ?? ""),
      country: String(formData.get("country") ?? "Slovenija"),
      language: String(formData.get("language") ?? "sl"),
      aliases: []
    }
  });
  await prisma.competitor.createMany({
    data: competitors.map((competitor) => ({ brandId: brand.id, name: competitor })),
    skipDuplicates: true
  });
  await crawlBrand(brand.id, 50).catch(() => null);
  await generatePromptsForBrand(brand.id, 25);
  redirect(`/app/brands/${brand.id}`);
}

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?next=/app/onboarding");
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <h1 className="text-3xl font-semibold">Dodajanje znamke</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          V enem toku ustvari organizacijo, znamko, konkurente, crawl posnetek in začetni set 25 promptov.
        </p>
        <div className="mt-6 grid gap-3">
          {steps.map(({ step, label, Icon }) => (
            <div key={step} className="flex items-center gap-3 rounded-lg border bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10 text-sm font-semibold text-primary">
                {step}
              </div>
              <Icon className="h-4 w-4 text-primary" />
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dodaj novo znamko</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onboard} className="grid gap-3">
            <Input name="organizationName" placeholder="Ime organizacije" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="brandName" placeholder="Ime znamke" required />
              <Input name="domain" placeholder="domain.com" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input name="country" defaultValue="Slovenija" />
              <Input name="language" defaultValue="sl" />
              <Input name="industry" placeholder="Panoga" />
            </div>
            <Textarea name="competitors" placeholder="Konkurent A, Konkurent B" />
            <Button type="submit">
              Ustvari znamko in prompte <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
