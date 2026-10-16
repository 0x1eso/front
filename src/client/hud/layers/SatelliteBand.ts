import { UnitType } from "@openfront/engine-api/game/GameTypes";
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
import { SendInterceptSatelliteIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import { interceptIcon, satelliteIcon } from "../HotbarIcons";
import { OpenSatelliteTargetPickerEvent } from "./SatelliteTargetPicker";

const UNIT_KEYS: Readonly<Record<InterceptorNuke, string>> = {
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
};

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

  createRenderRoot() {
    return this;
  }

  tick() {
    if (this.game?.config().strategicWeapons()) this.requestUpdate();
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
    if (rows.length === 0 && !inOrbit) return null;
    return html`
      <div
        data-satellite-band
        class="fixed top-2 left-1/2 -translate-x-1/2 z-[1002] w-[min(26rem,calc(100vw-32px))] flex flex-col gap-1 text-white text-sm"
      >
        ${inOrbit ? this.renderOrbit() : null}
        ${rows.map((c) => this.renderCountdown(c, me))}
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
          class="min-h-11 px-4 rounded-md font-semibold bg-sky-700 hover:bg-sky-600"
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
    return html`
      <div
        data-countdown
        class="rounded-md bg-gray-900/85 border border-red-500/60 px-3 py-1.5"
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
        class="flex-1 min-h-11 px-2 flex items-center justify-center gap-1 rounded-md font-semibold leading-tight text-center bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed ${armed
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
