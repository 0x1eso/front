import type { WwOrder } from "@openfront/engine-api/Schemas";
import { isCountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FocusBranch,
  FocusDef,
  FocusTreeId,
  WW_STAT_KEYS,
  WwFocusCard,
  WwPolDetail,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  DescLine,
  describeCondition,
  describeEffects,
  describeStats,
} from "@openfront/engine-lib/ww1936/Describe";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { ringSvg } from "../domestic/Dial";
import { COMPACT_MAX_HEIGHT, DrawerInsets } from "../domestic/DomesticPanel";
import { blockText } from "./EconomyModel";
import { FocusCanvas, FocusCanvasModel, focusIconUrl } from "./FocusCanvas";
import {
  chipFirst,
  FOCUS_BYPASSED,
  FOCUS_CHIPS,
  FOCUS_CONDITION,
  FOCUS_DONE,
  FOCUS_EXCLUSIVE,
  FOCUS_OPEN,
  FOCUS_PREREQ,
  FOCUS_QUEUED,
  FOCUS_RUNNING,
  FocusChip,
  initialCenter,
} from "./FocusLayout";
import {
  countryName,
  dateLabel,
  isCapitulated,
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
} from "./WorldWarModel";
import { WwDrawerEvent, wwDrawerInsets } from "./WwDrawer";

// World War 1936 P3 (spec §21.3): the national focus drawer — on top the
// running focus (ring, days and seconds left, two taps cancel), the queued
// one (two taps take it out) and the branch chips; in the middle the tree
// canvas; below, 40% of the drawer, the picked card: name, description,
// duration with the speed bonus, prerequisites, exclusive choices,
// conditions (✓/✗ from the engine's failing leaves), effects and the
// start / queue button or why it is blocked.

/** Open the focus drawer, or close it when it is open (the 🎯 dial may use this or `open()`). */
export class OpenWwFocusEvent implements GameEvent {}

/** One day of the calendar in seconds (spec §2.1: 0.75 s). */
const SECONDS_PER_DAY = 0.75;
const GAP = 8;

const STATE_KEYS: Readonly<Record<number, string>> = {
  [FOCUS_OPEN]: "ww1936.focusui.state.open",
  [FOCUS_DONE]: "ww1936.focusui.state.done",
  [FOCUS_BYPASSED]: "ww1936.focusui.state.bypassed",
  [FOCUS_RUNNING]: "ww1936.focusui.state.running",
  [FOCUS_PREREQ]: "ww1936.focusui.state.prereq",
  [FOCUS_CONDITION]: "ww1936.focusui.state.blocked",
  [FOCUS_EXCLUSIVE]: "ww1936.focusui.state.exclusive",
  [FOCUS_QUEUED]: "ww1936.focusui.state.queued",
};

const STATE_COLOR: Readonly<Record<number, string>> = {
  [FOCUS_OPEN]: "text-yellow-200",
  [FOCUS_DONE]: "text-emerald-300",
  [FOCUS_BYPASSED]: "text-gray-400",
  [FOCUS_RUNNING]: "text-cyan-200",
  [FOCUS_PREREQ]: "text-gray-400",
  [FOCUS_CONDITION]: "text-gray-400",
  [FOCUS_EXCLUSIVE]: "text-red-300",
  [FOCUS_QUEUED]: "text-cyan-200",
};

const CHIP_KEYS: Readonly<Record<FocusChip, string>> = {
  all: "ww1936.focusui.chip.all",
  politics: "ww1936.focusui.chip.politics",
  diplomacy: "ww1936.focusui.chip.diplomacy",
  industry: "ww1936.focusui.chip.industry",
  research: "ww1936.focusui.chip.research",
  army: "ww1936.focusui.chip.army",
  air_navy: "ww1936.focusui.chip.air_navy",
};

const BRANCH_KEYS: Readonly<Record<FocusBranch, string>> = {
  politics: "ww1936.focusui.chip.politics",
  diplomacy: "ww1936.focusui.chip.diplomacy",
  industry: "ww1936.focusui.chip.industry",
  research: "ww1936.focusui.chip.research",
  army: "ww1936.focusui.chip.army",
  air: "ww1936.focusui.chip.air",
  navy: "ww1936.focusui.chip.navy",
};

/** Why a card in this state cannot start (the engine's own reasons, `ww1936.econ.block.*`). */
const STATE_BLOCK: Readonly<Record<number, WwOrderBlock>> = {
  [FOCUS_DONE]: "focus_done",
  [FOCUS_BYPASSED]: "focus_done",
  [FOCUS_PREREQ]: "focus_prereq",
  [FOCUS_CONDITION]: "focus_unavailable",
  [FOCUS_EXCLUSIVE]: "focus_exclusive",
};

