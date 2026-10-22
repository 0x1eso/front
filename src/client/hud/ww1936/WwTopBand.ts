import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { renderNumber } from "@openfront/engine-lib/Format";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { factionDotClass } from "../../components/ww1936/FactionDot";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import { WwDepthOpenEvent, WwMultiSelectEvent } from "./DepthEvents";
import { BandDepth, DoctrineModel } from "./DoctrineModel";
import { menText, TopBandEconomy, topBandEconomy } from "./EconomyModel";
import { landSelectionOf } from "./LandSelection";
import { multiSelectOf } from "./MultiSelect";
import {
  BandPolitics,
  bandStats,
  politicsInput,
  TONE_CLASS,
} from "./PoliticsModel";
import {
  type BandModel,
  bandModel,
  countryName,
  enemiesOf,
  wwActive,
} from "./WorldWarModel";
import {
  OpenWwDiplomacyEvent,
  OpenWwIndustryEvent,
  OpenWwPoliticsEvent,
} from "./WwDrawer";

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
 * ("🏭 32 / 16 👥 1.2M −3.2K ●" and P2's "🪖 112") and the compact one
 * without manpower and divisions. Text runs longer in some games: the band
 * also measures itself (WwTopBand.updated).
 */
export const CHIP_FULL_PX = 220;
export const CHIP_COMPACT_PX = 100;

/** How much of the economy chip shows. */
export type ChipMode = "full" | "compact" | "none";
const CHIP_MODES: readonly ChipMode[] = ["full", "compact", "none"];

/**
 * P3 (spec §21.1): how much of the politics chips shows — all (political
 * power with its daily gain under it, stability, war support, tension),
 * without the gain (also on a short landscape screen), political power and
 * tension only, or none (the 🏛 and 🌐 dials open the same drawers).
 */
export type PolMode = "full" | "compact" | "minimal" | "none";

/**
 * The band sheds a step at a time when it runs out of room: the economy
 * chip's manpower, the economy chip, the political power gain, stability
 * and war support, then the politics chips. Step 0..MAX_SHED_STEP.
 */
export const MAX_SHED_STEP = 5;
/** A shortened country name narrower than this sheds a step too, in CSS px. */
const NAME_MIN_PX = 56;
const POL_MODES: readonly PolMode[] = ["full", "compact", "minimal", "none"];

export function polMode(step: number, short: boolean): PolMode {
  const i = Math.max(0, step - 2);
  return POL_MODES[Math.min(POL_MODES.length - 1, Math.max(short ? 1 : 0, i))];
}

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
  // P5 pre-flight §0-1: an exile still has its band.
  if (!wwActive(game, me.smallID())) return null;
  if (view.detail(me.smallID()) === null) return null;
  const s = view.summary(me.smallID());
  return s === null ? null : topBandEconomy(s);
}

/**
 * P2 (spec §15.1): my divisions, and while I'm at war the men lost today
 * (shown beside manpower). Null with no land data for my country yet.
 */
export interface BandLand {
  divisions: number;
  casualtiesText: string | null;
}

/**
 * P4 (spec §18.1): "⛽ 34K" — my fuel stock, red while yesterday's fuel
 * ratio was under 100%. Null with no economy chip.
 */
export interface BandFuel {
  text: string;
  short: boolean;
  pct: number;
}

export function bandFuel(game: GameView): BandFuel | null {
  const view = game.wwEconomy?.() ?? null;
  const me = game.myPlayer();
  if (view === null || me === null) return null;
  const d = view.detail(me.smallID());
  const s = view.summary(me.smallID());
  if (d === null || s === null) return null;
  const pct = Math.floor(s.fuelRatioPm / 10);
  return {
    text: renderNumber(Math.floor(d.fuelMilli / 1000)),
    short: s.fuelRatioPm < 1000,
    pct,
  };
}

