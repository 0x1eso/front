import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  FACILITY_IDS,
  MEDALS,
  type RaidKind,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GENERAL_TRAITS,
  GeneralTrait,
  STANCES,
  traitBit,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TARGETS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_INVASION_LAUNCH_SUP_PM } from "@openfront/engine-api/ww1936/NavyTypes";
import { RAID_TARGETS } from "@openfront/engine-lib/ww1936/ProjectRules";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import { WwStrikeFlowEvent } from "./DepthEvents";
import { DepthMiscModel } from "./DepthMiscModel";
import { blockText } from "./EconomyModel";
import { garrisonScopes, myOccRows } from "./EndgameModel";
import {
  ARMY_BUTTONS,
  ArmyButton,
  armyCard,
  ArmyCardData,
  armyName,
  attackPreview,
  CardBlock,
  cardBlockText,
  daysOf,
  frontPreview,
  landSidesOf,
  movePreview,
  orderBlock,
  regionName,
  tapKind,
  tapOrder,
} from "./LandModel";
import {
  LandMode,
  landSelectionOf,
  OpenWwArmyEvent,
  WwLandModeEvent,
  WwLandSelection,
  WwSelectArmyEvent,
} from "./LandSelection";
import {
  invadeButtonBlock,
  invasionOf,
  invasionPreview,
  NavyCtx,
  navyCtx,
  NavyGame,
  srName,
} from "./NavyModel";
import {
  today,
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
  wwActive,
} from "./WorldWarModel";
import { WwDrawerEvent } from "./WwDrawer";
import { WwLandChangedEvent } from "./WwLandController";
import { renderRaidPicker } from "./WwRaidPicker";
import {
  seaAirOf,
  WwSeaAirChangedEvent,
  WwSeaAirModeEvent,
} from "./WwSeaAirController";

/** P4 (spec §18.3-5): a small ring of a landing's preparation. */
function prepRing(done: number, of: number): TemplateResult {
  const p = of <= 0 ? 0 : Math.max(0, Math.min(1, done / of));
  const c = 2 * Math.PI * 7;
  return html`<svg
    viewBox="0 0 18 18"
    class="inline-block size-4 align-middle"
    aria-hidden="true"
  >
    <circle
      cx="9"
      cy="9"
      r="7"
      fill="none"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="3"
    ></circle>
    <circle
      cx="9"
      cy="9"
      r="7"
      fill="none"
      stroke="#38bdf8"
      stroke-width="3"
      stroke-dasharray=${`${(p * c).toFixed(2)} ${c.toFixed(2)}`}
      transform="rotate(-90 9 9)"
    ></circle>
  </svg>`;
}

const BUTTON_KEYS: Readonly<Record<ArmyButton, string>> = {
  move: "ww1936.land.btn_move",
  attack: "ww1936.land.btn_attack",
  front: "ww1936.land.btn_front",
  plan: "ww1936.land.btn_plan",
  rail: "ww1936.land.btn_rail",
  sea: "ww1936.land.btn_sea",
  split: "ww1936.land.btn_split",
  merge: "ww1936.land.btn_merge",
  auto: "ww1936.land.btn_auto",
  more: "ww1936.land.btn_more",
};

const BUTTON_ICONS: Readonly<Record<ArmyButton, string>> = {
  move: "➜",
  attack: "⚔",
  front: "▬",
  plan: "➹",
  rail: "🚂",
  sea: "⚓",
  split: "✂",
  merge: "⊕",
  auto: "🤖",
  more: "⋯",
};

/** The buttons that set what the next map tap means (spec §15.3). */
const BUTTON_MODES: Readonly<Partial<Record<ArmyButton, LandMode>>> = {
  move: "move",
  attack: "attack",
  front: "front",
  plan: "plan",
  rail: "rail",
  sea: "sea",
};

/** The general's traits as small icons (pre-flight R7.7: emoji, no new images). */
export const TRAIT_ICONS: Readonly<Record<GeneralTrait, string>> = {
  panzer_leader: "🛡",
  infantry_officer: "🎖",
  cavalry_officer: "🐎",
  offensive_doctrine: "⚔",
  defensive_doctrine: "🏰",
  winter_specialist: "❄",
  desert_fox: "🏜",
  mountaineer: "⛰",
  river_crosser: "🌊",
  logistics_wizard: "📦",
  organizer: "📋",
  // P6 (spec §4.2).
  forest_expert: "🌲",
  urban_expert: "🏙",
  swamp_expert: "🐊",
  infantry_expert: "🎖",
  armor_expert: "🛡",
  artillery_officer: "💥",
  engineer_officer: "⛏",
  trickster: "🎭",
  commando: "🗡",
  guerrilla_fighter: "🌿",
  skirmisher: "👁",
  ambusher: "🪤",
};

const STANCE_KEYS = {
  careful: "ww1936.stance.careful",
  balanced: "ww1936.stance.balanced",
  aggressive: "ww1936.stance.aggressive",
} as const;

export function traitsOf(mask: number): GeneralTrait[] {
  return GENERAL_TRAITS.filter((t) => (mask & traitBit(t)) !== 0);
}

/** "+12%" / "−8%" from basis points. */
export function bpText(bp: number): string {
  const pct = Math.round(bp / 100);
  return pct > 0 ? `+${pct}%` : pct < 0 ? `−${-pct}%` : "0%";
}

