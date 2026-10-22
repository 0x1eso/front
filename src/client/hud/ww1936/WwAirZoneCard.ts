// World War 1936 P4 (spec §18.3-4, §18.6, §18.11): the chosen air zone's
// card, bottom centre, at most 45% of the screen tall (only its rows
// scroll) — the zone's name and weather, our air control against the
// enemy's, the enemy planes seen, our bases in range and our anti-air and
// radar; a row per plane type I have: its generations, the mission chips
// the zone allows it, a slider from 0 to deployed + idle that sends ONE
// air_deploy with the value it is let go at (−/+ move it by ten), a
// recall; yesterday's results. A refused value says why (airDeployBlock).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type {
  AirMission,
  AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  AIR_MISSION_ICONS,
  airCtx,
  AirCtx,
  airMissionName,
  airTypeName,
  deployBlock,
  deployOrder,
  PlaneRowData,
  sliderRange,
  zoneCard,
  ZoneCardData,
} from "./AirModel";
import { DepthIndustryModel } from "./DepthIndustryModel";
import {
  blockText,
  buildingName,
  EQUIPMENT_ICONS,
  genName,
} from "./EconomyModel";
import { fogModelOf } from "./FogModel";
import { NavyGame } from "./NavyModel";
import { WwAirZoneSelectedEvent } from "./SeaAirSelection";
import { isCapitulated, WW_BAND_PX } from "./WorldWarModel";
import {
  CARD_MIN_PX,
  CardPlace,
  cardPlace,
  placeStyle,
  samePlace,
} from "./WwArmyCard";
import { WwDrawerEvent } from "./WwDrawer";
import {
  ensureNukeFlow,
  strikeFlowOf,
  WwStrikeFlowChangedEvent,
} from "./WwNukeFlow";
import { seaAirOf, WwSeaAirChangedEvent } from "./WwSeaAirController";
import { renderStrikePanel, strikeCardActive } from "./WwStrikeCard";

/** −/+ move a slider by this many planes. */
export const AIR_STEP = 10;
/** A sent value shows until the engine's answer arrives, at most this long. */
const PENDING_MS = 2000;
const GAP = 8;
/** Spec §18.6: the card's height is at most this share of the screen. */
export const ZONE_CARD_MAX_SHARE = 0.45;

/** The zone card's place: the land cards' spot, up to 45% of the screen tall. */
export function zoneCardPlace(): CardPlace {
  const p = cardPlace();
  const h = window.innerHeight;
  return {
    ...p,
    maxHeight: Math.max(
      CARD_MIN_PX,
      Math.min(
        Math.floor(h * ZONE_CARD_MAX_SHARE),
        h - p.bottom - WW_BAND_PX - 2 * GAP,
      ),
    ),
  };
}

const SLIDER_STYLE = html`<style>
  .ww-air-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 36px;
    background: transparent;
  }
  .ww-air-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: rgb(255 255 255 / 0.15);
  }
  .ww-air-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 36px;
    height: 36px;
    margin-top: -15px;
    border-radius: 9999px;
    background: rgb(56 189 248);
    border: 3px solid rgb(17 24 39);
  }
  .ww-air-slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: rgb(255 255 255 / 0.15);
  }
  .ww-air-slider::-moz-range-thumb {
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    background: rgb(56 189 248);
    border: 3px solid rgb(17 24 39);
  }
</style>`;

