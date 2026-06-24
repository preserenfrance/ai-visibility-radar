"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ScanRunnerProps = {
  scanId?: string;
  endpoint?: string;
  intervalMs?: number;
  refreshOnStep?: boolean;
};

export function ScanRunner({
  intervalMs = 5000,
  refreshOnStep = true,
}: ScanRunnerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!refreshOnStep) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, refreshOnStep, router]);

  return null;
}
