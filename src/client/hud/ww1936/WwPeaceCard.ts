// World War 1936 P5 (spec §20.1, §20.2, §20.9, §6.10; plan Task 9): the
// peace conference card and the conference map mode's band.
//
// A participant's card sits where the event cards sit (above the
// leaderboard on a phone too): the title with the losers, the round and
// its time bar (the engine's deadline in ticks, so it stops while paused),
// my points and my turn, my demand list (each row's price as the engine
// would take it now, "×" removes), "+ Pick regions" (the map mode), "+
// Country demand" and "+ Liberate" (greyed with the reason when the engine
// would refuse), the AI demands that go in when time runs out ("Fill with
// AI demands"), "Pass this round" and "Confirm" (two taps each), and after
// a confirm "Confirmed — waiting" (it can be changed until the deadline).
// When a round ends its results show for 1.5 s; when the conference ends
// the treaty shows for 3 s and the card goes. A loser sees only the band
// "Peace conference in progress — waiting for the result". "–" folds the
// card to a strip (the time still runs).
//
// The map mode (PeaceMapPass draws it; WwLandController hands the taps to
// peaceMapTap): "Done" at the top centre, and for the tapped region a band
// at the bottom — its price (with the control discount), Take, Occupation
// zone, Take for… and Whole group. On a phone the drawers and the card make
// way: only the band stays (spec §20.9).
import type {
  PeaceDemand,
  WwConferenceView,
  WwDemandView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  WW_PEACE_DEMANDS_PER_ROUND,
  WW_PEACE_MAX_ROUNDS,
  WW_PEACE_ROUND_TICKS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, render, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import {
  confRevision,
  COUNTRY_DEMANDS,
  CountryDemandKind,
  DemandEval,
  demandName,
  demandTargetText,
  losersText,
  NAVY_PCT_MAX,
  NAVY_PCT_MIN,
  NAVY_PCT_STEP,
  PEACE_WHY,
  peaceColor,
  peaceCountryName,
  peaceFlagUrl,
  peaceLineText,
  peaceMe,
  PeaceModel,
  peaceModelOf,
  peaceRegionName,
  peaceRole,
  peaceUiOf,
  PeaceWhy,
  regionsText,
  whyText,
} from "./PeaceModel";
import {
  TWO_TAP_MS,
  TwoTap,
  WW_BAND_PX,
  type WwPaceGame,
  wwSeconds,
  wwWindowTicks,
} from "./WorldWarModel";
import { WwDrawerEvent } from "./WwDrawer";

/** The card's width: the event cards' (spec §20.1). */
const CARD_WIDTH = "w-[min(46vw,380px)]";
/** Space kept below the band, in CSS px. */
const TOP_GAP = 8;
/** A round's results stay this long (spec §20.1). */
export const ROUND_RESULT_MS = 1500;
/** The treaty stays this long before the card goes (spec §20.1). */
export const FINAL_RESULT_MS = 3000;
/** The card layer: the event cards' (over the drawers and the leaderboard). */
export const PEACE_LAYER_CLASS = "fixed z-[1003] pointer-events-none";

type Section = "country" | "release" | "ai" | null;

interface Result {
  title: string;
  lines: string[];
  until: number;
}

/** A short landscape screen (a phone): the map mode keeps only its band (spec §20.9). */
function compactScreen(): boolean {
  return (
    typeof window !== "undefined" && window.innerHeight <= COMPACT_MAX_HEIGHT
  );
}

/**
 * A round's time bar (1 → 0) and its whole seconds left, `ticksLeft` ticks
 * before the deadline. The round is WW_PEACE_ROUND_TICKS in this game's
 * ticks (wwRealTicks: 75 in the unlimited game), so it is 30 s either way.
 */
export function peaceTimeLeft(
  game: WwPaceGame,
  ticksLeft: number,
): { fraction: number; seconds: number } {
  const total = wwWindowTicks(game, WW_PEACE_ROUND_TICKS);
  return {
    fraction: Math.min(ticksLeft, total) / total,
    seconds: wwSeconds(game, ticksLeft),
  };
}

/**
 * Spec §20.9: the map mode wants the whole map. A drawer closes when another
 * opens (WwDrawerEvent), so two such events, taken back at once, close
 * every drawer and leave no drawer marked open.
 */
export function closeWwDrawers(bus: EventBus): void {
  bus.emit(new WwDrawerEvent("industry", true));
  bus.emit(new WwDrawerEvent("research", true));
  bus.emit(new WwDrawerEvent("research", false));
  bus.emit(new WwDrawerEvent("industry", false));
}

@customElement("ww-peace-card")
export class WwPeaceCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  private readonly twoTap = new TwoTap();
  private layer: HTMLDivElement | null = null;
  private mapLayer: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cardTemplate: TemplateResult | null = null;
  private mapTemplate: TemplateResult | null = null;
  private drawn: readonly unknown[] = [];
  private folded = false;
  private section: Section = null;
  /** The loser the country demands aim at. */
  private loser = 0;
  private repK = 1;
  private navyPct = NAVY_PCT_MIN;
  private takeForOpen = false;
  private result: Result | null = null;
  private seen: { conf: number; round: number; losers: number[] } | null = null;
  private unregisterBack: (() => void) | null = null;

  createRenderRoot() {
    return this;
  }

  /** The card layer while connected (tests and layout read it). */
  cardLayer(): HTMLElement | null {
    return this.layer;
  }

  /** The map mode's layer while connected. */
  mapModeLayer(): HTMLElement | null {
    return this.mapLayer;
  }

  connectedCallback() {
    super.connectedCallback();
    const mk = (attr: string) => {
      const d = document.createElement("div");
      d.setAttribute(attr, "");
      d.className = `${PEACE_LAYER_CLASS} text-white select-none`;
      d.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(d);
      return d;
    };
    this.layer = mk("data-ww-peace-layer");
    this.mapLayer = mk("data-ww-peace-map-layer");
    this.mapLayer.style.inset = "0";
    window.addEventListener("resize", this.place);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.place());
      this.resizeObserver.observe(this.layer);
      if (this.parentElement !== null) {
        this.resizeObserver.observe(this.parentElement);
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.place);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unregisterBack?.();
    this.unregisterBack = null;
    for (const l of [this.layer, this.mapLayer]) {
      if (l === null) continue;
      render(nothing, l);
      l.remove();
    }
    this.layer = null;
    this.mapLayer = null;
  }

  init() {}

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const game = this.game;
    if (!game) return;
    const ui = peaceUiOf(game);
    const m = peaceModelOf(game);
    const me = peaceMe(game);
    const conf = m?.conference ?? null;
    const now = Date.now();
    // Only a participant or a loser follows the conference (spec §6.10).
    const inIt =
      m !== null &&
      me !== null &&
      (m.participant(me) !== null || m.isLoser(me));
    if (conf !== null && m !== null && me !== null && inIt) {
      const seen = this.seen;
      // A round ended: its results for 1.5 s (spec §20.1).
      if (
        seen !== null &&
        seen.conf === conf.id &&
        conf.round > seen.round &&
        conf.lastRound.length > 0
      ) {
        this.result = {
          title: translateText("ww1936.peace.round_result", { n: seen.round }),
          lines: this.roundLines(m, me),
          until: now + ROUND_RESULT_MS,
        };
      }
      if (seen === null || seen.conf !== conf.id) {
        this.folded = false;
        this.section = null;
        this.loser = 0;
      }
      this.seen = {
        conf: conf.id,
        round: conf.round,
        losers: [...conf.losers],
      };
      const sub = m.submitted(me);
      ui.sync(
        conf.id,
        conf.round,
        sub === null
          ? null
          : sub
              .flatMap((v) => m.toWire(v))
              .slice(0, WW_PEACE_DEMANDS_PER_ROUND),
      );
    } else if (this.seen !== null && this.conferenceGone(this.seen.conf)) {
      // The conference ended: the treaty for 3 s, then the card goes. (Not
      // when only my part in it went, e.g. a takeover: no treaty then.)
      this.result = {
        title: translateText("ww1936.peace.final_result"),
        lines: this.treatyLines(this.seen.losers),
        until: now + FINAL_RESULT_MS,
      };
      this.seen = null;
      ui.reset();
      this.leaveMap();
    }
    if (this.result !== null && now >= this.result.until) {
      this.result = null;
      this.requestUpdate();
    }
    if (!ui.map) this.leaveMap();
    const key = [
      confRevision(conf),
      ui.version,
      // The second shown changes (2.5 ticks at 400 ms).
      wwSeconds(game, game.ticks()),
      this.result?.until ?? 0,
      game.wwLand?.()?.version ?? 0,
      compactScreen(),
    ];
    if (key.some((v, n) => v !== this.drawn[n])) {
      this.drawn = key;
      this.requestUpdate();
    }
  }

  protected updated(): void {
    if (this.layer !== null) render(this.cardTemplate ?? nothing, this.layer);
    if (this.mapLayer !== null) {
      render(this.mapTemplate ?? nothing, this.mapLayer);
    }
    this.place();
  }

  /** Sizes the slot in the HUD column to the card, then lays the layer over it. */
  readonly place = () => {
    const layer = this.layer;
    if (layer === null) return;
    const slot = this.querySelector<HTMLElement>("[data-ww-peace-slot]");
    const stack = layer.querySelector<HTMLElement>("[data-ww-peace-stack]");
    if (slot === null || stack === null) return;
    const room = (r: DOMRect) =>
      Math.max(96, Math.floor(r.bottom - WW_BAND_PX - TOP_GAP));
    stack.style.maxHeight = `${room(slot.getBoundingClientRect())}px`;
    const height = `${Math.round(stack.getBoundingClientRect().height)}px`;
    if (slot.style.height !== height) slot.style.height = height;
    const r = slot.getBoundingClientRect();
    stack.style.maxHeight = `${room(r)}px`;
    layer.style.left = `${Math.round(r.left)}px`;
    layer.style.bottom = `${Math.round(window.innerHeight - r.bottom)}px`;
    // The map mode's band sits above the bottom HUD's rows.
    const band = this.mapLayer?.querySelector<HTMLElement>(
      "[data-ww-peace-band]",
    );
    if (band) {
      const rows = document.querySelector("[data-bottom-hud-rows]");
      const top = rows?.getBoundingClientRect().top ?? window.innerHeight;
      band.style.bottom = `${Math.round(window.innerHeight - Math.min(top, window.innerHeight) + 6)}px`;
    }
  };

  private refresh() {
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  // ---- Actions ----

  /** The conference `id` is over (closed, or no longer the open one). */
  private conferenceGone(id: number): boolean {
    const c = this.game.wwEndgame?.()?.conference() ?? null;
    return c === null || c.status !== "open" || c.id !== id;
  }

  private send(m: PeaceModel, passed: boolean) {
    const ui = peaceUiOf(this.game);
    const conf = m.conference!;
    this.eventBus.emit(
      new SendWwOrderIntentEvent(
        passed
          ? { kind: "peace_pass", conf: conf.id }
          : { kind: "peace_submit", conf: conf.id, demands: [...ui.draft] },
      ),
    );
    ui.markSent(passed);
    this.requestUpdate();
  }

  private twoTapAction(key: string, act: () => void) {
    if (!this.twoTap.tap(key, Date.now())) {
      this.refresh();
      return;
    }
    act();
  }

  private add(d: PeaceDemand) {
    if (peaceUiOf(this.game).add(d)) this.requestUpdate();
  }

  private openMap() {
    const ui = peaceUiOf(this.game);
    ui.openMap();
    if (compactScreen()) closeWwDrawers(this.eventBus);
    this.unregisterBack?.();
    this.unregisterBack = registerBackClosable(() => {
      if (!peaceUiOf(this.game).map) return false;
      this.leaveMap();
      this.requestUpdate();
      return true;
    });
    this.requestUpdate();
  }

  private leaveMap() {
    if (this.game) peaceUiOf(this.game).closeMap();
    this.takeForOpen = false;
    this.unregisterBack?.();
    this.unregisterBack = null;
  }

  // ---- Results ----

  /** The round that just ended (lastRound): what each country got, and my failures. */
  private roundLines(m: PeaceModel, me: number): string[] {
    const conf = m.conference!;
    const sc = this.game.worldWarScenario();
    const out: string[] = [];
    let failed = 0;
    let reason: PeaceWhy = { key: PEACE_WHY.bad };
    for (const l of conf.lastRound) {
      if (!l.ok) {
        if (l.by !== me) continue;
        failed++;
        const lost = l.regions
          .map((r) => m.stakeRegion(r)?.settledBy ?? 0)
          .find((by) => by !== 0 && by !== me);
        if (lost !== undefined) {
          reason = { key: PEACE_WHY.control, params: { country: lost } };
        }
        continue;
      }
      const what =
        l.regions.length > 0 && sc !== null
          ? regionsText(sc, m, l.regions)
          : peaceCountryName(this.game, l.target);
      out.push(
        translateText("ww1936.peace.line.ok", {
          who: peaceCountryName(this.game, l.by),
          what: `${demandName(l.kind)} · ${what}`,
        }),
      );
    }
    if (failed > 0) {
      out.push(
        translateText("ww1936.peace.line.failed", {
          n: failed,
          reason: whyText(this.game, reason),
        }),
      );
    }
    return out;
  }

  /** The treaty (the newest peace-log entry for these losers). */
  private treatyLines(losers: readonly number[]): string[] {
    const log = this.game.wwEndgame?.()?.peaceLog ?? [];
    const same = (e: { losers: number[] }) =>
      e.losers.length === losers.length &&
      e.losers.every((l) => losers.includes(l));
    const entry = log.find(same) ?? null;
    return (entry?.lines ?? []).map((l) => peaceLineText(this.game, l));
  }

  // ---- Render ----

  render() {
    this.cardTemplate = null;
    this.mapTemplate = null;
    const game = this.game;
    if (!game) return nothing;
    const ui = peaceUiOf(game);
    const role = peaceRole(game);
    const m = peaceModelOf(game);
    const me = peaceMe(game);
    const compact = compactScreen();
    if (this.result !== null) {
      this.cardTemplate = this.stack(this.renderResult(this.result));
    } else if (role === "band" && m !== null) {
      this.cardTemplate = this.stack(this.renderBand(m));
    } else if (role === "card" && m !== null && me !== null) {
      if (ui.map) this.mapTemplate = this.renderMap(m, me);
      if (!(ui.map && compact)) {
        this.cardTemplate = this.stack(
          this.folded ? this.renderStrip(m) : this.renderCard(m, me),
        );
      }
    }
    if (this.cardTemplate === null) return nothing;
    return html`<div
      data-ww-peace-slot
      class="${CARD_WIDTH} shrink-0 pointer-events-none"
    ></div>`;
  }

  private stack(inner: TemplateResult): TemplateResult {
    return html`<div
      data-ww-peace-stack
      class="flex flex-col items-start overflow-hidden pb-1"
    >
      ${inner}
    </div>`;
  }

  private frame(attrs: string, body: TemplateResult): TemplateResult {
    return html`<div
      data-ww-peace-card=${attrs}
      class="${CARD_WIDTH} pointer-events-auto flex min-h-0 flex-col gap-1 overflow-hidden rounded-lg border border-sky-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
    >
      ${body}
    </div>`;
  }

  private timeBar(m: PeaceModel): TemplateResult {
    const time = peaceTimeLeft(this.game, m.ticksLeft(this.game.ticks()));
    const pct = Math.round(time.fraction * 100);
    const s = time.seconds;
    return html`<div class="flex items-center gap-2">
      <div class="h-1 min-w-0 flex-1 rounded bg-white/10">
        <div
          data-ww-peace-time
          class="h-1 rounded ${s <= 5 ? "bg-red-500" : "bg-sky-400"}"
          style="width: ${pct}%"
        ></div>
      </div>
      <span data-ww-peace-seconds class="shrink-0 tabular-nums"
        >${translateText("ww1936.peace.time_left", { s })}</span
      >
    </div>`;
  }

  private titleOf(conf: WwConferenceView): string {
    return translateText("ww1936.peace.title", {
      name: losersText(this.game, conf),
    });
  }

  private renderResult(r: Result): TemplateResult {
    return this.frame(
      "result",
      html`<span class="font-bold">${r.title}</span>
        <div data-ww-peace-result class="flex flex-col gap-0.5">
          ${r.lines.map((l) => html`<span class="text-white/85">${l}</span>`)}
        </div>`,
    );
  }

  private renderBand(m: PeaceModel): TemplateResult {
    return this.frame(
      "band",
      html`<span class="font-bold">${this.titleOf(m.conference!)}</span>
        <span data-ww-peace-waiting class="text-white/80"
          >${translateText("ww1936.peace.waiting")}</span
        >
        ${this.timeBar(m)}`,
    );
  }

  private renderStrip(m: PeaceModel): TemplateResult {
    return this.frame(
      "strip",
      html`<div class="flex items-center gap-1">
          <span class="min-w-0 flex-1 truncate font-bold"
            >${this.titleOf(m.conference!)}</span
          >
          <button
            type="button"
            data-ww-peace-unfold
            class="size-9 shrink-0 rounded-md hover:bg-white/10"
            aria-label=${translateText("ww1936.peace.expand")}
            @click=${() => {
              this.folded = false;
              this.requestUpdate();
            }}
          >
            +
          </button>
        </div>
        ${this.timeBar(m)}`,
    );
  }

  private btn(
    attr: string,
    label: string | TemplateResult,
    onClick: () => void,
    opts: { disabled?: boolean; armed?: boolean; extra?: string } = {},
  ): TemplateResult {
    return html`<button
      type="button"
      data-ww-peace-btn=${attr}
      data-armed=${String(opts.armed ?? false)}
      class="min-h-9 rounded-md border px-2 py-1 text-left ${opts.armed
        ? "border-amber-300 bg-amber-900/60"
        : "border-white/20 bg-gray-800 hover:bg-gray-700"} disabled:opacity-40 ${opts.extra ??
      ""}"
      ?disabled=${opts.disabled ?? false}
      @click=${onClick}
    >
      ${label}
    </button>`;
  }

  /** Adding `d` to my draft now: its price and why it would fail. */
  private tryAdd(m: PeaceModel, me: number, d: PeaceDemand): DemandEval {
    const ui = peaceUiOf(this.game);
    const views = [
      ...m.demandRows(me, ui.draft),
      m.expand(d, ui.draft.length, me),
    ];
    const all = m.evaluate(me, views);
    return all[all.length - 1];
  }

  /** A choice button: its name and price, greyed with the reason when it would fail. */
  private choice(
    m: PeaceModel,
    me: number,
    attr: string,
    label: string,
    d: PeaceDemand,
  ): TemplateResult {
    const e = this.tryAdd(m, me, d);
    return this.btn(
      attr,
      html`<span class="block font-semibold"
          >${label}${e.view.cost > 0
            ? html` ·
                <span class="tabular-nums"
                  >${translateText("ww1936.peace.value", {
                    cost: e.view.cost,
                  })}</span
                >`
            : nothing}</span
        >
        ${e.why === null
          ? nothing
          : html`<span data-ww-peace-why class="block text-amber-200/90"
              >${whyText(this.game, e.why)}</span
            >`}`,
      () => this.add(d),
      { disabled: e.why !== null },
    );
  }

  private renderCard(m: PeaceModel, me: number): TemplateResult {
    const conf = m.conference!;
    const ui = peaceUiOf(this.game);
    const part = m.participant(me)!;
    const rows = m.evaluate(me, m.demandRows(me, ui.draft));
    const left = m.remainingPts(me, m.demandRows(me, ui.draft));
    const now = Date.now();
    const passed = ui.sent === "pass" && ui.draft.length === 0;
    const confirmed = passed || (ui.sent !== null && !ui.dirty());
    const full = ui.draft.length >= WW_PEACE_DEMANDS_PER_ROUND;
    const ai = m.aiRows(me);
    const sec = (s: Section) => {
      this.section = this.section === s ? null : s;
      this.requestUpdate();
    };
    return this.frame(
      "card",
      html`<div class="flex shrink-0 items-center gap-1">
          <span class="min-w-0 flex-1 font-bold leading-tight"
            >${this.titleOf(conf)}</span
          >
          <span data-ww-peace-round class="shrink-0 text-white/70"
            >${translateText("ww1936.peace.round", {
              n: conf.round,
              max: WW_PEACE_MAX_ROUNDS,
            })}</span
          >
          <button
            type="button"
            data-ww-peace-fold
            class="size-9 shrink-0 rounded-md hover:bg-white/10"
            aria-label=${translateText("ww1936.peace.collapse")}
            @click=${() => {
              this.folded = true;
              this.requestUpdate();
            }}
          >
            –
          </button>
        </div>
        <div class="shrink-0">${this.timeBar(m)}</div>
        <div class="flex shrink-0 flex-wrap justify-between gap-x-2">
          <span data-ww-peace-score class="tabular-nums"
            >${translateText("ww1936.peace.score", {
              score: part.pts,
              left,
            })}</span
          >
          <span data-ww-peace-turn class="text-white/70"
            >${translateText("ww1936.peace.turn", { n: m.turnPlace(me) })}</span
          >
        </div>
        <div
          data-ww-peace-scroll
          class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
        >
          <span class="font-semibold text-white/80"
            >${translateText("ww1936.peace.my_demands", {
              n: ui.draft.length,
              max: WW_PEACE_DEMANDS_PER_ROUND,
            })}</span
          >
          ${rows.length === 0
            ? html`<span data-ww-peace-empty class="text-white/60"
                >${translateText("ww1936.peace.no_demands")}</span
              >`
            : rows.map((e, i) => this.renderRow(m, e, i))}
          <div class="flex flex-wrap gap-1">
            ${this.btn(
              "regions",
              translateText("ww1936.peace.add_regions"),
              () => this.openMap(),
              { disabled: full },
            )}
            ${this.btn(
              "country",
              translateText("ww1936.peace.add_country"),
              () => sec("country"),
              { armed: this.section === "country" },
            )}
            ${conf.releasable.length === 0
              ? nothing
              : this.btn(
                  "release",
                  translateText("ww1936.peace.add_release"),
                  () => sec("release"),
                  { armed: this.section === "release" },
                )}
          </div>
          ${this.section === "country" ? this.renderCountry(m, me) : nothing}
          ${this.section === "release" ? this.renderRelease(m, me) : nothing}
          ${this.btn(
            "ai",
            translateText("ww1936.peace.ai_default", { n: ai.length }),
            () => sec("ai"),
            { armed: this.section === "ai", extra: "w-full" },
          )}
          ${this.section === "ai" ? this.renderAi(m, me, ai) : nothing}
        </div>
        <div class="flex shrink-0 flex-col gap-1 border-t border-white/10 pt-1">
          ${confirmed
            ? html`<span data-ww-peace-confirmed class="text-emerald-300"
                >${translateText("ww1936.peace.confirmed")}</span
              >`
            : nothing}
          <div class="flex gap-1">
            ${this.btn(
              "pass",
              this.twoTap.isArmed("pass", now)
                ? translateText("ww1936.eventui.confirm")
                : translateText("ww1936.peace.pass"),
              () => this.twoTapAction("pass", () => this.send(m, true)),
              {
                armed: this.twoTap.isArmed("pass", now),
                disabled: passed,
                extra: "flex-1",
              },
            )}
            ${this.btn(
              "confirm",
              this.twoTap.isArmed("confirm", now)
                ? translateText("ww1936.eventui.confirm")
                : translateText("ww1936.peace.confirm"),
              () => this.twoTapAction("confirm", () => this.send(m, false)),
              {
                armed: this.twoTap.isArmed("confirm", now),
                // The engine refuses a list with a demand it can't spell out.
                disabled:
                  ui.draft.length === 0 ||
                  (confirmed && !passed) ||
                  rows.some((e) => e.refused),
                extra: "flex-1 font-semibold",
              },
            )}
          </div>
        </div>`,
    );
  }

  private renderRow(m: PeaceModel, e: DemandEval, i: number): TemplateResult {
    const v = e.view;
    const flagId =
      v.kind === "release" || v.kind === "liberate"
        ? v.beneficiary || v.target
        : v.target;
    const flag = flagId > 0 ? peaceFlagUrl(this.game, flagId) : null;
    return html`<div
      data-ww-peace-row=${i}
      data-ok=${String(e.ok)}
      class="flex min-h-9 items-center gap-1.5 rounded-md bg-white/5 pl-2"
    >
      ${flag === null
        ? nothing
        : html`<img
            src=${flag}
            alt=""
            class="h-3.5 w-5 shrink-0 rounded-sm object-cover"
          />`}
      <span class="min-w-0 flex-1 leading-tight">
        <span class="font-semibold">${demandName(v.kind)}</span>
        <span class="text-white/70">
          · ${demandTargetText(this.game, m, v)}</span
        >
        ${e.why === null
          ? nothing
          : html`<span data-ww-peace-why class="block text-amber-200/90"
              >${whyText(this.game, e.why)}</span
            >`}
      </span>
      <span class="shrink-0 tabular-nums ${e.ok ? "" : "text-white/50"}"
        >${translateText("ww1936.peace.value", { cost: v.cost })}</span
      >
      <button
        type="button"
        data-ww-peace-remove=${i}
        class="size-9 shrink-0 rounded-md hover:bg-white/10"
        aria-label=${translateText("ww1936.peace.remove")}
        @click=${() => {
          peaceUiOf(this.game).remove(i);
          this.requestUpdate();
        }}
      >
        ×
      </button>
    </div>`;
  }

  private renderCountry(m: PeaceModel, me: number): TemplateResult {
    const conf = m.conference!;
    const target = conf.losers.includes(this.loser)
      ? this.loser
      : (conf.losers[0] ?? 0);
    const kinds: readonly CountryDemandKind[] = COUNTRY_DEMANDS;
    const step = (attr: string, minus: () => void, plus: () => void) =>
      html`<span class="flex shrink-0 gap-1">
        <button
          type="button"
          data-ww-peace-step=${`${attr}-`}
          class="size-9 rounded-md border border-white/20 bg-gray-800"
          @click=${minus}
        >
          −
        </button>
        <button
          type="button"
          data-ww-peace-step=${`${attr}+`}
          class="size-9 rounded-md border border-white/20 bg-gray-800"
          @click=${plus}
        >
          +
        </button>
      </span>`;
    return html`<div
      data-ww-peace-country-list
      class="flex flex-col gap-1 rounded-md bg-white/5 p-1"
    >
      ${conf.losers.length > 1
        ? html`<div class="flex flex-wrap gap-1">
            ${conf.losers.map((l) =>
              this.btn(
                `loser-${l}`,
                peaceCountryName(this.game, l),
                () => {
                  this.loser = l;
                  this.requestUpdate();
                },
                { armed: l === target },
              ),
            )}
          </div>`
        : nothing}
      ${kinds.map((kind) => {
        const d: PeaceDemand =
          kind === "reparations"
            ? { kind, target, k: this.repK }
            : kind === "take_navy"
              ? { kind, target, pct: this.navyPct }
              : { kind, target };
        const label =
          kind === "reparations"
            ? `${demandName(kind)} · ${translateText("ww1936.peace.reparations_n", { n: this.repK })}`
            : kind === "take_navy"
              ? `${demandName(kind)} · ${translateText("ww1936.peace.navy_pct", { pct: this.navyPct })}`
              : demandName(kind);
        const btn = this.choice(m, me, `country-${kind}`, label, d);
        if (kind === "reparations") {
          return html`<div class="flex items-start gap-1">
            <div class="min-w-0 flex-1 [&>button]:w-full">${btn}</div>
            ${step(
              "k",
              () => {
                this.repK = Math.max(1, this.repK - 1);
                this.requestUpdate();
              },
              () => {
                this.repK = Math.min(99, this.repK + 1);
                this.requestUpdate();
              },
            )}
          </div>`;
        }
        if (kind === "take_navy") {
          return html`<div class="flex items-start gap-1">
            <div class="min-w-0 flex-1 [&>button]:w-full">${btn}</div>
            ${step(
              "pct",
              () => {
                this.navyPct = Math.max(
                  NAVY_PCT_MIN,
                  this.navyPct - NAVY_PCT_STEP,
                );
                this.requestUpdate();
              },
              () => {
                this.navyPct = Math.min(
                  NAVY_PCT_MAX,
                  this.navyPct + NAVY_PCT_STEP,
                );
                this.requestUpdate();
              },
            )}
          </div>`;
        }
        return btn;
      })}
    </div>`;
  }

  private renderRelease(m: PeaceModel, me: number): TemplateResult {
    const conf = m.conference!;
    return html`<div
      data-ww-peace-release-list
      class="flex flex-col gap-1 rounded-md bg-white/5 p-1"
    >
      ${conf.releasable.map((tag) => {
        const id = m.world.smallIdOf(tag);
        return html`<div data-ww-peace-tag=${tag} class="flex flex-col gap-1">
          <span class="font-semibold">${peaceCountryName(this.game, id)}</span>
          <div class="grid grid-cols-2 gap-1">
            ${this.choice(
              m,
              me,
              `release-${tag}`,
              translateText("ww1936.peace.release_puppet"),
              { kind: "release", tag },
            )}
            ${this.choice(
              m,
              me,
              `liberate-${tag}`,
              translateText("ww1936.peace.release_independent"),
              { kind: "liberate", tag },
            )}
          </div>
        </div>`;
      })}
    </div>`;
  }

  private renderAi(
    m: PeaceModel,
    me: number,
    ai: readonly WwDemandView[],
  ): TemplateResult {
    return html`<div
      data-ww-peace-ai-list
      class="flex flex-col gap-1 rounded-md bg-white/5 p-1"
    >
      ${ai.map(
        (v) =>
          html`<span class="text-white/80"
            >${demandName(v.kind)} · ${demandTargetText(this.game, m, v)} ·
            ${translateText("ww1936.peace.value", { cost: v.cost })}</span
          >`,
      )}
      ${this.btn(
        "ai-fill",
        translateText("ww1936.peace.ai_fill"),
        () => {
          peaceUiOf(this.game).setDraft(m.aiDraft(me));
          this.section = null;
          this.requestUpdate();
        },
        { disabled: ai.length === 0 },
      )}
    </div>`;
  }

  // ---- The map mode ----

  private renderMap(m: PeaceModel, me: number): TemplateResult {
    const ui = peaceUiOf(this.game);
    const sc = this.game.worldWarScenario()!;
    const r = ui.region;
    const left = m.remainingPts(me, m.demandRows(me, ui.draft));
    const top = html`<div
      data-ww-peace-map-top
      class="pointer-events-auto fixed left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-sky-300/80 bg-gray-900/92 px-2 py-1 text-xs shadow-lg"
      style="top: ${WW_BAND_PX + 6}px"
    >
      <span class="hidden font-semibold sm:inline"
        >${translateText("ww1936.peace.map_title")}</span
      >
      <span class="tabular-nums"
        >${translateText("ww1936.peace.score", {
          score: m.participant(me)?.pts ?? 0,
          left,
        })}</span
      >
      ${this.btn(
        "map-done",
        html`<span class="font-semibold"
          >${translateText("ww1936.peace.map_done")}</span
        >`,
        () => {
          this.leaveMap();
          this.requestUpdate();
        },
      )}
    </div>`;
    let body: TemplateResult;
    if (r === 0 || m.stakeRegion(r) === null) {
      body = html`<span class="text-white/80"
          >${translateText("ww1936.peace.map_hint")}</span
        >
        ${this.legend(me)}`;
    } else {
      const group = m.groupOf(r);
      const bens = m.beneficiaries(r, me);
      const take = this.tryAdd(m, me, { kind: "take", region: r });
      // "Take for…" opens only when one receiver could get it (Korea and
      // Taiwan rules, the receiver's core): else greyed with the reason.
      const forWhys = bens.map(
        (b) =>
          this.tryAdd(m, me, { kind: "take_for", region: r, beneficiary: b })
            .why,
      );
      const forWhy: PeaceWhy | null =
        bens.length === 0
          ? { key: PEACE_WHY.core }
          : forWhys.every((w) => w !== null)
            ? forWhys[0]
            : null;
      body = html`<span data-ww-peace-region class="font-semibold"
          >${translateText("ww1936.peace.region_line", {
            region: peaceRegionName(sc, r),
            cost: take.view.cost || m.regionCost(r, me, me),
            discount: m.controlDiscount(r, me) ? "yes" : "no",
          })}</span
        >
        <div class="flex flex-wrap gap-1">
          ${this.choice(
            m,
            me,
            "map-take",
            translateText("ww1936.peace.btn_take"),
            { kind: "take", region: r },
          )}
          ${this.choice(
            m,
            me,
            "map-zone",
            translateText("ww1936.peace.btn_zone"),
            { kind: "occupation_zone", region: r },
          )}
          ${forWhy !== null
            ? this.btn(
                "map-take-for",
                html`<span class="block font-semibold"
                    >${translateText("ww1936.peace.btn_take_for")} ▾</span
                  >
                  <span data-ww-peace-why class="block text-amber-200/90"
                    >${whyText(this.game, forWhy)}</span
                  >`,
                () => {},
                { disabled: true },
              )
            : this.btn(
                "map-take-for",
                html`<span class="font-semibold"
                  >${translateText("ww1936.peace.btn_take_for")} ▾</span
                >`,
                () => {
                  this.takeForOpen = !this.takeForOpen;
                  this.requestUpdate();
                },
                { armed: this.takeForOpen },
              )}
          ${group === null
            ? nothing
            : this.choice(
                m,
                me,
                "map-group",
                translateText("ww1936.peace.btn_group"),
                { kind: "take_group", group },
              )}
        </div>
        ${this.takeForOpen && forWhy === null
          ? html`<div data-ww-peace-take-for class="flex flex-wrap gap-1">
              ${bens.map((b) =>
                this.choice(
                  m,
                  me,
                  `map-take-for-${b}`,
                  peaceCountryName(this.game, b),
                  { kind: "take_for", region: r, beneficiary: b },
                ),
              )}
            </div>`
          : nothing}`;
    }
    return html`${top}
      <div
        data-ww-peace-band
        class="pointer-events-auto fixed left-1/2 flex w-[min(96vw,640px)] -translate-x-1/2 flex-col gap-1 rounded-lg border border-sky-300/80 bg-gray-900/95 px-2 py-1.5 text-xs shadow-xl"
        style="bottom: 8px"
      >
        ${body}
      </div>`;
  }

  /** The map's states (spec §20.2): mine in my colour; decided and other in the deciding or controlling country's (patterns here). */
  private legend(me: number): TemplateResult {
    const item = (cls: string, key: string, style = "") =>
      html`<span class="flex items-center gap-1"
        ><span
          class="inline-block size-3 rounded-sm ${cls}"
          style=${style}
        ></span
        >${translateText(key)}</span
      >`;
    const mine = `#${peaceColor(this.game, me).toString(16).padStart(6, "0")}`;
    return html`<div class="flex flex-wrap gap-x-3 gap-y-0.5 text-white/75">
      ${item("border-2 border-white", "ww1936.peace.map_free")}
      ${item(
        "border-2",
        "ww1936.peace.map_mine",
        `background:${mine};border-color:${mine}`,
      )}
      ${item(
        "bg-[repeating-linear-gradient(45deg,#d1d5db_0_2px,transparent_2px_4px)]",
        "ww1936.peace.map_decided",
      )}
      ${item("border-[3px] border-gray-300", "ww1936.peace.map_other")}
    </div>`;
  }
}
