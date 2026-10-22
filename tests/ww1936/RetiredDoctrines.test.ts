// World War 1936 P6 (spec §1.4, plan decision 25, pre-flight §0-5): the 20
// old doctrine techs are retired — never offered, never researched, adding
// nothing; no engine code reads them by id any more.
import { MAJOR_TAGS } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { researchBlockOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { techStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  isRetiredTech,
  RETIRED_DOCTRINE_TECHS,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { aiResearchOrder } from "@openfront/engine/ww1936/economy/AiEconomy";
import { startResearch } from "@openfront/engine/ww1936/economy/ResearchRun";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import fs from "fs";
import path from "path";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

const RETIRED = RETIRED_DOCTRINE_TECHS as readonly WwTechId[];

describe("retired doctrine techs", () => {
  it("twenty, each with no effect", () => {
    expect(RETIRED).toHaveLength(20);
    for (const t of RETIRED) {
      expect(isRetiredTech(t), t).toBe(true);
      expect(WW_TECHS[t].retired, t).toBe(true);
      expect(WW_TECHS[t].effects, t).toEqual({});
    }
    expect(techStats(techTotals(new Set(RETIRED)))).toEqual(
      techStats(techTotals(new Set())),
    );
  });

  it("never offered: the research check and the order refuse them", async () => {
    const state = {
      researched: new Set<WwTechId>(WW_TECH_IDS),
      slots: [] as (WwTechId | null)[],
      slotCount: 3,
    };
    for (const t of RETIRED) {
      expect(
        researchBlockOf({ ...state, researched: new Set() }, t),
        t,
      ).not.toBeNull();
    }
    usePoliticsContent(depthFixture());
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const ce = ww.economy.country(DEEP.tag.DEU)!;
    for (const t of RETIRED) {
      if (ce.researched.has(t)) continue;
      expect(startResearch(ww.economy, ce, t), t).toBe("no_tech");
    }
    void state;
  });

  it("the AI's research lists never name them", () => {
    for (const tag of MAJOR_TAGS) {
      for (const coastal of [true, false]) {
        expect(
          aiResearchOrder(tag, coastal).filter(isRetiredTech),
          `${tag} ${coastal}`,
        ).toEqual([]);
      }
    }
    expect(aiResearchOrder("POL").filter(isRetiredTech)).toEqual([]);
  });

  it("no engine file reads a retired tech by id (only WwTechs, EconomyTypes and content may)", () => {
    const roots = [
      path.join(__dirname, "../../packages/engine/src"),
      path.join(__dirname, "../../packages/engine-lib/src"),
    ];
    const allowed = [/WwTechs\.ts$/, /EconomyTypes\.ts$/, /[/\\]content[/\\]/];
    const ids = new RegExp(`["'](${RETIRED.join("|")})["']`);
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (p.endsWith(".ts") && !allowed.some((a) => a.test(p))) {
          if (ids.test(fs.readFileSync(p, "utf8"))) bad.push(p);
        }
      }
    };
    roots.forEach(walk);
    expect(bad).toEqual([]);
  });
});
