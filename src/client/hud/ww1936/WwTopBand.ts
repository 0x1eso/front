import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { FACTION_DOT_CLASS } from "../../components/ww1936/FactionDot";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { TopBandEconomy, topBandEconomy } from "./EconomyModel";
import {
  type BandModel,
  bandModel,
  countryName,
  isCapitulated,
} from "./WorldWarModel";
import { OpenWwIndustryEvent } from "./WwDrawer";

export class ToggleWwDiplomacyEvent implements GameEvent {}

/** Space between the band and the top-right HUD stack, in CSS px. */
const BAND_GAP = 8;
/**
 * Below this width the centred band can't hold the date, the flag and the
 * wars button: it moves left of the top-right stack instead (BandPlacement).
 */
export const BAND_MIN_PX = 240;
/**
 * What the economy chip adds to that, with the band's gap: the whole chip
 * ("🏭 32 / 16 👥 1.10M ●") and the compact one without manpower. Text
 * runs longer in some games: the band also measures itself (WwTopBand.updated).
 */
export const CHIP_FULL_PX = 170;
export const CHIP_COMPACT_PX = 100;

/** How much of the economy chip shows. */
export type ChipMode = "full" | "compact" | "none";
const CHIP_MODES: readonly ChipMode[] = ["full", "compact", "none"];

/** The most of the chip a band `maxWidth` px wide holds beside the P0 content. */
export function chipMode(maxWidth: number): ChipMode {
  const room = maxWidth - BAND_MIN_PX;
  if (room >= CHIP_FULL_PX) return "full";
  return room >= CHIP_COMPACT_PX ? "compact" : "none";
}

/**
 * Where the band goes: centred, as wide as the room it leaves the top-right
 * stack (timer and buttons) on both sides; or, when that room is under
 * `minPx` (BAND_MIN_PX, plus the whole economy chip when it shows; a
 * narrow landscape phone), anchored `right` px from the right edge, just
 * left of the stack.
 */
export interface BandPlacement {
  maxWidth: number;
  right: number | null;
}

/** The top-right HUD stack (index.html). */
const TOP_RIGHT_STACK = "[data-hud-top-right]";

export function bandPlacement(
  stack: Element | null = document.querySelector(TOP_RIGHT_STACK),
  minPx = BAND_MIN_PX,
): BandPlacement {
  const r = stack?.getBoundingClientRect();
  const shown = r !== undefined && r.width > 0 && r.height > 0;
  const clear = (shown ? window.innerWidth - r.left : 0) + BAND_GAP;
  const centred = window.innerWidth - 2 * clear;
  if (centred >= minPx) return { maxWidth: centred, right: null };
  return {
    maxWidth: Math.max(0, window.innerWidth - clear - BAND_GAP),
    right: clear,
  };
}

/**
 * World War 1936 P1 (spec §13.1): the band's economy chip — my civilian /
 * military factories, manpower and a red dot while a line lacks a
 * resource. Null for a spectator, before my country's data arrives
 * (pre-flight R7.4), and once my country is gone or has capitulated.
 */
export function bandEconomy(game: GameView): TopBandEconomy | null {
  const view = game.wwEconomy?.() ?? null;
  const me = game.myPlayer();
  if (view === null || me === null) return null;
  if (!me.isAlive() || isCapitulated(game, me.smallID())) return null;
  if (view.detail(me.smallID()) === null) return null;
  const s = view.summary(me.smallID());
  return s === null ? null : topBandEconomy(s);
}

/**
 * World War 1936 (spec §8.2): a slim band at the top — the date (or the
 * preparation countdown), my country and faction, and my wars, which open
 * the diplomacy drawer; then (P1) the economy chip, which opens the
 * industry drawer. WW_BAND_PX tall. It never covers the top-right stack
 * (the timer): see bandPlacement. The country name shortens first, then
 * the chip loses its manpower, then the chip goes (the 🏭 dial stays).
 */
