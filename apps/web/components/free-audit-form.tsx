"use client";

import { type FormEvent, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import { LanguageSelect } from "@/components/language-select";
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
const MIN_PROMPT_COUNT = 3;

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
  const [promptCountWarning, setPromptCountWarning] = useState(false);

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
    setPromptCountWarning(false);

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
      setPromptCountWarning(false);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const enteredPrompts = promptRefs.current.filter((element) => {
      const value = element?.value.trim() ?? "";
      return value.length >= 3;
    }).length;

    if (enteredPrompts >= MIN_PROMPT_COUNT) return;

    event.preventDefault();
    setSuggestError(null);
    setPromptCountWarning(true);
    promptRefs.current.find((element) => !element?.value.trim())?.focus();
  }

  return (
    <CardContent>
      {errorMessage && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <form
        ref={formRef}
        action={action}
        onSubmit={handleSubmit}
        className="grid gap-3"
      >
        <div className="grid gap-2">
          <label htmlFor="auditDomain" className="text-sm font-medium">
            Spletna stran
          </label>
          <Input
            id="auditDomain"
            name="domain"
            placeholder="domain.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditBrandName" className="text-sm font-medium">
            Ime znamke
          </label>
          <Input
            id="auditBrandName"
            name="brandName"
            placeholder="Npr. Moja trgovina"
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditEmail" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="auditEmail"
            name="email"
            type="email"
            placeholder="ime@podjetje.si"
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditLanguage" className="text-sm font-medium">
            Jezik odgovorov
          </label>
          <LanguageSelect id="auditLanguage" name="language" />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditCompetitors" className="text-sm font-medium">
            Konkurenti (brand)
          </label>
          <Input
            id="auditCompetitors"
            name="competitors"
            placeholder="Npr. Mimovrste, Merkur, Bauhaus"
          />
          <p className="-mt-1 text-xs text-muted-foreground">
            Vnesi imena konkurenčnih brandov, ki jih želiš primerjati z vašo
            znamko. Če jih je več, jih loči z vejico.
          </p>
        </div>
        <fieldset className="grid gap-3 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">
            Vnesi vsaj 3 prompte za test
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
          {promptCountWarning && (
            <div className="grid gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div>
                <div className="font-medium">
                  Za audit potrebuješ vsaj 3 prompte.
                </div>
                <p className="mt-1">
                  Vpiši še en prompt ali pa klikni spodnji gumb in ti pripravimo
                  predloge, ki jih lahko pregledaš in popraviš.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit border-amber-300 bg-white"
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
          )}
          {promptPlaceholders.map((placeholder, index) => (
            <div key={index} className="grid gap-2">
              <label
                htmlFor={`auditPrompt-${index}`}
                className="text-sm font-medium"
              >
                Prompt {index + 1}
              </label>
              <Textarea
                id={`auditPrompt-${index}`}
                ref={(element) => {
                  promptRefs.current[index] = element;
                }}
                name="prompts"
                placeholder={placeholder}
                minLength={3}
                className="min-h-20 bg-white"
              />
            </div>
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
            Pošiljamo tvoje prompte na izbrane AI modele in računamo rezultat.
            To lahko traja nekaj trenutkov.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