const FOCUS_SPEED = WW_STAT_KEYS.indexOf("focusSpeedPct");

/** Progress a day, milli (spec §11.2: floor(1000 × (100 + focusSpeedPct) / 100)). */
export function focusPerDayMilli(detail: Pick<WwPolDetail, "stats">): number {
  const speed = detail.stats[FOCUS_SPEED] ?? 0;
  return Math.max(1, Math.floor((1000 * (100 + speed)) / 100));
}

/** Calendar days → wall-clock seconds, rounded up. */
export function focusSeconds(days: number): number {
  return Math.ceil(days * SECONDS_PER_DAY);
}

/** Days left of the running focus (brief: ceil((daysMilli − progressMilli) / perDay)). */
export function focusDaysLeft(
  detail: Pick<WwPolDetail, "stats" | "focus">,
): number {
  const f = detail.focus;
  if (f === null) return 0;
  return Math.ceil(
    Math.max(0, f.daysMilli - f.progressMilli) / focusPerDayMilli(detail),
  );
}

/** Days a focus takes with my speed bonus. */
export function focusDays(
  def: Pick<FocusDef, "days">,
  detail: Pick<WwPolDetail, "stats">,
): number {
  return Math.ceil((def.days * 1000) / focusPerDayMilli(detail));
}

// ---- Explain lines (t9-keys "Param rendering"): codes → names ----

const SEL_PARAMS = new Set(["who", "on", "of", "to", "vs", "target"]);
/** Effects whose where / from / to are region picks. */
const PICK_FX = new Set([
  "build",
  "infra",
  "rail",
  "fort",
  "resource",
  "divisions",
  "move_buildings",
]);
/** Bookkeeping effects: not shown to the player (t9-keys). */
const HIDDEN_FX = new Set([
  "set_flag",
  "clear_flag",
  "set_gflag",
  "clear_gflag",
]);
const ZERO_PARAMS = [
  "days",
  "free",
  "core",
  "suspend",
  "postponeDays",
  "recruitablePct",
  "amount",
];
const NONE_PARAMS = [
  "goal",
  "units",
  "to",
  "name",
  "branch",
  "tech",
  "general",
  "group",
];

const groupText = (id: string) => translateText(`ww1936.pol.group.${id}`);

/** A selector code (`@self`, `from`, a tag, `@leader:<inner>`, `@owner:<group>`, `all`) as text. */
export function selectorText(code: string): string {
  const c = code.startsWith("@") ? code.slice(1) : code;
  if (c === "self") return translateText("ww1936.pol.sel.self");
  if (c === "from") return translateText("ww1936.pol.sel.from");
  if (c === "target") return translateText("ww1936.pol.sel.target");
  if (c === "all") return translateText("ww1936.pol.sel.all");
  if (c.startsWith("leader:")) {
    return translateText("ww1936.pol.sel.leader_of", {
      who: selectorText(c.slice("leader:".length)),
    });
  }
  if (c.startsWith("owner:")) {
    return translateText("ww1936.pol.sel.owner_of", {
      group: groupText(c.slice("owner:".length)),
    });
  }
  return isCountryTag(c) ? countryName(c) : code;
}

/** A region-pick code (Describe.pickCode) as text. */
export function pickText(code: string): string {
  if (code === "capital") return translateText("ww1936.pol.pick.capital");
  const i = code.indexOf(":");
  const head = code.slice(0, i);
  const rest = code.slice(i + 1);
  switch (head) {
    case "group":
      return translateText("ww1936.pol.pick.group", { group: groupText(rest) });
    case "best": {
      const j = rest.indexOf(":");
      if (j < 0) return translateText("ww1936.pol.pick.best", { n: +rest });
      return translateText("ww1936.pol.pick.best_of", {
        n: +rest.slice(0, j),
        group: groupText(rest.slice(j + 1)),
      });
    }
    case "core":
      return translateText("ww1936.pol.pick.core", { n: +rest });
    case "border": {
      const j = rest.lastIndexOf(":");
      const who = rest.slice(0, j);
      const n = +rest.slice(j + 1);
      return who === "threat"
        ? translateText("ww1936.pol.pick.border_threat", { n })
        : translateText("ww1936.pol.pick.border", {
            n,
            who: selectorText(who),
          });
    }
    case "acquired":
      return translateText("ww1936.pol.pick.acquired", { n: +rest });
    case "coastal":
      return translateText("ww1936.pol.pick.coastal", { n: +rest });
    case "resources":
      return translateText("ww1936.pol.pick.resources", { n: +rest });
    case "regions":
      return translateText("ww1936.pol.pick.regions", {
        n: rest.split(",").length,
      });
  }
  return code;
}

