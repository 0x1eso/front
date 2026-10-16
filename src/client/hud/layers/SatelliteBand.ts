import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  INTERCEPTOR_NUKES,
  InterceptorNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import {
  interceptHitPct,
  SATELLITE_STRIKE_DELAY_TICKS,
  strikeSecondsLeft,
} from "@openfront/engine-lib/strategic/Strategic";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import {
  isLastSeconds,
  StrategicFxTracker,
} from "../../render/frame/derive/StrategicFx";
import { SendInterceptSatelliteIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import { interceptIcon, satelliteIcon } from "../HotbarIcons";
import { OpenSatelliteTargetPickerEvent } from "./SatelliteTargetPicker";

const UNIT_KEYS: Readonly<Record<InterceptorNuke, string>> = {
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
};

/** How long an interception result stays on the band, in ticks. */
export const RESULT_TICKS = { hit: 25, miss: 20 } as const;

/** The target's edge flash lasts this many ticks (0.5 s). */
export const FLASH_TICKS = 5;

/** Edge flash opacity 0..1 at `now` for a flash ending at `untilTick`. */
export function flashOpacity(untilTick: number, now: number): number {
  return Math.max(0, Math.min(1, (untilTick - now) / FLASH_TICKS));
}

/** A resolved interception shown on the band for a moment. */
export interface BandResult {
  hit: boolean;
  untilTick: number;
}

/** Results still showing at `now`. */
export function liveResults(
  results: readonly BandResult[],
  now: number,
): BandResult[] {
  return results.filter((r) => r.untilTick > now);
}

/** One satellite strike counting down. */
interface Countdown {
  attacker: PlayerView;
  target: PlayerView | null;
  strikeTick: number;
  inFlight: number;
}

/**
 * Strategic weapons (spec §6.2-6.3, §7): a slim band at the top of every
 * screen while a satellite strike counts down — who strikes whom, the
 * seconds left on a bar, interceptors in flight, and the intercept buttons
 * (each bomb's stock and odds; two taps fire). The satellite's owner also
 * gets a row that opens the target picker while it waits in orbit. Nothing
 * covers the map.
 */
@customElement("satellite-band")
export class SatelliteBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /** "attackerId:type" of the intercept button waiting for its second tap. */
  private armed: string | null = null;

  /** Spec 6.6: hit/miss of interceptors, inferred from the satellite's state. */
  private fx = new StrategicFxTracker();
  private results: BandResult[] = [];
  private flashUntil = 0;

  createRenderRoot() {
    return this;
  }

  tick() {
    if (!this.game?.config().strategicWeapons()) return;
    const now = this.game.ticks();
    const ev = this.fx.update(
      this.game.playerViews(),
      now,
      this.game.myPlayer()?.smallID() ?? 0,
      () => null,
      this.game.updatesSinceLastTick()?.[GameUpdateType.OrbitalStrike] ?? [],
    );
    // Only the struck player's screen edge flashes, once, on the first wave.
    if (ev.strikeStarts.includes(true)) this.flashUntil = now + FLASH_TICKS;
    for (const hit of ev.interceptResults) {
      this.results.push({
        hit,
        untilTick: now + (hit ? RESULT_TICKS.hit : RESULT_TICKS.miss),
      });
    }
    if (this.results.length > 0) {
      this.results = liveResults(this.results, now).slice(-3);
    }
    this.requestUpdate();
  }

  private countdowns(): Countdown[] {
    const rows: Countdown[] = [];
    for (const p of this.game.playerViews()) {
      const sat = p.strategicData()?.satellite;
      if (sat?.phase !== "targeted") continue;
      const target = this.game.playerBySmallID(sat.target);
      rows.push({
        attacker: p,
        target: target.isPlayer() ? target : null,
        strikeTick: sat.strikeTick,
        inFlight: sat.interceptors.length,
      });
    }
    return rows;
  }

  private hasStock(me: PlayerView): boolean {
    const stock = me.strategicData()?.stock;
    return INTERCEPTOR_NUKES.some((t) => (stock?.[t] ?? 0) > 0);
  }

  private hasReadySilo(me: PlayerView): boolean {
    return me
      .units(UnitType.MissileSilo)
      .some(
        (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
      );
  }

  private onIntercept(attacker: PlayerView, type: InterceptorNuke): void {
    const key = `${attacker.id()}:${type}`;
    if (this.armed === key) {
      this.armed = null;
      this.eventBus.emit(
        new SendInterceptSatelliteIntentEvent(attacker.id(), type),
      );
    } else {
      this.armed = key;
    }
    this.requestUpdate();
  }

  render() {
    if (!this.game?.config().strategicWeapons()) return null;
    const me = this.game.myPlayer();
    const rows = this.countdowns();
    // A second tap only counts on a row that is still counting down.
    if (
      this.armed !== null &&
      !rows.some((c) => this.armed?.startsWith(`${c.attacker.id()}:`))
    ) {
      this.armed = null;
    }
    const inOrbit = me?.strategicData()?.satellite.phase === "orbit";
    const results = liveResults(this.results, this.game.ticks());
    const flash = flashOpacity(this.flashUntil, this.game.ticks());
    if (rows.length === 0 && !inOrbit && results.length === 0 && flash === 0) {
      return null;
    }
    return html`
      ${flash > 0
        ? html`<div
            data-edge-flash
            class="fixed inset-0 pointer-events-none z-[1001]"
            style="opacity: ${flash}; box-shadow: inset 0 0 70px 14px rgba(255, 30, 20, 0.75)"
          ></div>`
        : null}
      <div
        data-satellite-band
        class="fixed top-2 left-1/2 -translate-x-1/2 z-[1002] w-[min(26rem,calc(100vw-32px))] flex flex-col gap-1 text-white text-sm"
      >
        ${inOrbit ? this.renderOrbit() : null}
        ${rows.map((c) => this.renderCountdown(c, me))}
        ${results.map((r) => this.renderResult(r))}
      </div>
    `;
  }

  private renderResult(r: BandResult) {
    const left = r.untilTick - this.game.ticks();
    const total = r.hit ? RESULT_TICKS.hit : RESULT_TICKS.miss;
    const opacity = Math.max(0, Math.min(1, left / (total / 2)));
    return html`
      <div
        data-result=${r.hit ? "hit" : "miss"}
        class="relative flex items-center justify-center gap-2 rounded-md bg-gray-900/85 border px-3 py-1 font-bold ${r.hit
          ? "border-amber-400 text-amber-300"
          : "border-gray-500 text-gray-300"}"
        style="opacity: ${opacity}"
      >
        ${r.hit
          ? html`<span
              data-burst
              class="absolute left-3 size-4 rounded-full bg-amber-300 animate-ping"
            ></span>`
          : null}
        ${translateText(r.hit ? "strategic.shot_down" : "strategic.missed")}
      </div>
    `;
  }

  private renderOrbit() {
    return html`
      <div
        data-orbit
        class="flex items-center gap-2 rounded-md bg-gray-900/85 border border-sky-500/60 px-3 py-1"
      >
        <img src=${satelliteIcon} alt="" class="size-5" />
        <span class="flex-1 font-semibold"
          >${translateText("strategic.satellite_ready")}</span
        >
        <button
          type="button"
          data-choose-target
          class="px-3 py-1 text-sm rounded-md font-semibold bg-sky-700 hover:bg-sky-600"
          @click=${() =>
            this.eventBus.emit(new OpenSatelliteTargetPickerEvent())}
        >
          ${translateText("strategic.choose_target")}
        </button>
      </div>
    `;
  }

  private renderCountdown(c: Countdown, me: PlayerView | null) {
    const now = this.game.ticks();
    const left = Math.max(0, c.strikeTick - now);
    const elapsedPct = Math.min(
      100,
      Math.round((1 - left / SATELLITE_STRIKE_DELAY_TICKS) * 100),
    );
    const canShoot =
      me !== null && me.isAlive() && me !== c.attacker && left > 0;
    // The last seconds turn the whole band red (spec 6.6).
    const urgent = isLastSeconds(left);
    return html`
      <div
        data-countdown
        data-urgent=${urgent ? "true" : "false"}
        class="rounded-md border px-3 py-1.5 ${urgent
          ? "bg-red-800/90 border-red-300"
          : "bg-gray-900/85 border-red-500/60"}"
      >
        <div class="flex items-center gap-2">
          <img src=${satelliteIcon} alt="" class="size-5" />
          <span class="flex-1 font-semibold truncate"
            >${translateText("strategic.band", {
              name: c.attacker.displayName(),
              target: c.target?.displayName() ?? "",
            })}</span
          >
          <span data-seconds class="tabular-nums font-bold"
            >${translateText("strategic.seconds_left", {
              seconds: strikeSecondsLeft(c.strikeTick, now),
            })}</span
          >
        </div>
        <div class="h-1.5 mt-1 bg-gray-700 rounded-sm">
          <div
            data-progress
            class="h-1.5 bg-red-500 rounded-sm"
            style="width: ${elapsedPct}%"
          ></div>
        </div>
        ${c.inFlight > 0
          ? html`<div class="mt-1 text-xs text-amber-300">
              ${translateText("strategic.interceptors_in_flight", {
                count: c.inFlight,
              })}
            </div>`
          : null}
        ${canShoot
          ? html`<div class="flex gap-2 mt-1">
                ${INTERCEPTOR_NUKES.map((type) =>
                  this.renderInterceptButton(c.attacker, type, me!),
                )}
              </div>
              ${this.hasStock(me!) && !this.hasReadySilo(me!)
                ? html`<div data-no-silo class="mt-1 text-xs text-amber-300">
                    ${translateText("strategic.no_ready_silo")}
                  </div>`
                : null}`
          : null}
      </div>
    `;
  }

  private renderInterceptButton(
    attacker: PlayerView,
    type: InterceptorNuke,
    me: PlayerView,
  ) {
    const count = me.strategicData()?.stock[type] ?? 0;
    const enabled = count > 0 && this.hasReadySilo(me);
    const armed = this.armed === `${attacker.id()}:${type}`;
    return html`
      <button
        type="button"
        data-intercept=${type}
        class="flex-1 py-1 px-2 text-sm flex items-center justify-center gap-1 rounded-md font-semibold leading-tight text-center bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed ${armed
          ? "ring-2 ring-white"
          : ""}"
        ?disabled=${!enabled}
        @click=${() => this.onIntercept(attacker, type)}
      >
        <img src=${interceptIcon} alt="" class="size-5" />
        ${armed
          ? translateText("strategic.tap_again_to_fire")
          : translateText("strategic.intercept_with", {
              unit: translateText(UNIT_KEYS[type]),
              count,
              pct: interceptHitPct(type),
            })}
      </button>
    `;
  }
}
