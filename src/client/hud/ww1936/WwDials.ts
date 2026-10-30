import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  DIAL_COLORS,
  DIAL_GLOW_CLASS,
  DIAL_STYLES,
  DialColor,
} from "../domestic/Dial";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import { airDial, AirDialModel } from "./AirModel";
import { WwDepthOpenEvent } from "./DepthEvents";
import { DoctrineDial, DoctrineModel, IntelDial } from "./DoctrineModel";
import {
  IndustryDial,
  industryDial,
  researchDial,
  ResearchDialModel,
} from "./EconomyModel";
import { armyDial, ArmyDialModel } from "./LandModel";
import { OpenWwArmyEvent, WwLandModeEvent } from "./LandSelection";
import { navyCtx, navyDial, NavyDialModel, NavyGame } from "./NavyModel";
import {
  diplomacyDial,
  focusDial,
  PolDial,
  politicsDial,
  politicsInput,
} from "./PoliticsModel";
import { WwAirLayerEvent } from "./SeaAirSelection";
import { autoMaskOf } from "./WwAutoUi";
import { prepEndTick, today, wwActive } from "./WorldWarModel";
import {
  OpenWwAirEvent,
  OpenWwDiplomacyEvent,
  OpenWwIndustryEvent,
  OpenWwNavyEvent,
  OpenWwPoliticsEvent,
  OpenWwResearchEvent,
  WwDrawerEvent,
  WwDrawerId,
} from "./WwDrawer";
import { OpenWwFocusEvent } from "./WwFocusPanel";
import { WwLandChangedEvent } from "./WwLandController";
import { WwStrikeFlowChangedEvent } from "./WwNukeFlow";
import {
  WwClosePanelEvent,
  wwMapFlowActive,
  WwPanelMinimizedEvent,
} from "./WwPanelMode";
import {
  seaAirOf,
  WwSeaAirChangedEvent,
  WwSeaAirModeEvent,
} from "./WwSeaAirController";

/**
 * The dock: ten buttons (industry, research, army, focus, politics,
 * diplomacy, navy, air, doctrine, intel) in one slim row right above the
 * troop bar. It scrolls sideways when it does not fit. A button opens its
 * drawer as a full-screen panel (WwDrawerBase.renderFrame).
 */
export const WW_DIAL_COUNT = 10;
/** The row's height in CSS px: 40 on a landscape phone, 44 elsewhere. */
export function dockHeightPx(compact: boolean): number {
  return compact ? 40 : 44;
}
/** A progress bar along a button's foot (0..1), tests read data-progress. */
function progressBar(progress: number, color: DialColor): TemplateResult {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return html`<span
    class="pointer-events-none absolute inset-x-1.5 bottom-0.5 h-0.5 overflow-hidden rounded bg-white/15"
    aria-hidden="true"
    ><span
      data-ring
      data-progress=${p.toFixed(2)}
      class="block h-full rounded"
      style="width: ${Math.round(p * 100)}%; background: ${DIAL_COLORS[color]
        .stroke}"
    ></span
  ></span>`;
}
/** A press this long on ✈ opens the air drawer (spec §18.1). */
export const WW_DIAL_HOLD_MS = 500;

export interface WwDialsModel {
  industry: IndustryDial;
  research: ResearchDialModel;
  /** P2 (spec §15.1); null before the land war's first update. */
  army: ArmyDialModel | null;
  /** P3 (spec §21.2); null before my country's first politics detail. */
  focus: PolDial | null;
  politics: PolDial | null;
  diplomacy: PolDial | null;
  /** P4 (spec §18.1); null before the navy and air views have my data. */
  navy: NavyDialModel | null;
  air: AirDialModel | null;
  /** P6 (spec §20.2); null before my depth data. */
  doctrine: DoctrineDial | null;
  intel: IntelDial | null;
  /** The air layer is on (the ✈ dial is pressed). */
  airLayer: boolean;
  /** The sea layer is on. */
  seaLayer: boolean;
  /** A short landscape screen (a phone): the row is 40 px tall. */
  compact: boolean;
  /** Automation: my switches (WW_AUTO_DOMAINS bits); the 🏭 says "자동" while any is on. */
  auto: number;
}

