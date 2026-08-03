import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Quadratischer Knopf für ein einzelnes Icon. `label` ist Pflicht und wird zum
 * `aria-label` **und** `title` – die Ex-Emoji-Icons trugen ihre Bedeutung nur
 * implizit; hier ist sie für Screenreader und Hover verbindlich.
 */
type Variant = "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
};

export function IconButton({
  label,
  variant = "ghost",
  className = "",
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-md transition disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
