import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser, isAdminUser, requireAdminUser } from "@/lib/auth";
import {
  FAQ_CACHE_TAG,
  faqSections,
  resetFaqSections,
  saveFaqSections,
  type FaqSection,
} from "@/lib/faqs";

export const dynamic = "force-dynamic";

async function saveFaqs(formData: FormData) {
  "use server";
  const user = await requireAdminUser();
  const sections = parseFaqForm(formData);
  await saveFaqSections(sections, user.email);
  revalidateTag(FAQ_CACHE_TAG);
  redirect("/admin/faqs?saved=1");
}

async function resetFaqs(_formData: FormData) {
  "use server";
  const user = await requireAdminUser();
  await resetFaqSections(user.email);
  revalidateTag(FAQ_CACHE_TAG);
  redirect("/admin/faqs?reset=1");
}

export default async function AdminFaqsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/faqs");
  if (!isAdminUser(user))
    return <main className="p-8">Nimate dostopa do admin strani.</main>;

  const params = await searchParams;
  const sections = await faqSections();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <HelpCircle className="h-5 w-5" />
            Admin
          </div>
          <h1 className="text-3xl font-semibold">FAQ vsebina</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Uredi vprašanja in odgovore na javni strani FAQ. Prazna vprašanja
            ali odgovori se ne shranijo, zato lahko tako tudi odstraniš vnos.
          </p>
        </div>
        {(params?.saved || params?.reset) && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            {params.saved ? "FAQ je shranjen." : "FAQ je ponastavljen."}
          </div>
        )}
      </div>

      <form action={saveFaqs} className="grid gap-4">
        {sections.map((section, sectionIndex) => (
          <Card key={`${section.title}-${sectionIndex}`}>
            <CardHeader>
              <CardTitle>Sekcija {sectionIndex + 1}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Naslov sekcije
                  <Input
                    name="sectionTitle"
                    defaultValue={section.title}
                    className="mt-2"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-3">
                {[...section.items, ...emptyFaqSlots(2)].map(
                  (item, itemIndex) => (
                    <div
                      key={`${section.title}-${itemIndex}`}
                      className="grid gap-2 rounded-md border bg-secondary/20 p-3"
                    >
                      <input
                        type="hidden"
                        name="sectionIndex"
                        value={sectionIndex}
                      />
                      <label className="text-xs font-medium">
                        Vprašanje
                        <Input
                          name="question"
                          defaultValue={item.question}
                          className="mt-1 bg-white"
                        />
                      </label>
                      <label className="text-xs font-medium">
                        Odgovor
                        <Textarea
                          name="answer"
                          defaultValue={item.answer}
                          className="mt-1 min-h-24 bg-white"
                        />
                      </label>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Shrani FAQ</Button>
          <Button type="submit" variant="outline" formAction={resetFaqs}>
            Ponastavi privzeto
          </Button>
        </div>
      </form>
    </section>
  );
}

function emptyFaqSlots(count: number) {
  return Array.from({ length: count }, () => ({ question: "", answer: "" }));
}

function parseFaqForm(formData: FormData): FaqSection[] {
  const sectionTitles = formData
    .getAll("sectionTitle")
    .map((value) => String(value).trim());
  const sectionIndexes = formData
    .getAll("sectionIndex")
    .map((value) => Number(value));
  const questions = formData
    .getAll("question")
    .map((value) => String(value).trim());
  const answers = formData
    .getAll("answer")
    .map((value) => String(value).trim());

  return sectionTitles
    .map((title, index) => ({
      title,
      items: questions
        .map((question, itemIndex) => ({
          question,
          answer: answers[itemIndex] ?? "",
          sectionIndex: sectionIndexes[itemIndex],
        }))
        .filter((item) => item.sectionIndex === index)
        .filter((item) => item.question && item.answer)
        .map(({ question, answer }) => ({ question, answer })),
    }))
    .filter((section) => section.title && section.items.length > 0);
}
