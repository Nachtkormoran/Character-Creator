import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

/**
 * Der eine Knopf fürs ganze UI – token-getrieben, ersetzt das über die App
 * verstreute `rounded-md …`-Inline-Muster. Der sichtbare Fokusring kommt global
 * über `:focus-visible` (s. `globals.css`).
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-border text-foreground hover:bg-muted disabled:opacity-50",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger:
    "border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
