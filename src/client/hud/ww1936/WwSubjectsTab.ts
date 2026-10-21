import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import {
  type EndgameGame,
  type SubjectAction,
  type SubjectRow,
  subjectsTab,
} from "./EndgameModel";
import { TWO_TAP_MS, TwoTap, wwActive } from "./WorldWarModel";

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const CARD = "rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs";

/**
 * World War 1936 P5 (spec §9, §20.5): the diplomacy drawer's subjects tab.
 * As an overlord: a row per subject — flag, level, the autonomy bar with
 * its daily change (▲▼), what I take from it, and the P3 decisions on it
 * (tighten control, lower its level, annex, let go; two taps each, grey
 * with one reason). As a subject: my overlord, my autonomy and the two
 * requests (more autonomy once it reaches 100%, the 50 PP demand).
 */
@customElement("ww-subjects-tab")
export class WwSubjectsTab extends LitElement {
  @property({ attribute: false }) game: EndgameGame | null = null;
  @property({ attribute: false }) eventBus: EventBus | null = null;
  /** Bumped by the drawer whenever what the tab shows may have changed. */
  @property({ type: Number }) stamp = 0;
  private readonly twoTap = new TwoTap();
  private disarmTimer: ReturnType<typeof setTimeout> | null = null;

  createRenderRoot() {
    return this;
  }

  private send(order: WwOrder) {
    this.eventBus?.emit(new SendWwOrderIntentEvent(order));
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    // Redraw once the arming runs out ("tap again" goes back to the label).
    if (this.disarmTimer !== null) clearTimeout(this.disarmTimer);
    this.disarmTimer = setTimeout(() => {
      this.disarmTimer = null;
      this.requestUpdate();
    }, TWO_TAP_MS + 50);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.disarmTimer !== null) clearTimeout(this.disarmTimer);
    this.disarmTimer = null;
  }

  render() {
    const game = this.game;
    const me = game?.myPlayer()?.smallID() ?? 0;
    if (game === null || me === 0 || !wwActive(game, me)) return nothing;
    const t = subjectsTab(game, me);
    if (t.mine.length === 0 && t.overlord === null) {
      return html`<p
        data-ww-subject-none
        class="m-0 mt-2 text-xs text-white/60"
      >
        ${translateText("ww1936.subject.none")}
      </p>`;
    }
    return html`
      ${t.overlord === null ? nothing : this.renderOverlord(t.overlord)}
      ${t.mine.length === 0
        ? nothing
        : html`<div class=${HEADING}>
              ${translateText("ww1936.subject.tab")}
            </div>
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              ${t.mine.map((r) => this.renderSubject(r))}
            </ul>`}
    `;
  }

  private flag(url: string | null) {
    return url === null
      ? nothing
      : html`<img
          src=${url}
          alt=""
          class="h-3 w-4 shrink-0 rounded-sm object-cover"
        />`;
  }

  /**
   * The autonomy bar with its daily change: ▲ rising, ▼ falling — green
   * when it goes my way (`upIsGood`: mine as a subject).
   */
  private renderAutonomy(
    r: SubjectRow,
    key: string,
    upIsGood: boolean,
  ): TemplateResult {
    const d = r.view.deltaBp;
    const good = d > 0 === upIsGood;
    return html`<div class="mt-1">
      <div class="flex items-center justify-between gap-2">
        <span data-ww-subject-autonomy=${r.autPct}
          >${translateText(key, { pct: r.autPct })}</span
        >
        ${d === 0
          ? nothing
          : html`<span
              data-ww-subject-trend=${d > 0 ? "up" : "down"}
              class="shrink-0 tabular-nums ${good
                ? "text-emerald-300"
                : "text-amber-300"}"
              >${d > 0 ? "▲" : "▼"}
              ${translateText("ww1936.subject.autonomy_trend", {
                bp: d / 100,
              })}</span
            >`}
      </div>
      <div class="mt-0.5 h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded bg-sky-400"
          style="width: ${Math.max(0, Math.min(100, r.autPct))}%"
        ></div>
      </div>
    </div>`;
  }

  private renderActions(actions: SubjectAction[]): TemplateResult {
    return html`<div class="mt-1 grid grid-cols-2 gap-1">
      ${actions.map((a) => {
        const key = `${a.decision}:${a.target}`;
        const armed = a.state === 0 && this.twoTap.isArmed(key, Date.now());
        return html`<div class="flex min-w-0 flex-col">
          <button
            type="button"
            data-ww-subject-act=${a.id}
            data-armed=${String(armed)}
            class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
            ?disabled=${a.state !== 0}
            @click=${() =>
              this.confirmTap(key, () =>
                this.send({
                  kind: "decision_take",
                  decision: a.decision,
                  target: a.target,
                }),
              )}
          >
            ${armed ? translateText("ww1936.pol.tap_again") : a.label}
          </button>
          ${a.state === 0 || a.reason === null
            ? nothing
            : html`<span
                data-ww-subject-why=${a.id}
                class="text-xs text-red-300"
                >${a.reason}</span
              >`}
        </div>`;
      })}
    </div>`;
  }

  private renderSubject(r: SubjectRow): TemplateResult {
    return html`<li data-ww-subject=${r.id} class=${CARD}>
      <div class="flex min-w-0 items-center gap-1.5">
        ${this.flag(r.flag)}
        <b class="min-w-0 truncate"
          >${translateText("ww1936.subject.level_line", {
            country: r.name,
            level: r.levelName,
          })}</b
        >
      </div>
      ${this.renderAutonomy(r, "ww1936.subject.autonomy", false)}
      <p class="m-0 mt-1 text-white/70">
        ${translateText("ww1936.subject.share", { text: r.share })}
      </p>
      ${r.view.neutral
        ? html`<p class="m-0 text-white/60">
            ${translateText("ww1936.subject.why.neutral")}
          </p>`
        : nothing}
      ${this.renderActions(r.actions)}
    </li>`;
  }

  private renderOverlord(r: SubjectRow): TemplateResult {
    return html`<section data-ww-overlord=${r.id} class="${CARD} mt-2">
      <div class="flex min-w-0 items-center gap-1.5">
        ${this.flag(r.flag)}
        <b class="min-w-0 truncate"
          >${translateText("ww1936.subject.overlord", { country: r.name })}</b
        >
        <span class="shrink-0 text-white/60">${r.levelName}</span>
      </div>
      ${this.renderAutonomy(r, "ww1936.subject.my_autonomy", true)}
      ${this.renderActions(r.actions)}
    </section>`;
  }
}
