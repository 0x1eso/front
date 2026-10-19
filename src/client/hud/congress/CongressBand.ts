import {
  AvailableEmergencyData,
  CongressData,
  EmergencyData,
  EmergencyKind,
  ResultData,
  SessionData,
} from "@openfront/engine-api/congress/CongressTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { PlaySoundEffectEvent } from "../../sound/Sounds";
import { SendConveneEmergencyIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import {
  CongressViewer,
  CONVENE_COST,
  conveneState,
  emergencyRole,
  formatClock,
  goalText,
  nameOf,
  newResults,
  optionLabel,
  ticksToSeconds,
  titleText,
  viewerOf,
} from "./CongressModel";

/** The result banner stays this long (3 s). */
export const TOAST_TICKS = 30;

/** Space between the satellite band and this one, in CSS px. */
const BAND_GAP = 4;
/** Top offset without a satellite band, in CSS px (as the satellite band's top-2). */
const BAND_TOP = 8;

const ROW =
  "rounded-md border px-3 py-1.5 bg-gray-900/85 border-red-500/60 font-semibold";

/**
 * World congress (spec §9.2, §12): a slim band at the top centre, under the
 * satellite band when it shows: the session's result banner (with the gavel,
 * once a session), each emergency that can be convened with its one-tap
 * button (or why not), the emergency vote, and the emergency under way with
 * its goal and my part. Nothing covers the map's centre.
 */
@customElement("congress-band")
export class CongressBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  /** The history last seen; null until the first congress data. */
  private seen: readonly ResultData[] | null = null;
  private toast: { results: ResultData[]; untilTick: number } | null = null;

  createRenderRoot() {
    return this;
  }

  tick() {
    if (!this.game?.config().congress()) return;
    const data = this.game.congressData();
    if (data === null) return;
    const now = this.game.ticks();
    // A session's results arrive together: one banner, one gavel.
    const fresh = newResults(this.seen, data.history);
    this.seen = data.history;
    if (fresh.length > 0) {
      this.toast = { results: fresh, untilTick: now + TOAST_TICKS };
      this.eventBus.emit(new PlaySoundEffectEvent("click-3"));
    }
    if (this.toast !== null && this.toast.untilTick <= now) this.toast = null;
    this.requestUpdate();
  }

  private top(): number {
    const sat = document.querySelector("[data-satellite-band]");
    return sat === null
      ? BAND_TOP
      : Math.round(sat.getBoundingClientRect().bottom + BAND_GAP);
  }

  render() {
    if (!this.game?.config().congress()) return nothing;
    const data = this.game.congressData();
    if (data === null) return nothing;
    const now = this.game.ticks();
    const viewer = viewerOf(this.game);
    const rows: TemplateResult[] = [];
    if (this.toast !== null && this.toast.untilTick > now) {
      rows.push(this.renderToast(this.toast.results));
    }
    if (viewer?.alive) {
      for (const a of data.available) {
        rows.push(this.renderAvailable(data, viewer, a, now));
      }
    }
    if (data.session?.kind === "emergency") {
      const vote = this.renderEmergencyVote(data.session, now);
      if (vote !== null) rows.push(vote);
    }
    if (data.emergency !== null) {
      rows.push(this.renderEmergency(data.emergency, viewer, now));
    }
    if (rows.length === 0) return nothing;
    return html`<div
      data-congress-band
      class="fixed left-1/2 -translate-x-1/2 z-[1002] w-[min(26rem,calc(100vw-32px))] flex flex-col gap-1 text-white text-sm pointer-events-none select-none"
      style="top: ${this.top()}px"
    >
      ${rows}
    </div>`;
  }

  private name = (id: number) => nameOf(this.game, id);

  private kind(kind: string): string {
    return translateText(`congress.emergency.${kind}`);
  }

  private renderToast(results: ResultData[]): TemplateResult {
    return html`<div
      data-congress-toast
      class="flex flex-col gap-0.5 rounded-md border border-yellow-400 bg-gray-900/90 px-3 py-1.5 font-semibold text-yellow-100 shadow-lg"
    >
      ${results.map((r) => {
        const title = titleText(r, this.name, translateText);
        return html`<span
          >${r.adopted === null
            ? translateText("congress.toast.tied", { title, a: r.a, b: r.b })
            : translateText("congress.toast.adopted", {
                title,
                option: optionLabel(r.resolution, r.adopted, translateText),
                a: r.a,
                b: r.b,
              })}</span
        >`;
      })}
    </div>`;
  }

  private renderAvailable(
    data: CongressData,
    viewer: CongressViewer,
    a: AvailableEmergencyData,
    now: number,
  ): TemplateResult {
    const kind = this.kind(a.kind);
    if (viewer.smallID === a.target) {
      return html`<div
        data-available-target
        class="rounded-md border px-3 py-1.5 bg-red-800/90 border-red-300 font-semibold"
      >
        ${translateText("congress.band.available_target", { kind })}
      </div>`;
    }
    const block = conveneState(data, viewer, a.kind, a.target, now);
    return html`<div data-available=${`${a.kind}:${a.target}`} class=${ROW}>
      <div class="flex items-center gap-2">
        <span class="flex-1 min-w-0"
          >${translateText("congress.band.available", {
            name: this.name(a.target),
            kind,
          })}</span
        >
        <button
          type="button"
          data-convene=${`${a.kind}:${a.target}`}
          class="pointer-events-auto shrink-0 h-8 px-3 rounded-md text-sm font-semibold whitespace-nowrap bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
          ?disabled=${block !== null}
          @click=${() => this.convene(a.kind, a.target)}
        >
          ${translateText("congress.band.convene", { cost: CONVENE_COST })}
        </button>
      </div>
      ${block === null
        ? nothing
        : html`<div
            data-convene-reason
            class="mt-0.5 text-xs font-normal text-amber-300"
          >
            ${translateText(`congress.block.${block}`, { cost: CONVENE_COST })}
          </div>`}
    </div>`;
  }

  /** One tap convenes; checked again on the tap, as the engine will. */
  private convene(kind: EmergencyKind, target: number) {
    const data = this.game.congressData();
    const viewer = viewerOf(this.game);
    if (data === null || viewer === null) return;
    if (conveneState(data, viewer, kind, target, this.game.ticks()) !== null) {
      return;
    }
    const p = this.game.playerBySmallID(target);
    if (!p.isPlayer()) return;
    this.eventBus.emit(
      new SendConveneEmergencyIntentEvent(kind, (p as PlayerView).id()),
    );
  }

  private renderEmergencyVote(
    s: SessionData,
    now: number,
  ): TemplateResult | null {
    const item = s.items[0];
    if (item === undefined || item.param === null) return null;
    return html`<div data-emergency-vote class=${ROW}>
      ${translateText("congress.band.voting", {
        kind: this.kind(item.param),
        name: this.name(item.targets[0]),
        seconds: ticksToSeconds(s.closeTick - now),
      })}
    </div>`;
  }

  private renderEmergency(
    e: EmergencyData,
    viewer: CongressViewer | null,
    now: number,
  ): TemplateResult {
    const role = emergencyRole(e, viewer);
    const pct =
      e.goal > 0 ? Math.min(100, Math.round((e.progress / e.goal) * 100)) : 0;
    return html`<div
      data-emergency
      data-emergency-role=${role}
      class="rounded-md border px-3 py-1.5 font-semibold ${role === "target"
        ? "bg-red-800/90 border-red-300"
        : "bg-gray-900/85 border-red-500/60"}"
    >
      <div class="flex items-center gap-2">
        ${role === "none"
          ? nothing
          : html`<span
              data-emergency-part
              class="shrink-0 rounded px-1.5 text-xs font-bold ${role ===
              "target"
                ? "bg-red-950/60 text-red-100"
                : "bg-amber-400 text-gray-900"}"
              >${translateText(`congress.band.${role}`)}</span
            >`}
        <span class="flex-1 min-w-0"
          >${translateText("congress.band.active", {
            kind: this.kind(e.kind),
            name: this.name(e.target),
            goal: goalText(e, translateText),
            time: formatClock(e.endTick - now),
          })}</span
        >
      </div>
      <div class="h-1.5 mt-1 bg-gray-700 rounded-sm">
        <div
          data-progress
          class="h-1.5 bg-red-500 rounded-sm"
          style="width: ${pct}%"
        ></div>
      </div>
    </div>`;
  }
}
