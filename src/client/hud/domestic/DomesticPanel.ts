import {
  DomesticData,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  ResearchBlock,
  researchBlock,
  researchTicks,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";
import { Branch, Era, TECHS } from "@openfront/engine-lib/domestic/Techs";
import { renderNumber } from "@openfront/engine-lib/Format";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, PropertyValues, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import {
  ChooseGovernmentIntentEvent,
  ProclaimLawIntentEvent,
  ResearchTechIntentEvent,
  StartVictoryProjectIntentEvent,
} from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import type { DomesticClientView } from "../../view/DomesticClientView";
import { PlayerView } from "../../view/PlayerView";
import { ToggleDomesticPanelEvent } from "./DomesticEvents";
import { renderGovernmentTab } from "./GovernmentTab";
import { renderLawsTab } from "./LawsTab";
import { renderVictoryTab } from "./VictoryTab";

const ERAS: readonly Era[] = [1, 2, 3, 4];
const BRANCHES: readonly Branch[] = ["economy", "military", "learning"];

export type DomesticTab = "tech" | "laws" | "government" | "victory";
export const TABS: readonly DomesticTab[] = [
  "tech",
  "laws",
  "government",
  "victory",
];

/** Space between the drawer and the HUD around it, in CSS px. */
const DRAWER_GAP = 8;

/**
 * The HUD the open drawer leaves visible and tappable (spec §14a): it sits
 * below the top-right sidebar stack, above the bottom HUD's fixed rows
 * (attack ratio, build bar, the domestic row and its toggle) and left of the
 * map buttons. Not above the whole bottom HUD: its events and chat column
 * grows and shrinks all game, and would make the drawer jump. That column
 * and the attacks above the rows stack over the drawer instead (MAY_COVER).
 */
const KEEP_CLEAR = {
  top: "[data-hud-top-right]",
  bottom: "[data-bottom-hud-rows]",
  right: "map-controls > div",
} as const;

/**
 * The HUD drawn over the drawer's lower band: the attacks above the bottom
 * rows and the events and chat column. The drawer's list gets that much
 * room at its end, so every card can scroll up clear of it.
 */
const MAY_COVER = ["attacks-display", "[data-bottom-hud-side]"] as const;

/** The scroll area's own bottom padding (pb-3), in CSS px. */
const LIST_PADDING = 12;

export interface DrawerInsets {
  top: number;
  right: number;
  bottom: number;
}

function shownRect(selector: string): DOMRect | null {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return r !== undefined && r.width > 0 && r.height > 0 ? r : null;
}

/** The drawer's offsets from the viewport edges, from where the HUD is now. */
export function drawerInsets(): DrawerInsets {
  const top = shownRect(KEEP_CLEAR.top);
  const bottom = shownRect(KEEP_CLEAR.bottom);
  const right = shownRect(KEEP_CLEAR.right);
  return {
    top: (top?.bottom ?? 0) + DRAWER_GAP,
    bottom: (bottom ? window.innerHeight - bottom.top : 0) + DRAWER_GAP,
    right: (right ? window.innerWidth - right.left : 0) + DRAWER_GAP,
  };
}

/**
 * How far up, in CSS px, the HUD in MAY_COVER reaches into the drawer from
 * its bottom edge. `drawer` is the drawer's box; before it is laid out
 * (null) all of that HUD counts.
 */
export function drawerCoveredBottom(
  insets: DrawerInsets,
  drawer: DOMRect | null,
): number {
  const bottom = window.innerHeight - insets.bottom;
  let covered = 0;
  for (const selector of MAY_COVER) {
    const r = shownRect(selector);
    if (r === null || r.top >= bottom) continue;
    if (drawer !== null && (r.right <= drawer.left || r.left >= drawer.right)) {
      continue;
    }
    covered = Math.max(covered, bottom - r.top);
  }
  return covered;
}

/** The domestic panel: technology, book of laws, government and victory tabs. */
@customElement("domestic-panel")
export class DomesticPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private open = false;
  @state() private data: DomesticData | null = null;
  @state() private tab: DomesticTab = "tech";
  /** The law or government button waiting for its confirming tap. */
  @state() private armed: string | null = null;
  @state() private insets: DrawerInsets = {
    top: DRAWER_GAP,
    right: DRAWER_GAP,
    bottom: DRAWER_GAP,
  };
  /** How far the HUD over the drawer's lower band reaches into it. */
  @state() private coveredBottom = 0;
  private resizeObserver: ResizeObserver | null = null;
  private readonly refit = () => {
    this.insets = drawerInsets();
    const box = this.querySelector(
      "[data-domestic-drawer]",
    )?.getBoundingClientRect();
    this.coveredBottom = drawerCoveredBottom(
      this.insets,
      box !== undefined && box.width > 0 ? box : null,
    );
  };

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleDomesticPanelEvent, () => {
      this.open = !this.open;
      this.armed = null;
    });
  }

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("open")) return;
    if (this.open) this.startFitting();
    else this.stopFitting();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopFitting();
  }

  /** While open, refit whenever the HUD around the drawer changes size. */
  private startFitting() {
    this.stopFitting();
    this.refit();
    // Again once the drawer is laid out, to see what lies over it.
    void this.updateComplete.then(() => {
      if (this.open) this.refit();
    });
    window.addEventListener("resize", this.refit);
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(this.refit);
    for (const selector of [...Object.values(KEEP_CLEAR), ...MAY_COVER]) {
      const el = document.querySelector(selector);
      if (el) this.resizeObserver.observe(el);
    }
  }

  private stopFitting() {
    window.removeEventListener("resize", this.refit);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  tick() {
    this.data = this.game?.myPlayer()?.domesticData() ?? null;
  }

  private research(tech: TechId, payWithGold: boolean) {
    this.eventBus.emit(new ResearchTechIntentEvent(tech, payWithGold));
  }

  render() {
    const me = this.game?.myPlayer();
    const view = me?.domestic() ?? null;
    if (!this.open || this.data === null || !me || view === null) return null;
    const d = this.data;
    // A right-side drawer (spec §14a): the map stays visible and playable on
    // the left, so there is no backdrop, and the HUD around it stays clear
    // (KEEP_CLEAR). It stacks under that HUD, so a build-bar card can pop up
    // over it. Every tab in TABS gets a button.
    const { top, right, bottom } = this.insets;
    return html`
      <aside
        data-domestic-drawer
        class="fixed z-[150] w-[40vw] min-w-[420px] min-h-60 flex flex-col rounded-lg bg-gray-900/95 backdrop-blur-sm text-white text-base shadow-2xl border border-white/10"
        style="top: ${top}px; right: ${right}px; bottom: ${bottom}px;"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div class="flex items-center gap-2 px-3 pt-3">
          <h2 class="flex-1 text-xl font-bold">
            ${translateText("domestic.panel_title")}
          </h2>
          <button
            type="button"
            data-domestic-close
            class="size-11 flex items-center justify-center rounded-md text-2xl hover:bg-white/10"
            aria-label=${translateText("common.close")}
            @click=${() => {
              this.open = false;
              this.armed = null;
            }}
          >
            ✕
          </button>
        </div>
        <div role="tablist" class="flex flex-wrap gap-1 px-3 py-2">
          ${TABS.map(
            (tab) =>
              html`<button
                type="button"
                role="tab"
                data-tab=${tab}
                aria-selected=${String(this.tab === tab)}
                class="h-11 px-4 shrink-0 rounded-md font-semibold ${this
                  .tab === tab
                  ? "bg-sky-700"
                  : "bg-slate-700 hover:bg-slate-600"}"
                @click=${() => {
                  this.tab = tab;
                  this.armed = null;
                }}
              >
                ${translateText(`domestic.tab_${tab}`)}
              </button>`,
          )}
        </div>
        <div
          data-domestic-scroll
          class="flex-1 overflow-y-auto px-3"
          style="padding-bottom: ${LIST_PADDING + this.coveredBottom}px;"
        >
          ${this.renderTab(d, view, me)}
        </div>
      </aside>
    `;
  }

  private renderTab(
    d: DomesticData,
    view: DomesticClientView,
    me: PlayerView,
  ): TemplateResult {
    switch (this.tab) {
      case "tech":
        return this.renderTechTab(d, me);
      case "laws":
        return renderLawsTab({
          view,
          gold: me.gold(),
          infiniteGold: this.game.config().hasInfiniteGold(me),
          nowTick: this.game.ticks(),
          armed: this.armed,
          arm: (key) => (this.armed = key),
          proclaim: (law, option, payWithGold) =>
            this.eventBus.emit(
              new ProclaimLawIntentEvent(law, option, payWithGold),
            ),
        });
      case "government":
        return renderGovernmentTab({
          view,
          armed: this.armed,
          arm: (key) => (this.armed = key),
          choose: (government) =>
            this.eventBus.emit(new ChooseGovernmentIntentEvent(government)),
        });
      case "victory":
        return renderVictoryTab(this.game, me, d, (kind, unitId) =>
          this.eventBus.emit(new StartVictoryProjectIntentEvent(kind, unitId)),
        );
    }
  }

  private renderTechTab(d: DomesticData, me: PlayerView): TemplateResult {
    const researched = new Set<TechId>(d.techs);
    // One column of cards per era: the drawer is too narrow for a
    // branch-by-era grid, so each card names its branch instead.
    return html`
      ${this.renderResearch(d)}
      <div class="flex flex-col gap-4">
        ${ERAS.map(
          (era) => html`
            <section data-era=${era} class="flex flex-col gap-2">
              <h3 class="text-lg font-bold">
                ${translateText("domestic.era", { era })}
              </h3>
              ${BRANCHES.flatMap((b) =>
                TECH_IDS.filter(
                  (id) => TECHS[id].era === era && TECHS[id].branch === b,
                ).map((id) => this.renderTech(id, d, researched, me)),
              )}
            </section>
          `,
        )}
      </div>
    `;
  }

  private renderResearch(d: DomesticData) {
    if (d.research === null) return null;
    const done = 1 - d.research.ticksLeft / d.research.totalTicks;
    return html`
      <div class="mb-4 flex flex-col gap-1">
        <div class="text-base">
          ${translateText("domestic.research_progress", {
            tech: translateText(`domestic.tech.${d.research.tech}.name`),
            seconds: Math.ceil(d.research.ticksLeft / 10),
          })}
        </div>
        <div class="h-3 bg-gray-700 rounded-sm">
          <div
            class="h-3 bg-sky-500 rounded-sm"
            style="width: ${Math.round(done * 100)}%"
          ></div>
        </div>
      </div>
    `;
  }

  private renderTech(
    id: TechId,
    d: DomesticData,
    researched: ReadonlySet<TechId>,
    me: PlayerView,
  ) {
    const def = TECHS[id];
    let status: TemplateResult | string;
    let border = "border-gray-600";
    if (researched.has(id)) {
      status = translateText("domestic.researched");
      border = "border-green-500";
    } else if (d.research?.tech === id) {
      status = translateText("domestic.researching");
      border = "border-sky-500";
    } else {
      const block = researchBlock(researched, d.research !== null, id);
      if (block !== null) {
        status = this.blockText(block, id, researched);
      } else if (d.science >= def.cost) {
        status = html`<button
          type="button"
          class="min-h-11 px-4 rounded-md text-sm font-semibold bg-sky-700 hover:bg-sky-600"
          @click=${() => this.research(id, false)}
        >
          ${translateText("domestic.research")}
        </button>`;
      } else {
        // Infinite gold: the engine charges nothing (payPoints).
        const gold = this.game.config().hasInfiniteGold(me)
          ? 0n
          : shortfallGold(
              (def.cost - d.science) * MILLI,
              me.domestic()?.pct("goldPaymentCost") ?? 0,
            );
        const affordable = me.gold() >= gold;
        status = html`<button
            type="button"
            class="min-h-11 px-4 rounded-md text-sm font-semibold bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
            ?disabled=${!affordable}
            @click=${() => this.research(id, true)}
          >
            ${translateText("domestic.pay_with_gold", {
              gold: renderNumber(gold),
            })}
          </button>
          ${affordable
            ? null
            : html`<span data-reason class="block mt-1 text-red-300"
                >${translateText("build_menu.not_enough_money")}</span
              >`}`;
      }
    }
    return html`
      <div
        data-tech=${id}
        class="border ${border} rounded-md p-3 text-sm flex flex-col gap-1"
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-base font-bold"
            >${translateText(`domestic.tech.${id}.name`)}</span
          >
          <span class="text-sm text-gray-400"
            >${translateText(`domestic.branch.${def.branch}`)}</span
          >
        </div>
        <div class="text-gray-300">
          ${translateText(`domestic.tech.${id}.desc`)}
        </div>
        <div class="text-gray-400">
          ${translateText("domestic.cost", {
            cost: def.cost,
            seconds:
              researchTicks(id, me.domestic()?.pct("researchTime") ?? 0) / 10,
          })}
        </div>
        <div>${status}</div>
      </div>
    `;
  }

  private blockText(
    block: ResearchBlock,
    id: TechId,
    researched: ReadonlySet<TechId>,
  ): string {
    switch (block) {
      case "busy":
        return translateText("domestic.blocked.busy");
      case "era":
        return translateText("domestic.blocked.era");
      case "prereq": {
        const missing = TECHS[id].prereqs.find((p) => !researched.has(p));
        return translateText("domestic.blocked.prereq", {
          tech:
            missing === undefined
              ? ""
              : translateText(`domestic.tech.${missing}.name`),
        });
      }
      case "researched":
        return translateText("domestic.researched");
    }
  }
}
