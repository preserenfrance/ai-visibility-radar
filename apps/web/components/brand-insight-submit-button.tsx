"use client";

import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BrandInsightSubmitButton({ hasValue }: { hasValue: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      className="h-8 px-2"
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {pending ? "Pripravljam..." : hasValue ? "Osveži" : "Pripravi"}
    </Button>
  );
}
