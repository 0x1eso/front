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
import {
  IndustryDial,
  industryDial,
  researchDial,
  ResearchDialModel,
} from "./EconomyModel";
import { isCapitulated } from "./WorldWarModel";
import {
  OpenWwIndustryEvent,
  OpenWwResearchEvent,
  WwDrawerEvent,
  WwDrawerId,
} from "./WwDrawer";

export interface WwDialsModel {
  industry: IndustryDial;
  research: ResearchDialModel;
}

/**
 * World War 1936 P1 (spec §13.2): the 🏭 and 🔬 dials at the left of the
 * bottom HUD rows, where the domestic dials sit (this mode has none), with
 * their size and ring. 🏭: the first construction's progress, badge = idle
 * military factories. 🔬: the furthest slot, badge = empty slots, and it
 * glows while one is empty. Each opens its drawer; the open one is outlined.
 */
@customElement("ww-dials")
export class WwDials extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private model: WwDialsModel | null = null;
  @state() private shown: WwDrawerId | null = null;
  private modelKey = "";

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwDrawerEvent, (e) => {
      if (e.open) this.shown = e.drawer;
      else if (this.shown === e.drawer) this.shown = null;
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
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
    if (view === null || me === null || !me.isAlive()) return null;
    if (isCapitulated(this.game, me.smallID())) return null;
    const detail = view.detail(me.smallID());
    if (detail === null) return null;
    return {
      industry: industryDial(detail, view.summary(me.smallID())),
      research: researchDial(detail),
    };
  }

  render() {
    const m = this.model;
    if (m === null) return nothing;
    const i = m.industry;
    const r = m.research;
    return html`
      ${DIAL_STYLES}
      <div
        data-ww-dials
        class="flex items-start gap-1.5 px-1.5 py-1 text-white select-none"
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
      </div>
    `;
  }

  private renderDial(
    id: "industry" | "research",
    state: string,
    label: string,
    svg: TemplateResult,
    face: string,
    glow: DialColor | null,
    badge: TemplateResult | typeof nothing,
    open: () => void,
  ): TemplateResult {
    const pressed = this.shown === id;
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
