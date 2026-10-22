// World War 1936 P6 lane W3 (plan Task 9 Step 8): faction rules and goals
// (spec §14) on the deep test map. Britain (human) leads the Allies; the
// tests bring countries in with P3's joinFaction.
import { FACTION_GOALS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  IDEO_FAS,
  type SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  factionGoalsDay,
  GOAL_SPIRIT_DAYS,
  ideologyLocked,
  sharedIntel,
  sharedResearchPct,
} from "@openfront/engine/ww1936/depth/FactionRules";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  joinBlock,
  joinFaction,
  leaveFaction,
} from "@openfront/engine/ww1936/politics/Factions";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { politicsFixture } from "./politicsFixture";
import { stepToDate, wwRunner } from "./util";

const ARSENAL: SpiritDef = {
  id: "fg_arsenal",
  stats: { outputPct: 5 },
  icon: "factory",
};

beforeEach(() =>
  usePoliticsContent(
    depthFixture({ spirits: [...politicsFixture().spirits, ARSENAL] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const { GBR, FRA, SUN, POL, TUR, DEU } = DEEP.tag;
const TECH: WwTechId = "radar_1";

async function alliesGame(): Promise<{
  runner: GameRunner;
  allies: number;
}> {
  const runner = await wwRunner(
    {},
    [{ clientID: "HUMANGBR", country: "GBR" }],
    DEEP.map,
  );
  stepToDate(runner, "1936-01-03");
  const pol = runner.game.worldWar()!.politics;
  const allies = pol.factionIdx(GBR);
  expect(pol.faction(allies)!.leader).toBe(GBR);
  pol.country(GBR)!.ppMilli = 500_000;
  return { runner, allies };
}

/** Brings `ids` into the Allies (out of their own faction first). */
function bringIn(runner: GameRunner, allies: number, ids: number[]): void {
  const pol = runner.game.worldWar()!.politics;
  const tick = runner.game.ticks();
  for (const id of ids) {
    if (pol.factionIdx(id) >= 0) leaveFaction(pol, id, tick);
    joinFaction(pol, id, allies, tick);
  }
}

describe("World War 1936 P6: faction rules and goals", () => {
  it("shared research gives 10 percent per member that has the tech, at most 30", async () => {
    const { runner, allies } = await alliesGame();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const tick = runner.game.ticks();
    bringIn(runner, allies, [SUN, POL, TUR]);
    const members = ww.politics.factionMembers(allies);
    expect(members).toHaveLength(5);
    for (const m of members) ww.economy.country(m)!.researched.delete(TECH);
    ww.economy.country(FRA)!.researched.add(TECH);
    expect(sharedResearchPct(d, GBR, TECH)).toBe(0); // the rule is off
    const rule = { kind: "faction_rule", rule: "fr_shared_research", on: true };
    expect(d.issue(FRA, rule as never, tick)).toBe("faction_leader_only");
    expect(d.issue(GBR, rule as never, tick)).toBeNull();
    expect(ww.politics.country(GBR)!.ppMilli).toBe(450_000);
    expect(sharedResearchPct(d, GBR, TECH)).toBe(10);
    expect(sharedResearchPct(d, DEU, TECH)).toBe(0); // not a member
    ww.economy.country(SUN)!.researched.add(TECH);
    expect(sharedResearchPct(d, GBR, TECH)).toBe(20);
    ww.economy.country(POL)!.researched.add(TECH);
    ww.economy.country(TUR)!.researched.add(TECH);
    expect(sharedResearchPct(d, GBR, TECH)).toBe(30);
    // The member's own tech does not count for itself.
    expect(sharedResearchPct(d, FRA, TECH)).toBe(30);
    ww.economy.country(GBR)!.researched.add(TECH);
    expect(sharedResearchPct(d, FRA, TECH)).toBe(30);
    // 180 days before it may change again.
    const off = { ...rule, on: false };
    expect(d.issue(GBR, off as never, tick)).toBe("faction_rule");
    expect(sharedIntel(d, GBR, FRA)).toBe(false);
  });

  it("a faction goal rewards every member once", async () => {
    const { runner, allies } = await alliesGame();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const tick = runner.game.ticks();
    const day = ww.day(tick);
    const goal = (slot: number, g: (typeof FACTION_GOALS)[number]) =>
      d.issue(GBR, { kind: "faction_goal", slot, goal: g } as never, tick);
    expect(
      d.issue(FRA, { kind: "faction_goal", slot: 0, goal: "fg_members" }, tick),
    ).toBe("faction_leader_only");
    expect(goal(0, "fg_members")).toBeNull();
    expect(goal(1, "fg_members")).toBe("bad_index"); // in a slot already
    factionGoalsDay(d, day);
    expect(d.mech.factionGoals[0].achieved).toBe(0);
    bringIn(runner, allies, [SUN, POL, TUR, DEU]);
    const members = ww.politics.factionMembers(allies);
    expect(members).toHaveLength(6);
    const pp = members.map((m) => ww.politics.country(m)!.ppMilli);
    factionGoalsDay(d, day);
    const g = d.mech.factionGoals.find((x) => x.faction === allies)!;
    const bit = 1 << FACTION_GOALS.indexOf("fg_members");
    expect(g.achieved).toBe(bit);
    expect(g.slots).toEqual([-1, -1, -1]);
    members.forEach((m, i) =>
      expect(ww.politics.country(m)!.ppMilli).toBe(pp[i] + 50_000),
    );
    // Never again: not as a pick, not as a reward.
    expect(goal(0, "fg_members")).toBe("bad_index");
    factionGoalsDay(d, day + 1);
    members.forEach((m, i) =>
      expect(ww.politics.country(m)!.ppMilli).toBe(pp[i] + 50_000),
    );
    // A spirit goal: 400 military factories → the arsenal for a year.
    expect(goal(2, "fg_industry")).toBeNull();
    ww.economy.country(GBR)!.totals.mil = 400;
    factionGoalsDay(d, day + 1);
    for (const m of members) {
      const s = ww.politics
        .country(m)!
        .spirits.find((x) => x.id === "fg_arsenal");
      expect(s?.untilDay).toBe(day + 1 + GOAL_SPIRIT_DAYS);
    }
  });

  it("the ideology lock refuses a different government", async () => {
    const { runner } = await alliesGame();
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const pol = ww.politics;
    const tick = runner.game.ticks();
    const allies = pol.factionIdx(GBR);
    pol.country(GBR)!.ruling = IDEO_FAS;
    pol.country(TUR)!.ruling = IDEO_FAS;
    pol.wtBp = 10_000; // past every tension gate
    // P3 lets a neutral government into a fascist-led faction.
    expect(joinBlock(pol, POL, allies)).toBeNull();
    expect(ideologyLocked(d, GBR, POL)).toBe(false);
    expect(
      d.issue(
        GBR,
        { kind: "faction_rule", rule: "fr_ideology_lock", on: true },
        tick,
      ),
    ).toBeNull();
    expect(ideologyLocked(d, GBR, POL)).toBe(true);
    expect(joinBlock(pol, POL, allies)).toBe("faction_rule");
    // The same government is welcome.
    expect(ideologyLocked(d, GBR, TUR)).toBe(false);
    expect(joinBlock(pol, TUR, allies)).toBeNull();
  });
});
