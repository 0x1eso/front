import { translateText } from "./Utils";

// A small, non-blocking "reconnecting..." pill. Plain DOM rather than a Lit
// element: it is shown by Transport while the socket is down, must not
// intercept touches, and has to exist before any game UI does.
const BANNER_ID = "reconnect-banner";

export function showReconnectBanner(): void {
  if (document.getElementById(BANNER_ID)) return;
  const el = document.createElement("div");
  el.id = BANNER_ID;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = translateText("error_modal.reconnecting");
  el.style.cssText = [
    "position:fixed",
    "top:calc(env(safe-area-inset-top, 0px) + 8px)",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:2147483000",
    "padding:6px 14px",
    "border-radius:9999px",
    "background:rgba(180,83,9,0.92)",
    "color:#fff",
    "font:600 13px/1.2 sans-serif",
    "pointer-events:none",
    "box-shadow:0 2px 8px rgba(0,0,0,0.4)",
  ].join(";");
  document.body.appendChild(el);
}

export function hideReconnectBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}
