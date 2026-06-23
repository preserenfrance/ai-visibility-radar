"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DONE_STATUSES = new Set(["completed", "failed", "canceled"]);
const QUEUED_RETRY_MULTIPLIER = 4;

type ScanRunnerProps =
  | {
      scanId: string;
      endpoint?: never;
      intervalMs?: number;
      refreshOnStep?: boolean;
    }
  | {
      endpoint: string;
      scanId?: never;
      intervalMs?: number;
      refreshOnStep?: boolean;
    };

export function ScanRunner(props: ScanRunnerProps) {
  const router = useRouter();
  const endpoint = props.endpoint ?? `/api/scans/${props.scanId}/run-next`;
  const intervalMs = props.intervalMs ?? 1200;
  const refreshOnStep = props.refreshOnStep ?? true;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function runNextStep() {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (refreshOnStep) {
          router.refresh();
        }
        const status = data?.scan?.status;
        if (!DONE_STATUSES.has(status)) {
          timer = window.setTimeout(
            runNextStep,
            status === "queued"
              ? intervalMs * QUEUED_RETRY_MULTIPLIER
              : intervalMs,
          );
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
  }, [endpoint, intervalMs, refreshOnStep, router]);

  return null;
}
