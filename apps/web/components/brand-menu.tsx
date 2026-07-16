import { Menu } from "lucide-react";
import { TrackedAnchor } from "@/components/analytics-events";
import { getI18n } from "@/lib/i18n";

type BrandMenuItem = {
  key: "overview" | "prompts" | "competitors" | "citations" | "actions";
  href: (brandId: string) => string;
};

const items: BrandMenuItem[] = [
  {
    key: "overview",
    href: (brandId) => `/app/brands/${brandId}`,
  },
  {
    key: "prompts",
    href: (brandId) => `/app/brands/${brandId}/prompts`,
  },
  {
    key: "competitors",
    href: (brandId) => `/app/brands/${brandId}/competitors`,
  },
  {
    key: "citations",
    href: (brandId) => `/app/brands/${brandId}/citations`,
  },
  {
    key: "actions",
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
  const { dictionary } = await getI18n();
  const labels = dictionary.brandMenu;
  const activeLabel = (active ? labels[active] : undefined) ?? labels.aria;

  return (
    <>
      <nav
        aria-label={labels.aria}
        className="brand-menu-desktop-nav mb-6 hidden flex-wrap gap-2 text-sm md:flex"
      >
        <BrandMenuLinks brandId={brandId} active={active} labels={labels} />
      </nav>
      <details className="brand-menu-mobile relative mb-6 md:hidden">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md border bg-white px-3 text-sm font-medium shadow-sm [&::-webkit-details-marker]:hidden">
          <span className="truncate">{activeLabel}</span>
          <Menu className="h-4 w-4 shrink-0 text-muted-foreground" />
        </summary>
        <nav
          aria-label={labels.aria}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 grid w-full gap-1 rounded-lg border bg-white p-2 text-sm shadow-lg"
        >
          <BrandMenuLinks
            brandId={brandId}
            active={active}
            labels={labels}
            mobile
          />
        </nav>
      </details>
    </>
  );
}

function BrandMenuLinks({
  brandId,
  active,
  labels,
  mobile = false,
}: {
  brandId: string;
  active?: BrandMenuItem["key"];
  labels: Record<BrandMenuItem["key"] | "aria", string>;
  mobile?: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <TrackedAnchor
            key={item.key}
            className={[
              "rounded-md border px-3 py-2 font-medium transition",
              mobile ? "w-full" : "",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-white hover:border-primary/60 hover:text-primary",
            ].join(" ")}
            href={item.href(brandId)}
            eventName="brand_menu_click"
            eventProperties={{
              brand_id: brandId,
              menu_item: item.key,
              active_item: active ?? "none",
              location: mobile ? "brand_menu_mobile" : "brand_menu_desktop",
            }}
          >
            {labels[item.key]}
          </TrackedAnchor>
        );
      })}
    </>
  );
}
