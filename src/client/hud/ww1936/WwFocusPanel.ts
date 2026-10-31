import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FocusBranch,
  FocusDef,
  FocusTreeId,
  WW_STAT_KEYS,
  WwFocusCard,
  WwPolDetail,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  DescLine,
  describeCondition,
  describeEffects,
  describeStats,
} from "@openfront/engine-lib/ww1936/Describe";
import {
  scaleFocusEffects,
  scaleSpiritStats,
} from "@openfront/engine-lib/ww1936/FocusScale";
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
import { DepthMiscModel, packFirst } from "./DepthMiscModel";
import { blockText } from "./EconomyModel";
import { FocusCanvas, FocusCanvasModel, focusIconUrl } from "./FocusCanvas";
import {
  fadedCards,
  FocusFilters,
  focusGroups,
  groupLabel,
  hiddenCards,
  recommendedIndex,
  searchMatches,
} from "./FocusGroups";
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
  GROUP_TINTS,
  groupFirst,
  initialCenter,
  layoutOf,
} from "./FocusLayout";
import { lineText } from "./PoliticsModel";
import {
  countryName,
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
  wwActive,
} from "./WorldWarModel";
import { renderContinuousBand } from "./WwContinuousBand";
import { WwDrawerEvent, wwDrawerInsets } from "./WwDrawer";
import {
  WwClosePanelEvent,
  WwPanelMinimizedEvent,
  wwPanelStyle,
} from "./WwPanelMode";

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

const FILTER_KEYS = {
  available: "ww1936.focusui.filter_available",
  history: "ww1936.focusui.filter_history",
  hideDone: "ww1936.focusui.filter_hide_done",
} as const;

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

// ---- Explain lines: PoliticsModel.lineText (the one renderer, Task 8) ----

