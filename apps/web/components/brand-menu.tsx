import Link from "next/link";

type BrandMenuItem = {
  key: "prompts" | "competitors" | "citations" | "actions";
  label: string;
  href: (brandId: string) => string;
};

const items: BrandMenuItem[] = [
  { key: "prompts", label: "Prompti", href: (brandId) => `/app/brands/${brandId}/prompts` },
  { key: "competitors", label: "Konkurenti", href: (brandId) => `/app/brands/${brandId}/competitors` },
  { key: "citations", label: "Citati", href: (brandId) => `/app/brands/${brandId}/citations` },
  { key: "actions", label: "Akcijski center", href: (brandId) => `/app/brands/${brandId}/actions` }
];

export function BrandMenu({
  brandId,
  active
}: {
  brandId: string;
  active?: BrandMenuItem["key"];
}) {
  return (
    <nav aria-label="Meni znamke" className="mb-6 flex flex-wrap gap-2 text-sm">
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <Link
            key={item.key}
            className={[
              "rounded-md border px-3 py-2 font-medium transition",
              selected ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:border-primary/60 hover:text-primary"
            ].join(" ")}
            href={item.href(brandId)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
