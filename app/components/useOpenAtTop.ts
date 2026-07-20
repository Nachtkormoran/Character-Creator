"use client";

import { useEffect, type RefObject } from "react";

/**
 * Rollt eine frisch geöffnete Ebene in den Blick.
 *
 * **Das Problem:** Jede Ebene ist `fixed inset-0` – normalerweise also am
 * Sichtfenster verankert, egal wie weit die Seite gescrollt ist. Hier gilt das
 * nicht: Die inneren Ebenen werden **im DOM der äußeren** gerendert (Begründung
 * in `CLAUDE.md` unter „Modale Ebenen"), und jede äußere trägt
 * `backdrop-blur-sm`. Ein `backdrop-filter` macht das Element aber zum
 * **Bezugsrahmen für `position: fixed`-Nachfahren** – genau wie `transform` oder
 * `filter`. Das `fixed` der inneren Ebene bezieht sich damit auf den gescrollten
 * Container der äußeren und nicht mehr aufs Sichtfenster.
 *
 * Sichtbar wurde es beim Ableiten eines Szenarios: Der Knopf dafür steht in der
 * Fußzeile der Charakter-Detailansicht, man hat also zwangsläufig ein Stück
 * gescrollt, um ihn zu erreichen – und der Dialog öffnete oberhalb des
 * Sichtbaren. Wer ihn nicht suchte, sah nichts.
 *
 * **Warum nicht die Ursache beseitigen:** Ein Portal an `document.body` würde
 * die Verschachtelung auflösen, aber die gesamte Ereignis-Logik hängt an ihr –
 * `useBackdropClose` und der Esc-Handler in der Capture-Phase gehen davon aus,
 * dass die innere Ebene im DOM der äußeren liegt. Das Weichzeichnen zu
 * entfernen wäre die andere Möglichkeit, kostet aber genau den Effekt, für den
 * es da ist.
 *
 * `scrollIntoView` rollt alle beteiligten Container so weit wie nötig – den
 * äußeren Dialog ebenso wie das Fenster – und ist damit unabhängig davon, wer
 * am Ende tatsächlich scrollt. Ohne `behavior: "smooth"`: Eine Animation beim
 * Öffnen wäre eine Bewegung, die niemand angefordert hat.
 */
export function useOpenAtTop(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start", behavior: "auto" });
    // Nur beim Öffnen: Später soll die Ebene dort bleiben, wo der Nutzer sie
    // hingescrollt hat.
  }, [ref]);
}
