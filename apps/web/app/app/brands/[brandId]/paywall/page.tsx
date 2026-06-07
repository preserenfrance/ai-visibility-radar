import { redirect } from "next/navigation";
import { BrandMenu } from "@/components/brand-menu";
import { PaidFeaturePaywall } from "@/components/paid-feature-paywall";
import { hasActivePaidPlan, paidFeatureFromValue, paidFeatureLabels } from "@/lib/billing";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BrandPaywallPage({
  params,
  searchParams
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ feature?: string }>;
}) {
  const { brandId } = await params;
  const feature = paidFeatureFromValue((await searchParams)?.feature);
  const { brand } = await requireBrandAccess(brandId);

  if (hasActivePaidPlan(brand.organization)) {
    redirect(`/app/brands/${brandId}/${feature}`);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">{paidFeatureLabels[feature]}</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <BrandMenu brandId={brandId} active={feature} />
      <PaidFeaturePaywall brandId={brandId} organizationId={brand.organizationId} feature={feature} />
    </section>
  );
}
