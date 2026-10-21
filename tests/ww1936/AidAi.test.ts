// World War 1936 P5 lane A (plan Task 6 Step 7; spec §17.4): the aid AI on
// the end map — Germany (an AI major) and Italy share the Axis.
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import { IDEO_COM, IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { EventDef } from "@openfront/engine-lib/ww1936/content/types";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  aiAidEventChoice,
  aiLendLease,
  llRequestScore,
} from "@openfront/engine/ww1936/endgame/AiAid";
import { EVENT_LL } from "@openfront/engine/ww1936/endgame/LendLease";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, step, stepTo, wwRunner } from "./util";

/** K5's request card (two options without effects; the engine reads the pick). */
const LL_EVENT: EventDef = {
  id: "gen_diplo_lend_lease",
  kind: "country",
  once: "never",
  options: [
    { id: "a", ai: { base: 50 }, effects: [] },
    { id: "b", ai: { base: 50 }, effects: [] },
  ],
};

beforeEach(() =>
  usePoliticsContent(
    endgameFixture({ events: [...endgameFixture().events, LL_EVENT] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const C_ITA = "HUMANITA";
const INF = "infantry_equipment";

function until(runner: GameRunner, done: () => boolean, max = 1500): void {
  for (let i = 0; i < max && !done(); i++) step(runner);
  if (!done()) throw new Error("condition not reached");
}

/** Italy (human) at war with the Soviet Union and out of infantry equipment. */
async function game(historicalAi = true) {
  const runner = await wwRunner(
    { historicalAi },
    [{ clientID: C_ITA, country: "ITA" }],
    END_MAP,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  const [deu, ita, sun, pl] = ["DEU", "ITA", "SUN", "POL"].map((t) =>
    endId(t as "DEU"),
  );
  expect(ww.politics.sameFaction(deu, ita)).toBe(true);
  ww.setWar(ita, sun, g.ticks(), { kind: "declare" });
  const ce = ww.economy.country(ita)!;
  for (let gen = 1; gen <= EQUIPMENT_GENS[INF]; gen++) {
    ce.stock[equipKey(INF, gen)] = 0;
  }
  const l = ww.land;
  for (const r of l.rowsOf(ita)) {
    const eq = l.divisions.equipOf(r);
    GROUND_EQUIP_KEYS.forEach((k, j) => {
      if (EQUIP_KEYS[k][0] === INF) eq[j] = 0;
    });
  }
  return { runner, g, ww, eg: ww.endgame, deu, ita, sun, pl };
}

describe("World War 1936 P5: the aid AI", () => {
  it("an AI major sends 15% of its monthly output to a faction member in need", async () => {
    const { runner, ww, eg, deu, ita } = await game();
    // Germany looks on day 1 (day % 30 === smallID % 30), on its turn (k = 1).
    const look = dayStartTick(1, ww.prepEndTick()) + (deu % 7);
    stepTo(runner, look);
    const ce = ww.economy.country(deu)!;
    let month = 0;
    for (const line of ce.lines) {
      const [t, gen] = EQUIP_KEYS[line.key];
      if (t !== INF || line.lastOutput <= 0) continue;
      month += Math.floor((line.lastOutput * 30) / unitCostMilli(t, gen));
    }
    expect(month).toBeGreaterThan(0);
    expect(eg.lendLease.filter((c) => c.from === deu)).toEqual([]);
    step(runner);
    const c = eg.lendLease.find(
      (x) => x.from === deu && x.to === ita && x.item === INF,
    )!;
    expect(c).toBeDefined();
    expect([c.gen, c.blocked]).toEqual([0, null]);
    expect(c.perMonth).toBe(Math.floor((month * 15) / 100));
    // Covered again, the contract ends at the next look; and Germany keeps
    // what it lacks itself (under 80%).
    ww.economy.country(ita)!.stock[equipKey(INF, 1)] = 1_000_000;
    aiLendLease(eg, deu, 31);
    expect(eg.lendLease).not.toContain(c);
    ww.economy.country(ita)!.stock[equipKey(INF, 1)] = 0;
    const de = ww.economy.country(deu)!;
    for (let gen = 1; gen <= EQUIPMENT_GENS[INF]; gen++) {
      de.stock[equipKey(INF, gen)] = 0;
    }
    for (const r of ww.land.rowsOf(deu)) ww.land.divisions.equipOf(r).fill(0);
    aiLendLease(eg, deu, 61);
    expect(
      eg.lendLease.some(
        (x) => x.from === deu && x.to === ita && x.item === INF,
      ),
    ).toBe(false);
  });

  it("an AI answers a lend-lease request by its score", async () => {
    const { runner, g, ww, eg, deu, ita, pl, sun } = await game();
    // A friend (same ideology 30, same faction 40, half of opinion 70).
    expect(llRequestScore(eg, deu, ita, INF)).toBeGreaterThanOrEqual(50);
    expect(
      eg.issue(
        ita,
        { kind: "lend_lease_request", from: deu, item: INF, perMonth: 300 },
        g.ticks(),
      ),
    ).toBeNull();
    const c = eg.lendLease.find((x) => x.from === deu && x.to === ita)!;
    expect(c.blocked).toBe("requested");
    expect(aiAidEventChoice(eg, EVENT_LL, deu, ita)).toBe("a");
    until(runner, () => c.blocked !== "requested");
    expect(c.blocked).toBeNull();
    expect(c.perMonth).toBe(300);
    // A stranger of another ideology: refused, the request dropped.
    ww.politics.country(pl)!.ruling = IDEO_DEM;
    ww.setWar(pl, sun, g.ticks(), { kind: "declare" });
    expect(llRequestScore(eg, deu, pl, INF)).toBeLessThan(50);
    expect(
      eg.issue(
        pl,
        { kind: "lend_lease_request", from: deu, item: INF, perMonth: 300 },
        g.ticks(),
      ),
    ).toBeNull();
    expect(aiAidEventChoice(eg, EVENT_LL, deu, pl)).toBe("b");
    until(runner, () => !eg.lendLease.some((x) => x.to === pl));
    // Not an aid event: P3 chooses.
    expect(aiAidEventChoice(eg, "gen_volunteers_arrive", deu, pl)).toBeNull();
  });

  it("a peacetime AI sends half its volunteer cap, and its volunteers take the host's front", async () => {
    const { runner, ww, eg, deu, ita, pl, sun } = await game(false);
    // Germany (an AI aggressor at peace, 45 divisions) looks on day 1:
    // Poland (its ideology) fights a communist Soviet Union. Cap
    // min(⌈4.5⌉, max(2, 8 / 3), 12) = 2: half of it is one division.
    ww.endWar(ita, sun);
    ww.politics.country(sun)!.ruling = IDEO_COM;
    ww.setWar(pl, sun, runner.game.ticks(), { kind: "declare" });
    until(runner, () => eg.volunteers.some((v) => v.from === deu));
    const v = eg.volunteers.find((x) => x.from === deu)!;
    expect(v.to).toBe(pl);
    const a = ww.land.armies.get(v.army)!;
    expect(a.divisions).toHaveLength(1);
    expect(a.volunteerFor).toBe(pl);
    until(runner, () => a.order.kind === "front");
    expect(a.order.kind === "front" && a.order.enemy).toBe(0);
  });
});
