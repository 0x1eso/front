import type { WwOrder } from "@openfront/engine-api/Schemas";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  RESEARCH_LEANS,
  TECH_BRANCHES,
  TECH_TABS,
  TechBranch,
  WW_MAX_SLOTS,
  WW_RESEARCH_GRANT,
  WW_TECH_IDS,
  WwCountryDetail,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { html, nothing, svg, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { ringSvg } from "../domestic/Dial";
import { WwDepthOpenEvent } from "./DepthEvents";
import { DepthIndustryModel } from "./DepthIndustryModel";
import { DoctrineModel } from "./DoctrineModel";
import {
  blockText,
  branchName,
  effectLines,
  researchBlock,
  researchCards,
  ResearchCardState,
  researchSlots,
  SlotRow,
  stockOnly,
  techName,
  techUnlock,
} from "./EconomyModel";
import {
  baseSpeedPct,
  bonusFor,
  BonusSource,
  bonusSources,
  COL_W,
  FIRST_YEAR,
  freeSlotNumber,
  jointPct,
  LAST_YEAR,
  LEAN_KEYS,
  NODE_H,
  NODE_W,
  NodeLook,
  PAD,
  recommendNext,
  tabSummary,
  todayX,
  TreeLayout,
  treeLayout,
  TreeNode,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./ResearchTreeModel";
import {
  countryName,
  today,
  TWO_TAP_MS,
  TwoTap,
  wwActive,
} from "./WorldWarModel";
import { autoMaskOf, autoOnIn, renderAutoSwitch } from "./WwAutoUi";
import { OpenWwResearchEvent, WwDrawerBase } from "./WwDrawer";
import { renderProjectsTab } from "./WwProjectsTab";
import { TabUi } from "./WwTabUi";

const STATE_KEYS: Readonly<Record<ResearchCardState, string>> = {
  done: "ww1936.econ.state_done",
  running: "ww1936.econ.state_running",
  available: "ww1936.econ.state_available",
  prereq: "ww1936.econ.state_prereq",
  doctrine: "ww1936.econ.state_doctrine",
};

/** Card looks of the list fallback. */
const CARD_LOOK: Readonly<Record<ResearchCardState, string>> = {
  done: "border-emerald-500/70 bg-emerald-950/70",
  running: "border-cyan-300 bg-cyan-950/70",
  available: "border-yellow-300 bg-gray-800 hover:bg-gray-700",
  prereq: "border-gray-700 bg-gray-900 opacity-60",
  doctrine: "border-gray-700 bg-gray-900 opacity-50",
};

function touchDist(e: TouchEvent): number {
  const [a, b] = [e.touches[0], e.touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** The tab rail's icons. */
const TAB_ICON: Readonly<Record<string, string>> = {
  infantry: "🔫",
  support: "🧰",
  armour: "🛡",
  artillery: "💥",
  naval: "⚓",
  air: "✈",
  electronics: "📡",
  industry: "🏭",
  doctrine: "📜",
  projects: "🧪",
};

/** Node looks (changes §4.4). */
const NODE_LOOK: Readonly<Record<NodeLook, string>> = {
  done: "border-emerald-500/70 bg-emerald-900/70",
  running: "border-sky-300 bg-sky-900/70",
  saved: "border-yellow-300 bg-gray-800",
  available: "border-yellow-300 bg-gray-800",
  prereq: "border-gray-600 bg-gray-900 opacity-70",
  exclusive: "border-gray-600 bg-gray-900 opacity-70",
  project: "border-purple-400 bg-purple-950/70",
  doctrine: "border-gray-700 bg-gray-900 opacity-50",
};

/** The year axis' header row. */
const HEAD = 22;
/** Below this height the tree gives way to the card list. */
const LIST_MAX_HEIGHT = 300;
const SHEET_PHONE = 280;
const SHEET_TABLET = 320;
type Tab = (typeof TECH_TABS)[number];

/**
 * World War 1936 research screen (changes §4): the slots on top, the tab
 * rail on the left, the year axis 1936 to 1945 with the prerequisite lines,
 * a side sheet (280 px on a phone, 320 px on a tablet). Two taps start a
 * tech: the node, then "▶ Start". Double-tapping a slot chip clears it.
 */
@customElement("ww-research-panel")
export class WwResearchPanel extends WwDrawerBase {
  protected readonly drawerId = "research" as const;
  @state() private branch: Tab = "infantry";
  /** The node chosen by the first tap. */
  @state() private selected: WwTechId | null = null;
  @state() private zoom = 1;
  /** The slot row blinks (a start found no free slot). */
  @state() private flash = false;
  /** The "next" card's pick after a research finished. */
  @state() private nextPick: WwTechId | null = null;
  private doneCount = -1;
  private centred = false;
  private pinch: { dist: number; zoom: number } | null = null;
  private readonly twoTap = new TwoTap();
  private readonly tabPick: Record<string, number> = {};
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwResearchEvent, () => this.setOpen(!this.open));
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "projects") return;
      this.branch = "projects";
      this.setOpen(true);
    });
  }

  protected setOpen(open: boolean) {
    this.centred = false;
    super.setOpen(open);
  }

  private detail(): WwCountryDetail | null {
    const me = this.game?.myPlayer() ?? null;
    if (me === null || this.game.worldWarScenario() === null) return null;
    return this.game.wwEconomy?.()?.detail(me.smallID()) ?? null;
  }

  /** The research bonuses my country holds (politics). */
  private bonuses(): BonusSource[] {
    const me = this.game?.myPlayer();
    const pol = this.game?.wwPolitics?.() ?? null;
    if (!me || pol === null) return [];
    return bonusSources(pol.detail(me.smallID())?.researchBonuses);
  }

  private ppNow(): number {
    const me = this.game?.myPlayer();
    const s = me
      ? (this.game.wwPolitics?.() ?? null)?.summary(me.smallID())
      : null;
    return s ? Math.trunc(s.ppMilli / 1000) : 0;
  }

  tick() {
    this.refitIfOpen();
    const d = this.detail();
    // The "next" card: a research finished (auto research picks by itself).
    if (d !== null) {
      const n = d.researched.length;
      if (this.doneCount >= 0 && n > this.doneCount) this.suggest(d);
      this.doneCount = n;
    }
    const key = [
      d,
      this.open && this.game.worldWarScenario() ? today(this.game) : 0,
      // Automation: the head's switch.
      autoMaskOf(this.game, this.game.myPlayer()?.smallID() ?? 0),
      this.bonuses().length,
      this.ppNow(),
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private suggest(d: WwCountryDetail) {
    const me = this.game.myPlayer()!;
    const tag = this.game.worldWarScenario()!.tagOfSmallId(me.smallID());
    if (tag === undefined || freeSlotNumber(d) === 0) return;
    this.nextPick = recommendNext(d, {
      tag,
      day: today(this.game),
      smallID: me.smallID(),
    });
  }

  private tabUi(): TabUi {
    const sc = this.game.worldWarScenario()!;
    return {
      send: (o) => this.eventBus.emit(new SendWwOrderIntentEvent(o)),
      confirm: (k, act) => {
        if (this.twoTap.tap(k, Date.now())) act();
        this.requestUpdate();
        setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
      },
      armed: (k) => this.twoTap.isArmed(k, Date.now()),
      redraw: () => this.requestUpdate(),
      me: this.game.myPlayer()?.smallID() ?? 0,
      regionName: (r) => sc.region(r)?.name ?? String(r),
      name: (id) => {
        const tag = sc.tagOfSmallId(id);
        return tag === undefined ? "?" : countryName(tag);
      },
      pick: this.tabPick,
    };
  }

  private send(tech: WwTechId) {
    this.eventBus.emit(new SendWwOrderIntentEvent({ kind: "research", tech }));
  }

  private sendOrder(o: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(o));
  }

  /** The second tap: start the chosen tech, or blink the slots when none is free. */
  private startSelected(d: WwCountryDetail) {
    const tech = this.selected;
    if (tech === null) return;
    const block = researchBlock(d, tech);
    if (block === "no_slot") {
      this.flash = true;
      setTimeout(() => (this.flash = false), 1500);
      return;
    }
    if (block !== null) return;
    this.send(tech);
    this.selected = null;
  }

  private tapNode(tech: WwTechId) {
    this.selected = this.selected === tech ? null : tech;
  }

  private goTo(tech: WwTechId) {
    this.branch = WW_TECHS[tech].tab as Tab;
    this.selected = tech;
    this.centred = false;
  }

  private tapSlot(slot: SlotRow) {
    const key = `cancel_research:${slot.index}:${slot.tech}`;
    if (this.twoTap.tap(key, Date.now())) {
      this.sendOrder({ kind: "cancel_research", slot: slot.index });
    }
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private setZoom(z: number) {
    this.zoom = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.round(z * 100) / 100),
    );
  }

  private scroller(): HTMLElement | null {
    return this.querySelector<HTMLElement>("[data-ww-tree-scroll]");
  }

  private fitZoom() {
    const w = this.scroller()?.clientWidth ?? 0;
    const fit = w > 0 ? w / (PAD * 2 + 10 * COL_W) : ZOOM_MIN;
    this.setZoom(this.zoom === 1 ? fit : 1);
  }

  private toToday(layout: TreeLayout) {
    const el = this.scroller();
    if (el !== null)
      el.scrollLeft = Math.max(0, layout.todayX * this.zoom - 60);
  }

  updated() {
    if (!this.open || this.centred) return;
    const el = this.scroller();
    if (el === null) return;
    this.centred = true;
    const day = today(this.game);
    el.scrollLeft = Math.max(0, todayX(day) * this.zoom - 60);
  }

  private touchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return;
    this.pinch = { dist: touchDist(e), zoom: this.zoom };
  };
  private touchMove = (e: TouchEvent) => {
    if (this.pinch === null || e.touches.length !== 2) return;
    this.setZoom(
      (this.pinch.zoom * touchDist(e)) / Math.max(1, this.pinch.dist),
    );
  };
  private touchEnd = () => {
    this.pinch = null;
  };

  render() {
    const d = this.detail();
    if (!this.open) return d === null ? null : this.renderNext(d);
    if (d === null) return null;
    const me = this.game.myPlayer()!;
    // P5 pre-flight §0-1: an exile still researches.
    if (!wwActive(this.game, me.smallID())) {
      // Gone or capitulated: the engine refuses every order.
      return this.renderFrame(
        translateText("ww1936.econ.research"),
        html`<span aria-hidden="true">🔬</span>
          <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
            ${translateText("ww1936.econ.research")}
          </h3>`,
        nothing,
        html`<p data-ww-block="dead" class="m-0 mt-2 text-xs text-red-300">
          🔒 ${blockText("dead")}
        </p>`,
      );
    }
    const day = today(this.game);
    const rows = researchSlots(d, day);
    const mask = autoMaskOf(this.game, me.smallID());
    // Live report 2026-10-30: an empty slot waits for the player's pick
    // (the AI fills it only while auto research is on) — say so.
    const free = rows.filter((s) => s.tech === null && !s.paused).length;
    const prompt =
      free > 0 && !autoOnIn(mask, "research")
        ? html`<p
            data-ww-pick-prompt
            class="m-0 rounded-md border border-yellow-300/60 bg-yellow-900/40 px-2 py-1 text-xs font-semibold text-yellow-100"
          >
            👉 ${translateText("ww1936.econ.pick_prompt", { n: free })}
          </p>`
        : nothing;
    const list = window.innerHeight < LIST_MAX_HEIGHT;
    return this.renderFrame(
      translateText("ww1936.econ.research"),
      html`<span aria-hidden="true">🔬</span>
        <h3 class="m-0 min-w-0 truncate text-sm font-bold">
          ${translateText("ww1936.econ.research")}
        </h3>
        ${renderAutoSwitch("research", mask, (o) => this.sendOrder(o), true)}`,
      nothing,
      html`<div data-ww-research class="flex h-full min-h-0 flex-col gap-1">
        <div class="shrink-0">
          ${this.renderSlots(rows, d)}${prompt}${this.renderLean(d)}
        </div>
        ${list
          ? this.renderList(d, day)
          : html`<div class="flex min-h-0 flex-1">
              ${this.renderRail()}${this.renderMain(d, day)}
            </div>`}
        ${this.renderNext(d)}
      </div>`,
    );
  }

  /** Auto-research leaning (changes §6 idea 1): five presets next to the auto switch. */
  private renderLean(d: WwCountryDetail): TemplateResult {
    const now = d.researchLean ?? 0;
    return html`<div
      data-ww-lean-row
      class="flex items-center gap-1 overflow-x-auto pb-1 text-xs"
    >
      <span class="shrink-0 text-white/60"
        >${translateText("ww1936.rtree.lean_label")}</span
      >
      ${RESEARCH_LEANS.map(
        (lean, i) =>
          html`<button
            type="button"
            data-ww-lean=${lean}
            aria-pressed=${String(i === now)}
            class="h-8 shrink-0 rounded-md border px-2 ${i === now
              ? "border-sky-300 bg-sky-800/70 font-bold"
              : "border-white/20 bg-black/30"}"
            @click=${() => this.sendOrder({ kind: "research_lean", lean })}
          >
            ${translateText(LEAN_KEYS[lean])}
          </button>`,
      )}
    </div>`;
  }

  private renderRail(): TemplateResult {
    return html`<nav
      data-ww-rail
      class="flex w-11 shrink-0 flex-col gap-0.5 overflow-y-auto"
    >
      ${TECH_TABS.map(
        (t) =>
          html`<button
            type="button"
            data-ww-tab=${t}
            aria-pressed=${String(t === this.branch)}
            aria-label=${this.tabName(t)}
            class="flex min-h-10 flex-col items-center justify-center rounded-md border px-0.5 leading-tight ${t ===
            this.branch
              ? "border-sky-300 bg-sky-900/60"
              : "border-transparent hover:bg-white/10"}"
            @click=${() => {
              this.branch = t;
              this.selected = null;
              this.centred = false;
            }}
          >
            <span aria-hidden="true">${TAB_ICON[t]}</span>
            <span class="w-full truncate text-center text-[9px]"
              >${this.tabName(t)}</span
            >
          </button>`,
      )}
    </nav>`;
  }

  private tabName(t: Tab): string {
    return t === "projects"
      ? translateText("ww1936.project_ui.tab")
      : branchName(t);
  }

  private renderMain(d: WwCountryDetail, day: number): TemplateResult {
    const tab = this.branch;
    if (tab === "projects" || tab === "doctrine") {
      return html`<div class="min-w-0 flex-1 overflow-y-auto px-1">
        ${tab === "projects"
          ? this.renderProjects()
          : this.renderDoctrine(d, day)}
      </div>`;
    }
    const bonuses = this.bonuses();
    const layout = treeLayout(d, tab, day, bonuses);
    const sel = layout.nodes.find((n) => n.card.id === this.selected) ?? null;
    const tablet = !this.compact;
    return html`<div class="flex min-w-0 flex-1 flex-col">
        <div class="flex shrink-0 items-center gap-1 pb-1 text-xs">
          <button
            type="button"
            data-ww-today
            class="h-8 rounded-md border border-white/20 px-2"
            @click=${() => this.toToday(layout)}
          >
            ${translateText("ww1936.rtree.today")}
          </button>
          <button
            type="button"
            data-ww-zoom="out"
            aria-label=${translateText("ww1936.rtree.zoom_out")}
            class="size-8 rounded-md border border-white/20"
            @click=${() => this.setZoom(this.zoom - 0.2)}
          >
            −
          </button>
          <button
            type="button"
            data-ww-zoom="in"
            aria-label=${translateText("ww1936.rtree.zoom_in")}
            class="size-8 rounded-md border border-white/20"
            @click=${() => this.setZoom(this.zoom + 0.2)}
          >
            +
          </button>
          <button
            type="button"
            data-ww-zoom="fit"
            class="h-8 rounded-md border border-white/20 px-2"
            @click=${() => this.fitZoom()}
          >
            ${translateText("ww1936.rtree.zoom_fit")}
          </button>
        </div>
        ${this.renderCanvas(d, layout, day)}
      </div>
      ${tablet || sel !== null
        ? this.renderSheet(d, layout, sel, tablet)
        : nothing}`;
  }

  private renderCanvas(
    d: WwCountryDetail,
    layout: TreeLayout,
    day: number,
  ): TemplateResult {
    const z = this.zoom;
    const w = layout.width;
    const h = layout.height + HEAD;
    const at = new Map(layout.nodes.map((n) => [n.card.id, n]));
    const freeSlot = freeSlotNumber(d);
    return html`<div
      data-ww-tree-scroll
      data-zoom=${String(z)}
      class="relative min-h-0 flex-1 overflow-auto rounded-md bg-black/30"
      style="touch-action: pan-x pan-y"
      @touchstart=${this.touchStart}
      @touchmove=${this.touchMove}
      @touchend=${this.touchEnd}
      @dblclick=${(e: Event) => {
        if (e.target === e.currentTarget) this.fitZoom();
      }}
    >
      <div style="width:${w * z}px;height:${h * z}px" class="relative">
        <div
          data-ww-tree
          class="absolute top-0 left-0"
          style="width:${w}px;height:${h}px;transform:scale(${z});transform-origin:0 0"
        >
          ${Array.from(
            { length: LAST_YEAR - FIRST_YEAR + 1 },
            (_, k) =>
              html`<div
                data-ww-year=${FIRST_YEAR + k}
                class="absolute top-0 border-l border-white/10 pl-1 text-[11px] text-white/50"
                style="left:${PAD + k * COL_W}px;height:${h}px"
              >
                ${FIRST_YEAR + k}
              </div>`,
          )}
          <div
            data-ww-ahead-zone
            class="absolute top-0 bg-amber-300/5"
            style="left:${layout.todayX}px;width:${Math.max(
              0,
              w - layout.todayX,
            )}px;height:${h}px"
          ></div>
          <div
            data-ww-today-line
            class="absolute top-0 border-l border-dashed border-amber-300/70"
            style="left:${layout.todayX}px;height:${h}px"
          ></div>
          <svg
            width=${w}
            height=${h}
            class="pointer-events-none absolute top-0 left-0"
          >
            ${layout.edges.map((e) =>
              this.renderEdge(at.get(e.from), at.get(e.to)),
            )}
          </svg>
          ${layout.nodes.map((n) => this.renderNode(n, freeSlot))}
        </div>
      </div>
    </div>`;
  }

  private renderEdge(a: TreeNode | undefined, b: TreeNode | undefined) {
    if (a === undefined || b === undefined) return nothing;
    const same = a.col === b.col;
    const x1 = same ? a.x + NODE_W / 2 : a.x + NODE_W;
    const y1 = same
      ? a.y + HEAD + (b.y > a.y ? NODE_H : 0)
      : a.y + HEAD + NODE_H / 2;
    const x2 = same ? b.x + NODE_W / 2 : b.x;
    const y2 = same
      ? b.y + HEAD + (b.y > a.y ? 0 : NODE_H)
      : b.y + HEAD + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    const dPath = same
      ? `M${x1} ${y1} L${x2} ${y2}`
      : `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
    const done = a.look === "done";
    return svg`<path
      data-ww-edge=${`${a.card.id}>${b.card.id}`}
      d=${dPath}
      fill="none"
      stroke=${done ? "#34d399" : "#9ca3af"}
      stroke-width="1.5"
      stroke-opacity=${done ? "0.8" : "0.5"}
    />`;
  }

  private renderNode(n: TreeNode, freeSlot: number): TemplateResult {
    const c = n.card;
    const sel = this.selected === c.id;
    const bd = n.badges;
    const locked = n.look === "prereq" || n.look === "exclusive";
    const startable = sel && (c.block === null || c.block === "no_slot");
    return html`<div
      class="absolute"
      style="left:${n.x}px;top:${n.y +
      HEAD}px;width:${NODE_W}px;height:${NODE_H}px;${c.year === LAST_YEAR
        ? "opacity:.7"
        : ""}"
    >
      <button
        type="button"
        data-ww-tech=${c.id}
        data-look=${n.look}
        data-selected=${String(sel)}
        aria-label=${techName(c.id)}
        class="relative size-full overflow-hidden rounded-md border p-1 text-left leading-tight ${NODE_LOOK[
          n.look
        ]} ${sel ? "ring-2 ring-white" : ""}"
        style=${n.look === "exclusive"
          ? "background-image:linear-gradient(to top right,transparent 47%,rgba(248,113,113,.8) 50%,transparent 53%)"
          : ""}
        @click=${() => this.tapNode(c.id)}
      >
        <span class="block truncate text-[11px] font-bold"
          >${bd.exclusive ? "⇄ " : ""}${locked ? "🔒 " : ""}${bd.project
            ? "🧪 "
            : ""}${techName(c.id)}</span
        >
        <span class="flex flex-wrap gap-x-1 text-[9px] tabular-nums">
          <span class="text-white/60">${c.year}</span>
          ${n.look === "done"
            ? html`<span class="text-emerald-300">✓</span>`
            : nothing}
          ${bd.ahead > 0
            ? html`<span data-ww-badge="ahead" class="text-amber-300"
                >+${bd.ahead}%</span
              >`
            : nothing}
          ${bd.bonus > 0
            ? html`<span data-ww-badge="bonus" class="text-yellow-200"
                >⚡+${bd.bonus}%</span
              >`
            : nothing}
          ${bd.joint > 0
            ? html`<span data-ww-badge="joint" class="text-sky-200"
                >🤝+${bd.joint}%</span
              >`
            : nothing}
          ${bd.saved > 0 && n.look !== "done"
            ? html`<span data-ww-badge="saved" class="text-cyan-200"
                >⏸ ${bd.saved}%</span
              >`
            : nothing}
        </span>
        ${n.crossTab === null
          ? nothing
          : html`<span
              data-ww-cross
              class="block truncate text-[9px] text-white/50"
              >↖ ${techName(n.crossTab)}</span
            >`}
      </button>
      ${startable
        ? html`<button
            type="button"
            data-ww-start-pill
            data-free=${String(c.block === null)}
            class="absolute left-0 z-10 h-7 whitespace-nowrap rounded-full border px-3 text-xs font-bold shadow ${c.block ===
            null
              ? "border-emerald-300 bg-emerald-600"
              : "border-white/30 bg-gray-700 opacity-60"}"
            style="top:${NODE_H - 4}px"
            @click=${() => this.startSelected(this.detail()!)}
          >
            ${c.block === null
              ? translateText("ww1936.rtree.start_slot", { n: freeSlot })
              : translateText("ww1936.rtree.no_slot")}
          </button>`
        : nothing}
    </div>`;
  }

  private renderSheet(
    d: WwCountryDetail,
    layout: TreeLayout,
    sel: TreeNode | null,
    tablet: boolean,
  ): TemplateResult {
    const width = tablet ? SHEET_TABLET : SHEET_PHONE;
    return html`<aside
      data-ww-sheet
      data-width=${width}
      class="ml-1 flex shrink-0 flex-col gap-1 overflow-y-auto rounded-md border border-white/10 bg-black/30 p-2 text-xs"
      style="width:${width}px"
    >
      ${sel === null
        ? this.renderSummary(d, layout)
        : this.renderDetail(d, sel)}
    </aside>`;
  }

  private renderSummary(
    d: WwCountryDetail,
    layout: TreeLayout,
  ): TemplateResult {
    const bonuses = this.bonuses();
    const s = tabSummary(layout, bonuses, this.branch);
    return html`<div data-ww-summary class="flex flex-col gap-1">
      <div class="text-sm font-bold">${this.tabName(this.branch)}</div>
      <div>
        ${translateText("ww1936.rtree.summary", {
          done: s.done,
          total: s.total,
          running: s.running,
          bonuses: s.bonuses,
        })}
      </div>
      <div class="text-white/60">${translateText("ww1936.rtree.tap_hint")}</div>
      ${this.renderGrant(d, this.branch as TechBranch)}
    </div>`;
  }

  /** Research grants (changes §6 idea 3): PP for a temporary bonus on a branch. */
  private renderGrant(d: WwCountryDetail, branch: TechBranch): TemplateResult {
    void d;
    const held = this.bonuses().some((b) => b.key === branch);
    const pp = this.ppNow();
    const why = held
      ? "bonus_held"
      : pp < WW_RESEARCH_GRANT.pp
        ? "no_pp"
        : null;
    return html`<div data-ww-grant class="mt-1 border-t border-white/10 pt-1">
      <button
        type="button"
        data-ww-grant-btn=${branch}
        ?disabled=${why !== null}
        class="min-h-9 w-full rounded-md border border-yellow-300/60 bg-yellow-900/40 px-2 py-1 text-left disabled:opacity-50"
        @click=${() => this.sendOrder({ kind: "research_grant", branch })}
      >
        ⚡
        ${translateText("ww1936.rtree.grant_btn", {
          pp: WW_RESEARCH_GRANT.pp,
          pct: WW_RESEARCH_GRANT.pct,
          branch: branchName(branch),
        })}
      </button>
      ${why === null
        ? nothing
        : html`<div data-ww-grant-why class="text-red-300">
            🔒 ${blockText(why)}
          </div>`}
    </div>`;
  }

  private renderDetail(d: WwCountryDetail, n: TreeNode): TemplateResult {
    const c = n.card;
    const def = WW_TECHS[c.id];
    const bonuses = this.bonuses();
    const held = bonusFor(bonuses, c.id);
    const joint = jointPct(d, c.id);
    const base = baseSpeedPct(d, c.id);
    const unlock = techUnlock(c.id);
    const block = c.block;
    const status = block === null || block === "no_slot" ? null : block;
    return html`<div data-ww-detail=${c.id} class="flex flex-col gap-1">
      <div class="text-sm font-bold">${techName(c.id)}</div>
      <div class="text-white/70">
        ${c.year} · ${translateText("ww1936.rtree.base_days", { n: c.days })}
      </div>
      ${c.state === "done"
        ? html`<div class="text-emerald-300">
            ${translateText(STATE_KEYS.done)}
          </div>`
        : html`<div data-ww-eta>
            ${translateText("ww1936.rtree.speed_days", {
              n: c.etaDays,
            })}${c.ahead > 0
              ? html` ·
                  <span class="text-amber-300"
                    >${translateText("ww1936.econ.ahead", { n: c.ahead })}</span
                  >`
              : nothing}
          </div>`}
      <div data-ww-sources class="flex flex-col gap-0.5">
        ${base !== 0
          ? html`<div data-ww-src="base">
              ${translateText("ww1936.rtree.src_base", { pct: base })}
            </div>`
          : nothing}
        ${held === null
          ? nothing
          : html`<div data-ww-src="bonus" class="text-yellow-200">
              ⚡
              ${translateText("ww1936.rtree.src_bonus", {
                pct: held.pct,
                source: this.bonusSource(held.key),
                uses: held.uses,
              })}
            </div>`}
        ${joint > 0
          ? html`<div data-ww-src="joint" class="text-sky-200">
              🤝 ${translateText("ww1936.rtree.src_joint", { pct: joint })}
            </div>`
          : nothing}
      </div>
      ${c.saved > 0 && c.state !== "done"
        ? html`<div data-ww-saved class="text-cyan-200">
            ${translateText("ww1936.econ.saved_progress", {
              n: Math.floor(c.saved * 100),
            })}
          </div>`
        : nothing}
      <div data-ww-effects class="text-white/80">
        ${effectLines(c.id).join(" · ")}
      </div>
      ${unlock !== null && stockOnly(unlock.equipment)
        ? html`<div class="text-sky-300">
            ${translateText("ww1936.econ.stock_only")}
          </div>`
        : nothing}
      ${def.design === undefined
        ? nothing
        : html`<div>
            ${translateText("ww1936.rtree.design", {
              designer: translateText(
                `ww1936.rtree.designer_${def.design.designer}`,
              ),
              part: translateText(`ww1936.rtree.part_${def.design.part}`),
            })}
          </div>`}
      ${def.prereqs.length === 0
        ? nothing
        : html`<div data-ww-prereqs>
            <div class="font-semibold">
              ${translateText("ww1936.rtree.prereqs")}
            </div>
            ${def.prereqs.map((p) => {
              const ok = d.researched.includes(p);
              return html`<button
                type="button"
                data-ww-prereq=${p}
                class="block w-full min-h-8 text-left ${ok
                  ? "text-emerald-300"
                  : "text-red-300"}"
                @click=${() => this.goTo(p)}
              >
                ${ok ? "✓" : "✗"} ${techName(p)}
              </button>`;
            })}
          </div>`}
      ${def.exclusive === undefined
        ? nothing
        : html`<div data-ww-excl class="text-amber-200">
            ⇄ ${translateText("ww1936.rtree.exclusive_note")}
          </div>`}
      ${def.project === undefined
        ? nothing
        : html`<div data-ww-project class="text-purple-300">
            🧪 ${translateText("ww1936.rtree.project_note")}
          </div>`}
      ${status === null
        ? nothing
        : html`<div data-ww-block=${status} class="text-red-300">
            🔒 ${blockText(status)}
          </div>`}
      <button
        type="button"
        data-ww-sheet-start
        ?disabled=${block !== null}
        class="min-h-10 rounded-md border border-emerald-300 bg-emerald-700 px-2 font-bold disabled:opacity-40"
        @click=${() => this.startSelected(d)}
      >
        ${block === "no_slot"
          ? translateText("ww1936.rtree.no_slot")
          : translateText("ww1936.rtree.start")}
      </button>
      ${block === "no_slot"
        ? html`<div class="text-white/60">
            ${translateText("ww1936.rtree.no_slot_hint")}
          </div>`
        : nothing}
      ${def.branch === "doctrine" ? nothing : this.renderGrant(d, def.branch)}
    </div>`;
  }

  private bonusSource(key: string): string {
    return (TECH_BRANCHES as readonly string[]).includes(key)
      ? branchName(key as TechBranch)
      : techName(key as WwTechId);
  }

  private renderProjects(): TemplateResult {
    const groups = SPECIAL_PROJECTS.map((p) => ({
      p,
      techs: WW_TECH_IDS.filter((t) => WW_TECHS[t].project === p),
    })).filter((g) => g.techs.length > 0);
    return html`${renderProjectsTab(
        new DepthIndustryModel(this.game),
        this.tabUi(),
      )}
      <div data-ww-opens class="mt-2 text-xs text-white/70">
        ${groups.map(
          (g) =>
            html`<div>
              🧪
              ${translateText("ww1936.rtree.opens_after", {
                techs: g.techs.map((t) => techName(t)).join(", "),
              })}
            </div>`,
        )}
      </div>`;
  }

  /** The doctrine tab: the mastery summary and a button to the doctrine screen. */
  private renderDoctrine(d: WwCountryDetail, day: number): TemplateResult {
    void d;
    void day;
    const model = new DoctrineModel(this.game);
    const domains = model.ready() ? model.domains() : [];
    return html`<div data-ww-doctrine class="mt-1 flex flex-col gap-2">
      ${domains.map((v) => {
        const gd = v.chips.find((c) => c.picked);
        return html`<div
          data-ww-mastery=${v.id}
          class="rounded-md border border-white/15 bg-black/30 p-2 text-xs"
        >
          <div class="font-bold">
            ${translateText(`ww1936.doctrine.tab_${v.id}`)} ·
            ${gd === undefined
              ? translateText("ww1936.rtree.doctrine_none")
              : translateText(`ww1936.gd.${gd.id}`)}
          </div>
          <div class="text-white/70">
            ${translateText("ww1936.rtree.doctrine_level", { n: v.levelSum })}
          </div>
        </div>`;
      })}
      <button
        type="button"
        data-ww-open-doctrine
        class="min-h-10 rounded-md border border-sky-300 bg-sky-800/60 px-3 font-bold"
        @click=${() => this.eventBus.emit(new WwDepthOpenEvent("doctrine"))}
      >
        ${translateText("ww1936.rtree.doctrine_open")}
      </button>
    </div>`;
  }

  /** "Next" (changes §6 idea 2): a small card with the best next pick and a one-tap start. */
  private renderNext(d: WwCountryDetail): TemplateResult | typeof nothing {
    const t = this.nextPick;
    if (t === null) return nothing;
    // Stale: it started, was researched, or no slot is free.
    if (researchBlock(d, t) !== null) {
      this.nextPick = null;
      return nothing;
    }
    return html`<div
      data-ww-next
      class="${this.open
        ? ""
        : "fixed bottom-24 left-1/2 -translate-x-1/2 "}z-[1003] flex items-center gap-2 rounded-lg border border-emerald-300/70 bg-gray-900/95 p-2 text-xs text-white shadow-lg"
    >
      <span>${translateText("ww1936.rtree.next_title")}</span>
      <button
        type="button"
        data-ww-next-start
        class="min-h-9 rounded-md bg-emerald-700 px-3 font-bold"
        @click=${() => {
          this.send(t);
          this.nextPick = null;
        }}
      >
        ▶ ${techName(t)}
      </button>
      <button
        type="button"
        data-ww-next-close
        aria-label=${translateText("common.close")}
        class="size-8 rounded-md hover:bg-white/10"
        @click=${() => (this.nextPick = null)}
      >
        ✕
      </button>
    </div>`;
  }

  /** The card list: the fallback on a very short screen. */
  private renderList(d: WwCountryDetail, day: number): TemplateResult {
    const tab = this.branch;
    return html`<div class="flex min-h-0 flex-1 gap-1">
      ${this.renderRail()}
      <div class="min-w-0 flex-1 overflow-y-auto">
        ${tab === "projects"
          ? this.renderProjects()
          : tab === "doctrine"
            ? this.renderDoctrine(d, day)
            : html`<ul
                data-ww-cards
                class="m-0 flex list-none flex-col gap-1.5 p-0"
              >
                ${researchCards(d, tab, day).map(
                  (c) =>
                    html`<li>
                      <button
                        type="button"
                        data-ww-card=${c.id}
                        ?disabled=${c.state !== "available"}
                        class="min-h-11 w-full rounded-md border p-2 text-left ${CARD_LOOK[
                          c.state
                        ]}"
                        @click=${() => {
                          this.selected = c.id;
                          if (researchBlock(d, c.id) === null) this.send(c.id);
                        }}
                      >
                        <span class="font-bold">${techName(c.id)}</span>
                        <span class="text-white/60"> ${c.year}</span>
                      </button>
                    </li>`,
                )}
              </ul>`}
      </div>
    </div>`;
  }

  /**
   * Research overhaul R1 (changes §1.7): the slot chip, now / the most this
   * country can reach; a yellow dot when a focus or the decision that gives
   * a slot can be taken now (auto-research never takes them).
   */
  private renderSlotChip(d: WwCountryDetail): TemplateResult {
    const ready = d.slotHint?.ready === true;
    const max = d.slotSources?.max ?? WW_MAX_SLOTS;
    const label = translateText("ww1936.econ.slot_chip", {
      n: d.slotCount,
      max,
    });
    const tip = ready
      ? `${label} · ${translateText("ww1936.econ.slot_ready")}`
      : label;
    return html`<div
      data-ww-slot-chip
      data-ready=${String(ready)}
      title=${tip}
      aria-label=${tip}
      class="relative flex h-10 shrink-0 items-center rounded-md border border-white/20 bg-black/30 px-2 text-xs font-semibold tabular-nums"
    >
      🔬 ${d.slotCount}/${max}
      ${ready
        ? html`<span
            data-ww-slot-dot
            class="absolute top-0.5 right-0.5 size-2 rounded-full bg-yellow-300"
          ></span>`
        : nothing}
    </div>`;
  }

  private renderSlots(slots: SlotRow[], d: WwCountryDetail): TemplateResult {
    return html`<div
      data-ww-slots
      data-flash=${String(this.flash)}
      class="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 ${this.flash
        ? "animate-pulse rounded-md ring-1 ring-yellow-300"
        : ""}"
    >
      ${this.renderSlotChip(d)}
      ${slots.map((s) => {
        if (s.tech === null) {
          return html`<div
            data-ww-slot=${s.index}
            data-empty
            class="flex h-10 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-white/25 px-1 text-xs text-white/50"
          >
            <span class="truncate"
              >${translateText("ww1936.econ.slot_empty")}</span
            >
          </div>`;
        }
        const key = `cancel_research:${s.index}:${s.tech}`;
        const armed = this.twoTap.isArmed(key, Date.now());
        return html`<button
          type="button"
          data-ww-slot=${s.index}
          data-armed=${String(armed)}
          aria-label=${`${techName(s.tech)} · ${translateText(
            armed ? "ww1936.econ.cancel_tap" : "ww1936.econ.cancel_research",
          )}`}
          class="flex h-10 w-36 shrink-0 items-center gap-1 rounded-md border px-1 text-left ${armed
            ? "border-red-400 bg-red-900/60"
            : "border-sky-400/40 bg-sky-950/40"} ${s.paused
            ? "opacity-50"
            : ""}"
          @click=${() => this.tapSlot(s)}
        >
          <span class="relative size-8 shrink-0">
            ${ringSvg(s.progress, s.paused ? "grey" : "science")}
            <span
              class="relative flex size-full items-center justify-center text-[10px] font-bold tabular-nums"
              >${Math.floor(s.progress * 100)}%</span
            >
          </span>
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate text-xs font-semibold"
              >${armed
                ? translateText("ww1936.econ.cancel_tap")
                : techName(s.tech)}</span
            >
            <span class="block truncate text-[10px] text-white/70"
              >${translateText("ww1936.econ.days_left", {
                n: s.daysLeft,
              })}${s.ahead > 0
                ? html` ·
                    <span data-ww-ahead class="text-amber-300"
                      >${translateText("ww1936.econ.ahead", {
                        n: s.ahead,
                      })}</span
                    >`
                : nothing}</span
            >
          </span>
        </button>`;
      })}
    </div>`;
  }
}
