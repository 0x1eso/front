// World War 1936 P3 (spec §15, Task 5): factions as state — joining at
// war, the leader's succession, new faction keys, the ideology rule — on
// ww1936pol with the test content.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { FACTION_NAMES } from "@openfront/engine-lib/ww1936/content/countries";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  createFaction,
  joinFaction,
  leaveFaction,
} from "@openfront/engine/ww1936/politics/Factions";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { worldWarCamps } from "@openfront/engine/ww1936/Victory";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  land,
  order,
  pol,
  POL,
  step,
  stepTo,
  wwRunnerCapture,
} from "./util";

// Spec §15.2's name table (K6's), with the test content.
beforeEach(() =>
  usePoliticsContent(politicsFixture({ factionNames: FACTION_NAMES })),
);
afterEach(() => usePoliticsContent(null));

const AXIS = 0;
const ALLIES = 1;

async function game(human: CountryTag = "DEU") {
  const { runner, updates } = await wwRunnerCapture(
    {},
    [{ clientID: HUMAN, country: human }],
    POL,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  const id = (t: CountryTag) => byTag(g, t).smallID();
  const declare = (a: CountryTag, b: CountryTag) => {
    addWarGoal(pol(g), id(a), id(b), "conquer", "", ww.day(g.ticks()));
    return declareWar(g, ww, byTag(g, a), byTag(g, b), g.ticks());
  };
  const said = (key: string) =>
    updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === `events_display.${key}`);
  return { runner, g, ww, p: pol(g), id, declare, said };
}

const last = <T>(xs: readonly T[]): T | undefined => xs[xs.length - 1];

