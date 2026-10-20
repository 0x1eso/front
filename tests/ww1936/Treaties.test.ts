// World War 1936 P3 (spec §16, Task 5): guarantees and their call,
// non-aggression pacts, military access, opinion — on ww1936pol with the
// test content.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  IDEO_FAS,
  WW_MAX_OPINIONS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { GENERIC_EVENTS } from "@openfront/engine-lib/ww1936/content/events/generic";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import {
  addAccess,
  addGuarantee,
  addNap,
  addOpinion,
  opinionOf,
} from "@openfront/engine/ww1936/politics/Treaties";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  dropPact,
  HUMAN,
  land,
  order,
  placeArmy,
  pol,
  POL,
  step,
  stepTo,
  WwHuman,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
const option = (event: string, opt: string) =>
  GENERIC_EVENTS.find((e) => e.id === event)!.options.find(
    (o) => o.id === opt,
  )!;

async function game(tags: CountryTag[]) {
  const humans: WwHuman[] = tags.map((country, i) => ({
    clientID: i === 0 ? HUMAN : `HUMAN00${i + 1}`,
    country,
  }));
  const runner = await wwRunner({}, humans, POL);
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const id = (t: CountryTag) => byTag(g, t).smallID();
  return { runner, g, ww: g.worldWar()!, p: pol(g), id };
}

