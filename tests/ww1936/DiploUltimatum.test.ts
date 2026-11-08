// World War 1936 diplomacy D5 (ww161 Design B §5; ww162 lane L4): the
// peacetime ultimatum. The AI target's chance; who may send it (government,
// relation, the pair's wait) and what it may ask (legal land, no capital,
// core, claim or bordering, at most 15% of the victory points); a human
// target gives (land, stability, war support) or lets the card run out
// (refused: a ready claim goal, the shorter wait), cards queue behind each
// other; an AI target answers by its seeded roll; one that stops meaning
// anything lapses; the AI's own ultimatums (and the script's pairs left to
// the script); a restore in lockstep. End map.
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DIPLO_COOLDOWN_KINDS,
  WW_ULT_AI_DAYS,
  WW_ULT_CARD_TICKS,
  WW_ULT_COOLDOWN_DAYS,
  WW_ULT_GOAL_DAYS,
  WW_ULT_PP,
  WW_ULT_REFUSED_DAYS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { NATIONAL_DECISIONS } from "@openfront/engine-lib/ww1936/content/decisions/national";
import { diploCooldownUntil } from "@openfront/engine/ww1936/endgame/DiploState";
import {
  aiGivesIn,
  aiUltimatumDay,
  replyUltimatum,
  scriptedPair,
  sendUltimatum,
  ultimatumBlock,
  ultimatumFacts,
  type UltimatumFacts,
  ultimatumGivePct,
} from "@openfront/engine/ww1936/endgame/Ultimatum";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { addGuarantee } from "@openfront/engine/ww1936/politics/Treaties";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  dropPact,
  END_MAP,
  HUMAN,
  order,
  step,
  stepTo,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

