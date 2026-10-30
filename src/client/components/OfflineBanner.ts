import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { isOffline, onOfflineChange } from "../pwa/OfflineState";
import { translateText } from "../Utils";

/**
 * The menu's "offline, solo only" line (pwa/OfflineState.ts). It says why
 * the multiplayer buttons are off and the account and store are gone.
 */
@customElement("offline-banner")
export class OfflineBanner extends LitElement {
  @state() private offline = isOffline();
  private unsubscribe: (() => void) | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.offline = isOffline();
    this.unsubscribe = onOfflineChange((offline) => (this.offline = offline));
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.disconnectedCallback();
  }

  render() {
    if (!this.offline) return nothing;
    return html`<p class="atlas-offline-banner" role="status">
      <svg
        viewBox="0 0 24 24"
        class="atlas-offline-banner-icon"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.6 5.3A15 15 0 0 1 22 8.8" />
        <path d="M5 12.5a10 10 0 0 1 3.4-2M15.7 10.6A10 10 0 0 1 19 12.5" />
        <path d="M8.5 16a5 5 0 0 1 7 0" />
        <path d="M12 20h.01" />
        <path d="M3 3l18 18" />
      </svg>
      <span>${translateText("pwa.offline_banner")}</span>
    </p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "offline-banner": OfflineBanner;
  }
}