/** Where a land card sits (spec §15.4, §15.9). */
export interface CardPlace {
  /** px above the viewport's bottom: right above the bottom HUD's rows. */
  bottom: number;
  /** px from the right edge when a drawer is open (left of it); null: centred. */
  right: number | null;
  /**
   * P4: px from the left edge on a short screen whose dials rise out of
   * the bottom rows (WwDials compact): the card keeps right of them.
   * Absent or null: as before.
   */
  left?: number | null;
  maxWidth: number;
  /** A quarter of the screen at most, and clear of the map's middle half. */
  maxHeight: number;
}

const GAP = 8;
/** Two rows of 36 px buttons and the padding: a card is never shorter. */
export const CARD_MIN_PX = 88;
/** P4: beside the risen dials a card needs at least this much width. */
export const CARD_MIN_WIDTH_PX = 300;

/**
 * A land card's place (spec §15.4, §15.9): bottom centre, right above the
 * bottom HUD's rows (the attack-ratio row stays clear), or left of an open
 * drawer so the two never overlap. Its height stops at a quarter of the
 * screen and at the map's middle half — on a tablet it fits between the
 * two; a landscape phone's rows leave no such room, so there the card
 * keeps its two button rows (CARD_MIN_PX) over the middle's lower edge.
 */
export function cardPlace(): CardPlace {
  const shown = (sel: string) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r !== undefined && r.width > 0 && r.height > 0 ? r : null;
  };
  const h = window.innerHeight;
  const rows = shown("[data-bottom-hud-rows]");
  const drawer = shown("[data-ww-drawer], [data-ww-diplomacy]");
  const rowsTop = rows === null ? h : rows.top;
  const bottom = h - rowsTop + GAP;
  const maxHeight = Math.max(
    CARD_MIN_PX,
    Math.min(Math.floor(h / 4), Math.floor(rowsTop - GAP - (h * 3) / 4)),
  );
  // P4: the risen dials (a short screen) stand above the rows' top: the
  // card keeps right of them — or, when an open drawer leaves too little
  // room there, sits above them (never over the 🏛 and 🌐 dials).
  const dials = shown("[data-ww-dials][data-compact='true']");
  if (dials !== null && dials.top < rowsTop - GAP) {
    const end = drawer === null ? window.innerWidth - GAP : drawer.left - GAP;
    if (end - (dials.right + GAP) >= CARD_MIN_WIDTH_PX) {
      const left = dials.right + GAP;
      return {
        bottom,
        right: null,
        left,
        maxWidth: Math.max(0, Math.min(560, end - left)),
        maxHeight,
      };
    }
    return {
      bottom: h - dials.top + GAP,
      right: null,
      left: GAP,
      maxWidth: Math.max(0, Math.min(560, end - GAP)),
      maxHeight: Math.max(
        CARD_MIN_PX,
        Math.min(Math.floor(h / 4), dials.top - 2 * GAP - WW_BAND_PX),
      ),
    };
  }
  if (drawer === null) {
    return {
      bottom,
      right: null,
      maxWidth: Math.max(0, Math.min(560, window.innerWidth - 2 * GAP)),
      maxHeight,
    };
  }
  return {
    bottom,
    right: window.innerWidth - drawer.left + GAP,
    maxWidth: Math.max(0, Math.min(560, drawer.left - 2 * GAP)),
    maxHeight,
  };
}

export function placeStyle(p: CardPlace): string {
  const size = `max-width: ${p.maxWidth}px; max-height: ${p.maxHeight}px;`;
  if (p.left !== undefined && p.left !== null) {
    return `bottom: ${p.bottom}px; left: ${p.left}px; ${size}`;
  }
  return p.right === null
    ? `bottom: ${p.bottom}px; left: 50%; transform: translateX(-50%); ${size}`
    : `bottom: ${p.bottom}px; right: ${p.right}px; ${size}`;
}

export function samePlace(a: CardPlace, b: CardPlace): boolean {
  return (
    a.bottom === b.bottom &&
    a.right === b.right &&
    (a.left ?? null) === (b.left ?? null) &&
    a.maxWidth === b.maxWidth &&
    a.maxHeight === b.maxHeight
  );
}

interface Ctx {
  view: WwLandView;
  economy: WwEconomyView;
  me: number;
  day: number;
  sel: WwLandSelection;
  card: ArmyCardData;
  /** P4: the navy screens' context (landings); null without the navy view. */
  navy: NavyCtx | null;
}

/** At or below this viewport height the card starts folded to its strip. */
export const CARD_FOLD_MAX_HEIGHT = 420;

/**
 * World War 1936 P2 (spec §15.4): the chosen army's card, bottom centre,
 * at most a quarter of the screen tall — its name, general, divisions,
 * bars, state, readiness and supply; the order buttons (a greyed one says
 * why when tapped); the preview of a pending map tap; the plan's stance
 * and its execute button. Left of an open drawer, never over it.
 *
 * It folds to a ~40 px strip (name, divisions, one bar, the state line):
 * on a short screen by default, and on its own while an order is being
 * given (a mode, or a tap waiting for its second), when the strip shows the
 * hint or the preview, the refusal, [cancel] (and the plan's [execute]).
 * The toggle opens it again; it opens by itself when the order is done.
 */
