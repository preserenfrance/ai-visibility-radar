import { redirect } from "next/navigation";
import { brandFeatureFromValue } from "@/lib/billing";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BrandPaywallPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ feature?: string }>;
}) {
  const { brandId } = await params;
  const feature = brandFeatureFromValue((await searchParams)?.feature);
  await requireBrandAccess(brandId);

  redirect(`/app/brands/${brandId}/${feature}`);
}
