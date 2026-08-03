import type { HTMLAttributes } from "react";

/**
 * Kleine Pille für Merkmale/Status. `tabular` schaltet Ziffern auf
 * `tabular-nums` (für Zahlenwerte wie Alter/Größe – kein Zeilenspringen).
 */
export function Badge({
  tabular = false,
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tabular?: boolean }) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground ${
        tabular ? "tabular-nums" : ""
      } ${className}`}
    />
  );
}
