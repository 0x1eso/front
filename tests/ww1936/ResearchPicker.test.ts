// Research overhaul (changes §5, §6 idea 1): one score for the AI and a
// human's auto-research, its seeded jitter, the leaning, unbuilt kinds.
import {
  RESEARCH_LEANS,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { researchBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { aheadPct } from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  preferredExclusiveLine,
  researchScore,
  ResearchScoreInput,
  researchScores,
} from "@openfront/engine-lib/ww1936/ResearchScore";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import {
  aiInput,
  aiReactPlan,
  aiResearchCaps,
  aiResearchMix,
  aiTechDomain,
  researchScoreInput,
} from "@openfront/engine/ww1936/economy/AiEconomy";
import { setResearchLean } from "@openfront/engine/ww1936/economy/ResearchRun";
import { describe, expect, it } from "vitest";
import {
  byTag,
  gameHash,
  HUMAN,
  order,
  POL,
  step,
  wwRestore,
  wwRunner,
} from "./util";

const base = (over: Partial<ResearchScoreInput> = {}): ResearchScoreInput => ({
  seed: 1234,
  smallID: 5,
  tag: "DEU",
  persona: "aggressor",
  day: 1500,
  human: false,
  lean: 0,
  coastal: true,
  lineFactories: { infantry_equipment: 10, fighter: 5, medium_tank: 4 },
  navalLines: 2,
  bonusKeys: [],
  shared: [],
  researched: new Set(),
  running: [],
  ...over,
});
const at = (t: WwTechId) => WW_TECH_IDS.indexOf(t);

describe("the research score (research overhaul)", () => {
  it("integers, deterministic, seeded: another seed, another order", () => {
    const a = researchScores(base());
    expect(researchScores(base())).toEqual(a);
    for (const v of a) if (v !== null) expect(Number.isInteger(v)).toBe(true);
    expect(researchScores(base({ seed: 99 }))).not.toEqual(a);
    // The jitter is 0..10: two seeds never differ by more on one tech.
    const b = researchScores(base({ seed: 99 }));
    a.forEach((v, k) => {
      if (v !== null && b[k] !== null) {
        expect(Math.abs(v - b[k]!)).toBeLessThanOrEqual(10);
      }
    });
    // The either/or line: rolled once a game, both lines happen.
    const lines = new Set<number>();
    for (let s = 0; s < 40; s++)
      lines.add(preferredExclusiveLine(base({ seed: s })));
    expect([...lines].sort()).toEqual([0, 1]);
    // Taken, it is kept; the other line scores null.
    const taken = base({ researched: new Set(["dispersed_1"]) });
    expect(preferredExclusiveLine(taken)).toBe(1);
    expect(researchScore(taken, "concentrated_2")).toBeNull();
    expect(researchScore(taken, "dispersed_2")).not.toBeNull();
  });

  it("need, bonus and the unbuilt kinds: an AI leaves them out, a human pushes them back", () => {
    const s = researchScores(base());
    const noPlanes = researchScores(
      base({ lineFactories: { infantry_equipment: 10 } }),
    );
    // A line of the kind: +20 for its improvement.
    expect(s[at("aero_engine_2")]! - noPlanes[at("aero_engine_2")]!).toBe(20);
    const bonus = researchScores(base({ bonusKeys: ["armour"] }));
    expect(bonus[at("tank_engine_2")]! - s[at("tank_engine_2")]!).toBe(25);
    // A minor without planes: no air techs; landlocked: no sea techs.
    const minor = researchScores(
      base({ tag: "POL", persona: "minor", coastal: false, lineFactories: {} }),
    );
    expect(minor[at("fighter_2")]).toBeNull();
    expect(minor[at("dd_3")]).toBeNull();
    // A human: never left out, 40 back instead of 20 up.
    const human = (lf: ResearchScoreInput["lineFactories"]) =>
      researchScores(base({ human: true, coastal: false, lineFactories: lf }));
    const hp = human({ fighter: 5 });
    const hn = human({ infantry_equipment: 1 });
    expect(hn[at("dd_3")]).not.toBeNull();
    expect(hn[at("fighter_2")]).not.toBeNull();
    expect(hp[at("fighter_2")]! - hn[at("fighter_2")]!).toBeGreaterThanOrEqual(
      60,
    );
  });

  it("the leaning moves a human's choice", () => {
    const h = (lean: number) => researchScores(base({ human: true, lean }));
    const navy = RESEARCH_LEANS.indexOf("navy");
    const army = RESEARCH_LEANS.indexOf("army");
    expect(h(navy)[at("torpedo_2")]!).toBeGreaterThan(h(0)[at("torpedo_2")]!);
    expect(h(army)[at("inf_imp_2")]!).toBeGreaterThan(h(0)[at("inf_imp_2")]!);
    // An AI's leaning is its personality: the field is ignored.
    expect(researchScores(base({ lean: navy }))).toEqual(
      researchScores(base()),
    );
  });

  it("the AI turn and auto-research take the same score's best; the leaning order is the sender's, snapshotted and hashed", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    step(runner);
    const g = runner.game;
    const ww = g.worldWar()!;
    const econ = ww.economy;
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    const day = ww.day(g.ticks());
    deu.slots = deu.slots.map(() => null);
    const pick = (lean: number) => {
      deu.researchLean = lean;
      const i = aiInput(econ, deu, day, g.ticks());
      i.fillSlots = true;
      const react = { research: true, lines: false, construction: false };
      const picks = aiReactPlan(i, react).flatMap((o) =>
        o.kind === "research" ? [o.tech] : [],
      );
      return { i, picks };
    };
    const { i, picks } = pick(0);
    expect(picks).toHaveLength(deu.totals.slotCount);
    // The first pick is the best-scored tech it may start now within half
    // a year and its land/sea/air caps (the same researchScores).
    const scores = researchScores(
      researchScoreInput(i, deu.researched, i.slots),
    );
    const caps = aiResearchCaps(
      aiResearchMix("DEU", i.coastal ?? true),
      i.slotCount,
    );
    const ok = (t: WwTechId) =>
      researchBlockOf(
        { researched: deu.researched, slots: i.slots, slotCount: i.slotCount },
        t,
      ) === null &&
      aheadPct(WW_TECHS[t].year, day) <= 50 &&
      (aiTechDomain(t) === "land" || caps[aiTechDomain(t) as "sea"] > 0);
    const ranked = WW_TECH_IDS.filter(
      (t) => scores[at(t)] !== null && ok(t),
    ).sort((a, b) => scores[at(b)]! - scores[at(a)]! || at(a) - at(b));
    expect(picks[0]).toBe(ranked[0]);
    // Navy leaning: more of the slots go to the sea.
    const sea = (ts: readonly WwTechId[]) =>
      ts.filter((t) => WW_TECHS[t].branch === "naval").length;
    expect(
      sea(pick(RESEARCH_LEANS.indexOf("navy")).picks),
    ).toBeGreaterThanOrEqual(sea(picks));
    deu.researchLean = 0;
    // The order: the sender's own country, a human's only.
    const pol = econ.country(byTag(g, "POL").smallID())!;
    expect(setResearchLean(econ, pol, "air")).toBe("not_controlled");
    const h0 = gameHash(runner);
    step(runner, 1, [
      order(HUMAN, { kind: "research_lean", lean: "industry" }),
    ]);
    expect(deu.researchLean).toBe(RESEARCH_LEANS.indexOf("industry"));
    expect(pol.researchLean).toBe(0);
    expect(gameHash(runner)).not.toBe(h0);
    const back = await wwRestore(
      runner,
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    const deu2 = back.game.worldWar()!.economy.country(deu.smallID)!;
    expect(deu2.researchLean).toBe(RESEARCH_LEANS.indexOf("industry"));
    expect(gameHash(back)).toBe(gameHash(runner));
  });
});
