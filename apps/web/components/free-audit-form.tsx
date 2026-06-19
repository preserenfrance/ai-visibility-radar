"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const promptPlaceholders = [
  "Npr. Katera spletna trgovina je najboljša izbira za nakup kakovostnih tekaških copat v Sloveniji?",
  "Npr. Primerjaj spletne trgovine z otroško opremo glede na ceno, dostavo in vračila.",
  "Npr. Kje lahko kupim zanesljiv robotski sesalnik z dobro garancijo in hitro dostavo?",
  "Npr. Katere spletne trgovine priporočate za nakup naravne kozmetike v Sloveniji?",
  "Npr. Katera spletna trgovina ima najboljšo ponudbo pohištva za manjša stanovanja?",
];

export function FreeAuditForm({
  action,
  errorMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const promptRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const [suggestingPrompts, setSuggestingPrompts] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  async function suggestPrompts() {
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const domain = formValue(formData, "domain");
    const brandName = formValue(formData, "brandName");

    if (!domain || !brandName) {
      setSuggestError("Najprej vnesi domeno in ime znamke.");
      return;
    }

    setSuggestingPrompts(true);
    setSuggestError(null);

    try {
      const response = await fetch("/api/public/audit/prompts/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          brandName,
          country: formValue(formData, "country") || "Slovenija",
          language: formValue(formData, "language") || "sl",
          competitors: formValue(formData, "competitors"),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        prompts?: unknown;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          data.error ?? "Predlogov trenutno ni bilo mogoče pripraviti.",
        );

      const prompts = Array.isArray(data.prompts)
        ? data.prompts.filter(
            (prompt): prompt is string => typeof prompt === "string",
          )
        : [];
      if (prompts.length !== promptPlaceholders.length) {
        throw new Error("ChatGPT ni vrnil petih predlogov.");
      }

      prompts.forEach((prompt, index) => {
        const element = promptRefs.current[index];
        if (!element) return;
        element.value = prompt;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });
    } catch (error) {
      setSuggestError(
        error instanceof Error
          ? error.message
          : "Predlogov trenutno ni bilo mogoče pripraviti. Poskusi ponovno ali jih vpiši ročno.",
      );
    } finally {
      setSuggestingPrompts(false);
    }
  }

  return (
    <CardContent>
      {errorMessage && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <form ref={formRef} action={action} className="grid gap-3">
        <Input name="domain" placeholder="domain.com" required />
        <Input name="brandName" placeholder="Ime znamke" required />
        <Input
          name="email"
          type="email"
          placeholder="ime@podjetje.si"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="country" defaultValue="Slovenija" />
          <Input name="language" defaultValue="sl" />
        </div>
        <Input name="competitors" placeholder="Konkurent A, Konkurent B" />
        <fieldset className="grid gap-3 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">
            Vnesi 5 promptov za test
          </legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Predloge lahko po generiranju še spremeniš.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={suggestPrompts}
              disabled={suggestingPrompts}
            >
              {suggestingPrompts ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pripravljam predloge
                </>
              ) : (
                "Vi mi predlagajte prompte"
              )}
            </Button>
          </div>
          {suggestError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {suggestError}
            </div>
          )}
          {promptPlaceholders.map((placeholder, index) => (
            <Textarea
              key={index}
              ref={(element) => {
                promptRefs.current[index] = element;
              }}
              name="prompts"
              placeholder={placeholder}
              required
              minLength={3}
              className="min-h-20 bg-white"
            />
          ))}
        </fieldset>
        <fieldset className="grid gap-2 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">
            Izberi AI modele za test
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => {
              const isPaid = provider.id !== "openai";

              return (
                <label
                  key={provider.id}
                  className={`flex items-start gap-2 rounded-md border bg-white p-3 text-sm ${
                    isPaid ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  <input
                    className="mt-1"
                    type="checkbox"
                    name="providers"
                    value={provider.id}
                    defaultChecked={provider.id === "openai"}
                    disabled={isPaid}
                  />
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      {provider.label}
                      {isPaid && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Plačljivo
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {provider.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <SubmitArea />
      </form>
    </CardContent>
  );
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function SubmitArea() {
  const { pending } = useFormStatus();

  return (
    <div className="grid gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Pripravljamo prvi report
          </>
        ) : (
          <>
            Zaženi brezplačen audit <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      {pending && (
        <div className="rounded-md border bg-white p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Activity className="h-4 w-4 animate-pulse text-primary" />
            Audit teče v ozadju
          </div>
          <p className="mt-2 text-muted-foreground">
            Pošiljamo tvojih 5 promptov na izbrane AI modele in računamo
            rezultat. To lahko traja nekaj trenutkov.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
