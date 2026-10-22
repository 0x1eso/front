// World War 1936 P3 (spec §17, plan decisions 17, 18, Review Focus 3, Task
// 5): peaceful annexation, partial transfers and peace on ww1936pol (AUT
// 11–12, CSK 13–15 on the southern islands) with the test content.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  checkCapitulations,
  heldStartVp,
} from "@openfront/engine/ww1936/Capitulation";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  annexCountry,
  endWarBetween,
  transferGroup,
} from "@openfront/engine/ww1936/politics/Territory";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { politicsFixture } from "./politicsFixture";
import {
  byTag,
  HUMAN,
  land,
  placeArmy,
  pol,
  POL,
  step,
  stepTo,
  takeRegion,
  wwRunner,
} from "./util";

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      groups: [
        { id: "sudetenland", regions: [13], owner1936: "CSK" },
        { id: "bohemia_moravia", regions: [14], owner1936: "CSK" },
        // A big transfer to share the tick's 2,000-tile budget with.
        { id: "test_poland", regions: [6, 7], owner1936: "POL" },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }], POL);
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const id = (t: CountryTag) => byTag(g, t).smallID();
  return { runner, g, ww: g.worldWar()!, p: pol(g), l: land(g), id };
}

/** Land tiles of `region` owned by `smallID`, and all of them. */
function tilesOf(runner: GameRunner, region: number, smallID: number) {
  const g = runner.game;
  const map = g.map();
  const sc = g.worldWar()!.scenario;
  let mine = 0;
  let all = 0;
  for (const t of sc.regionTiles(region)) {
    if (!map.isLand(t) || map.isImpassable(t)) continue;
    all++;
    if (g.ownerID(t) === smallID) mine++;
  }
  return { mine, all };
}

/** Germany annexes Austria and waits until Austria is gone. */
function anschluss(runner: GameRunner): void {
  const g = runner.game;
  const p = pol(g);
  const [deu, aut] = [byTag(g, "DEU").smallID(), byTag(g, "AUT").smallID()];
  annexCountry(p, deu, aut, "transfer", true, g.ticks());
  for (let i = 0; i < 10 && byTag(g, "AUT").isAlive(); i++) step(runner);
}

