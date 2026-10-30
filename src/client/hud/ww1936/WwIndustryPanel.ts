import type { WwOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  BUILDABLE,
  BuildingId,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  EquipmentType,
  ResourceId,
  WW_MAX_LINE_FACTORIES,
  WwCountryDetail,
  WwCountrySummary,
  WwLineData,
  WwOrderBlock,
  WwTradeData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { PlayerView } from "../../view";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwEndgameView } from "../../view/WwEndgameView";
import { designsButton } from "./DesignButton";
import {
  addLineBlock,
  armyMenOf,
  blockedSellers,
  blockText,
  buildBlock,
  buildCandidates,
  BuildDepthInputs,
  buildDepthInputs,
  BUILDING_ICONS,
  buildingName,
  changeLineBlock,
  ConstructionRow,
  constructionRows,
  EQUIPMENT_ICONS,
  equipmentName,
  fightingFn,
  genName,
  idleMilOf,
  infraDots,
  LineRow,
  lineRows,
  maxBuildCount,
  maxTradeCivs,
  menText,
  milliText,
  noCandidateBlock,
  NOT_PARTNER_KEYS,
  openTradeBlock,
  paidCivsOf,
  receivedCivsOf,
  RESOURCE_ICONS,
  resourceName,
  resourceRows,
  retentionBpOf,
  signedText,
  slotPctOf,
  stockOnly,
  stockRows,
  switchPreview,
  TradeOffer,
  tradeOffers,
} from "./EconomyModel";
import { conscriptionLaw } from "./PoliticsModel";
import {
  countryName,
  isKoreanUi,
  today,
  TWO_TAP_MS,
  TwoTap,
  wwActive,
} from "./WorldWarModel";
import {
  OpenWwIndustryEvent,
  OpenWwPoliticsEvent,
  WW_INDUSTRY_TABS,
  WwDrawerBase,
  WwIndustryTab,
  WwProductionView,
} from "./WwDrawer";
// P4 (spec §18.8): the shipyards view is the navy drawer's <ww-shipyards>.
import { WwDepthOpenEvent } from "./DepthEvents";
import { DepthIndustryModel } from "./DepthIndustryModel";
import { autoMaskOf, renderAutoRow } from "./WwAutoUi";
import { renderMarketTab } from "./WwMarketTab";
import { renderMioTab } from "./WwMioTab";
import "./WwNavyPanel";
import { TabUi } from "./WwTabUi";

/** P6 (spec §20.8): the MIO and market tabs follow the four of P1. */
type DepthTab = WwIndustryTab | "mio" | "market";
const ALL_TABS: readonly DepthTab[] = [...WW_INDUSTRY_TABS, "mio", "market"];

const TAB_KEYS: Readonly<Record<DepthTab, string>> = {
  mio: "ww1936.mio.tab",
  market: "ww1936.market.tab",
  construction: "ww1936.econ.tab_construction",
  production: "ww1936.econ.tab_production",
  trade: "ww1936.econ.tab_trade",
  manpower: "ww1936.pol.tab.manpower",
};

/** Candidate regions listed before "N more regions". */
const CANDIDATES_SHOWN = 4;
/** Holding a −/+ this long changes the count by five (pre-flight R7.12). */
export const HOLD_MS = 500;
/** A tapped −/+ shows its new count until the engine's answer arrives, at most this long. */
const PENDING_MS = 2000;

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const ICON_BUTTON =
  "size-9 shrink-0 rounded-md border border-white/10 bg-white/5 text-xs hover:bg-white/10 disabled:opacity-30";

/** What every tab reads; null for a spectator or a country without data (pre-flight R7.4). */
interface Ctx {
  scenario: ScenarioIndex;
  view: WwEconomyView;
  me: PlayerView;
  id: number;
  detail: WwCountryDetail;
  summary: WwCountrySummary;
  day: number;
  korean: boolean;
  fighting: (smallID: number) => boolean;
  /** P5: the endgame's core table (isCoreNow). */
  endgame: WwEndgameView | null;
  /** P6: the depth rules' inputs of the build menu (buildDepthInputs). */
  depth: BuildDepthInputs;
  /** Gone or capitulated: the engine refuses every order ("dead"). */
  dead: boolean;
}

/**
 * World War 1936 P1 (spec §13.3): the industry drawer — construction,
 * production, resources and trade, laws and manpower. Every order goes out
 * as one ww_order intent; a button the engine would refuse is disabled and
 * says why (ww1936.econ.block.*), from the same engine-lib judgement.
 */