export function bandLand(game: GameView): BandLand | null {
  const me = game.myPlayer();
  const s =
    me === null ? undefined : game.wwLand?.()?.countries.get(me.smallID());
  if (me === null || s === undefined) return null;
  const atWar = enemiesOf(game, me.smallID()).length > 0;
  return {
    divisions: s.divisions,
    casualtiesText:
      atWar && s.casualtiesToday > 0 ? menText(s.casualtiesToday) : null,
  };
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
  private land: BandLand | null = null;
  private fuel: BandFuel | null = null;
  /** P3: my political power, stability, war support and the world's tension. */
  private politics: BandPolitics | null = null;
  /** P6 (spec §20.1): command power, energy, congress, atomic bombs. */
  private depth: BandDepth | null = null;
  /** The small row command power and congress move to when the band is full (the 🏛 cell opens it). */
  @state() private depthRow = false;
  /** The multi-select bar's version, and whether its marshal list is open. */
  private multiSeen = -1;
  @state() private choosingFm = false;
  @state() private frontNote = false;
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

  /** The shed step now: the room's economy chip mode, then what the band measured. */
  private step(maxWidth: number): number {
    return Math.min(
      MAX_SHED_STEP,
      CHIP_MODES.indexOf(chipMode(maxWidth)) + this.chipShrink,
    );
  }

  /** How much of the chip shows now. */
  private chip(maxWidth: number): ChipMode {
    return CHIP_MODES[Math.min(this.step(maxWidth), CHIP_MODES.length - 1)];
  }

  protected updated() {
    // Longer text than CHIP_*_PX allow for: shed a step at a time until
    // the band fits its room.
    const band = this.querySelector<HTMLElement>("[data-ww-band]");
    if (band === null || (this.economy === null && this.politics === null)) {
      return;
    }
    const { maxWidth } = this.placement ?? bandPlacement();
    // The country name shortens first, but never to nothing.
    const name = band.querySelector<HTMLElement>("[data-ww-name]");
    const squeezed =
      name !== null &&
      name.scrollWidth > name.clientWidth + 1 &&
      name.clientWidth < NAME_MIN_PX;
    if (
      (band.scrollWidth > band.clientWidth + 1 || squeezed) &&
      this.step(maxWidth) < MAX_SHED_STEP
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
    const land = econ === null ? null : bandLand(this.game);
    const wasLand = this.land;
    const fuel = econ === null ? null : bandFuel(this.game);
    if (JSON.stringify(fuel) !== JSON.stringify(this.fuel)) {
      this.fuel = fuel;
      this.chipShrink = 0;
      this.requestUpdate();
    }
    const depth = new DoctrineModel(this.game).band();
    if (JSON.stringify(depth) !== JSON.stringify(this.depth)) {
      this.depth = depth;
      this.chipShrink = 0;
      this.requestUpdate();
    }
    const multi = multiSelectOf(landSelectionOf(this.game));
    if (multi.version !== this.multiSeen) {
      this.multiSeen = multi.version;
      if (!multi.active) this.choosingFm = this.frontNote = false;
      this.requestUpdate();
    }
    const pi = politicsInput(this.game);
    const pol = pi === null ? null : bandStats(pi);
    if (JSON.stringify(pol) !== JSON.stringify(this.politics)) {
      this.politics = pol;
      this.chipShrink = 0;
      this.requestUpdate();
    }
    if (
      land?.divisions !== wasLand?.divisions ||
      land?.casualtiesText !== wasLand?.casualtiesText
    ) {
      this.land = land;
      this.chipShrink = 0;
      this.requestUpdate();
    }
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
          : ""} z-[1002] h-8 flex items-center gap-3 overflow-x-clip overflow-y-visible whitespace-nowrap rounded-b-lg bg-gray-900/85 px-3 text-sm text-white shadow-md"
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
              <span data-ww-name class="min-w-0 truncate"
                >${countryName(m.myTag)}</span
              >
              ${m.myFaction === null
                ? nothing
                : html`<span
                    class="size-2 shrink-0 rounded-full ${factionDotClass(
                      m.myFaction,
                    )}"
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
        ${this.renderFuel(this.chip(maxWidth))}
        ${this.renderPolitics(
          polMode(
            this.step(maxWidth),
            window.innerHeight <= COMPACT_MAX_HEIGHT,
          ),
        )}
        ${this.renderDepth(this.step(maxWidth))}
      </div>
      ${this.renderDepthRow(this.step(maxWidth), maxWidth, right)}
      ${this.renderMultiBar(maxWidth, right)}
    `;
  }

  /** Whether the band is too full for command power and congress inline (a later shed step). */
  private depthInRow(): boolean {
    const { maxWidth } = this.placement ?? bandPlacement();
    return this.step(maxWidth) >= 3;
  }

  private depthRowHolds(): boolean {
    return this.depth !== null;
  }

  /**
   * P6 (spec §20.1): "🎖 3.4" command power (opens the doctrine drawer's
   * command tab), "⚡ 92%" under full energy (orange), "🏛 의회 34%" for
   * the US, "☢ 2" my atomic bombs. Icon and number only on a short screen.
   */
  private depthChip(
    kind: string,
    text: string,
    label: string,
    open: () => void,
    tone = "",
  ) {
    return html`<button
      type="button"
      data-ww-depth=${kind}
      aria-label=${label}
      class="relative flex h-6 shrink-0 items-center rounded-md border border-white/15 bg-white/5 px-2 text-xs tabular-nums after:absolute after:inset-x-0 after:-top-1 after:-bottom-2 after:content-[''] hover:bg-white/10 ${tone}"
      @click=${open}
    >
      ${text}
    </button>`;
  }

  private depthChips(rowOnly: boolean | null) {
    const d = this.depth;
    if (d === null) return nothing;
    const short = window.innerHeight <= COMPACT_MAX_HEIGHT;
    const cmd = html`${this.depthChip(
      "cp",
      `🎖 ${d.cpText}`,
      translateText("ww1936.command.band_cp", { n: d.cpText }),
      () =>
        this.eventBus.emit(
          new WwDepthOpenEvent("doctrine", { tab: "command" }),
        ),
    )}`;
    const congress =
      d.congressPct === null
        ? nothing
        : this.depthChip(
            "congress",
            short
              ? `🏛 ${d.congressPct}%`
              : `🏛 ${translateText("ww1936.congress.band_short")} ${d.congressPct}%`,
            translateText("ww1936.congress.band", { pct: d.congressPct }),
            () => this.eventBus.emit(new OpenWwPoliticsEvent("decisions")),
          );
    const energy =
      d.energyPct === null
        ? nothing
        : this.depthChip(
            "energy",
            `⚡ ${d.energyPct}%`,
            translateText("ww1936.energy.band", { pct: d.energyPct }),
            () => this.eventBus.emit(new OpenWwIndustryEvent("construction")),
            "border-amber-400/70 bg-amber-900/40 text-amber-200",
          );
    const nukes =
      d.nukes === null
        ? nothing
        : this.depthChip(
            "nukes",
            `☢ ${d.nukes}`,
            translateText("ww1936.nuke.band", { n: d.nukes }),
            () => this.eventBus.emit(new WwDepthOpenEvent("projects")),
          );
    if (rowOnly === true) return html`${cmd} ${congress}`;
    if (rowOnly === false) return html`${energy} ${nukes}`;
    return html`${cmd} ${congress} ${energy} ${nukes}`;
  }

  private renderDepth(step: number) {
    // Command power and congress inline while there is room; energy and bombs always.
    return this.depthChips(step >= 3 ? false : null);
  }

  private renderDepthRow(step: number, maxWidth: number, right: number | null) {
    if (step < 3 || !this.depthRow || this.depth === null) return nothing;
    return html`<div
      data-ww-depth-row
      class="fixed top-8 ${right === null
        ? "left-1/2 -translate-x-1/2"
        : ""} z-[1002] flex items-center gap-2 rounded-b-lg bg-gray-900/85 px-3 py-1 text-white shadow-md"
      style="max-width: ${maxWidth}px;${right === null
        ? ""
        : ` right: ${right}px;`}"
    >
      ${this.depthChips(true)}
    </div>`;
  }

  /**
   * P6 (spec §20.4): "3 armies chosen · [Make army group] [Front] [Cancel]"
   * under the band while several armies are chosen.
   */
  private renderMultiBar(maxWidth: number, right: number | null) {
    const multi = multiSelectOf(landSelectionOf(this.game));
    if (!multi.active) return nothing;
    const model = new DoctrineModel(this.game);
    const group = model
      .groups()
      .find(
        (g) =>
          g.armies.length === multi.armies.length &&
          g.armies.every((a) => multi.has(a)),
      );
    const cancel = () => {
      multi.cancel();
      this.eventBus.emit(new WwMultiSelectEvent([]));
    };
    const btn =
      "h-9 shrink-0 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20";
    return html`<div
      data-ww-multi
      class="fixed ${this.depthRow ? "top-16" : "top-9"} ${right === null
        ? "left-1/2 -translate-x-1/2"
        : ""} z-[1002] flex flex-col gap-1 rounded-lg bg-gray-900/92 px-2 py-1 text-xs text-white shadow-md"
      style="max-width: ${maxWidth}px;${right === null
        ? ""
        : ` right: ${right}px;`}"
    >
      <div class="flex items-center gap-2">
        <span data-ww-multi-count class="shrink-0 font-bold"
          >${translateText("ww1936.ag.selected", {
            n: multi.armies.length,
          })}</span
        >
        <button
          type="button"
          data-ww-multi-create
          class=${btn}
          @click=${() => (this.choosingFm = !this.choosingFm)}
        >
          ${translateText("ww1936.ag.create")}
        </button>
        <button
          type="button"
          data-ww-multi-front
          class=${btn}
          @click=${() => {
            if (group === undefined) this.frontNote = true;
            else multi.startFront(group.id);
          }}
        >
          ${translateText("ww1936.ag.front")}
        </button>
        <button
          type="button"
          data-ww-multi-cancel
          class=${btn}
          @click=${cancel}
        >
          ${translateText("ww1936.ag.cancel")}
        </button>
      </div>
      ${multi.frontGroup !== null
        ? html`<p data-ww-multi-hint class="m-0 text-amber-300">
            ${translateText(
              multi.pending === null
                ? "ww1936.ag.front_hint"
                : "ww1936.ag.front_confirm",
            )}
          </p>`
        : nothing}
      ${this.frontNote && group === undefined
        ? html`<p class="m-0 text-amber-300">
            ${translateText("ww1936.ag.front_needs_group")}
          </p>`
        : nothing}
      ${this.choosingFm
        ? html`<div data-ww-multi-fms class="flex flex-col gap-1">
            ${model.freeMarshals().length === 0
              ? html`<p class="m-0 text-white/70">
                    ${translateText("ww1936.ag.no_marshal")}
                  </p>
                  <button
                    type="button"
                    class=${btn}
                    @click=${() =>
                      this.eventBus.emit(
                        new WwDepthOpenEvent("doctrine", { tab: "command" }),
                      )}
                  >
                    ${translateText("ww1936.ag.open_command")}
                  </button>`
              : model.freeMarshals().map(
                  (f) =>
                    html`<button
                      type="button"
                      data-ww-multi-fm=${f.id}
                      class="${btn} text-left"
                      @click=${() => {
                        this.eventBus.emit(
                          new SendWwOrderIntentEvent({
                            kind: "ag_create",
                            fm: f.id,
                            armies: [...multi.armies],
                          }),
                        );
                        cancel();
                      }}
                    >
                      ${f.name}
                      <span class="text-white/60"
                        >${f.traits
                          .map((t) => translateText(`ww1936.fm_trait.${t}`))
                          .join(", ")}</span
                      >
                    </button>`,
                )}
          </div>`
        : nothing}
    </div>`;
  }

  /**
   * P3 (spec §21.1): "🏛 132" with "+2.3" under it, "⚖ 62%", "⚔ 45%"
   * (orange under 50%, red under 30%) open the politics drawer's
   * government tab; "🌍 34%" at the right end opens the diplomacy drawer's
   * world tab.
   */
  private renderPolitics(mode: PolMode) {
    const p = this.politics;
    if (p === null || mode === "none") return nothing;
    return html`<button
        type="button"
        data-ww-politics=${mode}
        aria-label=${mode === "minimal"
          ? p.ppLabel
          : `${p.ppLabel}, ${p.stabLabel}, ${p.wsLabel}`}
        class="flex h-6 shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 text-xs tabular-nums hover:bg-white/10"
        @click=${() => {
          // A full band keeps command power and congress in a row this cell opens.
          if (this.depthInRow() && this.depthRowHolds()) {
            this.depthRow = !this.depthRow;
          } else this.eventBus.emit(new OpenWwPoliticsEvent("government"));
        }}
      >
        <span data-ww-pp class="flex flex-col items-center leading-none">
          <span>🏛 ${p.pp}</span>
          ${mode === "full"
            ? html`<span data-ww-pp-gain class="text-xs text-emerald-300"
                >${p.gain}</span
              >`
            : nothing}
        </span>
        ${mode === "minimal"
          ? nothing
          : html`<span data-ww-stability class=${TONE_CLASS[p.stabTone]}
                >⚖ ${p.stabPct}%</span
              >
              <span data-ww-war-support class=${TONE_CLASS[p.wsTone]}
                >⚔ ${p.wsPct}%</span
              >`}
      </button>
      <button
        type="button"
        data-ww-tension
        aria-label=${p.wtLabel}
        class="h-6 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs tabular-nums hover:bg-white/10"
        @click=${() => this.eventBus.emit(new OpenWwDiplomacyEvent("world"))}
      >
        🌍 ${p.wtPct}%
      </button>`;
  }

  /**
   * P4 (spec §18.1): "⛽ 34K" (red while short) opens the industry
   * drawer's resources tab at the fuel row. 24 px drawn, 36 px to the
   * finger: its hit area reaches the screen's top edge and below the band
   * (the band clips sideways only).
   */
  private renderFuel(mode: ChipMode) {
    const f = this.fuel;
    if (f === null || mode === "none") return nothing;
    const label = f.short
      ? translateText("ww1936.navy.band_fuel_short", { pct: f.pct })
      : translateText("ww1936.navy.band_fuel", { n: f.text });
    return html`<button
      type="button"
      data-ww-fuel=${f.short ? "short" : "ok"}
      aria-label=${label}
      class="relative flex h-6 shrink-0 items-center rounded-md border px-2 text-xs tabular-nums after:absolute after:inset-x-0 after:-top-1 after:-bottom-2 after:content-[''] ${f.short
        ? "border-red-400/70 bg-red-900/50 text-red-200"
        : "border-white/15 bg-white/5 hover:bg-white/10"}"
      @click=${() =>
        this.eventBus.emit(
          new OpenWwIndustryEvent("trade", null, null, null, true),
        )}
    >
      ${translateText("ww1936.navy.band_fuel", { n: f.text })}
    </button>`;
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
      ${mode === "full" && this.land?.casualtiesText
        ? html`<span data-ww-casualties class="text-red-300"
            >${translateText("ww1936.land.band_casualties", {
              n: this.land.casualtiesText,
            })}</span
          >`
        : nothing}
      ${mode === "full" && this.land !== null
        ? // P2 (spec §15.1): my divisions. A count only: the ⚔ dial opens
          // the army drawer (a separate button here would be under 36 px).
          html`<span
            data-ww-divisions
            aria-label=${translateText("ww1936.land.band_divisions", {
              n: this.land.divisions,
            })}
            >🪖 ${this.land.divisions}</span
          >`
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
