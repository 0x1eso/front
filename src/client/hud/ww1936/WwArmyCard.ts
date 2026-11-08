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
  RETIRED_GENERAL_TRAITS,
  type Stance,
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
import { GoToPositionEvent } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { zoneHueCss } from "../../view/WarBadges";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import {
  ARMY_HUD_KEYS,
  divisionGroups,
  pinOf,
  planMaxPct,
  supplyLine,
  supplyWords,
  togglePick,
  WwStockLitEvent,
} from "./ArmyHudModel";
import { WwStrikeFlowEvent } from "./DepthEvents";
import { DepthMiscModel } from "./DepthMiscModel";
import { blockText, stockTable } from "./EconomyModel";
import { garrisonScopes, myOccRows } from "./EndgameModel";
import { fogModelOf } from "./FogModel";
import {
  ARMY_BUTTONS,
  ArmyButton,
  armyCard,
  ArmyCardData,
  armyLift,
  armyName,
  attackPreview,
  AUTO_LEVELS,
  AutoLevel,
  CardBlock,
  cardBlockText,
  daysOf,
  divisionRows,
  landSidesOf,
  movePreview,
  orderBlock,
  planOrder,
  regionName,
  tapKind,
  tapOrder,
  templateName,
  zoneShown,
} from "./LandModel";
import { statsFromArray } from "./LandSeaAir";
import {
  type DrawMode,
  LandMode,
  landSelectionOf,
  OpenWwArmyEvent,
  type PlannerAction,
  WwDrawModeEvent,
  WwLandModeEvent,
  WwLandSelection,
  WwPlannerEvent,
  WwSelectArmyEvent,
} from "./LandSelection";
import {
  invadeButtonBlock,
  invasionOf,
  invasionPreview,
  NavyCtx,
  navyCtx,
  NavyGame,
  seaMoveLossPm,
  srName,
} from "./NavyModel";
import { PLANNER_KEYS } from "./PlannerKeys";
import { armyPriority, wingsFollowing } from "./WingModel";
import { today, TWO_TAP_MS, TwoTap, wwActive } from "./WorldWarModel";
import { renderDirectPanel } from "./WwDirectPanel";
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

/** ww7: [공격] is the plan (targets), [방어] the front (zone). */
const BUTTON_KEYS: Readonly<Record<ArmyButton, string>> = {
  plan: "ww1936.land.btn_attack",
  front: "ww1936.land.btn_defend",
  move: "ww1936.land.btn_move",
  auto: "ww1936.land.btn_auto",
  rail: "ww1936.land.btn_rail",
  sea: "ww1936.land.btn_sea",
  split: "ww1936.land.btn_split",
  merge: "ww1936.land.btn_merge",
  more: "ww1936.land.btn_more",
};

const BUTTON_ICONS: Readonly<Record<ArmyButton, string>> = {
  plan: "⚔",
  front: "🛡",
  move: "➜",
  auto: "🤖",
  rail: "🚂",
  sea: "⚓",
  split: "✂",
  merge: "⊕",
  more: "⋯",
};

/** The buttons that set what the next map tap means (spec §15.3). */
const BUTTON_MODES: Readonly<Partial<Record<ArmyButton, LandMode>>> = {
  move: "move",
  rail: "rail",
  sea: "sea",
};

/**
 * ww162 (design §2): the card's first row — the battle planner's line
 * modes [전선] [공세선] [후퇴선] [사단]. A chip turns its mode on, the same
 * chip again turns it off (the land controller keeps the mode).
 */
export const DRAW_CHIPS = ["front", "goal", "fallback", "divisions"] as const;
type DrawChip = (typeof DRAW_CHIPS)[number];
const DRAW_CHIP_KEYS: Readonly<Record<DrawChip, string>> = {
  front: PLANNER_KEYS.btnFront,
  goal: PLANNER_KEYS.btnGoal,
  fallback: PLANNER_KEYS.btnFallback,
  divisions: PLANNER_KEYS.btnDivisions,
};
const DRAW_CHIP_ICONS: Readonly<Record<DrawChip, string>> = {
  front: "🛡",
  goal: "⚔",
  fallback: "↩",
  divisions: "▦",
};
const DRAW_HINT_KEYS: Readonly<Record<DrawChip, string>> = {
  front: PLANNER_KEYS.hintFront,
  goal: PLANNER_KEYS.hintGoal,
  fallback: PLANNER_KEYS.hintFallback,
  divisions: PLANNER_KEYS.hintDivisions,
};
/**
 * The order check a chip borrows (a greyed chip says why): a front or a
 * fallback needs a border to hold, an offensive line an enemy to reach, the
 * divisions a move.
 */
const DRAW_CHIP_CHECK: Readonly<Record<DrawChip, ArmyButton>> = {
  front: "front",
  goal: "plan",
  fallback: "front",
  divisions: "move",
};

