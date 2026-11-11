// ww184: the Imjin War researches its own table. No 1936 tech is offered
// in the Imjin profile (none of the Imjin table in 1936), and every Imjin
// tech's effect is read by the battle, siege or sea rules.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_TECH_IDS,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  emptyImjinTechTotals,
  IMJIN_TECH_IDS,
  imjinTechsOf,
  imjinTechTotals,
  isImjinTech,
  techArq,
  techBoard,
  techGrainDays,
  techGuns,
  techHullTaken,
} from "@openfront/engine-lib/imjin/ImjinTechs";
import {
  imjinRound,
  type RoundInput,
} from "@openfront/engine-lib/imjin/LandRound";
import {
  breachDaysFor,
  terrainRow,
  type UnitRow,
} from "@openfront/engine-lib/imjin/LandRules";
import type { ShipKind } from "@openfront/engine-lib/imjin/SeaRules";
import { researchBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  P_RESEARCH,
  researchPersonaOf,
  researchScores,
} from "@openfront/engine-lib/ww1936/ResearchScore";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const TAGS: readonly CountryTag[] = ["JOS", "JPN", "MIN", "JUR"];

function open(id: WwTechId, imjinTag: CountryTag | undefined): boolean {
  // Every prerequisite done, a free slot: only the table can block it.
  const researched = new Set<WwTechId>(WW_TECHS[id].prereqs);
  return (
    researchBlockOf({ researched, slots: [], slotCount: 3, imjinTag }, id) !==
    "no_tech"
  );
}

function scored(imjinTag: CountryTag | undefined, tag: CountryTag) {
  const s = researchScores({
    seed: 7,
    smallID: 1,
    tag,
    persona: researchPersonaOf(tag),
    day: 400,
    human: false,
    lean: 0,
    coastal: true,
    lineFactories: {},
    navalLines: 0,
    bonusKeys: [],
    shared: [],
    researched: new Set(),
    running: [],
    ...(imjinTag === undefined ? {} : { imjinTag }),
  });
  return WW_TECH_IDS.filter((_, k) => s[k] !== null);
}

describe("the Imjin War's research table", () => {
  it("offers each Imjin country only its own Imjin techs, and 1936 none of them", () => {
    expect(P_RESEARCH).toBeTypeOf("number");
    for (const tag of TAGS) {
      const own = new Set<WwTechId>(imjinTechsOf(tag));
      expect(own.size).toBeGreaterThan(0);
      const offered = WW_TECH_IDS.filter((id) => open(id, tag));
      expect(offered.filter((id) => !own.has(id))).toEqual([]);
      expect(offered.length).toBe(own.size);
      expect(scored(tag, tag).filter((id) => !own.has(id))).toEqual([]);
    }
    // No armour, rifles or aircraft for Joseon; nothing Imjin in 1936.
    for (const id of ["light_tank_1", "inf_eq_2", "fighter_1"] as const)
      expect(open(id, "JOS")).toBe(false);
    for (const id of IMJIN_TECH_IDS) expect(open(id, undefined)).toBe(false);
    expect(scored(undefined, "JPN").filter(isImjinTech)).toEqual([]);
  });

  it("every Imjin tech changes a number the rules read", () => {
    const base: RoundInput = {
      seed: 1,
      region: 5,
      battleStart: 0,
      round: 1,
      terrain: "plain",
      wet: false,
      att: { order: "advance", mix: {}, skill: 0, hwachaUsed: false },
      def: { order: "hold", mix: { spear: 100 }, skill: 0, hwachaUsed: false },
      crossing: null,
      fort: 0,
      ambushed: false,
      broken: false,
    };
    const kinds = (m: Partial<Record<ShipKind, number>> | undefined) =>
      Object.keys(m ?? {}) as ShipKind[];
    const none = emptyImjinTechTotals();
    for (const id of IMJIN_TECH_IDS) {
      const fx = WW_TECHS[id].imjin!.fx;
      const t = imjinTechTotals([id]);
      let read = 0;
      for (const row of Object.keys(fx.row ?? {}) as UnitRow[]) {
        // Some round of the battle where the row fights deals more.
        let more = false;
        for (let round = 1; round <= 14 && !more; round++) {
          const inp = {
            ...base,
            round,
            att: { ...base.att, mix: { [row]: 100 } },
          };
          more =
            imjinRound({ ...inp, att: { ...inp.att, tech: t } }).attDealtPct >
            imjinRound(inp).attDealtPct;
        }
        expect(more, `${id} ${row}`).toBe(true);
        read++;
      }
      const walls = { ...base, terrain: "walled" as const, fort: 1 };
      if (fx.wallBlockPct) {
        expect(
          imjinRound({ ...walls, def: { ...walls.def, tech: t } }).blockPct,
        ).toBeGreaterThan(imjinRound(walls).blockPct);
        read++;
      }
      const storm = {
        ...walls,
        round: 12,
        att: { ...walls.att, order: "storm" as const, mix: { spear: 100 } },
      };
      if (fx.stormPct) {
        expect(
          imjinRound({ ...storm, att: { ...storm.att, tech: t } }).attDealtPct,
        ).toBeGreaterThan(imjinRound(storm).attDealtPct);
        read++;
      }
      const barrage = {
        ...walls,
        att: { ...walls.att, order: "barrage" as const, mix: { cannon: 100 } },
      };
      if (fx.barrageMorale) {
        expect(
          imjinRound({ ...barrage, att: { ...barrage.att, tech: t } })
            .defMorale,
        ).toBeGreaterThan(imjinRound(barrage).defMorale);
        read++;
      }
      if (fx.breachPct) {
        const wall = terrainRow("walled");
        expect(breachDaysFor(3, wall, false, false, t.breachPct)).toBeLessThan(
          breachDaysFor(3, wall, false, false, 0),
        );
        read++;
      }
      if (fx.grainDays) {
        expect(techGrainDays(t, 30)).toBeGreaterThan(techGrainDays(none, 30));
        read++;
      }
      for (const k of kinds(fx.heavy)) {
        expect(techGuns(t, k, true)).toBeGreaterThan(techGuns(t, k, false));
        read++;
      }
      for (const k of kinds(fx.light)) {
        expect(techGuns(t, k, false)).toBeGreaterThan(0);
        read++;
      }
      for (const k of kinds(fx.arq)) {
        expect(techArq(t, k)).toBeGreaterThan(0);
        read++;
      }
      for (const k of kinds(fx.board)) {
        expect(techBoard(t, k)).toBeGreaterThan(0);
        read++;
      }
      for (const k of kinds(fx.hullPct)) {
        expect(techHullTaken(t, k, 1000)).toBeLessThan(1000);
        read++;
      }
      if (fx.gunnery) read++;
      expect(read, id).toBeGreaterThan(0);
      // Nothing of 1936's stats.
      expect(WW_TECHS[id].effects).toEqual({});
    }
    // The engine reads the sea helpers, the grain, and the gunnery.
    const src = (f: string) =>
      fs.readFileSync(path.resolve("packages/engine/src/imjin", f), "utf8");
    const sea = src("sea/SeaBattle.ts");
    for (const fn of ["techGuns(", "techArq(", "techBoard(", "techHullTaken("])
      expect(sea).toContain(fn);
    expect(sea).toContain("tk.gunnery");
    expect(src("land/Sieges.ts")).toContain("techGrainDays(");
    expect(src("land/Sieges.ts")).toContain(".breachPct");
    expect(src("land/ImjinBattle.ts")).toContain("tech: techOf(");
  });
});
