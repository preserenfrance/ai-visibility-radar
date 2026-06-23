"use client";

import { useFormStatus } from "react-dom";
import { LockKeyhole, Loader2, PlayCircle, Search } from "lucide-react";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
import { Button } from "@/components/ui/button";

export function ProviderScanForm({
  brandId,
  action,
  paidAccess,
}: {
  brandId: string;
  action: (formData: FormData) => Promise<void>;
  paidAccess: boolean;
}) {
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-white p-4">
      <input type="hidden" name="brandId" value={brandId} />
      <div>
        <div className="text-sm font-semibold">Zaženi AI scan</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Izberi navadne modele za hiter pregled ali modele s searchom, kadar
          želiš vire in citate.
        </p>
      </div>

      <div className="grid gap-3">
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
                locked={!paidAccess && provider.id !== "openai"}
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
                locked={!paidAccess}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <SubmitButton />
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
}: {
  name: string;
  value: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
  locked?: boolean;
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
              Plačljivo
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Dodajam scan v vrsto
        </>
      ) : (
        <>
          <PlayCircle className="h-4 w-4" />
          Ponovno preglej ali me ima AI rada
        </>
      )}
    </Button>
  );
}
