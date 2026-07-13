"use client";

import { type FormEvent, useState } from "react";
import { Loader2, WandSparkles } from "lucide-react";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PromptSuggestionTester() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);

  async function testPromptSuggestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsPending(true);
    setError(null);
    setPrompts([]);

    try {
      const response = await fetch("/api/admin/prompt-suggestions/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: formValue(formData, "domain"),
          brandName: formValue(formData, "brandName"),
          country: formValue(formData, "country") || "Slovenija",
          language: formValue(formData, "language") || "sl",
          competitors: formValue(formData, "competitors"),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        prompts?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          data.error ?? "The test generation could not be run.",
        );
      }

      const nextPrompts = Array.isArray(data.prompts)
        ? data.prompts.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      setPrompts(nextPrompts);
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "The test generation could not be run.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={testPromptSuggestions} className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Input name="domain" placeholder="vrtna-trgovina.si" required />
          <Input name="brandName" placeholder="Name trgovine" required />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input name="country" defaultValue="Slovenija" />
          <LanguageSelect name="language" />
        </div>
        <Textarea
          name="competitors"
          placeholder="Optional: competitors, separated by commas"
          className="min-h-20"
        />
        <Button type="submit" className="w-fit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generiram test
            </>
          ) : (
            <>
              <WandSparkles className="h-4 w-4" />
              Test prompt suggestions
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {prompts.length > 0 && (
        <div className="rounded-md border bg-secondary/30 p-4">
          <div className="mb-3 text-sm font-semibold">Suggested prompts</div>
          <ol className="grid gap-2 text-sm">
            {prompts.map((prompt, index) => (
              <li
                key={`${prompt}-${index}`}
                className="rounded-md border bg-white p-3"
              >
                {prompt}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