function personText(id: string): string {
  if (id.startsWith("title:")) {
    return translateText(`ww1936.title.${id.slice("title:".length)}`);
  }
  const p = CONTENT.personIdx.get(id);
  return p === undefined ? id : translateText(p.nameKey);
}

function idText(fx: boolean, kind: string, id: string): string {
  if (fx) {
    if (kind === "add_spirit" || kind === "remove_spirit") {
      return translateText(`ww1936.spirit.${id}`);
    }
    if (kind === "fire_event") return translateText(`ww1936.event_title.${id}`);
    if (kind === "news") return translateText(`ww1936.news.${id}`);
    return translateText(`ww1936.decision.${id}`);
  }
  if (kind === "has_spirit") return translateText(`ww1936.spirit.${id}`);
  if (kind === "focus_done" || kind === "focus_in_progress") {
    return translateText(`ww1936.focus.${id}`);
  }
  return translateText(`ww1936.decision.${id}`);
}

function paramText(
  fx: boolean,
  kind: string,
  k: string,
  v: string | number,
  params: Record<string, string | number>,
): string | number {
  if (typeof v === "number") return v;
  if (kind === "swap_spirit" && (k === "from" || k === "to")) {
    return translateText(`ww1936.spirit.${v}`);
  }
  if (
    k === "where" ||
    (kind === "move_buildings" && (k === "from" || k === "to"))
  ) {
    return pickText(v);
  }
  if (fx && PICK_FX.has(kind) && k === "to") return pickText(v);
  if (SEL_PARAMS.has(k)) return selectorText(v);
  switch (k) {
    case "id":
      return idText(fx, kind, v);
    case "tag":
      return isCountryTag(v) ? countryName(v) : v;
    case "person":
      return personText(v);
    case "trait":
      return translateText(`ww1936.trait.adv_${v}`);
    case "ideology":
      if (v === "ruling") return translateText("ww1936.pol.ideo_ruling");
      if (v === "largest_other") {
        return translateText("ww1936.pol.ideo_largest_other");
      }
      return translateText(`ww1936.ideology.${v}`);
    case "law":
      return translateText(`ww1936.law_kind.${v}`);
    case "value":
      return kind === "law" || kind === "law_ge" || kind === "set_law"
        ? translateText(`ww1936.law.${params.law}.${v}`)
        : v;
    case "building":
      return translateText(`ww1936.building.${v}`);
    case "res":
      return translateText(`ww1936.res.${v}`);
    case "tech":
      return translateText(`ww1936.tech.${v}`);
    case "type":
      return kind === "war_goal"
        ? translateText(`ww1936.wargoal.${v}`)
        : translateText(`ww1936.equip.${v}`);
    case "goal":
      return translateText(`ww1936.wargoal.${v}`);
    case "branch":
      return translateText(`ww1936.branch.${v}`);
    case "key":
      return translateText(`ww1936.reserve.${v}`);
    case "template":
      return translateText(`ww1936.tpl.${v}`);
    case "general":
      return translateText(`ww1936.general.${v}`);
    case "group":
      return groupText(v);
    case "name":
      return translateText(`ww1936.faction_name.${v}`);
    case "date":
      return dateLabel(dayOfDate(v));
  }
  return v;
}

/**
 * An explain line (Describe) as text, its codes turned into names; a line
 * about another country starts with "<who>: ". Task 8's PoliticsModel may
 * take this over (t9-keys: the model renders the params).
 */
export function lineText(line: DescLine): string {
  const dot = line.key.lastIndexOf(".");
  const kind = line.key.slice(dot + 1);
  const fx = line.key.startsWith("ww1936.fx.");
  const out: Record<string, string | number> = {};
  for (const k of ZERO_PARAMS) out[k] = 0;
  for (const k of NONE_PARAMS) out[k] = "none";
  for (const [k, v] of Object.entries(line.params)) {
    if (k === "who") continue;
    out[k] = paramText(fx, kind, k, v, line.params);
  }
  const text = translateText(line.key, out);
  const who = line.params.who;
  if (who === undefined || who === "@self" || who === "self") return text;
  return (
    translateText("ww1936.pol.who_prefix", { who: selectorText(String(who)) }) +
    text
  );
}