// Germany claims eastern Poland (Krakow) on top of the end map's content.
beforeEach(() =>
  usePoliticsContent(
    endgameFixture({ claims: [{ tag: "DEU", groups: ["east_poland"] }] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const id = (t: CountryTag) => endId(t);
const [WARSAW, KRAKOW, MOSCOW, SUDETEN, SLOVAKIA, KOSICE] = [
  6, 7, 8, 13, 15, 20,
];
const POL_HUMAN: WwHuman[] = [{ clientID: HUMAN, country: "POL" }];

/** After prep: Germany fascist, no German–Polish pact, PP for everyone. */
async function started(
  humans: WwHuman[] = [],
  config: Partial<GameConfig> = {},
) {
  const runner = await wwRunner(config, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  for (let x = 1; x < ww.endgame.size; x++) {
    const c = ww.politics.country(x);
    if (c !== null) c.ppMilli = 200_000;
  }
  ww.politics.country(id("DEU"))!.ruling = IDEO_FAS;
  dropPact(g, "DEU", "POL");
  return { runner, g, ww, eg: ww.endgame, pol: ww.politics };
}

const ULT = DIPLO_COOLDOWN_KINDS.indexOf("ultimatum");
const facts = (f: Partial<UltimatumFacts>): UltimatumFacts => ({
  senderStrength: 100,
  targetStrength: 100,
  majorGuarantors: 0,
  inFaction: false,
  sameIdeology: false,
  wsBp: 5000,
  vpPm: 0,
  ...f,
});

describe("diplomacy D5: the AI target's chance", () => {
  test("strength steps, guarantors, a faction, ideology, war support and the share asked", () => {
    expect(ultimatumGivePct(facts({}))).toBe(10);
    expect(ultimatumGivePct(facts({ senderStrength: 99 }))).toBe(0);
    expect(ultimatumGivePct(facts({ senderStrength: 150 }))).toBe(25);
    expect(ultimatumGivePct(facts({ senderStrength: 200 }))).toBe(50);
    expect(ultimatumGivePct(facts({ senderStrength: 300 }))).toBe(70);
    expect(ultimatumGivePct(facts({ senderStrength: 10_000 }))).toBe(70);
    // 3×, a major guarantor, a faction, the same ideology, 70% war support, 12.5% asked.
    expect(
      ultimatumGivePct(
        facts({
          senderStrength: 300,
          majorGuarantors: 1,
          inFaction: true,
          sameIdeology: true,
          wsBp: 7000,
          vpPm: 125,
        }),
      ),
    ).toBe(70 - 25 - 20 + 10 - 10 - 12);
    expect(
      ultimatumGivePct(facts({ senderStrength: 300, majorGuarantors: 4 })),
    ).toBe(0);
  });
});

describe("diplomacy D5: the ultimatum", { timeout: 120_000 }, () => {
  test("who may send it and what it may ask", async () => {
    const { g, ww, eg, pol } = await started();
    const [deu, pl, ita, csk] = [id("DEU"), id("POL"), id("ITA"), id("CSK")];
    const day = ww.day(g.ticks());
    const block = (from: number, to: number, regions: number[]) =>
      ultimatumBlock(eg, from, to, regions, day);
    expect(block(deu, pl, [KRAKOW])).toBeNull();
    // A democracy never; a neutral from 25% world tension.
    const c = pol.country(deu)!;
    c.ruling = IDEO_DEM;
    expect(block(deu, pl, [KRAKOW])).toBe("ultimatum_gov");
    c.ruling = pol.country(pl)!.ruling; // neutral
    expect(pol.wtBp).toBeLessThan(2500);
    expect(block(deu, pl, [KRAKOW])).toBe("ultimatum_gov");
    pol.wtBp = 2500;
    expect(block(deu, pl, [KRAKOW])).toBeNull();
    c.ruling = IDEO_FAS;
    // Not to a faction mate or a guaranteed country.
    expect(block(deu, ita, [5])).toBe("ultimatum_relation");
    addGuarantee(pol, deu, pl, day);
    expect(block(deu, pl, [KRAKOW])).toBe("ultimatum_relation");
    pol.guarantees = pol.guarantees.filter((x) => x.by !== deu);
    // Never the capital or another's land; core, claim or bordering only.
    expect(block(deu, pl, [WARSAW])).toBe("ultimatum_bad_regions");
    expect(block(deu, pl, [MOSCOW])).toBe("ultimatum_bad_regions");
    expect(block(deu, pl, [KRAKOW, KRAKOW])).toBe("ultimatum_bad_regions");
    expect(block(deu, csk, [SUDETEN])).toBe("ultimatum_bad_regions");
    for (const r of [SUDETEN, SLOVAKIA, KOSICE]) eg.addCore(deu, r);
    expect(block(deu, csk, [SUDETEN])).toBeNull();
    // 8 of Czechoslovakia's 23 victory points: over 15%.
    expect(block(deu, csk, [SUDETEN, SLOVAKIA, KOSICE])).toBe(
      "ultimatum_too_much",
    );
    // Not to a country at war with it.
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    expect(block(deu, pl, [KRAKOW])).toBe("ultimatum_relation");
  });

  test("a human target gives: the land, its stability, the sender's war support; the pair waits a year", async () => {
    const { runner, g, ww, eg, pol } = await started(POL_HUMAN);
    const [deu, pl] = [id("DEU"), id("POL")];
    const day = ww.day(g.ticks());
    const wt = pol.wtBp;
    const ws = pol.country(deu)!.wsBaseBp;
    const stab = pol.country(pl)!.stabBaseBp;
    expect(sendUltimatum(eg, deu, pl, [KRAKOW], g.ticks())).toBeNull();
    expect(pol.country(deu)!.ppMilli).toBe(200_000 - WW_ULT_PP * 1000);
    expect(pol.wtBp).toBeGreaterThan(wt);
    expect(eg.endgameNews.some((n) => n.id === "news_ultimatum")).toBe(true);
    const u = eg.ultimatums[0];
    expect(u).toMatchObject({ from: deu, to: pl, regions: [KRAKOW] });
    expect(u.deadlineTick).toBe(g.ticks() + WW_ULT_CARD_TICKS);
    expect(sendUltimatum(eg, deu, pl, [KRAKOW], g.ticks())).toBe(
      "ultimatum_cooldown",
    );
    step(runner, 2, [
      order(HUMAN, { kind: "deal_reply", offer: u.id, accept: true }),
    ]);
    expect(eg.ultimatums).toEqual([]);
    expect(pol.legalOwner[KRAKOW]).toBe(deu);
    expect(ww.land.controller[KRAKOW]).toBe(deu);
    expect(eg.hasCore(deu, KRAKOW)).toBe(false);
    expect(pol.country(pl)!.stabBaseBp).toBe(stab - 1000);
    expect(pol.country(deu)!.wsBaseBp).toBe(ws + 500);
    expect(diploCooldownUntil(eg, deu, pl, "ultimatum")).toBe(
      day + WW_ULT_COOLDOWN_DAYS,
    );
    expect(pol.hasWarGoal(deu, pl)).toBe(false);
  });

  test("a card that runs out is refused: a ready claim goal for 180 days; the next card waits its turn", async () => {
    const { runner, g, ww, eg, pol } = await started(POL_HUMAN);
    const [deu, pl, sun] = [id("DEU"), id("POL"), id("SUN")];
    pol.country(sun)!.ruling = IDEO_COM;
    dropPact(g, "SUN", "POL");
    const tick = g.ticks();
    expect(sendUltimatum(eg, deu, pl, [KRAKOW], tick)).toBeNull();
    expect(sendUltimatum(eg, sun, pl, [KRAKOW], tick)).toBeNull();
    const [first, second] = eg.ultimatums;
    expect(first.deadlineTick).toBe(tick + WW_ULT_CARD_TICKS);
    expect(second.deadlineTick).toBe(-1);
    stepTo(runner, first.deadlineTick + 1);
    expect(eg.ultimatums.map((u) => u.id)).toEqual([second.id]);
    expect(eg.ultimatums[0].deadlineTick).toBe(
      first.deadlineTick + WW_ULT_CARD_TICKS,
    );
    const day = ww.day(first.deadlineTick);
    expect(pol.legalOwner[KRAKOW]).toBe(pl);
    const goal = pol.country(deu)!.warGoals.find((x) => x.on === pl);
    expect(goal).toMatchObject({
      type: "claim",
      group: "east_poland",
      untilDay: day + WW_ULT_GOAL_DAYS,
    });
    expect(diploCooldownUntil(eg, deu, pl, "ultimatum")).toBe(
      day + WW_ULT_REFUSED_DAYS,
    );
    // The second answered by order: refused, the same.
    step(runner, 2, [
      order(HUMAN, { kind: "deal_reply", offer: second.id, accept: false }),
    ]);
    expect(eg.ultimatums).toEqual([]);
    expect(pol.hasWarGoal(sun, pl)).toBe(true);
  });

  test("an AI target answers on the next tick by its seeded roll; so does a human's AI under the diplomacy switch", async () => {
    for (const humans of [[], POL_HUMAN]) {
      const { runner, g, ww, eg, pol } = await started(humans);
      const [deu, pl] = [id("DEU"), id("POL")];
      if (humans.length > 0) ww.setAuto(pl, "diplomacy", true);
      expect(sendUltimatum(eg, deu, pl, [KRAKOW], g.ticks())).toBeNull();
      const u = eg.ultimatums[0];
      const f = ultimatumFacts(eg, deu, pl, u.regions);
      expect(f.senderStrength).toBeGreaterThan(3 * f.targetStrength);
      const gives = aiGivesIn(eg, u);
      step(runner);
      expect(eg.ultimatums).toEqual([]);
      expect(pol.legalOwner[KRAKOW]).toBe(gives ? deu : pl);
      expect(pol.hasWarGoal(deu, pl)).toBe(!gives);
    }
  });

  test("one that stops meaning anything lapses", async () => {
    const { runner, g, ww, eg, pol } = await started(POL_HUMAN);
    const [deu, pl, ita] = [id("DEU"), id("POL"), id("ITA")];
    sendUltimatum(eg, deu, pl, [KRAKOW], g.ticks());
    const u = eg.ultimatums[0];
    pol.setLegalOwner(KRAKOW, ita);
    expect(replyUltimatum(eg, pl, u.id, true, g.ticks())).toBe("deal_lapsed");
    expect(pol.legalOwner[KRAKOW]).toBe(ita);
    expect(replyUltimatum(eg, pl, u.id, true, g.ticks())).toBe("deal_no_offer");
    // A war between them ends a pending one too, with no goal.
    pol.setLegalOwner(KRAKOW, pl);
    eg.diploCooldowns = [];
    expect(sendUltimatum(eg, deu, pl, [KRAKOW], g.ticks())).toBeNull();
    ww.setWar(deu, pl, g.ticks(), { kind: "declare" });
    step(runner);
    expect(eg.ultimatums).toEqual([]);
    expect(pol.legalOwner[KRAKOW]).toBe(pl);
    expect(pol.hasWarGoal(deu, pl)).toBe(false);
  });

  test("the AI sends one for its claim on a weak neighbour, unless a major guarantees it in calm times", async () => {
    const { g, ww, eg, pol } = await started([], { historicalAi: false });
    const [deu, pl, gbr] = [id("DEU"), id("POL"), id("GBR")];
    const today = ww.day(g.ticks());
    const day = (WW_ULT_AI_DAYS - (deu % WW_ULT_AI_DAYS)) % WW_ULT_AI_DAYS;
    aiUltimatumDay(eg, deu, day + 1, g.ticks()); // not its day
    expect(eg.ultimatums).toEqual([]);
    addGuarantee(pol, gbr, pl, 0);
    aiUltimatumDay(eg, deu, day, g.ticks());
    expect(eg.ultimatums).toEqual([]);
    pol.wtBp = 5000;
    aiUltimatumDay(eg, deu, day, g.ticks());
    expect(eg.ultimatums).toHaveLength(1);
    expect(eg.ultimatums[0]).toMatchObject({
      from: deu,
      to: pl,
      regions: [KRAKOW],
    });
    expect(eg.diploCooldowns).toContainEqual([
      deu,
      pl,
      today + WW_ULT_COOLDOWN_DAYS,
      ULT,
    ]);
  });

  test("with the historical AI on, a pair a beat still names is the script's", async () => {
    const base = endgameFixture();
    const memel = NATIONAL_DECISIONS.find((d) => d.id === "deu_demand_memel")!;
    usePoliticsContent(
      endgameFixture({ decisions: [...base.decisions, memel] }),
    );
    const { g, ww, eg, pol } = await started();
    const [deu, pl, ltu, est] = [id("DEU"), id("POL"), id("LTU"), id("EST")];
    const day = ww.day(g.ticks());
    // A declare beat on Poland; deu_demand_memel's decision names
    // Lithuania; no German beat names Estonia.
    expect(scriptedPair(eg, deu, pl, day)).toBe(true);
    expect(scriptedPair(eg, deu, ltu, day)).toBe(true);
    expect(scriptedPair(eg, deu, est, day)).toBe(false);
    for (const s of pol.beats) s.done = true;
    expect(scriptedPair(eg, deu, ltu, day)).toBe(false);
    // Off: nothing is the script's.
    const off = await started([], { historicalAi: false });
    expect(scriptedPair(off.eg, deu, pl, day)).toBe(false);
  });

  test("a pending card restores in lockstep", async () => {
    const { runner, g, eg } = await started(POL_HUMAN);
    sendUltimatum(eg, id("DEU"), id("POL"), [KRAKOW], g.ticks());
    step(runner);
    const copy = await wwRestore(runner, POL_HUMAN, END_MAP);
    const ceg: WwEndgame = copy.game.worldWar()!.endgame;
    expect(ceg.ultimatums).toEqual(eg.ultimatums);
    expect(ceg.hash()).toBe(eg.hash());
    step(runner, 3);
    step(copy, 3);
    expect(ceg.hash()).toBe(eg.hash());
  });
});
