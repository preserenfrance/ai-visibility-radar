"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-5 py-8">
      <section className="max-w-xl rounded-md border bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">
          Pogleda ni bilo mogoče naložiti
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Navigacija je naletela na napako. Poskusi ponovno ali osveži stran.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Koda napake: {error.digest}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Poskusi ponovno
          </Button>
          <Button asChild type="button" variant="outline">
            <a href="/app/dashboard">Moje znamke</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
