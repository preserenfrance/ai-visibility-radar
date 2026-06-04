import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
