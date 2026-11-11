// ww171 phase 4 (design ww168 B5, B7): war between any pair. The fronts and
// their ends, the general war from the treaties, a pair's own war and peace,
// declarations between seats, the AI's cap, and a save from before.
import {
  GW_THEATRES,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_LADDER_POWERS,
  GW_LADDER_SCENES,
} from "@openfront/engine-lib/ww1914/content/ladder";
import {
  gwPowerPackProblems,
  gwPowerProblems,
} from "@openfront/engine-lib/ww1914/PowerRows";
import { gwWorldOf } from "@openfront/engine-lib/ww1914/World1914";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { GW_GOV } from "@openfront/engine/ww1914/GovTable";
import { GreatWar, GreatWarSnapshot } from "@openfront/engine/ww1914/GreatWar";
import { monthsHold } from "@openfront/engine/ww1914/Ladder";
import {
  GW_PAIR_WARS_MAX,
  pairHolds,
  peaceTargets,
  seatDeclares,
  warStep,
  warTargets,
} from "@openfront/engine/ww1914/PairWar";
import { GW_FRONT_ENDS, reachable } from "@openfront/engine/ww1914/Tables";
import {
  declareWar,
  leaveWar,
  makePeace,
  openWar,
  pairWars,
} from "@openfront/engine/ww1914/Wars";
import { fights, monthsFrom } from "@openfront/engine/ww1914/World";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const res = (p: string) => path.join(__dirname, "../../resources", p);
const json = (p: string) => JSON.parse(fs.readFileSync(res(p), "utf8"));
const NEW_FRONTS: readonly GwTheatre[] = GW_THEATRES.slice(10);

let gw: GreatWar;
const open = (t: GwTheatre) => gw.s.theatres.find((x) => x.id === t)!.open;
const live = () =>
  gw.s.wars.filter((w) => w.ended === null).map((w) => `${w.a}-${w.b}`);

beforeEach(async () => {
  const { runner } = await gwRunner({}, "GWPAIR1");
  gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
});

describe("the fronts", () => {
  test("six new fronts, each end borders the other on the real map", () => {
    expect(NEW_FRONTS).toEqual([
      "alps",
      "danube",
      "thrace",
      "low_countries",
      "dobruja",
      "persia",
    ]);
    const data = ScenarioDataSchema.parse(json("maps/world1914/scenario.json"));
    const index = ScenarioIndex.fromFiles(
      data,
      new Uint8Array(fs.readFileSync(res("maps/world1914/regions.bin"))),
    );
    const world = gwWorldOf(index);
    const tagOf = (id: number) => world.tags[world.owners[id] - 1];
    const borders = new Set<string>();
    for (const [a, b] of index.regionPairs()) {
      const x = tagOf(a);
      const y = tagOf(b);
      if (x !== undefined && y !== undefined && x !== y) {
        borders.add(`${x}-${y}`).add(`${y}-${x}`);
      }
    }
    for (const t of NEW_FRONTS) {
      const e = GW_FRONT_ENDS[t];
      const touch = e.central.some((a) =>
        e.entente.some((b) => borders.has(`${a}-${b}`)),
      );
      expect(touch, t).toBe(true);
    }
  });

  test("a pair can reach each other only across a front", () => {
    expect(reachable("FRA", "ITA")).toBe(true);
    expect(reachable("ROU", "BGR")).toBe(true);
    expect(reachable("DEU", "NLD")).toBe(true);
    expect(reachable("FRA", "GBR")).toBe(false);
    expect(reachable("DEU", "AUH")).toBe(false);
  });
});

describe("the general war", () => {
  test("July founds the coalitions; the treaties bring the rest", () => {
    openWar(gw);
    expect(gw.s.warChapter).toBe(gw.s.chapter);
    expect(gw.nation("AUH")!.side).toBe("central");
    expect(gw.nation("SRB")!.side).toBe("entente");
    expect(gw.s.wars[0]).toMatchObject({ a: "AUH", b: "SRB", cause: "july" });
    // atWar is the wars' shadow, both ways.
    for (const n of gw.s.nations) {
      for (const x of n.atWar) {
        expect(gw.nation(x)!.atWar, `${n.tag}-${x}`).toContain(n.tag);
      }
    }
    expect(live().length).toBe(
      gw.s.nations.reduce((a, n) => a + n.atWar.length, 0) / 2,
    );
    // Germany's seat is bound by its own papers in the war's first chapter.
    if (gw.nation("RUS")!.side === "entente") {
      expect(gw.nation("DEU")!.side).toBe("central");
    }
    expect(open("balkan")).toBe(true);
  });
});

