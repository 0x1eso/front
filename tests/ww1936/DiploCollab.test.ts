// World War 1936 diplomacy D2 (ww161 Design B §2; lane L5): collaboration
// governments — the order's rules, the country it wakes (the gone country
// itself, the named tag, a civil-war slot), the neutral puppet it is, the
// costs, the exile's legitimacy, the fold when the exile comes home, the
// AI's monthly check, and the record through snapshot and restore.
// End map (ww1936end) with the end fixture; Germany claims the Sudetenland.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_COLLAB_EXILE_LEGIT_LOSS_BP,
  WW_COLLAB_PP,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  CS_ACTIVE,
  CS_GONE,
  WW_WAKE_DIV_MAX,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { activateCountry } from "@openfront/engine/ww1936/endgame/Activate";
import {
  aiCollabDay,
  COLLAB_NAME_KEY,
  createCollab,
} from "@openfront/engine/ww1936/endgame/Collab";
import { diploData } from "@openfront/engine/ww1936/endgame/DiploState";
import { endExile, formExile } from "@openfront/engine/ww1936/endgame/Exile";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { setGovernment } from "@openfront/engine/ww1936/politics/Ideology";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  END_MAP,
  gameHash,
  stepTo,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() =>
  usePoliticsContent(
    endgameFixture({ claims: [{ tag: "DEU", groups: ["sudetenland"] }] }),
  ),
);
afterEach(() => usePoliticsContent(null));

const id = (t: CountryTag) => endId(t);
const FASCIST = IDEOLOGIES.indexOf("fascist");
const DEMOCRATIC = IDEOLOGIES.indexOf("democratic");
/** Czechoslovakia: Sudetenland 3 (Germany's claim), Prague 15, Slovakia 2, Kosice 3. */
const CSK_LAND = [13, 14, 15, 20];

/** A game on day 35 (so 30 days of occupation fit), an empty board, a fascist Germany with political power. */
async function started() {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  stepTo(runner, dayStartTick(35, ww.prepEndTick()) + 1);
  clearLand(g);
  const deu = id("DEU");
  setGovernment(ww.politics, deu, FASCIST, g.ticks());
  ww.politics.country(deu)!.ppMilli = 200_000;
  return { runner, g, ww, eg: ww.endgame, deu };
}

/** `to` controls `regions`, administered since day 1 (`since`: another day). */
function occupy(
  g: Game,
  ww: WorldWar,
  regions: readonly number[],
  to: number,
  since = 1,
): void {
  for (const r of regions) {
    ww.land.setController(r, to, g.ticks());
    ww.endgame.occSince[r] = since;
  }
}

/** `loser` capitulated to `victor` and is gone (no exile). */
function gone(g: Game, ww: WorldWar, loser: number, victor: number): void {
  ww.addCapitulation(loser, victor, g.ticks());
  ww.endgame.setCountryState(loser, CS_GONE);
}