// Game tests: slow under the full suite's load.
describe("treaties (spec §16)", { timeout: 60_000 }, () => {
  it("a guarantee fires a call event when the target is attacked", async () => {
    const { g, ww, p, id } = await game(["DEU"]);
    const [deu, gbr, fra, csk, aut] = (
      ["DEU", "GBR", "FRA", "CSK", "AUT"] as const
    ).map(id);
    const day = ww.day(g.ticks());
    addGuarantee(p, gbr, csk, day);
    expect(p.guarantorsOf(csk)).toEqual([gbr]);
    const asked = vi.spyOn(p, "queueEvent");
    addWarGoal(p, deu, csk, "conquer", "", day);
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "CSK"), g.ticks());
    // Spec §16.1: the guarantor is asked (from = the guaranteed, target =
    // the attacker). Italy (AI, historical AI, no beat against CSK) is not
    // called to arms (controller ruling, lane D fix 1).
    expect(asked.mock.calls).toEqual([
      ["gen_guarantee_called", gbr, csk, deu, 0],
    ]);
    // Its "keep the promise" option (K1's data, AI 85, two days' delay)
    // joins the war; France (AI) has the 1939-09-03 beat, so Britain's
    // call to arms reaches it once that beat is near.
    asked.mockClear();
    const i = p.content.beats.findIndex((b) => b.id === "b1939_09_03_fra_deu");
    p.beats[i] = { fireDay: day + 2, skipped: false, done: false };
    applyEffects(
      makeCtx(p, gbr, csk, deu, g.ticks()),
      option("gen_guarantee_called", "a").effects,
    );
    expect(ww.isAtWar(gbr, deu)).toBe(true);
    expect(ww.isAtWar(gbr, id("ITA"))).toBe(false);
    expect(asked.mock.calls).toEqual([["gen_call_to_arms", fra, gbr, deu, 0]]);
    // Spec §16.1: at war with each other, the guarantee no longer binds;
    // a guarantor that backs down loses its guarantee.
    addGuarantee(p, fra, aut, day);
    const seen = opinionOf(p, id("POL"), fra);
    applyEffects(
      makeCtx(p, fra, aut, deu, g.ticks()),
      option("gen_guarantee_called", "b").effects,
    );
    expect(p.guarantorsOf(aut)).toEqual([]);
    // Everyone thinks 20 less of it (its stability is lane P's effect).
    expect(opinionOf(p, id("POL"), fra)).toBe(seen - 20);
  });

  it("a guarantor already fighting the guaranteed's enemy, or held by a pact, is not called", async () => {
    const { g, ww, p, id } = await game(["DEU"]);
    const [deu, gbr, sun, pl, ltu] = (
      ["DEU", "GBR", "SUN", "POL", "LTU"] as const
    ).map(id);
    const day = ww.day(g.ticks());
    const declare = (a: "DEU" | "SUN", b: "POL" | "LTU") => {
      dropPact(g, a, b);
      addWarGoal(p, id(a), id(b), "conquer", "", day);
      declareWar(g, ww, byTag(g, a), byTag(g, b), g.ticks());
    };
    const called = (spy: { mock: { calls: unknown[][] } }) =>
      spy.mock.calls.filter((c) => c[0] === "gen_guarantee_called");
    // Britain guarantees Poland and already fights Germany, Poland's enemy:
    // the Soviet attack on Poland does not ask it again.
    addGuarantee(p, gbr, pl, day);
    declare("DEU", "POL");
    ww.setWar(gbr, deu, g.ticks());
    const asked = vi.spyOn(p, "queueEvent");
    declare("SUN", "POL");
    expect(ww.isAtWar(sun, pl)).toBe(true);
    expect(called(asked)).toEqual([]);
    // Germany guarantees Lithuania but has a pact with the Soviet Union.
    addGuarantee(p, deu, ltu, day);
    addNap(p, deu, sun, day);
    declare("SUN", "LTU");
    expect(ww.isAtWar(sun, ltu)).toBe(true);
    expect(called(asked)).toEqual([]);
  });

  it("a pact can be broken only after 180 days (start pacts at once)", async () => {
    const { runner, g, ww, p, id } = await game(["DEU"]);
    const [deu, csk, pl] = [id("DEU"), id("CSK"), id("POL")];
    const c = p.country(deu)!;
    c.ppMilli = 500_000;
    const day = ww.day(g.ticks());
    addNap(p, deu, csk, day);
    const pair = (x: number, y: number) =>
      p.naps.find((n) => n.a === Math.min(x, y) && n.b === Math.max(x, y));
    const nap = pair(deu, csk)!;
    expect(nap.startTreaty).toBe(false);
    const brk = (target: number) =>
      p.issue(deu, { kind: "nap_break", target }, g.ticks());
    nap.sinceDay = day - 179;
    expect(brk(csk)).toBe("nap_young");
    nap.sinceDay = day - 180;
    const before = opinionOf(p, csk, deu);
    const pp = c.ppMilli;
    expect(brk(csk)).toBeNull();
    expect(p.isAtWarBlockedByNap(deu, csk)).toBe(false);
    // 50 PP, −5% stability, +3% tension, −50 opinion (and the pact's +10, the tension's −3).
    expect(c.ppMilli).toBe(pp - 50_000);
    expect(c.stabBaseBp).toBe(4500);
    expect(p.threatBp[deu]).toBe(300);
    expect(opinionOf(p, csk, deu)).toBe(before - 50 - 10 - 3);
    // The 1934 German–Polish pact: at once.
    expect(pair(deu, pl)!.startTreaty).toBe(true);
    expect(brk(pl)).toBeNull();
    // An offer is a request event; a pact already there is refused.
    step(runner, 1, [order(HUMAN, { kind: "nap_offer", target: csk })]);
    addNap(p, deu, csk, day);
    expect(p.issue(deu, { kind: "nap_offer", target: csk }, g.ticks())).toBe(
      "treaty_exists",
    );
  });

  it("revoking access moves the armies home that day", async () => {
    const { runner, g, ww, p, id } = await game(["POL"]);
    const [deu, pl] = [id("DEU"), id("POL")];
    const l = land(g);
    addAccess(p, deu, pl);
    expect(l.canEnter(deu, 6)).toBe(true);
    const army = placeArmy(g, "DEU", 6, 2);
    const rows = army.divisions.map((d) => l.divisions.rowOf(d));
    // With access they stay through the next common step.
    const d0 = ww.day(g.ticks());
    stepTo(runner, dayStart(d0 + 2));
    for (const r of rows) expect(l.divisions.region[r]).toBe(6);
    step(runner, 1, [order(HUMAN, { kind: "access_revoke", target: deu })]);
    expect(p.hasAccess(deu, pl)).toBe(false);
    expect(l.canEnter(deu, 6)).toBe(false);
    // The day's common step sends them to Germany's nearest region.
    stepTo(runner, dayStart(ww.day(g.ticks()) + 1) + 1);
    for (const r of rows) {
      expect(l.divisions.id[r]).not.toBe(0);
      expect(l.controller[l.divisions.region[r]]).toBe(deu);
    }
    // Revoking what was never given is refused.
    expect(p.issue(pl, { kind: "access_revoke", target: deu }, g.ticks())).toBe(
      "bad_target",
    );
    // On an island with no German region to reach: home to the capital
    // (Berlin, region 3; HOI4), not disbanded.
    const csk = id("CSK");
    addAccess(p, deu, csk);
    const far = placeArmy(g, "DEU", 15, 1);
    const row = l.divisions.rowOf(far.divisions[0]);
    expect(
      p.issue(csk, { kind: "access_revoke", target: deu }, g.ticks()),
    ).toBe(null);
    stepTo(runner, dayStart(ww.day(g.ticks()) + 1) + 1);
    expect(l.divisions.id[row]).not.toBe(0);
    expect(l.divisions.region[row]).toBe(3);
  });

  it("opinion sums its parts and decays", async () => {
    const { runner, g, ww, p, id } = await game(["DEU"]);
    const [deu, ita, csk, fra] = (["DEU", "ITA", "CSK", "FRA"] as const).map(
      id,
    );
    // Same ideology +20 (all neutral here), same faction +50.
    expect(opinionOf(p, deu, ita)).toBe(70);
    p.country(deu)!.ruling = IDEO_FAS;
    expect(opinionOf(p, deu, ita)).toBe(40);
    p.country(deu)!.ruling = p.country(ita)!.ruling;
    // Germany–Czechoslovakia: +20, a pact +10, Czechoslovakia guarantees
    // Germany +20 (Germany's view only), CSK's 5.5% tension −5 (whole %).
    const day = ww.day(g.ticks());
    expect(opinionOf(p, deu, csk)).toBe(20);
    addNap(p, deu, csk, day);
    addGuarantee(p, csk, deu, day);
    p.threatBp[csk] = 550;
    expect(opinionOf(p, deu, csk)).toBe(20 + 10 + 20 - 5);
    expect(opinionOf(p, csk, deu)).toBe(20 + 10);
    // Timed modifiers: both ways for a pair; "all" is everyone's view of one.
    addOpinion(p, deu, csk, 30, 3);
    addOpinion(p, csk, "all", -20, 10);
    expect(opinionOf(p, deu, csk)).toBe(45 + 30 - 20);
    expect(opinionOf(p, csk, deu)).toBe(30 + 30);
    expect(opinionOf(p, fra, csk)).toBe(20 - 5 - 20);
    // Clamped to −100..100.
    addOpinion(p, deu, csk, 90, 3);
    expect(opinionOf(p, deu, csk)).toBe(100);
    // They lapse in the common step.
    stepTo(runner, dayStart(day + 4) + 1);
    expect(opinionOf(p, deu, csk)).toBe(45 - 20);
    stepTo(runner, dayStart(day + 11) + 1);
    expect(opinionOf(p, deu, csk)).toBe(45);
    // At most WW_MAX_OPINIONS: the oldest go first.
    for (let i = 0; i < WW_MAX_OPINIONS + 5; i++) {
      addOpinion(p, deu, fra, i === 0 ? 7 : 1, 100);
    }
    expect(p.opinions).toHaveLength(WW_MAX_OPINIONS);
    expect(p.opinions.some((o) => o.value === 7)).toBe(false);
    // improve_relations: +30 for 180 days, once per target per 180 days.
    p.opinions = [];
    const before = opinionOf(p, deu, fra);
    expect(
      p.issue(deu, { kind: "improve_relations", target: fra }, g.ticks()),
    ).toBeNull();
    expect(opinionOf(p, deu, fra)).toBe(before + 30);
    expect(
      p.issue(deu, { kind: "improve_relations", target: fra }, g.ticks()),
    ).toBe("decision_cooldown");
  });
});
