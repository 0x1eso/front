import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SetRecruitTargetIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import { ToggleDomesticPanelEvent } from "./DomesticEvents";

/** Ticks to wait for the engine to apply a recruit target before giving up. */
const PENDING_TARGET_TICKS = 30;

/** Science, political power, the recruit-target slider and the panel button. */
@customElement("domestic-hud")
export class DomesticHud extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private data: DomesticData | null = null;
  /** Slider value while the intent round-trips. */
  @state() private pendingTarget: number | null = null;
  private pendingTicks = 0;

  createRenderRoot() {
    return this;
  }

  tick() {
    if (this.pendingTicks > 0 && --this.pendingTicks === 0) {
      this.pendingTarget = null;
    }
    const me = this.game?.myPlayer();
    const next =
      me && me.isAlive() && !this.game.inSpawnPhase()
        ? me.domesticData()
        : null;
    if (next === this.data) return;
    const prevPct = this.data?.recruitTargetPct;
    this.data = next;
    if (
      next !== null &&
      this.pendingTarget !== null &&
      (next.recruitTargetPct === this.pendingTarget ||
        next.recruitTargetPct !== prevPct)
    ) {
      this.pendingTarget = null;
    }
  }

  private onTargetInput(e: Event) {
    this.pendingTarget = Number((e.target as HTMLInputElement).value);
  }

  private onTargetChange(e: Event) {
    const pct = Number((e.target as HTMLInputElement).value);
    if (pct === this.data?.recruitTargetPct) {
      this.pendingTarget = null;
      this.pendingTicks = 0;
      return;
    }
    this.pendingTarget = pct;
    this.pendingTicks = PENDING_TARGET_TICKS;
    this.eventBus.emit(new SetRecruitTargetIntentEvent(pct));
  }

  render() {
    const d = this.data;
    if (d === null) return null;
    const target = this.pendingTarget ?? d.recruitTargetPct;
    return html`
      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 border-t border-white/10 text-sm text-white"
      >
        <span data-domestic="science" class="whitespace-nowrap">
          🔬 ${translateText("domestic.science")}
          <b class="tabular-nums">${d.science}</b>
          <span class="text-green-400"
            >${translateText("domestic.per_sec", {
              value: d.sciencePerSec.toFixed(1),
            })}</span
          >
        </span>
        <span data-domestic="political" class="whitespace-nowrap">
          🏛️ ${translateText("domestic.political")}
          <b class="tabular-nums">${d.political}</b>
          <span class="text-green-400"
            >${translateText("domestic.per_sec", {
              value: d.politicalPerSec.toFixed(1),
            })}</span
          >
        </span>
        <label class="flex items-center gap-2 flex-1 min-w-[12rem]">
          <span class="whitespace-nowrap"
            >${translateText("domestic.recruit_target", { pct: target })}</span
          >
          <input
            type="range"
            class="touch-range flex-1 min-w-0"
            min=${RECRUIT_TARGET_MIN_PCT}
            max=${RECRUIT_TARGET_MAX_PCT}
            step="5"
            .value=${String(target)}
            @input=${this.onTargetInput}
            @change=${this.onTargetChange}
          />
        </label>
        <button
          type="button"
          data-domestic="open-panel"
          class="h-11 px-4 shrink-0 rounded-md bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-base font-bold"
          @click=${() => this.eventBus.emit(new ToggleDomesticPanelEvent())}
        >
          ${translateText("domestic.open_panel")}
        </button>
      </div>
    `;
  }
}