@customElement("ww-top-band")
export class WwTopBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /**
   * Measured when the top-right stack or the window changes size, not on
   * every tick; null until the first.
   */
  @state() private placement: BandPlacement | null = null;
  /** What the band shows, as of the last tick that changed it. */
  private model: BandModel | null = null;
  private economy: TopBandEconomy | null = null;
  /**
   * Steps the chip lost beyond chipMode() because the band measured as
   * overflowing (updated); reset whenever the room or the chip changes.
   */
  @state() private chipShrink = 0;
  /** The top-right stack being watched; null until it is found. */
  private stack: Element | null = null;
  private stackObserver: ResizeObserver | null = null;
  private readonly refit = () => {
    if (!this.game?.worldWarScenario()) return;
    // Centred only with room for the whole chip; beside the stack it has
    // more (the chip then shrinks only where even that is short).
    const next = bandPlacement(
      this.stack,
      BAND_MIN_PX + (this.economy === null ? 0 : CHIP_FULL_PX),
    );
    const prev = this.placement;
    // A new object would re-render the band even when nothing moved.
    if (prev?.maxWidth !== next.maxWidth || prev.right !== next.right) {
      this.placement = next;
      this.chipShrink = 0;
    }
  };

  /** How much of the chip shows now. */
  private chip(maxWidth: number): ChipMode {
    const i = CHIP_MODES.indexOf(chipMode(maxWidth)) + this.chipShrink;
    return CHIP_MODES[Math.min(i, CHIP_MODES.length - 1)];
  }

  protected updated() {
    // Longer text than CHIP_*_PX allow for: shed the chip a step at a time
    // until the band fits its room.
    const band = this.querySelector<HTMLElement>("[data-ww-band]");
    if (band === null || this.economy === null) return;
    const { maxWidth } = this.placement ?? bandPlacement();
    if (
      band.scrollWidth > band.clientWidth + 1 &&
      this.chip(maxWidth) !== "none"
    ) {
      this.chipShrink++;
    }
  }

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
    this.stackObserver?.disconnect();
    this.stackObserver = null;
    this.stack = null;
  }

  /**
   * Watches the top-right stack, which grows and shrinks during the game
   * (its left edge moves with its width). Retried on each tick until the
   * stack is in the page, and again if it is ever replaced.
   */
  private watchStack() {
    if (this.stack?.isConnected) return;
    const stack = document.querySelector(TOP_RIGHT_STACK);
    if (stack === null) {
      // Not there yet: measure without it once, then keep looking.
      if (this.placement === null) this.refit();
      return;
    }
    this.stackObserver?.disconnect();
    this.stack = stack;
    if (typeof ResizeObserver !== "undefined") {
      this.stackObserver = new ResizeObserver(this.refit);
      this.stackObserver.observe(stack);
    }
    this.refit();
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    if (!this.game?.worldWarScenario()) return;
    this.watchStack();
    // The date, the countdown, the wars and the economy chip: re-render
    // only when they change.
    const next = bandModel(this.game);
    const prev = this.model;
    const econ = bandEconomy(this.game);
    const was = this.economy;
    if (
      prev === null ||
      prev.label !== next.label ||
      prev.inPrep !== next.inPrep ||
      prev.myTag !== next.myTag ||
      prev.myFaction !== next.myFaction ||
      prev.wars !== next.wars ||
      (econ === null) !== (was === null) ||
      (econ !== null &&
        was !== null &&
        (econ.civ !== was.civ ||
          econ.mil !== was.mil ||
          econ.manpowerText !== was.manpowerText ||
          econ.shortage !== was.shortage))
    ) {
      const toggled = (econ === null) !== (was === null);
      this.model = next;
      this.economy = econ;
      this.chipShrink = 0;
      // The chip needs room: centred or beside the stack (bandPlacement).
      if (toggled) this.refit();
      this.requestUpdate();
    }
  }

  render() {
    if (!this.game?.worldWarScenario()) return null;
    const m = this.model ?? bandModel(this.game);
    const { maxWidth, right } = this.placement ?? bandPlacement();
    return html`
      <div
        data-ww-band
        class="fixed top-0 ${right === null
          ? "left-1/2 -translate-x-1/2"
          : ""} z-[1002] h-8 flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-b-lg bg-gray-900/85 px-3 text-sm text-white shadow-md"
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
        ${this.renderEconomy(this.chip(maxWidth))}
      </div>
    `;
  }

  private renderEconomy(mode: ChipMode) {
    const e = this.economy;
    if (e === null || mode === "none") return nothing;
    const label =
      translateText("ww1936.econ.band_label", {
        civ: e.civ,
        mil: e.mil,
        manpower: e.manpowerText,
      }) + (e.shortage ? ` · ${translateText("ww1936.econ.shortage")}` : "");
    return html`<button
      type="button"
      data-ww-economy=${mode}
      aria-label=${label}
      class="flex h-6 shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 text-xs tabular-nums hover:bg-white/10"
      @click=${() =>
        this.eventBus.emit(new OpenWwIndustryEvent("construction"))}
    >
      <span data-ww-factories>🏭 ${e.civ} / ${e.mil}</span>
      ${mode === "full"
        ? html`<span data-ww-manpower>👥 ${e.manpowerText}</span>`
        : nothing}
      ${e.shortage
        ? html`<span
            data-ww-shortage
            class="size-2 shrink-0 rounded-full bg-red-500"
          ></span>`
        : nothing}
    </button>`;
  }
}
