import { assetUrl } from "@openfront/shared/AssetUrls";
import { SOURCE_URL, UPSTREAM_URL } from "@openfront/shared/Branding";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { composeVersionDisplay, desktopVersion } from "../DesktopShell";
import { currentGameVersion } from "../GameVersion";
import "./SteamWishlistButton";

@customElement("page-footer")
export class Footer extends LitElement {
  // Per instance, not at module scope: currentGameVersion reads
  // BOOTSTRAP_CONFIG, which the server injects into the page and which is not
  // guaranteed to exist at the moment this module is first imported.
  private readonly gameVersion = currentGameVersion();

  // Starts as the game version alone and gains the shell version once the
  // bridge answers, so the line is never blank while that call is in flight.
  @state() private versionLabel = this.gameVersion;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // desktopVersion() resolves null off the desktop shell and on its own
    // timeout, so this can only ever leave the label as-is or extend it.
    void desktopVersion().then((shellVersion) => {
      this.versionLabel = composeVersionDisplay(this.gameVersion, shellVersion);
    });
  }

  render() {
    return html`
      <footer
        class="[.in-game_&]:hidden bg-zinc-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-1 pt-1 pb-3 text-white/50 w-full border-t border-white/10 shrink-0 relative z-50 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-0"
      >
        <!-- Icons and notices stay centred on the bar; on desktop they share
             it with the Steam promo, which gets its own grid column so the
             two can never overlap however wide a translation runs. -->
        <div
          class="flex w-full flex-col items-center gap-1 lg:col-start-2 lg:w-auto"
        >
          <div
            class="flex items-center justify-center gap-4 lg:gap-6 pt-2 w-full relative"
          >
            <!-- This fork's source code (AGPL v3 section 13). -->
            <a
              href=${SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="opacity-60 hover:opacity-100 hover:scale-110 transition-all"
            >
              <img
                src=${assetUrl("icons/github-mark-white.svg")}
                data-i18n-alt="main.github"
                class="h-6 w-6 lg:h-7 lg:w-7 object-contain pointer-events-none"
                draggable="false"
              />
            </a>
            <!-- The rules of the game this one is based on. -->
            <a
              href="https://openfront.wiki/Main_Page"
              target="_blank"
              rel="noopener noreferrer"
              class="opacity-60 hover:opacity-100 hover:scale-110 transition-all"
            >
              <img
                src=${assetUrl("icons/wiki-logo.svg")}
                data-i18n-alt="main.wiki"
                class="h-6 w-6 lg:h-7 lg:w-7 object-contain pointer-events-none"
                draggable="false"
              />
            </a>
          </div>
          <!-- The nav bar shows the game version alone so it reads the same
               across web and Steam; the full string, shell version included,
               lives down here where a player can quote it in a bug report. -->
          <div class="footer-version text-xs mt-1 lg:mt-2 text-center px-4">
            ${this.versionLabel}
          </div>
          <!-- LICENSE, AGPL v3 section 7: upstream's copyright notice stays
               visible (7(b)) and the game says what it is based on (7(c)). -->
          <div
            class="text-xs mt-1 lg:mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4"
          >
            <span data-i18n="main.copyright"></span>
            <a
              href=${UPSTREAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-i18n="branding.based_on"
              class="hover:text-white transition-colors"
            ></a>
            <a
              href=${SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-i18n="branding.source_code"
              class="hover:text-white transition-colors"
            ></a>
          </div>
        </div>

        <!-- Phones keep the full store widget on the play page instead; there
             is no room for it here. -->
        <div
          class="hidden lg:flex lg:col-start-3 lg:items-center lg:justify-end lg:pt-2 lg:pr-20"
        >
          <steam-wishlist-button
            campaign="home_desktop"
            class="min-w-0 flex-1 max-w-[544px]"
          ></steam-wishlist-button>
        </div>

        <!-- Single instance: translateText() resolves the active language via
             document.querySelector("lang-selector"), so a second one would
             shadow it. -->
        <lang-selector
          class="absolute right-4 top-3 lg:top-1/2 lg:-translate-y-1/2"
        ></lang-selector>
      </footer>
    `;
  }
}
