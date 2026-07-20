"use client";

import { useRef } from "react";
import { useAutoGrow } from "./useAutoGrow";

/**
 * Textarea, die in der Höhe automatisch mit ihrem Inhalt mitwächst (kein
 * interner Scrollbalken). Standardmäßig randlos gestylt, sodass sie wie
 * normaler Fließtext aussieht – der Rahmen erscheint erst bei Hover/Fokus.
 */
export function AutoTextarea({
  value,
  onChange,
  className = "",
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      placeholder={placeholder}
      rows={1}
      className={`w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 leading-relaxed outline-none transition hover:border-black/15 focus:border-black/40 dark:hover:border-white/15 dark:focus:border-white/40 ${className}`}
    />
  );
}