/** Under a line that gives a national spirit: what the spirit does (describeStats). */
function spiritStatLines(l: DescLine): DescLine[] {
  const id =
    l.key === "ww1936.fx.add_spirit"
      ? l.params.id
      : l.key === "ww1936.fx.swap_spirit"
        ? l.params.to
        : undefined;
  const spirit = typeof id === "string" ? CONTENT.spiritIdx.get(id) : undefined;
  if (spirit === undefined) return [];
  return describeStats(spirit.stats).map((x) => ({
    ...x,
    depth: l.depth + 1,
  }));
}

// ---- The drawer ----

interface FocusCtx {
  me: number;
  tree: readonly FocusDef[];
  treeId: FocusTreeId;
  detail: WwPolDetail;
  /** Card state by tree position. */
  states: number[];
  cards: Map<number, WwFocusCard>;
  running: number;
  queued: number;
  /** The engine refuses every order (gone or capitulated). */
  dead: boolean;
}

/**
 * World War 1936 P3 (spec §21.3, pre-flight R15): `<ww-focus-panel>`. The
 * 🎯 dial (Task 8) calls `open()`; Back, ✕ and another World War drawer
 * close it (one at a time, so on a phone nothing else stays open).
 */
@customElement("ww-focus-panel")
export class WwFocusPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private shown = false;
  @state() private insets: DrawerInsets = {
    top: WW_BAND_PX + GAP,
    right: GAP,
    bottom: GAP,
  };
  @state() private compact = false;
  /** The picked card's tree position; -1: none. */
  @state() private selected = -1;
  @state() private chip: FocusChip | null = null;
  private readonly twoTap = new TwoTap();
  private canvas: FocusCanvas | null = null;
  private model: FocusCanvasModel | null = null;
  private redrawKey: readonly unknown[] = [];
  /** Centre the canvas on this card once it exists (set on open). */
  private centerPending: number | null = null;
  /** Opened before my politics arrived: pick the start card when it does. */
  private startPending = false;
  private unregisterBack: (() => void) | null = null;
  private readonly refit = () => {
    const i = wwDrawerInsets();
    // Spec §21.3: the full height under the band.
    const next = { top: WW_BAND_PX + GAP, right: i.right, bottom: i.bottom };
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
      if (e.open && e.drawer !== "focus") this.setShown(false);
    });
    this.eventBus.on(OpenWwFocusEvent, () => this.setShown(!this.shown));
    this.unregisterBack?.();
    this.unregisterBack = registerBackClosable(() => {
      if (!this.shown) return false;
      this.setShown(false);
      return true;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unregisterBack?.();
    this.unregisterBack = null;
    window.removeEventListener("resize", this.refit);
    this.dropCanvas();
  }

  /** Open the drawer (the 🎯 dial). */
  open(): void {
    this.setShown(true);
  }

  close(): void {
    this.setShown(false);
  }

  isOpen(): boolean {
    return this.shown;
  }

  private setShown(shown: boolean) {
    if (shown === this.shown) return;
    this.shown = shown;
    if (shown) {
      this.refit();
      window.addEventListener("resize", this.refit);
      this.chip = null;
      this.selected = -1;
      this.startPending = true;
      this.pickStart();
    } else {
      window.removeEventListener("resize", this.refit);
    }
    this.eventBus.emit(new WwDrawerEvent("focus", shown));
  }

  /** Opening: pick and centre the running card, else the first open one (once my politics has arrived). */
  private pickStart() {
    if (!this.startPending) return;
    const c = this.ctx();
    if (c === null) return;
    this.startPending = false;
    const start = initialCenter(c.detail.cards);
    this.selected = start;
    this.centerPending = start;
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    if (!this.shown) return;
    this.refit();
    this.pickStart();
    const key = [this.game.wwPolitics?.()?.version];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private ctx(): FocusCtx | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const view = this.game.wwPolitics?.() ?? null;
    const p = this.game.myPlayer();
    if (view === null || p === null) return null;
    const me = p.smallID();
    const detail = view.detail(me);
    if (detail === null) return null;
    const tag = p.countryTag();
    const treeId =
      (tag === null ? undefined : CONTENT.countryIdx.get(tag)?.tree) ??
      "generic";
    const tree = CONTENT.treeFocuses[treeId].map((i) => CONTENT.focuses[i]);
    const cards = new Map(detail.cards.map((c) => [c.idx, c]));
    const states = tree.map((_, i) => cards.get(i)?.state ?? FOCUS_PREREQ);
    const pos = (id: string | null | undefined) =>
      id === null || id === undefined ? -1 : tree.findIndex((f) => f.id === id);
    return {
      me,
      tree,
      treeId,
      detail,
      states,
      cards,
      running: pos(detail.focus?.id),
      queued: pos(detail.queued),
      dead: !p.isAlive() || isCapitulated(this.game, me),
    };
  }

  // ---- Orders ----

  private send(order: WwOrder) {
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

  /** Pick a card by id (the canvas, the chips; tests). */
  selectFocus(id: string): void {
    const c = this.ctx();
    if (c === null) return;
    this.selected = c.tree.findIndex((f) => f.id === id);
    if (this.selected >= 0) this.canvas?.panTo(this.selected);
  }

  private pickChip(c: FocusCtx, chip: FocusChip) {
    this.chip = chip;
    if (chip === "all") {
      this.canvas?.showAll();
      return;
    }
    const pos = chipFirst(c.tree, chip);
    if (pos >= 0) this.canvas?.panTo(pos);
  }

  // ---- Canvas ----

  private dropCanvas() {
    this.canvas?.destroy();
    this.canvas = null;
  }

  protected updated() {
    const el = this.querySelector<HTMLCanvasElement>(
      "canvas[data-ww-focus-canvas]",
    );
    if (el === null) {
      this.dropCanvas();
      return;
    }
    if (this.canvas?.canvas !== el) {
      this.dropCanvas();
      this.canvas = new FocusCanvas(el, (pos) => {
        this.selected = pos;
      });
    }
    const c = this.ctx();
    if (c === null) return;
    this.canvas.setModel(this.canvasModel(c));
    if (this.centerPending !== null) {
      const pos = this.centerPending;
      this.centerPending = null;
      if (pos >= 0) this.canvas.centerOn(pos);
      else this.canvas.showAll();
    }
  }

  private canvasModel(c: FocusCtx): FocusCanvasModel {
    const f = c.detail.focus;
    const progress =
      f === null || f.daysMilli <= 0 ? 0 : f.progressMilli / f.daysMilli;
    const key = [
      c.treeId,
      c.states.join(""),
      progress.toFixed(3),
      this.selected,
      c.detail.stats[FOCUS_SPEED] ?? 0,
    ].join("|");
    if (this.model !== null && this.model.key === key) return this.model;
    this.model = {
      key,
      tree: c.tree,
      states: c.states,
      progress,
      selected: this.selected,
      names: c.tree.map((d) => translateText(`ww1936.focus.${d.id}`)),
      daysChips: c.tree.map((d) =>
        translateText("ww1936.focusui.days_chip", {
          days: focusDays(d, c.detail),
        }),
      ),
      bypassed: translateText("ww1936.focusui.state.bypassed"),
    };
    return this.model;
  }

  // ---- Render ----

  render() {
    if (!this.shown) return null;
    const c = this.ctx();
    const { top, right, bottom } = this.insets;
    const title = translateText("ww1936.focusui.title");
    const close = html`<button
      type="button"
      data-ww-drawer-close
      class="size-9 shrink-0 rounded-md hover:bg-white/10"
      aria-label=${translateText("common.close")}
      @click=${() => this.setShown(false)}
    >
      ✕
    </button>`;
    const slots = c === null ? nothing : this.renderSlots(c);
    const chips = c === null ? nothing : this.renderChips(c);
    return html`
      <aside
        data-ww-drawer="focus"
        data-compact=${String(this.compact)}
        aria-label=${title}
        class="fixed z-[1002] flex min-h-40 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/92 text-sm text-white shadow-xl"
        style="top: ${top}px; right: ${right}px; bottom: ${bottom}px; width: min(640px, calc(60vw - ${right}px));"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        ${this.compact
          ? html`<div
              data-ww-drawer-head
              class="flex shrink-0 items-center gap-1 border-b border-white/10 p-1"
            >
              ${slots}
              <div class="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                ${chips}
              </div>
              ${close}
            </div>`
          : html`<div
                data-ww-drawer-head
                class="flex shrink-0 items-center gap-2 pl-3 pr-1 pt-1"
              >
                <span aria-hidden="true">🎯</span>
                <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
                  ${title}
                  ${c === null
                    ? nothing
                    : html`<span class="ml-1 text-xs font-normal text-white/60"
                        >${translateText(
                          c.treeId === "generic"
                            ? "ww1936.focusui.tree.generic"
                            : "ww1936.focusui.tree.national",
                        )}</span
                      >`}
                </h3>
                ${close}
              </div>
              <div class="flex shrink-0 gap-1 px-2 pt-1">${slots}</div>
              <div
                class="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-2 py-1"
              >
                ${chips}
              </div>`}
        <div class="relative min-h-0 flex-1">
          ${c === null
            ? nothing
            : html`<canvas
                data-ww-focus-canvas
                aria-label=${title}
                class="absolute inset-0 block h-full w-full touch-none select-none"
              ></canvas>`}
        </div>
        <div
          data-ww-focus-detail
          class="h-[40%] shrink-0 overflow-y-auto border-t border-white/10 px-2 pb-2 text-xs"
        >
          ${c === null ? nothing : this.renderDetail(c)}
        </div>
      </aside>
    `;
  }

  private icon(def: FocusDef, size: string): TemplateResult {
    return html`<img
      src=${focusIconUrl(def.icon)}
      alt=""
      aria-hidden="true"
      draggable="false"
      class="${size} shrink-0"
    />`;
  }

  private renderSlots(c: FocusCtx): TemplateResult {
    const d = c.detail;
    const run = c.running >= 0 ? c.tree[c.running] : null;
    let running: TemplateResult;
    if (run === null || d.focus === null) {
      running = html`<div
        data-ww-focus-idle
        class="flex h-10 min-w-0 shrink items-center rounded-md border border-yellow-300/80 bg-yellow-950/40 px-2 text-xs font-semibold text-yellow-100 shadow-[0_0_8px_rgba(253,224,71,0.45)]"
      >
        <span class="truncate">${translateText("ww1936.focusui.idle")}</span>
      </div>`;
    } else {
      const key = `focus_cancel:${run.id}`;
      const armed = this.armed(key);
      const days = focusDaysLeft(d);
      const progress =
        d.focus.daysMilli <= 0 ? 0 : d.focus.progressMilli / d.focus.daysMilli;
      running = html`<button
        type="button"
        data-ww-focus-running
        data-armed=${String(armed)}
        ?disabled=${c.dead}
        class="flex h-10 min-w-0 shrink items-center gap-1.5 rounded-md border px-1 text-left ${armed
          ? "border-red-400 bg-red-950/60"
          : "border-cyan-300/60 bg-cyan-950/60"}"
        @click=${() =>
          this.confirmTap(key, () => this.send({ kind: "focus_cancel" }))}
      >
        <span
          role="img"
          aria-label=${translateText("ww1936.focusui.running")}
          class="relative grid size-8 shrink-0 place-items-center"
        >
          ${ringSvg(progress, "science")}
          <span class="relative">${this.icon(run, "size-4")}</span>
        </span>
        <span class="flex min-w-0 flex-col leading-tight">
          <span class="truncate text-xs font-semibold"
            >${translateText(`ww1936.focus.${run.id}`)}</span
          >
          <span
            data-ww-focus-left
            class="truncate text-[11px] ${armed
              ? "text-red-200"
              : "text-cyan-100/80"}"
            >${armed
              ? translateText("ww1936.focusui.cancel_tap")
              : translateText("ww1936.focusui.left", {
                  days,
                  seconds: focusSeconds(days),
                })}</span
          >
        </span>
      </button>`;
    }
    const q = c.queued >= 0 ? c.tree[c.queued] : null;
    let queued: TemplateResult | typeof nothing = nothing;
    if (q !== null) {
      const key = `focus_unqueue:${q.id}`;
      const armed = this.armed(key);
      queued = html`<button
        type="button"
        data-ww-focus-queued
        data-armed=${String(armed)}
        ?disabled=${c.dead}
        class="flex h-10 min-w-0 shrink items-center gap-1.5 rounded-md border border-dashed px-1.5 text-left text-xs ${armed
          ? "border-red-400 bg-red-950/60 text-red-200"
          : "border-cyan-300/60 text-cyan-100"}"
        @click=${() =>
          this.confirmTap(key, () => this.send({ kind: "focus_unqueue" }))}
      >
        ${this.icon(q, "size-4")}
        <span class="truncate"
          >${armed
            ? translateText("ww1936.focusui.unqueue_tap")
            : translateText("ww1936.focusui.queued", {
                focus: translateText(`ww1936.focus.${q.id}`),
              })}</span
        >
      </button>`;
    }
    return html`${running}${queued}`;
  }

  private renderChips(c: FocusCtx): TemplateResult {
    return html`${FOCUS_CHIPS.map(
      (chip) =>
        html`<button
          type="button"
          data-ww-focus-chip=${chip}
          aria-pressed=${String(this.chip === chip)}
          class="h-9 min-w-9 shrink-0 rounded-full px-2.5 text-xs font-semibold ${this
            .chip === chip
            ? "bg-white/20 text-white"
            : "bg-white/5 text-white/75 hover:bg-white/10"}"
          @click=${() => this.pickChip(c, chip)}
        >
          ${translateText(CHIP_KEYS[chip])}
        </button>`,
    )}`;
  }

  private renderDetail(c: FocusCtx): TemplateResult {
    const def = c.tree[this.selected];
    if (def === undefined) {
      return html`<p
        data-ww-focus-empty
        class="m-0 py-3 text-center text-white/60"
      >
        ${translateText("ww1936.focusui.detail_empty")}
      </p>`;
    }
    const card = c.cards.get(this.selected);
    const st = c.states[this.selected];
    const base = def.days;
    const days = focusDays(def, c.detail);
    const duration =
      days === base
        ? translateText("ww1936.focusui.duration_same", {
            days,
            seconds: focusSeconds(days),
          })
        : translateText("ww1936.focusui.duration", {
            base,
            days,
            seconds: focusSeconds(days),
          });
    return html`
      <div
        data-ww-focus-card=${def.id}
        data-state=${String(st)}
        class="sticky top-0 z-10 -mx-2 flex items-center gap-2 bg-gray-900/95 px-2 py-1"
      >
        ${this.icon(def, "size-6")}
        <div class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="truncate text-xs font-bold"
            >${translateText(`ww1936.focus.${def.id}`)}</span
          >
          <span class="truncate text-[11px] text-white/70">
            <span class=${STATE_COLOR[st] ?? ""}
              >${translateText(
                STATE_KEYS[st] ?? STATE_KEYS[FOCUS_PREREQ],
              )}</span
            >
            · ${translateText(BRANCH_KEYS[def.branch])} ·
            <span data-ww-focus-duration>${duration}</span>
          </span>
        </div>
        ${this.renderAction(c, def, st)}
      </div>
      <p class="m-0 mt-1 whitespace-pre-line text-white/80">
        ${translateText(`ww1936.focus_desc.${def.id}`)}
      </p>
      ${this.renderPrereqs(c, def)} ${this.renderExclusive(c, def)}
      ${this.renderConditions(def, card)} ${this.renderEffects(def)}
    `;
  }

  /** Start / queue / cancel / unqueue, or why not (ww1936.econ.block.*). */
  private renderAction(c: FocusCtx, def: FocusDef, st: number): TemplateResult {
    const btn = (
      action: string,
      label: string,
      look: string,
      click: () => void,
      armed = false,
    ) =>
      html`<button
        type="button"
        data-ww-focus-action=${action}
        data-armed=${String(armed)}
        class="h-9 min-w-[4.5rem] shrink-0 rounded-md px-3 text-xs font-bold ${look}"
        @click=${click}
      >
        ${label}
      </button>`;
    const reason = (b: WwOrderBlock) =>
      html`<span
        data-ww-block=${b}
        class="max-w-[45%] shrink-0 text-right text-[11px] leading-tight text-red-300"
        >🔒 ${blockText(b)}</span
      >`;
    if (c.dead) return reason("dead");
    const busy = c.running >= 0;
    if (this.selected === c.running) {
      const key = `focus_cancel:${def.id}`;
      const armed = this.armed(key);
      return btn(
        "cancel",
        translateText(
          armed ? "ww1936.focusui.cancel_tap" : "ww1936.focusui.cancel",
        ),
        armed ? "bg-red-600 text-white" : "bg-red-900/70 text-red-100",
        () => this.confirmTap(key, () => this.send({ kind: "focus_cancel" })),
        armed,
      );
    }
    if (this.selected === c.queued || st === FOCUS_QUEUED) {
      const key = `focus_unqueue:${def.id}`;
      const armed = this.armed(key);
      return btn(
        "unqueue",
        translateText(
          armed ? "ww1936.focusui.unqueue_tap" : "ww1936.focusui.unqueue",
        ),
        armed ? "bg-red-600 text-white" : "bg-gray-700 text-white",
        () => this.confirmTap(key, () => this.send({ kind: "focus_unqueue" })),
        armed,
      );
    }
    if (!busy) {
      if (st !== FOCUS_OPEN) return reason(STATE_BLOCK[st] ?? "focus_prereq");
      return btn(
        "start",
        translateText("ww1936.focusui.start"),
        "bg-yellow-400 text-gray-900",
        () => this.send({ kind: "focus_start", focus: def.id }),
      );
    }
    // A busy tree queues: a prerequisite the running focus will meet counts (spec §11.2).
    if (st === FOCUS_OPEN || (st === FOCUS_PREREQ && this.queueable(c, def))) {
      return btn(
        "queue",
        translateText("ww1936.focusui.queue"),
        "bg-cyan-500 text-gray-900",
        () => this.send({ kind: "focus_queue", focus: def.id }),
      );
    }
    return reason(STATE_BLOCK[st] ?? "focus_prereq");
  }

  /** Every prerequisite group has a done, skipped or running member. */
  private queueable(c: FocusCtx, def: FocusDef): boolean {
    const met = (id: string) => {
      const i = c.tree.findIndex((f) => f.id === id);
      const s = c.states[i];
      return s === FOCUS_DONE || s === FOCUS_BYPASSED || i === c.running;
    };
    return (def.prereq ?? []).every((g) => g.some(met));
  }

  private mark(ok: boolean): TemplateResult {
    return ok
      ? html`<span data-ok="true" class="w-3 shrink-0 text-emerald-300"
          >✓</span
        >`
      : html`<span data-ok="false" class="w-3 shrink-0 text-red-300">✗</span>`;
  }

  private row(
    depth: number,
    body: TemplateResult | string,
    mark: TemplateResult | typeof nothing = nothing,
  ): TemplateResult {
    return html`<li
      class="flex gap-1 leading-snug"
      style="padding-left: ${depth * 12}px"
    >
      ${mark}<span class="min-w-0">${body}</span>
    </li>`;
  }

  private section(
    id: string,
    titleKey: string,
    rows: TemplateResult[],
  ): TemplateResult | typeof nothing {
    if (rows.length === 0) return nothing;
    return html`<section data-ww-focus-section=${id} class="mt-2">
      <h4 class="m-0 text-[11px] font-bold uppercase text-white/60">
        ${translateText(titleKey)}
      </h4>
      <ul class="m-0 list-none p-0">
        ${rows}
      </ul>
    </section>`;
  }

  private renderPrereqs(c: FocusCtx, def: FocusDef) {
    const groups = def.prereq ?? [];
    const done = (id: string) => {
      const i = c.tree.findIndex((f) => f.id === id);
      return c.states[i] === FOCUS_DONE || c.states[i] === FOCUS_BYPASSED;
    };
    const name = (id: string) => translateText(`ww1936.focus.${id}`);
    const rows: TemplateResult[] = [];
    const d0 = groups.length > 1 ? 1 : 0;
    if (groups.length > 1) {
      rows.push(this.row(0, translateText("ww1936.focusui.requires_all")));
    }
    for (const g of groups) {
      if (g.length === 1) {
        rows.push(this.row(d0, name(g[0]), this.mark(done(g[0]))));
        continue;
      }
      rows.push(
        this.row(
          d0,
          translateText("ww1936.focusui.requires_any"),
          this.mark(g.some(done)),
        ),
      );
      for (const id of g)
        rows.push(this.row(d0 + 1, name(id), this.mark(done(id))));
    }
    return this.section("requires", "ww1936.focusui.requires", rows);
  }

  private renderExclusive(c: FocusCtx, def: FocusDef) {
    const rows = (def.exclusive ?? []).map((id) => {
      const i = c.tree.findIndex((f) => f.id === id);
      const s = c.states[i];
      const taken =
        s === FOCUS_DONE || s === FOCUS_RUNNING || s === FOCUS_QUEUED;
      return this.row(
        0,
        translateText(`ww1936.focus.${id}`),
        taken
          ? html`<span data-ok="false" class="w-3 shrink-0 text-red-300"
              >⨯</span
            >`
          : html`<span class="w-3 shrink-0 text-white/50">•</span>`,
      );
    });
    return this.section("excludes", "ww1936.focusui.excludes", rows);
  }

  /** `available`, leaf by leaf: ✗ where the engine says it fails (WwFocusCard.failing). */
  private renderConditions(def: FocusDef, card: WwFocusCard | undefined) {
    const failing = new Set(card?.failing ?? []);
    const rows = describeCondition(def.available).map((l) =>
      this.row(
        l.depth,
        lineText(l),
        l.leaf < 0 ? nothing : this.mark(!failing.has(l.leaf)),
      ),
    );
    return this.section("conditions", "ww1936.focusui.conditions", rows);
  }

  private renderEffects(def: FocusDef) {
    const rows = describeEffects(def.effects)
      .filter((l) => !HIDDEN_FX.has(l.key.slice("ww1936.fx.".length)))
      .flatMap((l) => [l, ...spiritStatLines(l)])
      .map((l) => this.row(l.depth, lineText(l)));
    return this.section("effects", "ww1936.focusui.effects", rows);
  }
}
