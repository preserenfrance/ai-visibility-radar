import { redirect } from "next/navigation";
import { ArrowRight, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFreeAudit } from "@/lib/services";

async function startAudit(formData: FormData) {
  "use server";
  const lead = await createFreeAudit({
    domain: String(formData.get("domain") ?? ""),
    brandName: String(formData.get("brandName") ?? ""),
    email: String(formData.get("email") ?? ""),
    country: String(formData.get("country") ?? "Slovenia"),
    language: String(formData.get("language") ?? "sl"),
    competitors: String(formData.get("competitors") ?? "")
  });
  redirect(`/audit/${lead?.id}`);
}

export default function CheckerPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <Radar className="h-5 w-5" />
            AI Visibility Radar
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Preveri, ali te ChatGPT, Gemini in Claude priporočajo.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            Free audit ustvari lead, crawla do 10 strani, generira 5 promptov in pokaže delni score.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Zaženi brezplačen audit</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={startAudit} className="grid gap-3">
              <Input name="domain" placeholder="domain.com" required />
              <Input name="brandName" placeholder="Brand name" required />
              <Input name="email" type="email" placeholder="you@company.com" required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="country" defaultValue="Slovenia" />
                <Input name="language" defaultValue="sl" />
              </div>
              <Input name="competitors" placeholder="Competitor A, Competitor B" />
              <Button type="submit">
                Zaženi brezplačen audit <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
