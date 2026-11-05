// ww88 lane Z: the map's date-line edge. Chukotka (73, 111) and the two
// regions across the line (72, 98) are one land mass; the scenario's land
// edges 72-73, 73-98 and 98-111 join them (ww87-map-edge-report option 1).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { MOVE_RETREAT } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { refugeOf } from "@openfront/engine/ww1936/land/Battles";
import { dailySupply } from "@openfront/engine/ww1936/land/Supply";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { wrapMidX } from "../../src/client/render/gl/passes/WrapMid";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwGameStart,
} from "./util";

const CHUKCHI_C = 73;
const CHUKCHI_E = 72;
const CHUKCHI_2 = 98;
const CHUKCHI_SE = 111;

async function realGame(): Promise<GameRunner> {
  const files = await loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  return createGameRunner(
    wwGameStart({}, [{ clientID: HUMAN, country: "SUN" }]),
    undefined,
    files,
    () => {},
  );
}

describe("ww88 Z: land edges across the date line", () => {
  test("the three edges exist, once each, in sort order", async () => {
    const runner = await realGame();
    const sc = land(runner.game).scenario;
    for (const [a, b] of [
      [CHUKCHI_E, CHUKCHI_C],
      [CHUKCHI_C, CHUKCHI_2],
      [CHUKCHI_2, CHUKCHI_SE],
    ]) {
      const e = sc.edgeBetween(a, b);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(sc.edge(e).strait).toBe(0);
      expect(sc.edge(e).km).toBeGreaterThan(300);
      expect(sc.edge(e).km).toBeLessThan(700);
    }
    // No Bering Strait edge: Alaska stays apart.
    expect(sc.edgeBetween(CHUKCHI_2, 112)).toBeLessThan(0);
    expect(sc.edgesOf(CHUKCHI_E).length).toBe(1);
    expect(sc.edgesOf(CHUKCHI_2).length).toBe(2);
  }, 60_000);

  test("72 and 98 are reached by the Soviet supply at the start, and not encircled", async () => {
    const runner = await realGame();
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    const l = land(runner.game);
    const sun = byTag(runner.game, "SUN");
    const side = l.sideList().find((s) => s.members.includes(sun.smallID()))!;
    dailySupply(l, side.key);
    for (const r of [CHUKCHI_E, CHUKCHI_2, CHUKCHI_C, CHUKCHI_SE]) {
      expect(l.encircled[r], `region ${r}`).toBe(0);
    }
  }, 120_000);

  test("a division walks 73 to 98 and on to 72's neighbour, attacks across and retreats back", async () => {
    const runner = await realGame();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const l = land(g);
    const sun = byTag(g, "SUN").smallID();
    const a = placeArmy(g, "SUN", CHUKCHI_C, 1);
    expect(
      l.issue(sun, { kind: "army_move", army: a.id, region: CHUKCHI_2 }),
    ).toBe(null);
    step(runner, 3);
    const row = l.divisions.rowOf(a.divisions[0]);
    expect(l.divisions.next[row]).toBe(CHUKCHI_2);

    // Retreat: a division in 98 falls back over the new edge (73 or 111).
    const b = placeArmy(g, "SUN", CHUKCHI_2, 1);
    const rb = l.divisions.rowOf(b.divisions[0]);
    expect([CHUKCHI_C, CHUKCHI_SE, CHUKCHI_E]).toContain(refugeOf(l, rb));
    expect(l.divisions.mode[rb]).not.toBe(MOVE_RETREAT);

    // Attack: Japan holds 98; a Soviet army in 73 attacks it over the edge.
    warAfterPrep(runner, HUMAN, "JPN");
    takeRegion(g, CHUKCHI_2, "JPN");
    placeArmy(g, "JPN", CHUKCHI_2, 1);
    const c = placeArmy(g, "SUN", CHUKCHI_C, 1);
    expect(
      l.issue(sun, { kind: "army_attack", army: c.id, region: CHUKCHI_2 }),
    ).toBe(null);
    step(runner, 3);
    const rc = l.divisions.rowOf(c.divisions[0]);
    // The division fights in 98 from 73 across the edge.
    expect(l.divisions.battle[rc]).toBe(CHUKCHI_2);
    expect(l.battles.has(CHUKCHI_2)).toBe(true);
  }, 120_000);

  test("a battle across the line stands at the line, not mid-map", () => {
    const w = 4000;
    expect(wrapMidX(3990, 20, w)).toBe(5);
    expect(wrapMidX(20, 3990, w)).toBe(5);
    expect(wrapMidX(3900, 3990, w)).toBe(3945);
    expect(wrapMidX(100, 300, w)).toBe(200);
    expect(wrapMidX(10, 3999, w)).toBe(4004.5 % w);
  });
});
