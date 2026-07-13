import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { PromptSuggestionTester } from "@/components/prompt-suggestion-tester";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser, isAdminUser, requireAdminUser } from "@/lib/auth";
import {
  isSystemPromptKey,
  resetSystemPrompt,
  saveSystemPrompt,
  systemPromptSettings,
} from "@/lib/system-prompts";

export const dynamic = "force-dynamic";

async function savePrompt(formData: FormData) {
  "use server";
  const user = await requireAdminUser();
  const key = String(formData.get("key") ?? "");
  if (!isSystemPromptKey(key))
    throw new Error("Bad Request: neveljaven sistemski prompt");

  await saveSystemPrompt({
    key,
    content: String(formData.get("content") ?? "").trim(),
    updatedByEmail: user.email,
  });
  redirect("/admin/system-prompts?saved=1");
}

async function resetPrompt(formData: FormData) {
  "use server";
  const user = await requireAdminUser();
  const key = String(formData.get("key") ?? "");
  if (!isSystemPromptKey(key))
    throw new Error("Bad Request: neveljaven sistemski prompt");

  await resetSystemPrompt(key, user.email);
  redirect("/admin/system-prompts?reset=1");
}

export default async function AdminSystemPromptsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/system-prompts");
  if (!isAdminUser(user))
    return <main className="p-8">You do not have access to the admin area.</main>;

  const params = await searchParams;
  const settings = await systemPromptSettings();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <SlidersHorizontal className="h-5 w-5" />
            Admin
          </div>
          <h1 className="text-3xl font-semibold">System prompts</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Edit internal instructions for prompt suggestions and legacy
            settings from the previous flow. To test, save changes first, then
            run the test below.
          </p>
        </div>
        {(params?.saved || params?.reset) && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            {params.saved
              ? "System prompt saved."
              : "System prompt reset."}
          </div>
        )}
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Test prompt suggestions</CardTitle>
          <p className="text-sm text-muted-foreground">
            The test uses the currently saved instructions for the system
            prompt "Prompt suggestions in the initial audit".
          </p>
        </CardHeader>
        <CardContent>
          <PromptSuggestionTester />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {settings.map((prompt) => (
          <Card key={prompt.key}>
            <CardHeader>
              <CardTitle>{prompt.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {prompt.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {prompt.updatedAt
                  ? `Last change: ${prompt.updatedAt.toLocaleString("en-US")}${
                      prompt.updatedByEmail ? ` · ${prompt.updatedByEmail}` : ""
                    }`
                  : "Uporablja se privzeta nastavitev."}
              </p>
            </CardHeader>
            <CardContent>
              <form action={savePrompt} className="grid gap-3">
                <input type="hidden" name="key" value={prompt.key} />
                <Textarea
                  name="content"
                  defaultValue={prompt.content}
                  className="min-h-56 font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Save</Button>
                  <Button
                    type="submit"
                    variant="outline"
                    formAction={resetPrompt}
                  >
                    Ponastavi
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
