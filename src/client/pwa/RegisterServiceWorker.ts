// Registers the service worker (src/client/pwa/sw.ts, built to /sw.js) that
// makes the app installable and lets single-player run with no network.

import { SERVICE_WORKER_URL } from "@openfront/shared/ServiceWorkerRules";

export interface ServiceWorkerHost {
  /** A production build: dev has no sw.js. */
  production: boolean;
  /** The browser has service workers (a secure page in a modern browser). */
  supported: boolean;
  /** The Steam shell serves the bundle itself, from its own scheme. */
  desktopShell: boolean;
  /** Assets come from a CDN, which the worker's same-origin rules skip. */
  cdnBase: string;
}

/** Whether this page should have the service worker. */
export function serviceWorkerWanted(host: ServiceWorkerHost): boolean {
  return (
    host.production &&
    host.supported &&
    !host.desktopShell &&
    host.cdnBase === ""
  );
}

/**
 * Registers once the page has loaded, so the worker's precache (the whole
 * app shell) does not compete with the page's own first load. A failure only
 * costs offline play, so it is logged, not shown.
 */
export function registerServiceWorker(host: ServiceWorkerHost): void {
  if (!serviceWorkerWanted(host)) return;
  const register = () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: "/" })
      .catch((err: unknown) =>
        console.warn("Service worker registration failed", err),
      );
  };
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

/** Whether a service worker controls this page (it was installed). */
export function serviceWorkerActive(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller !== null
  );
}
