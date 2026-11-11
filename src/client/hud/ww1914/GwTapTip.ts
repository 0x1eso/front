import { html } from "lit";
import {
  hideFloatingTooltip,
  showFloatingTooltip,
} from "../../components/FloatingTooltip";

/**
 * ww179: the panel's hover lines (`title`) on a phone. A finger never hovers,
 * so a tap on a line with a hover shows the same text in the shared floating
 * tooltip, a second tap on it or a tap anywhere else hides it. A mouse keeps
 * the browser's own hover, so nothing here runs for it.
 */
let shown: Element | null = null;

/** The element whose hover line a tap at `target` shows, or null. */
export function tipAnchor(
  root: Element,
  target: EventTarget | null,
): HTMLElement | null {
  if (!(target instanceof Element) || !root.contains(target)) return null;
  const el = target.closest<HTMLElement>("[title]");
  if (el === null || !root.contains(el)) return null;
  return (el.getAttribute("title") ?? "").trim() === "" ? null : el;
}

/** One finger tap: show the line under it, or hide the one shown. */
export function tapTip(roots: Iterable<Element>, e: Event): void {
  const type = (e as PointerEvent).pointerType;
  if (type === "mouse" || type === undefined) return;
  let el: HTMLElement | null = null;
  for (const root of roots) el ??= tipAnchor(root, e.target);
  if (el === null || el === shown) {
    hideTapTip();
    return;
  }
  shown = el;
  showFloatingTooltip(
    el,
    html`<span class="whitespace-pre-line">${el.getAttribute("title")}</span>`,
  );
}

export function hideTapTip(): void {
  if (shown === null) return;
  shown = null;
  hideFloatingTooltip();
}

/** The 1914 screens whose hover lines a tap shows (the panel, the lens). */
const roots = new Set<Element>();
const onTap = (e: Event) => tapTip(roots, e);

/** Listens on the whole page, so a tap on the map hides the line too. */
export function installTapTip(root: Element): () => void {
  if (roots.size === 0) document.addEventListener("pointerup", onTap, true);
  roots.add(root);
  return () => {
    roots.delete(root);
    if (roots.size > 0) return;
    document.removeEventListener("pointerup", onTap, true);
    hideTapTip();
  };
}
