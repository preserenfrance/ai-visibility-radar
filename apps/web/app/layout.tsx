import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { MetaPixel } from "@/components/meta-pixel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getI18n } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getI18n();
  return {
    title: "AI Visibility Radar",
    description: dictionary.metadata.description,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, dictionary } = await getI18n();

  return (
    <html lang={locale}>
      <body>
        <div className="flex min-h-screen flex-col">
          <SiteHeader
            locale={locale}
            messages={{
              common: dictionary.common,
              nav: dictionary.nav,
              notifications: dictionary.notifications,
              localeNames: dictionary.localeNames,
            }}
          />
          <div className="flex-1">{children}</div>
          <SiteFooter
            locale={locale}
            messages={{ common: dictionary.common, footer: dictionary.footer }}
          />
        </div>
        <Analytics />
        <MetaPixel />
      </body>
    </html>
  );
}
