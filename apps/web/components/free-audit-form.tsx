"use client";

import { type FormEvent, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import { LanguageSelect } from "@/components/language-select";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
import { trackAnalyticsEvent } from "@/components/analytics-events";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SupportedLocale } from "@ai-radar/shared";

const MIN_PROMPT_COUNT = 3;
const MAX_PROMPT_COUNT = 5;

type FreeAuditFormMessages = {
  domain: string;
  domainPlaceholder: string;
  brandName: string;
  brandNamePlaceholder: string;
  emailPlaceholder: string;
  language: string;
  competitors: string;
  competitorsPlaceholder: string;
  competitorsHelp: string;
  questionsLegend: string;
  suggestionsHelp: string;
  suggest: string;
  suggesting: string;
  missingDomain: string;
  noSuggestions: string;
  suggestionsError: string;
  promptWarningTitle: string;
  promptWarningText: string;
  question: string;
  modelsLegend: string;
  availableInApp: string;
  submit: string;
  pending: string;
  runningTitle: string;
  runningText: string;
  placeholders: readonly string[];
};

export function FreeAuditForm({
  action,
  errorMessage,
  locale,
  messages,
}: {
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
  locale: SupportedLocale;
  messages: FreeAuditFormMessages;
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
      setSuggestError(messages.missingDomain);
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
          country:
            formValue(formData, "country") ||
            (locale === "en" ? "United States" : "Slovenija"),
          language: formValue(formData, "language") || locale,
          competitors: formValue(formData, "competitors"),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        prompts?: unknown;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? messages.suggestionsError);

      const prompts = Array.isArray(data.prompts)
        ? data.prompts.filter(
            (prompt): prompt is string => typeof prompt === "string",
          )
        : [];
      if (prompts.length === 0) {
        throw new Error(messages.noSuggestions);
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
        error instanceof Error ? error.message : messages.suggestionsError,
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
    const hasEnoughPrompts = enteredPrompts >= MIN_PROMPT_COUNT;

    trackAnalyticsEvent("free_audit_cta_click", {
      location: "free_audit_form",
      prompt_count: enteredPrompts,
      valid_prompt_count: hasEnoughPrompts,
    });

    if (hasEnoughPrompts) return;

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
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-2">
          <label htmlFor="auditDomain" className="text-sm font-medium">
            {messages.domain}
          </label>
          <Input
            id="auditDomain"
            name="domain"
            placeholder={messages.domainPlaceholder}
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditBrandName" className="text-sm font-medium">
            {messages.brandName}
          </label>
          <Input
            id="auditBrandName"
            name="brandName"
            placeholder={messages.brandNamePlaceholder}
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
            placeholder={messages.emailPlaceholder}
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditLanguage" className="text-sm font-medium">
            {messages.language}
          </label>
          <LanguageSelect
            id="auditLanguage"
            name="language"
            defaultValue={locale}
            uiLocale={locale}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="auditCompetitors" className="text-sm font-medium">
            {messages.competitors}
          </label>
          <Input
            id="auditCompetitors"
            name="competitors"
            placeholder={messages.competitorsPlaceholder}
          />
          <p className="-mt-1 text-xs text-muted-foreground">
            {messages.competitorsHelp}
          </p>
        </div>
        <fieldset className="grid gap-3 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">
            {messages.questionsLegend
              .replace("{min}", String(MIN_PROMPT_COUNT))
              .replace("{max}", String(MAX_PROMPT_COUNT))}
          </legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {messages.suggestionsHelp}
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
                  {messages.suggesting}
                </>
              ) : (
                messages.suggest
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
                <div className="font-medium">{messages.promptWarningTitle}</div>
                <p className="mt-1">{messages.promptWarningText}</p>
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
                    {messages.suggesting}
                  </>
                ) : (
                  messages.suggest
                )}
              </Button>
            </div>
          )}
          {messages.placeholders.map((placeholder, index) => (
            <div key={index} className="grid gap-2">
              <label
                htmlFor={`auditPrompt-${index}`}
                className="text-sm font-medium"
              >
                {messages.question.replace("{number}", String(index + 1))}
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
            {messages.modelsLegend}
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => {
              const lockedForAudit = provider.id !== "openai";

              return (
                <label
                  key={provider.id}
                  className={`flex items-start gap-2 rounded-md border bg-white p-3 text-sm ${
                    lockedForAudit
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  }`}
                >
                  <input
                    className="mt-1"
                    type="checkbox"
                    name="providers"
                    value={provider.id}
                    defaultChecked={provider.id === "openai"}
                    disabled={lockedForAudit}
                  />
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      {provider.label}
                      {lockedForAudit && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {messages.availableInApp}
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
        <SubmitArea messages={messages} />
      </form>
    </CardContent>
  );
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function SubmitArea({ messages }: { messages: FreeAuditFormMessages }) {
  const { pending } = useFormStatus();

  return (
    <div className="grid gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {messages.pending}
          </>
        ) : (
          <>
            {messages.submit} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      {pending && (
        <div className="rounded-md border bg-white p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Activity className="h-4 w-4 animate-pulse text-primary" />
            {messages.runningTitle}
          </div>
          <p className="mt-2 text-muted-foreground">{messages.runningText}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
