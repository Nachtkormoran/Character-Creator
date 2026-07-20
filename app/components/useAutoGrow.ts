"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Lässt eine Textarea in der Höhe mit ihrem Inhalt mitwachsen, statt einen
 * inneren Scrollbalken zu bekommen.
 *
 * Als Hook und nicht als Komponente, weil die beiden Verwender **verschieden
 * aussehen** müssen: `AutoTextarea` ist randlos und soll wie Fließtext wirken,
 * die Felder der Szenario-Maske sind gerahmte Formularfelder. Das Verhalten
 * ist dasselbe, die Gestaltung nicht – und eine gemeinsame Komponente hätte
 * ihre Klassen über eine Fallunterscheidung mischen müssen, bei der Tailwind
 * nicht verlässlich sagt, welche Regel gewinnt.
 *
 * `rows` am Element wirkt weiter als **Mindesthöhe**: Bei `height: auto` ergibt
 * sich daraus die Höhe, und `scrollHeight` ist nie kleiner als die sichtbare
 * Fläche. Ein leeres Feld bleibt also so hoch, wie es angelegt wurde.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}
