import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Platform } from "../Platform";
import {
  canPromptInstall,
  INSTALL_CHANGE_EVENT,
  installOffer,
  promptInstall,
  runningStandalone,
} from "../pwa/InstallPrompt";
import { isOffline, onOfflineChange } from "../pwa/OfflineState";
import { translateText } from "../Utils";

const HINT_DISMISSED_KEY = "pwa_ios_hint_dismissed";

/**
 * "Install as an app" on the menu (pwa/InstallPrompt.ts): a small button
 * where the browser can install the page, a one-line share-sheet hint on
 * iOS, nothing once it runs installed.
 */
@customElement("install-app-prompt")
export class InstallAppPrompt extends LitElement {
  @state() private canPrompt = canPromptInstall();
  @state() private offline = isOffline();
  @state() private hintDismissed = false;
  private unsubscribe: (() => void) | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      this.hintDismissed = localStorage.getItem(HINT_DISMISSED_KEY) === "true";
    } catch {
      this.hintDismissed = false;
    }
    this.canPrompt = canPromptInstall();
    this.offline = isOffline();
    window.addEventListener(INSTALL_CHANGE_EVENT, this.onInstallChange);
    this.unsubscribe = onOfflineChange((offline) => (this.offline = offline));
  }

  disconnectedCallback() {
    window.removeEventListener(INSTALL_CHANGE_EVENT, this.onInstallChange);
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.disconnectedCallback();
  }

  private onInstallChange = () => {
    this.canPrompt = canPromptInstall();
  };

  private install = async () => {
    try {
      await promptInstall();
    } catch (err) {
      console.warn("Install prompt failed", err);
    }
  };

  private dismissHint = () => {
    try {
      localStorage.setItem(HINT_DISMISSED_KEY, "true");
    } catch {
      // No storage: dismissed for this page only.
    }
    this.hintDismissed = true;
  };

  render() {
    const offer = installOffer({
      standalone: runningStandalone(window),
      canPrompt: this.canPrompt,
      isIOS: Platform.isIOS,
      hintDismissed: this.hintDismissed,
      offline: this.offline,
    });
    if (offer === "button") {
      return html`<button
        type="button"
        class="atlas-install"
        data-install-app
        @click=${this.install}
      >
        <svg
          viewBox="0 0 24 24"
          class="atlas-install-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
          <path d="M5 19h14" />
        </svg>
        <span>${translateText("pwa.install")}</span>
      </button>`;
    }
    if (offer === "ios-hint") {
      return html`<p class="atlas-install-hint" data-ios-install-hint>
        <span>${translateText("pwa.ios_hint")}</span>
        <button
          type="button"
          class="atlas-install-hint-close"
          aria-label=${translateText("common.close")}
          @click=${this.dismissHint}
        >
          ×
        </button>
      </p>`;
    }
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "install-app-prompt": InstallAppPrompt;
  }
}
