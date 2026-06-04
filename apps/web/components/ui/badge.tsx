import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" | "warning" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "warning" && "bg-accent/20 text-amber-800",
        variant === "danger" && "bg-destructive/10 text-destructive",
        className
      )}
      {...props}
    />
  );
}
