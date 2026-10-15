import { GAME_TITLE } from "@openfront/shared/Branding";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../Utils";

/**
 * The game's name in the menus, in place of upstream's logo image (whose
 * files are all-rights-reserved, proprietary/LICENSE). Text, so it follows
 * the player's language, with the "Based on OpenFront" line AGPL section
 * 7(c) asks a modified version to carry.
 */
@customElement("game-wordmark")
export class GameWordmark extends LitElement {
  /** The name alone, smaller, for the mobile top bar. */
  @property({ type: Boolean }) compact = false;

  /** "start" sets both lines flush left, as in the desktop nav bar. */
  @property({ type: String }) align: "center" | "start" = "center";

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div
        class="flex flex-col ${this.align === "start"
          ? "items-start"
          : "items-center"} leading-none select-none"
      >
        <span
          class="game-wordmark-title font-extrabold uppercase tracking-[0.2em] text-white ${this
            .compact
            ? "text-lg"
            : "text-2xl"}"
          >${translateText("branding.title", { name: GAME_TITLE })}</span
        >
        ${this.compact
          ? null
          : html`<span
              class="game-wordmark-based-on mt-1 text-[0.65rem] uppercase tracking-widest text-white/60"
              >${translateText("branding.based_on")}</span
            >`}
      </div>
    `;
  }
}
