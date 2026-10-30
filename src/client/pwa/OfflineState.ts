// Whether the page is offline: no network, or no server behind it. Offline,
// only single-player works (it runs in this browser), so the menu hides or
// disables everything that needs the server: multiplayer, the lobby list,
// sign-in, cosmetics, the store (styles.css, GameModeSelector).
//
// The truth lives on <html> as the `offline` class, set before the first
// paint by index.html's bootstrap script when the browser reports no network
// or the service worker served its cached app shell because the network
// failed (OFFLINE_META in ServiceWorkerRules.ts). From then on the browser's
// online/offline events move it, and while offline with a network that
// claims to be up, a probe of the server decides.

import { OFFLINE_META } from "@openfront/shared/ServiceWorkerRules";

/** Dispatched on document whenever the state changes; detail: boolean. */
export const OFFLINE_CHANGE_EVENT = "offline-change";

const OFFLINE_CLASS = "offline";
// How often to ask the server again while offline with a network that is up.
const PROBE_INTERVAL_MS = 20_000;
const PROBE_TIMEOUT_MS = 5_000;

/** Whether the page was served offline (the worker's mark) or has no network. */
export function startsOffline(
  doc: Pick<Document, "querySelector">,
  onLine: boolean,
): boolean {
  return !onLine || doc.querySelector(`meta[name="${OFFLINE_META}"]`) !== null;
}

export function isOffline(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains(OFFLINE_CLASS)
  );
}

export function setOffline(offline: boolean): void {
  if (offline === isOffline()) return;
  document.documentElement.classList.toggle(OFFLINE_CLASS, offline);
  document.dispatchEvent(
    new CustomEvent<boolean>(OFFLINE_CHANGE_EVENT, { detail: offline }),
  );
}

/** Calls `listener` on every change; returns the unsubscribe. */
export function onOfflineChange(listener: (offline: boolean) => void) {
  const handler = (e: Event) => listener((e as CustomEvent<boolean>).detail);
  document.addEventListener(OFFLINE_CHANGE_EVENT, handler);
  return () => document.removeEventListener(OFFLINE_CHANGE_EVENT, handler);
}

/**
 * Whether the server answers. The app shell is what is asked for: it is
 * never answered by the service worker for a plain fetch, and a 5xx is a
 * proxy telling us the server behind it is down.
 */
export async function probeServer(
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher("/", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

let started = false;
let probeTimer: ReturnType<typeof setTimeout> | null = null;

/** Starts following the network. Once per page; Main calls it at boot. */
export function initOfflineState(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (startsOffline(document, navigator.onLine)) setOffline(true);
  window.addEventListener("offline", () => {
    stopProbing();
    setOffline(true);
  });
  window.addEventListener("online", () => void recheck());
  if (isOffline() && navigator.onLine) scheduleProbe();
}

async function recheck(): Promise<void> {
  stopProbing();
  if (await probeServer()) {
    setOffline(false);
  } else {
    setOffline(true);
    scheduleProbe();
  }
}

function scheduleProbe(): void {
  stopProbing();
  probeTimer = setTimeout(() => {
    probeTimer = null;
    if (navigator.onLine) void recheck();
  }, PROBE_INTERVAL_MS);
}

function stopProbing(): void {
  if (probeTimer !== null) clearTimeout(probeTimer);
  probeTimer = null;
}
