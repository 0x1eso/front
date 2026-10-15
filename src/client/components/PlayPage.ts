import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./GameWordmark";
import "./NavAccountMenu";
import "./NavUtilityIcons";

@customElement("play-page")
export class PlayPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div id="page-play" class="flex flex-col flex-1 w-full min-h-0">
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <!-- Mobile: Fixed top bar -->
        <div
          class="lg:hidden fixed left-0 right-0 top-[var(--top-ad-height,0px)] z-40 pt-[env(safe-area-inset-top)] bg-surface border-b border-white/10"
        >
          <div
            class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-14 px-2 gap-2"
          >
            <!-- no-self-host: every item in the menu needs the account API. -->
            <button
              id="hamburger-btn"
              class="no-self-host col-start-1 justify-self-start h-10 shrink-0 aspect-[4/3] flex text-white/90 rounded-md items-center justify-center transition-colors"
              data-i18n-aria-label="main.menu"
              aria-expanded="false"
              aria-controls="sidebar-menu"
              aria-haspopup="dialog"
              data-i18n-title="main.menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            <div
              class="col-start-2 flex items-center justify-center text-malibu-blue min-w-0"
            >
              <game-wordmark compact></game-wordmark>
            </div>

            <!-- Right slot: bell, help, settings and the profile control. The menu is
                 the account affordance on every platform now — on CrazyGames
                 its "Sign in" item hands off to their SDK prompt. -->
            <div
              class="col-start-3 justify-self-end shrink-0 flex items-center gap-0.5"
            >
              <nav-utility-icons size="mobile"></nav-utility-icons>
              <nav-account-menu
                variant="mobile"
                class="no-self-host"
              ></nav-account-menu>
            </div>
          </div>
        </div>

        <!-- Mobile: spacer for the fixed top bar -->
        <div
          class="lg:hidden shrink-0 h-[calc(env(safe-area-inset-top)+56px)]"
        ></div>

        <!-- The home plate (atlas.css): who you are, and the three ways into
             a game. Statecraft is played among friends, so there is no lobby
             list, news or promo strip around it. -->
        <section
          class="atlas-plate mx-auto my-auto w-[calc(100%-2rem)] max-w-[34rem]"
        >
          <p
            class="atlas-eyebrow"
            aria-hidden="true"
            data-i18n="main.name_label"
          ></p>
          <div class="atlas-field relative">
            <username-input class="block w-full h-14"></username-input>
          </div>
          <div class="atlas-rule" aria-hidden="true"></div>
          <game-mode-selector></game-mode-selector>
        </section>
      </div>
    `;
  }
}
