"use client";

import { useState } from "react";
import { Clipboard, Loader2, Plus, WandSparkles } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/analytics-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PromptGapSuggestion = {
  text: string;
  category: string;
  reason: string;
};

export function PromptGapGenerator({
  brandId,
  textareaId,
  disabled,
  availablePromptSlots,
}: {
  brandId: string;
  textareaId: string;
  disabled: boolean;
  availablePromptSlots: number;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PromptGapSuggestion[]>([]);

  async function generateGaps() {
    setIsPending(true);
    setError(null);
    trackAnalyticsEvent("prompt_gap_generate_click", {
      brand_id: brandId,
      available_prompt_slots: availablePromptSlots,
    });

    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/gaps`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        suggestions?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Prompt gaps could not be generated.");
      }
      const nextSuggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter(isPromptGapSuggestion)
        : [];
      setSuggestions(nextSuggestions);
      trackAnalyticsEvent("prompt_gap_generated", {
        brand_id: brandId,
        suggestion_count: nextSuggestions.length,
      });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Prompt gaps could not be generated.",
      );
    } finally {
      setIsPending(false);
    }
  }

  function insertSuggestion(text: string, scope: "single" | "all") {
    const textarea = document.getElementById(textareaId);
    if (!(textarea instanceof HTMLTextAreaElement)) {
      copyText(text, scope);
      return;
    }

    const nextValue = [textarea.value.trim(), text.trim()]
      .filter(Boolean)
      .join("\n");
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, nextValue);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    trackAnalyticsEvent("prompt_gap_insert_click", {
      brand_id: brandId,
      scope,
    });
  }

  async function copyText(text: string, scope: "single" | "all") {
    try {
      await navigator.clipboard?.writeText(text);
      trackAnalyticsEvent("prompt_gap_copy_click", {
        brand_id: brandId,
        scope,
      });
    } catch {
      setError(
        "Prompt could not be copied. Insert it into the textarea instead.",
      );
    }
  }

  const allSuggestionText = suggestions
    .map((suggestion) => suggestion.text)
    .join("\n");

  return (
    <div className="mb-4 rounded-md border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Prompt gap generator</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate missing buyer questions from current prompts, competitors,
            citations and recent scan results.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={generateGaps}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating
            </>
          ) : (
            <>
              <WandSparkles className="h-4 w-4" />
              Generate gaps
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Suggested gaps</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => insertSuggestion(allSuggestionText, "all")}
              >
                <Plus className="h-4 w-4" />
                Insert all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyText(allSuggestionText, "all")}
              >
                <Clipboard className="h-4 w-4" />
                Copy all
              </Button>
            </div>
          </div>
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.text}-${index}`}
              className="rounded-md border bg-white p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{suggestion.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {suggestion.reason}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{suggestion.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => insertSuggestion(suggestion.text, "single")}
                >
                  <Plus className="h-4 w-4" />
                  Insert
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(suggestion.text, "single")}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isPromptGapSuggestion(value: unknown): value is PromptGapSuggestion {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.text === "string" &&
    typeof record.category === "string" &&
    typeof record.reason === "string"
  );
}
