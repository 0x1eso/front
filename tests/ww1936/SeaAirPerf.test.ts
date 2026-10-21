// World War 1936 P4 Task 15 (spec §20.2): the navy and the air war at war
// scale on world1936 — every major at war, the 1936 navies and 300 more
// fleets (about 2,000 ships), twenty naval battles opened at once, some
// 300 air deployments — then 1,000 ticks of WwNavy.tick, WwAir.tick and
// their updates, timed on the thread's CPU clock. Spec §20.1's budget is
// 0.6 ms a tick on a desktop; CI's bound is three times that and a few
// times more for this machine's load (the --perf run of
// scripts/ww1936/sea-air-sim.ts gives the real numbers).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { aiMainBase } from "@openfront/engine/ww1936/navy/AiNavy";
import { startNavalBattle } from "@openfront/engine/ww1936/navy/NavalBattles";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { step, stepTo, wwGameStart } from "./util";

/** Spec §20.1's P4 mean (0.6 ms) × 3 (§20.2), × 2 for a loaded CI machine. */
const MEAN_MS = 3.6;
const TICKS = 1000;

test("2,000 ships, 20 battles and 300 deployments stay within budget", async () => {
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
  const runner = await createGameRunner(
    wwGameStart(),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  const g = runner.game;
  const ww = g.worldWar()!;
  const sc = ww.scenario;
  const navy = ww.navy;
  const air = ww.air;
  stepTo(runner, WW_PREP_TICKS + 1);
  const id = (t: CountryTag) => sc.smallIdOf(t);
  const axis = ["DEU", "ITA", "JPN"] as const;
  const allies = ["GBR", "FRA", "USA", "SUN"] as const;
  for (const a of axis) {
    for (const b of allies) ww.setWar(id(a), id(b), g.ticks());
  }
  // More fleets: forty-odd for every major at its main base.
  const majors = [...axis, ...allies];
  for (const t of majors) {
    const port = aiMainBase(ww, id(t));
    for (let i = 0; i < 43; i++) {
      navy.createFleet(id(t), port, [
        ["dd", 2, 3],
        ["cl", 2, 1],
        ...(i % 4 === 0 ? ([["bb", 2, 1]] as const) : []),
      ]);
    }
  }
  expect(navy.ships.count()).toBeGreaterThan(2000);
  // Twenty battles: an allied and an axis fleet at sea in twenty zones.
  const zones = sc.navalZones().filter((z) => sc.zoneSr(z) !== 0);
  let battles = 0;
  for (let i = 0; battles < 20 && i < zones.length; i += 7) {
    const z = zones[i];
    const pair = [allies[battles % 4], axis[battles % 3]] as const;
    const fs = pair.map((t) => {
      const f = navy.fleets.get(
        navy.createFleet(id(t), aiMainBase(ww, id(t)), [
          ["bb", 2, 2],
          ["dd", 2, 6],
        ]),
      )!;
      f.docked = 0;
      f.state = FLEET_STATES.indexOf("on_station");
      navy.setFleetZone(f, z);
      return f;
    });
    startNavalBattle(navy, z, navy.sideOf(fs[0].owner), fs[1].id, g.ticks());
    if (navy.battles.has(z)) battles++;
  }
  expect(navy.battles.size).toBe(20);
  // Some 300 deployments: each major's fighters over the land zones its
  // bases reach (one record a base).
  for (const t of majors) {
    const ce = ww.economy.country(id(t))!;
    for (let gen = 1; gen <= EQUIPMENT_GENS.fighter; gen++) {
      ce.stock[equipKey("fighter", gen)] = gen === 1 ? 20_000 : 0;
    }
    let made = 0;
    for (const s of sc.strategicList()) {
      if (made >= 45) break;
      const block = air.issue(
        id(t),
        {
          kind: "air_deploy",
          sr: s.id,
          type: "fighter",
          mission: s.kind === "land" ? "air_superiority" : "naval_patrol",
          count: 60,
        },
        g.ticks(),
      );
      if (block === null) made++;
    }
  }
  expect(air.deployments.size).toBeGreaterThan(250);

  type ThreadCpu = (prev?: NodeJS.CpuUsage) => NodeJS.CpuUsage;
  const threadCpu = (
    process as { threadCpuUsage?: ThreadCpu }
  ).threadCpuUsage?.bind(process);
  let p4 = 0;
  const timed = <T>(f: () => T): T => {
    const c0 = threadCpu?.();
    const w0 = performance.now();
    const v = f();
    const used = threadCpu?.(c0);
    p4 +=
      used === undefined
        ? performance.now() - w0
        : (used.user + used.system) / 1000;
    return v;
  };
  const nt = navy.tick.bind(navy);
  const at = air.tick.bind(air);
  const nd = navy.takeData.bind(navy);
  const ad = air.takeData.bind(air);
  navy.tick = (t) => timed(() => nt(t));
  air.tick = (t) => timed(() => at(t));
  navy.takeData = () => timed(() => nd());
  air.takeData = () => timed(() => ad());
  // A day to warm the JIT up, then the measured ticks.
  step(runner, 8);
  p4 = 0;
  step(runner, TICKS);
  const mean = p4 / TICKS;
  console.log(
    `P4 at war scale: ${mean.toFixed(3)} ms/tick (ships ${navy.ships.count()}, fleets ${navy.fleets.size}, deployments ${air.deployments.size})`,
  );
  expect(mean).toBeLessThan(MEAN_MS);
}, 900_000);
