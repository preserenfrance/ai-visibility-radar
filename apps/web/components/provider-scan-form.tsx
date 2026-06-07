"use client";

import { useFormStatus } from "react-dom";
import { Loader2, PlayCircle, Search } from "lucide-react";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
import { Button } from "@/components/ui/button";

export function ProviderScanForm({
  brandId,
  action
}: {
  brandId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-white p-4">
      <input type="hidden" name="brandId" value={brandId} />
      <div>
        <div className="text-sm font-semibold">Zaženi AI scan</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Izberi navadne modele za hiter pregled ali modele s searchom, kadar želiš vire in citate.
        </p>
      </div>

      <div className="grid gap-3">
        <fieldset className="grid gap-2 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">Modeli brez searcha</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => (
              <ProviderCheckbox
                key={provider.id}
                name="providers"
                value={provider.id}
                label={provider.label}
                description={provider.description}
                defaultChecked={provider.id === "openai"}
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
  defaultChecked = false
}: {
  name: string;
  value: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-3 text-sm">
      <input className="mt-1" type="checkbox" name={name} value={value} defaultChecked={defaultChecked} />
      <span>
        <span className="block font-medium">{label}</span>
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
          Zaženi izbrane modele
        </>
      )}
    </Button>
  );
}
