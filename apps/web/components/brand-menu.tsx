import Link from "next/link";
import { prisma } from "@ai-radar/db";
import { hasActivePaidPlan } from "@/lib/billing";

type BrandMenuItem = {
  key: "overview" | "prompts" | "competitors" | "citations" | "actions";
  label: string;
  paid: boolean;
  href: (brandId: string) => string;
};

const items: BrandMenuItem[] = [
  {
    key: "overview",
    label: "Osnovni prikaz",
    paid: false,
    href: (brandId) => `/app/brands/${brandId}`,
  },
  {
    key: "prompts",
    label: "Prompti",
    paid: false,
    href: (brandId) => `/app/brands/${brandId}/prompts`,
  },
  {
    key: "competitors",
    label: "Konkurenti",
    paid: true,
    href: (brandId) => `/app/brands/${brandId}/competitors`,
  },
  {
    key: "citations",
    label: "Citati",
    paid: true,
    href: (brandId) => `/app/brands/${brandId}/citations`,
  },
  {
    key: "actions",
    label: "Ideje za izboljšanje",
    paid: true,
    href: (brandId) => `/app/brands/${brandId}/actions`,
  },
];

export async function BrandMenu({
  brandId,
  active,
}: {
  brandId: string;
  active?: BrandMenuItem["key"];
}) {
  const paidAccess = await brandHasPaidAccess(brandId);

  return (
    <nav aria-label="Meni znamke" className="mb-6 flex flex-wrap gap-2 text-sm">
      {items.map((item) => {
        const selected = active === item.key;
        const locked = item.paid && !paidAccess;
        return (
          <Link
            key={item.key}
            className={[
              "rounded-md border px-3 py-2 font-medium transition",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-white hover:border-primary/60 hover:text-primary",
              locked ? "border-dashed text-muted-foreground" : "",
            ].join(" ")}
            href={
              locked
                ? `/app/brands/${brandId}/paywall?feature=${item.key}`
                : item.href(brandId)
            }
          >
            {item.label}
            {locked && <span className="ml-2 text-xs">Pro</span>}
          </Link>
        );
      })}
    </nav>
  );
}

async function brandHasPaidAccess(brandId: string) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      organization: { include: { billingSubscription: true } },
    },
  });
  return Boolean(brand && hasActivePaidPlan(brand.organization));
}
