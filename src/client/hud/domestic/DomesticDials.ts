import {
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SetRecruitTargetIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import {
  congressDial,
  CongressDialModel,
  viewerOf,
} from "../congress/CongressModel";
import {
  clockSvg,
  DIAL_COLORS,
  DIAL_GLOW_CLASS,
  DIAL_STYLES,
  DialColor,
  ringSvg,
} from "./Dial";
import {
  DomesticScreen,
  DomesticScreenShownEvent,
  OpenDomesticScreenEvent,
} from "./DomesticEvents";
import {
  LawsDial,
  lawsDial,
  ResearchDial,
  researchDial,
  TECH_ICONS,
  VictoryDial,
  victoryDial,
} from "./DomesticStatus";

/** Ticks to wait for the engine to apply a recruit target before giving up. */
const PENDING_TARGET_TICKS = 30;

/** Everything the dials draw; rebuilt each tick, redrawn only when it changes. */
export interface DialsModel {
  research: ResearchDial;
  laws: LawsDial;
  victory: VictoryDial | null;
  /** The 🏛 dial (world congress); null without the congress. */
  congress: CongressDialModel | null;
  sciencePerSec: number;
  politicalPerSec: number;
  recruitTargetPct: number;
}

interface DialSpec {
  screen: DomesticScreen;
  /** data-state, for tests and styling hooks. */
  state: string;
  svg: TemplateResult;
  face: TemplateResult;
  /** Glow and slow pulse in this colour: there is something to do. */
  glow: DialColor | null;
  /** Greyed out: nothing to do yet. */
  dim: boolean;
  badges: TemplateResult | typeof nothing;
  /** Small text under the dial. */
  caption: TemplateResult | typeof nothing;
}

/**
 * The domestic dials at the left of the bottom HUD (spec §14d, after
 * Frostpunk's Book of Laws button): research, laws and, once a victory
 * project opens, a trophy; in world-congress games, the 🏛 dial last. Each
 * opens its screen in the domestic drawer. Under them, the recruit-target chip with its slider.
 */
@customElement("domestic-dials")
export class DomesticDials extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private model: DialsModel | null = null;
  /** The drawer's open screen: its dial is outlined. */
  @state() private shown: DomesticScreen | null = null;
  @state() private recruitOpen = false;
  /** Slider value while the intent round-trips. */
  @state() private pendingTarget: number | null = null;
  private pendingTicks = 0;
  private modelKey = "";

  private readonly closeOnOutsideTap = (e: Event) => {
    if (!(e.target instanceof Node) || !this.contains(e.target)) {
      this.setRecruitOpen(false);
    }
  };

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(DomesticScreenShownEvent, (e) => {
      this.shown = e.screen;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("pointerdown", this.closeOnOutsideTap);
  }

  tick() {
    if (this.pendingTicks > 0 && --this.pendingTicks === 0) {
      this.pendingTarget = null;
    }
    const next = this.buildModel();
    const prevPct = this.model?.recruitTargetPct;
    if (
      next !== null &&
      this.pendingTarget !== null &&
      (next.recruitTargetPct === this.pendingTarget ||
        next.recruitTargetPct !== prevPct)
    ) {
      this.pendingTarget = null;
    }
    const key = next === null ? "" : JSON.stringify(next);
    if (key === this.modelKey) return;
    this.modelKey = key;
    this.model = next;
    if (next === null) this.setRecruitOpen(false);
  }

  private buildModel(): DialsModel | null {
    const me = this.game?.myPlayer();
    if (!me || !me.isAlive() || this.game.inSpawnPhase()) return null;
    const view = me.domestic();
    if (view === null) return null;
    const d = view.data;
    return {
      research: researchDial(d),
      laws: lawsDial(view, this.game.ticks()),
      victory: victoryDial(d, me, this.game.config().hasInfiniteGold(me)),
      congress: this.congressModel(),
      sciencePerSec: d.sciencePerSec,
      politicalPerSec: d.politicalPerSec,
      recruitTargetPct: d.recruitTargetPct,
    };
  }

  /** World congress (spec §12): the 🏛 dial's model; null without the congress. */
  private congressModel(): CongressDialModel | null {
    if (!this.game.config().congress()) return null;
    const data = this.game.congressData();
    const viewer = viewerOf(this.game);
    if (data === null || viewer === null) return null;
    return congressDial(data, viewer, this.game.ticks());
  }

  private setRecruitOpen(open: boolean) {
    this.recruitOpen = open;
    document.removeEventListener("pointerdown", this.closeOnOutsideTap);
    if (open) document.addEventListener("pointerdown", this.closeOnOutsideTap);
  }

  private onTargetInput(e: Event) {
    this.pendingTarget = Number((e.target as HTMLInputElement).value);
  }

  private onTargetChange(e: Event) {
    const pct = Number((e.target as HTMLInputElement).value);
    if (pct === this.model?.recruitTargetPct) {
      this.pendingTarget = null;
      this.pendingTicks = 0;
      return;
    }
    this.pendingTarget = pct;
    this.pendingTicks = PENDING_TARGET_TICKS;
    this.eventBus.emit(new SetRecruitTargetIntentEvent(pct));
  }

  render() {
    const m = this.model;
    if (m === null) return nothing;
    const dials = [this.researchSpec(m), this.lawsSpec(m)];
    if (m.victory !== null) dials.push(this.victorySpec(m.victory));
    if (m.congress !== null) dials.push(this.congressSpec(m.congress));
    return html`
      ${DIAL_STYLES}
      <div
        data-domestic-dials
        class="relative flex flex-col items-start gap-1 px-1.5 py-1 text-white select-none"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div class="flex items-start gap-1.5">
          ${dials.map((spec) => this.renderDial(spec))}
        </div>
        ${this.renderRecruit(m)}
      </div>
    `;
  }

  private renderDial(spec: DialSpec): TemplateResult {
    const pressed = this.shown === spec.screen;
    const glow = spec.glow === null ? "" : DIAL_GLOW_CLASS;
    return html`<div class="flex flex-col items-center gap-0.5 w-11">
      <button
        type="button"
        data-dial=${spec.screen}
        data-state=${spec.state}
        aria-label=${translateText(`domestic.screen.${spec.screen}`)}
        aria-pressed=${String(pressed)}
        class="relative size-11 shrink-0 rounded-full ${glow} ${pressed
          ? "outline-2 outline-offset-1 outline-white/80"
          : ""}"
        style="--dial-glow: ${DIAL_COLORS[spec.glow ?? "grey"].glow}"
        @click=${() =>
          this.eventBus.emit(new OpenDomesticScreenEvent(spec.screen))}
      >
        <span
          class="absolute inset-0 rounded-full ${spec.dim
            ? "grayscale opacity-70"
            : ""}"
        >
          ${spec.svg}
          <span
            class="relative flex flex-col items-center justify-center w-full h-full leading-none"
            >${spec.face}</span
          >
        </span>
        ${spec.badges}
      </button>
      ${spec.caption}
    </div>`;
  }

  private researchSpec(m: DialsModel): DialSpec {
    const r = m.research;
    const caption = this.rate(m.sciencePerSec, "text-sky-300");
    const queued =
      r.queued === null
        ? nothing
        : html`<span
            data-dial-queued
            aria-label=${translateText("domestic.dial.queued", {
              tech: translateText(`domestic.tech.${r.queued}.name`),
            })}
            class="absolute -bottom-0.5 -right-1 size-4 flex items-center justify-center rounded-full bg-sky-700 ring-1 ring-gray-900 text-[9px] leading-none"
            >${TECH_ICONS[r.queued]}</span
          >`;
    switch (r.kind) {
      case "researching":
        return {
          screen: "research",
          state: "researching",
          svg: ringSvg(r.progress, "science"),
          face: html`<span class="text-sm">${TECH_ICONS[r.tech!]}</span>
            <span data-dial-seconds class="text-[10px] font-bold tabular-nums"
              >${translateText("domestic.dial.seconds", {
                seconds: r.secondsLeft ?? 0,
              })}</span
            >`,
          glow: null,
          dim: false,
          badges: queued,
          caption,
        };
      case "available":
        return {
          screen: "research",
          state: "available",
          svg: ringSvg(1, "science"),
          face: html`<span class="text-lg">🔬</span>`,
          glow: "science",
          dim: false,
          badges: html`${this.alertBadge("bg-yellow-300 text-gray-900")}
          ${queued}`,
          caption,
        };
      case "short":
      case "none":
        return {
          screen: "research",
          state: r.kind,
          svg: ringSvg(r.progress, "grey"),
          face: html`<span class="text-lg">🔬</span>`,
          glow: null,
          dim: true,
          badges: queued,
          caption,
        };
    }
  }

  private lawsSpec(m: DialsModel): DialSpec {
    const l = m.laws;
    const caption = this.rate(m.politicalPerSec, "text-violet-300");
    const government = l.government
      ? html`<span
          data-dial-badge="government"
          aria-label=${translateText("domestic.dial.government")}
          class="absolute -top-1 -right-1 size-4 flex items-center justify-center rounded-full bg-violet-500 ring-1 ring-gray-900 text-[9px] leading-none"
          >👑</span
        >`
      : nothing;
    switch (l.kind) {
      case "cooldown":
        return {
          screen: "laws",
          state: "cooldown",
          svg: clockSvg(l.progress, "cooldown"),
          face: html`<span
            data-dial-seconds
            class="text-[11px] font-bold tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]"
            >${translateText("domestic.dial.seconds", {
              seconds: l.seconds ?? 0,
            })}</span
          >`,
          glow: null,
          dim: false,
          badges: government,
          caption,
        };
      case "available":
        return {
          screen: "laws",
          state: "available",
          svg: ringSvg(1, "political"),
          face: html`<span class="text-lg">📜</span>`,
          glow: "political",
          dim: false,
          badges: government,
          caption,
        };
      case "short":
      case "none":
        return {
          screen: "laws",
          state: l.kind,
          svg: ringSvg(l.kind === "short" ? l.progress : 0, "grey"),
          face: html`<span class="text-lg">📜</span>`,
          glow: null,
          dim: true,
          badges: government,
          caption,
        };
    }
  }

  private victorySpec(v: VictoryDial): DialSpec {
    if (v.kind === "running") {
      return {
        screen: "victory",
        state: v.paused ? "paused" : "running",
        svg: ringSvg(v.progress, v.paused ? "grey" : "victory"),
        face: html`<span class="text-sm">${v.paused ? "⏸️" : "🏆"}</span>
          <span class="text-[10px] font-bold tabular-nums"
            >${Math.floor(v.progress * 100)}%</span
          >`,
        glow: null,
        dim: false,
        badges: nothing,
        caption: nothing,
      };
    }
    return {
      screen: "victory",
      state: v.kind,
      svg: ringSvg(v.kind === "ready" ? 1 : 0, "victory"),
      face: html`<span class="text-lg">🏆</span>`,
      glow: v.kind === "ready" ? "victory" : null,
      dim: false,
      badges:
        v.kind === "ready"
          ? this.alertBadge("bg-amber-300 text-gray-900")
          : nothing,
      caption: nothing,
    };
  }

  /** The 🏛 dial (spec §12): ring to the next session, gold just before, a clock while voting. */
  private congressSpec(m: CongressDialModel): DialSpec {
    const voting = m.state === "voting";
    const badge = (
      kind: string,
      text: string,
      colors: string,
      pos: string,
      label?: string,
    ) =>
      html`<span
        data-dial-badge=${kind}
        aria-label=${label ?? nothing}
        class="absolute ${pos} size-4 flex items-center justify-center rounded-full ${colors} ring-1 ring-gray-900 text-[10px] font-black leading-none"
        >${text}</span
      >`;
    return {
      screen: "congress",
      state: m.state,
      svg: voting
        ? clockSvg(m.progress, "congress")
        : ringSvg(
            m.state === "soon" ? 1 : m.progress,
            m.state === "idle" ? "grey" : "congress",
          ),
      face: voting
        ? html`<span class="text-sm">🏛</span>
            <span data-dial-seconds class="text-[10px] font-bold tabular-nums"
              >${translateText("domestic.dial.seconds", {
                seconds: m.secondsLeft,
              })}</span
            >`
        : html`<span class="text-lg">🏛</span>`,
      glow: m.state === "soon" || (voting && m.unvoted > 0) ? "congress" : null,
      dim: m.state === "idle",
      badges: html`${m.canConvene
        ? badge(
            "convene",
            "🚨",
            "bg-red-600",
            "-top-1 -left-1",
            translateText("congress.screen.available"),
          )
        : nothing}
      ${m.targeted
        ? badge(
            "target",
            "!",
            "bg-red-500 text-white",
            "-top-1 -right-1",
            translateText("congress.band.target"),
          )
        : voting && m.unvoted > 0
          ? badge("vote", "!", "bg-yellow-300 text-gray-900", "-top-1 -right-1")
          : nothing}`,
      caption: html`<span
        data-congress-influence
        class="text-[10px] leading-none font-semibold tabular-nums whitespace-nowrap ${m.earning
          ? "text-amber-300"
          : "text-gray-400"}"
        >${translateText("congress.dial.influence", {
          value: m.influence,
        })}</span
      >`,
    };
  }

  private alertBadge(colors: string): TemplateResult {
    return html`<span
      data-dial-badge="ready"
      aria-label=${translateText("domestic.dial.ready")}
      class="absolute -top-1 -right-1 size-4 flex items-center justify-center rounded-full ${colors} ring-1 ring-gray-900 text-[10px] font-black leading-none"
      >!</span
    >`;
  }

  private rate(perSec: number, color: string): TemplateResult {
    return html`<span
      class="text-[10px] leading-none font-semibold tabular-nums whitespace-nowrap ${color}"
      >${translateText("domestic.per_sec", { value: perSec.toFixed(1) })}</span
    >`;
  }

  private renderRecruit(m: DialsModel): TemplateResult {
    const target = this.pendingTarget ?? m.recruitTargetPct;
    return html`
      <button
        type="button"
        data-recruit-chip
        aria-expanded=${String(this.recruitOpen)}
        class="h-6 px-2 rounded-full text-[11px] font-bold whitespace-nowrap border ${this
          .recruitOpen
          ? "bg-gray-600 border-white/40"
          : "bg-gray-700/80 border-white/15"}"
        @click=${() => this.setRecruitOpen(!this.recruitOpen)}
      >
        🪖 ${translateText("domestic.recruit_chip", { pct: target })}
      </button>
      ${this.recruitOpen
        ? html`<div
            data-recruit-popover
            class="absolute bottom-full left-0 mb-2 w-64 z-10 flex flex-col gap-2 p-3 rounded-lg bg-gray-900/95 border border-white/15 shadow-xl text-sm"
          >
            <div class="flex items-center gap-2">
              <span class="flex-1 font-bold"
                >${translateText("domestic.recruit_target", {
                  pct: target,
                })}</span
              >
              <button
                type="button"
                data-recruit-close
                aria-label=${translateText("common.close")}
                class="size-7 flex items-center justify-center rounded-md hover:bg-white/10"
                @click=${() => this.setRecruitOpen(false)}
              >
                ✕
              </button>
            </div>
            <p class="text-xs text-gray-300">
              ${translateText("domestic.recruit_help")}
            </p>
            <input
              type="range"
              class="touch-range w-full"
              min=${RECRUIT_TARGET_MIN_PCT}
              max=${RECRUIT_TARGET_MAX_PCT}
              step="5"
              .value=${String(target)}
              @input=${this.onTargetInput}
              @change=${this.onTargetChange}
            />
          </div>`
        : nothing}
    `;
  }
}
