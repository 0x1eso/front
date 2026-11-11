import type { GwGauge } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  GW_LENSES,
  gwMapState,
  lensSteps,
  ownHeadline,
  RAMP,
  rumourList,
  setLens,
  setRail,
  type GwLens as Lens,
} from "./GwLensModel";
import { RAIL_LINGER_DAYS, railClock, running } from "./GwRailModel";
import { GLASS, MUTED } from "./GwStyle";
import { textOrNull } from "./GwText";

const GAUGE_OF: Readonly<Partial<Record<Lens, GwGauge>>> = {
  strikes: "order",
  bread: "bread",
};

const CHIP_BTN =
  "min-h-10 whitespace-nowrap rounded border px-2.5 py-1 text-sm text-white";

const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/**
 * Great War 1914 (ww155): the map's lenses. A row of buttons on the map: the
 * unrest lens in four kinds (strikes, bread, nationalities, rumour) and the
 * mobilisation trains. What each one paints is GwLensModel; this draws the
 * buttons, the key to the colours and one line about the seat's own country.
 */
@customElement("gw-lens")
export class GwLens extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private data: GreatWarData | null = null;
  @state() private seen = -1;

  createRenderRoot() {
    return this;
  }

  init() {}

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const data = this.game?.greatWarData?.() ?? null;
    if (data !== this.data || this.seen !== gwMapState.version) {
      this.data = data;
      const seat = this.seat();
      if (data !== null && seat !== null) railClock.observe(data, seat);
      this.seen = gwMapState.version;
      this.requestUpdate();
    }
  }

  private seat(): GwSeatView | null {
    const me = this.game?.myPlayer()?.smallID();
    return this.data?.seats.find((s) => s.smallID === me) ?? null;
  }

  private button(lens: Lens): TemplateResult {
    const on = gwMapState.lens === lens;
    return html`<button
      class="${CHIP_BTN} ${on
        ? "border-amber-300/80 bg-amber-900/80"
        : "border-white/25 bg-slate-900/85 hover:bg-slate-700/90"}"
      data-gw-lens-btn=${lens}
      title=${translateText(`gw.lens.hint.${lens}`)}
      aria-pressed=${on}
      @click=${() => setLens(lens)}
    >
      ${translateText(`gw.lens.name.${lens}`)}
    </button>`;
  }

  private railButton(seat: GwSeatView): TemplateResult {
    const on = gwMapState.rail;
    const any = running(seat).length > 0;
    return html`<button
      class="${CHIP_BTN} ${on && any
        ? "border-amber-300/80 bg-amber-900/80"
        : "border-white/25 bg-slate-900/85 hover:bg-slate-700/90"} ${any
        ? ""
        : "opacity-60"}"
      data-gw-rail-btn
      title=${translateText("gw.lens.hint.rail")}
      aria-pressed=${on}
      @click=${() => setRail(!on)}
    >
      ${translateText("gw.lens.name.rail")}
    </button>`;
  }

  private key(lens: Lens): TemplateResult {
    return html`<ul
      class="flex flex-wrap gap-x-3 gap-y-0.5 sm:block sm:space-y-0.5"
      data-gw-lens-key
    >
      ${lensSteps(lens).map(
        (n) =>
          html`<li class="flex items-center gap-1.5 text-xs text-white/85">
            <span
              class="inline-block h-3 w-4 shrink-0 rounded-sm border border-white/30"
              style="background:${rgb(RAMP[n])};${lens === "rumour"
                ? "background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.45) 0 2px,transparent 2px 5px)"
                : ""}"
            ></span>
            ${translateText(`gw.lens.step.${lens}.${n}`)}
          </li>`,
      )}
    </ul>`;
  }

  /** One line of what the seat's own country shows, then why. */
  private readout(lens: Lens, data: GreatWarData, seat: GwSeatView) {
    if (lens === "rumour") {
      const list = rumourList(data, seat);
      return list.length === 0
        ? html`<p class=${MUTED} data-gw-lens-line>
            ${translateText("gw.lens.rumour_none")}
          </p>`
        : html`${list.map(
            (x) =>
              html`<p class="text-xs text-white/85" data-gw-lens-line>
                ${translateText("gw.lens.rumour_line", {
                  country: translateText(`gw.country.${x.tag}`),
                  what: translateText(`gw.lens.rung.${x.rung}`),
                })}
              </p>`,
          )}`;
    }
    const head = ownHeadline(lens, seat);
    if (!head.hasOwn) {
      return html`<p class=${MUTED} data-gw-lens-line>
        ${translateText("gw.lens.nations_none", {
          country: translateText(`gw.country.${seat.tag}`),
        })}
      </p>`;
    }
    const gauge = GAUGE_OF[lens];
    const lines =
      gauge === undefined
        ? []
        : (seat.world.gauges.find((g) => g.gauge === gauge)?.lines ?? [])
            .slice(0, 2)
            .map((l) => ({
              up: l.delta > 0,
              text: textOrNull(`gw.line.${l.key}`) ?? l.key,
            }));
    return html`<p class="text-xs text-white/90" data-gw-lens-line>
        ${translateText("gw.lens.own", {
          country: translateText(`gw.country.${seat.tag}`),
          step: translateText(`gw.lens.step.${lens}.${head.step}`),
        })}
      </p>
      ${lens === "nations"
        ? html`<p class="${MUTED} hidden sm:block">
            ${translateText("gw.lens.nations_how")}
          </p>`
        : nothing}
      ${lines.map(
        (l) => html`<p class=${MUTED}>${l.up ? "▲" : "▼"} ${l.text}</p>`,
      )}`;
  }

  /** With no lens on: each mobilising country's days, and the German question. */
  private railCard(data: GreatWarData, seat: GwSeatView) {
    const on = running(seat).filter(
      ({ row }) =>
        railClock.elapsed(row.tag, data.date) < row.days + RAIL_LINGER_DAYS,
    );
    if (!gwMapState.rail || on.length === 0) return nothing;
    const german =
      on.some((x) => x.row.tag === "DEU") && seat.world.plan === null;
    return html`<div
      class="${GLASS} hidden space-y-1 rounded p-2 sm:block"
      data-gw-rail-card
    >
      ${on.map(({ row }) => {
        const elapsed = railClock.elapsed(row.tag, data.date);
        return html`<div
          class="flex justify-between text-xs text-white/90"
          data-gw-rail-row=${row.tag}
        >
          <span>${translateText(`gw.country.${row.tag}`)}</span>
          <span
            >${elapsed >= row.days
              ? translateText("gw.lens.rail_done")
              : translateText("gw.lens.rail_days", {
                  day: Math.min(row.days, Math.floor(elapsed) + 1),
                  total: row.days,
                })}</span
          >
        </div>`;
      })}
      ${german
        ? html`<p class=${MUTED}>${translateText("gw.lens.rail_belgium")}</p>`
        : nothing}
    </div>`;
  }

  render() {
    const data = this.data;
    const seat = this.seat();
    // The years before the war take the whole screen: no map to look at.
    if (data === null || seat === null || seat.prologue?.done === false) {
      return nothing;
    }
    if (gwMapState.busy) return nothing;
    const lens = gwMapState.lens;
    return html`<div
      data-gw-lens
      class="pointer-events-auto fixed left-2 right-2 top-[calc(var(--gw-band-h,2.5rem)_+_2.75rem)] z-[897] flex flex-col gap-1.5 text-white sm:bottom-6 sm:left-auto sm:right-16 sm:top-auto sm:w-[200px] sm:flex-col-reverse"
    >
      <div class="flex flex-wrap gap-1.5 sm:flex-col">
        ${GW_LENSES.map((l) => this.button(l))} ${this.railButton(seat)}
      </div>
      ${lens === null
        ? this.railCard(data, seat)
        : html`<div class="${GLASS} space-y-1.5 rounded p-2" data-gw-lens-card>
            <p class="hidden text-xs text-white/70 sm:block">
              ${translateText(`gw.lens.hint.${lens}`)}
            </p>
            ${this.key(lens)} ${this.readout(lens, data, seat)}
          </div>`}
    </div>`;
  }
}