describe("a pair's own war", () => {
  test("two neutrals fight alone; their peace closes the fronts", () => {
    expect(declareWar(gw, "BGR", "ROU", "test")).toBe(true);
    expect(gw.s.warChapter).toBeNull();
    expect(gw.nation("BGR")!.side).toBeNull();
    expect(fights(gw.nation("ROU"))).toBe(true);
    expect(open("dobruja")).toBe(true);
    expect(open("danube")).toBe(true);
    expect(open("east")).toBe(false);
    expect(pairWars(gw)).toHaveLength(1);
    expect(gw.s.news.map((x) => x.key)).toContain("war_pair");
    expect(makePeace(gw, "ROU", "BGR")).toBe(true);
    expect(open("dobruja")).toBe(false);
    expect(fights(gw.nation("ROU"))).toBe(false);
    expect(gw.s.wars[0].ended).toBe(gw.s.chapter);
    expect(gw.s.news.map((x) => x.key)).toContain("pair_peace");
  });

  test("two powers of opposite camps are the general war", () => {
    expect(declareWar(gw, "RUS", "AUH", "test")).toBe(true);
    expect(gw.s.warChapter).not.toBeNull();
    expect(gw.nation("RUS")!.side).toBe("entente");
    expect(gw.nation("AUH")!.side).toBe("central");
  });

  test("a coalition's victim with sympathies joins; one without fights alone", () => {
    openWar(gw);
    expect(declareWar(gw, "DEU", "NLD", "test")).toBe(true);
    expect(gw.nation("NLD")!.side).toBeNull();
    expect(open("low_countries")).toBe(true);
    expect(pairWars(gw).map((w) => w.b)).toContain("NLD");
    expect(declareWar(gw, "AUH", "ROU", "test")).toBe(true);
    expect(gw.nation("ROU")!.side).toBe("entente");
    // A neutral that goes to war on a coalition's member joins the other.
    expect(declareWar(gw, "ITA", "AUH", "test")).toBe(true);
    expect(gw.nation("ITA")!.side).toBe("entente");
  });
});

describe("the seat's tab and friends", () => {
  test("war needs a refused note or a partner's war; peace any foe", () => {
    expect(warTargets(gw, "DEU")).toEqual([]);
    gw.s.ladders.push({
      from: "DEU",
      to: "FRA",
      step: "rejected",
      opened: 0,
      chapter: 0,
    });
    expect(warTargets(gw, "DEU")).toEqual(["FRA"]);
    expect(peaceTargets(gw, "DEU")).toEqual([]);
  });

  test("a seat's declaration on a seat arrives as the chapter closes", () => {
    const deu = gw.s.seats[0];
    gw.s.seats.push({ ...structuredClone(deu), smallID: 99, tag: "FRA" });
    seatDeclares(gw, deu, "FRA");
    expect(live()).toEqual([]);
    expect(gw.s.pairNotes).toMatchObject([{ from: "DEU", to: "FRA" }]);
    expect(gw.s.seats[1].scheduled.map((q) => q.scene)).toContain(
      "gw_war_note",
    );
    warStep(gw);
    expect(live()).toContain("DEU-FRA");
    expect(gw.s.pairNotes).toEqual([]);
  });
});

describe("governments nobody plays", () => {
  beforeEach(async () => {
    const { runner } = await gwRunner(
      { greatWar1914Calendar: "full" },
      "GWPAIR2",
    );
    gw = runner.game.greatWar()!;
    gw.s.chain = null;
    gw.s.spark = null;
    // A month-long chapter, when the AI weighs its wars.
    gw.s.chapter = 12;
  });

  test("no new ultimatum while the world has its fill of wars", () => {
    const pairs: [GwTag, GwTag][] = [
      ["BGR", "ROU"],
      ["GRC", "OTT"],
      ["ITA", "FRA"],
    ];
    for (const [a, b] of pairs) declareWar(gw, a, b, "test");
    expect(pairWars(gw).length).toBe(GW_PAIR_WARS_MAX);
    const notes = gw.s.ladders.length;
    warStep(gw);
    expect(gw.s.ladders.length).toBe(notes);
  });

  test("weary of it, two make their own peace", () => {
    declareWar(gw, "BGR", "ROU", "test");
    for (const tag of ["BGR", "ROU"] as const) {
      gw.nation(tag)!.gauges.morale = 1;
      gw.nation(tag)!.manpower = 10;
    }
    gw.s.chapter = 24;
    warStep(gw);
    expect(live()).toEqual([]);
  });
});