@customElement("ww-air-zone-card")
export class WwAirZoneCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private place: CardPlace = {
    bottom: GAP,
    right: null,
    maxWidth: 560,
    maxHeight: CARD_MIN_PX,
  };
  @state() private collapsed = false;
  /** The mission each row's slider sets, by type (default: the busiest). */
  @state() private picked = new Map<AirType, AirMission>();
  /** A slider being dragged: its type and value (shown, not sent). */
  @state() private dragging: { type: AirType; value: number } | null = null;
  /** The row whose value was refused, and why. */
  @state() private refused: { type: AirType; block: WwOrderBlock } | null =
    null;
  /** Values sent but not yet back, by `${type}:${mission}`. */
  private readonly pending = new Map<string, { value: number; at: number }>();
  private shownSr = 0;
  /** Deployments I switched to night bombing here (the engine keeps the truth). */
  private readonly night = new Map<number, boolean>();
  private redrawKey: readonly unknown[] = [];

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwSeaAirChangedEvent, () => this.redraw());
    this.eventBus.on(WwStrikeFlowChangedEvent, () => this.requestUpdate());
    this.eventBus.on(WwDrawerEvent, () => {
      void this.updateComplete.then(() =>
        requestAnimationFrame(() => this.refit()),
      );
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    if ((this.game?.worldWarScenario() ?? null) === null) return;
    const { selection } = seaAirOf(this.game);
    if (selection.sr === 0) {
      if (this.shownSr !== 0) this.redraw();
      return;
    }
    this.refit();
    const key = [
      selection.version,
      strikeFlowOf(this.game).version,
      this.game.wwDepth?.()?.version,
      this.game.wwAir?.()?.version,
      this.game.wwEconomy?.()?.version,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.sync();
      this.requestUpdate();
    }
  }

  private sync() {
    const sr = seaAirOf(this.game).selection.sr;
    if (sr !== this.shownSr) {
      this.shownSr = sr;
      this.picked = new Map();
      this.refused = null;
      this.dragging = null;
      this.pending.clear();
    }
  }

  private redraw() {
    this.sync();
    if (seaAirOf(this.game).selection.sr !== 0) this.refit();
    this.requestUpdate();
  }

  private refit() {
    const next = zoneCardPlace();
    if (!samePlace(next, this.place)) this.place = next;
  }

  private ctx(): { ctx: AirCtx; card: ZoneCardData } | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const p = this.game.myPlayer();
    if (p === null || !p.isAlive() || isCapitulated(this.game, p.smallID())) {
      return null;
    }
    const sr = seaAirOf(this.game).selection.sr;
    if (sr === 0) return null;
    const ctx = airCtx(this.game as unknown as NavyGame);
    const card = ctx === null ? null : zoneCard(ctx, sr, this.picked);
    return ctx === null || card === null ? null : { ctx, card };
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  /** The row's value now: a drag, a value sent and not yet back, else the engine's. */
  private valueFor(ctx: AirCtx, sr: number, row: PlaneRowData): number {
    if (this.dragging?.type === row.type) return this.dragging.value;
    const engine = sliderRange(ctx, sr, row.type, row.mission).value;
    const key = `${row.type}:${row.mission}`;
    const p = this.pending.get(key);
    if (p === undefined) return engine;
    if (p.value === engine || Date.now() - p.at > PENDING_MS) {
      this.pending.delete(key);
      return engine;
    }
    return p.value;
  }

  /** Let go of a slider (or a −/+): one air_deploy with that value, unless refused. */
  private commit(ctx: AirCtx, sr: number, row: PlaneRowData, value: number) {
    this.dragging = null;
    const r = sliderRange(ctx, sr, row.type, row.mission);
    const v = Math.max(0, Math.min(r.max, Math.round(value)));
    if (v === this.valueFor(ctx, sr, row)) {
      this.requestUpdate();
      return;
    }
    const block = deployBlock(ctx, sr, row.type, row.mission, v);
    if (block !== null) {
      this.refused = { type: row.type, block };
      return;
    }
    this.refused = null;
    this.pending.set(`${row.type}:${row.mission}`, {
      value: v,
      at: Date.now(),
    });
    this.send(deployOrder(sr, row.type, row.mission, v));
    this.requestUpdate();
  }

  render() {
    const c = this.ctx();
    // P6 (U4): the rocket and the para / commando raid flows have their own card.
    if (strikeCardActive(this.game)) {
      return renderStrikePanel(
        this.game,
        ensureNukeFlow(this.game, this.eventBus),
        placeStyle(zoneCardPlace()),
      );
    }
    if (c === null) return nothing;
    const d = c.card;
    return html`${SLIDER_STYLE}
      <section
        data-ww-air-zone-card=${d.sr}
        data-collapsed=${String(this.collapsed)}
        aria-label=${d.name}
        class="fixed z-[1001] flex flex-col gap-1 overflow-hidden rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
        style=${placeStyle(this.place)}
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div class="flex shrink-0 items-center gap-2">
          <span class="min-w-0 truncate text-sm font-bold">${d.name}</span>
          <span class="shrink-0 text-white/70"
            >${translateText("ww1936.air.zone_weather", {
              weather: translateText(`ww1936.weather.${d.weather}`),
            })}</span
          >
          ${this.renderSup(d)}
          <button
            type="button"
            data-ww-air-auto
            aria-pressed=${String(d.auto)}
            class="h-9 shrink-0 rounded-md border px-1.5 ${d.auto
              ? "border-sky-300 bg-sky-800/60"
              : "border-white/15 bg-white/5 hover:bg-white/10"}"
            @click=${() =>
              this.send({ kind: "air_auto", sr: d.sr, on: !d.auto })}
          >
            🤖 ${translateText("ww1936.air.btn_auto")}
          </button>
          <button
            type="button"
            data-ww-card-fold=${this.collapsed ? "open" : "fold"}
            class="size-9 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
            aria-label=${translateText(
              this.collapsed
                ? "ww1936.navy.card_expand"
                : "ww1936.navy.card_collapse",
            )}
            @click=${() => (this.collapsed = !this.collapsed)}
          >
            ${this.collapsed ? "▴" : "▾"}
          </button>
          <button
            type="button"
            data-ww-card-close
            class="size-9 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
            aria-label=${translateText("common.close")}
            @click=${() => this.eventBus.emit(new WwAirZoneSelectedEvent(0))}
          >
            ✕
          </button>
        </div>
        ${this.collapsed ? nothing : this.renderBody(c)}
      </section>`;
  }

  private renderSup(d: ZoneCardData): TemplateResult {
    const ours = Math.floor(d.ours / 10);
    const theirs = Math.floor(d.theirs / 10);
    return html`<span
      data-ww-zone-sup
      class="flex min-w-0 flex-1 items-center gap-1.5"
      aria-label=${translateText("ww1936.air.zone_sup_vs", { ours, theirs })}
    >
      <span class="shrink-0 tabular-nums text-emerald-300"
        >${translateText("ww1936.air.zone_sup", { pct: ours })}</span
      >
      <span
        class="flex h-1.5 min-w-8 flex-1 overflow-hidden rounded bg-white/10"
      >
        <span class="h-1.5 bg-emerald-400" style="width: ${ours}%"></span>
        <span class="ml-auto h-1.5 bg-red-500" style="width: ${theirs}%"></span>
      </span>
      <span class="shrink-0 tabular-nums text-red-300">${theirs}%</span>
    </span>`;
  }

  private renderBody(c: { ctx: AirCtx; card: ZoneCardData }): TemplateResult {
    const d = c.card;
    // P6 (plan decision 19): the enemy planes seen, through the fog.
    const fog = fogModelOf(this.game);
    const seen = (n: number) => (fog.fogOff() ? n : fog.countLabel(0, n));
    return html`<div
        data-ww-zone-info
        class="flex shrink-0 flex-wrap gap-x-2 text-white/80"
      >
        <span data-ww-zone-enemy
          >${d.enemySeen.length === 0
            ? translateText("ww1936.air.zone_enemy_none")
            : translateText("ww1936.air.zone_enemy_seen", {
                list: d.enemySeen
                  .map(([t, n]) => `${EQUIPMENT_ICONS[t]}${seen(n)}`)
                  .join(" "),
              })}</span
        >
        <span data-ww-zone-bases
          >${translateText("ww1936.air.zone_bases", {
            used: d.bases.used,
            cap: d.bases.cap,
          })}</span
        >
        ${d.kind === "land"
          ? html`<span data-ww-zone-defence
              >${translateText("ww1936.air.zone_defence", {
                aa: d.aa,
                radar: d.radar,
              })}</span
            >`
          : nothing}
      </div>
      <ul
        data-ww-zone-rows
        class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0"
      >
        ${d.rows.length === 0
          ? html`<li class="text-white/60">
              ${translateText("ww1936.air.rows_none")}
            </li>`
          : d.rows.map((r) => this.renderRow(c, r))}
      </ul>
      ${this.renderStrike(c)} ${this.renderResult(d)}`;
  }

  /** P6 (spec §20.9): the bomb and precision raid buttons, and the flow's preview. */
  private renderStrike(c: { ctx: AirCtx; card: ZoneCardData }): TemplateResult {
    if (c.card.kind !== "land") return html`${nothing}`;
    const model = new DepthIndustryModel(this.game);
    const flow = ensureNukeFlow(this.game, this.eventBus);
    const st = strikeFlowOf(this.game);
    const sr = c.card.sr;
    const block = model.nukeStartBlock(sr);
    const active = st.step !== "idle";
    const bomber = [...(this.game.wwAir?.()?.deployments.values() ?? [])].find(
      (d) =>
        d.owner === c.ctx.me &&
        d.sr === sr &&
        d.mission === "strategic_bombing" &&
        model.zoneTargets(sr).length > 0,
    );
    const prev = flow.preview();
    return html`<div
      data-ww-strike
      class="flex shrink-0 flex-wrap items-center gap-1"
    >
      <button
        type="button"
        data-ww-nuke-start
        class="h-9 shrink-0 rounded-md border border-red-400/60 bg-red-950/50 px-2 disabled:opacity-40"
        ?disabled=${block !== null}
        title=${block === null ? "" : blockText(block)}
        @click=${() => flow.start("nuke", sr)}
      >
        ☢ ${translateText("ww1936.nuke.drop")}
      </button>
      ${bomber === undefined
        ? nothing
        : html`<button
            type="button"
            data-ww-raid-start
            class="h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2"
            @click=${() => flow.start("raid_bomb", bomber.id)}
          >
            🎯 ${translateText("ww1936.raid_ui.precision")}
          </button>`}
      ${active
        ? html`<button
            type="button"
            data-ww-strike-cancel
            class="h-9 shrink-0 rounded-md border border-white/15 px-2"
            @click=${() => flow.cancel()}
          >
            ${translateText("common.cancel")}
          </button>`
        : nothing}
      ${st.kind === "nuke" && st.step === "target"
        ? html`<span data-ww-hint="nuke" class="text-amber-200"
            >${translateText("ww1936.nuke.pick_region")}</span
          >`
        : nothing}
      ${prev !== null && (st.step === "preview" || st.step === "ready")
        ? html`<span data-ww-nuke-preview class="tabular-nums text-amber-100"
            >${translateText("ww1936.nuke.preview", {
              factories: prev.factories,
              destroyed: prev.destroyed,
              stopped: prev.stopped,
              divisions: prev.divisions,
              pct: Math.floor(prev.interceptPm / 10),
            })}</span
          >`
        : nothing}
      ${st.kind === "nuke" && st.step === "ready"
        ? html`<button
            type="button"
            data-ww-nuke-confirm
            class="h-9 shrink-0 rounded-md border border-red-400 bg-red-900/70 px-2 font-semibold"
            @click=${() => flow.confirmDrop()}
          >
            ${flow.confirmArmed()
              ? translateText("ww1936.econ.cancel_tap")
              : translateText("ww1936.nuke.confirm")}
          </button>`
        : nothing}
      ${st.kind === "raid_bomb" && st.step === "setup"
        ? html`${flow
              .raidBuildings()
              .map(
                (b) =>
                  html`<button
                    type="button"
                    data-ww-raid-building=${b}
                    aria-pressed=${String(st.building === b)}
                    class="h-9 shrink-0 rounded-md border px-1.5 ${st.building ===
                    b
                      ? "border-sky-300 bg-sky-800/60"
                      : "border-white/15 bg-white/5"}"
                    @click=${() => flow.setBuilding(b)}
                  >
                    ${buildingName(b)}
                  </button>`,
              )}
            <button
              type="button"
              data-ww-raid-confirm
              class="h-9 shrink-0 rounded-md border border-red-400 bg-red-900/70 px-2 font-semibold"
              @click=${() => flow.confirmRaid()}
            >
              ${flow.raidArmed()
                ? translateText("ww1936.econ.cancel_tap")
                : translateText("ww1936.raid_ui.confirm")}
            </button>`
        : nothing}
    </div>`;
  }

  private renderRow(
    c: { ctx: AirCtx; card: ZoneCardData },
    row: PlaneRowData,
  ): TemplateResult {
    const sr = c.card.sr;
    const range = sliderRange(c.ctx, sr, row.type, row.mission);
    const value = this.valueFor(c.ctx, sr, row);
    const free = Math.max(0, range.max - value);
    const gens = row.gens
      .map((n, i) => (n > 0 ? `${genName(i + 1)} ${n}` : ""))
      .filter((x) => x !== "")
      .join(" · ");
    const refused = this.refused?.type === row.type ? this.refused.block : null;
    return html`<li
      data-ww-plane-row=${row.type}
      class="rounded-md border border-white/10 bg-white/5 p-1"
    >
      <div class="flex flex-wrap items-center gap-1">
        <span class="shrink-0" aria-hidden="true"
          >${EQUIPMENT_ICONS[row.type]}</span
        >
        <span class="min-w-0 shrink truncate font-semibold"
          >${airTypeName(row.type)}</span
        >
        <span class="min-w-0 truncate text-white/60">${gens}</span>
        ${row.missions.length === 0
          ? html`<span class="text-white/60"
              >${translateText("ww1936.air.no_mission")}</span
            >`
          : row.missions.map(
              (m) =>
                html`<button
                  type="button"
                  data-ww-air-mission=${`${row.type}:${m.mission}`}
                  aria-pressed=${String(m.mission === row.mission)}
                  class="h-9 shrink-0 rounded-md border px-1.5 ${m.mission ===
                  row.mission
                    ? "border-sky-300 bg-sky-800/60"
                    : "border-white/15 bg-white/5 hover:bg-white/10"}"
                  @click=${() => {
                    const next = new Map(this.picked);
                    next.set(row.type, m.mission);
                    this.picked = next;
                    this.refused = null;
                  }}
                >
                  ${AIR_MISSION_ICONS[m.mission]}
                  ${airMissionName(m.mission)}${m.count > 0
                    ? ` ${m.count}`
                    : ""}
                </button>`,
            )}
      </div>
      ${row.missions.length === 0
        ? nothing
        : html`<div class="flex items-center gap-1">
            <button
              type="button"
              data-ww-air-step=${`${row.type}:down`}
              aria-label=${translateText("ww1936.econ.fewer")}
              class="size-9 shrink-0 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30"
              ?disabled=${value <= 0}
              @click=${() => this.commit(c.ctx, sr, row, value - AIR_STEP)}
            >
              −
            </button>
            <input
              type="range"
              data-ww-air-slider=${row.type}
              class="ww-air-slider min-w-0 flex-1"
              min="0"
              max=${range.max}
              step="1"
              .value=${String(value)}
              aria-label=${`${airTypeName(row.type)} · ${airMissionName(row.mission)}`}
              @input=${(e: Event) => {
                this.dragging = {
                  type: row.type,
                  value: Number((e.target as HTMLInputElement).value),
                };
              }}
              @change=${(e: Event) =>
                this.commit(
                  c.ctx,
                  sr,
                  row,
                  Number((e.target as HTMLInputElement).value),
                )}
            />
            <button
              type="button"
              data-ww-air-step=${`${row.type}:up`}
              aria-label=${translateText("ww1936.econ.more")}
              class="size-9 shrink-0 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30"
              ?disabled=${value >= range.max}
              @click=${() => this.commit(c.ctx, sr, row, value + AIR_STEP)}
            >
              +
            </button>
            <span
              data-ww-air-count=${row.type}
              class="w-16 shrink-0 text-center tabular-nums"
              >${translateText("ww1936.air.slider_count", {
                n: value,
                free,
              })}</span
            >
            <button
              type="button"
              data-ww-air-recall=${row.type}
              class="h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-1.5 hover:bg-white/10 disabled:opacity-30"
              ?disabled=${row.gens.every((n) => n === 0)}
              @click=${() =>
                this.send({ kind: "air_recall", sr, type: row.type })}
            >
              ${translateText("ww1936.air.btn_recall")}
            </button>
            ${this.renderNight(c, row)}
          </div>`}
      ${refused === null
        ? nothing
        : html`<p data-ww-block=${refused} class="m-0 text-red-300">
            🔒 ${blockText(refused)}
          </p>`}
    </li>`;
  }

  /** P6: the [Night] toggle of a bomber row's deployments and its aces' stars. */
  private renderNight(
    c: { ctx: AirCtx; card: ZoneCardData },
    row: PlaneRowData,
  ): TemplateResult {
    const bombers = row.type === "bomber" || row.type === "strat_bomber";
    const deps = [...(this.game.wwAir?.()?.deployments.values() ?? [])].filter(
      (d) => d.owner === c.ctx.me && d.sr === c.card.sr && d.type === row.type,
    );
    const ids = new Set(deps.map((d) => d.id));
    const aces = (this.game.wwDepth?.()?.acesData ?? []).filter((a) =>
      ids.has(a.deployment),
    ).length;
    const on = deps.length > 0 && deps.every((d) => this.night.get(d.id));
    return html`${aces > 0
      ? html`<span data-ww-aces=${row.type} class="shrink-0 text-amber-300"
          >${"★".repeat(Math.min(5, aces))}</span
        >`
      : nothing}
    ${bombers && deps.length > 0
      ? html`<button
          type="button"
          data-ww-air-night=${row.type}
          aria-pressed=${String(on)}
          class="h-9 shrink-0 rounded-md border px-1.5 ${on
            ? "border-indigo-300 bg-indigo-900/60"
            : "border-white/15 bg-white/5"}"
          @click=${() => {
            for (const d of deps) {
              this.night.set(d.id, !on);
              this.send({ kind: "air_night", deployment: d.id, on: !on });
            }
            this.requestUpdate();
          }}
        >
          🌙
          ${translateText(
            on ? "ww1936.raid_ui.night_on" : "ww1936.raid_ui.night_off",
          )}
        </button>`
      : nothing}`;
  }

  private renderResult(d: ZoneCardData): TemplateResult {
    const r = d.result;
    return html`<div data-ww-zone-result class="shrink-0 text-white/80">
      <span class="font-semibold"
        >${translateText("ww1936.air.result_title")}:</span
      >
      ${r === null
        ? translateText("ww1936.air.result_none")
        : html`${translateText("ww1936.air.result_line", {
            kills: r.shotDown,
            lost: r.lost,
          })}
          ${r.casHitsCenti > 0
            ? html` ·
              ${translateText("ww1936.air.result_cas", {
                n: Math.round(r.casHitsCenti / 100),
              })}`
            : nothing}
          ${r.bombPoints > 0
            ? html` ·
              ${translateText("ww1936.air.result_bomb", { n: r.bombPoints })}`
            : nothing}
          ${r.navalDamageMilli > 0
            ? html` ·
              ${translateText("ww1936.air.result_naval", {
                n: Math.round(r.navalDamageMilli / 1000),
              })}`
            : nothing}`}
    </div>`;
  }
}
