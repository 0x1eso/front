import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { bandModel, countryName, FACTION_DOT_CLASS } from "./WorldWarModel";

export class ToggleWwDiplomacyEvent implements GameEvent {}

/**
 * World War 1936 (spec §8.2): a slim band at the top — the date (or the
 * preparation countdown), my country and faction, and my wars, which open
 * the diplomacy drawer. WW_BAND_PX tall. It keeps 11rem clear on each side
 * for the top-left and top-right HUD; the country name shortens first.
 */
@customElement("ww-top-band")
export class WwTopBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  createRenderRoot() {
    return this;
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    if (this.game?.worldWarScenario()) this.requestUpdate();
  }

  render() {
    if (!this.game?.worldWarScenario()) return null;
    const m = bandModel(this.game);
    return html`
      <div
        data-ww-band
        class="fixed top-0 left-1/2 -translate-x-1/2 z-[1002] h-8 max-w-[calc(100vw-22rem)] flex items-center gap-3 whitespace-nowrap rounded-b-lg bg-gray-900/85 px-3 text-sm text-white shadow-md"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <span
          data-ww-date
          class="shrink-0 font-semibold tabular-nums ${m.inPrep
            ? "text-amber-300"
            : ""}"
        >
          ${m.label}
        </span>
        ${m.myTag === null
          ? nothing
          : html`<span class="flex min-w-0 items-center gap-1.5">
              <img
                src=${assetUrl(`flags/${COUNTRIES[m.myTag].flag}.svg`)}
                alt=""
                class="h-3.5 w-5 shrink-0 rounded-sm object-cover"
              />
              <span class="min-w-0 truncate">${countryName(m.myTag)}</span>
              ${m.myFaction === null
                ? nothing
                : html`<span
                    class="size-2 shrink-0 rounded-full ${FACTION_DOT_CLASS[
                      m.myFaction
                    ]}"
                  ></span>`}
            </span>`}
        <button
          type="button"
          data-ww-wars
          class="h-6 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs hover:bg-white/10"
          @click=${() => this.eventBus.emit(new ToggleWwDiplomacyEvent())}
        >
          ${translateText("ww1936.band.wars", { n: m.wars })}
        </button>
      </div>
    `;
  }
}
