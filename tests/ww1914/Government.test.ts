import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwSceneEffects } from "@openfront/engine-api/ww1914/SceneCheck";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import { closeSeat } from "@openfront/engine/ww1914/Endings";
import {
  govBeaten,
  govHeatBy,
  govSoon,
  govStep,
  govView,
  pollOf,
} from "@openfront/engine/ww1914/Government";
import { GW_ELECTIONS, GW_GOV } from "@openfront/engine/ww1914/GovTable";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { GreatWarSnapshot } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { castOf, sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, newGame, playRun, startOf } from "./sim/GwSim";

const res = (f: string) => path.join(__dirname, "../../resources", f);
const json = (f: string) => JSON.parse(fs.readFileSync(res(f), "utf8"));

let map: MapFiles;
beforeAll(async () => {
  map = await loadMapFiles(
    new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
});

let games = 0;

async function runnerOf(tag: GwTag): Promise<GameRunner> {
  return newGame(map, startOf(`gov-t-${games++}`, "full", [], tag));
}

async function game(tag: GwTag): Promise<GreatWar> {
  return (await runnerOf(tag)).game.greatWar()!;
}

/** Puts the game on a month-long chapter past every row's first date. */
function late(gw: GreatWar): void {
  const list = gwChapters(gw.s.calendar);
  gw.s.chapter = list.findIndex((c) => c.spanDays >= 28 && c.day > 0) + 34;
  gw.s.day = list[gw.s.chapter].day;
}

const row = (id: string) => GW_GOV.find((r) => r.id === id)!;

/** Puts a scene on the desk and takes an option through the real order. */
function take(gw: GreatWar, scene: string, option: string): void {
  const seat = gw.s.seats[0];
  seat.desk = [];
  seat.scheduled = [{ scene, chapter: gw.s.chapter }];
  dealDesk(gw, seat);
  const card = seat.desk.find((c) => c.scene === scene)!;
  expect(card, scene).toBeDefined();
  const refused = applyGwOrder(gw, seat, {
    kind: "choose",
    card: card.uid,
    option,
  });
  expect(refused).toBeNull();
}

describe("the table", () => {
  test("every row's scenes exist, in its nation, and a talk comes first", () => {
    for (const r of GW_GOV) {
      for (const s of r.steps) {
        const scene = sceneOf(s.scene);
        expect(scene, s.scene).not.toBeNull();
        expect(scene!.nation).toEqual([r.tag]);
      }
      const ats = r.steps.map((s) => s.at);
      expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    }
    for (const r of GW_GOV.filter((x) => x.id !== "gbr_election")) {
      expect(sceneOf(r.steps[0].scene)!.kind, r.id).toBe("talk");
    }
  });

  test("a fatal row can end the game, and only there; a safe way comes first", () => {
    for (const r of GW_GOV) {
      const last = sceneOf(r.steps[r.steps.length - 1].scene)!;
      const ends = gwSceneEffects(last).some((e) => e.kind === "end");
      expect(ends, r.id).toBe(r.fatal);
      for (const s of r.steps.slice(0, -1)) {
        const mid = gwSceneEffects(sceneOf(s.scene)!);
        expect(mid.some((e) => e.kind === "end")).toBe(false);
      }
    }
  });

  test("nothing here changes who the seat is", () => {
    for (const s of gwContent().scenes.filter((x) => x.id.startsWith("gov_"))) {
      for (const e of gwSceneEffects(s)) {
        if (e.kind === "flag") expect(e.flag).not.toBe("f_pm_lg");
      }
    }
  });

  test("each talk opens an option in a later scene of its row", () => {
    for (const r of GW_GOV.filter((x) => x.id !== "gbr_election")) {
      const talk = sceneOf(r.steps[0].scene)!;
      const keys = gwSceneEffects(talk).flatMap((e) =>
        e.kind === "remember" ? [e.key] : [],
      );
      const later = r.steps.slice(1).flatMap((s) => {
        return (sceneOf(s.scene)!.options ?? []).map((o) =>
          JSON.stringify(o.when ?? null),
        );
      });
      expect(
        keys.some((k) => later.some((w) => w.includes(`"${k}"`))),
        r.id,
      ).toBe(true);
    }
  });

  test.each(["DEU", "GBR", "AUH", "RUS"] as GwTag[])(
    "%s has its reason lines, names and feeds in both languages",
    async (tag) => {
      const pack = await loadGwPack(tag, async (p) => json(p));
      for (const lang of ["en", "ko"]) {
        const gov = json(`lang/${lang}.json`).gw.gov;
        for (const r of GW_GOV.filter((x) => x.tag === tag)) {
          expect(gov.name[r.id], r.id).toBeTruthy();
          for (const f of r.feeds) expect(gov.feed[f.key], f.key).toBeTruthy();
          expect(
            json(`lang/${lang}.json`).gw.turn[`gov_held_${r.id}`],
          ).toBeTruthy();
        }
      }
      for (const r of GW_GOV.filter((x) => x.tag === tag)) {
        r.steps.forEach((_, i) =>
          expect(pack.reasons?.[`gov_${r.id}_${i + 1}`], r.id).toBeTruthy(),
        );
        expect(pack.reasons?.[`gov_${r.id}_calm`], r.id).toBeTruthy();
      }
    },
  );

  test("an election's swings and parties have their words", () => {
    for (const lang of ["en", "ko"]) {
      const gov = json(`lang/${lang}.json`).gw.gov;
      for (const e of GW_ELECTIONS) {
        for (const s of e.swings) expect(gov.swing[s.key], s.key).toBeTruthy();
        for (const f of e.friends) expect(gov.party[f.id], f.id).toBeTruthy();
      }
    }
  });
});

describe("a threat", () => {
  test("climbs while it is fed, calling each scene once", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    seat.scheduled = [];
    gw.nation("GBR")!.inst.cabinet = -2;
    const calls = () =>
      seat.scheduled.map((q) => q.scene).filter((x) => x.includes("_table_"));
    for (let i = 0; i < 2; i++) govStep(gw);
    expect(calls()).toEqual([]);
    govStep(gw);
    expect(calls()).toEqual(["gov_gbr_table_1"]);
    expect(seat.log.some((l) => l.key === "gov_gbr_table_1")).toBe(true);
    for (let i = 0; i < 8; i++) govStep(gw);
    expect(calls()).toEqual([
      "gov_gbr_table_1",
      "gov_gbr_table_2",
      "gov_gbr_table_3",
    ]);
  });

  test("cools when nothing feeds it, and says so", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    const n = gw.nation("GBR")!;
    n.inst.cabinet = -2;
    for (let i = 0; i < 3; i++) govStep(gw);
    n.inst.cabinet = 1;
    for (let i = 0; i < 3; i++) govStep(gw);
    const e = seat.gov.find((x) => x.id === "gbr_table")!;
    expect(e.heat).toBe(0);
    expect(e.step).toBe(0);
    expect(seat.log.some((l) => l.key === "gov_gbr_table_calm")).toBe(true);
  });

  test("the screen sees what feeds it, never a secret", async () => {
    const gw = await game("RUS");
    late(gw);
    const seat = gw.s.seats[0];
    gw.s.secrets = ["rus_palace_plot"];
    gw.nation("RUS")!.inst.duma = -3;
    govStep(gw);
    const court = govView(gw, seat).find((x) => x.id === "rus_court")!;
    expect(court.feeds).toContain("rus_duma");
    expect(court.feeds).not.toContain("rus_plot");
  });

  test("cooled below its last step, it can come to that scene again", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    const r = row("gbr_table");
    gw.nation("GBR")!.inst.cabinet = -2;
    for (let i = 0; i < 11; i++) govStep(gw);
    govHeatBy(gw, seat, "gbr_table", -5);
    seat.scheduled = [];
    const last = r.steps[r.steps.length - 1].scene;
    const called = () => seat.scheduled.map((q) => q.scene).includes(last);
    for (let i = 0; i < 3; i++) govStep(gw);
    expect(called()).toBe(false);
    for (let i = 0; i < 12; i++) {
      gw.s.chapter++;
      gw.s.day = gwChapters(gw.s.calendar)[gw.s.chapter].day;
      govStep(gw);
    }
    expect(called()).toBe(true);
  });

  test("a talk had isn't had again; a scene is never on the desk twice", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    seat.seen.gov_gbr_table_1 = 3;
    gw.nation("GBR")!.inst.cabinet = -2;
    for (let i = 0; i < 7; i++) govStep(gw);
    const calls = seat.scheduled.map((q) => q.scene);
    expect(calls).not.toContain("gov_gbr_table_1");
    expect(calls.filter((x) => x === "gov_gbr_table_2").length).toBe(1);
  });

  test("a deal brings its paper once, whatever the heat does", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    seat.scheduled = [];
    govSoon(gw, seat, "gbr_table");
    govSoon(gw, seat, "gbr_table");
    gw.nation("GBR")!.inst.cabinet = -2;
    for (let i = 0; i < 8; i++) govStep(gw);
    const calls = seat.scheduled.map((q) => q.scene);
    expect(calls.filter((x) => x === "gov_gbr_table_2").length).toBe(1);
    expect(calls).not.toContain("gov_gbr_table_1");
  });

  test("beaten, it rests, and the memoir has the turn", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    gw.nation("GBR")!.inst.cabinet = -2;
    for (let i = 0; i < 4; i++) govStep(gw);
    govBeaten(gw, seat, "gbr_table");
    for (let i = 0; i < 4; i++) govStep(gw);
    const e = seat.gov.find((x) => x.id === "gbr_table")!;
    expect(e.heat).toBe(0);
    expect(e.beaten).toBe(1);
    closeSeat(gw, seat, "gbr_end_turned_out");
    expect(seat.memoir!.ending).toBe("gbr_end_turned_out");
    expect(seat.memoir!.turns.map((t) => t.key)).toContain(
      "gov_held_gbr_table",
    );
  });

  test("once the chair has passed on, Britain's rows stop", async () => {
    const gw = await game("GBR");
    late(gw);
    const seat = gw.s.seats[0];
    seat.flags.push("f_pm_lg");
    gw.nation("GBR")!.inst.cabinet = -3;
    for (let i = 0; i < 5; i++) govStep(gw);
    expect(seat.gov.filter((x) => x.heat > 0)).toEqual([]);
  });
});