describe("the scenes' conditions (merge 4)", () => {
  const holds = (c: GwWorldCond): boolean => {
    const seat = gw.s.seats[0];
    if (c.is === "ladder") return monthsHold(gw, seat, c);
    return pairHolds(gw, seat, c as Parameters<typeof pairHolds>[2]);
  };

  test("who declared a war of two", () => {
    expect(declareWar(gw, "BGR", "ROU", "declared")).toBe(true);
    const war = (by: GwTag): GwWorldCond => ({
      is: "pair_war",
      tag: "ROU",
      with: "BGR",
      by,
    });
    expect(holds(war("BGR"))).toBe(true);
    expect(holds(war("ROU"))).toBe(false);
  });

  test("another country's ultimatum, by its sender", () => {
    gw.s.ladders.push({
      from: "AUH",
      to: "RUS",
      step: "war",
      opened: 0,
      chapter: 0,
    });
    const note = (nation: GwTag, role: "from" | "to"): GwWorldCond => ({
      is: "ladder",
      nation,
      role,
      tag: nation === "AUH" ? "RUS" : "AUH",
      of: ["war"],
    });
    expect(holds(note("AUH", "from"))).toBe(true);
    expect(holds(note("RUS", "to"))).toBe(true);
    expect(holds(note("RUS", "from"))).toBe(false);
    // The seat's own ladders are untouched: Germany sent nobody a note.
    expect(holds({ is: "ladder", of: ["war"] })).toBe(false);
  });

  test("a peace offered, a peace both reached, a fall", () => {
    const peace = (
      how: ("offer" | "mutual" | "fell")[],
      by?: GwTag,
    ): GwWorldCond => ({ is: "pair_peace", tag: "BGR", with: "ROU", how, by });
    declareWar(gw, "BGR", "ROU", "test");
    makePeace(gw, "ROU", "BGR", "ROU");
    expect(holds(peace(["offer"], "ROU"))).toBe(true);
    expect(holds(peace(["offer"], "BGR"))).toBe(false);
    expect(holds(peace(["mutual", "fell"]))).toBe(false);
    declareWar(gw, "BGR", "SRB", "test");
    makePeace(gw, "BGR", "SRB", null);
    expect(
      holds({ is: "pair_peace", tag: "SRB", how: ["mutual"], max: 0 }),
    ).toBe(true);
    declareWar(gw, "GRC", "OTT", "test");
    leaveWar(gw, "OTT", "nation_beaten");
    expect(holds({ is: "pair_peace", tag: "GRC", how: ["fell"] })).toBe(true);
    expect(
      holds({ is: "pair_peace", tag: "GRC", how: ["offer", "mutual"] }),
    ).toBe(false);
  });

  test("a front, counted from when a country came onto it", () => {
    declareWar(gw, "BGR", "ROU", "test");
    const on = (tag: GwTag): GwWorldCond => ({
      is: "front_months",
      theatre: "dobruja",
      tag,
      max: 0,
    });
    expect(holds(on("ROU"))).toBe(true);
    expect(holds(on("RUS"))).toBe(false);
    // Months after the front opened, Russia comes onto it: its count starts.
    const since = gw.s.chapter;
    gw.s.chapter = gwChapters(gw.s.calendar).length - 1;
    expect(monthsFrom(gw, since)).toBeGreaterThan(0);
    const t = gw.s.theatres.find((x) => x.id === "dobruja")!;
    expect(t.since).toBe(since);
    expect(holds(on("ROU"))).toBe(false);
    expect(declareWar(gw, "RUS", "BGR", "test")).toBe(true);
    expect(holds(on("RUS"))).toBe(true);
  });
});

describe("saves and words", () => {
  test("a save from before gets its wars from atWar, and the new fronts", () => {
    const d = structuredClone(gw.s) as unknown as Record<string, unknown>;
    const nations = d.nations as { tag: string; atWar: string[] }[];
    nations.find((n) => n.tag === "DEU")!.atWar = ["FRA"];
    nations.find((n) => n.tag === "FRA")!.atWar = ["DEU"];
    delete d.wars;
    d.theatres = (d.theatres as { id: string }[]).slice(0, 10);
    const out = GreatWarSnapshot.migrations[2](d) as typeof gw.s;
    expect(out.wars).toMatchObject([{ a: "DEU", b: "FRA", ended: null }]);
    expect(out.theatres.map((t) => t.id)).toEqual([...GW_THEATRES]);
  });

  test("the new rows and cards hold together and have their words", async () => {
    const scenes = new Map(GW_CONTENT.scenes.map((x) => [x.id, x]));
    const threats = new Set([
      ...GW_GOV.map((r) => r.id),
      ...(GW_CONTENT.plots ?? []).map((r) => r.id),
    ]);
    const mine =
      /_pw_(war_on|peace_with)|gw_(war_note|pair_offer|war_sent|peace_sent)/;
    expect(
      gwPowerProblems(GW_CONTENT, scenes, threats).filter((x) => mine.test(x)),
    ).toEqual([]);
    for (const sc of GW_LADDER_SCENES) expect(gwSceneProblems(sc)).toEqual([]);
    const why = Object.keys(json("lang/en.json").gw.power.why);
    for (const tag of ["DEU", "GBR", "AUH", "RUS", "FRA"] as const) {
      const pack = await loadGwPack(tag, async (p) => json(p));
      const rows = GW_LADDER_POWERS.filter((p) => p.tag === tag);
      expect(gwPowerPackProblems(rows, pack, why)).toEqual([]);
      for (const sc of GW_LADDER_SCENES) {
        const t = pack.scenes[sc.id];
        expect(t, sc.id).toBeDefined();
        for (const o of sc.options ?? []) expect(t.opt?.[o.id]).toBeDefined();
      }
    }
    const en = json("lang/en.json").gw;
    for (const t of NEW_FRONTS) {
      expect(en.theatre[t], t).toBeDefined();
      expect(en.reason[`front_${t}_won`], t).toBeDefined();
    }
    for (const k of ["war_pair", "pair_peace", "pair_peace_refused"]) {
      expect(en.news[k], k).toBeDefined();
    }
  });
});
