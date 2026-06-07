"use client";

import { useFormStatus } from "react-dom";
import { Loader2, PlayCircle } from "lucide-react";
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
          Izberi modele, ki naj preverijo znamko. Testni način ni več uporabniška možnost.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {AI_PROVIDER_OPTIONS.map((provider) => (
          <label key={provider.id} className="flex cursor-pointer items-start gap-2 rounded-md border bg-secondary/30 p-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              name="providers"
              value={provider.id}
              defaultChecked={provider.id === "openai"}
            />
            <span>
              <span className="block font-medium">{provider.label}</span>
              <span className="text-xs text-muted-foreground">{provider.description}</span>
            </span>
          </label>
        ))}
      </div>
      <SubmitButton />
    </form>
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