@customElement("ww-army-card")
export class WwArmyCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /** The button tapped while it was greyed, and why. */
  @state() private refused: { id: string; block: CardBlock } | null = null;
  /**
   * The buttons shown: the orders, the "⋯" ones, the armies to merge with,
   * (P5) the garrison's scope, or (P6) the raid picker and the medals.
   */
  @state() private panel:
    | "main"
    | "more"
    | "merge"
    | "garrison"
    | "raid"
    | "medal" = "main";
  /** The raid kind on show in the raid picker. */
  private raidKind: RaidKind = "raid_para";
  @state() private place: CardPlace = {
    bottom: GAP,
    right: null,
    maxWidth: 560,
    maxHeight: CARD_MIN_PX,
  };
  /** Folded to the strip by the player (or by default, on a short screen). */
  @state() private collapsed = false;
  /** Opened by the toggle while an order is being given. */
  @state() private openWhileOrdering = false;
  private wasOrdering = false;
  private readonly twoTap = new TwoTap();
  private shownArmy: number | null = null;
  private redrawKey: readonly unknown[] = [];

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwLandChangedEvent, () => this.redraw());
    // P4: a landing's taps (the sea-air flow keeps the army chosen).
    this.eventBus.on(WwSeaAirChangedEvent, () => this.redraw());
    // A drawer opening or closing moves the card beside it.
    this.eventBus.on(WwDrawerEvent, () => {
      void this.updateComplete.then(() =>
        requestAnimationFrame(() => this.refit()),
      );
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  /**
   * Cheap: the version keys first; the card's data is built only in
   * render(), and the place measured once a tick while it shows.
   */
  tick() {
    if ((this.game?.worldWarScenario() ?? null) === null) return;
    const sel = landSelectionOf(this.game);
    if (sel.army === null) {
      if (this.shownArmy !== null) this.redraw();
      return;
    }
    this.refit();
    const key = [
      sel.version,
      sel.army,
      this.game.wwLand?.()?.version,
      this.game.wwEconomy?.()?.version,
      today(this.game),
      this.game.wwNavy?.()?.version,
      seaAirOf(this.game).draft.version,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.sync();
      this.requestUpdate();
    }
  }

  /** A new army: the main buttons, folded on a short screen; an order's start or end: the strip's default. */
  private sync() {
    const sel = landSelectionOf(this.game);
    if (sel.army !== this.shownArmy) {
      this.shownArmy = sel.army;
      this.panel = "main";
      this.refused = null;
      this.collapsed = window.innerHeight <= CARD_FOLD_MAX_HEIGHT;
      // A landing's taps belong to the army they started from.
      const d = seaAirOf(this.game).draft;
      if (d.mode === "invade" && d.army !== sel.army) {
        this.eventBus.emit(new WwSeaAirModeEvent("none"));
      }
    }
    const ordering = this.isOrdering(sel);
    if (ordering !== this.wasOrdering) {
      this.wasOrdering = ordering;
      this.openWhileOrdering = false;
    }
  }

  private redraw() {
    this.sync();
    if (landSelectionOf(this.game).army !== null) this.refit();
    this.requestUpdate();
  }

  private refit() {
    const next = cardPlace();
    if (!samePlace(next, this.place)) this.place = next;
  }

  private ctx(): Ctx | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const view = this.game.wwLand?.() ?? null;
    const economy = this.game.wwEconomy?.() ?? null;
    const p = this.game.myPlayer();
    if (view === null || economy === null || p === null) return null;
    const me = p.smallID();
    // P5 pre-flight §0-1: an exile still commands.
    if (!wwActive(this.game, me)) return null;
    const sel = landSelectionOf(this.game);
    if (sel.army === null) return null;
    const day = today(this.game);
    const card = armyCard(
      view,
      economy,
      me,
      sel.army,
      day,
      landSidesOf(this.game),
    );
    const navy = navyCtx(this.game as unknown as NavyGame);
    return card === null ? null : { view, economy, me, day, sel, card, navy };
  }

  /** P4: the landing's tap mode for this army (spec §18.3-5). */
  private invading(sel: WwLandSelection): boolean {
    const d = seaAirOf(this.game).draft;
    return d.mode === "invade" && d.army === sel.army;
  }

  private isOrdering(sel: WwLandSelection): boolean {
    return sel.mode !== "none" || sel.pending !== null || this.invading(sel);
  }

  private setInvade(on: boolean, army: number) {
    this.eventBus.emit(
      new WwSeaAirModeEvent(on ? "invade" : "none", "patrol", army),
    );
  }

  private send(order: LandOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  private setMode(mode: LandMode) {
    this.eventBus.emit(new WwLandModeEvent(mode));
  }

  private tapButton(c: Ctx, id: ArmyButton, block: CardBlock | null) {
    if (block !== null) {
      this.refused = { id, block };
      return;
    }
    this.refused = null;
    const army = c.card.row.id;
    const mode = BUTTON_MODES[id];
    if (mode !== undefined) {
      // A second press puts the map back to plain taps.
      this.setMode(c.sel.mode === mode ? "none" : mode);
      return;
    }
    switch (id) {
      case "split":
        this.send({
          kind: "army_split",
          army,
          count: Math.max(
            1,
            Math.min(
              WW_MAX_ARMY_DIVISIONS - 1,
              Math.floor(c.card.row.divisions / 2),
            ),
          ),
          template: 0,
        });
        return;
      case "merge":
        if (c.card.mergeWith.length === 1) {
          this.merge(army, c.card.mergeWith[0]);
        } else {
          this.panel = "merge";
        }
        return;
      case "auto":
        this.send({ kind: "army_auto", army, on: !c.card.auto });
        return;
      case "more":
        this.panel = "more";
        return;
    }
  }

  private merge(army: number, into: number) {
    this.send({ kind: "army_merge", army, into });
    this.panel = "main";
    // The merged army is gone: the card follows the one it joined.
    this.eventBus.emit(new WwSelectArmyEvent(into));
  }

  render() {
    const c = this.ctx();
    if (c === null) return nothing;
    const ordering = this.isOrdering(c.sel);
    const strip = ordering ? !this.openWhileOrdering : this.collapsed;
    return strip ? this.renderStrip(c, ordering) : this.renderFull(c);
  }

  /** The folded card: one row, about 40 px, the map behind shows through. */
  private renderStrip(c: Ctx, ordering: boolean): TemplateResult {
    const r = c.card.row;
    const worst = Math.min(r.strengthPm, r.orgPm);
    return html`<section
      data-ww-army-card=${r.id}
      data-collapsed="true"
      aria-label=${armyName(r.nameNo)}
      class="fixed z-[1001] flex items-center gap-1.5 rounded-lg border border-white/15 bg-gray-900/70 p-0.5 pl-2 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <span class="shrink-0 font-bold">${armyName(r.nameNo)}</span>
      <span data-ww-army-divisions class="shrink-0 tabular-nums text-white/70"
        >${translateText("ww1936.land.divisions_of", {
          n: r.divisions,
          max: WW_MAX_ARMY_DIVISIONS,
        })}</span
      >
      <span
        data-ww-bar="combined"
        class="h-1.5 w-12 shrink-0 rounded bg-white/10"
        ><span
          class="block h-1.5 rounded ${worst >= 600
            ? "bg-emerald-400"
            : worst >= 300
              ? "bg-amber-400"
              : "bg-red-500"}"
          style="width: ${Math.max(0, Math.min(1000, worst)) / 10}%"
        ></span
      ></span>
      <span data-ww-strip-line class="min-w-0 flex-1 truncate">
        ${ordering || this.refused !== null
          ? this.renderLine(c, true)
          : translateText(c.card.status.key, c.card.status.params)}
      </span>
      ${c.sel.mode === "plan" ? this.executeButton(c, false) : nothing}
      ${ordering
        ? this.button("cancel", translateText("common.cancel"), "✕", () => {
            if (this.invading(c.sel)) this.setInvade(false, 0);
            else this.setMode("none");
          })
        : nothing}
      ${this.foldButton(c, true)} ${this.closeButton()}
    </section>`;
  }

  /** Fold to the strip, or open the whole card (36 px). */
  private foldButton(c: Ctx, folded: boolean): TemplateResult {
    const ordering = this.isOrdering(c.sel);
    return html`<button
      type="button"
      data-ww-card-fold=${folded ? "open" : "fold"}
      class="size-9 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
      aria-label=${translateText(
        folded ? "ww1936.land.card_expand" : "ww1936.land.card_collapse",
      )}
      @click=${() => {
        if (ordering) this.openWhileOrdering = folded;
        else this.collapsed = !folded;
      }}
    >
      ${folded ? "▴" : "▾"}
    </button>`;
  }

  private closeButton(): TemplateResult {
    return html`<button
      type="button"
      data-ww-card-close
      class="size-9 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
      aria-label=${translateText("common.close")}
      @click=${() => this.eventBus.emit(new WwSelectArmyEvent(null))}
    >
      ✕
    </button>`;
  }

  private renderFull(c: Ctx): TemplateResult {
    const r = c.card.row;
    const line = this.renderLine(c);
    return html`<section
      data-ww-army-card=${r.id}
      data-collapsed="false"
      aria-label=${armyName(r.nameNo)}
      class="fixed z-[1001] flex max-h-[25vh] gap-2 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex min-w-0 items-baseline gap-1.5">
          <span class="shrink-0 text-sm font-bold">${armyName(r.nameNo)}</span>
          <span
            data-ww-army-divisions
            class="shrink-0 tabular-nums text-white/70"
            >${translateText("ww1936.land.divisions_of", {
              n: r.divisions,
              max: WW_MAX_ARMY_DIVISIONS,
            })}</span
          >
          ${this.renderGeneral(c)}
        </div>
        ${this.renderBars(r.strengthPm, r.orgPm)}
        ${line !== nothing && this.place.maxHeight <= CARD_MIN_PX
          ? // No room for both (a landscape phone): the tap's preview first.
            nothing
          : html`<div
              data-ww-army-status
              class="flex flex-wrap gap-x-2 text-white/80"
            >
              <span
                >${translateText(c.card.status.key, c.card.status.params)}</span
              >
              ${c.card.planBp > 0
                ? html`<span data-ww-readiness class="text-sky-300"
                    >${translateText("ww1936.land.readiness", {
                      pct: Math.floor(c.card.planBp / 100),
                    })}</span
                  >`
                : nothing}
              <span
                data-ww-supply
                class=${c.card.supplyPm < 1000 ? "text-amber-300" : ""}
                >${translateText("ww1936.land.supply", {
                  pct: Math.floor(c.card.supplyPm / 10),
                })}</span
              >
              ${this.renderInvasion(c)}
            </div>`}
        ${line}
      </div>
      <div
        data-ww-card-buttons=${this.panel}
        class="grid shrink-0 grid-cols-5 content-start gap-1"
      >
        ${c.sel.mode === "plan" && this.panel === "main"
          ? this.renderPlan(c)
          : this.panel === "more"
            ? this.renderMore(c)
            : this.panel === "merge"
              ? this.renderMerge(c)
              : this.panel === "garrison"
                ? this.renderGarrison(c)
                : this.panel === "raid"
                  ? this.renderRaid(c)
                  : this.panel === "medal"
                    ? this.renderMedals(c)
                    : this.renderButtons(c)}
      </div>
      <div class="flex shrink-0 flex-col gap-1">
        ${this.foldButton(c, false)} ${this.closeButton()}
      </div>
    </section>`;
  }

  /** The general on the name's row: name, the four skills, the traits. */
  private renderGeneral(c: Ctx): TemplateResult | typeof nothing {
    const g = c.card.general;
    if (g === null) return nothing;
    const name =
      g.key === ""
        ? translateText("ww1936.land.titled_general", { n: g.titleNo })
        : translateText(`ww1936.general.${g.key}`);
    return html`<span
      data-ww-army-general
      class="flex min-w-0 items-baseline gap-1.5"
    >
      <span class="min-w-0 truncate font-semibold">${name}</span>
      ${traitsOf(g.traits).map(
        (t) =>
          html`<span
            data-ww-trait=${t}
            role="img"
            class="shrink-0"
            aria-label=${translateText(`ww1936.trait.${t}`)}
            >${TRAIT_ICONS[t]}</span
          >`,
      )}
      <span class="min-w-0 truncate text-xs tabular-nums text-white/60"
        >${translateText("ww1936.land.general_skills", {
          a: g.att,
          d: g.def,
          p: g.plan,
          l: g.log,
        })}</span
      >
    </span>`;
  }

  private renderBars(strengthPm: number, orgPm: number): TemplateResult {
    const bar = (id: string, pm: number, color: string) =>
      html`<div data-ww-bar=${id} class="h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded ${color}"
          style="width: ${Math.max(0, Math.min(1000, pm)) / 10}%"
        ></div>
      </div>`;
    return html`<div class="flex flex-col gap-0.5">
      ${bar("strength", strengthPm, "bg-emerald-400")}
      ${bar("org", orgPm, "bg-sky-400")}
    </div>`;
  }

  /** The line under the state: a refusal, a pending tap's preview, or the mode's hint. */
  private renderLine(c: Ctx, compact = false): TemplateResult | typeof nothing {
    if (this.refused !== null) {
      return html`<span
        data-ww-block=${this.refused.block}
        class="${compact ? "" : "block "}text-red-300"
      >
        🔒 ${cardBlockText(this.refused.block)}
      </span>`;
    }
    const sel = c.sel;
    if (this.invading(sel)) return this.renderInvadeLine(c, compact);
    if (sel.pending !== null) {
      return this.renderPreview(c, sel.pending, compact);
    }
    if (sel.mode === "none") return nothing;
    const hint =
      sel.mode === "plan"
        ? translateText("ww1936.land.hint_plan", {
            n: sel.targets.length,
            max: WW_MAX_TARGETS,
          })
        : sel.mode === "front"
          ? translateText("ww1936.land.hint_front")
          : sel.mode === "attack" || sel.mode === "paradrop"
            ? translateText("ww1936.land.hint_enemy")
            : translateText("ww1936.land.hint_region");
    const targets = sel.mode === "plan" ? sel.targets : [];
    return html`<span
      data-ww-hint=${sel.mode}
      class="${compact ? "" : "block "}text-amber-200"
    >
      ${hint}${targets.length > 0
        ? html` ·
            <span data-ww-targets
              >${targets
                .map((t) => regionName(c.view.scenario, t))
                .join(", ")}</span
            >`
        : nothing}
    </span>`;
  }

  /** P4 (spec §11.2, §18.3-5): "Landing prep 37/60 d" with its ring, or the landing's state. */
  private renderInvasion(c: Ctx): TemplateResult | typeof nothing {
    const inv = c.navy === null ? null : invasionOf(c.navy, c.card.row.id);
    if (inv === null) return nothing;
    return html`<span data-ww-invasion=${inv.state} class="text-sky-300">
      ${prepRing(inv.prepDone, inv.prepDays)}
      ${inv.state === "preparing"
        ? translateText("ww1936.navy.invasion_prep", {
            d: inv.prepDone,
            n: inv.prepDays,
          })
        : translateText(`ww1936.invasion_state.${inv.state}`)}
      ·
      ${translateText("ww1936.navy.invasion_target", {
        region: regionName(c.view.scenario, inv.target),
      })}
    </span>`;
  }

  /** P4 (spec §18.3-5): the landing's hint, or the chips of the tapped coast. */
  private renderInvadeLine(c: Ctx, compact: boolean): TemplateResult {
    const d = seaAirOf(this.game).draft;
    if (d.pending === 0 || c.navy === null) {
      return html`<span
        data-ww-hint="invade"
        class="${compact ? "" : "block "}text-amber-200"
        >${translateText("ww1936.navy.hint_invade")}</span
      >`;
    }
    const p = invasionPreview(c.navy, c.card.row.id, d.pending);
    if (p === null) return html``;
    const sc = c.view.scenario;
    return html`<span
      data-ww-preview="invade"
      class="${compact
        ? "inline-flex max-w-full gap-x-2 whitespace-nowrap"
        : "flex flex-wrap items-baseline gap-x-2"}"
    >
      <span>⚓ ${regionName(sc, p.target)}</span>
      ${p.route.map(
        (r) =>
          html`<span
            data-ww-route-chip=${r.ok ? "ok" : "low"}
            class=${r.ok ? "text-emerald-300" : "text-red-300"}
            >${translateText(
              r.ok ? "ww1936.navy.route_chip_ok" : "ww1936.navy.route_chip_low",
              { sr: srName(sc, r.sr), pct: Math.floor(r.supPm / 10) },
            )}</span
          >`,
      )}
      <span data-ww-invasion-convoys
        >${translateText("ww1936.navy.invasion_convoys", {
          need: p.convoysNeed,
          idle: p.convoysIdle,
        })}</span
      >
      <span data-ww-invasion-days
        >${translateText("ww1936.navy.invasion_days", { n: p.prepDays })}</span
      >
      <span data-ww-invasion-divisions
        >${translateText("ww1936.navy.invasion_divisions", {
          n: p.divisions,
          max: p.capacity,
        })}</span
      >
      ${p.block === null
        ? html`<span data-ww-tap-again class="font-semibold text-amber-200"
            >${translateText("ww1936.navy.invasion_confirm")}</span
          >`
        : this.blockLine(p.block)}
    </span>`;
  }

  private renderPreview(
    c: Ctx,
    region: number,
    compact: boolean,
  ): TemplateResult {
    const sides = landSidesOf(this.game);
    const army = c.card.row.id;
    const kind = tapKind(c.view, c.me, c.sel.mode, region, sides);
    const order = kind === null ? null : tapOrder(kind, army, region);
    const block =
      order === null
        ? null
        : orderBlock(c.view, c.economy, c.me, c.day, order, sides);
    const name = regionName(c.view.scenario, region);
    let body: TemplateResult | typeof nothing = nothing;
    if (kind === "move" || kind === "rail" || kind === "sea") {
      const p = movePreview(
        c.view,
        c.economy,
        c.me,
        army,
        region,
        kind,
        c.day,
        sides,
      );
      if (p === null) return this.blockLine("no_path");
      body = html`<span
        >→ ${name} ·
        ${translateText("ww1936.land.move_days", {
          days: Math.max(0.1, daysOf(p.ticks)),
        })}</span
      >`;
    } else if (kind === "attack" || kind === "paradrop") {
      const p = attackPreview(
        c.view,
        c.economy,
        c.me,
        army,
        region,
        c.day,
        sides,
      );
      if (p !== null) body = this.renderAttack(name, p, compact);
    } else if (kind === "front") {
      const front = frontPreview(c.view, c.me, army, region, sides);
      body = html`<span data-ww-front
        >▬
        ${(front.length > 0 ? front : [region])
          .map((r) => regionName(c.view.scenario, r))
          .join(", ")}</span
      >`;
    }
    return html`<span
      data-ww-preview=${kind ?? ""}
      class="${compact
        ? "inline-flex max-w-full gap-x-2 whitespace-nowrap"
        : "flex flex-wrap items-baseline gap-x-2"}"
    >
      ${body}
      ${block === null
        ? html`<span data-ww-tap-again class="font-semibold text-amber-200"
            >${translateText("ww1936.land.tap_again")}</span
          >`
        : this.blockLine(block)}
    </span>`;
  }

  private blockLine(block: WwOrderBlock): TemplateResult {
    return html`<span data-ww-block=${block} class="text-red-300"
      >🔒 ${blockText(block)}</span
    >`;
  }

  private renderAttack(
    name: string,
    p: NonNullable<ReturnType<typeof attackPreview>>,
    compact: boolean,
  ): TemplateResult {
    // The bar: 1.0 in the middle, 2.0 or more full.
    const fill = Math.max(0, Math.min(1, p.ratioPm / 2000));
    const good = p.ratioPm >= 1000;
    return html`<span
      class="${compact
        ? "inline-flex gap-x-1.5"
        : "flex min-w-0 flex-wrap items-center gap-x-1.5"}"
    >
      <span>⚔ ${name}</span>
      <span
        data-ww-ratio=${p.ratioPm}
        class=${good ? "text-emerald-300" : "text-red-300"}
        >${translateText("ww1936.land.preview_ratio", {
          ratio: (Math.min(p.ratioPm, 99_000) / 1000).toFixed(2),
        })}</span
      >
      <span
        >${translateText("ww1936.land.preview_days", { days: p.days })}</span
      >
      <span class="text-white/70"
        >${translateText(`ww1936.terrain.${p.land}`)}${p.river > 0
          ? ` · ${"🌊".repeat(p.river)}`
          : ""}${p.strait ? " · ⚓" : ""}${p.fort > 0
          ? ` · 🏰${p.fort}`
          : ""}</span
      >
      ${compact
        ? nothing
        : html`<span class="block h-1.5 w-full rounded bg-red-900/70">
            <span
              class="block h-1.5 rounded ${good
                ? "bg-emerald-400"
                : "bg-red-400"}"
              style="width: ${fill * 100}%"
            ></span>
          </span>`}
    </span>`;
  }

  private button(
    id: string,
    label: string,
    icon: string,
    act: () => void,
    opts: {
      grey?: boolean;
      pressed?: boolean;
      danger?: boolean;
      wide?: boolean;
    } = {},
  ): TemplateResult {
    return html`<button
      type="button"
      data-ww-army-btn=${id}
      aria-disabled=${String(opts.grey ?? false)}
      aria-pressed=${opts.pressed === undefined
        ? nothing
        : String(opts.pressed)}
      class="flex h-9 min-w-9 flex-col items-center justify-center rounded-md border px-1 leading-none ${opts.wide
        ? "col-span-2"
        : ""} ${opts.grey
        ? "border-white/5 bg-white/5 text-white/35"
        : opts.danger
          ? "border-red-400 bg-red-900/60"
          : opts.pressed
            ? "border-amber-300 bg-amber-700/50"
            : "border-white/15 bg-white/10 hover:bg-white/20"}"
      @click=${act}
    >
      <span aria-hidden="true" class="text-sm">${icon}</span>
      <span class="max-w-14 truncate text-xs">${label}</span>
    </button>`;
  }

  /**
   * P4 (spec §11.3): why the landing can't sail now — not ready, a route
   * region under 50% supremacy, too few idle convoys; null: it can.
   */
  private launchBlock(c: Ctx): WwOrderBlock | null {
    const inv = c.navy === null ? null : invasionOf(c.navy, c.card.row.id);
    if (inv === null || c.navy === null) return "invasion_not_ready";
    if (inv.state !== "ready") return "invasion_not_ready";
    if (inv.route.some(([, pm]) => pm < WW_INVASION_LAUNCH_SUP_PM)) {
      return "naval_supremacy_low";
    }
    const p = invasionPreview(c.navy, c.card.row.id, inv.target);
    if (p !== null && p.convoysIdle < p.convoysNeed) return "no_convoys";
    return null;
  }

  /** P4 (spec §18.3-5): [Launch the landing], two taps; greyed until it can sail. */
  private launchButton(c: Ctx): TemplateResult {
    const army = c.card.row.id;
    const block = this.launchBlock(c);
    const key = `invade:${army}`;
    const armed = this.armed(key);
    return this.button(
      "invade_exec",
      translateText(
        armed ? "ww1936.land.tap_again" : "ww1936.navy.invasion_execute",
      ),
      "⚓",
      () => {
        if (block !== null) {
          this.refused = { id: "invade_exec", block };
          return;
        }
        this.refused = null;
        this.confirmTap(key, () =>
          this.eventBus.emit(
            new SendWwOrderIntentEvent({ kind: "invasion_execute", army }),
          ),
        );
      },
      { grey: block !== null, danger: armed },
    );
  }

  private renderButtons(c: Ctx): TemplateResult[] {
    const landing =
      c.navy !== null && invasionOf(c.navy, c.card.row.id) !== null;
    return ARMY_BUTTONS.map((id) => {
      // A landing in preparation takes the sea move's place.
      if (id === "sea" && landing) return this.launchButton(c);
      const block = c.card.buttons.find((b) => b.id === id)?.block ?? null;
      const mode = BUTTON_MODES[id];
      const pressed =
        mode !== undefined
          ? c.sel.mode === mode
          : id === "auto"
            ? c.card.auto
            : undefined;
      return this.button(
        id,
        translateText(BUTTON_KEYS[id]),
        BUTTON_ICONS[id],
        () => this.tapButton(c, id, block),
        { grey: block !== null, pressed },
      );
    });
  }

  /**
   * The plan's big button (spec §15.3-5): the first press sends the drawn
   * plan, the second within 3 s runs it (and leaves plan mode); while it
   * runs, one press stops it.
   */
  private executeButton(c: Ctx, wide: boolean): TemplateResult {
    const army = c.card.row.id;
    if (c.card.executing) {
      return this.button(
        "execute",
        translateText("ww1936.land.btn_stop"),
        "■",
        () => {
          this.send({ kind: "army_execute", army, on: false });
          this.setMode("none");
        },
        { danger: true, wide },
      );
    }
    const plan: LandOrder = {
      kind: "army_plan",
      army,
      targets: [...c.sel.targets],
      stance: c.sel.stance,
    };
    const block = orderBlock(
      c.view,
      c.economy,
      c.me,
      c.day,
      plan,
      landSidesOf(this.game),
    );
    const key = `execute:${army}`;
    const armed = this.armed(key);
    return this.button(
      "execute",
      translateText(
        armed ? "ww1936.land.tap_again" : "ww1936.land.btn_execute",
      ),
      "▶",
      () => {
        if (block !== null) {
          this.refused = { id: "execute", block };
          return;
        }
        this.refused = null;
        this.confirmTap(key, () => {
          this.send({ kind: "army_execute", army, on: true });
          // The plan is the army's now: the draft goes with the mode.
          this.setMode("none");
        });
        if (this.armed(key)) this.send(plan);
      },
      { grey: block !== null, pressed: armed, wide },
    );
  }

  /** Plan mode (spec §15.3-5): the stance, and the big execute button. */
  private renderPlan(c: Ctx): TemplateResult[] {
    const stances = STANCES.map((s) =>
      this.button(
        `stance_${s}`,
        translateText(STANCE_KEYS[s]),
        s === "careful" ? "🛡" : s === "balanced" ? "⚖" : "🔥",
        () => {
          c.sel.stance = s;
          c.sel.version++;
          this.requestUpdate();
        },
        { pressed: c.sel.stance === s },
      ),
    );
    return [
      ...stances,
      this.executeButton(c, true),
      this.button("back", translateText("common.back"), "←", () =>
        this.setMode("none"),
      ),
    ];
  }

  private renderMore(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    const key = `disband:${army}`;
    const armed = this.armed(key);
    return [
      this.button(
        "disband",
        translateText(
          armed ? "ww1936.land.tap_again" : "ww1936.land.btn_disband",
        ),
        "✖",
        () =>
          this.confirmTap(key, () => {
            this.send({ kind: "army_disband", army });
            this.panel = "main";
          }),
        { danger: armed },
      ),
      this.button(
        "general",
        translateText("ww1936.land.btn_general"),
        "🎖",
        () => {
          this.panel = "main";
          this.eventBus.emit(new OpenWwArmyEvent("generals"));
        },
      ),
      this.button(
        "paradrop",
        translateText("ww1936.land.btn_paradrop"),
        "🪂",
        () => {
          const block = c.card.paradropBlock;
          if (block !== null && c.sel.mode !== "paradrop") {
            this.refused = { id: "paradrop", block };
            return;
          }
          this.refused = null;
          this.panel = "main";
          this.setMode(c.sel.mode === "paradrop" ? "none" : "paradrop");
        },
        {
          grey: c.card.paradropBlock !== null,
          pressed: c.sel.mode === "paradrop",
        },
      ),
      ...this.invadeButtons(c),
      ...this.garrisonButton(c),
      ...this.depthButtons(c),
      this.button("back", translateText("common.back"), "←", () => {
        this.panel = "main";
      }),
    ];
  }

  /**
   * P5 (spec §8.5, §20.7): [Garrison] while I administer occupied regions —
   * the next panel picks which: all of them, or one legal owner's.
   */
  private garrisonButton(c: Ctx): TemplateResult[] {
    if (myOccRows(this.game, c.me).length === 0) return [];
    const on =
      c.view.armies.get(c.card.row.id)?.mine?.order.kind === "garrison";
    return [
      this.button(
        "garrison",
        translateText("ww1936.occ.garrison"),
        "🛡",
        () => {
          this.panel = "garrison";
        },
        { pressed: on },
      ),
    ];
  }

  private renderGarrison(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    return [
      ...garrisonScopes(this.game, c.me).map((s) =>
        this.button(
          `garrison_${s.scope}`,
          s.name,
          "🛡",
          () => {
            this.eventBus.emit(
              new SendWwOrderIntentEvent({
                kind: "army_garrison",
                army,
                scope: s.scope,
              }),
            );
            this.panel = "main";
          },
          { wide: true },
        ),
      ),
      this.button("back", translateText("common.back"), "←", () => {
        this.panel = "more";
      }),
    ];
  }

  /** P4 (spec §18.3-5): [Invade] (the map's coasts glow), or cancelling the landing (two taps). */
  private invadeButtons(c: Ctx): TemplateResult[] {
    if (c.navy === null) return [];
    const army = c.card.row.id;
    if (invasionOf(c.navy, army) !== null) {
      const key = `invade_cancel:${army}`;
      const armed = this.armed(key);
      return [
        this.button(
          "invade_cancel",
          translateText(
            armed ? "ww1936.land.tap_again" : "ww1936.navy.invasion_cancel",
          ),
          "✖",
          () =>
            this.confirmTap(key, () => {
              this.eventBus.emit(
                new SendWwOrderIntentEvent({ kind: "invasion_cancel", army }),
              );
              this.panel = "main";
            }),
          { danger: armed },
        ),
      ];
    }
    const block = invadeButtonBlock(c.navy, army);
    const on = this.invading(c.sel);
    return [
      this.button(
        "invade",
        translateText("ww1936.navy.btn_invade"),
        "⚓",
        () => {
          if (block !== null && !on) {
            this.refused = { id: "invade", block };
            return;
          }
          this.refused = null;
          this.panel = "main";
          this.setMode("none");
          this.setInvade(!on, army);
        },
        { grey: block !== null, pressed: on },
      ),
    ];
  }

  /** P6 (spec §20.10): [Raid], [Rail guns n/2], [Medal], the reinforcement priority. */
  private depthButtons(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    return new DepthMiscModel(this.game).armyButtons(army).map((b) =>
      this.button(
        `depth_${b.id}`,
        b.label,
        b.id === "raid"
          ? "🪂"
          : b.id === "railgun"
            ? "🚂"
            : b.id === "medal"
              ? "★"
              : "⇅",
        () => {
          if (b.id === "raid") this.panel = "raid";
          else if (b.id === "medal") this.panel = "medal";
          else if (b.order !== null) {
            this.eventBus.emit(new SendWwOrderIntentEvent(b.order));
          }
        },
      ),
    );
  }

  /**
   * The raid kinds. A kind starts the strike flow, which picks the target
   * region; the building list waits for the flow to take a building (merge
   * glue for U4: judge it with DepthMiscModel.raidTargets on that region's owner).
   */
  /**
   * The raid picker: the kind, then the building wanted. The building goes
   * with WwStrikeFlowEvent; U4's flow judges it on the picked target
   * region's owner (DepthMiscModel.raidTargets) once a region is tapped,
   * and falls back to the first building allowed there (merge glue).
   */
  private renderRaid(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    const kind = this.raidKind;
    return [
      renderRaidPicker(
        kind,
        RAID_TARGETS[kind].map((b) => ({
          building: b,
          facility: (FACILITY_IDS as readonly string[]).includes(b),
        })),
        (k) => {
          this.raidKind = k;
          this.requestUpdate();
        },
        (b) => {
          this.eventBus.emit(new WwStrikeFlowEvent(kind, army, b));
          this.panel = "main";
        },
        () => (this.panel = "more"),
      ),
    ];
  }

  private renderMedals(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    return [
      ...MEDALS.map((medal) =>
        this.button(
          `medal_${medal}`,
          translateText(`ww1936.medal.${medal}`),
          "★",
          () => {
            this.eventBus.emit(
              new SendWwOrderIntentEvent({ kind: "medal_award", army, medal }),
            );
            this.panel = "main";
          },
        ),
      ),
      this.button("back", translateText("common.back"), "←", () => {
        this.panel = "more";
      }),
    ];
  }

  private renderMerge(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    return [
      ...c.card.mergeWith.map((into) => {
        const a = c.view.armies.get(into);
        return this.button(
          `merge_${into}`,
          a === undefined ? String(into) : armyName(a.nameNo),
          "⊕",
          () => this.merge(army, into),
        );
      }),
      this.button("back", translateText("common.back"), "←", () => {
        this.panel = "main";
      }),
    ];
  }
}