describe(
  "World War 1936 diplomacy D2: collaboration government",
  { timeout: 120_000 },
  () => {
    it("the order's rules: a capitulated country, its main occupier for 30 days, no democracy, its own land, 25% of its points, the price", async () => {
      const { g, ww, eg, deu } = await started();
      const csk = id("CSK");
      const ita = id("ITA");
      const t = () => g.ticks();
      // A country still playing is no target.
      expect(createCollab(eg, deu, csk, [14], t())).toBe("bad_target");
      gone(g, ww, csk, deu);
      // Held only since today: not yet 30 days.
      const today = ww.day(t());
      occupy(g, ww, CSK_LAND, deu, today + 1);
      expect(createCollab(eg, deu, csk, [14], t())).toBe("collab_not_occupier");
      occupy(g, ww, CSK_LAND, deu);
      // Italy holding more of it is the main occupier.
      occupy(g, ww, [14], ita);
      expect(createCollab(eg, deu, csk, [15, 20], t())).toBe(
        "collab_not_occupier",
      );
      occupy(g, ww, [14], deu);
      // A democracy liberates at the conference instead.
      setGovernment(ww.politics, deu, DEMOCRATIC, t());
      expect(createCollab(eg, deu, csk, [14], t())).toBe("collab_democracy");
      setGovernment(ww.politics, deu, FASCIST, t());
      // Its own claim, a region twice, someone else's land: refused.
      expect(createCollab(eg, deu, csk, [13, 14], t())).toBe(
        "collab_bad_region",
      );
      expect(createCollab(eg, deu, csk, [14, 14], t())).toBe(
        "collab_bad_region",
      );
      expect(createCollab(eg, deu, csk, [14, 6], t())).toBe(
        "collab_bad_region",
      );
      // Slovakia and Kosice are 5 of 23 points: under 25%.
      expect(createCollab(eg, deu, csk, [15, 20], t())).toBe(
        "collab_too_small",
      );
      ww.politics.country(deu)!.ppMilli = WW_COLLAB_PP * 1000 - 1;
      expect(createCollab(eg, deu, csk, [14], t())).toBe("no_pp");
      expect(eg.collabs).toEqual([]);
    });

    it("a partial pick wakes the named tag as a neutral puppet that owns and holds the land; the price is paid; the record survives a restore", async () => {
      const { runner, g, ww, eg, deu } = await started();
      const pol = ww.politics;
      const [csk, svk] = [id("CSK"), id("SVK")];
      gone(g, ww, csk, deu);
      occupy(g, ww, CSK_LAND, deu);
      const pp = pol.country(deu)!.ppMilli;
      const wt = pol.wtBp;
      const day = ww.day(g.ticks());
      expect(createCollab(eg, deu, csk, [20, 14, 15], g.ticks())).toBeNull();
      for (const r of [14, 15, 20]) {
        expect(pol.legalOwner[r]).toBe(svk);
        expect(ww.land.controller[r]).toBe(svk);
      }
      // The claim stays Germany's occupation.
      expect(pol.legalOwner[13]).toBe(csk);
      expect(ww.land.controller[13]).toBe(deu);
      expect(eg.countryStateArr[svk]).toBe(CS_ACTIVE);
      expect(eg.subjectOf(svk)).toEqual({
        overlord: deu,
        level: "puppet",
        neutral: true,
      });
      expect(pol.factionIdx(svk)).toBe(-1);
      expect(pol.country(svk)!.ruling).toBe(FASCIST);
      const divs = ww.land.rowsOf(svk).length;
      expect(divs).toBeGreaterThanOrEqual(1);
      expect(divs).toBeLessThanOrEqual(WW_WAKE_DIV_MAX);
      expect(pol.country(deu)!.ppMilli).toBe(pp - WW_COLLAB_PP * 1000);
      expect(pol.wtBp).toBeGreaterThan(wt);
      // Germany's garrison duty there is over.
      expect(eg.administeredOf(deu)).not.toContain(14);
      expect(eg.collabs).toEqual([
        { smallID: svk, creator: deu, origin: csk, sinceDay: day },
      ]);
      expect(diploData(eg, false)?.collabs).toEqual(eg.collabs);
      // One government a country.
      expect(createCollab(eg, deu, csk, [13], g.ticks())).toBe(
        "collab_scripted",
      );
      const restored = await wwRestore(runner, [], END_MAP);
      expect(restored.game.worldWar()!.endgame.collabs).toEqual(eg.collabs);
      expect(gameHash(restored)).toBe(gameHash(runner));
    });

    it("all of a gone country's land wakes the country itself; else a civil-war slot named after it; with none free the order is refused", async () => {
      const { g, ww, eg, deu } = await started();
      const pol = ww.politics;
      const [est, poland, ltu] = [id("EST"), id("POL"), id("LTU")];
      const cw1 = id("CW1");
      gone(g, ww, est, deu);
      occupy(g, ww, [18, 19], deu);
      expect(createCollab(eg, deu, est, [18, 19], g.ticks())).toBeNull();
      expect(eg.countryStateArr[est]).toBe(CS_ACTIVE);
      expect(pol.legalOwner[18]).toBe(est);
      expect(ww.land.controller[19]).toBe(est);
      expect(eg.subjectOf(est)?.neutral).toBe(true);
      // Poland has no named tag: the first slot, "Poland State".
      gone(g, ww, poland, deu);
      occupy(g, ww, [6, 7], deu);
      expect(createCollab(eg, deu, poland, [6], g.ticks())).toBeNull();
      expect(pol.legalOwner[6]).toBe(cw1);
      expect(eg.nameKey[cw1]).toBe(COLLAB_NAME_KEY);
      expect(eg.nameArg[cw1]).toBe("POL");
      expect(eg.subjectOf(cw1)?.overlord).toBe(deu);
      // Every slot taken.
      for (const t of ["CW2", "CW3", "CW4", "CW5", "CW6"] as const) {
        eg.setCountryState(id(t), CS_ACTIVE);
      }
      gone(g, ww, ltu, deu);
      occupy(g, ww, [16, 17], deu);
      expect(createCollab(eg, deu, ltu, [17], g.ticks())).toBe(
        "collab_no_slot",
      );
    });

    it("an exile loses legitimacy once; its collaborators fold back into it when it comes home", async () => {
      const { g, ww, eg, deu } = await started();
      const pol = ww.politics;
      const [fra, vic] = [id("FRA"), id("VIC")];
      ww.setWar(deu, fra, g.ticks(), { kind: "declare" });
      ww.setWar(deu, id("GBR"), g.ticks(), { kind: "declare" });
      occupy(g, ww, [1, 2], deu);
      ww.addCapitulation(fra, deu, g.ticks());
      expect(formExile(eg, fra, deu, g.ticks())).toBe(true);
      const ex = () => eg.exiles[eg.exileIdx.get(fra)!];
      const legit = ex().legitBp;
      // Lyon alone is 3 of 24 points.
      expect(createCollab(eg, deu, fra, [2], g.ticks())).toBe(
        "collab_too_small",
      );
      expect(createCollab(eg, deu, fra, [1], g.ticks())).toBeNull();
      expect(pol.legalOwner[1]).toBe(vic);
      expect(ww.land.controller[1]).toBe(vic);
      expect(eg.subjectOf(vic)?.neutral).toBe(true);
      expect(ex().legitBp).toBe(
        Math.max(0, legit - WW_COLLAB_EXILE_LEGIT_LOSS_BP),
      );
      expect(eg.collabs.map((c) => [c.smallID, c.origin])).toEqual([
        [vic, fra],
      ]);
      // Home (its capital back, or "come home as my subject"): Vichy folds in.
      endExile(eg, fra, g.ticks(), "returned");
      expect(pol.legalOwner[1]).toBe(fra);
      expect(ww.land.controller[1]).toBe(fra);
      expect(eg.countryStateArr[vic]).toBe(CS_GONE);
      expect(eg.subjectOf(vic)).toBeNull();
      expect(ww.land.rowsOf(vic)).toHaveLength(0);
      expect(eg.collabs).toEqual([]);
    });

    it("a scripted collaborator (Vichy awake) blocks the generic order for its country", async () => {
      const { g, ww, eg, deu } = await started();
      const fra = id("FRA");
      gone(g, ww, fra, deu);
      occupy(g, ww, [1, 2], deu);
      activateCountry(
        eg,
        "VIC",
        {
          regions: [2],
          overlord: { smallID: deu, level: "puppet", neutral: true },
        },
        g.ticks(),
      );
      expect(createCollab(eg, deu, fra, [1], g.ticks())).toBe(
        "collab_scripted",
      );
    });

    it("the AI sets one up monthly once it has held 60% for 60 days and the land is restless or under-garrisoned", async () => {
      const { g, ww, eg, deu } = await started();
      const [csk, svk] = [id("CSK"), id("SVK")];
      gone(g, ww, csk, deu);
      occupy(g, ww, CSK_LAND, deu);
      // Its day of the month, 60 days on.
      let day = 61;
      while (day % 30 !== deu % 30) day++;
      // Quiet and covered: nothing.
      for (const r of CSK_LAND) {
        eg.supDeci[r] = 1_000_000;
        eg.resBp[r] = 0;
      }
      aiCollabDay(eg, deu, day, g.ticks());
      expect(eg.collabs).toEqual([]);
      // Not its day of the month: nothing.
      for (const r of CSK_LAND) eg.resBp[r] = 5000;
      aiCollabDay(eg, deu, day + 1, g.ticks());
      expect(eg.collabs).toEqual([]);
      // Restless: every region it may pick, its claim kept.
      aiCollabDay(eg, deu, day, g.ticks());
      expect(eg.collabs.map((c) => [c.smallID, c.creator, c.origin])).toEqual([
        [svk, deu, csk],
      ]);
      for (const r of [14, 15, 20]) expect(ww.politics.legalOwner[r]).toBe(svk);
      expect(ww.land.controller[13]).toBe(deu);
    });
  },
);
