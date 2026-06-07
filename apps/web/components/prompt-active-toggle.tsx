"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function PromptActiveToggle({
  promptId,
  isActive
}: {
  promptId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={isActive}
        disabled={pending}
        onChange={(event) => {
          const checked = event.currentTarget.checked;
          startTransition(async () => {
            await fetch(`/api/prompts/${promptId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: checked })
            });
            router.refresh();
          });
        }}
      />
      <span>{pending ? "Shranjujem" : isActive ? "Aktiven" : "Neaktiven"}</span>
    </label>
  );
}