describe("the reckoning", () => {
  const cases: [GwTag, string, string, string, () => object][] = [
    [
      "GBR",
      "gov_gbr_table_3",
      "divide",
      "gbr_end_turned_out",
      () => ({ commons: -3 }),
    ],
    [
      "DEU",
      "gov_deu_parliament_3",
      "face_them",
      "deu_end_set_aside",
      () => ({ reichstag: -4 }),
    ],
    [
      "AUH",
      "gov_auh_court_3",
      "stand",
      "auh_e_regency",
      () => ({ council: -3, hungary: -3 }),
    ],
    [
      "RUS",
      "gov_rus_court_3",
      "go_on",
      "rus_palace_coup",
      () => ({ stavka: -1 }),
    ],
  ];

  test.each(cases)(
    "%s can be lost, with its memoir",
    async (tag, scene, opt, ending, low) => {
      const gw = await game(tag);
      Object.assign(gw.nation(tag)!.inst, low());
      take(gw, scene, opt);
      expect(gw.s.ended).toBe(ending);
      const pack = await loadGwPack(tag, async (p) => json(p));
      expect(pack.endings?.[ending]).toBeTruthy();
    },
  );

  test.each(cases)(
    "%s can be won, and the game goes on",
    async (tag, scene, opt, _e, low) => {
      const gw = await game(tag);
      const n = gw.nation(tag)!;
      for (const k of Object.keys(low()))
        (n.inst as Record<string, number>)[k] = 2;
      take(gw, scene, opt);
      expect(gw.s.ended).toBeNull();
      expect(gw.s.seats[0].memoir).toBeNull();
      expect(gw.s.seats[0].gov.some((x) => x.beaten === 1)).toBe(true);
    },
  );

  test("the proxy never ends a game with a way out open", async () => {
    for (const r of GW_GOV.filter((x) => x.fatal && x.id !== "gbr_election")) {
      const last = sceneOf(r.steps[r.steps.length - 1].scene)!;
      const safe = last.options!.find((o) => o.id === last.fallback)!;
      expect(JSON.stringify(safe.effects)).not.toContain('"end"');
    }
  });

  test.each(["DEU", "GBR", "AUH", "RUS"] as GwTag[])(
    "every scene of %s can be cast on the first day",
    async (tag) => {
      const gw = await game(tag);
      const seat = gw.s.seats[0];
      for (const r of GW_GOV.filter((x) => x.tag === tag)) {
        for (const s of r.steps) {
          expect(castOf(gw, seat, sceneOf(s.scene)!), s.scene).not.toBeNull();
        }
      }
    },
  );

  test("a threat's state survives the save", async () => {
    const runner = await runnerOf("GBR");
    const gw = runner.game.greatWar()!;
    late(gw);
    gw.nation("GBR")!.inst.cabinet = -2;
    for (let i = 0; i < 4; i++) govStep(gw);
    const seat = gw.s.seats[0];
    expect(seat.gov.length).toBeGreaterThan(0);
    const hash = gw.hash();
    const copy = GreatWarSnapshot.schema.parse(
      JSON.parse(JSON.stringify(gw.snapshot())),
    );
    gw.restoreState(copy);
    expect(gw.hash()).toBe(hash);
    govStep(gw);
    advanceChapter(gw, 0, false);
    expect(gw.s.seats[0].gov.find((x) => x.id === "gbr_table")!.step).toBe(1);
  });
});