/** Bookkeeping effects: not shown to the player (t9-keys). */
const HIDDEN_FX = new Set([
  "set_flag",
  "clear_flag",
  "set_gflag",
  "clear_gflag",
]);

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
  return describeStats(
    l.params.scaled === 1 ? scaleSpiritStats(spirit.stats) : spirit.stats,
  ).map((x) => ({
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
  @state() private minimized = false;
  @state() private insets: DrawerInsets = {
    top: WW_BAND_PX + GAP,
    right: GAP,
    bottom: GAP,
  };
  @state() private compact = false;
  /** Landscape (width > height): the detail is a right-side sheet; else a bottom sheet. */
  @state() private land = false;
  /** Portrait: the bottom sheet is expanded (collapsed is one row). */
  @state() private sheetOpen = false;
  /** The sheet state the canvas was last told about (to re-fit and keep the card in view). */
  private sheetKey = "";
  /** The picked card's tree position; -1: none. */
  @state() private selected = -1;
  @state() private chip: FocusChip | "pack" | null = null;
  /** Phone, both slots filled: the chips folded behind a "▾" button, and whether its list is open. */
  @state() private chipMenu = false;
  /** Per-viewer UI state: collapsed group keys, the search text and its current match. */
  @state() private collapsed: ReadonlySet<string> = new Set();
  @state() private query = "";
  @state() private matchAt = 0;
  @state() private filters: FocusFilters = {
    available: false,
    history: false,
    hideDone: false,
  };
  /** One tree array per tree id, so the layout is computed once. */
  private readonly trees = new Map<string, readonly FocusDef[]>();
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
    const land = window.innerWidth > window.innerHeight;
    if (land !== this.land) this.land = land;
  };

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwDrawerEvent, (e) => {
      if (e.open && e.drawer !== "focus") this.setShown(false);
    });
    this.eventBus.on(WwPanelMinimizedEvent, (e) => {
      if (this.shown) this.minimized = e.minimized;
    });
    this.eventBus.on(WwClosePanelEvent, () => this.setShown(false));
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
    this.minimized = false;
    if (shown) {
      this.refit();
      window.addEventListener("resize", this.refit);
      this.chip = null;
      this.chipMenu = false;
      this.query = "";
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
    const key = [
      this.game.wwPolitics?.()?.version,
      this.game.wwDepth?.()?.version,
    ];
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
    let tree = this.trees.get(treeId);
    if (tree === undefined) {
      tree = CONTENT.treeFocuses[treeId].map((i) => CONTENT.focuses[i]);
      this.trees.set(treeId, tree);
    }
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
      // P5 pre-flight §0-1: an exile still runs its focus.
      dead: !wwActive(this.game, me),
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

  private names(c: FocusCtx): string[] {
    return c.tree.map((d) => translateText(`ww1936.focus.${d.id}`));
  }

  private toggleGroup(key: string) {
    const next = new Set(this.collapsed);
    if (!next.delete(key)) next.add(key);
    this.collapsed = next;
  }

  /** Typing searches and jumps to the first match; the arrow goes to the next. */
  private search(c: FocusCtx, q: string, step: boolean) {
    this.query = q;
    const hits = searchMatches(this.names(c), q);
    this.matchAt =
      step && hits.length > 0 ? (this.matchAt + 1) % hits.length : 0;
    const pos = hits[this.matchAt];
    if (pos === undefined) return;
    // Open the match's group, then pan once the canvas has redrawn.
    const g = c.tree[pos].group ?? `branch:${c.tree[pos].branch}`;
    if (this.collapsed.has(g)) this.toggleGroup(g);
    this.selected = pos;
    void this.updateComplete.then(() => this.canvas?.panTo(pos));
  }

  private renderTools(c: FocusCtx): TemplateResult {
    const hits = searchMatches(this.names(c), this.query);
    const groups = focusGroups(c.tree, c.states);
    const grouped = c.tree.some((d) => d.group !== undefined);
    return html`<div
      data-ww-focus-tools
      class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 px-2 py-1"
    >
      <input
        type="search"
        data-ww-focus-search
        class="h-9 w-32 shrink-0 rounded-md bg-white/10 px-2 text-xs text-white"
        placeholder=${translateText("ww1936.focusui.search")}
        aria-label=${translateText("ww1936.focusui.search")}
        .value=${this.query}
        @input=${(e: Event) =>
          this.search(c, (e.target as HTMLInputElement).value, false)}
      />
      ${this.query.trim() === ""
        ? nothing
        : html`<button
            type="button"
            data-ww-focus-next
            class="h-9 shrink-0 rounded-full bg-white/10 px-2.5 text-xs font-semibold"
            @click=${() => this.search(c, this.query, true)}
          >
            ${hits.length === 0
              ? translateText("ww1936.focusui.search_none")
              : translateText("ww1936.focusui.search_next", {
                  n: this.matchAt + 1,
                  total: hits.length,
                })}
          </button>`}
      ${(["available", "history", "hideDone"] as const).map(
        (k) =>
          html`<button
            type="button"
            data-ww-focus-filter=${k}
            aria-pressed=${String(this.filters[k])}
            class="h-9 shrink-0 rounded-full px-2.5 text-xs font-semibold ${this
              .filters[k]
              ? "bg-white text-black"
              : "bg-white/10"}"
            @click=${() =>
              (this.filters = { ...this.filters, [k]: !this.filters[k] })}
          >
            ${translateText(FILTER_KEYS[k])}
          </button>`,
      )}
      ${grouped || groups.length > 1
        ? groups.map((g, gi) => {
            const off = this.collapsed.has(g.key);
            const name = g.key.startsWith("branch:")
              ? translateText(
                  BRANCH_KEYS[g.key.slice(7) as FocusBranch] ??
                    "ww1936.focusui.chip.all",
                )
              : groupLabel(g.key);
            const tint = GROUP_TINTS[gi % GROUP_TINTS.length];
            return html`<span
              class="flex h-9 shrink-0 items-center rounded-full ${off
                ? "bg-white/5 text-white/50"
                : "bg-white/15 text-white"}"
            >
              <button
                type="button"
                data-ww-focus-group-go=${g.key}
                aria-label=${name}
                class="flex size-9 items-center justify-center"
                @click=${() => this.goGroup(c, gi)}
              >
                <span
                  class="size-3 rounded-full"
                  style="background: rgb(${tint})"
                ></span>
              </button>
              <button
                type="button"
                data-ww-focus-group=${g.key}
                aria-pressed=${String(off)}
                class="h-9 pr-2.5 text-xs font-semibold"
                @click=${() => this.toggleGroup(g.key)}
              >
                ${translateText(
                  off
                    ? "ww1936.focusui.group_collapsed"
                    : "ww1936.focusui.group_open",
                  { name, done: g.done, total: g.members.length },
                )}
              </button>
            </span>`;
          })
        : nothing}
    </div>`;
  }

  /** A legend dot: pan to the group's first card. */
  private goGroup(c: FocusCtx, g: number) {
    const pos = groupFirst(layoutOf(c.tree), g);
    if (pos >= 0) this.canvas?.panTo(pos);
  }

  private pickChip(c: FocusCtx, chip: FocusChip | "pack") {
    this.chip = chip;
    this.chipMenu = false;
    if (chip === "pack") {
      const at = packFirst(c.tree);
      if (at >= 0) this.canvas?.panTo(at);
      return;
    }
    if (chip === "all") {
      this.canvas?.showAll();
      return;
    }
    const pos = chipFirst(layoutOf(c.tree), c.tree, chip);
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
        this.chipMenu = false;
      });
    }
    const c = this.ctx();
    if (c === null) return;
    this.canvas.setModel(this.canvasModel(c));
    // The sheet took or gave back room: re-fit the canvas and keep the card in view.
    const key = `${this.land}|${this.selected >= 0}|${this.sheetOpen}`;
    if (key !== this.sheetKey) {
      this.sheetKey = key;
      if (this.selected >= 0) this.canvas.keepVisible(this.selected);
    }
    if (this.centerPending !== null) {
      const pos = this.centerPending;
      this.centerPending = null;
      const top = pos >= 0 ? pos : chipFirst(layoutOf(c.tree), c.tree, "all");
      this.canvas.centerOn(top);
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
    const names = this.names(c);
    const keep = new Set<number>(
      [c.running, c.queued, this.selected].filter((i) => i >= 0),
    );
    const hits = searchMatches(names, this.query);
    hits.forEach((i) => keep.add(i));
    const hidden = hiddenCards(c.tree, this.collapsed, keep);
    const found = c.tree.map((_, i) => hits.includes(i));
    const star = recommendedIndex(c.tree, c.states, CONTENT.paths[c.treeId]);
    const path = CONTENT.paths[c.treeId];
    const onPath = new Set(path ?? []);
    const history = c.tree.map((d) => onPath.has(d.id));
    const faded = fadedCards(c.tree, c.states, this.filters, path, keep);
    const key2 = `${key}|${hidden.map(Number).join("")}|${found.map(Number).join("")}|${faded.map(Number).join("")}|${star}`;
    if (this.model !== null && this.model.key === key2) return this.model;
    this.model = {
      key: key2,
      hidden,
      found,
      star,
      faded,
      history,
      texts: {
        or: translateText("ww1936.focusui.or"),
        pick: translateText("ww1936.focusui.pick_one"),
      },
      tree: c.tree,
      states: c.states,
      progress,
      selected: this.selected,
      names,
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
    const chips = c === null ? nothing : this.renderChips(c, false);
    // A phone with the running and the queued slot: the chips would get
    // about 100 px, so they fold behind one "▾" button.
    const folded = this.compact && c !== null && c.queued >= 0;
    return html`
      <aside
        data-ww-drawer="focus"
        data-compact=${String(this.compact)}
        aria-label=${title}
        class="fixed z-[1002] flex flex-col overflow-hidden bg-gray-900 text-sm text-white"
        style=${wwPanelStyle(this.minimized)}
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        ${this.compact
          ? html`<div
              data-ww-drawer-head
              class="relative flex shrink-0 items-center gap-1 border-b border-white/10 p-1"
            >
              ${slots}
              ${folded && c !== null
                ? this.renderChipMenu(c)
                : html`<div class="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    ${chips}
                  </div>`}
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
        ${c === null ? nothing : this.renderTools(c)} ${this.renderBand()}
        <div
          data-ww-focus-body
          data-layout=${this.land ? "land" : "port"}
          class="flex min-h-0 flex-1 ${this.land ? "flex-row" : "flex-col"}"
        >
          <div data-ww-focus-canvas-box class="relative min-h-0 min-w-0 flex-1">
            ${c === null
              ? nothing
              : html`<canvas
                  data-ww-focus-canvas
                  aria-label=${title}
                  class="absolute inset-0 block h-full w-full touch-none select-none"
                ></canvas>`}
          </div>
          ${this.renderSheet(c)}
        </div>
      </aside>
    `;
  }

  /** The detail: a right-side sheet in landscape (only with a pick), else a compact bottom sheet. */
  private renderSheet(c: FocusCtx | null): TemplateResult | typeof nothing {
    const has = c !== null && c.tree[this.selected] !== undefined;
    if (this.land) {
      if (!has) return nothing;
      const w = window.innerWidth >= 1000 ? "w-[320px]" : "w-[280px]";
      return html`<div
        data-ww-focus-detail
        data-sheet="right"
        class="${w} shrink-0 overflow-y-auto border-l border-white/10 px-2 pb-1 text-[11px]"
      >
        ${this.renderDetail(c, true)}
      </div>`;
    }
    const open = has && this.sheetOpen;
    return html`<div
      data-ww-focus-detail
      data-sheet="bottom"
      data-open=${String(open)}
      class="shrink-0 overflow-y-auto border-t border-white/10 px-2 pb-1 text-[11px] ${open
        ? "max-h-[45%]"
        : ""}"
    >
      ${c === null ? nothing : this.renderDetail(c, open)}
    </div>`;
  }

  /** The continuous-focus band over the tree (spec §12). */
  private renderBand(): TemplateResult | typeof nothing {
    const band = new DepthMiscModel(this.game).cfocusBand();
    if (band === null) return nothing;
    return renderContinuousBand(band, (id, selected) =>
      this.send(
        selected ? { kind: "cfocus_clear" } : { kind: "cfocus_set", id },
      ),
    );
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

  /** The folded chips: a "▾" button showing the current chip, and its two-column list. */
  private renderChipMenu(c: FocusCtx): TemplateResult {
    return html`<button
        type="button"
        data-ww-focus-chip-menu
        aria-haspopup="menu"
        aria-expanded=${String(this.chipMenu)}
        class="ml-auto h-9 shrink-0 rounded-full px-2.5 text-xs font-semibold ${this
          .chipMenu
          ? "bg-white/20 text-white"
          : "bg-white/5 text-white/75 hover:bg-white/10"}"
        @click=${() => (this.chipMenu = !this.chipMenu)}
      >
        ${this.chipLabel(c, this.chip ?? "all")} ▾
      </button>
      ${this.chipMenu
        ? html`<div
            role="menu"
            data-ww-focus-chip-list
            class="absolute right-1 top-full z-20 mt-1 grid grid-cols-2 gap-1 rounded-md border border-white/15 bg-gray-900 p-1 shadow-xl"
          >
            ${this.renderChips(c, true)}
          </div>`
        : nothing}`;
  }

  /** A chip's text; the pack chip carries the pack's name (spec §20.10). */
  private chipLabel(c: FocusCtx, chip: FocusChip | "pack"): string {
    return chip === "pack"
      ? translateText("ww1936.cfocus_ui.pack_chip", {
          pack: countryName(this.game.myPlayer()?.countryTag() ?? "USA"),
        })
      : translateText(CHIP_KEYS[chip]);
  }

  private renderChips(c: FocusCtx, inMenu: boolean): TemplateResult {
    const chips: readonly (FocusChip | "pack")[] =
      packFirst(c.tree) >= 0 ? [...FOCUS_CHIPS, "pack"] : FOCUS_CHIPS;
    return html`${chips.map(
      (chip) =>
        html`<button
          type="button"
          role=${inMenu ? "menuitem" : "button"}
          data-ww-focus-chip=${chip}
          aria-pressed=${String(this.chip === chip)}
          class="h-9 min-w-9 shrink-0 rounded-full px-2.5 text-xs font-semibold ${this
            .chip === chip
            ? "bg-white/20 text-white"
            : "bg-white/5 text-white/75 hover:bg-white/10"}"
          @click=${() => this.pickChip(c, chip)}
        >
          ${this.chipLabel(c, chip)}
        </button>`,
    )}`;
  }

  private renderDetail(c: FocusCtx, body: boolean): TemplateResult {
    const def = c.tree[this.selected];
    if (def === undefined) {
      return html`<p
        data-ww-focus-empty
        class="m-0 py-1 text-center text-white/60"
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
        @click=${() => {
          if (!this.land) this.sheetOpen = !this.sheetOpen;
        }}
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
        <div class="flex shrink-0" @click=${(e: Event) => e.stopPropagation()}>
          ${this.renderAction(c, def, st)}
        </div>
        ${this.land
          ? html`<button
              type="button"
              data-ww-focus-detail-close
              class="size-8 shrink-0 rounded-md hover:bg-white/10"
              aria-label=${translateText("common.close")}
              @click=${(e: Event) => {
                e.stopPropagation();
                this.selected = -1;
              }}
            >
              ✕
            </button>`
          : html`<span
              data-ww-focus-detail-toggle
              aria-expanded=${String(body)}
              class="shrink-0 px-1 text-white/60"
              >${body ? "▾" : "▴"}</span
            >`}
      </div>
      ${body
        ? html`<p class="m-0 whitespace-pre-line leading-snug text-white/80">
              ${translateText(`ww1936.focus_desc.${def.id}`)}
            </p>
            ${this.renderPrereqs(c, def)} ${this.renderUnlocks(c)}
            ${this.renderExclusive(c, def)} ${this.renderConditions(def, card)}
            ${this.renderEffects(def)}`
        : nothing}
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
        class="h-8 min-w-[3.5rem] shrink-0 rounded-md px-2 text-xs font-bold ${look}"
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
      class="flex gap-1 leading-tight"
      style="padding-left: ${depth * 10}px"
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
    return html`<section data-ww-focus-section=${id} class="mt-1">
      <h4 class="m-0 text-[11px] font-bold uppercase text-white/60">
        ${translateText(titleKey)}
      </h4>
      <ul class="m-0 list-none p-0">
        ${rows}
      </ul>
    </section>`;
  }

  /** A tappable chip for a focus: pans to its card and picks it. */
  private focusChip(c: FocusCtx, id: string, mark = ""): TemplateResult {
    const i = c.tree.findIndex((f) => f.id === id);
    const st = c.states[i];
    return html`<button
      type="button"
      data-ww-focus-ref=${id}
      class="inline-flex min-h-6 max-w-full items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold ${STATE_COLOR[
        st
      ] ?? ""}"
      @click=${() => this.selectFocus(id)}
    >
      ${mark}<span class="truncate"
        >${translateText(`ww1936.focus.${id}`)}</span
      >
    </button>`;
  }

  private joiner(key: string): TemplateResult {
    return html`<span class="text-[11px] font-bold text-white/60"
      >${translateText(key)}</span
    >`;
  }

  /** "A and B" / "A or B" as chips: groups are ANDed, a group's members ORed. */
  private renderPrereqs(c: FocusCtx, def: FocusDef) {
    const groups = def.prereq ?? [];
    if (groups.length === 0) return nothing;
    const done = (id: string) => {
      const i = c.tree.findIndex((f) => f.id === id);
      return c.states[i] === FOCUS_DONE || c.states[i] === FOCUS_BYPASSED;
    };
    const chip = (id: string) => this.focusChip(c, id, done(id) ? "✓ " : "");
    const parts: TemplateResult[] = [];
    groups.forEach((g, gi) => {
      if (gi > 0) parts.push(this.joiner("ww1936.focusui.and"));
      const inner: TemplateResult[] = [];
      g.forEach((id, k) => {
        if (k > 0) inner.push(this.joiner("ww1936.focusui.or"));
        inner.push(chip(id));
      });
      parts.push(
        g.length > 1 && groups.length > 1
          ? html`<span
              class="inline-flex flex-wrap items-center gap-1 rounded-full border border-dashed border-white/30 p-0.5"
              >${inner}</span
            >`
          : html`${inner}`,
      );
    });
    return html`<section data-ww-focus-section="requires" class="mt-1">
      <h4 class="m-0 text-[11px] font-bold uppercase text-white/60">
        ${translateText("ww1936.focusui.needs")}
      </h4>
      <div class="flex flex-wrap items-center gap-1">${parts}</div>
    </section>`;
  }

  /** What finishing this focus can open up. */
  private renderUnlocks(c: FocusCtx) {
    const L = layoutOf(c.tree);
    const kids = L.children[this.selected] ?? [];
    if (kids.length === 0) return nothing;
    return html`<section data-ww-focus-section="unlocks" class="mt-1">
      <h4 class="m-0 text-[11px] font-bold uppercase text-white/60">
        ${translateText("ww1936.focusui.unlocks")}
      </h4>
      <div class="flex flex-wrap items-center gap-1">
        ${kids.map((k) => this.focusChip(c, c.tree[k].id))}
      </div>
    </section>`;
  }

  /** The choices this one shuts out once taken. */
  private renderExclusive(c: FocusCtx, def: FocusDef) {
    const ids = def.exclusive ?? [];
    if (ids.length === 0) return nothing;
    const rows = ids.map((id) => {
      const i = c.tree.findIndex((f) => f.id === id);
      const s = c.states[i];
      const taken =
        s === FOCUS_DONE || s === FOCUS_RUNNING || s === FOCUS_QUEUED;
      return this.row(
        0,
        this.focusChip(c, id),
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
    const rows = describeEffects(scaleFocusEffects(def.effects))
      .filter((l) => !HIDDEN_FX.has(l.key.slice("ww1936.fx.".length)))
      .flatMap((l) => [l, ...spiritStatLines(l)])
      .map((l) => this.row(l.depth, lineText(l)));
    return this.section("effects", "ww1936.focusui.effects", rows);
  }
}