/** A touch screen: the line hints add that two fingers move the map. */
function coarsePointer(): boolean {
  return window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

/** ww7: the auto level buttons' text. */
const AUTO_LEVEL_KEYS: Readonly<Record<AutoLevel, string>> = {
  0: "ww1936.auto.level_0",
  1: "ww1936.auto.level_1",
  2: "ww1936.auto.level_2",
};
const AUTO_LEVEL_HINTS: Readonly<Record<AutoLevel, string>> = {
  0: "ww1936.auto.level_hint_0",
  1: "ww1936.auto.level_hint_1",
  2: "ww1936.auto.level_hint_2",
};

/** The general's traits as small icons (pre-flight R7.7: emoji, no new images). */
export const TRAIT_ICONS: Readonly<Partial<Record<GeneralTrait, string>>> = {
  panzer_leader: "🛡",
  infantry_officer: "🎖",
  cavalry_officer: "🐎",
  offensive_doctrine: "⚔",
  defensive_doctrine: "🏰",
  river_crosser: "🌊",
  logistics_wizard: "📦",
  organizer: "📋",
  // P6 (spec §4.2).
  infantry_expert: "🎖",
  armor_expert: "🛡",
  artillery_officer: "💥",
  engineer_officer: "⛏",
  trickster: "🎭",
  commando: "🗡",
  guerrilla_fighter: "🌿",
  skirmisher: "👁",
  ambusher: "🪤",
  // ww97: the named generals' own traits.
  deep_thrust: "🚀",
  reserve_master: "🧱",
  hard_pursuit: "🏁",
  set_piece: "🗺",
  fast_infiltration: "🥷",
  rearguard: "🚧",
  line_breaker: "🔨",
};

const STANCE_KEYS = {
  careful: "ww1936.stance.careful",
  balanced: "ww1936.stance.balanced",
  aggressive: "ww1936.stance.aggressive",
} as const;

export function traitsOf(mask: number): GeneralTrait[] {
  return GENERAL_TRAITS.filter(
    (t) => (mask & traitBit(t)) !== 0 && !RETIRED_GENERAL_TRAITS.includes(t),
  );
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
/** Two rows of 40 px buttons and the padding: a card is never shorter. */
export const CARD_MIN_PX = 96;
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
  // The dock stands right above the rows: the card clears both.
  const rows = shown("[data-bottom-hud-rows]");
  const dock = shown("[data-ww-dock]");
  const rowsTop = Math.min(rows === null ? h : rows.top, dock?.top ?? h);
  const bottom = h - rowsTop + GAP;
  const maxHeight = Math.max(
    CARD_MIN_PX,
    Math.min(Math.floor(h / 4), Math.floor(rowsTop - GAP - (h * 3) / 4)),
  );
  // A drawer is a full-screen panel (it steps aside for a map flow): the
  // card never has to keep left of it.
  return {
    bottom,
    right: null,
    maxWidth: Math.max(0, Math.min(560, window.innerWidth - 2 * GAP)),
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

/**
 * ww46: a direct attack's card (breakdown, reasons, three toggles) needs
 * more than a quarter of the screen: up to 42 % of the height, but never
 * above the screen's 40 % line, so a phone keeps its upper half of map to tap.
 */
export function directMaxHeight(p: CardPlace): number {
  const h = window.innerHeight;
  return Math.max(
    p.maxHeight,
    Math.min(Math.floor(h * 0.42), Math.floor(h * 0.6 - p.bottom)),
  );
}

/**
 * ww46: the direct card's width: the whole maxWidth (a card placed at
 * left: 50% would else shrink to half the screen), and on a phone it keeps
 * clear of the lens buttons down the right edge, whose z-index is above it.
 */
export function directWidthStyle(p: CardPlace): string {
  const w = window.innerWidth;
  if (w < 600 && (p.left === undefined || p.left === null)) {
    return `; left: ${GAP}px; transform: none; width: ${Math.max(0, w - GAP - 56)}px`;
  }
  return `; width: ${p.maxWidth}px`;
}

/**
 * ww162 (design §2): a line mode's card takes the whole quarter of the
 * screen (the map's middle-half rule would cut its second row on a desktop
 * of 900 px): the line is drawn on the map around it.
 */
export function drawMaxHeight(p: CardPlace): number {
  return Math.max(p.maxHeight, Math.floor(window.innerHeight / 4));
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
    | "medal"
    | "auto" = "main";
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
  /** ww162: the line mode on show; a new one opens the card. */
  private shownDraw: DrawMode = "none";
  /** ww162: the card folded to its strip by the toggle while a line mode is on. */
  @state() private drawFolded = false;
  /**
   * ww162: [자동 후퇴] as tapped, per army, until the engine's order says it
   * (the land controller sends it with the fallback line).
   */
  private readonly fbAuto = new Map<number, boolean>();
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
    if (sel.draw !== this.shownDraw) {
      this.shownDraw = sel.draw;
      this.drawFolded = false;
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

  /** An order mode or a waiting tap (a line mode has its own card, not the strip). */
  private isOrdering(sel: WwLandSelection): boolean {
    if (sel.draw !== "none") return false;
    return sel.mode !== "none" || sel.pending !== null || this.invading(sel);
  }

  /** ww162: the card's second row asks the land controller, which sends the orders. */
  private planner(a: PlannerAction) {
    this.eventBus.emit(new WwPlannerEvent(a));
    this.requestUpdate();
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
        this.panel = this.panel === "auto" ? "main" : "auto";
        return;
      case "more":
        this.panel = "more";
        return;
    }
  }

  /** ww7: the offensive stance. A plan that ran keeps running with it. */
  private setStance(c: Ctx, stance: Stance) {
    const sel = c.sel;
    const order = c.view.armies.get(c.card.row.id)?.mine?.order;
    sel.stance = stance;
    sel.version++;
    if (order?.kind === "plan") {
      const army = c.card.row.id;
      // Targets taken since are ours now: the engine refuses a plan that
      // names one (not_at_war), so only the enemy's go back.
      const sides = landSidesOf(this.game);
      const targets = (
        sel.mode === "plan" ? sel.targets : order.targets
      ).filter((t) => sides.isEnemy(c.me, c.view.controller[t]));
      const plan = planOrder(army, targets, stance);
      // The engine's refusal never comes back to the client, so the same
      // rule check the buttons use says why the stance did not take.
      const block = orderBlock(c.view, c.economy, c.me, c.day, plan, sides);
      if (block !== null) {
        this.refused = { id: `stance_${stance}`, block };
        this.requestUpdate();
        return;
      }
      this.refused = null;
      this.send(plan);
      if (order.executing && targets.length > 0) {
        this.send({ kind: "army_execute", army, on: true });
      }
    }
    this.requestUpdate();
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
    if (c.sel.draw !== "none") {
      return this.drawFolded ? this.renderStrip(c, true) : this.renderDraw(c);
    }
    const ordering = this.isOrdering(c.sel);
    const strip = ordering ? !this.openWhileOrdering : this.collapsed;
    return strip ? this.renderStrip(c, ordering) : this.renderFull(c);
  }

  /** The folded card: one row, about 40 px, the map behind shows through. */
  private renderStrip(c: Ctx, ordering: boolean): TemplateResult {
    const r = c.card.row;
    const worst = Math.min(r.strengthPm, r.orgPm);
    // A landing's tapped coast: its card stands over the strip (the map stays free).
    const landingCard =
      this.refused === null &&
      this.invading(c.sel) &&
      seaAirOf(this.game).draft.pending !== 0;
    return html`<section
      data-ww-army-card=${r.id}
      data-collapsed="true"
      aria-label=${armyName(r.nameNo)}
      class="fixed z-[1001] flex ${landingCard
        ? "flex-wrap"
        : ""} items-center gap-1.5 rounded-lg border border-white/15 bg-gray-900/70 p-0.5 pl-2 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${landingCard
        ? html`<div
            data-ww-invasion-card
            class="basis-full overflow-y-auto rounded-md bg-gray-900/90 p-1"
          >
            ${this.renderInvadeLine(c, false)}
          </div>`
        : nothing}
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
        ${landingCard
          ? translateText("ww1936.navy.hint_invade")
          : ordering || this.refused !== null
            ? this.renderLine(c, true)
            : translateText(c.card.status.key, c.card.status.params)}
      </span>
      ${ordering
        ? this.button(
            "cancel",
            // The attack and defend modes, and the line modes, keep what
            // the taps sent: "done".
            translateText(
              c.sel.mode === "plan" ||
                c.sel.mode === "front" ||
                c.sel.draw !== "none"
                ? "ww1936.land.btn_done"
                : "common.cancel",
            ),
            c.sel.mode === "plan" ||
              c.sel.mode === "front" ||
              c.sel.draw !== "none"
              ? "✓"
              : "✕",
            () => {
              if (c.sel.draw !== "none") {
                this.eventBus.emit(new WwDrawModeEvent("none"));
              } else if (this.invading(c.sel)) this.setInvade(false, 0);
              else this.setMode("none");
            },
          )
        : nothing}
      ${this.foldButton(c, true)} ${this.closeButton()}
    </section>`;
  }

  /** ww8 (design §8.6): [✈ priority] and how many wings give this army close support. */
  private renderAirPriority(c: Ctx): TemplateResult | typeof nothing {
    if (this.game.wwAir?.()?.live !== true || c.navy === null) return nothing;
    const army = c.card.row.id;
    const on = armyPriority(c.navy, army);
    return html`<button
        type="button"
        data-ww-air-priority
        aria-pressed=${String(on)}
        class="h-10 shrink-0 rounded-md border px-2 ${on
          ? "border-sky-300 bg-sky-800/60"
          : "border-white/15 bg-white/10 hover:bg-white/20"}"
        @click=${() =>
          this.eventBus.emit(
            new SendWwOrderIntentEvent({
              kind: "army_air_priority",
              army,
              on: !on,
            }),
          )}
      >
        ✈ ${translateText("ww1936.wing.btn_priority")}
      </button>
      <span data-ww-air-cover class="self-center text-white/80"
        >${translateText("ww1936.wing.cover", {
          n: wingsFollowing(c.navy, army),
        })}</span
      >`;
  }

  /** Fold to the strip, or open the whole card (40 px). */
  private foldButton(c: Ctx, folded: boolean): TemplateResult {
    const ordering = this.isOrdering(c.sel);
    return html`<button
      type="button"
      data-ww-card-fold=${folded ? "open" : "fold"}
      class="size-10 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
      aria-label=${translateText(
        folded ? "ww1936.land.card_expand" : "ww1936.land.card_collapse",
      )}
      @click=${() => {
        if (c.sel.draw !== "none") this.drawFolded = !folded;
        else if (ordering) this.openWhileOrdering = folded;
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
      class="size-10 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
      aria-label=${translateText("common.close")}
      @click=${() => this.eventBus.emit(new WwSelectArmyEvent(null))}
    >
      ✕
    </button>`;
  }

  private renderFull(c: Ctx): TemplateResult {
    const r = c.card.row;
    const line = this.renderLine(c);
    // ww46: the direct panel's card is taller and wraps: the buttons column
    // goes under the left one when the two do not fit side by side.
    const directCard =
      this.panel === "main" &&
      c.sel.mode !== "front" &&
      !(c.card.orderKind === "plan" && !c.card.directOn);
    return html`<section
      data-ww-army-card=${r.id}
      data-collapsed="false"
      aria-label=${armyName(r.nameNo)}
      class="fixed z-[1001] flex max-h-[25vh] ${directCard
        ? "flex-wrap content-start"
        : ""} gap-2 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style="${placeStyle(
        directCard
          ? { ...this.place, maxHeight: directMaxHeight(this.place) }
          : this.place,
      )}${directCard ? directWidthStyle(this.place) : ""}"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div
        class="flex min-w-0 flex-1 flex-col gap-0.5 ${directCard
          ? "basis-44"
          : ""}"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span
            data-ww-zone-dot
            class="size-2.5 shrink-0 rounded-full"
            style="background: ${zoneHueCss(r.id)}"
          ></span>
          <span class="max-w-full shrink-0 truncate text-sm font-bold"
            >${armyName(r.nameNo)}</span
          >
          <span
            data-ww-army-divisions
            class="shrink-0 tabular-nums text-white/70"
            >${translateText("ww1936.land.divisions_of", {
              n: r.divisions,
              max: WW_MAX_ARMY_DIVISIONS,
            })}</span
          >
          <!-- ww7: on the header's right, so the buttons keep the card's width. -->
          <div class="ml-auto flex shrink-0 gap-1">
            ${this.foldButton(c, false)} ${this.closeButton()}
          </div>
        </div>
        ${this.renderGeneral(c)} ${this.renderBars(r.strengthPm, r.orgPm)}
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
              ${this.renderPlanning(c)}
              <span
                data-ww-supply
                class=${c.card.supplyPm < 1000 ? "text-amber-300" : ""}
                >${translateText("ww1936.land.supply", {
                  pct: Math.floor(c.card.supplyPm / 10),
                })}</span
              >
              ${this.renderInvasion(c)} ${this.renderAirPriority(c)}
            </div>`}
        ${this.renderOrderLine(c)} ${this.renderSupplyLine(c)} ${line}
      </div>
      <div
        data-ww-card-buttons=${this.panel}
        class="${this.panel === "main" || this.panel === "auto"
          ? "flex flex-col"
          : "grid grid-cols-5 content-start"} ${directCard
          ? "min-w-0 max-w-full flex-1 basis-[17rem]"
          : "shrink-0"} gap-1"
      >
        ${this.panel === "main"
          ? this.renderButtons(c)
          : this.panel === "auto"
            ? this.renderAutoLevels(c)
            : this.panel === "more"
              ? this.renderMore(c)
              : this.panel === "merge"
                ? this.renderMerge(c)
                : this.panel === "garrison"
                  ? this.renderGarrison(c)
                  : this.panel === "raid"
                    ? this.renderRaid(c)
                    : this.renderMedals(c)}
      </div>
    </section>`;
  }

  // ---- ww162: the battle planner (design §1.5, §2; Design A §3) ----

  /** The first row: [전선] [공세선] [후퇴선] [사단], 44 px tall. */
  private renderChips(c: Ctx): TemplateResult {
    return html`<div
      data-ww-draw-chips
      role="group"
      class="grid grid-cols-4 gap-1"
    >
      ${DRAW_CHIPS.map((m) => {
        const block =
          c.card.buttons.find((b) => b.id === DRAW_CHIP_CHECK[m])?.block ??
          null;
        const id = `draw_${m}`;
        return this.button(
          id,
          translateText(DRAW_CHIP_KEYS[m]),
          DRAW_CHIP_ICONS[m],
          () => {
            if (block !== null) {
              this.refused = { id, block };
              return;
            }
            this.refused = null;
            // A marshal's mode stays the group's ([사단] is the army's own).
            const group =
              m === "divisions" ? undefined : (c.sel.group ?? undefined);
            this.eventBus.emit(new WwDrawModeEvent(m, group));
          },
          { grey: block !== null, pressed: c.sel.draw === m, tall: true },
        );
      })}
    </div>`;
  }

  /**
   * A line mode's card: the name's row (with the planning bar), the hint or
   * the waiting tap, the chips and the mode's second row, which wraps on a
   * phone. It keeps the card's quarter-screen cap and scrolls past it.
   */
  private renderDraw(c: Ctx): TemplateResult {
    const r = c.card.row;
    return html`<section
      data-ww-army-card=${r.id}
      data-collapsed="false"
      data-ww-draw=${c.sel.draw}
      aria-label=${armyName(r.nameNo)}
      class="fixed z-[1001] flex max-h-[25vh] flex-col gap-1 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style="${placeStyle({
        ...this.place,
        maxHeight: drawMaxHeight(this.place),
      })}${directWidthStyle(this.place)}"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div class="flex min-w-0 items-center gap-x-1.5">
        <span
          data-ww-zone-dot
          class="size-2.5 shrink-0 rounded-full"
          style="background: ${zoneHueCss(r.id)}"
        ></span>
        <span class="min-w-0 shrink truncate text-sm font-bold"
          >${c.sel.group !== null
            ? translateText("ww1936.ag.number", { n: c.sel.group })
            : armyName(r.nameNo)}</span
        >
        ${c.sel.group !== null
          ? html`<span
              data-ww-draw-group=${c.sel.group}
              class="shrink-0 text-sky-300"
              >${translateText(PLANNER_KEYS.groupLines)}</span
            >`
          : html`<span
              data-ww-army-divisions
              class="shrink-0 tabular-nums text-white/70"
              >${translateText("ww1936.land.divisions_of", {
                n: r.divisions,
                max: WW_MAX_ARMY_DIVISIONS,
              })}</span
            >`}
        <span class="min-w-0 flex-1">${this.renderPlanning(c)}</span>
        ${this.foldButton(c, false)} ${this.closeButton()}
      </div>
      ${this.renderLine(c)} ${this.renderChips(c)}
      <div
        data-ww-draw-row=${c.sel.draw}
        class="flex flex-wrap content-start items-center gap-1"
      >
        ${this.renderDrawRow(c)}
      </div>
    </section>`;
  }

  /** A line mode's hint; in [사단], the picks and a waiting tap's target. */
  private renderDrawLine(
    c: Ctx,
    mode: DrawChip,
    compact: boolean,
  ): TemplateResult {
    const sel = c.sel;
    const cls = `${compact ? "" : "block "}text-amber-200`;
    if (mode === "divisions" && sel.divisions.length > 0) {
      const picked = translateText(ARMY_HUD_KEYS.picked, {
        n: sel.divisions.length,
      });
      if (sel.pending !== null) {
        return html`<span data-ww-preview="division_move" class=${cls}
          >${picked} → ${regionName(c.view.scenario, sel.pending)} ·
          <span data-ww-tap-again class="font-semibold"
            >${translateText("ww1936.land.tap_again")}</span
          ></span
        >`;
      }
      return html`<span data-ww-hint="draw_divisions" class=${cls}
        >${picked} · ${translateText(DRAW_HINT_KEYS.divisions)}</span
      >`;
    }
    const pan =
      mode !== "divisions" && coarsePointer()
        ? ` · ${translateText(PLANNER_KEYS.hintPan)}`
        : "";
    return html`<span data-ww-hint=${`draw_${mode}`} class=${cls}
      >${translateText(DRAW_HINT_KEYS[mode])}${pan}</span
    >`;
  }

  /** The second row, by mode (design §2). */
  private renderDrawRow(
    c: Ctx,
  ): TemplateResult | (TemplateResult | typeof nothing)[] {
    const sel = c.sel;
    const army = c.card.row.id;
    const order = c.view.armies.get(army)?.mine?.order;
    switch (sel.draw) {
      case "front":
        // A marshal's front is redrawn, not undone or cleared.
        if (sel.group !== null) return [];
        return [
          this.button(
            "planner_undo",
            translateText(PLANNER_KEYS.btnUndo),
            "↶",
            () => {
              if (sel.undo.canUndo(army, "front")) {
                this.planner({ kind: "undo" });
              }
            },
            { grey: !sel.undo.canUndo(army, "front"), wide: true },
          ),
          this.button(
            "planner_clear",
            translateText(PLANNER_KEYS.btnClear),
            "✕",
            () => this.planner({ kind: "clear" }),
            { wide: true },
          ),
        ];
      case "goal": {
        const drafted =
          sel.line?.kind === "goal" && sel.line.army === army
            ? sel.line.regions.length
            : 0;
        const hasGoal =
          (order?.goal?.length ?? 0) > 0 ||
          drafted > 0 ||
          (order?.kind === "plan" && order.targets.length > 0);
        return [
          html`<div
            data-ww-goal-kind
            role="radiogroup"
            class="grid grid-cols-2 gap-1"
          >
            ${this.button(
              "goal_broad",
              translateText(PLANNER_KEYS.goalBroad),
              "═",
              () => this.planner({ kind: "spear", on: false }),
              { pressed: !sel.spear },
            )}
            ${this.button(
              "goal_spear",
              translateText(PLANNER_KEYS.goalSpear),
              "➤",
              () => this.planner({ kind: "spear", on: true }),
              { pressed: sel.spear },
            )}
          </div>`,
          sel.group !== null
            ? nothing
            : html`<div
                data-ww-goal-stance
                role="radiogroup"
                aria-label=${translateText("ww1936.land.stance_label")}
                class="grid grid-cols-3 gap-1"
              >
                ${STANCES.map((st) =>
                  this.button(
                    `goal_stance_${st}`,
                    translateText(STANCE_KEYS[st]),
                    st === "careful" ? "🛡" : st === "balanced" ? "⚖" : "🔥",
                    () => this.planner({ kind: "stance", stance: st }),
                    { pressed: sel.stance === st },
                  ),
                )}
              </div>`,
          c.card.executing
            ? this.button(
                "planner_halt",
                translateText(PLANNER_KEYS.btnHalt),
                "■",
                () => this.planner({ kind: "execute", on: false }),
                { danger: true },
              )
            : this.button(
                "planner_execute",
                translateText(PLANNER_KEYS.btnExecute),
                "▶",
                () => {
                  if (!hasGoal) {
                    this.refused = {
                      id: "planner_execute",
                      block: "no_target",
                    };
                    return;
                  }
                  this.refused = null;
                  this.planner({ kind: "execute", on: true });
                },
                { grey: !hasGoal },
              ),
        ];
      }
      case "fallback": {
        const auto = this.fbAuto.get(army) ?? order?.fbManual !== true;
        const drafted =
          sel.line?.kind === "fallback" && sel.line.army === army
            ? sel.line.regions.length
            : 0;
        const hasLine = (order?.fallback?.length ?? 0) > 0 || drafted > 0;
        const key = `fall_back:${army}`;
        const armed = this.armed(key);
        return [
          this.button(
            "planner_suggest",
            translateText(PLANNER_KEYS.btnSuggest),
            "✦",
            () => this.planner({ kind: "suggest" }),
          ),
          // Falling back by itself is each army's own switch.
          sel.group !== null
            ? nothing
            : this.button(
                "planner_fb_auto",
                translateText(PLANNER_KEYS.fbAuto),
                auto ? "☑" : "☐",
                () => {
                  this.fbAuto.set(army, !auto);
                  this.planner({ kind: "fb_auto", on: !auto });
                },
                { on: auto, wide: true },
              ),
          this.button(
            "planner_fall_back",
            translateText(
              armed ? "ww1936.land.tap_again" : PLANNER_KEYS.btnFallBackNow,
            ),
            "⤺",
            () => {
              if (!hasLine) {
                this.refused = {
                  id: "planner_fall_back",
                  block: "no_fallback",
                };
                return;
              }
              this.refused = null;
              this.confirmTap(key, () =>
                this.planner({ kind: "fall_back_now" }),
              );
            },
            { grey: !hasLine, danger: armed, wide: true },
          ),
        ];
      }
      case "divisions":
        return this.renderDivisionList(c);
      default:
        return [];
    }
  }

  /**
   * [사단] (design §2): the army's divisions by the region they stand in, a
   * check each and a region header that checks them all; a pinned one shows
   * its pin and [해제]; [군 전체] and [모두 해제] on top. The map's next tap
   * sends the checked ones there (the land controller's two taps).
   */
  private renderDivisionList(c: Ctx): TemplateResult[] {
    const sel = c.sel;
    const army = c.card.row.id;
    const pins = c.view.armies.get(army)?.mine?.pins ?? [];
    const rows = divisionRows(c.view, c.me, army);
    const tpl = new Map(rows.map((d) => [d.data.id, d.template]));
    const groups = divisionGroups(
      rows.map((d) => d.data),
      army,
    );
    const picked = new Set(sel.divisions);
    // A drawn check box: the "☐" glyph is a speck in the map's font.
    const box = (on: boolean) =>
      html`<span
        aria-hidden="true"
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border text-xs font-bold leading-none ${on
          ? "border-amber-300 bg-amber-400 text-black"
          : "border-white/60"}"
        >${on ? "✓" : ""}</span
      >`;
    const pick = (ids: number[]) =>
      this.planner({ kind: "pick", divisions: togglePick(sel.divisions, ids) });
    const sc = c.view.scenario;
    return [
      html`<div data-ww-division-top class="flex w-full flex-wrap gap-1">
        ${this.button(
          "planner_whole_army",
          translateText(ARMY_HUD_KEYS.btnWholeArmy),
          "⬚",
          () => this.planner({ kind: "whole_army" }),
          { wide: true },
        )}
        ${pins.length > 0
          ? this.button(
              "planner_release_all",
              translateText(PLANNER_KEYS.btnReleaseAll),
              "📌",
              () => this.planner({ kind: "release", divisions: [] }),
              { wide: true },
            )
          : nothing}
      </div>`,
      html`<ul
        data-ww-division-list
        class="m-0 flex w-full list-none flex-col gap-0.5 p-0"
      >
        ${groups.map((g) => {
          const ids = g.divisions.map((d) => d.id);
          const all = ids.every((id) => picked.has(id));
          return html`<li data-ww-division-group=${g.region}>
            <button
              type="button"
              data-ww-division-region=${g.region}
              aria-pressed=${String(all)}
              class="flex h-10 w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-1.5 text-left font-semibold hover:bg-white/20"
              @click=${() => pick(ids)}
            >
              ${box(all)}
              <span class="min-w-0 truncate"
                >${translateText(PLANNER_KEYS.regionDivisions, {
                  region: regionName(sc, g.region),
                  n: ids.length,
                })}</span
              >
            </button>
            <ul class="m-0 flex list-none flex-col gap-0.5 p-0 pl-3">
              ${g.divisions.map((d) => {
                const on = picked.has(d.id);
                const pin = pinOf(pins, d.id);
                const t = tpl.get(d.id) ?? null;
                return html`<li class="flex items-center gap-1">
                  <button
                    type="button"
                    data-ww-division-pick=${d.id}
                    aria-pressed=${String(on)}
                    class="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left hover:bg-white/10 ${on
                      ? "bg-amber-700/30"
                      : ""}"
                    @click=${() => pick([d.id])}
                  >
                    ${box(on)}
                    <span class="min-w-0 flex-1 truncate"
                      >${t === null ? "" : templateName(t)}</span
                    >
                    ${pin === null
                      ? nothing
                      : html`<span
                          data-ww-division-pin=${pin}
                          class="shrink-0 text-amber-300"
                          >📌
                          ${translateText(ARMY_HUD_KEYS.pinnedTo, {
                            region: regionName(sc, pin),
                          })}</span
                        >`}
                    <span class="flex w-12 shrink-0 flex-col gap-0.5">
                      <span class="h-1 rounded bg-white/10"
                        ><span
                          class="block h-1 rounded bg-emerald-400"
                          style="width: ${Math.max(
                            0,
                            Math.min(1000, d.strengthPm),
                          ) / 10}%"
                        ></span
                      ></span>
                      <span class="h-1 rounded bg-white/10"
                        ><span
                          class="block h-1 rounded bg-sky-400"
                          style="width: ${Math.max(0, Math.min(1000, d.orgPm)) /
                          10}%"
                        ></span
                      ></span>
                    </span>
                  </button>
                  ${pin === null
                    ? nothing
                    : this.button(
                        `planner_release_${d.id}`,
                        translateText(PLANNER_KEYS.btnRelease),
                        "✕",
                        () =>
                          this.planner({ kind: "release", divisions: [d.id] }),
                      )}
                </li>`;
              })}
            </ul>
          </li>`;
        })}
      </ul>`,
    ];
  }

  /**
   * The planning bar (design §1.5): every front and plan army builds it
   * while it does not attack, up to the country's cap (30 % plus techs and
   * spirits; a marshal can lift it further, the bar then stays full).
   */
  private renderPlanning(c: Ctx): TemplateResult | typeof nothing {
    if (c.card.orderKind !== "front" && c.card.orderKind !== "plan") {
      return nothing;
    }
    const stats = statsFromArray(
      this.game.wwPolitics?.()?.detail(c.me)?.stats ?? null,
    );
    const max = planMaxPct(stats.planMaxBp);
    const pct = Math.floor(c.card.planBp / 100);
    return html`<span
      data-ww-planning=${pct}
      class="inline-flex min-w-0 items-center gap-1 text-sky-300"
    >
      <span
        role="meter"
        aria-valuemin="0"
        aria-valuemax=${max}
        aria-valuenow=${pct}
        aria-label=${translateText("ww1936.land.readiness", { pct })}
        class="h-1.5 w-12 shrink-0 rounded bg-white/10"
        ><span
          class="block h-1.5 rounded bg-sky-400"
          style="width: ${Math.min(100, Math.floor((pct * 100) / max))}%"
        ></span
      ></span>
      <span data-ww-readiness class="truncate"
        >${translateText("ww1936.land.readiness", { pct })}</span
      >
    </span>`;
  }

  /**
   * Design A §3: "강도 72 % · 부족: 포 140, 지원 60 · 다 차는 데 18일" — the army's
   * two shortest need groups and the days the stock and today's output take
   * to cover them ("생산 없음" in amber with none). A tap opens the industry
   * drawer's production tab with those rows lit.
   */
  private renderSupplyLine(c: Ctx): TemplateResult | typeof nothing {
    if (this.place.maxHeight <= CARD_MIN_PX) return nothing;
    const a = c.view.armies.get(c.card.row.id);
    const short = a?.mine?.short;
    if (short === undefined || short.length === 0) return nothing;
    const detail = c.economy.detail(c.me);
    if (detail === null) return nothing;
    const rows = stockTable(
      detail,
      c.view.details.get(c.me)?.equipShort ?? null,
      this.game.wwDepth?.()?.detail(c.me)?.designs ?? [],
    );
    const line = supplyLine(short, rows);
    if (line === null) return nothing;
    const w = supplyWords(line, c.card.row.strengthPm);
    return html`<button
      type="button"
      data-ww-army-short=${line.short.map(([g]) => g).join(",")}
      class="flex min-h-10 w-full flex-wrap items-center gap-x-1.5 rounded-md text-left text-white/80 hover:bg-white/10"
      @click=${() =>
        this.eventBus.emit(new WwStockLitEvent(line.short.map(([g]) => g)))}
    >
      <span>${w.strength}</span>
      <span aria-hidden="true">·</span>
      <span class="text-amber-200">${w.short}</span>
      <span aria-hidden="true">·</span>
      <span
        data-ww-short-days=${line.days ?? "none"}
        class=${w.amber ? "font-semibold text-amber-300" : ""}
        >${w.days}</span
      >
    </button>`;
  }

  /** The general under the name's row: name, the four skills, the traits. */
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
    // ww42: a refused attack tap says why, as a toast did.
    if (c.sel.refusal !== null && this.refused === null) {
      return html`<span
        data-ww-block=${c.sel.refusal}
        class="${compact ? "" : "block "}text-red-300"
      >
        🔒 ${cardBlockText(c.sel.refusal as CardBlock)}
      </span>`;
    }
    if (this.refused !== null) {
      return html`<span
        data-ww-block=${this.refused.block}
        class="${compact ? "" : "block "}text-red-300"
      >
        🔒 ${cardBlockText(this.refused.block)}
      </span>`;
    }
    const sel = c.sel;
    if (sel.draw !== "none") return this.renderDrawLine(c, sel.draw, compact);
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
          ? translateText("ww1936.land.hint_defend", {
              n: zoneShown(c.view, sel, c.card.row.id).length,
            })
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

  /**
   * P4 (spec §11.2, §18.3-5): "Landing prep 37/60 d" with its ring, or the
   * landing's state; an easy one's march to its port, what it waits for
   * and its losses at sea.
   */
  private renderInvasion(c: Ctx): TemplateResult | typeof nothing {
    const inv = c.navy === null ? null : invasionOf(c.navy, c.card.row.id);
    if (inv === null) return nothing;
    const sc = c.view.scenario;
    const state =
      inv.state === "preparing"
        ? translateText("ww1936.navy.invasion_prep", {
            d: inv.prepDone,
            n: inv.prepDays,
          })
        : inv.state === "moving"
          ? translateText("ww1936.navy.invasion_moving", {
              port: regionName(sc, inv.from),
            })
          : translateText(`ww1936.invasion_state.${inv.state}`);
    return html`<span data-ww-invasion=${inv.state} class="text-sky-300">
      ${inv.state === "moving" ? nothing : prepRing(inv.prepDone, inv.prepDays)}
      ${state} ·
      ${translateText("ww1936.navy.invasion_target", {
        region: regionName(sc, inv.target),
      })}
      ${inv.wait !== undefined
        ? html`<span data-ww-invasion-wait=${inv.wait} class="text-amber-300"
            >·
            ${translateText("ww1936.navy.invasion_waiting", {
              reason: cardBlockText(inv.wait),
            })}</span
          >`
        : nothing}
      ${(inv.lossPm ?? 0) > 0
        ? html`<span data-ww-invasion-lost class="text-red-300"
            >·
            ${translateText("ww1936.navy.invasion_sea_loss", {
              pct: Math.floor((inv.lossPm ?? 0) / 10),
            })}</span
          >`
        : nothing}
    </span>`;
  }

  /**
   * Easy invasions (spec §18.3-5): the landing's hint, or the card of the
   * tapped coast — the start port, the route's sea regions in traffic-light
   * colours, the expected losses, the preparation, the days to the
   * landing, the split; the second tap confirms, a refusal says why.
   */
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
    const LIGHT = {
      green: "text-emerald-300",
      amber: "text-amber-300",
      red: "text-red-300",
    } as const;
    const DOT = { green: "🟢", amber: "🟡", red: "🔴" } as const;
    return html`<span
      data-ww-preview="invade"
      class="flex flex-wrap items-baseline gap-x-2 ${compact
        ? "max-w-full whitespace-normal"
        : ""}"
    >
      <span data-ww-invasion-target class="font-semibold"
        >⚓ ${regionName(sc, p.target)}</span
      >
      ${p.block !== null
        ? this.blockLine(p.block)
        : html`<span data-ww-invasion-from
              >${translateText("ww1936.navy.invasion_from", {
                port: regionName(sc, p.from),
              })}</span
            >
            ${p.route.map(
              (r) =>
                html`<span data-ww-route-chip=${r.light} class=${LIGHT[r.light]}
                  >${DOT[r.light]}
                  ${translateText("ww1936.navy.route_chip_sup", {
                    sr: srName(sc, r.sr),
                    pct: Math.floor(r.supPm / 10),
                  })}</span
                >`,
            )}
            <span
              data-ww-invasion-loss
              class=${p.lossPm > 0 ? "text-red-300" : "text-emerald-300"}
              >${translateText("ww1936.navy.invasion_loss", {
                pct: Math.floor(p.lossPm / 10),
              })}</span
            >
            <span data-ww-invasion-days
              >${translateText("ww1936.navy.invasion_days", {
                n: p.prepDays,
              })}</span
            >
            <span data-ww-invasion-eta
              >${translateText("ww1936.navy.invasion_eta", {
                n: p.etaDays,
                march: p.marchDays,
                prep: p.prepDays,
                sea: p.seaDays,
              })}</span
            >
            <span data-ww-invasion-split=${p.stay > 0 ? "yes" : "no"}
              >${p.stay > 0
                ? translateText("ww1936.navy.invasion_split", {
                    n: p.going,
                    rest: p.stay,
                  })
                : translateText("ww1936.navy.invasion_no_split")}</span
            >
            ${p.convoysIdle < p.convoysNeed
              ? html`<span data-ww-invasion-convoys class="text-amber-300"
                  >${translateText("ww1936.navy.invasion_convoys_short", {
                    need: p.convoysNeed,
                    idle: p.convoysIdle,
                  })}</span
                >`
              : nothing}
            <span data-ww-tap-again class="font-semibold text-amber-200"
              >${translateText("ww1936.navy.invasion_confirm")}</span
            >`}
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
      // A sea move is shot at below 50% supremacy: say what it costs a day.
      const from =
        kind === "sea" && c.navy !== null
          ? armyLift(c.view, c.economy, c.me, army).regions
          : [];
      const lossPm =
        from.length === 1 && c.navy !== null
          ? (seaMoveLossPm(c.navy, from[0], region) ?? 0)
          : 0;
      body = html`<span
          >→ ${name} ·
          ${translateText("ww1936.land.move_days", {
            days: Math.max(0.1, daysOf(p.ticks)),
          })}</span
        >${lossPm > 0
          ? html`<span data-ww-sea-loss=${lossPm} class="text-red-300"
              >${translateText("ww1936.navy.sea_move_loss", {
                pct: Math.floor(lossPm / 10),
              })}</span
            >`
          : nothing}`;
    } else if (kind === "attack" || kind === "paradrop") {
      // P6 (spec §8.9, pre-flight A18): the defenders through the fog.
      const fog = fogModelOf(this.game);
      const p = attackPreview(
        c.view,
        c.economy,
        c.me,
        army,
        region,
        c.day,
        sides,
        (n, owner) => fog.previewEnemyValue(n, owner),
      );
      if (p !== null) body = this.renderAttack(name, p, compact);
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
      /** The action row's: taller (44 px), the green "on" look for an auto level. */
      tall?: boolean;
      on?: boolean;
      /** A small mark on the button (the auto level). */
      badge?: string;
    } = {},
  ): TemplateResult {
    return html`<button
      type="button"
      data-ww-army-btn=${id}
      aria-disabled=${String(opts.grey ?? false)}
      aria-pressed=${opts.pressed === undefined
        ? nothing
        : String(opts.pressed)}
      class="relative flex ${opts.tall
        ? "h-11 min-w-11"
        : "h-10 min-w-10"} flex-col items-center justify-center rounded-md border px-1 leading-none ${opts.wide
        ? "col-span-2"
        : ""} ${opts.grey
        ? "border-white/5 bg-white/5 text-white/35"
        : opts.danger
          ? "border-red-400 bg-red-900/60"
          : opts.pressed
            ? "border-amber-300 bg-amber-700/50"
            : opts.on
              ? "border-emerald-400/70 bg-emerald-900/50 text-emerald-100"
              : "border-white/15 bg-white/10 hover:bg-white/20"}"
      @click=${act}
    >
      <span aria-hidden="true" class="text-sm">${icon}</span>
      <span class="${opts.wide ? "max-w-28" : "max-w-14"} truncate text-xs"
        >${label}</span
      >
      ${opts.badge === undefined
        ? nothing
        : html`<span
            data-ww-btn-badge
            class="absolute right-0.5 top-0.5 rounded bg-emerald-500 px-1 text-xs font-bold leading-none text-black"
            >${opts.badge}</span
          >`}
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

  /**
   * ww7: what the army does — defending a zone (its size), attacking
   * (the targets, running or not) — its auto level (owner brief 2026-10-30
   * made the AI's command a switch; now two levels) and the country's
   * uncovered border regions.
   */
  private renderOrderLine(c: Ctx): TemplateResult | typeof nothing {
    if (this.place.maxHeight <= CARD_MIN_PX) return nothing;
    const k = c.card.orderKind;
    const sc = c.view.scenario;
    const names = c.card.targets.map((t) => regionName(sc, t)).join(", ");
    // ww162: the army's lines (design §1) and its pinned divisions.
    const mine = c.view.armies.get(c.card.row.id)?.mine ?? null;
    const o = mine?.order;
    const goal = o?.goal ?? [];
    const fallback = o?.fallback ?? [];
    const pins = mine?.pins ?? [];
    return html`<div
      data-ww-order-line
      class="flex min-w-0 flex-wrap gap-x-2 text-white/80"
    >
      ${k === "front"
        ? html`<span data-ww-order="front" class="text-sky-300"
            >🛡
            ${translateText("ww1936.land.order_defend", {
              n: c.card.zone.length,
            })}</span
          >`
        : k === "plan" && goal.length === 0
          ? html`<span data-ww-order="plan" class="text-amber-200"
              >⚔
              ${translateText(
                c.card.executing
                  ? "ww1936.land.order_attack_running"
                  : "ww1936.land.order_attack",
                { targets: names },
              )}</span
            >`
          : nothing}
      ${o?.ends !== undefined
        ? html`<span data-ww-line="front" class="text-sky-300"
            >${translateText(ARMY_HUD_KEYS.lineFront, {
              a: regionName(sc, o.ends[0]),
              b: regionName(sc, o.ends[1]),
            })}</span
          >`
        : nothing}
      ${goal.length > 0
        ? html`<span
            data-ww-line=${o?.spear === true ? "spear" : "goal"}
            class="text-amber-200"
            >⚔
            ${translateText(
              o?.spear === true
                ? c.card.executing
                  ? ARMY_HUD_KEYS.lineSpearRunning
                  : ARMY_HUD_KEYS.lineSpear
                : c.card.executing
                  ? ARMY_HUD_KEYS.lineGoalRunning
                  : ARMY_HUD_KEYS.lineGoal,
              { n: goal.length },
            )}</span
          >`
        : nothing}
      ${fallback.length > 0
        ? html`<span data-ww-line="fallback" class="text-white/70"
            >↩
            ${translateText(ARMY_HUD_KEYS.lineFallback, {
              n: fallback.length,
            })}</span
          >`
        : nothing}
      ${pins.length > 0
        ? html`<span data-ww-pins=${pins.length} class="text-amber-300"
            >📌
            ${translateText(PLANNER_KEYS.pinnedCount, { n: pins.length })}</span
          >`
        : nothing}
      ${c.card.autoLevel > 0
        ? html`<span
            data-ww-auto-level=${c.card.autoLevel}
            class="text-emerald-300"
            >🤖 ${translateText(AUTO_LEVEL_KEYS[c.card.autoLevel])}</span
          >`
        : nothing}
      ${c.card.gaps > 0
        ? html`<span data-ww-gaps=${c.card.gaps} class="text-red-300"
            >${translateText("ww1936.land.gaps", { n: c.card.gaps })}</span
          >`
        : nothing}
    </div>`;
  }

  /**
   * ww42: a human's attack is direct: the settings, the breakdown and the
   * reasons. An older plan army (stance, not direct) keeps its stance switch.
   */
  private renderDirect(c: Ctx): TemplateResult {
    if (c.card.orderKind === "plan" && !c.card.directOn) {
      return html`${this.renderWait(c)}${this.renderStance(c)}`;
    }
    return renderDirectPanel({
      view: c.view,
      card: c.card,
      send: (o) => this.send(o),
      goTo: (region) => {
        const t = c.view.scenario.centerTile(region);
        const w = c.view.scenario.width;
        this.eventBus.emit(new GoToPositionEvent(t % w, Math.floor(t / w)));
      },
    });
  }

  /** ww7: why a running attack stands still (every odds Low) and the one tap that changes it. */
  private renderWait(c: Ctx): TemplateResult | typeof nothing {
    if (!c.card.waitingLowOdds) return nothing;
    return html`<span
      data-ww-wait-odds
      class="flex items-center gap-1.5 text-amber-300"
      >${translateText("ww1936.land.wait_low_odds")}
      <button
        type="button"
        data-ww-wait-aggressive
        class="h-7 rounded-md border border-amber-300/60 bg-amber-900/40 px-2 font-semibold hover:bg-amber-800/60"
        @click=${() => this.setStance(c, "aggressive")}
      >
        🔥 ${translateText("ww1936.land.wait_go_aggressive")}
      </button></span
    >`;
  }

  /** The action row [공격] [방어] [이동] [자동], the stance switch, and the rest. */
  private renderButtons(c: Ctx): (TemplateResult | typeof nothing)[] {
    // An easy invasion sails by itself: no [Launch] (spec §11's keep it).
    const inv = c.navy === null ? null : invasionOf(c.navy, c.card.row.id);
    const landing = inv !== null && inv.easy !== true;
    const one = (id: ArmyButton, tall = false) => {
      // A landing in preparation takes the sea move's place.
      if (id === "sea" && landing) return this.launchButton(c);
      const block = c.card.buttons.find((b) => b.id === id)?.block ?? null;
      const mode = BUTTON_MODES[id];
      const level = id === "auto" ? c.card.autoLevel : 0;
      const pressed =
        mode !== undefined
          ? c.sel.mode === mode
          : id === "auto"
            ? this.panel === "auto"
            : undefined;
      return this.button(
        id,
        translateText(BUTTON_KEYS[id]),
        BUTTON_ICONS[id],
        () => this.tapButton(c, id, block),
        {
          grey: block !== null,
          pressed,
          tall,
          on: level > 0,
          badge: level > 0 ? String(level) : undefined,
        },
      );
    };
    // ww162: [공격] and [방어] gave way to the line chips (a tap on an enemy
    // region still attacks); [이동] and [자동] lead the rest.
    const rest = ARMY_BUTTONS.filter((id) => id !== "plan" && id !== "front");
    return [
      this.renderDirect(c),
      this.renderChips(c),
      html`<div data-ww-army-rest class="grid grid-cols-4 gap-1">
        ${rest.map((id) => one(id))}
      </div>`,
    ];
  }

  /**
   * ww7: the offensive stance switch 신중 / 보통 / 과감 (default 보통); a
   * running attack gets its [중지] beside it.
   */
  private renderStance(c: Ctx): TemplateResult {
    const stance = c.card.orderKind === "plan" ? c.card.stance : c.sel.stance;
    const army = c.card.row.id;
    return html`<div
      data-ww-stance
      role="radiogroup"
      aria-label=${translateText("ww1936.land.stance_label")}
      class="grid ${c.card.executing ? "grid-cols-4" : "grid-cols-3"} gap-1"
    >
      ${STANCES.map((s) =>
        this.button(
          `stance_${s}`,
          translateText(STANCE_KEYS[s]),
          s === "careful" ? "🛡" : s === "balanced" ? "⚖" : "🔥",
          () => this.setStance(c, s),
          { pressed: stance === s },
        ),
      )}
      ${c.card.executing
        ? this.button(
            "stop",
            translateText("ww1936.land.btn_stop"),
            "■",
            () => this.send({ kind: "army_execute", army, on: false }),
            { danger: true },
          )
        : nothing}
    </div>`;
  }

  /** ww7: [자동]'s choices — off, 수비 자동 (level 1), 공세 자동 (level 2) — and what the pressed one means. */
  private renderAutoLevels(c: Ctx): TemplateResult[] {
    const army = c.card.row.id;
    return [
      html`<div class="grid grid-cols-3 gap-1">
        ${AUTO_LEVELS.map((level) =>
          this.levelButton(
            `auto_${level}`,
            translateText(AUTO_LEVEL_KEYS[level]),
            () => {
              this.send({ kind: "army_auto_level", army, level });
              this.panel = "main";
            },
            c.card.autoLevel === level,
          ),
        )}
      </div>`,
      html`<span data-ww-auto-hint class="max-w-56 text-xs text-white/70"
        >${translateText(AUTO_LEVEL_HINTS[c.card.autoLevel])}</span
      >`,
      this.button("back", translateText("common.back"), "←", () => {
        this.panel = "main";
      }),
    ];
  }

  /** A text-only choice button (the auto levels): 44 px, the words wrap. */
  private levelButton(
    id: string,
    label: string,
    act: () => void,
    on: boolean,
  ): TemplateResult {
    return html`<button
      type="button"
      data-ww-army-btn=${id}
      aria-pressed=${String(on)}
      class="flex h-11 min-w-16 items-center justify-center rounded-md border px-1 text-center text-xs font-semibold leading-tight ${on
        ? "border-emerald-400/70 bg-emerald-900/50 text-emerald-100"
        : "border-white/15 bg-white/10 hover:bg-white/20"}"
      @click=${act}
    >
      ${label}
    </button>`;
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
        "convert",
        translateText("ww1936.convert.btn_army"),
        "⇄",
        () => {
          this.panel = "main";
          this.eventBus.emit(new OpenWwArmyEvent("templates", army));
        },
        { wide: true },
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
        c.navy?.stats.harborRaidPm ?? 0,
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
