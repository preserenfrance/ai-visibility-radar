"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DONE_STATUSES = new Set(["completed", "failed", "canceled"]);

export function ScanRunner({ scanId, intervalMs = 1200 }: { scanId: string; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function runNextStep() {
      try {
        const response = await fetch(`/api/scans/${scanId}/run-next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        router.refresh();
        const status = data?.scan?.status;
        if (!DONE_STATUSES.has(status)) {
          timer = window.setTimeout(runNextStep, intervalMs);
        }
      } catch {
        if (!cancelled) {
          timer = window.setTimeout(runNextStep, intervalMs * 3);
        }
      }
    }

    timer = window.setTimeout(runNextStep, 400);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [intervalMs, router, scanId]);

  return null;
}