@customElement("ww-industry-panel")
export class WwIndustryPanel extends WwDrawerBase {
  protected readonly drawerId = "industry" as const;
  @state() private tab: DepthTab = "construction";
  private readonly tabPick: Record<string, number> = {};
  @state() private building: BuildingId = "civ";
  /** The region picked for "new construction"; null: the best candidate. */
  @state() private region: number | null = null;
  @state() private count = 1;
  /** Every candidate region listed, not just the best few. */
  @state() private allCandidates = false;
  /** The resource row whose sellers are listed. */
  @state() private buyResource: ResourceId | null = null;
  /** Factories to pay per seller, by smallID. */
  @state() private buyCivs = new Map<number, number>();
  /** The line whose equipment picker is open. */
  @state() private switching: number | null = null;
  @state() private addingLine = false;
  /** P4 (spec §18.8): the production tab shows munitions or shipyards. */
  @state() private prodView: WwProductionView = "munitions";
  private readonly twoTap = new TwoTap();
  /** A line's factory count sent but not yet back from the engine. */
  private readonly pendingFactories = new Map<
    number,
    { value: number; at: number }
  >();
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdFired = false;
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwIndustryEvent, (e) => this.onOpenEvent(e));
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "mio" && e.kind !== "market") return;
      this.tab = e.kind;
      this.setOpen(true);
    });
  }

  /** The tab on show. */
  shownTab(): DepthTab {
    return this.tab;
  }

  private onOpenEvent(e: OpenWwIndustryEvent) {
    if (e.view !== null) this.prodView = e.view;
    if (e.region !== null) {
      this.tab = "construction";
      this.region = e.region;
      // P4: the air drawer's "build more" picks the building too.
      if (e.building !== null) this.building = e.building;
      this.count = 1;
      this.setOpen(true);
      return;
    }
    if (e.fuel) {
      // P4 (spec §18.1): the band's ⛽ — the resources tab, at the fuel row.
      this.tab = "trade";
      this.setOpen(true);
      void this.updateComplete.then(() =>
        this.querySelector("[data-ww-fuel-row]")?.scrollIntoView?.({
          block: "nearest",
        }),
      );
      return;
    }
    if (this.open && (e.tab === null || e.tab === this.tab)) {
      this.setOpen(false);
      return;
    }
    if (e.tab !== null) this.tab = e.tab;
    this.setOpen(true);
  }

  private ctx(): Ctx | null {
    const game = this.game;
    const scenario = game?.worldWarScenario() ?? null;
    const view = game?.wwEconomy?.() ?? null;
    const me = game?.myPlayer() ?? null;
    if (scenario === null || view === null || me === null) return null;
    const id = me.smallID();
    const detail = view.detail(id);
    const summary = view.summary(id);
    if (detail === null || summary === null) return null;
    return {
      scenario,
      view,
      me,
      id,
      detail,
      summary,
      day: today(game),
      korean: isKoreanUi(),
      fighting: fightingFn(game),
      endgame: game.wwEndgame?.() ?? null,
      depth: buildDepthInputs(game, id),
      // P5 pre-flight §0-1: an exile still builds.
      dead: !wwActive(game, id),
    };
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const view = this.game?.wwEconomy?.() ?? null;
    const id = this.game?.myPlayer()?.smallID() ?? 0;
    // Redraw when my data, the day or the wars change; the trade tab also
    // shows the other countries' export room.
    const key = [
      view?.detail(id) ?? null,
      view?.summary(id) ?? null,
      this.game?.worldWarScenario() ? today(this.game) : 0,
      this.game?.worldWarData() ?? null,
      this.tab === "trade" ? (view?.version ?? 0) : 0,
      // P2: the manpower rows read the land war's country summary.
      this.game?.wwLand?.()?.countries.get(id) ?? null,
      // P4: the shipyards view reads the navy.
      this.tab === "production" && this.prodView === "shipyards"
        ? (this.game?.wwNavy?.()?.version ?? 0)
        : 0,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  /** An irreversible action: the first tap arms `key`, a second within 3 s acts. */
  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    // Back to the plain label once the second tap can no longer confirm.
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  // ---- −/+ that change by five when held (pre-flight R7.12) ----

  private holdStart(by5: () => void) {
    this.holdEnd();
    this.holdFired = false;
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.holdFired = true;
      by5();
    }, HOLD_MS);
  }

  private holdEnd() {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  private holdClick(by1: () => void) {
    this.holdEnd();
    // The hold already changed it by five.
    if (this.holdFired) {
      this.holdFired = false;
      return;
    }
    by1();
  }

  private stepper(
    value: string,
    dataKey: string,
    canDown: boolean,
    canUp: boolean,
    change: (delta: number) => void,
  ): TemplateResult {
    const end = () => this.holdEnd();
    const button = (sign: -1 | 1, can: boolean) =>
      html`<button
        type="button"
        data-ww-step=${`${dataKey}:${sign < 0 ? "down" : "up"}`}
        aria-label=${translateText(
          sign < 0 ? "ww1936.econ.fewer" : "ww1936.econ.more",
        )}
        class=${ICON_BUTTON}
        ?disabled=${!can}
        @pointerdown=${() => this.holdStart(() => change(5 * sign))}
        @pointerup=${end}
        @pointerleave=${end}
        @pointercancel=${end}
        @click=${() => this.holdClick(() => change(sign))}
      >
        ${sign < 0 ? "−" : "+"}
      </button>`;
    return html`<span class="flex shrink-0 items-center gap-1">
      ${button(-1, canDown)}
      <span
        data-ww-step-value=${dataKey}
        class="min-w-14 text-center text-xs tabular-nums"
        >${value}</span
      >
      ${button(1, canUp)}
    </span>`;
  }

  private blockLine(block: WwOrderBlock | null) {
    return block === null
      ? nothing
      : html`<p data-ww-block=${block} class="m-0 mt-1 text-xs text-red-300">
          🔒 ${blockText(block)}
        </p>`;
  }

  render() {
    if (!this.open) return null;
    const c = this.ctx();
    if (c === null) return null;
    return this.renderFrame(
      translateText("ww1936.econ.industry"),
      html`<span aria-hidden="true">🏭</span>
        <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
          ${translateText("ww1936.econ.industry")}
        </h3>`,
      c.dead
        ? nothing
        : this.renderTabs(
            ALL_TABS,
            this.tab,
            (t) => translateText(TAB_KEYS[t]),
            (t) => {
              this.tab = t;
              this.tick();
            },
          ),
      c.dead
        ? html`${this.blockLine("dead")}`
        : html`${renderAutoRow(autoMaskOf(this.game, c.id), (o) =>
            this.send(o),
          )}${this.renderTab(c)}`,
    );
  }

  private renderTab(c: Ctx): TemplateResult {
    switch (this.tab) {
      case "construction":
        return this.renderConstruction(c);
      case "production":
        return this.renderProduction(c);
      case "trade":
        return this.renderTrade(c);
      case "manpower":
        return this.renderManpower(c);
      case "mio":
        return renderMioTab(this.depthModel(), this.tabUi(c));
      case "market":
        return renderMarketTab(this.depthModel(), this.tabUi(c));
    }
  }

  private depthModel(): DepthIndustryModel {
    return new DepthIndustryModel(this.game);
  }

  private tabUi(c: Ctx): TabUi {
    return {
      send: (o) => this.send(o),
      confirm: (k, act) => this.confirmTap(k, act),
      armed: (k) => this.armed(k),
      redraw: () => this.requestUpdate(),
      me: this.game.myPlayer()?.smallID() ?? 0,
      regionName: (r) => c.scenario.region(r)?.name ?? String(r),
      name: (id) => {
        const tag = c.scenario.tagOfSmallId(id);
        return tag === undefined ? "?" : countryName(tag);
      },
      pick: this.tabPick,
    };
  }

  /** P6 (spec §20.8): the energy line and the coal and uranium rows. */
  private renderEnergy(): TemplateResult {
    const m = this.depthModel();
    const e = m.energyLine();
    if (e === null) return html`${nothing}`;
    return html`<div data-ww-energy class="mt-2 text-xs tabular-nums">
      <div class="${e.short ? "text-amber-300" : "text-emerald-300"}">
        ⚡
        ${translateText("ww1936.energy.line", {
          pct: e.pct,
          coal: e.coalUnits,
          hydro: e.hydroPower,
          plants: e.plantPower,
          demand: e.demand,
        })}
      </div>
      ${m.resourceLines().map(
        (r) =>
          html`<div data-ww-energy-res=${r.id} class="text-white/80">
            ${translateText(
              r.id === "coal"
                ? "ww1936.energy.coal_line"
                : "ww1936.energy.uranium_line",
              {
                // W1's stocks in the energy detail.
                stock: r.id === "coal" ? e.coalStock : e.uraniumStock,
                gain: signedText(r.balance),
              },
            )}
          </div>`,
      )}
    </div>`;
  }

  // ---- Construction ----

  private renderConstruction(c: Ctx): TemplateResult {
    const d = c.detail;
    const rows = constructionRows(d, c.scenario, c.korean);
    const trade = receivedCivsOf(d) - paidCivsOf(d);
    return html`
      <p data-ww-free-civs class="m-0 mt-2 text-xs text-white/80">
        <b class="text-white"
          >${translateText("ww1936.econ.free_civs", {
            n: milliText(c.summary.freeCivMilli),
          })}</b
        >
        ·
        ${translateText("ww1936.econ.consumer_goods", {
          n: milliText(d.consumerGoodsMilli),
        })}
        ·
        ${translateText("ww1936.econ.trade_civs", {
          n: signedText(trade, true),
        })}
      </p>
      ${this.renderNewBuild(c)}
      <ul data-ww-queue class="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        ${rows.map((r) => this.renderProject(r, rows.length))}
      </ul>
    `;
  }

  private renderProject(r: ConstructionRow, n: number): TemplateResult {
    const key = `cancel_build:${r.index}:${r.region}:${r.building}`;
    const armed = this.armed(key);
    return html`<li
      data-ww-project=${r.index}
      class="rounded-md border border-white/10 bg-white/5 p-2"
    >
      <div class="flex items-center gap-1.5">
        <span aria-hidden="true">${BUILDING_ICONS[r.building]}</span>
        <span class="min-w-0 flex-1 truncate font-semibold"
          >${r.regionName} · ${buildingName(r.building)} ×${r.count}</span
        >
        <button
          type="button"
          data-ww-move-build="up"
          aria-label=${translateText("ww1936.econ.move_up")}
          class=${ICON_BUTTON}
          ?disabled=${r.index === 0}
          @click=${() =>
            this.send({ kind: "move_build", index: r.index, to: r.index - 1 })}
        >
          ▲
        </button>
        <button
          type="button"
          data-ww-move-build="down"
          aria-label=${translateText("ww1936.econ.move_down")}
          class=${ICON_BUTTON}
          ?disabled=${r.index === n - 1}
          @click=${() =>
            this.send({ kind: "move_build", index: r.index, to: r.index + 1 })}
        >
          ▼
        </button>
        <button
          type="button"
          data-ww-cancel-build=${r.index}
          data-armed=${String(armed)}
          aria-label=${translateText("ww1936.econ.cancel_project")}
          class="${armed
            ? "h-9 rounded-md bg-red-700 px-2 text-xs font-semibold"
            : ICON_BUTTON}"
          @click=${() =>
            this.confirmTap(key, () =>
              this.send({ kind: "cancel_build", index: r.index }),
            )}
        >
          ${armed ? translateText("ww1936.econ.cancel_tap") : "✕"}
        </button>
      </div>
      <div class="mt-1 h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded bg-amber-400"
          style="width: ${Math.round(Math.min(1, r.progress) * 100)}%"
        ></div>
      </div>
      <div class="mt-1 flex justify-between gap-2 text-xs text-white/70">
        <span data-ww-days
          >${r.daysLeft < 0
            ? translateText("ww1936.econ.no_civs_assigned")
            : translateText("ww1936.econ.days_left", { n: r.daysLeft })}</span
        >
        <span class="tabular-nums"
          >${translateText("ww1936.econ.factories", {
            n: r.civs.toFixed(1),
          })}</span
        >
      </div>
    </li>`;
  }

  /**
   * Another building type. The picked region ("Build here", or a tapped
   * candidate) stays while it can take the new type; otherwise the pick
   * goes back to the best candidate, so the stepper and Add don't stop on
   * a region the engine would refuse. With no region that takes it at
   * all, the pick stays and its block says why.
   */
  private pickBuilding(c: Ctx, building: BuildingId, slotPct: number) {
    this.building = building;
    this.count = 1;
    this.allCandidates = false;
    if (this.region === null) return;
    const block = buildBlock(
      c.view,
      c.scenario,
      c.id,
      this.region,
      building,
      1,
      slotPct,
      c.fighting,
      c.endgame,
      c.depth,
    );
    if (block === null) return;
    const best = buildCandidates(
      c.view,
      c.scenario,
      c.id,
      building,
      slotPct,
      c.fighting,
      false,
      c.endgame,
      c.depth,
    );
    if (best.length > 0) this.region = null;
  }

  private renderNewBuild(c: Ctx): TemplateResult {
    const slotPct = slotPctOf(c.detail);
    const candidates = buildCandidates(
      c.view,
      c.scenario,
      c.id,
      this.building,
      slotPct,
      c.fighting,
      c.korean,
      c.endgame,
      c.depth,
    );
    const region = this.region ?? candidates[0]?.id ?? null;
    const picked = candidates.find((x) => x.id === region) ?? null;
    const max = picked === null ? 1 : maxBuildCount(picked);
    const count = Math.min(this.count, max);
    const block =
      region === null
        ? null
        : buildBlock(
            c.view,
            c.scenario,
            c.id,
            region,
            this.building,
            count,
            slotPct,
            c.fighting,
            c.endgame,
            c.depth,
          );
    const r = region === null ? undefined : c.scenario.region(region);
    // On a phone the list area is short: the picked region and "Add" come
    // first, so queuing the best region is one tap, and the candidates
    // follow in the drawer's own scroll (no inner one, spec §13.7).
    const shown =
      this.allCandidates || candidates.length <= CANDIDATES_SHOWN + 1
        ? candidates
        : candidates.slice(0, CANDIDATES_SHOWN);
    const hidden = candidates.length - shown.length;
    return html`<section data-ww-new-build class="mt-2">
      <div
        role="group"
        aria-label=${translateText("ww1936.econ.new_build")}
        class="flex flex-wrap gap-1"
      >
        ${BUILDABLE.map(
          (b) =>
            html`<button
              type="button"
              data-ww-building=${b}
              aria-pressed=${String(b === this.building)}
              class="${BUTTON} ${b === this.building
                ? "border-amber-300 bg-amber-900/50"
                : ""}"
              @click=${() => this.pickBuilding(c, b, slotPct)}
            >
              ${BUILDING_ICONS[b]} ${buildingName(b)}
            </button>`,
        )}
      </div>
      ${region === null
        ? // No region takes it: say why rather than show nothing.
          this.blockLine(
            noCandidateBlock(
              c.view,
              c.scenario,
              c.id,
              this.building,
              slotPct,
              c.fighting,
              c.endgame,
              c.depth,
            ),
          )
        : html`<div
              data-ww-picked=${region}
              class="mt-1.5 flex items-center gap-2"
            >
              ${this.stepper(
                `×${count}`,
                "build",
                count > 1,
                count < max,
                (delta) => {
                  this.count = Math.max(1, Math.min(max, count + delta));
                },
              )}
              <button
                type="button"
                data-ww-add-build
                class="flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center rounded-md border border-amber-300/40 bg-amber-700/80 px-2 py-0.5 leading-tight hover:bg-amber-600 disabled:opacity-40"
                ?disabled=${block !== null}
                @click=${() => {
                  this.send({
                    kind: "build",
                    region,
                    building: this.building,
                    count,
                  });
                  this.count = 1;
                }}
              >
                <span class="text-xs font-semibold"
                  >${translateText("ww1936.econ.add_to_queue")}</span
                >
                <span
                  data-ww-picked-name
                  class="max-w-full truncate text-[10px] text-white/80"
                  >${BUILDING_ICONS[this.building]}
                  ${r === undefined ? "" : c.korean ? r.nameKo : r.name}</span
                >
              </button>
            </div>
            ${this.blockLine(block)}`}
      <ul
        data-ww-candidates
        class="m-0 mt-1 flex list-none flex-col gap-0.5 p-0"
      >
        ${shown.map(
          (x) =>
            html`<li>
              <button
                type="button"
                data-ww-candidate=${x.id}
                aria-pressed=${String(x.id === region)}
                class="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs ${x.id ===
                region
                  ? "bg-amber-900/50 ring-1 ring-amber-300"
                  : "hover:bg-white/10"}"
                @click=${() => {
                  this.region = x.id;
                  this.count = 1;
                }}
              >
                <span class="min-w-0 flex-1 truncate">${x.name}</span>
                <span class="tabular-nums text-white/70"
                  >${translateText("ww1936.econ.slots", {
                    free: x.free,
                    used: x.slots - x.free,
                    total: x.slots,
                  })}</span
                >
                <span class="tracking-tighter text-amber-300"
                  >${infraDots(x.infra)}</span
                >
              </button>
            </li>`,
        )}
      </ul>
      ${hidden > 0
        ? html`<button
            type="button"
            data-ww-more-regions
            class="${BUTTON} mt-1 w-full"
            @click=${() => {
              this.allCandidates = true;
            }}
          >
            ${translateText("ww1936.econ.more_regions", { n: hidden })}
          </button>`
        : nothing}
    </section>`;
  }

  // ---- Production ----

  private factoriesOf(line: WwLineData): number {
    const p = this.pendingFactories.get(line.id);
    if (p === undefined) return line.factories;
    if (p.value === line.factories || Date.now() - p.at > PENDING_MS) {
      this.pendingFactories.delete(line.id);
      return line.factories;
    }
    return p.value;
  }

  private setFactories(line: WwLineData, value: number) {
    const v = Math.max(0, Math.min(WW_MAX_LINE_FACTORIES, value));
    if (v === this.factoriesOf(line)) return;
    this.pendingFactories.set(line.id, { value: v, at: Date.now() });
    this.send({ kind: "set_line_factories", line: line.id, factories: v });
    this.requestUpdate();
  }

  /** P4 (spec §18.8): [Munitions | Shipyards] above the production tab. */
  private renderProdSwitch(): TemplateResult {
    const views: [WwProductionView, string][] = [
      ["munitions", "ww1936.navy.ind_munitions"],
      ["shipyards", "ww1936.navy.ind_docks"],
    ];
    return html`<div
      data-ww-prod-switch
      role="tablist"
      class="mt-2 flex gap-1 rounded-md bg-white/5 p-0.5"
    >
      ${views.map(
        ([v, key]) =>
          html`<button
            type="button"
            role="tab"
            data-ww-prod-view=${v}
            aria-selected=${String(this.prodView === v)}
            class="h-9 flex-1 rounded-md text-xs font-semibold ${this
              .prodView === v
              ? "bg-white/15 text-white"
              : "text-white/70 hover:bg-white/10"}"
            @click=${() => {
              this.prodView = v;
            }}
          >
            ${translateText(key)}
          </button>`,
      )}
    </div>`;
  }

  private renderProduction(c: Ctx): TemplateResult {
    if (this.prodView === "shipyards") {
      return html`${this.renderProdSwitch()}
        <ww-shipyards
          .game=${this.game}
          .eventBus=${this.eventBus}
          .version=${`${this.game.wwNavy?.()?.version ?? 0}:${c.view.version}`}
        ></ww-shipyards>`;
    }
    return html`${this.renderProdSwitch()} ${this.renderMunitions(c)}`;
  }

  private renderMunitions(c: Ctx): TemplateResult {
    const d = c.detail;
    const rows = lineRows(d);
    const retention = retentionBpOf(d);
    return html`
      <p data-ww-mil class="m-0 mt-2 text-xs text-white/80">
        ${translateText("ww1936.econ.mil_factories", {
          n: c.summary.mil,
          idle: idleMilOf(c.summary, d),
        })}
      </p>
      <ul data-ww-lines class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        ${rows.map((r) =>
          this.renderLine(c, r, d.lines[r.index], rows.length, retention),
        )}
      </ul>
      ${this.renderNewLine(c)} ${designsButton(this.eventBus)}
      ${this.renderStock(c)}
    `;
  }

  private renderLine(
    c: Ctx,
    r: LineRow,
    line: WwLineData,
    n: number,
    retention: number,
  ): TemplateResult {
    const key = `remove_line:${r.id}`;
    const armed = this.armed(key);
    const factories = this.factoriesOf(line);
    const shown =
      r.active < factories ? `${r.active}/${factories}` : `${factories}`;
    return html`<li
      data-ww-line=${r.id}
      class="rounded-md border border-white/10 bg-white/5 p-2"
    >
      <div class="flex items-center gap-1.5">
        <span aria-hidden="true">${EQUIPMENT_ICONS[r.equipment]}</span>
        <span class="min-w-0 flex-1 truncate font-semibold"
          >${equipmentName(r.equipment)} ${genName(r.gen)}</span
        >
        <button
          type="button"
          data-ww-move-line="up"
          aria-label=${translateText("ww1936.econ.move_up")}
          class=${ICON_BUTTON}
          ?disabled=${r.index === 0}
          @click=${() =>
            this.send({ kind: "move_line", line: r.id, to: r.index - 1 })}
        >
          ▲
        </button>
        <button
          type="button"
          data-ww-move-line="down"
          aria-label=${translateText("ww1936.econ.move_down")}
          class=${ICON_BUTTON}
          ?disabled=${r.index === n - 1}
          @click=${() =>
            this.send({ kind: "move_line", line: r.id, to: r.index + 1 })}
        >
          ▼
        </button>
        <button
          type="button"
          data-ww-remove-line=${r.id}
          data-armed=${String(armed)}
          aria-label=${translateText("ww1936.econ.remove_line")}
          class="${armed
            ? "h-9 rounded-md bg-red-700 px-2 text-xs font-semibold"
            : ICON_BUTTON}"
          @click=${() =>
            this.confirmTap(key, () =>
              this.send({ kind: "remove_line", line: r.id }),
            )}
        >
          ${armed ? translateText("ww1936.econ.remove_tap") : "✕"}
        </button>
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-2">
        ${this.stepper(
          translateText("ww1936.econ.factories", { n: shown }),
          `line-${r.id}`,
          factories > 0,
          factories < WW_MAX_LINE_FACTORIES,
          (delta) => this.setFactories(line, factories + delta),
        )}
        <span class="text-xs tabular-nums text-white/80"
          >${translateText("ww1936.econ.per_day", {
            n: r.perDay.toFixed(1),
          })}</span
        >
        ${r.shortage.map(
          (res) =>
            html`<span
              data-ww-short=${res}
              class="rounded bg-red-900/60 px-1 text-xs text-red-200"
              >${RESOURCE_ICONS[res]} ${resourceName(res)}</span
            >`,
        )}
      </div>
      <div class="relative mt-1.5 h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded bg-emerald-400"
          style="width: ${Math.round(r.eff * 100)}%"
        ></div>
        <div
          data-ww-cap
          class="absolute -top-0.5 h-2.5 w-0.5 bg-white/80"
          style="left: ${Math.round(r.cap * 100)}%"
        ></div>
      </div>
      <div class="mt-1 flex items-center justify-between gap-2">
        <span data-ww-efficiency class="text-xs text-white/70"
          >${translateText("ww1936.econ.efficiency", {
            n: Math.round(r.eff * 100),
            cap: Math.round(r.cap * 100),
          })}</span
        >
        <button
          type="button"
          data-ww-change-line=${r.id}
          aria-expanded=${String(this.switching === r.id)}
          class=${BUTTON}
          @click=${() => {
            this.switching = this.switching === r.id ? null : r.id;
          }}
        >
          ${translateText("ww1936.econ.change_line")}
        </button>
      </div>
      ${stockOnly(r.equipment)
        ? html`<p class="m-0 mt-1 text-xs text-sky-300">
            ${translateText("ww1936.econ.stock_only")}
          </p>`
        : nothing}
      ${this.switching === r.id
        ? this.renderSwitchPicker(c, line, retention)
        : nothing}
    </li>`;
  }

  /** Every equipment and generation, with the efficiency a switch keeps (spec §8.3). */
  private renderSwitchPicker(
    c: Ctx,
    line: WwLineData,
    retention: number,
  ): TemplateResult {
    return this.renderEquipmentPicker(
      "switch",
      (type, gen) => changeLineBlock(c.detail, type, gen),
      (type, gen) => type === line.equipment && gen === line.gen,
      (type, gen) =>
        translateText("ww1936.econ.after_switch", {
          n: Math.round(switchPreview(line, type, gen, retention) / 100),
        }),
      (type, gen) => {
        this.switching = null;
        this.send({ kind: "change_line", line: line.id, equipment: type, gen });
      },
    );
  }

  /**
   * Every equipment type and generation as buttons: a generation without
   * its tech is locked, `current` (the line's own) is off, `note` adds a
   * line under each open one.
   */
  private renderEquipmentPicker(
    dataKey: string,
    blockOf: (type: EquipmentType, gen: number) => WwOrderBlock | null,
    current: (type: EquipmentType, gen: number) => boolean,
    note: ((type: EquipmentType, gen: number) => string) | null,
    pick: (type: EquipmentType, gen: number) => void,
  ): TemplateResult {
    const locked = EQUIPMENT_TYPES.some((t) =>
      Array.from({ length: EQUIPMENT_GENS[t] }, (_, i) => i + 1).some(
        (g) => blockOf(t, g) === "no_tech",
      ),
    );
    return html`<div
      data-ww-picker=${dataKey}
      class="mt-1.5 flex flex-col gap-1 rounded-md border border-white/10 bg-gray-900/80 p-1.5"
    >
      ${EQUIPMENT_TYPES.map(
        (type) =>
          html`<div class="flex flex-wrap items-center gap-1">
            <span class="min-w-28 flex-1 truncate text-xs"
              >${EQUIPMENT_ICONS[type]} ${equipmentName(type)}</span
            >
            ${Array.from({ length: EQUIPMENT_GENS[type] }, (_, i) => i + 1).map(
              (gen) => {
                const block = blockOf(type, gen);
                return html`<button
                  type="button"
                  data-ww-pick=${`${dataKey}:${type}:${gen}`}
                  class="${BUTTON} flex flex-col items-center justify-center leading-tight"
                  ?disabled=${block !== null || current(type, gen)}
                  @click=${() => pick(type, gen)}
                >
                  <span
                    >${block === "no_tech" ? "🔒 " : ""}${genName(gen)}</span
                  >
                  ${note === null || block !== null || current(type, gen)
                    ? nothing
                    : html`<span class="text-[10px] font-normal text-white/70"
                        >${note(type, gen)}</span
                      >`}
                </button>`;
              },
            )}
          </div>`,
      )}
      ${locked
        ? html`<p class="m-0 text-[11px] text-white/60">
            🔒 ${blockText("no_tech")}
          </p>`
        : nothing}
    </div>`;
  }

  private renderNewLine(c: Ctx): TemplateResult {
    const d = c.detail;
    // The line limit blocks every equipment alike.
    const linesFull = addLineBlock(d, "infantry_equipment", 1) === "lines_full";
    const factories = Math.min(WW_MAX_LINE_FACTORIES, idleMilOf(c.summary, d));
    return html`<section data-ww-new-line-section>
      <button
        type="button"
        data-ww-new-line
        aria-expanded=${String(this.addingLine)}
        class="${BUTTON} mt-2 w-full"
        ?disabled=${linesFull}
        @click=${() => {
          this.addingLine = !this.addingLine;
        }}
      >
        + ${translateText("ww1936.econ.new_line")}
      </button>
      ${linesFull ? this.blockLine("lines_full") : nothing}
      ${this.addingLine && !linesFull
        ? this.renderEquipmentPicker(
            "add",
            (type, gen) => addLineBlock(d, type, gen),
            () => false,
            null,
            (type, gen) => {
              this.addingLine = false;
              this.send({ kind: "add_line", equipment: type, gen, factories });
            },
          )
        : nothing}
    </section>`;
  }

  private renderStock(c: Ctx): TemplateResult {
    // P2 (pre-flight N1): the army the stock must cover is the men in the
    // field and in training, once the land war reports them.
    const land = this.game?.wwLand?.()?.countries.get(c.id) ?? null;
    const rows = stockRows(
      c.detail,
      land === null ? armyMenOf(c.me) : land.fieldMen + land.trainingMen,
    );
    return html`<section data-ww-stock>
      <div class=${HEADING}>${translateText("ww1936.econ.stockpile")}</div>
      <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
        ${rows.map(
          (r) =>
            html`<li data-ww-stock-row=${r.equipment}>
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate"
                  >${EQUIPMENT_ICONS[r.equipment]}
                  ${equipmentName(r.equipment)}</span
                >
                <span class="tabular-nums text-white/80"
                  >${r.gens
                    .map((n, i) => `${genName(i + 1)} ${renderNumber(n)}`)
                    .join(" · ")}</span
                >
              </div>
              ${r.coverage === null
                ? nothing
                : html`<div class="flex items-center gap-2">
                    <div class="h-1 flex-1 rounded bg-white/10">
                      <div
                        class="h-1 rounded bg-sky-400"
                        style="width: ${Math.round(r.coverage * 100)}%"
                      ></div>
                    </div>
                    <span class="text-[11px] text-white/70"
                      >${translateText("ww1936.econ.coverage", {
                        n: Math.round(r.coverage * 100),
                      })}</span
                    >
                  </div>`}
            </li>`,
        )}
      </ul>
    </section>`;
  }

  // ---- Resources and trade ----

  private renderTrade(c: Ctx): TemplateResult {
    const rows = resourceRows(c.detail);
    const th =
      "px-0.5 py-1 text-right align-bottom text-[10px] font-semibold leading-tight break-words text-white/60";
    return html`
      <table
        data-ww-resources
        class="mt-2 w-full table-fixed text-xs tabular-nums"
      >
        <colgroup>
          <col class="w-[36%]" />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th class=${th}>${translateText("ww1936.econ.produced")}</th>
            <th class=${th}>${translateText("ww1936.econ.exported")}</th>
            <th class=${th}>${translateText("ww1936.econ.imported")}</th>
            <th class=${th}>${translateText("ww1936.econ.used")}</th>
            <th class=${th}>${translateText("ww1936.econ.balance")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const open = this.buyResource === r.id;
            return html`<tr
              data-ww-resource=${r.id}
              class="cursor-pointer ${open ? "bg-white/10" : ""}"
              @click=${() => {
                this.buyResource = open ? null : r.id;
                // The sellers open below the six rows: on a phone that is
                // under the fold, so bring them up.
                if (!open) {
                  void this.updateComplete.then(() =>
                    this.querySelector("[data-ww-buy]")?.scrollIntoView?.({
                      block: "nearest",
                    }),
                  );
                }
              }}
            >
              <td class="py-0.5">
                <button
                  type="button"
                  aria-expanded=${String(open)}
                  class="flex min-h-9 w-full items-center gap-1 text-left"
                >
                  <span aria-hidden="true">${RESOURCE_ICONS[r.id]}</span>
                  <span class="min-w-0 truncate">${resourceName(r.id)}</span>
                </button>
              </td>
              <td class="px-0.5 text-right">${r.produced}</td>
              <td class="px-0.5 text-right">${r.exported}</td>
              <td class="px-0.5 text-right">${r.imported}</td>
              <td class="px-0.5 text-right">${r.used}</td>
              <td
                data-ww-balance
                class="px-0.5 text-right font-semibold ${r.balance < 0
                  ? "text-red-400"
                  : "text-emerald-300"}"
              >
                ${signedText(r.balance)}
              </td>
            </tr>`;
          })}
        </tbody>
      </table>
      ${this.renderFuel(c)} ${this.renderEnergy()}
      ${this.buyResource === null
        ? nothing
        : this.renderBuy(c, this.buyResource)}
      ${this.renderDeals(c, c.detail.buying, "buying")}
      ${this.renderDeals(c, c.detail.selling, "selling")}
    `;
  }

  /**
   * P4 (spec §18.8): the fuel row — a day's gain, a day's use (land, navy,
   * air), stock / capacity, yesterday's ratio, synthetic refineries.
   */
  private renderFuel(c: Ctx): TemplateResult {
    const d = c.detail;
    const k = (m: number) => renderNumber(Math.floor(m / 1000));
    const pct = Math.floor(c.summary.fuelRatioPm / 10);
    return html`<section
      data-ww-fuel-row
      class="mt-2 rounded-md border border-white/10 bg-white/5 p-2 text-xs"
    >
      <div class="flex items-center gap-1.5 font-semibold">
        <span aria-hidden="true">⛽</span>
        <span class="min-w-0 flex-1 truncate"
          >${translateText("ww1936.navy.fuel_title")}</span
        >
        <span
          data-ww-fuel-fill
          class=${c.summary.fuelRatioPm < 1000
            ? "text-red-400"
            : "text-emerald-300"}
          >${translateText("ww1936.navy.fuel_fill", { pct })}</span
        >
      </div>
      <div class="mt-1 flex flex-wrap gap-x-2 tabular-nums text-white/80">
        <span data-ww-fuel-gain
          >${translateText("ww1936.navy.fuel_gain", {
            n: k(d.fuelGainMilli),
          })}</span
        >
        <span data-ww-fuel-use
          >${translateText("ww1936.navy.fuel_use", {
            l: k(d.fuelUseMilli[0]),
            n: k(d.fuelUseMilli[1]),
            a: k(d.fuelUseMilli[2]),
          })}</span
        >
        <span data-ww-fuel-stock
          >${translateText("ww1936.navy.fuel_stock", {
            have: k(d.fuelMilli),
            cap: k(d.fuelCapMilli),
          })}</span
        >
        <span data-ww-fuel-refineries
          >${translateText("ww1936.navy.fuel_refineries", {
            n: d.refineries,
          })}</span
        >
      </div>
    </section>`;
  }

  private renderBuy(c: Ctx, resource: ResourceId): TemplateResult {
    const wars = this.game.worldWarData()?.wars ?? [];
    // My partners come with my detail (the engine's tradePartners): no
    // trade graph is built here.
    const offers = tradeOffers(
      c.view,
      c.scenario,
      c.id,
      wars,
      resource,
      c.fighting,
    );
    const blocked = blockedSellers(
      c.view,
      c.scenario,
      c.id,
      wars,
      resource,
      c.fighting,
      (seller) => {
        const p = this.game.playerBySmallID(seller);
        return p.isPlayer() && p.hasEmbargoAgainst(c.me);
      },
    );
    return html`<section data-ww-buy=${resource}>
      <div class=${HEADING}>
        ${translateText("ww1936.econ.buy")} · ${RESOURCE_ICONS[resource]}
        ${resourceName(resource)}
      </div>
      ${offers.length === 0
        ? html`<p data-ww-no-sellers class="m-0 text-xs text-white/60">
            ${translateText("ww1936.econ.sellers_none")}
          </p>`
        : html`<ul class="m-0 flex list-none flex-col gap-1 p-0">
            ${offers.map((o) => this.renderOffer(c, resource, o))}
          </ul>`}
      ${blocked.length === 0
        ? nothing
        : html`<div class=${HEADING}>
              ${translateText("ww1936.econ.not_partners")}
            </div>
            <ul
              data-ww-not-partners
              class="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-white/60"
            >
              ${blocked.map(
                (b) =>
                  html`<li
                    data-ww-not-partner=${b.smallID}
                    data-reason=${b.reason}
                    class="flex min-h-7 items-center gap-1"
                  >
                    ${this.flag(b.smallID, c.scenario)}
                    <span class="min-w-0 truncate">${countryName(b.tag)}</span>
                    <span class="shrink-0"
                      >${translateText("ww1936.econ.export_room", {
                        n: b.room,
                      })}</span
                    >
                    <span class="ml-auto shrink-0 text-amber-300/90"
                      >${translateText(NOT_PARTNER_KEYS[b.reason])}</span
                    >
                  </li>`,
              )}
            </ul>`}
    </section>`;
  }

  private flag(smallID: number, scenario: ScenarioIndex) {
    const tag = scenario.tagOfSmallId(smallID);
    return tag === undefined
      ? nothing
      : html`<img
          src=${assetUrl(`flags/${COUNTRIES[tag].flag}.svg`)}
          alt=""
          class="h-3 w-4 shrink-0 rounded-sm object-cover"
        />`;
  }

  private nameOf(smallID: number, scenario: ScenarioIndex): string {
    const tag = scenario.tagOfSmallId(smallID);
    return tag === undefined ? "" : countryName(tag);
  }

  private renderOffer(
    c: Ctx,
    resource: ResourceId,
    o: TradeOffer,
  ): TemplateResult {
    const max = maxTradeCivs(c.view, c.id, o.room);
    const civs = Math.min(max, this.buyCivs.get(o.smallID) ?? 1);
    const block = openTradeBlock(c.view, c.id, o.smallID, resource, civs, true);
    return html`<li
      data-ww-offer=${o.smallID}
      class="rounded-md border border-white/10 bg-white/5 p-1.5"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="flex min-w-0 flex-1 items-center gap-1 truncate text-xs">
          ${this.flag(o.smallID, c.scenario)} ${countryName(o.tag)}
          <span class="text-white/60"
            >${translateText("ww1936.econ.export_room", { n: o.room })}</span
          >
        </span>
        ${this.stepper(
          translateText("ww1936.econ.factories", { n: civs }),
          `buy-${o.smallID}`,
          civs > 1,
          civs < max,
          (delta) => {
            const next = new Map(this.buyCivs);
            next.set(o.smallID, Math.max(1, Math.min(max, civs + delta)));
            this.buyCivs = next;
          },
        )}
        <button
          type="button"
          data-ww-open-trade=${o.smallID}
          class="${BUTTON} bg-emerald-800/70"
          ?disabled=${block !== null}
          @click=${() => {
            const seller = this.game.playerBySmallID(o.smallID);
            if (!seller.isPlayer()) return;
            this.send({
              kind: "open_trade",
              seller: seller.id(),
              resource,
              civs,
            });
          }}
        >
          ${translateText("ww1936.econ.open_trade")}
        </button>
      </div>
      ${this.blockLine(block)}
    </li>`;
  }

  private renderDeals(
    c: Ctx,
    deals: readonly WwTradeData[],
    kind: "buying" | "selling",
  ): TemplateResult | typeof nothing {
    if (deals.length === 0) return nothing;
    return html`<section data-ww-deals=${kind}>
      <div class=${HEADING}>
        ${translateText(
          kind === "buying" ? "ww1936.econ.my_deals" : "ww1936.econ.selling",
        )}
      </div>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        ${deals.map((t) => {
          const other = kind === "buying" ? t.seller : t.buyer;
          const key = `close_trade:${t.id}`;
          const armed = this.armed(key);
          return html`<li
            data-ww-deal=${t.id}
            class="flex min-h-9 items-center gap-2 text-xs"
          >
            <span class="flex min-w-0 flex-1 items-center gap-1 truncate">
              ${this.flag(other, c.scenario)} ${this.nameOf(other, c.scenario)}
              · ${RESOURCE_ICONS[t.resource]} ${resourceName(t.resource)}
            </span>
            <span class="tabular-nums text-white/70"
              >${translateText("ww1936.econ.factories", { n: t.civs })}</span
            >
            ${kind === "selling"
              ? nothing
              : html`<button
                  type="button"
                  data-ww-close-trade=${t.id}
                  data-armed=${String(armed)}
                  aria-label=${translateText("ww1936.econ.close_deal")}
                  class="${armed
                    ? "h-9 rounded-md bg-red-700 px-2 text-xs font-semibold"
                    : ICON_BUTTON}"
                  @click=${() =>
                    this.confirmTap(key, () =>
                      this.send({ kind: "close_trade", trade: t.id }),
                    )}
                >
                  ${armed ? translateText("ww1936.econ.close_trade") : "✕"}
                </button>`}
          </li>`;
        })}
      </ul>
    </section>`;
  }

  // ---- Manpower (P3 controller ruling R16: the laws moved to politics) ----

  private renderManpower(c: Ctx): TemplateResult {
    const s = c.summary;
    // P2 spec §13.2: the men in the field, in training and lost today.
    const land = this.game?.wwLand?.()?.countries.get(c.id) ?? null;
    const row = (key: string, value: string) =>
      html`<dt class="text-white/60">${translateText(key)}</dt>
        <dd class="m-0 text-right tabular-nums">${value}</dd>`;
    // The conscription law, read-only: a tap opens the politics law tab.
    const law = conscriptionLaw(this.game, c.id);
    return html`<section data-ww-manpower>
      <div class=${HEADING}>${translateText("ww1936.econ.manpower")}</div>
      <dl class="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        ${row("ww1936.econ.recruitable", menText(s.recruitable))}
        ${row("ww1936.econ.manpower", menText(s.manpower))}
        ${row("ww1936.econ.troops", menText(armyMenOf(c.me)))}
        ${row("ww1936.land.field_men", menText(land?.fieldMen ?? 0))}
        ${row("ww1936.land.training_men", menText(land?.trainingMen ?? 0))}
      </dl>
      <p data-ww-casualties class="m-0 mt-1 text-xs text-white/80">
        ${translateText("ww1936.pol.manpower.casualties", {
          n: menText(land?.casualtiesToday ?? 0),
        })}
      </p>
      ${law === null
        ? nothing
        : html`<button
            type="button"
            data-ww-conscription
            class="mt-2 flex min-h-9 w-full flex-col items-start rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-xs hover:bg-white/10"
            @click=${() => this.eventBus.emit(new OpenWwPoliticsEvent("laws"))}
          >
            <span class="font-semibold">${law}</span>
            <span class="text-white/60"
              >${translateText("ww1936.pol.manpower.open_laws")}</span
            >
          </button>`}
    </section>`;
  }
}
