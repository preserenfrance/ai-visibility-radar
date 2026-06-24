import Link from "next/link";
import { Menu } from "lucide-react";

type BrandMenuItem = {
  key: "overview" | "prompts" | "competitors" | "citations" | "actions";
  label: string;
  href: (brandId: string) => string;
};

const items: BrandMenuItem[] = [
  {
    key: "overview",
    label: "Osnovni prikaz",
    href: (brandId) => `/app/brands/${brandId}`,
  },
  {
    key: "prompts",
    label: "Prompti",
    href: (brandId) => `/app/brands/${brandId}/prompts`,
  },
  {
    key: "competitors",
    label: "Konkurenti",
    href: (brandId) => `/app/brands/${brandId}/competitors`,
  },
  {
    key: "citations",
    label: "Citati",
    href: (brandId) => `/app/brands/${brandId}/citations`,
  },
  {
    key: "actions",
    label: "Ideje za izboljšanje",
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
  const activeLabel =
    items.find((item) => item.key === active)?.label ?? "Meni znamke";

  return (
    <>
      <nav
        aria-label="Meni znamke"
        className="brand-menu-desktop-nav mb-6 hidden flex-wrap gap-2 text-sm md:flex"
      >
        <BrandMenuLinks brandId={brandId} active={active} />
      </nav>
      <details className="brand-menu-mobile relative mb-6 md:hidden">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md border bg-white px-3 text-sm font-medium shadow-sm [&::-webkit-details-marker]:hidden">
          <span className="truncate">{activeLabel}</span>
          <Menu className="h-4 w-4 shrink-0 text-muted-foreground" />
        </summary>
        <nav
          aria-label="Meni znamke"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 grid w-full gap-1 rounded-lg border bg-white p-2 text-sm shadow-lg"
        >
          <BrandMenuLinks brandId={brandId} active={active} mobile />
        </nav>
      </details>
    </>
  );
}

function BrandMenuLinks({
  brandId,
  active,
  mobile = false,
}: {
  brandId: string;
  active?: BrandMenuItem["key"];
  mobile?: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <Link
            key={item.key}
            className={[
              "rounded-md border px-3 py-2 font-medium transition",
              mobile ? "w-full" : "",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-white hover:border-primary/60 hover:text-primary",
            ].join(" ")}
            href={item.href(brandId)}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
