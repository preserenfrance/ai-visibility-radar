"use client";

import { Loader2, Search } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function PromptContentReviewSubmit({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button size="sm" type="submit" disabled={disabled || pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Search className="h-4 w-4" />
      )}
      {pending ? "Checking..." : "Check"}
    </Button>
  );
}