// Game tests: slow under the full suite's load.
describe("factions (spec §15)", { timeout: 60_000 }, () => {
  it("faction members joining a faction at war enter its wars", async () => {
    const { g, ww, p, id, declare, said } = await game();
    const [deu, aut, csk, ltu, fra] = (
      ["DEU", "AUT", "CSK", "LTU", "FRA"] as const
    ).map(id);
    declare("DEU", "CSK");
    expect(ww.isAtWar(deu, csk)).toBe(true);
    joinFaction(p, aut, AXIS, g.ticks());
    expect(p.factionMembers(AXIS)).toContain(aut);
    expect(ww.factionOf(aut)).toBe("axis");
    // The Axis's enemy is the new member's, with no chain beyond it.
    expect(ww.isAtWar(aut, csk)).toBe(true);
    expect(ww.isAtWar(aut, ltu)).toBe(false);
    expect(ww.isAtWar(aut, fra)).toBe(false);
    // The land war's sides follow at once.
    expect(land(g).sameSide(aut, deu)).toBe(true);
    expect(last(said("ww1936_faction_joined"))?.params).toEqual({
      countryTag: "AUT",
      faction: "axis",
    });
  });

  it("the faction leader passes to the largest member", async () => {
    const { runner, g, ww, p, id, said } = await game("GBR");
    const [gbr, fra, csk, aut] = (["GBR", "FRA", "CSK", "AUT"] as const).map(
      id,
    );
    joinFaction(p, csk, ALLIES, g.ticks());
    joinFaction(p, aut, ALLIES, g.ticks());
    expect(p.faction(ALLIES)!.leader).toBe(gbr);
    // Czechoslovakia has the most factories now (civilian + military).
    const t = ww.economy.country(csk)!.totals;
    t.civ = 50;
    t.mil = 50;
    step(runner, 1, [order(HUMAN, { kind: "faction_leave" })]);
    const f = p.faction(ALLIES)!;
    expect(f.members).toEqual([fra, csk, aut].sort((a, b) => a - b));
    expect(f.leader).toBe(csk);
    expect(ww.factionOf(gbr)).toBeNull();
    expect(land(g).sameSide(gbr, fra)).toBe(false);
    // Leaving costs 5% stability (the order's, spec §15.3).
    expect(p.country(gbr)!.stabBaseBp).toBe(4500);
    expect(last(said("ww1936_faction_left"))?.params).toEqual({
      countryTag: "GBR",
      faction: "allies",
    });
    expect(last(said("ww1936_faction_leader"))?.params).toEqual({
      countryTag: "CSK",
      faction: "allies",
    });
  });

  it("an empty faction disappears and its number is not reused", async () => {
    const { g, ww, p, id } = await game();
    const [aut, est] = [id("AUT"), id("EST")];
    const day = ww.day(g.ticks());
    expect(createFaction(p, aut, undefined, day)).toBe(3);
    expect(ww.factionOf(aut)).toBe("f3");
    expect(p.faction(3)).toMatchObject({
      name: "auto",
      nameTag: "AUT",
      leader: aut,
      members: [aut],
    });
    leaveFaction(p, aut, g.ticks());
    expect(p.faction(3)).toBeNull();
    expect(ww.factionOf(aut)).toBeNull();
    expect(createFaction(p, est, undefined, day)).toBe(4);
    expect(ww.factionOf(est)).toBe("f4");
    expect(p.factions.map((f) => f.idx)).toEqual([0, 1, 2, 4]);
  });

  it("ideology rules gate invitations", async () => {
    const { g, p, id, declare } = await game();
    const [deu, aut] = [id("DEU"), id("AUT")];
    p.country(deu)!.ruling = IDEO_FAS;
    p.country(deu)!.ppMilli = 500_000;
    p.wtBp = 5000;
    const invite = () =>
      p.issue(deu, { kind: "faction_invite", target: aut }, g.ticks());
    const austria = p.country(aut)!;
    austria.ruling = IDEO_DEM;
    expect(invite()).toBe("faction_rule");
    austria.ruling = IDEO_COM;
    expect(invite()).toBe("faction_rule");
    // Neutral into a fascist faction is fine, once tension allows neutrals.
    austria.ruling = IDEO_NEU;
    p.wtBp = 3000;
    expect(invite()).toBe("tension_gate");
    p.wtBp = 5000;
    const pp = p.country(deu)!.ppMilli;
    expect(invite()).toBeNull();
    expect(p.country(deu)!.ppMilli).toBe(pp - 25_000);
    // A common enemy overrides ideology.
    austria.ruling = IDEO_COM;
    declare("DEU", "CSK");
    declare("AUT", "CSK");
    expect(invite()).toBeNull();
    // A war the faction does not fight would come along: refused.
    declare("AUT", "LTU");
    expect(invite()).toBe("faction_war");
    // Only the leader invites.
    expect(
      p.issue(id("ITA"), { kind: "faction_invite", target: aut }, g.ticks()),
    ).toBe("faction_rule");
  });

  it("new factions get the next key f3", async () => {
    const { runner, g, ww, p, id } = await game("CSK");
    const [csk, aut] = [id("CSK"), id("AUT")];
    const c = p.country(csk)!;
    p.wtBp = 5000;
    // A minor needs the can_create_faction flag (a focus gives it).
    step(runner, 1, [order(HUMAN, { kind: "faction_create" })]);
    expect(ww.factionOf(csk)).toBeNull();
    c.flags.set("can_create_faction", [0, -1]);
    step(runner, 1, [order(HUMAN, { kind: "faction_create" })]);
    expect(ww.factionOf(csk)).toBe("f3");
    // Spec §15.2: Czechoslovakia founds the Little Entente.
    expect(p.faction(3)!.name).toBe("little_entente");
    joinFaction(p, aut, 3, g.ticks());
    expect(ww.factionMembers("f3")).toEqual([csk, aut].sort((a, b) => a - b));
    // The verdict counts the new faction as one camp.
    const camp = worldWarCamps(g, ww).find((x) => x.camp === "f3");
    expect(camp?.members).toEqual([csk, aut].sort((a, b) => a - b));
    expect(
      worldWarCamps(g, ww).some((x) => x.camp === csk || x.camp === aut),
    ).toBe(false);
  });
});
