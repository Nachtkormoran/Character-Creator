import type { HTMLAttributes } from "react";

/**
 * Flächen-Baustein – ersetzt das über die App verstreute
 * `rounded-xl border border-black/10 bg-white dark:…`-Inline-Muster durch
 * token-getriebenes `bg-card border-border`.
 */
export function Card({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-xl border border-border bg-card ${className}`}
    />
  );
}
