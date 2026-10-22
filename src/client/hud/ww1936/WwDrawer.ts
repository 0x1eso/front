import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  COMPACT_MAX_HEIGHT,
  DrawerInsets,
  drawerInsets,
} from "../domestic/DomesticPanel";
import { WW_BAND_PX } from "./WorldWarModel";

// World War 1936 P1 (spec §13): the events of the economy screens and the
// frame both economy drawers share with the P0 diplomacy drawer's place.
// P3 (spec §21): the politics drawer joins them; the laws moved there, and
// the industry drawer's fourth tab is manpower (controller ruling R16).

export type WwIndustryTab =
  | "construction"
  | "production"
  | "trade"
  | "manpower";
export const WW_INDUSTRY_TABS: readonly WwIndustryTab[] = [
  "construction",
  "production",
  "trade",
  "manpower",
];

/** P3 spec §21.4: the politics drawer's five tabs. */
export type WwPoliticsTab =
  | "government"
  | "advisors"
  | "laws"
  | "spirits"
  | "decisions"
  // P6 (spec §13.1): the United States only, beside the five.
  | "congress";
export const WW_POLITICS_TABS: readonly WwPoliticsTab[] = [
  "government",
  "advisors",
  "laws",
  "spirits",
  "decisions",
];

/** P3 spec §21.5: the diplomacy drawer's four tabs. */
export type WwDiplomacyTab = "factions" | "wars" | "treaties" | "world";
export const WW_DIPLOMACY_TABS: readonly WwDiplomacyTab[] = [
  "factions",
  "wars",
  "treaties",
  "world",
];

/**
 * Open the politics drawer (P3 spec §21.1-2): with a tab, on that tab;
 * without one, on the last. Either toggles it shut when it already shows
 * that tab.
 */
export class OpenWwPoliticsEvent implements GameEvent {
  constructor(public readonly tab: WwPoliticsTab | null = null) {}
}

/** Open the diplomacy drawer on a tab (the band's tension, the news ticker). */
export class OpenWwDiplomacyEvent implements GameEvent {
  constructor(public readonly tab: WwDiplomacyTab | null = null) {}
}

/**
 * Open the industry drawer (pre-flight R7.3, I4). With a tab, on that tab;
 * without one, on the last tab. Either toggles it shut when it already
 * shows that tab — except with a region ("Build here" on the region card),
 * which always opens the construction tab with the region picked.
 */
export class OpenWwIndustryEvent implements GameEvent {
  constructor(
    public readonly tab: WwIndustryTab | null = null,
    public readonly region: number | null = null,
    /** P4: with a region, the building picked there (the air drawer's "build more"). */
    public readonly building: BuildingId | null = null,
    /** P4 (spec §18.8): the production tab's view, munitions or shipyards. */
    public readonly view: WwProductionView | null = null,
    /** P4 (spec §18.1): the band's ⛽ — the resources tab at the fuel row. */
    public readonly fuel = false,
  ) {}
}

/** P4 (spec §18.8): the industry drawer's production tab shows munitions or shipyards. */
export type WwProductionView = "munitions" | "shipyards";

/** P4 spec §18.5: the navy drawer's four tabs. */
export type WwNavyTab = "fleets" | "shipyards" | "convoys" | "admirals";
export const WW_NAVY_TABS: readonly WwNavyTab[] = [
  "fleets",
  "shipyards",
  "convoys",
  "admirals",
];

/** P4 spec §18.7: the air drawer's four tabs. */
export type WwAirTab = "zones" | "planes" | "bases" | "record";
export const WW_AIR_TABS: readonly WwAirTab[] = [
  "zones",
  "planes",
  "bases",
  "record",
];

/**
 * Open the navy drawer (the ⚓ dial, spec §18.1): with a tab, on that tab;
 * without one, on the last. Either toggles it shut when it already shows
 * that tab.
 */
export class OpenWwNavyEvent implements GameEvent {
  constructor(public readonly tab: WwNavyTab | null = null) {}
}

/** Open the air drawer (a long press on the ✈ dial, spec §18.1), like the navy drawer. */
export class OpenWwAirEvent implements GameEvent {
  constructor(public readonly tab: WwAirTab | null = null) {}
}

/** Open the research drawer, or close it when it is open. */
export class OpenWwResearchEvent implements GameEvent {}

export type WwDrawerId =
  | "industry"
  | "research"
  | "diplomacy"
  | "army"
  // P3 Task 7 (pre-flight R15): the national focus drawer.
  | "focus"
  // P3 Task 8: the politics drawer.
  | "politics"
  // P4 (spec §18.5, §18.7): the navy and air drawers.
  | "navy"
  | "air"
  // P6 (spec §20.3): the doctrine drawer.
  | "doctrine"
  // P6 (spec §20.5): the designer drawer.
  | "designer"
  // P6 (spec §20.6): the intelligence drawer.
  | "intel";

/**
 * A World War drawer opened or closed (pre-flight R7.2): one at a time, so
 * the others close when one opens; the dials outline the open one.
 */
export class WwDrawerEvent implements GameEvent {
  constructor(
    public readonly drawer: WwDrawerId,
    public readonly open: boolean,
  ) {}
}

/** Space between a drawer and the HUD around it, in CSS px. */
const GAP = 8;

/**
 * Where an economy drawer goes: right of the screen's middle (never over
 * the map's centre), above the bottom HUD's rows (the attack ratio and the
 * dials that open it) and left of the map buttons, below the band and the
 * top-right stack. On a short landscape screen (at most COMPACT_MAX_HEIGHT
 * tall) it runs from just below the band, over the top-right stack, like
 * the diplomacy drawer — but still stops above the bottom rows.
 */
