"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function OnboardingBrandForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <CardContent>
      <form action={action} className="grid gap-3" onSubmit={() => setSubmitted(true)}>
        <div className="grid gap-2">
          <label htmlFor="organizationName" className="text-sm font-medium">Ime organizacije</label>
          <Input id="organizationName" name="organizationName" placeholder="Npr. SEOS group d.o.o." />
          <p className="text-xs text-muted-foreground">Če polje pustiš prazno, bo uporabljeno ime znamke.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="brandName" className="text-sm font-medium">Ime znamke</label>
            <Input id="brandName" name="brandName" placeholder="Npr. AI Visibility Radar" required />
          </div>
          <div className="grid gap-2">
            <label htmlFor="domain" className="text-sm font-medium">Domena znamke</label>
            <Input id="domain" name="domain" placeholder="domain.com" required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="country" className="text-sm font-medium">Trg oziroma država</label>
            <Input id="country" name="country" defaultValue="Slovenija" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="language" className="text-sm font-medium">Jezik promptov in poročil</label>
            <Input id="language" name="language" defaultValue="sl" />
            <p className="text-xs text-muted-foreground">Uporabi npr. sl za slovenščino ali en za angleščino.</p>
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="competitors" className="text-sm font-medium">Konkurenti</label>
          <Textarea id="competitors" name="competitors" placeholder="Konkurent A, Konkurent B" />
          <p className="text-xs text-muted-foreground">Vnesi jih ločeno z vejico, podpičjem ali vsakega v svojo vrstico.</p>
        </div>
        <SubmitArea submitted={submitted} />
      </form>
    </CardContent>
  );
}

function SubmitArea({ submitted }: { submitted: boolean }) {
  const { pending } = useFormStatus();
  const [seconds, setSeconds] = useState(0);
  const active = pending || submitted;

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <div className="grid gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ustvarjam znamko
          </>
        ) : (
          <>
            Ustvari znamko in prompte <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      {active && (
        <div className="rounded-md border bg-white p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Activity className="h-4 w-4 animate-pulse text-primary" />
            Priprava teče v ozadju
          </div>
          <p className="mt-2 text-muted-foreground">
            Ustvarjamo organizacijo, dodajamo znamko, beremo domeno in pripravljamo začetne prompte. To lahko traja približno minuto.
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Čas priprave</span>
            <span>{seconds}s</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
