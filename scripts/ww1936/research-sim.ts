/**
 * World War 1936 research pacing (research overhaul R0 / R4d).
 *
 * Plays the real world1936 map with no humans and the historical AI on,
 * the engine alone, and prints for every major, per calendar year: the
 * techs it finished by research, its slot count on 1 January, the base
 * research days it finished, and its share of the researchable tree on
 * the last day. Phase 3 balances the overhaul against these numbers.
 *
 *   npx tsx scripts/ww1936/research-sim.ts [--seed WWSIM001] [--until 1945-08-15]
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
} from "@openfront/engine-lib/ww1936/Calendar";
import * as Techs from "@openfront/engine-lib/ww1936/WwTechs";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable } from "../domestic-sim-report";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const MAJORS: readonly CountryTag[] = [
  "DEU",
  "ITA",
  "JPN",
  "GBR",
  "FRA",
  "USA",
  "SUN",
];

/** A tech's research days: the overhaul's cost function when it exists. */
function baseDays(id: WwTechId): number {
  const lib = Techs as unknown as {
    techCostDays?: (id: WwTechId) => number;
  };
  if (lib.techCostDays !== undefined) return lib.techCostDays(id);
  return Techs.techDays(Techs.WW_TECHS[id].year);
}

const researchable = WW_TECH_IDS.filter((id) => !Techs.isRetiredTech(id));

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string, dflt: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const seed = opt("--seed", "WWSIM001");
  const until = dayOfDate(opt("--until", "1945-08-15"));
  const start: GameStartInfo = {
    gameID: seed,
    lobbyCreatedAt: 0,
    config: {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Private,
      difficulty: Difficulty.Medium,
      nations: "default",
      bots: 0,
      donateGold: true,
      donateTroops: true,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      worldWar1936: true,
      historicalAi: true,
    },
    players: [],
  };
  const files = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner = await createGameRunner(start, undefined, files, (gu) => {
    if ("errMsg" in gu) throw new Error(gu.errMsg);
  });
  const game = runner.game;
  const ww = game.worldWar()!;
  const econ = ww.economy;
  const prepEnd = ww.prepEndTick();
  const endTick = dayStartTick(until + 1, prepEnd);

  // Per tag: techs at the start, then per year finished count, days, slots.
  const startSet = new Map<CountryTag, Set<WwTechId>>();
  const seen = new Map<CountryTag, Set<WwTechId>>();
  const doneByYear = new Map<CountryTag, Map<number, number>>();
  const daysByYear = new Map<CountryTag, Map<number, number>>();
  const slotsJan = new Map<CountryTag, Map<number, number>>();
  const slotDays = new Map<CountryTag, Map<number, [number, number]>>();
  let lastDay = -1;
  const t0 = performance.now();
  while (game.ticks() < endTick) {
    runner.addTurn({ turnNumber: game.ticks(), intents: [] });
    if (!runner.executeNextTick()) break;
    const day = ww.day(game.ticks());
    if (day === lastDay || game.ticks() <= prepEnd) continue;
    lastDay = day;
    const done = day - 1;
    if (done < 0) continue;
    const year = dateOfDay(done).year;
    const jan1 = dateOfDay(done).month === 1 && dateOfDay(done).day === 1;
    for (const ce of econ.countries()) {
      if (!startSet.has(ce.tag)) {
        startSet.set(ce.tag, new Set(ce.researched));
        seen.set(ce.tag, new Set(ce.researched));
        doneByYear.set(ce.tag, new Map());
        daysByYear.set(ce.tag, new Map());
        slotsJan.set(ce.tag, new Map());
        slotDays.set(ce.tag, new Map());
      }
      const s = seen.get(ce.tag)!;
      for (const t of ce.researched) {
        if (s.has(t)) continue;
        s.add(t);
        const m = doneByYear.get(ce.tag)!;
        m.set(year, (m.get(year) ?? 0) + 1);
        const d = daysByYear.get(ce.tag)!;
        d.set(year, (d.get(year) ?? 0) + baseDays(t));
      }
      if (jan1 || done === 0) {
        slotsJan.get(ce.tag)!.set(year, ce.totals.slotCount);
      }
      const sd = slotDays.get(ce.tag)!;
      const row = sd.get(year) ?? [0, 0];
      row[0] += ce.slots.filter(
        (x, i) => x !== null && i < ce.totals.slotCount,
      ).length;
      row[1] += ce.totals.slotCount;
      sd.set(year, row);
    }
    if (done % 365 === 0) {
      console.error(
        `day ${done} (${((performance.now() - t0) / 1000).toFixed(0)} s)`,
      );
    }
  }

  const years = [1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945];
  const treeDays = researchable.reduce((n, id) => n + baseDays(id), 0);
  console.log(
    `seed ${seed}, until day ${until}; researchable techs ${researchable.length}, tree days ${treeDays}`,
  );
  const tables: [string, (tag: CountryTag, y: number) => string][] = [
    [
      "techs finished by research",
      (tag, y) => `${doneByYear.get(tag)?.get(y) ?? 0}`,
    ],
    ["slots on 1 January", (tag, y) => `${slotsJan.get(tag)?.get(y) ?? "-"}`],
    [
      "busy slot share of the year, %",
      (tag, y) => {
        const r = slotDays.get(tag)?.get(y);
        return r === undefined || r[1] === 0
          ? "-"
          : `${Math.round((r[0] * 100) / r[1])}`;
      },
    ],
    [
      "base research days finished",
      (tag, y) => `${daysByYear.get(tag)?.get(y) ?? 0}`,
    ],
  ];
  for (const [title, cell] of tables) {
    console.log(`\n## ${title}\n`);
    console.log(
      formatTable(
        ["tag", ...years.map(String)],
        MAJORS.map((tag) => [tag, ...years.map((y) => cell(tag, y))]),
      ),
    );
  }
  console.log("\n## totals at the end\n");
  const rows: string[][] = [];
  const minorShares: number[] = [];
  for (const ce of econ.countries()) {
    const st = startSet.get(ce.tag);
    if (st === undefined) continue;
    const have = researchable.filter((id) => ce.researched.has(id)).length;
    const startN = researchable.filter((id) => st.has(id)).length;
    const days = [...(daysByYear.get(ce.tag)?.values() ?? [])].reduce(
      (n, x) => n + x,
      0,
    );
    const share = Math.round((have * 1000) / researchable.length) / 10;
    if (!MAJORS.includes(ce.tag)) {
      if (startN > 0) minorShares.push(share);
      continue;
    }
    rows.push([
      ce.tag,
      `${startN}`,
      `${have - startN}`,
      `${have}`,
      `${share}%`,
      `${days}`,
      `${ce.totals.slotCount}`,
    ]);
  }
  console.log(
    formatTable(
      [
        "tag",
        "start techs",
        "researched",
        "total",
        "tree share",
        "days finished",
        "slots at end",
      ],
      rows,
    ),
  );
  minorShares.sort((a, b) => a - b);
  const mean =
    minorShares.reduce((n, x) => n + x, 0) / Math.max(1, minorShares.length);
  console.log(
    `\nminors with techs: ${minorShares.length}, tree share mean ${mean.toFixed(1)}%, ` +
      `median ${minorShares[Math.floor(minorShares.length / 2)] ?? 0}%, ` +
      `min ${minorShares[0] ?? 0}%, max ${minorShares[minorShares.length - 1] ?? 0}%`,
  );
  console.error(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