describe("the election", () => {
  test("the whips count from the state, friends and all", async () => {
    const gw = await game("GBR");
    const seat = gw.s.seats[0];
    const ctx = { gw, seat, cast: {} };
    const n = gw.nation("GBR")!;
    n.inst.irish = 1;
    seat.flags.push("f_gov_lib_lab");
    const first = pollOf(ctx, "gbr_election")!;
    expect(first.margin).toBe(first.own + 84 + 42);
    n.inst.irish = -1;
    const lost = pollOf(ctx, "gbr_election")!;
    expect(lost.margin).toBe(first.margin - 84);
    expect(lost.lines.every((l) => l.seats !== 0)).toBe(true);
  });

  test("a lost poll ends the game; a won one stops the clock on the term", async () => {
    const gw = await game("GBR");
    const seat = gw.s.seats[0];
    const n = gw.nation("GBR")!;
    n.inst.irish = 1;
    seat.flags.push("f_gov_lib_lab");
    take(gw, "gov_gbr_poll", "count");
    expect(gw.s.ended).toBeNull();
    expect(seat.flags).toContain("f_gov_new_parliament");
    n.inst.irish = -1;
    seat.flags = seat.flags.filter((f) => f !== "f_gov_lib_lab");
    n.gauges.order = 0;
    take(gw, "gov_gbr_poll", "count");
    expect(gw.s.ended).toBe("gbr_end_polls");
  });
});

describe("whole games", () => {
  test.each(["DEU", "GBR", "AUH", "RUS"] as GwTag[])(
    "%s plays out with its threats on the desk",
    async (tag) => {
      const scenes = new Set<string>();
      for (let i = 0; i < 6 && scenes.size === 0; i++) {
        const rec = await playRun(
          map,
          `gov-${tag}-${i}`,
          "full",
          [],
          GW_SIM_PROFILES[i % 3],
          tag,
        );
        expect(rec.ending).not.toBe("");
        for (const id of Object.keys(rec.dealt)) {
          if (id.startsWith("gov_")) scenes.add(id);
        }
      }
      expect(scenes.size).toBeGreaterThan(0);
    },
    240000,
  );
});
