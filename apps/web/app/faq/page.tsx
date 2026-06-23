import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { faqSections } from "@/lib/faqs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pogosta vprašanja | AI Visibility Radar",
  description:
    "Odgovori na najpogostejša vprašanja o AI Visibility Radarju, modelih, cenah, metrikah in rednih scanih.",
};

export default async function FaqPage() {
  const sections = await faqSections();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <HelpCircle className="h-4 w-4" />
            Pogosta vprašanja
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight">
            Kako deluje AI Visibility Radar?
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Kratki odgovori za podjetja, ki razmišljajo o uporabi, in za
            uporabnike, ki želijo bolje razumeti rezultate, modele, cene in
            redne scane.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/pricing">Poglej cenik</Link>
          </Button>
          <Button asChild>
            <Link href="/ai-visibility-checker">
              Začni audit <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {section.items.map((item) => (
                <details
                  key={item.question}
                  className="rounded-md border bg-secondary/20 p-4"
                >
                  <summary className="cursor-pointer font-medium">
                    {item.question}
                  </summary>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
