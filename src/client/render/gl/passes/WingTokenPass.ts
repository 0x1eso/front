/**
 * WingTokenPass — ww8 (air overhaul design §8.2): the air wings on the map.
 *
 * With the air layer on a wing is a token at its base (the owner's colour,
 * the plane silhouette, the plane count, a strength bar, an experience bar
 * for my own wings, the mission icon and a state icon); a base with three
 * wings or more is one group chip, a tap on it opens it into a fan. With
 * the layer off each base shows one small chip, and only a chosen wing
 * keeps its token. Zoomed out a token is a "plane N" chip, then a dot.
 *
 * Every wing goes through the fog (layoutWings asks FogModel.wingView): a
 * hidden wing gets no instance. Instances are rewritten only when the view,
 * the fog, the choice, the zoom step or the game tick changed.
 */

import {
  AIR_MISSIONS,
  WP_GROUND,
  WP_REARM,
} from "@openfront/engine-api/ww1936/AirTypes";
import { fogOfAir } from "../../../hud/ww1936/FogModel";
import {
  layoutWings,
  SLOT_GROUP,
  SLOT_TOKEN,
  wingPhase,
  type WingSlot,
  wingStrengthPm,
} from "../../../view/WingTokenLayout";
import type { WwAirView } from "../../../view/WwAirView";
import type { WwNavyView } from "../../../view/WwNavyView";
import {
  KIND_CHIP,
  KIND_TOKEN,
  numberGlyphs,
  SHIP_CELL,
  ShipSpriteBatch,
  type ShipSpriteProgram,
  ST_BATTLE,
  ST_REPAIR,
  TEXT_MAX_GLYPHS,
  TEXT_OWNER,
  TOKEN_CHOSEN,
} from "./FleetTokenPass";

/** The mission icon cell of each AIR_MISSIONS entry (-1: none). */
const MISSION_CELLS: readonly number[] = AIR_MISSIONS.map((m) => {
  switch (m) {
    case "air_superiority":
    case "interception":
    case "naval_patrol":
    case "recon":
      return SHIP_CELL.patrol;
    case "cas":
    case "naval_strike":
    case "port_strike":
      return SHIP_CELL.strike;
    case "strategic_bombing":
      return SHIP_CELL.raid;
    case "escort":
      return SHIP_CELL.escort;
    default:
      return SHIP_CELL.invasion_support;
  }
});

/** The mission icon cell of a mission index, -1 for none. */
export function airMissionCell(mission: number): number {
  return MISSION_CELLS[mission] ?? -1;
}

export class WingTokenPass {
  private batch: ShipSpriteBatch;
  private readonly slots: WingSlot[] = [];
  private readonly glyphs: number[] = new Array(TEXT_MAX_GLYPHS).fill(0);
  private readonly fighting = new Set<number>();
  private key = "";

  constructor(
    gl: WebGL2RenderingContext,
    private sprites: ShipSpriteProgram,
  ) {
    this.batch = new ShipSpriteBatch(gl);
  }

  /** Instances the last update wrote (tests read it). */
  get drawn(): number {
    return this.batch.drawn;
  }

  /** The instance floats as the last update wrote them (tests: no hidden wing's place is in them). */
  get floats(): Float32Array {
    return this.batch.floats;
  }

  /** The slots of the last update: what a tap hits. */
  get placed(): readonly WingSlot[] {
    return this.slots;
  }

  update(
    air: WwAirView,
    navy: WwNavyView | null,
    tickF: number,
    zoom: number,
    airLayer: boolean,
    chosen: ReadonlySet<number>,
    expanded: ReadonlySet<number>,
    nowMs: number,
  ): void {
    const fog = fogOfAir(air);
    const tick = Math.floor(tickF);
    const key = [
      air.version,
      air.live ? 1 : 0,
      navy?.version ?? -1,
      fog?.stamp() ?? -1,
      Math.round(zoom * 20),
      tick,
      airLayer ? 1 : 0,
      air.activeFights(nowMs),
      [...chosen].join(","),
      [...expanded].join(","),
    ].join("|");
    if (key === this.key) return;
    this.key = key;
    const b = this.batch;
    const n = layoutWings(
      air,
      navy,
      fog,
      { zoom, airLayer, chosen, expanded },
      this.slots,
    );
    this.fighting.clear();
    air.eachFight(nowMs, (sr, sides) => {
      for (const side of sides) {
        if (fog === undefined || fog.fightVisible(sr, side)) {
          this.fighting.add(sr);
        }
      }
    });
    b.begin(n);
    // The chosen wings last, on top.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const s = this.slots[i];
        const isChosen = s.kind === SLOT_TOKEN && chosen.has(s.wing);
        if (isChosen === (pass === 1)) this.write(air, s, isChosen, tick);
      }
    }
    b.upload();
  }

  private write(
    air: WwAirView,
    s: WingSlot,
    chosen: boolean,
    tick: number,
  ): void {
    const b = this.batch;
    const x = s.x + 0.5;
    const y = s.y + 0.5;
    if (s.kind === SLOT_GROUP) {
      // A group chip: the plane silhouette and how many wings it holds.
      b.putToken(
        x,
        y,
        KIND_CHIP,
        s.owner,
        SHIP_CELL.plane,
        s.wings,
        -1,
        -1,
        -1,
        0,
        0,
      );
      return;
    }
    if (s.kind !== SLOT_TOKEN || s.lod > 0) {
      let k = 1;
      if (s.kind !== SLOT_TOKEN || s.lod === 1) {
        k = numberGlyphs(SHIP_CELL.plane, s.planes, this.glyphs);
      } else {
        this.glyphs[0] = SHIP_CELL.plane;
      }
      b.putText(x, y, s.owner, this.glyphs, k, TEXT_OWNER);
      return;
    }
    const brief = air.wingBriefs.get(s.wing);
    const detail = air.wings.get(s.wing);
    const phase =
      brief === undefined
        ? WP_GROUND
        : wingPhase(brief, air.flights.get(s.wing), tick);
    let state = 0;
    if (phase === WP_REARM) state |= ST_REPAIR;
    if (
      brief !== undefined &&
      phase !== WP_GROUND &&
      phase !== WP_REARM &&
      this.fighting.has(brief.flySr)
    ) {
      state |= ST_BATTLE;
    }
    const mission =
      brief === undefined
        ? -1
        : phase === WP_GROUND || phase === WP_REARM
          ? (detail?.mission ?? -1)
          : brief.flyMission;
    b.putToken(
      x,
      y,
      KIND_TOKEN,
      s.owner,
      SHIP_CELL.plane,
      s.planes,
      brief === undefined ? -1 : wingStrengthPm(brief, s.planes),
      detail === undefined ? -1 : detail.xpMilli,
      airMissionCell(mission),
      state,
      chosen ? TOKEN_CHOSEN : 0,
    );
  }

  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    if (this.batch.drawn === 0) return;
    this.sprites.bind(cam, tilesPerPx, timeSec);
    this.batch.draw();
  }

  dispose(): void {
    this.batch.dispose();
  }
}
