// ww167: a name in the people tab's vacancy box ("빈자리") must take the office
// when picked. A first game's opening hides the holders not yet met, and the
// box read their offices as empty: a pick swapped one unseen man for another
// and nothing on screen moved.
import {
  GameMapSize,
  GameMapType,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { personDef } from "@openfront/engine/ww1914/SceneRun";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  appointBlock,
  vacantOffices,
} from "../../src/client/hud/ww1914/GwModel";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { newGame, startOf } from "./sim/GwSim";
import { order, seat, view } from "./util";

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];

let world: MapFiles | null = null;

/** Austria-Hungary isn't on the mini map: it sits on the full one. */
async function fullMap(tag: GwTag, config: Partial<GameConfig>) {
  world ??= await loadMapFiles(
    new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const info = startOf("APPOINT1", "full", [], tag);
  info.config = { ...info.config, ...config };
  info.players = info.players.map((p) => ({ ...p, clientID: HUMAN }));
  return newGame(world, info);
}

async function game(tag: GwTag, config: Partial<GameConfig>) {
  const runner =
    tag === "AUH"
      ? await fullMap(tag, config)
      : (
          await wwRunnerCapture(
            { greatWar1914: true, gameType: GameType.Singleplayer, ...config },
            [{ clientID: HUMAN, gwCountry: tag }],
          )
        ).runner;
  step(runner, 2);
  expect(seat(runner).tag).toBe(tag);
  return runner;
}

/** The seat's own office holders, as the engine has them. */
function holders(r: GameRunner, tag: GwTag) {
  return r.game
    .greatWar()!
    .s.people.filter(
      (p) =>
        p.office !== null &&
        p.status === "active" &&
        personDef(p.id)?.tag === tag,
    );
}

/** Every name the box offers, for every office it shows, takes the office. */
function everyNameAppoints(r: GameRunner, tag: GwTag): number {
  const gw = r.game.greatWar()!;
  let tried = 0;
  for (const held of holders(r, tag)) {
    const o = held.office as GwOffice;
    held.office = null; // the minister dies
    step(r, 1);
    if (!vacantOffices(seat(r)).includes(o)) continue;
    for (const id of seat(r).world.candidates[o] ?? []) {
      order(r, { kind: "appoint", person: id, office: o });
      expect(gw.person(id)!.office, `${tag} ${o} ${id}`).toBe(o);
      expect(vacantOffices(seat(r))).not.toContain(o);
      tried++;
      gw.person(id)!.office = null;
      step(r, 1);
    }
    for (const p of gw.s.people) if (p.office === o) p.office = null;
    held.office = o;
    step(r, 1);
  }
  return tried;
}

describe("the vacancy box appoints what it offers", () => {
  for (const tag of SEATS) {
    test(`${tag}: a first game's opening shows no held office as vacant`, async () => {
      const r = await game(tag, { greatWar1914Played: [] });
      expect(r.game.greatWar()!.s.chapter).toBe(0);
      expect(vacantOffices(seat(r))).toEqual([]);
      expect(everyNameAppoints(r, tag)).toBeGreaterThan(0);
    });

    test(`${tag}: a later game, every listed name takes the office`, async () => {
      const r = await game(tag, {});
      expect(vacantOffices(seat(r))).toEqual([]);
      expect(everyNameAppoints(r, tag)).toBeGreaterThan(0);
    });

    test(`${tag}: in the years before 1914 the box says why, not names`, async () => {
      const r = await game(tag, {
        greatWar1914Prologue: { play: true, picks: [] },
      });
      expect(seat(r).prologue?.done).toBe(false);
      expect(appointBlock(view(r))).toBe("prologue");
      const held = holders(r, tag)[0];
      const o = held.office as GwOffice;
      held.office = null;
      step(r, 1);
      const id = seat(r).world.candidates[o]![0];
      order(r, { kind: "appoint", person: id, office: o });
      expect(r.game.greatWar()!.person(id)!.office).toBeNull();
    });
  }
});