export function wwDrawerInsets(): DrawerInsets {
  const i = drawerInsets();
  const top =
    window.innerHeight <= COMPACT_MAX_HEIGHT
      ? WW_BAND_PX + GAP
      : Math.max(i.top, WW_BAND_PX + GAP);
  return { top, right: i.right, bottom: i.bottom };
}

/** The drawer's width: at most 420 px, and never left of the screen's middle. */
export function wwDrawerWidth(right: number): string {
  return `min(420px, calc(50vw - ${right}px))`;
}

/**
 * The industry and research drawers: open and close, one at a time with
 * the diplomacy drawer, Back closes, the frame (title, close button, fixed
 * tab row, scrolling list). Above the hover card (z-1001), which would
 * otherwise sit on their buttons; the card ignores the pointer over them.
 */
export abstract class WwDrawerBase extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() protected open = false;
  @state() protected insets: DrawerInsets = {
    top: WW_BAND_PX + GAP,
    right: GAP,
    bottom: GAP,
  };
  /**
   * A short landscape screen (at most COMPACT_MAX_HEIGHT tall, a phone):
   * the tabs share the close button's row, so the list gets more room.
   */
  @state() protected compact = false;
  protected abstract readonly drawerId: WwDrawerId;
  private unregisterBack: (() => void) | null = null;
  private readonly refit = () => {
    const next = wwDrawerInsets();
    const prev = this.insets;
    if (
      prev.top !== next.top ||
      prev.right !== next.right ||
      prev.bottom !== next.bottom
    ) {
      this.insets = next;
    }
    const compact = window.innerHeight <= COMPACT_MAX_HEIGHT;
    if (compact !== this.compact) this.compact = compact;
  };

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwDrawerEvent, (e) => {
      if (e.open && e.drawer !== this.drawerId) this.setOpen(false);
    });
    // Back closes the drawer before it asks to leave the game.
    this.unregisterBack?.();
    this.unregisterBack = registerBackClosable(() => {
      if (!this.open) return false;
      this.setOpen(false);
      return true;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unregisterBack?.();
    this.unregisterBack = null;
    window.removeEventListener("resize", this.refit);
  }

  isOpen(): boolean {
    return this.open;
  }

  protected setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    if (open) {
      this.refit();
      window.addEventListener("resize", this.refit);
    } else {
      window.removeEventListener("resize", this.refit);
    }
    this.eventBus.emit(new WwDrawerEvent(this.drawerId, open));
  }

  getTickIntervalMs() {
    return 250;
  }

  /** While open, the HUD around the drawer grows and shrinks during the game. */
  protected refitIfOpen() {
    if (this.open) this.refit();
  }

  /**
   * The drawer: `head` (left of the close button), `tabs` (fixed) and
   * `body` (the only part that scrolls). `label` names it for screen readers.
   * On a short screen (`compact`) the tabs take the head's place beside
   * the close button — one fixed row instead of two; the name stays in
   * `label`, and the open drawer's dial is outlined.
   */
  protected renderFrame(
    label: string,
    head: TemplateResult,
    tabs: TemplateResult | typeof nothing,
    body: TemplateResult,
  ): TemplateResult {
    const { top, right, bottom } = this.insets;
    const merged = this.compact && tabs !== nothing;
    const close = html`<button
      type="button"
      data-ww-drawer-close
      class="size-9 shrink-0 rounded-md hover:bg-white/10"
      aria-label=${translateText("common.close")}
      @click=${() => this.setOpen(false)}
    >
      ✕
    </button>`;
    return html`
      <aside
        data-ww-drawer=${this.drawerId}
        data-compact=${String(merged)}
        aria-label=${label}
        class="fixed z-[1002] flex min-h-40 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/92 text-sm text-white shadow-xl"
        style="top: ${top}px; right: ${right}px; bottom: ${bottom}px; width: ${wwDrawerWidth(
          right,
        )};"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        ${merged
          ? html`<div
              data-ww-drawer-head
              class="flex shrink-0 items-center gap-1 border-b border-white/10 py-0.5 pl-1 pr-1"
            >
              ${tabs} ${close}
            </div>`
          : html`<div
                data-ww-drawer-head
                class="flex shrink-0 items-center gap-2 pl-3 pr-1 pt-1"
              >
                ${head} ${close}
              </div>
              ${tabs}`}
        <div data-ww-scroll class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          ${body}
        </div>
      </aside>
    `;
  }

  /**
   * A row of tab buttons that stays put while the list scrolls (beside the
   * close button on a short screen, renderFrame).
   */
  protected renderTabs<T extends string>(
    tabs: readonly T[],
    current: T,
    label: (t: T) => string,
    pick: (t: T) => void,
  ): TemplateResult {
    return html`<div
      role="tablist"
      class="flex gap-1 overflow-x-auto ${this.compact
        ? "min-w-0 flex-1"
        : "shrink-0 border-b border-white/10 px-2 pb-1"}"
    >
      ${tabs.map(
        (t) =>
          html`<button
            type="button"
            role="tab"
            data-ww-tab=${t}
            aria-selected=${String(t === current)}
            class="h-9 min-w-9 shrink-0 rounded-md px-2 text-xs font-semibold ${t ===
            current
              ? "bg-white/15 text-white"
              : "text-white/70 hover:bg-white/10"}"
            @click=${() => pick(t)}
          >
            ${label(t)}
          </button>`,
      )}
    </div>`;
  }
}
