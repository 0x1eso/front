import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { bandModel, countryName, FACTION_DOT_CLASS } from "./WorldWarModel";

export class ToggleWwDiplomacyEvent implements GameEvent {}

/** Space between the band and the top-right HUD stack, in CSS px. */
const BAND_GAP = 8;
/**
 * Below this width the centred band can't hold the date, the flag and the
 * wars button: it moves left of the top-right stack instead (BandPlacement).
 */
export const BAND_MIN_PX = 240;

/**
 * Where the band goes: centred, as wide as the room it leaves the top-right
 * stack (timer and buttons) on both sides; or, when that room is under
 * BAND_MIN_PX (a narrow landscape phone), anchored `right` px from the
 * right edge, just left of the stack.
 */
export interface BandPlacement {
  maxWidth: number;
  right: number | null;
}

export function bandPlacement(): BandPlacement {
  const r = document
    .querySelector("[data-hud-top-right]")
    ?.getBoundingClientRect();
  const shown = r !== undefined && r.width > 0 && r.height > 0;
  const clear = (shown ? window.innerWidth - r.left : 0) + BAND_GAP;
  const centred = window.innerWidth - 2 * clear;
  if (centred >= BAND_MIN_PX) return { maxWidth: centred, right: null };
  return {
    maxWidth: Math.max(0, window.innerWidth - clear - BAND_GAP),
    right: clear,
  };
}

/**
 * World War 1936 (spec §8.2): a slim band at the top — the date (or the
 * preparation countdown), my country and faction, and my wars, which open
 * the diplomacy drawer. WW_BAND_PX tall. It never covers the top-right stack
 * (the timer): see bandPlacement. The country name shortens first.
 */
@customElement("ww-top-band")
export class WwTopBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /** Measured on every tick and resize; null until the first. */
  @state() private placement: BandPlacement | null = null;
  private readonly refit = () => {
    if (this.game?.worldWarScenario()) this.placement = bandPlacement();
  };

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this.refit);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.refit);
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    if (!this.game?.worldWarScenario()) return;
    // The top-right stack grows and shrinks during the game.
    this.refit();
    this.requestUpdate();
  }

  render() {
    if (!this.game?.worldWarScenario()) return null;
    const m = bandModel(this.game);
    const { maxWidth, right } = this.placement ?? bandPlacement();
    return html`
      <div
        data-ww-band
        class="fixed top-0 ${right === null
          ? "left-1/2 -translate-x-1/2"
          : ""} z-[1002] h-8 flex items-center gap-3 whitespace-nowrap rounded-b-lg bg-gray-900/85 px-3 text-sm text-white shadow-md"
        style="max-width: ${maxWidth}px;${right === null
          ? ""
          : ` right: ${right}px;`}"
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
