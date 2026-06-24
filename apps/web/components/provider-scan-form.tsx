"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { LockKeyhole, Loader2, PlayCircle, Search } from "lucide-react";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
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
        <div className="text-sm font-semibold">Zaženi AI scan</div>
        {!compact && (
          <p className="mt-1 text-sm text-muted-foreground">
            Izberi navadne modele za hiter pregled ali modele s searchom, kadar
            želiš vire in citate.
          </p>
        )}
        {!manualScanAccess && (
          <p className="mt-2 rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
            Ročni zagon promptov je vključen v paket Starter ali Growth.
          </p>
        )}
        {manualScanUsage && (
          <div className="mt-2 grid gap-1 rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground sm:grid-cols-3">
            <span>
              Porabljeno:{" "}
              <strong className="text-foreground">
                {manualScanUsage.used}/{manualScanUsage.limit}
              </strong>
            </span>
            <span>
              Na voljo:{" "}
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
            Modeli brez searcha
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
            Modeli s searchom in citati
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => (
              <ProviderCheckbox
                key={`${provider.id}-search`}
                name="providersWithSearch"
                value={provider.id}
                label={`${provider.label} + search`}
                description="Počasneje, vendar zbira vire za tabelo citatov."
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
          <Link href="/app/settings">
            <LockKeyhole className="h-4 w-4" />
            Nadgradi za ročni zagon
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
          Dodajam scan v vrsto
        </>
      ) : limitReached ? (
        "Mesečni limit dosežen"
      ) : (
        <>
          <PlayCircle className="h-4 w-4" />
          Ponovno preglej ali me ima AI rada
        </>
      )}
    </Button>
  );
}
