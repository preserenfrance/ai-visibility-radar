"use client";

import { useFormStatus } from "react-dom";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai-providers";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function FreeAuditForm({ action, errorMessage }: { action: (formData: FormData) => Promise<void>; errorMessage: string | null }) {
  return (
    <CardContent>
      {errorMessage && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <form action={action} className="grid gap-3">
        <Input name="domain" placeholder="domain.com" required />
        <Input name="brandName" placeholder="Ime znamke" required />
        <Input name="email" type="email" placeholder="ime@podjetje.si" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="country" defaultValue="Slovenija" />
          <Input name="language" defaultValue="sl" />
        </div>
        <Input name="competitors" placeholder="Konkurent A, Konkurent B" />
        <fieldset className="grid gap-2 rounded-md border bg-secondary/30 p-3">
          <legend className="px-1 text-sm font-medium">Izberi AI modele za test</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_PROVIDER_OPTIONS.map((provider) => (
              <label key={provider.id} className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-3 text-sm">
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
        </fieldset>
        <SubmitArea />
      </form>
    </CardContent>
  );
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
            Beremo domeno, pripravljamo prompte in pošiljamo izbrane modele na API. To lahko traja nekaj trenutkov.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
