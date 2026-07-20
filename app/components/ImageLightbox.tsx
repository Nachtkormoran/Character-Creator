"use client";

import { useEffect, useState } from "react";
import { useBackdropClose } from "./useBackdropClose";

/**
 * Zeigt ein Bild in voller Größe über der restlichen Oberfläche.
 *
 * Bewusst ein einfaches <img> statt next/image: die Bilder sind Data-URLs mit
 * unbekannten Maßen (generiert 1024×1024, hochgeladene können abweichen), und
 * Nexts Bildoptimierung greift bei Data-URLs ohnehin nicht.
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Hintergrund nicht mitscrollen lassen, solange die Ansicht offen ist.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const backdrop = useBackdropClose(onClose, { stopPropagation: true });

  return (
    <div
      // z-80: oberste Ebene – über Detail-Modal (z-50) und Bilder-Ansicht (z-70).
      className="fixed inset-0 z-80 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 backdrop-blur-sm"
      // stopPropagation ist hier entscheidend: die Lightbox wird innerhalb des
      // Galerie-Modals gerendert, dessen Backdrop bei jedem Klick schließt.
      // Ohne das würde ein Klick zum Schließen der Lightbox auch die
      // Detailansicht dahinter mitschließen.
      {...backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Schließen"
        className="absolute right-4 top-4 rounded-md px-3 py-1.5 text-2xl leading-none text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={(e) =>
          setSize({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
      />

      <p className="text-sm text-white/60">
        {size ? `${size.w} × ${size.h} px` : "…"} · Klick daneben oder Esc zum
        Schließen
      </p>
    </div>
  );
}
