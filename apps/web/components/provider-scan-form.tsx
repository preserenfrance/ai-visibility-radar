"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { LockKeyhole, Loader2, PlayCircle, Search } from "lucide-react";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
import { trackAnalyticsEvent } from "@/components/analytics-events";
import { Button } from "@/components/ui/button";

export function ProviderScanForm({
  brandId,
  action,
  manualScanAccess,
  manualScanUsage,
  compact = false,
}: {
  brandId: string;
  action: (formData: FormData) => Promise<void>;
  manualScanAccess: boolean;
  manualScanUsage?: {
    used: number;
    limit: number;
    remaining: number;
    resetLabel: string;
  };
  compact?: boolean;
}) {
  const manualScanLimitReached = (manualScanUsage?.remaining ?? 1) <= 0;

  return (
    <form
      action={action}
      className={[
        "grid rounded-lg border bg-white",
        compact ? "gap-2 p-3" : "gap-3 p-4",
      ].join(" ")}
    >
      <input type="hidden" name="brandId" value={brandId} />
      <div>
        <div className="text-sm font-semibold">Run AI scan</div>
        {!compact && (
          <p className="mt-1 text-sm text-muted-foreground">
            Choose standard models for a quick scan or search-enabled models
            when you need sources and citations.
          </p>
        )}
        {!manualScanAccess && (
          <p className="mt-2 rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
            Manual prompt runs are included in the Starter or Growth plan.
          </p>
        )}
        {manualScanUsage && (
          <div className="mt-2 grid gap-1 rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground sm:grid-cols-3">
            <span>
              Used:{" "}
              <strong className="text-foreground">
                {manualScanUsage.used}/{manualScanUsage.limit}
              </strong>
            </span>
            <span>
              Available:{" "}
              <strong className="text-foreground">
                {manualScanUsage.remaining}
              </strong>
            </span>
            <span>Reset: {manualScanUsage.resetLabel}</span>
          </div>
        )}
      </div>

      <div className={compact ? "grid gap-2 md:grid-cols-2" : "grid gap-3"}>
        <fieldset className="grid gap-2 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">
            Models without search
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => (
              <ProviderCheckbox
                key={provider.id}
                name="providers"
                value={provider.id}
                label={provider.label}
                description={provider.description}
                defaultChecked={provider.id === "openai"}
                locked={!manualScanAccess}
                compact={compact}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2 rounded-md border bg-secondary/30 p-3">
          <legend className="flex items-center gap-1 px-1 text-sm font-medium">
            <Search className="h-4 w-4" />
            Models with search and citations
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => (
              <ProviderCheckbox
                key={`${provider.id}-search`}
                name="providersWithSearch"
                value={provider.id}
                label={`${provider.label} + search`}
                description="Slower, but collects sources for the citation table."
                locked={!manualScanAccess}
                compact={compact}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {manualScanAccess ? (
        <SubmitButton limitReached={manualScanLimitReached} />
      ) : (
        <Button asChild>
          <Link
            href="/app/settings"
            onClick={() =>
              trackAnalyticsEvent("upgrade_plan_click", {
                location: "manual_scan_locked",
                plan: "starter",
              })
            }
          >
            <LockKeyhole className="h-4 w-4" />
            Upgrade for manual runs
          </Link>
        </Button>
      )}
    </form>
  );
}

function ProviderCheckbox({
  name,
  value,
  label,
  description,
  defaultChecked = false,
  locked = false,
  compact = false,
}: {
  name: string;
  value: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
  locked?: boolean;
  compact?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2 rounded-md border bg-white p-3 text-sm ${
        locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        className="mt-1"
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked && !locked}
        disabled={locked}
      />
      <span>
        <span className="flex items-center gap-2 font-medium">
          {label}
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <LockKeyhole className="h-3 w-3" />
              Starter
            </span>
          )}
        </span>
        {!compact && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}

function SubmitButton({ limitReached }: { limitReached: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || limitReached}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Adding scan to queue
        </>
      ) : limitReached ? (
        "Monthly limit reached"
      ) : (
        <>
          <PlayCircle className="h-4 w-4" />
          Run a new AI visibility scan
        </>
      )}
    </Button>
  );
}
