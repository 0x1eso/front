// World War 1936 P4 (spec §18.3-4, §18.6, §18.11): the chosen air zone's
// card, bottom centre, at most 45% of the screen tall (only its rows
// scroll) — the zone's name and weather, our air control against the
// enemy's, the enemy planes seen, our bases in range and our anti-air and
// radar; my wings flying over it, by mission; yesterday's results.
import type { WwOrder } from "@openfront/engine-api/Schemas";
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
  zoneCard,
  ZoneCardData,
} from "./AirModel";
import { DepthIndustryModel, offered } from "./DepthIndustryModel";
import { blockText, buildingName, EQUIPMENT_ICONS } from "./EconomyModel";
import { fogModelOf } from "./FogModel";
import { NavyGame } from "./NavyModel";
import { WwAirZoneSelectedEvent } from "./SeaAirSelection";
import { missionOf } from "./WingModel";
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
  /**
   * Final review C (M1): the zone whose greyed ☢ button was tapped — its
   * reason shows as a line (a title is hover-only, and a phone has none).
   */
  @state() private nukeWhy = 0;
  private shownSr = 0;
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
    const card = ctx === null ? null : zoneCard(ctx, sr);
    return ctx === null || card === null ? null : { ctx, card };
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
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
    return html` <section
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

  /** ww8: my wings flying over a zone, by mission. */
  private renderWingsOver(c: {
    ctx: AirCtx;
    card: ZoneCardData;
  }): TemplateResult {
    const by = new Map<number, number>();
    for (const w of c.ctx.air.wings.values()) {
      if (w.owner !== c.ctx.me || w.flySr !== c.card.sr || w.flyMission < 0) {
        continue;
      }
      by.set(w.flyMission, (by.get(w.flyMission) ?? 0) + w.planes);
    }
    const rows = [...by.entries()].sort(([x], [y]) => x - y);
    return html`<ul
      data-ww-zone-rows
      class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0"
    >
      ${rows.length === 0
        ? html`<li class="text-white/60">
            ${translateText("ww1936.wing.zone_none")}
          </li>`
        : rows.map(
            ([m, n]) =>
              html`<li data-ww-zone-wings=${m}>
                ${AIR_MISSION_ICONS[missionOf(m)]}
                ${airMissionName(missionOf(m))} · ${n}
              </li>`,
          )}
    </ul>`;
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
            count: d.bases.count,
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
      ${this.renderWingsOver(c)} ${this.renderStrike(c)} ${this.renderResult(d)}`;
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
    // ww8: in the wing model the raid rides a bomber wing of mine whose order aims into this zone.
    const air = this.game.wwAir?.();
    const bomber = [...(air?.wings.values() ?? [])].find(
      (w) =>
        w.owner === c.ctx.me &&
        w.sr === sr &&
        w.mission >= 0 &&
        missionOf(w.mission) === "strategic_bombing" &&
        offered(model.zoneTargets(sr)).length > 0,
    );
    const prev = flow.preview();
    return html`<div
      data-ww-strike
      class="flex shrink-0 flex-wrap items-center gap-1"
    >
      <button
        type="button"
        data-ww-nuke-start
        class="h-9 shrink-0 rounded-md border border-red-400/60 bg-red-950/50 px-2 ${block ===
        null
          ? ""
          : "opacity-40"}"
        aria-disabled=${block === null ? "false" : "true"}
        @click=${() => {
          if (block !== null) {
            this.nukeWhy = sr;
            return;
          }
          this.nukeWhy = 0;
          flow.start("nuke", sr);
        }}
      >
        ☢ ${translateText("ww1936.nuke.drop")}
      </button>
      ${block !== null && this.nukeWhy === sr
        ? html`<span data-ww-nuke-why=${block} class="text-red-300"
            >🔒 ${blockText(block)}</span
          >`
        : nothing}
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
              ? translateText("ww1936.nuke.confirm_tap")
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
                ? translateText("ww1936.raid_ui.confirm")
                : translateText("ww1936.raid_ui.raid")}
            </button>`
        : nothing}
    </div>`;
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
