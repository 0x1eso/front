import { assetUrl } from "@openfront/shared/AssetUrls";
import { UPSTREAM_URL } from "@openfront/shared/Branding";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { composeVersionDisplay, desktopVersion } from "../DesktopShell";
import { currentGameVersion } from "../GameVersion";
import { runningSourceUrl } from "../SourceLinks";
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
    const sourceUrl = runningSourceUrl();
    return html`
      <footer
        class="atlas-footer [.in-game_&]:hidden relative z-50 w-full shrink-0 bg-zinc-900/90 border-t border-white/10 text-white/60"
      >
        <!-- One slim row on tablets and up, so the pages opened from the
             menu keep the height; stacked on phones. -->
        <div
          class="mx-auto w-full max-w-[20cm] 2xl:max-w-[24cm] desktop:max-w-[min(100%,clamp(80rem,50%,90rem))] flex flex-col lg:flex-row items-center justify-between gap-x-6 gap-y-1 px-4 lg:px-0 py-2 lg:py-1.5"
        >
          <!-- LICENSE, AGPL v3 section 7: upstream's copyright notice stays
               visible (7(b)) and the game says what it is based on (7(c)).
               The source link is section 13. -->
          <div
            class="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 text-xs"
          >
            <span data-i18n="main.copyright"></span>
            <a
              href=${UPSTREAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-i18n="branding.based_on"
              class="atlas-footer-link hover:text-white transition-colors"
            ></a>
            <a
              href=${sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-i18n="branding.source_code"
              class="atlas-footer-link hover:text-white transition-colors"
            ></a>
          </div>

          <div class="flex items-center gap-1">
            <!-- The nav bar shows no version, so it reads the same across
                 web and Steam; the full string, shell version included,
                 lives down here where a player can quote it in a bug
                 report. -->
            <div class="footer-version text-xs tabular-nums px-2">
              ${this.versionLabel}
            </div>
            <!-- This fork's source code (AGPL v3 section 13). -->
            <a
              href=${sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="atlas-footer-icon opacity-60 hover:opacity-100 transition-opacity"
            >
              <img
                src=${assetUrl("icons/github-mark-white.svg")}
                data-i18n-alt="main.github"
                class="h-6 w-6 object-contain pointer-events-none"
                draggable="false"
              />
            </a>
            <!-- The rules of the game this one is based on. -->
            <a
              href="https://openfront.wiki/Main_Page"
              target="_blank"
              rel="noopener noreferrer"
              class="atlas-footer-icon opacity-60 hover:opacity-100 transition-opacity"
            >
              <img
                src=${assetUrl("icons/wiki-logo.svg")}
                data-i18n-alt="main.wiki"
                class="h-6 w-6 object-contain pointer-events-none"
                draggable="false"
              />
            </a>
            <!-- Single instance: translateText() resolves the active
                 language via document.querySelector("lang-selector"), so a
                 second one would shadow it. -->
            <lang-selector></lang-selector>
            <!-- Renders nothing on a self-hosted server or on Steam. -->
            <steam-wishlist-button
              campaign="home_desktop"
              class="hidden lg:flex min-w-0 max-w-[544px]"
            ></steam-wishlist-button>
          </div>
        </div>
      </footer>
    `;
  }
}