// Game tests: slow under the full suite's load.
describe("peaceful territory changes (spec §17)", { timeout: 60_000 }, () => {
  it("annexing a country moves its regions, divisions, stock and manpower", async () => {
    const { runner, g, ww, p, l, id } = await game();
    const [deu, aut] = [id("DEU"), id("AUT")];
    const t = l.divisions;
    const owned = (o: number) => {
      const out: number[] = [];
      for (let r = 0; r < t.rows; r++) {
        if (t.id[r] !== 0 && t.owner[r] === o) out.push(t.id[r]);
      }
      return out.sort((a, b) => a - b);
    };
    if (owned(aut).length === 0) placeArmy(g, "AUT", 11, 2);
    const autDivisions = owned(aut);
    const autArmies = l.armiesOf(aut).length;
    const deuArmies = l.armiesOf(deu).length;
    const nextNo = l.country(deu)!.nextArmyNo;
    const [de, at] = [ww.economy.country(deu)!, ww.economy.country(aut)!];
    const stock = de.stock.map((v, i) => v + at.stock[i]);
    const [mpDe, mpAt] = [de.manpower, at.manpower];
    const ceiling = Math.max(
      0,
      de.totals.recruitable +
        at.totals.recruitable -
        l.armyMen(deu) -
        t.men.reduce(
          (s, m, r) => s + (t.id[r] !== 0 && t.owner[r] === aut ? m : 0),
          0,
        ),
    );

    annexCountry(p, deu, aut, "transfer", true, g.ticks());

    for (const r of [11, 12]) {
      expect(p.legalOwner[r]).toBe(deu);
      expect(p.isCore(r)).toBe(true);
      expect(l.controller[r]).toBe(deu);
    }
    // The same divisions, now Germany's, in new German armies numbered on.
    expect(owned(aut)).toEqual([]);
    expect(autDivisions.every((d) => owned(deu).includes(d))).toBe(true);
    expect(l.armiesOf(deu)).toHaveLength(deuArmies + autArmies);
    expect(l.country(deu)!.nextArmyNo).toBe(nextNo + autArmies);
    expect(
      l.armiesOf(deu).every((a) => a.general === 0 || a.nameNo < nextNo),
    ).toBe(true);
    for (const d of autDivisions) {
      const r = t.rowOf(d);
      expect(l.templateOf(deu, t.template[r])).not.toBeNull();
    }
    // Stock adds up; manpower up to the two countries' ceiling.
    expect(de.stock).toEqual(stock);
    expect(at.stock.every((v) => v === 0)).toBe(true);
    expect(de.manpower).toBe(Math.min(mpDe + mpAt, Math.max(mpDe, ceiling)));
    expect(at.manpower).toBe(0);
    // Austria dies with its last tile (P0 rule).
    step(runner, 2);
    expect(byTag(g, "AUT").isAlive()).toBe(false);
    expect(p.living(aut)).toBe(false);
    expect(tilesOf(runner, 11, deu).mine).toBe(tilesOf(runner, 11, deu).all);
    expect(tilesOf(runner, 12, deu).mine).toBe(tilesOf(runner, 12, deu).all);
  });

  it("the victory-point tile follows control during a peaceful transfer", async () => {
    const { runner, g, ww, p, l, id } = await game();
    const [deu, csk, pl] = [id("DEU"), id("CSK"), id("POL")];
    // Germany borders the Sudetenland once Austria is its (Tyrol, 12).
    anschluss(runner);
    expect(l.controller[12]).toBe(deu);
    const vp = ww.scenario.vpTile(ww.scenario.region(13)!);
    const cskRows = [...l.rowsIn(13)].filter(
      (r) => l.divisions.owner[r] === csk,
    );
    // Poland's two regions (3,000 tiles) and the Sudetenland the same tick.
    transferGroup(p, pl, deu, "test_poland", false, g.ticks());
    transferGroup(p, csk, deu, "sudetenland", true, g.ticks());
    expect(p.legalOwner[13]).toBe(deu);
    expect(p.isCore(13)).toBe(true);
    expect(p.isCore(6)).toBe(false);
    expect(l.controller[13]).toBe(deu);
    expect(g.ownerID(vp)).toBe(deu);
    // Czechoslovak divisions there went to its nearest region (Prague).
    for (const r of cskRows) {
      if (l.divisions.id[r] !== 0) expect(l.divisions.region[r]).toBe(14);
    }
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      step(runner);
      expect(g.ownerID(vp)).toBe(l.controller[13]);
      seen.push(tilesOf(runner, 13, deu).mine);
    }
    const { all } = tilesOf(runner, 13, deu);
    // The budget went to Poland's regions first: the rest took 2+ ticks.
    expect(seen[0]).toBeLessThan(all);
    expect(seen[seen.length - 1]).toBe(all);
  });

  it("a transfer to oneself with core makes the group's regions cores (P6 pre-flight C2)", async () => {
    const { runner, g, ww, p, l, id } = await game();
    const [deu, csk] = [id("DEU"), id("CSK")];
    anschluss(runner);
    transferGroup(p, csk, deu, "sudetenland", false, g.ticks());
    expect(p.legalOwner[13]).toBe(deu);
    expect(p.isCore(13)).toBe(false);
    // Without core it does nothing; nothing changes hands either way.
    transferGroup(p, deu, deu, "sudetenland", false, g.ticks());
    expect(p.isCore(13)).toBe(false);
    transferGroup(p, deu, deu, "sudetenland", true, g.ticks());
    expect(p.isCore(13)).toBe(true);
    expect(p.legalOwner[13]).toBe(deu);
    expect(l.controller[13]).toBe(deu);
    // A region it does not legally own stays as it is.
    transferGroup(p, deu, deu, "bohemia_moravia", true, g.ticks());
    expect(p.legalOwner[14]).toBe(csk);
    expect(ww.endgame.hasCore(deu, 14)).toBe(false);
  });

  it("end_war returns occupied regions to their legal owner", async () => {
    const { runner, g, ww, p, l, id } = await game();
    const [deu, csk] = [id("DEU"), id("CSK")];
    anschluss(runner);
    addWarGoal(p, deu, csk, "conquer", "", ww.day(g.ticks()));
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "CSK"), g.ticks());
    expect(p.country(deu)!.declaredOn).toContain(csk);
    takeRegion(g, 13, "DEU");
    step(runner, 2);
    const army = placeArmy(g, "DEU", 13, 1);
    const row = l.divisions.rowOf(army.divisions[0]);
    expect(l.controller[13]).toBe(deu);
    expect(p.legalOwner[13]).toBe(csk);

    endWarBetween(p, deu, csk, g.ticks());

    expect(ww.isAtWar(deu, csk)).toBe(false);
    expect(l.controller[13]).toBe(csk);
    const vp = ww.scenario.vpTile(ww.scenario.region(13)!);
    expect(g.ownerID(vp)).toBe(csk);
    // The German division went home (Tyrol), at once.
    expect(l.divisions.region[row]).toBe(12);
    expect(p.country(deu)!.declaredOn).not.toContain(csk);
    for (let i = 0; i < 4; i++) {
      step(runner);
      expect(g.ownerID(vp)).toBe(l.controller[13]);
    }
    const back = tilesOf(runner, 13, csk);
    expect(back.mine).toBe(back.all);
  });

  it("capitulation uses the legal owner's regions", async () => {
    const { runner, g, ww, p, id } = await game();
    const [deu, fra] = [id("DEU"), id("FRA")];
    // Germany 21 + 4, Austria's Vienna 15 + Tyrol 2.
    expect(heldStartVp(g, ww, deu)).toBe(25);
    anschluss(runner);
    expect(heldStartVp(g, ww, deu)).toBe(42);
    addWarGoal(p, fra, deu, "conquer", "", ww.day(g.ticks()));
    declareWar(g, ww, byTag(g, "FRA"), byTag(g, "DEU"), g.ticks());
    expect(p.surrenderPct(deu)).toBe(80);
    // Berlin and Munich: 25 of 42 lost, under the 80% line.
    takeRegion(g, 3, "FRA");
    takeRegion(g, 4, "FRA");
    checkCapitulations(g, ww, g.ticks());
    expect(ww.capitulationGauge(deu)).toBe(0);
    // Vienna too: 40 of 42.
    takeRegion(g, 11, "FRA");
    checkCapitulations(g, ww, g.ticks());
    expect(ww.capitulationGauge(deu)).toBe(1);
  });
});
