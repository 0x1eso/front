import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
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
  ringSvg,
} from "../domestic/Dial";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import { airDial, AirDialModel } from "./AirModel";
import {
  IndustryDial,
  industryDial,
  researchDial,
  ResearchDialModel,
} from "./EconomyModel";
import { armyDial, ArmyDialModel } from "./LandModel";
import { OpenWwArmyEvent } from "./LandSelection";
import { navyCtx, navyDial, NavyDialModel, NavyGame } from "./NavyModel";
import {
  diplomacyDial,
  focusDial,
  PolDial,
  politicsDial,
  politicsInput,
} from "./PoliticsModel";
import { WwAirLayerEvent } from "./SeaAirSelection";
import { today, wwActive } from "./WorldWarModel";
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
import { seaAirOf, WwSeaAirChangedEvent } from "./WwSeaAirController";

/**
 * P4 (spec §18.1): eight dials at the bottom left, two columns of four
 * rows (size-11, 8 px apart, about 208 px tall) on every screen — one
 * column of eight would not fit a landscape phone.
 */
export const WW_DIAL_COLS = 2;
export const WW_DIAL_ROWS = 4;
/** size-11 and gap-2, in CSS px. */
export const WW_DIAL_SIZE_PX = 44;
export const WW_DIAL_GAP_PX = 8;
/** The grid's own padding, top and bottom (py-1). */
export const WW_DIAL_PAD_PX = 4;
/** The block of eight dials, in CSS px. */
export const WW_DIAL_BLOCK_PX =
  WW_DIAL_ROWS * WW_DIAL_SIZE_PX +
  (WW_DIAL_ROWS - 1) * WW_DIAL_GAP_PX +
  2 * WW_DIAL_PAD_PX;
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
  /** The air layer is on (the ✈ dial is pressed). */
  airLayer: boolean;
  /** The sea layer is on. */
  seaLayer: boolean;
  /**
   * A short landscape screen: the 208 px block rises out of the bottom
   * rows instead of making them tall, so the drawers above the rows keep
   * their height (the cards keep right of it, WwArmyCard.cardPlace).
   */
  compact: boolean;
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
  private modelKey = "";
  private inputsSeen = "";
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private held = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwDrawerEvent, (e) => {
      if (e.open) this.shown = e.drawer;
      else if (this.shown === e.drawer) this.shown = null;
    });
    // The air layer is switched on the map too (a zone row, Back).
    this.eventBus.on(WwSeaAirChangedEvent, () => this.tick());
  }

  getTickIntervalMs() {
    return 250;
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
      seaAirOf(g).selection.version,
      today(g),
      me?.smallID() ?? 0,
      me?.isAlive() ?? false,
      data?.wars.length ?? 0,
      data?.capitulated.length ?? 0,
      window.innerHeight <= COMPACT_MAX_HEIGHT,
    ].join("|");
  }

  tick() {
    if (!this.game?.worldWarScenario()) return;
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
          : navyDial(
              ctx,
              dayStartTick(
                ctx.day,
                this.game.worldWarData()?.prepEndTick ?? WW_PREP_TICKS,
              ),
            ),
      air: ctx === null ? null : airDial(ctx),
      airLayer: seaAirOf(this.game).selection.layer === "air",
      seaLayer: seaAirOf(this.game).selection.layer === "sea",
      compact: window.innerHeight <= COMPACT_MAX_HEIGHT,
    };
  }

  render() {
    const m = this.model;
    if (m === null) return nothing;
    const i = m.industry;
    const r = m.research;
    const grid = html`<div
      data-ww-dials
      data-cols=${WW_DIAL_COLS}
      data-compact=${String(m.compact)}
      class="grid grid-cols-2 items-start gap-2 px-1.5 py-1 text-white select-none ${m.compact
        ? "absolute bottom-0 left-0 rounded-t-lg bg-gray-800/92"
        : ""}"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${this.renderDial(
        "industry",
        i.queued > 0 ? "building" : "idle",
        translateText("ww1936.econ.industry"),
        ringSvg(i.progress, i.queued > 0 ? "victory" : "grey"),
        "🏭",
        null,
        i.idle > 0
          ? this.badge(
              "idle",
              i.idle,
              "bg-amber-400 text-gray-900",
              translateText("ww1936.econ.idle_factories", { n: i.idle }),
            )
          : nothing,
        () => this.eventBus.emit(new OpenWwIndustryEvent()),
      )}
      ${this.renderDial(
        "research",
        r.free > 0 ? "free" : "running",
        translateText("ww1936.econ.research"),
        ringSvg(r.free > 0 && r.running === 0 ? 1 : r.progress, "science"),
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
      ${this.renderPolitics(m)} ${this.renderSeaAir(m)}
    </div>`;
    // The footprint the rows keep: one row of dials.
    return html`${DIAL_STYLES}
    ${m.compact
      ? html`<div
          data-ww-dials-slot
          class="relative"
          style="width: ${WW_DIAL_COLS * WW_DIAL_SIZE_PX +
          WW_DIAL_GAP_PX +
          12}px; height: ${WW_DIAL_SIZE_PX + 2 * WW_DIAL_PAD_PX}px"
        >
          ${grid}
        </div>`
      : grid}`;
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
      ringSvg(n?.progress ?? 0, "science"),
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
      ringSvg(a?.progress ?? 0, "victory"),
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
          ringSvg(f.progress, "victory"),
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
          ringSvg(p.progress, "political"),
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
          ringSvg(d.progress, "cooldown"),
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
      ringSvg(a.progress, a.training > 0 ? "victory" : "grey"),
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
    id: WwDrawerId,
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
      class="relative size-11 shrink-0 rounded-full ${glow === null
        ? ""
        : DIAL_GLOW_CLASS} ${pressed
        ? "outline-2 outline-offset-1 outline-white/80"
        : ""}"
      style="--dial-glow: ${DIAL_COLORS[glow ?? "grey"].glow}"
      @click=${open}
      @pointerdown=${down ?? nothing}
      @pointerup=${up ?? nothing}
      @pointerleave=${up ?? nothing}
      @pointercancel=${up ?? nothing}
    >
      <span class="absolute inset-0 rounded-full">
        ${svg}
        <span
          class="relative flex h-full w-full items-center justify-center text-lg leading-none"
          >${face}</span
        >
      </span>
      ${badge}
    </button>`;
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
      class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 ${colors} ring-1 ring-gray-900 text-[10px] font-black leading-none tabular-nums"
      >${n}</span
    >`;
  }
}