/**
 * World War 1936 P1 (spec §13.2): the 🏭 and 🔬 dials at the left of the
 * bottom HUD rows, where the domestic dials sit (this mode has none), with
 * their size and ring. 🏭: the first construction's progress, badge = idle
 * military factories. 🔬: the furthest slot, badge = empty slots, and it
 * glows while one is empty. P2's ⚔: the first division in training, badge
 * = my armies in battle (red; blinking while one is encircled). P3 (spec
 * §21.2): 🎯 the running focus (glows with none), 🏛 political power
 * towards the next advisor (badge = decisions I can take), 🌐 the running
 * justification (badge = requests and events waiting). Two columns of
 * three rows; three columns of two on a short landscape screen. Each opens
 * its drawer; the open one is outlined.
 */
@customElement("ww-dials")
export class WwDials extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private model: WwDialsModel | null = null;
  @state() private shown: WwDrawerId | null = null;
  /** A map flow is on: the open panel stands aside, the chip brings it back. */
  @state() private minimized = false;
  private flowOn = false;
  private rowsObserver: ResizeObserver | null = null;
  private modelKey = "";
  private inputsSeen = "";
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private held = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwDrawerEvent, (e) => {
      if (e.open) {
        this.shown = e.drawer;
        this.minimized = false;
      } else if (this.shown === e.drawer) {
        this.shown = null;
        this.minimized = false;
      }
      this.place();
    });
    // Esc closes the open panel (before the map's own Esc), not a minimised one.
    window.addEventListener("keydown", this.onKey, true);
    this.flowOn = wwMapFlowActive(this.game);
    this.eventBus.on(WwLandModeEvent, () => this.checkFlow());
    this.eventBus.on(WwSeaAirModeEvent, () => this.checkFlow());
    this.eventBus.on(WwStrikeFlowChangedEvent, () => this.checkFlow());
    this.eventBus.on(WwLandChangedEvent, () => this.checkFlow());
    // The air layer is switched on the map too (a zone row, Back).
    this.eventBus.on(WwSeaAirChangedEvent, () => this.tick());
  }

  getTickIntervalMs() {
    return 250;
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || this.shown === null || this.minimized) return;
    e.stopPropagation();
    this.eventBus.emit(new WwClosePanelEvent());
  };

  /**
   * A map flow began while a panel is open: the panel steps aside; when the
   * flow ends it returns. A flow already on when a panel opens leaves it be.
   */
  private checkFlow() {
    const on = wwMapFlowActive(this.game);
    if (on === this.flowOn) return;
    this.flowOn = on;
    if (on && this.shown !== null && !this.minimized) {
      this.setMinimized(true);
    } else if (!on && this.minimized) {
      this.setMinimized(false);
    }
  }

  private setMinimized(minimized: boolean) {
    this.minimized = minimized;
    this.eventBus.emit(new WwPanelMinimizedEvent(minimized));
    this.place();
  }

  connectedCallback() {
    super.connectedCallback();
    if (typeof ResizeObserver === "undefined") return;
    const rows = document.querySelector("[data-bottom-hud-rows]");
    if (rows === null) return;
    this.rowsObserver = new ResizeObserver(() => this.place());
    this.rowsObserver.observe(rows);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKey, true);
    this.rowsObserver?.disconnect();
    this.rowsObserver = null;
    document.documentElement.style.removeProperty("--ww-dock-h");
  }

  /**
   * The dock stands right above the troop bar (the bottom HUD's rows); with
   * a panel open it drops to the screen's foot, over the panel. The
   * bottom HUD keeps a spacer of its height (--ww-dock-h).
   */
  private place() {
    const m = this.model;
    const root = document.documentElement.style;
    if (m === null) {
      root.removeProperty("--ww-dock-h");
      return;
    }
    root.setProperty("--ww-dock-h", `${dockHeightPx(m.compact)}px`);
    const rows = document.querySelector("[data-bottom-hud-rows]");
    const top = rows?.getBoundingClientRect().top ?? 0;
    const above = rows === null || top <= 0 ? 0 : window.innerHeight - top;
    this.style.bottom =
      this.shown !== null
        ? "env(safe-area-inset-bottom)"
        : `${Math.max(0, above)}px`;
  }

  updated() {
    this.place();
  }

  /**
   * Rebuild only when something the dials read moved: the views'
   * versions, the shared sea-air choice, the day, the wars, my country,
   * the screen's class (not every 250 ms).
   */
  private inputsKey(): string {
    const g = this.game;
    const me = g.myPlayer();
    const data = g.worldWarData();
    return [
      g.wwEconomy?.()?.version,
      g.wwLand?.()?.version,
      g.wwPolitics?.()?.version,
      g.wwNavy?.()?.version,
      g.wwAir?.()?.version,
      g.wwDepth?.()?.version,
      seaAirOf(g).selection.version,
      today(g),
      me?.smallID() ?? 0,
      me?.isAlive() ?? false,
      data?.wars.length ?? 0,
      data?.capitulated.length ?? 0,
      window.innerHeight <= COMPACT_MAX_HEIGHT,
      autoMaskOf(g, me?.smallID() ?? 0),
    ].join("|");
  }

  tick() {
    if (!this.game?.worldWarScenario()) return;
    this.checkFlow();
    const inputs = this.inputsKey();
    if (inputs === this.inputsSeen) return;
    this.inputsSeen = inputs;
    const next = this.buildModel();
    const key = next === null ? "" : JSON.stringify(next);
    if (key === this.modelKey) return;
    this.modelKey = key;
    this.model = next;
  }

  private buildModel(): WwDialsModel | null {
    if (!this.game?.worldWarScenario()) return null;
    const view = this.game.wwEconomy?.() ?? null;
    const me = this.game.myPlayer();
    // Spectators, the dead and the capitulated have nothing to run
    // (pre-flight R7.4; the engine refuses their orders).
    // P5 pre-flight §0-1: an exile still runs its country.
    if (view === null || me === null) return null;
    if (!wwActive(this.game, me.smallID())) return null;
    const detail = view.detail(me.smallID());
    if (detail === null) return null;
    const land = this.game.wwLand?.() ?? null;
    const pol = politicsInput(this.game);
    const ctx = navyCtx(this.game as unknown as NavyGame);
    return {
      industry: industryDial(detail, view.summary(me.smallID())),
      research: researchDial(detail),
      army: land === null ? null : armyDial(land, me.smallID()),
      focus: pol === null ? null : focusDial(pol),
      politics: pol === null ? null : politicsDial(pol),
      diplomacy: pol === null ? null : diplomacyDial(pol),
      navy:
        ctx === null
          ? null
          : navyDial(ctx, dayStartTick(ctx.day, prepEndTick(this.game))),
      air: ctx === null ? null : airDial(ctx),
      doctrine: new DoctrineModel(this.game).dial(),
      intel: new DoctrineModel(this.game).intelDial(),
      airLayer: seaAirOf(this.game).selection.layer === "air",
      seaLayer: seaAirOf(this.game).selection.layer === "sea",
      compact: window.innerHeight <= COMPACT_MAX_HEIGHT,
      auto: autoMaskOf(this.game, me.smallID()),
    };
  }

  render() {
    const m = this.model;
    if (m === null) return nothing;
    const i = m.industry;
    const r = m.research;
    const grid = html`<nav
      data-ww-dials
      data-ww-dock
      data-compact=${String(m.compact)}
      aria-label=${translateText("ww1936.dock.label")}
      class="pointer-events-auto flex w-full items-stretch gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-t-lg bg-gray-800/95 px-1 text-white select-none"
      style="height: ${dockHeightPx(m.compact)}px"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${this.renderDial(
        "industry",
        i.queued > 0 ? "building" : "idle",
        translateText("ww1936.econ.industry"),
        progressBar(i.progress, i.queued > 0 ? "victory" : "grey"),
        "🏭",
        null,
        html`${i.idle > 0
          ? this.badge(
              "idle",
              i.idle,
              "bg-amber-400 text-gray-900",
              translateText("ww1936.econ.idle_factories", { n: i.idle }),
            )
          : nothing}${m.auto !== 0 ? this.autoBadge() : nothing}`,
        () => this.eventBus.emit(new OpenWwIndustryEvent()),
      )}
      ${this.renderDial(
        "research",
        r.free > 0 ? "free" : "running",
        translateText("ww1936.econ.research"),
        progressBar(r.free > 0 && r.running === 0 ? 1 : r.progress, "science"),
        "🔬",
        r.free > 0 ? "science" : null,
        r.free > 0
          ? this.badge(
              "free",
              r.free,
              "bg-yellow-300 text-gray-900",
              translateText("ww1936.econ.free_slots", { n: r.free }),
            )
          : nothing,
        () => this.eventBus.emit(new OpenWwResearchEvent()),
      )}
      ${m.army === null ? nothing : this.renderArmy(m.army)}
      ${this.renderPolitics(m)} ${this.renderSeaAir(m)} ${this.renderDepth(m)}
    </nav>`;
    const chip =
      this.minimized && this.shown !== null
        ? html`<button
            type="button"
            data-ww-panel-chip
            class="pointer-events-auto absolute bottom-full right-2 mb-1 h-9 rounded-full border border-white/20 bg-gray-900/95 px-3 text-xs font-semibold text-white shadow-lg"
            @click=${() => this.setMinimized(false)}
          >
            ↩ ${translateText("ww1936.dock.back_to_panel")}
          </button>`
        : nothing;
    return html`${DIAL_STYLES}
      <div class="relative w-full">${chip}${grid}</div>`;
  }

  /**
   * P4 (spec §18.1): ⚓ — the ring is the first naval line's progress, the
   * badge my fleets in battle (red) or else the ships I lost today; a tap
   * opens the navy drawer and the sea layer. ✈ — the ring is my air
   * control over my capital's zone, the badge my front zones under 50%; a
   * tap switches the air layer, a long press opens the air drawer.
   */
  private renderSeaAir(m: WwDialsModel): TemplateResult {
    const n = m.navy;
    const a = m.air;
    const navy = this.renderDial(
      "navy",
      n !== null && n.battle > 0 ? "battle" : "idle",
      (n === null
        ? translateText("ww1936.navy.dial_navy")
        : `${translateText("ww1936.navy.dial_navy")}: ${translateText(
            "ww1936.navy.dial_line",
            { pct: Math.round(n.progress * 100) },
          )}`) + (m.seaLayer ? ` · ${translateText("ww1936.navy.layer")}` : ""),
      progressBar(n?.progress ?? 0, "science"),
      "⚓",
      null,
      n === null
        ? nothing
        : n.battle > 0
          ? this.badge(
              "battle",
              n.battle,
              "bg-red-600 text-white",
              translateText("ww1936.navy.dial_battle", { n: n.battle }),
            )
          : n.lost > 0
            ? this.badge(
                "lost",
                n.lost,
                "bg-amber-400 text-gray-900",
                translateText("ww1936.navy.dial_lost", { n: n.lost }),
              )
            : nothing,
      () => this.eventBus.emit(new OpenWwNavyEvent()),
    );
    const air = this.renderDial(
      "air",
      m.airLayer ? "layer" : "idle",
      (a === null
        ? translateText("ww1936.air.dial_air")
        : `${translateText("ww1936.air.dial_air")}: ${translateText(
            "ww1936.air.dial_sup",
            { pct: Math.floor(a.supPm / 10) },
          )}`) + (m.airLayer ? ` · ${translateText("ww1936.air.layer")}` : ""),
      progressBar(a?.progress ?? 0, "victory"),
      "✈",
      null,
      a !== null && a.low > 0
        ? this.badge(
            "low",
            a.low,
            "bg-red-600 text-white",
            translateText("ww1936.air.dial_low", { n: a.low }),
          )
        : nothing,
      () => {
        // The long press already opened the drawer.
        if (this.held) {
          this.held = false;
          return;
        }
        this.eventBus.emit(new WwAirLayerEvent(!m.airLayer));
      },
      m.airLayer,
      () => this.holdStart(),
      () => this.holdEnd(),
    );
    return html`${navy} ${air}`;
  }

  /**
   * P6 (spec §20.2): 🎖 doctrine — the ring is the lowest army track's way
   * to its next level; the badge glows with unpicked doctrines, else counts
   * the trait slots you could fill. 🕵 intel — the running upgrade; a red
   * badge for captured operatives, else the idle ones. The intel drawer is
   * lane U3's: the dial only asks for it.
   */
  private renderDepth(m: WwDialsModel): TemplateResult {
    const d = m.doctrine;
    const i = m.intel;
    return html`${d === null
      ? nothing
      : this.renderDial(
          "doctrine",
          d.glow ? "unpicked" : "idle",
          translateText("ww1936.doctrine.dial"),
          progressBar(d.progress, "science"),
          "🎖",
          d.glow ? "victory" : null,
          d.badge === null
            ? nothing
            : this.badge(
                d.badge.kind,
                d.badge.n,
                d.badge.kind === "unpicked"
                  ? "bg-yellow-300 text-gray-900"
                  : "bg-amber-400 text-gray-900",
                translateText(
                  d.badge.kind === "unpicked"
                    ? "ww1936.doctrine.badge_unpicked"
                    : "ww1936.doctrine.badge_points",
                  { n: d.badge.n },
                ),
              ),
          () => this.eventBus.emit(new WwDepthOpenEvent("doctrine")),
        )}
    ${i === null
      ? nothing
      : this.renderDial(
          "intel",
          i.badge?.kind ?? "idle",
          translateText("ww1936.intel.dial"),
          progressBar(i.progress, "cooldown"),
          "🕵",
          null,
          i.badge === null
            ? nothing
            : this.badge(
                i.badge.kind,
                i.badge.n,
                i.badge.kind === "captured"
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-900",
                translateText(
                  i.badge.kind === "captured"
                    ? "ww1936.intel.badge_captured"
                    : "ww1936.intel.badge_idle",
                  { n: i.badge.n },
                ),
              ),
          () => this.eventBus.emit(new WwDepthOpenEvent("intel")),
        )}`;
  }

  private holdStart() {
    this.holdEnd();
    this.held = false;
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.held = true;
      this.eventBus.emit(new OpenWwAirEvent());
    }, WW_DIAL_HOLD_MS);
  }

  private holdEnd() {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  /** P3 (spec §21.2): 🎯 focus, 🏛 politics, 🌐 diplomacy. */
  private renderPolitics(m: WwDialsModel): TemplateResult {
    const f = m.focus;
    const p = m.politics;
    const d = m.diplomacy;
    return html`${f === null
      ? nothing
      : this.renderDial(
          "focus",
          f.glow ? "idle" : "running",
          `${translateText("ww1936.pol.dial.focus")}: ${f.label}`,
          progressBar(f.progress, "victory"),
          "🎯",
          f.glow ? "victory" : null,
          nothing,
          () => this.eventBus.emit(new OpenWwFocusEvent()),
        )}
    ${p === null
      ? nothing
      : this.renderDial(
          "politics",
          p.badge > 0 ? "decisions" : "idle",
          `${translateText("ww1936.pol.dial.politics")}: ${p.label}`,
          progressBar(p.progress, "political"),
          "🏛",
          null,
          p.badge > 0
            ? this.badge(
                "decisions",
                p.badge,
                "bg-violet-400 text-gray-900",
                p.badgeLabel,
              )
            : nothing,
          () => this.eventBus.emit(new OpenWwPoliticsEvent()),
        )}
    ${d === null
      ? nothing
      : this.renderDial(
          "diplomacy",
          d.badge > 0 ? "waiting" : "idle",
          d.label === ""
            ? translateText("ww1936.pol.dial.diplomacy")
            : `${translateText("ww1936.pol.dial.diplomacy")}: ${d.label}`,
          progressBar(d.progress, "cooldown"),
          "🌐",
          null,
          d.badge > 0
            ? this.badge(
                "waiting",
                d.badge,
                "bg-red-600 text-white",
                d.badgeLabel,
              )
            : nothing,
          () => this.eventBus.emit(new OpenWwDiplomacyEvent()),
        )}`;
  }

  private renderArmy(a: ArmyDialModel): TemplateResult {
    return this.renderDial(
      "army",
      a.encircled > 0 ? "encircled" : a.fighting > 0 ? "fighting" : "idle",
      translateText("ww1936.land.dial"),
      progressBar(a.progress, a.training > 0 ? "victory" : "grey"),
      "⚔",
      null,
      a.encircled > 0
        ? this.badge(
            "encircled",
            a.encircled,
            "bg-red-600 text-white animate-pulse",
            translateText("ww1936.land.state_encircled"),
          )
        : a.fighting > 0
          ? this.badge(
              "fighting",
              a.fighting,
              "bg-red-600 text-white",
              translateText("ww1936.land.state_battle", { n: a.fighting }),
            )
          : nothing,
      () => this.eventBus.emit(new OpenWwArmyEvent()),
    );
  }

  private renderDial(
    id: WwDrawerId | "intel",
    state: string,
    label: string,
    svg: TemplateResult,
    face: string,
    glow: DialColor | null,
    badge: TemplateResult | typeof nothing,
    open: () => void,
    alsoPressed = false,
    down: (() => void) | null = null,
    up: (() => void) | null = null,
  ): TemplateResult {
    const pressed = this.shown === id || alsoPressed;
    return html`<button
      type="button"
      data-ww-dial=${id}
      data-state=${state}
      aria-label=${label}
      aria-pressed=${String(pressed)}
      class="relative flex h-full min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-2 pb-1 ${glow ===
      null
        ? ""
        : DIAL_GLOW_CLASS} ${pressed
        ? "bg-white/20 outline-2 outline-offset-[-2px] outline-white/80"
        : "hover:bg-white/10"}"
      style="--dial-glow: ${DIAL_COLORS[glow ?? "grey"].glow}"
      @click=${open}
      @pointerdown=${down ?? nothing}
      @pointerup=${up ?? nothing}
      @pointerleave=${up ?? nothing}
      @pointercancel=${up ?? nothing}
    >
      <span class="text-base leading-none" aria-hidden="true">${face}</span>
      <span
        class="max-w-16 truncate text-[10px] leading-none text-white/80"
        aria-hidden="true"
        >${translateText(`ww1936.dock.${id}`)}</span
      >
      ${svg} ${badge}
    </button>`;
  }

  /** Automation: a small "자동" tag on the 🏭 while any switch is on. */
  private autoBadge(): TemplateResult {
    return html`<span
      data-dial-badge="auto"
      aria-label=${translateText("ww1936.auto.badge_label")}
      class="absolute left-0 top-0 flex h-3.5 items-center rounded-full bg-emerald-400 px-1 text-[9px] font-black leading-none text-gray-900 ring-1 ring-gray-900"
      >${translateText("ww1936.auto.badge")}</span
    >`;
  }

  private badge(
    kind: string,
    n: number,
    colors: string,
    label: string,
  ): TemplateResult {
    return html`<span
      data-dial-badge=${kind}
      aria-label=${label}
      class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 ${colors} ring-1 ring-gray-900 text-[10px] font-black leading-none tabular-nums"
      >${n}</span
    >`;
  }
}
