import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./GameWordmark";
import "./NavAccountMenu";
import { NavNotificationsController } from "./NavNotificationsController";
import "./NavUtilityIcons";

@customElement("desktop-nav-bar")
export class DesktopNavBar extends LitElement {
  private _notifications = new NavNotificationsController(this);

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("showPage", this._onShowPage);

    const current = window.currentPageId;
    if (current) {
      // Wait for render
      this.updateComplete.then(() => {
        this._updateActiveState(current);
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("showPage", this._onShowPage);
  }

  private _onShowPage = (e: Event) => {
    const pageId = (e as CustomEvent).detail;
    this._updateActiveState(pageId);
  };

  private _updateActiveState(pageId: string) {
    this.querySelectorAll(".nav-menu-item").forEach((el) => {
      if ((el as HTMLElement).dataset.page === pageId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;

    return html`
      <nav class="atlas-nav hidden lg:flex w-full shrink-0 z-50 relative">
        <div
          class="w-full max-w-[20cm] 2xl:max-w-[24cm] desktop:max-w-[min(100%,clamp(80rem,50%,90rem))] mx-auto flex items-center justify-between gap-8 h-[4.5rem]"
        >
          <!-- The wordmark is the way home, now that there is no Play link.
               The tagged version lives in the footer with the build. -->
          <button
            class="nav-menu-item atlas-home-link ${currentPage === "page-play"
              ? "active"
              : ""}"
            data-page="page-play"
            data-i18n-aria-label="main.home"
          >
            <game-wordmark align="start"></game-wordmark>
          </button>
          <div class="flex items-center gap-8">
            <!-- Desktop Navigation Menu Items -->
            <div class="relative no-game-portal no-self-host">
              <button
                class="nav-menu-item ${currentPage === "page-item-store"
                  ? "active"
                  : ""} text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
                data-page="page-item-store"
                data-i18n="main.store"
                @click=${this._notifications.onStoreClick}
              ></button>
              ${this._notifications.showStoreDot()
                ? html`
                    <span
                      class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"
                    ></span>
                    <span
                      class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
                    ></span>
                  `
                : ""}
            </div>
            <button
              class="no-self-host nav-menu-item ${currentPage ===
              "page-inventory"
                ? "active"
                : ""} text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
              data-page="page-inventory"
              data-i18n="main.inventory"
            ></button>
            <button
              class="no-self-host nav-menu-item text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
              data-page="page-leaderboard"
              data-i18n="main.leaderboard"
            ></button>
            <button
              class="no-game-portal no-self-host nav-menu-item text-white/70 hover:text-blue-500 font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-blue-500"
              data-page="page-clan"
              data-i18n="main.clans"
            ></button>
            <!-- Utility cluster: help, settings and the profile control are
                 utility affordances rather than page links, so they sit
                 tight together instead of in the nav item list. -->
            <div class="atlas-nav-utilities flex items-center gap-1">
              <nav-utility-icons size="desktop"></nav-utility-icons>
              <nav-account-menu
                variant="desktop"
                class="no-self-host"
              ></nav-account-menu>
            </div>
          </div>
        </div>
      </nav>
    `;
  }
}
