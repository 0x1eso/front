// World War 1936 P3 (spec §10.4 diplomacy and territory groups, §12.6,
// controller ruling R1, Task 5): the effects as content writes them (K1's
// request events, K5's annexation form) and the engine's answers to
// requests, on ww1936pol with the test content.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { GENERIC_EVENTS } from "@openfront/engine-lib/ww1936/content/events/generic";
import { idHash, P_EVT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { aiAcceptScore } from "@openfront/engine/ww1936/politics/AiPolitics";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import {
  diploEventChoice,
  opinionOf,
} from "@openfront/engine/ww1936/politics/Treaties";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(politicsFixture()));
afterEach(() => usePoliticsContent(null));

const effectsOf = (event: string, opt: string): readonly Effect[] =>
  GENERIC_EVENTS.find((e) => e.id === event)!.options.find((o) => o.id === opt)!
    .effects;

async function game(historicalAi = true) {
  const runner = await wwRunner(
    { historicalAi },
    [{ clientID: HUMAN, country: "DEU" }],
    POL,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const p = pol(g);
  const id = (t: CountryTag) => byTag(g, t).smallID();
  /** Runs effects as `self` with an event's `from` and `target`. */
  const run = (
    self: number,
    effects: readonly Effect[],
    from = 0,
    target = 0,
  ) => applyEffects(makeCtx(p, self, from, target, g.ticks()), effects);
  return { runner, g, ww: g.worldWar()!, p, id, run };
}

// Game tests: slow under the full suite's load.
describe(
  "diplomacy and territory effects (spec §10.4)",
  { timeout: 60_000 },
  () => {
    it("war goals, declarations, joins and peace", async () => {
      const { ww, p, id, run } = await game();
      const [deu, csk, ltu, gbr, fra] = (
        ["DEU", "CSK", "LTU", "GBR", "FRA"] as const
      ).map(id);
      run(deu, [
        {
          kind: "war_goal",
          on: { tag: "CSK" },
          type: "claim",
          group: "sudetenland",
        },
      ]);
      expect(p.country(deu)!.warGoals).toMatchObject([
        { on: csk, type: "claim", group: "sudetenland" },
      ]);
      run(deu, [{ kind: "remove_war_goal", on: { tag: "CSK" } }]);
      expect(p.hasWarGoal(deu, csk)).toBe(false);
      // A refused declaration (the 1934 pact) leaves no goal behind.
      const pl = id("POL");
      run(deu, [{ kind: "declare_war", on: { tag: "POL" } }]);
      expect(ww.isAtWar(deu, pl)).toBe(false);
      expect(p.hasWarGoal(deu, pl)).toBe(false);
      // declare_war without a goal makes one on the spot: no penalty.
      const c = p.country(deu)!;
      run(deu, [{ kind: "declare_war", on: { tag: "LTU" } }]);
      expect(ww.isAtWar(deu, ltu)).toBe(true);
      expect([c.stabBaseBp, c.wsBaseBp]).toEqual([5000, 5000]);
      expect(p.threatBp[deu]).toBe(200);
      expect(p.hasWarGoal(deu, ltu)).toBe(false);
      // join_war: the two only.
      run(gbr, [{ kind: "join_war", of: { tag: "LTU" } }]);
      expect(ww.isAtWar(gbr, ltu)).toBe(true);
      expect(ww.isAtWar(fra, ltu)).toBe(false);
      // end_war: that pair only.
      run(ltu, [{ kind: "end_war", of: { tag: "DEU" } }]);
      expect(ww.isAtWar(deu, ltu)).toBe(false);
      expect(ww.isAtWar(gbr, ltu)).toBe(true);
      expect(c.declaredOn).toEqual([]);
      // opinion: a pair, or everyone's view of the actor.
      const [a, b] = [opinionOf(p, csk, gbr), opinionOf(p, fra, csk)];
      run(csk, [
        { kind: "opinion", of: { tag: "GBR" }, value: -30, days: 180 },
        { kind: "opinion", of: "all", value: -20, days: 180 },
      ]);
      expect(opinionOf(p, csk, gbr)).toBe(a - 30);
      expect(opinionOf(p, fra, csk)).toBe(b - 20);
    });

    it("faction effects: create, the request events' accept, invite, leave, kick, dissolve", async () => {
      const { ww, p, id, run } = await game();
      const [csk, aut, est, ltu] = (["CSK", "AUT", "EST", "LTU"] as const).map(
        id,
      );
      run(csk, [{ kind: "create_faction", name: "little_entente" }]);
      expect(ww.factionOf(csk)).toBe("f3");
      expect(p.faction(3)!.name).toBe("little_entente");
      // gen_diplo_faction_invite "a": the receiver joins the sender's faction.
      run(aut, effectsOf("gen_diplo_faction_invite", "a"), csk);
      // gen_diplo_faction_request "a": the sender joins the receiver's.
      run(csk, effectsOf("gen_diplo_faction_request", "a"), est);
      expect(ww.factionMembers("f3")).toEqual(
        [csk, aut, est].sort((x, y) => x - y),
      );
      // invite: a request event to the country.
      const asked = vi.spyOn(p, "queueEvent");
      run(csk, [{ kind: "invite", of: { tag: "LTU" } }]);
      expect(asked.mock.calls).toEqual([
        ["gen_diplo_faction_invite", ltu, csk, 0, 1],
      ]);
      // leave_faction pays 5% stability (controller ruling R8).
      run(est, [{ kind: "leave_faction" }]);
      expect(ww.factionOf(est)).toBeNull();
      expect(p.country(est)!.stabBaseBp).toBe(4500);
      run(csk, [{ kind: "kick", of: { tag: "AUT" } }]);
      expect(ww.factionOf(aut)).toBeNull();
      expect(p.country(aut)!.stabBaseBp).toBe(5000);
      run(csk, [{ kind: "dissolve_faction" }]);
      expect(ww.factionOf(csk)).toBeNull();
      expect(p.faction(3)).toBeNull();
    });

    it("treaty effects: pacts, guarantees and access", async () => {
      const { runner, p, id, run } = await game();
      const [deu, csk, gbr, aut] = (["DEU", "CSK", "GBR", "AUT"] as const).map(
        id,
      );
      // gen_diplo_nap "a": a pact with the sender.
      run(csk, effectsOf("gen_diplo_nap", "a"), deu);
      expect(p.isAtWarBlockedByNap(deu, csk)).toBe(true);
      const c = p.country(csk)!;
      // break_nap (an effect): no cost, no age rule, no penalty.
      run(csk, [{ kind: "break_nap", of: { tag: "DEU" } }]);
      expect(p.isAtWarBlockedByNap(deu, csk)).toBe(false);
      expect(c.stabBaseBp).toBe(5000);
      run(gbr, [{ kind: "guarantee", of: { tag: "CSK" } }]);
      expect(p.guarantorsOf(csk)).toEqual([gbr]);
      run(gbr, [{ kind: "end_guarantee", of: { tag: "CSK" } }]);
      expect(p.guarantorsOf(csk)).toEqual([]);
      // gen_diplo_access "a": the receiver opens its land to the sender.
      run(aut, effectsOf("gen_diplo_access", "a"), deu);
      expect(p.hasAccess(deu, aut)).toBe(true);
      expect(p.hasAccess(aut, deu)).toBe(false);
      run(aut, [{ kind: "end_access", of: { tag: "DEU" } }]);
      expect(p.hasAccess(deu, aut)).toBe(false);
      step(runner);
    });

    it("territory effects: K5's annexation form and a group transfer", async () => {
      const { runner, g, ww, p, id, run } = await game();
      const [deu, aut, csk] = (["DEU", "AUT", "CSK"] as const).map(id);
      // A country at war is not annexed (spec §17.2).
      ww.setWar(aut, csk, g.ticks());
      run(
        aut,
        [{ kind: "annex", who: "from", target: "self", core: true }],
        deu,
      );
      expect(p.legalOwner[11]).toBe(aut);
      ww.endWar(aut, csk);
      // Austria's event: Germany ("from") annexes it ("self").
      run(
        aut,
        [{ kind: "annex", who: "from", target: "self", core: true }],
        deu,
      );
      expect(p.legalOwner[11]).toBe(deu);
      expect(ww.land.controller[12]).toBe(deu);
      // Czechoslovakia's event hands the Sudetenland to Germany.
      run(csk, [
        { kind: "transfer_regions", group: "sudetenland", to: { tag: "DEU" } },
      ]);
      expect(p.legalOwner[13]).toBe(deu);
      expect(p.isCore(13)).toBe(false);
      expect(ww.land.controller[13]).toBe(deu);
      expect(p.legalOwner[14]).toBe(csk);
      step(runner, 3);
      expect(byTag(g, "AUT").isAlive()).toBe(false);
    });
  },
);

// Game tests: slow under the full suite's load.
describe(
  "the engine's answer to a request (controller ruling R1)",
  { timeout: 60_000 },
  () => {
    it("a call to arms follows history, or weights without it", async () => {
      const { g, p, id } = await game();
      const [gbr, fra, deu] = [id("GBR"), id("FRA"), id("DEU")];
      const day = p.ww.day(g.ticks());
      const i = p.content.beats.findIndex(
        (b) => b.id === "b1939_09_03_fra_deu",
      );
      // France has a history beat joining against Germany: it answers when due.
      p.beats[i] = { fireDay: day + 3, skipped: false, done: false };
      expect(diploEventChoice(p, "gen_call_to_arms", fra, gbr, deu)).toBe("a");
      p.beats[i] = { fireDay: day + 3, skipped: true, done: false };
      expect(diploEventChoice(p, "gen_call_to_arms", fra, gbr, deu)).toBe("b");
      p.beats[i] = { fireDay: day + 400, skipped: false, done: false };
      expect(diploEventChoice(p, "gen_call_to_arms", fra, gbr, deu)).toBe("b");
      // A done beat (it acted already) no longer answers.
      p.beats[i] = { fireDay: day, skipped: false, done: true };
      expect(diploEventChoice(p, "gen_call_to_arms", fra, gbr, deu)).toBe("b");
      // A guarantee's call history keeps is certain; otherwise the event decides.
      const g3 = p.content.beats.findIndex(
        (b) => b.id === "b1939_09_03_gbr_deu",
      );
      p.beats[g3] = { fireDay: day + 2, skipped: false, done: false };
      expect(
        diploEventChoice(p, "gen_guarantee_called", gbr, id("POL"), deu),
      ).toBe("a");
      p.beats[g3] = { fireDay: day + 2, skipped: true, done: false };
      expect(
        diploEventChoice(p, "gen_guarantee_called", gbr, id("POL"), deu),
      ).toBeNull();
      // Not a request event: the event's own weights decide.
      expect(diploEventChoice(p, "gen_t_choice", fra, gbr, deu)).toBeNull();
    });

    it("without historical AI a call to arms goes by weight", async () => {
      const { g, p, id } = await game(false);
      const [gbr, fra, deu, csk] = [id("GBR"), id("FRA"), id("DEU"), id("CSK")];
      const day = p.ww.day(g.ticks());
      const pick = (to: number, pct: number) =>
        (wwRoll(p.seed, P_EVT, idHash("gen_call_to_arms"), to, day) >>> 8) %
          100 <
        pct
          ? "a"
          : "b";
      // The leader calls: 80. A member calls its leader: 40, 20 on a major.
      expect(diploEventChoice(p, "gen_call_to_arms", fra, gbr, deu)).toBe(
        pick(fra, 80),
      );
      expect(diploEventChoice(p, "gen_call_to_arms", gbr, fra, csk)).toBe(
        pick(gbr, 40),
      );
      expect(diploEventChoice(p, "gen_call_to_arms", gbr, fra, deu)).toBe(
        pick(gbr, 20),
      );
    });

    it("a request history makes is accepted; otherwise the acceptance score decides", async () => {
      const { g, p, id } = await game();
      const [gbr, sun] = [id("GBR"), id("SUN")];
      const day = p.ww.day(g.ticks());
      const i = p.content.beats.findIndex(
        (b) => b.id === "b1941_07_12_gbr_nap_sun",
      );
      const byScore = (from: number, to: number) =>
        aiAcceptScore(p, "nap", from, to) >= 50 ? "a" : "b";
      // R1 (final): a due beat, neither skipped nor done (lane E marks it
      // done after it acts, so the beat's own request matches).
      p.beats[i] = { fireDay: day, skipped: false, done: false };
      expect(diploEventChoice(p, "gen_diplo_nap", sun, gbr, 0)).toBe("a");
      // A pact is mutual: the other way round matches too.
      expect(diploEventChoice(p, "gen_diplo_nap", gbr, sun, 0)).toBe("a");
      // Skipped, done, or not due yet: the acceptance score.
      for (const s of [
        { fireDay: day, skipped: true, done: false },
        { fireDay: day, skipped: false, done: true },
        { fireDay: day + 5, skipped: false, done: false },
      ]) {
        p.beats[i] = s;
        expect(diploEventChoice(p, "gen_diplo_nap", sun, gbr, 0)).toBe(
          byScore(gbr, sun),
        );
      }
      expect(diploEventChoice(p, "gen_diplo_access", sun, gbr, 0)).toBe(
        aiAcceptScore(p, "access", gbr, sun) >= 50 ? "a" : "b",
      );
    });
  },
);
