/**
 * Registry simple para handlers de "tap-on-active-tab" del FloatingTabBar.
 *
 * Cada tab screen se registra al mount con sus handlers y se desuscribe
 * al unmount. El FloatingTabBar despacha contra este registry cuando
 * detecta que el usuario tappeó la sección que ya está activa:
 *
 *   - Si la screen NO está en el tope del scroll → scrollToTop animado.
 *   - Si la screen YA está en el tope                 → refresh.
 *
 * Imperatively-driven via refs para no causar re-renders inutiles —
 * los handlers cambian seguido (closures sobre state) y no queremos
 * que cada cambio dispare un re-render del tab bar.
 */

interface Handlers {
  /** Devuelve true si el contenido scrolleable está en su Y=0 actual. */
  isAtTop: () => boolean;
  /** Lleva el contenido al Y=0 (smooth animated). */
  scrollToTop: () => void;
  /** Trigger de refresh — debe sentirse clean / smooth / no tosco. */
  refresh: () => void;
}

const handlers = new Map<string, Handlers>();

/** Registra los handlers de una tab. Devuelve un cleanup function. */
export function registerTabTap(tab: string, h: Handlers): () => void {
  handlers.set(tab, h);
  return () => {
    if (handlers.get(tab) === h) handlers.delete(tab);
  };
}

/** Dispatch del tap. Llamado desde FloatingTabBar cuando la tab ya
 *  estaba activa. Lógica: si no está en top → scroll-to-top; si ya
 *  está → refresh. */
export function dispatchActiveTabTap(tab: string): void {
  const h = handlers.get(tab);
  if (!h) return;
  if (h.isAtTop()) {
    h.refresh();
  } else {
    h.scrollToTop();
  }
}
