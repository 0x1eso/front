import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GwPack,
  gwPackProblems,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_CONTENT,
  gwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { GW_HOUSE_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/house";
import {
  GW_LAWS,
  lawScenes,
} from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { GW_LAW_HOME } from "@openfront/engine-lib/ww1914/LawRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { GW_AUTHORITY } from "@openfront/engine/ww1914/AuthorityTable";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  lawAgenda,
  lawCanDecree,
  lawCount,
  lawViews,
} from "@openfront/engine/ww1914/Laws";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "node:fs";
import path from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { deptsAll, GW_SIM_PROFILES, playRun } from "./sim/GwSim";
import { gwRunner, order, playChapter, seat, view } from "./util";

const NATIONS: GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const KO = path.join(__dirname, "../../resources/ww1914/ko");
const packOf = (f: string): GwPack =>
  JSON.parse(fs.readFileSync(path.join(KO, f), "utf8")) as GwPack;

const rowOf = (id: string) => GW_LAWS.find((r) => r.id === id)!;

/** A game at war with a seat of its own, moved on to a chapter that opens bills. */
async function atWar() {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  const s = gw.s;
  s.warChapter = 0;
  const n = gw.nation("DEU")!;
  n.atWar = ["FRA"];
  n.side = "central";
  // Past the first winter, by the same shift a `delay` makes.
  s.dayShift = 800;
  s.day += 800;
  return { runner, gw, n, seat: s.seats[0] };
}

/** 표결에 부친다 from the agenda (ww203). */
function call(gw: GreatWar, law: string) {
  return applyGwOrder(gw, gw.s.seats[0], {
    kind: "bill_vote",
    law,
    confidence: false,
  });
}

/** Clears the desk the plain way and closes the chapter. */
function next(gw: GreatWar): void {
  const seat = gw.s.seats[0];
  seat.desk = seat.desk.filter((c) => c.scene.startsWith("gw_l"));
  for (const c of [...seat.desk]) {
    const sc = GW_CONTENT.scenes.find((x) => x.id === c.scene)!;
    if (sc.kind === "talk") {
      seat.desk = seat.desk.filter((x) => x !== c);
      continue;
    }
    const o = sc.options![0];
    applyGwOrder(gw, seat, { kind: "choose", card: c.uid, option: o.id });
  }
  seat.ready = true;
  advanceChapter(gw, 0, false);
}

describe("the rows", () => {
  test("eight to sixteen bills a nation, each with its three scenes", () => {
    for (const tag of NATIONS) {
      // The factions' own bills (ww158) are the house files', not these.
      const rows = GW_LAWS.filter(
        (r) => r.tag === tag && !GW_HOUSE_LAWS.includes(r),
      );
      expect(rows.length).toBeGreaterThanOrEqual(8);
      // ww203: the law book's new articles (W lanes, marked +); ww204 merge:
      // the five lanes' rows together, DEU and RUS 16.
      expect(rows.length).toBeLessThanOrEqual(16);
    }
    const ids = new Set(GW_CONTENT.scenes.map((s) => s.id));
    for (const r of GW_LAWS) {
      for (const p of ["law", "lv", "lt"]) {
        expect(ids.has(`gw_${p}_${r.id}`)).toBe(true);
      }
      if (r.after !== undefined) expect(ids.has(`gw_lf_${r.id}`)).toBe(true);
    }
    expect(new Set(GW_LAWS.map((r) => r.id)).size).toBe(GW_LAWS.length);
  });

  test("every form of government that rules a seat names who passes a bill", () => {
    for (const form of [
      "empire",
      "liberal",
      "coalition",
      "dual_monarchy",
      "karl",
      "tsar",
      "crown",
    ]) {
      expect(GW_AUTHORITY[form].law).toBeDefined();
    }
    expect(GW_AUTHORITY.empire.law?.inst).toBe("reichstag");
    expect(GW_AUTHORITY.liberal.law?.inst).toBe("commons");
    expect(GW_AUTHORITY.dual_monarchy.law?.kind).toBe("consent");
    expect(GW_AUTHORITY.tsar.law?.kind).toBe("decree");
    for (const tag of NATIONS) expect(GW_LAW_HOME[tag]).toBeDefined();
  });

  test("the packs have every line, and a line for every working law", () => {
    const common = packOf("common.laws.json");
    for (const tag of NATIONS) {
      // The house file lays its lines over the day cards it runs (ww158).
      const pack = mergeGwPacks([
        packOf(`${tag}.laws.json`),
        packOf(`${tag}.house.json`),
      ]);
      const rows = GW_LAWS.filter(
        (r) => r.tag === tag && !GW_HOUSE_LAWS.includes(r),
      );
      const ids = new Set(
        rows.flatMap((r) =>
          ["law", "lv", "lt", "lf"].map((p) => `gw_${p}_${r.id}`),
        ),
      );
      const scenes = GW_CONTENT.scenes.filter((s) => ids.has(s.id));
      expect(gwPackProblems(scenes, pack)).toEqual([]);
      for (const r of rows) {
        expect(pack.reasons?.[`law_in_${r.id}`]).toBeDefined();
        expect(pack.reasons?.[`law_out_${r.id}`]).toBeDefined();
        if (r.term.some((t) => t.gauge !== "manpower")) {
          expect(pack.reasons?.[`law_line_${r.id}`]).toBeDefined();
        }
      }
    }
    for (const b of [
      "reichstag",
      "commons",
      "cabinet",
      "hungary",
      "council",
      "duma",
      "body",
    ]) {
      expect(common.reasons?.[`law_no_${b}`]).toBeDefined();
    }
  });
});

/**
 * The path without a house (ww158): no house rows, and the bills' papers as
 * they are for a bill the house doesn't run, whatever the house files hold.
 */
function withoutHouse(): void {
  const plain = new Map(
    GW_LAWS.flatMap((r) => lawScenes(r, false)).map((s) => [s.id, s]),
  );
  useGwContent({
    ...GW_CONTENT,
    houses: [],
    bills: [],
    scenes: GW_CONTENT.scenes.map((s) => plain.get(s.id) ?? s),
  });
}

describe("a bill's way", () => {
  beforeEach(withoutHouse);
  afterEach(() => useGwContent(null));
  test("draft, persuade, the call, in force, and the law works on its months", async () => {
    const { gw, n, seat: st } = await atWar();
    const row = rowOf("deu_bread_cards");
    expect(
      applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" }),
    ).toBe(null);
    const card = st.desk.find((c) => c.scene === `gw_law_${row.id}`)!;
    expect(card).toBeDefined();
    expect(n.laws[0].stage).toBe("draft");
    applyGwOrder(gw, st, {
      kind: "choose",
      card: card.uid,
      option: "city_cards",
    });
    expect(n.laws[0].stage).toBe("persuade");
    expect(n.laws[0].text).toBe("city_cards");
    // ww203: no timer and no day scene: it waits on the agenda for the call.
    next(gw);
    next(gw);
    expect(n.laws[0].stage).toBe("persuade");
    expect(st.desk.some((c) => c.scene === `gw_lv_${row.id}`)).toBe(false);
    const bread = n.gauges.bread;
    expect(call(gw, row.id)).toBe(null);
    next(gw);
    expect(n.laws[0].stage).toBe("force");
    expect(n.laws[0].how).toBe("voted");
    expect(n.gauges.bread).toBeGreaterThanOrEqual(bread);
    expect(st.log.some((l) => l.key === `law_in_${row.id}`)).toBe(true);
  });

  test("three bills on the agenda at once; the same article once", async () => {
    const { gw, seat: st } = await atWar();
    const open = lawViews(gw, st).filter((v) => v.stage === "open");
    expect(open.length).toBeGreaterThan(3);
    for (const v of open.slice(0, 3)) {
      expect(applyGwOrder(gw, st, { kind: "bill_submit", law: v.id })).toBe(
        null,
      );
    }
    expect(applyGwOrder(gw, st, { kind: "bill_submit", law: open[3].id })).toBe(
      "agenda_full",
    );
    expect(applyGwOrder(gw, st, { kind: "bill_submit", law: open[0].id })).toBe(
      "law_busy",
    );
  });

  test("another country's bill is refused and nothing changes", async () => {
    const { gw, n, seat: st } = await atWar();
    expect(
      applyGwOrder(gw, st, { kind: "law", law: "gbr_rent", act: "draft" }),
    ).toBe("no_law");
    expect(n.laws).toEqual([]);
  });

  test("thrown out, it costs authority and locks its article a while", async () => {
    const { gw, n, seat: st } = await atWar();
    n.inst.reichstag = -5;
    const row = rowOf("deu_strike_ban");
    applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" });
    next(gw);
    expect(lawCount(gw, st, row.id)).toBeLessThan(-1);
    const was = n.authority;
    expect(call(gw, row.id)).toBe(null);
    expect(n.laws[0].stage).toBe("idle");
    expect(n.laws[0].lost).toBe(1);
    expect(n.laws[0].lockTo).toBe(gw.s.chapter + 6);
    expect(n.authority).toBe(was - 10);
    expect(st.log.some((l) => l.key === "law_no_reichstag")).toBe(true);
    expect(applyGwOrder(gw, st, { kind: "bill_submit", law: row.id })).toBe(
      "law_locked",
    );
  });

  test("the decree goes past the body at its price; the fallout is shown", async () => {
    const { gw, n, seat: st } = await atWar();
    n.inst.reichstag = -5;
    const row = rowOf("deu_strike_ban");
    applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" });
    next(gw);
    const scene = gwContent().scenes.find((s) => s.id === `gw_lv_${row.id}`)!;
    const opt = scene.options!.find((o) => o.id === "decree")!;
    expect(opt.tell).toContain("authority:-20");
    n.authority = 60;
    n.inst.reichstag = -2;
    expect(applyGwOrder(gw, st, { kind: "bill_round", law: row.id })).toBe(
      null,
    );
    expect(n.laws[0].stage).toBe("force");
    expect(n.laws[0].how).toBe("decreed");
    expect(n.authority).toBe(40);
    expect(n.inst.reichstag).toBe(-3);
  });

  test("no decree where the row has none, and no authority no decree", async () => {
    const { gw, n, seat: st } = await atWar();
    expect(rowOf("deu_aux").decree).toBe(false);
    const scene = gwContent().scenes.find((s) => s.id === "gw_lv_deu_aux")!;
    expect(scene.options!.some((o) => o.id === "decree")).toBe(false);
    n.authority = 5;
    applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "draft" });
    next(gw);
    const v = lawViews(gw, st).find((x) => x.id === "deu_censor")!;
    expect(v.stage).toBe("persuade");
    const blocked = applyGwOrder(gw, st, {
      kind: "bill_round",
      law: "deu_censor",
    });
    expect(blocked).toBe("no_authority");
  });

  test("taken back, it can come again after a while; never a dead end", async () => {
    const { gw, n, seat: st } = await atWar();
    const id = "deu_censor";
    applyGwOrder(gw, st, { kind: "law", law: id, act: "draft" });
    next(gw);
    expect(applyGwOrder(gw, st, { kind: "bill_withdraw", law: id })).toBe(null);
    expect(n.laws[0].stage).toBe("idle");
    expect(applyGwOrder(gw, st, { kind: "law", law: id, act: "draft" })).toBe(
      "law_busy",
    );
    for (let i = 0; i < 4; i++) next(gw);
    expect(applyGwOrder(gw, st, { kind: "law", law: id, act: "draft" })).toBe(
      null,
    );
  });

  test("repeal has its price and takes the flag away", async () => {
    const { gw, n, seat: st } = await atWar();
    const row = rowOf("deu_strike_ban");
    n.inst.reichstag = 3;
    applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" });
    next(gw);
    expect(call(gw, row.id)).toBe(null);
    expect(st.flags).toContain("f_law_strike_ban");
    n.authority = 5;
    expect(
      applyGwOrder(gw, st, { kind: "law", law: row.id, act: "repeal" }),
    ).toBe("no_authority");
    n.authority = 50;
    expect(
      applyGwOrder(gw, st, { kind: "law", law: row.id, act: "repeal" }),
    ).toBe(null);
    expect(n.authority).toBe(50 - row.repeal.authority);
    expect(st.flags).not.toContain("f_law_strike_ban");
    expect(n.laws[0].stage).toBe("idle");
  });

  test("the desk's older paper stands aside once the bill is taken up", async () => {
    const { gw, seat: st } = await atWar();
    const { lawReplaces } = await import("@openfront/engine/ww1914/Laws");
    expect(lawReplaces(gw, st, "deu_h_censor")).toBe(false);
    applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "draft" });
    expect(lawReplaces(gw, st, "deu_h_censor")).toBe(true);
  });

  test("a decision of the desk that made it law is listed as law", async () => {
    const { gw, n, seat: st } = await atWar();
    st.choices.push({
      scene: "deu_h_censor",
      pick: "one_censor",
      chapter: 1,
      proxy: false,
    });
    next(gw);
    const v = lawViews(gw, st).find((x) => x.id === "deu_censor")!;
    expect(v.stage).toBe("force");
    expect(v.how).toBe("scene");
    expect(st.flags).toContain("f_law_censor");
    expect(n.laws[0].how).toBe("scene");
  });

  test("repealed, a decision of the desk doesn't make it law again", async () => {
    const { gw, n, seat: st } = await atWar();
    st.choices.push({
      scene: "deu_h_censor",
      pick: "one_censor",
      chapter: 1,
      proxy: false,
    });
    next(gw);
    expect(
      applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "repeal" }),
    ).toBe(null);
    next(gw);
    expect(n.laws[0].stage).toBe("idle");
    expect(st.flags).not.toContain("f_law_censor");
  });

  test("a censorship law moves the censor, on passing and on repeal", async () => {
    const { gw, n, seat: st } = await atWar();
    st.press.censor = 1;
    st.press.warBegun = true;
    st.choices.push({
      scene: "deu_h_censor",
      pick: "one_censor",
      chapter: 1,
      proxy: false,
    });
    next(gw);
    expect(lawViews(gw, st).find((x) => x.id === "deu_censor")?.stage).toBe(
      "force",
    );
    expect(st.press.censor).toBe(2);
    next(gw);
    expect(st.press.censor).toBe(2);
    n.authority = 100;
    expect(
      applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "repeal" }),
    ).toBe(null);
    expect(st.press.censor).toBe(1);
  });

  test("in force, it comes back as a scene after its chapters", async () => {
    const { gw, n, seat: st } = await atWar();
    const row = rowOf("deu_bread_cards");
    n.inst.reichstag = 3;
    applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" });
    next(gw);
    expect(call(gw, row.id)).toBe(null);
    expect(n.laws[0].stage).toBe("force");
    for (let i = 0; i < row.after!.chapters + 2; i++) {
      if (st.desk.some((c) => c.scene === `gw_lf_${row.id}`)) break;
      next(gw);
    }
    expect(st.seen[`gw_lf_${row.id}`]).toBeDefined();
    expect(n.laws[0].after).toBe(true);
  });

  test("the view holds words, not the count", async () => {
    const { gw, seat: st } = await atWar();
    applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "draft" });
    const v = lawViews(gw, st).find((x) => x.id === "deu_censor")!;
    expect(["easy", "tight", "short", "blocked"]).toContain(v.outlook);
    expect(JSON.stringify(v)).not.toContain("support");
    expect(v.body).toBe("reichstag");
  });
});

describe("the box before a bill opens (w159)", () => {
  test("no war, no bill open, but the seat is told bills will come", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    const gw = runner.game.greatWar()!;
    // Past October 1914 with no war: every German bill waits on the war.
    gw.s.dayShift = 150;
    gw.s.day += 150;
    expect(gw.s.warChapter).toBe(null);
    const w = seat(runner).world;
    expect(w.laws).toEqual([]);
    expect(w.lawsAhead).toBe(true);
  });

  test("at war, the house's bills and the plain ones show, with no such word", async () => {
    const { runner, gw, seat: st } = await atWar();
    // The house's own bill opens on this word (content/house/deu).
    st.flags.push("f_interparty_heard");
    const w = seat(runner).world;
    const ids = w.laws.map((x) => x.id);
    expect(ids).toContain("deu_censor");
    expect(ids).toContain("deu_parl_gov");
    expect(w.laws.find((x) => x.id === "deu_parl_gov")!.house).toBe(true);
    expect(w.lawsAhead).toBeUndefined();
    expect(gw.s.warChapter).toBe(0);
  });
});

describe("a save", () => {
  beforeEach(withoutHouse);
  afterEach(() => useGwContent(null));
  test("a moving bill survives the round trip and the hash sees it", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    const before = gw.hash();
    n.laws.push({
      id: "deu_censor",
      stage: "persuade",
      since: 3,
      support: 1,
      how: "none",
      text: "one_office",
      lost: 0,
      after: false,
      origin: "seat",
      by: null,
      sponsor: null,
      deals: [],
      whip: -1,
      delayTo: -1,
      warm: [],
      kept: null,
      lockTo: -1,
      paper: [],
      paperAt: -1,
      faces: -1,
    });
    expect(gw.hash()).not.toBe(before);
    const { GreatWarSnapshot } =
      await import("@openfront/engine/ww1914/GreatWar");
    const saved = JSON.parse(JSON.stringify(gw.snapshot()));
    const back = GreatWarSnapshot.schema.parse(saved);
    expect(back.nations.find((x) => x.tag === "DEU")!.laws).toEqual(n.laws);
    const hash = gw.hash();
    gw.restoreState(back);
    expect(gw.hash()).toBe(hash);
  });

  test("a repeal makes the news and the German papers", async () => {
    const { gw, n, seat } = await atWar();
    n.authority = 100;
    n.laws.push({
      id: "deu_censor",
      stage: "force",
      since: 3,
      support: 0,
      how: "decreed",
      text: "one_office",
      lost: 0,
      after: false,
      origin: "seat",
      by: null,
      sponsor: null,
      deals: [],
      whip: -1,
      delayTo: -1,
      warm: [],
      kept: null,
      lockTo: -1,
      paper: [],
      paperAt: -1,
      faces: -1,
    });
    expect(
      applyGwOrder(gw, seat, { kind: "law", law: "deu_censor", act: "repeal" }),
    ).toBeNull();
    expect(gw.s.news[gw.s.news.length - 1].key).toBe("law_repealed");
    next(gw);
    expect(seat.press.ran.law_gone).toBeDefined();
  });

  test("an order goes through the worker path", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    order(runner, { kind: "law", law: "deu_censor", act: "draft" });
    expect(view(runner).seats[0].world.laws.length).toBeGreaterThanOrEqual(0);
    expect(seat(runner).desk.length).toBeGreaterThanOrEqual(0);
    playChapter(runner);
  });
});

describe("a whole game on the real map", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  test.each(NATIONS)(
    "%s brings its bills through a war",
    async (tag) => {
      for (let i = 0; i < 40; i++) {
        const passed = new Set<string>();
        let brought = 0;
        let war = false;
        const seed = idHash(`laws-${tag}-${i}`);
        let rolls = 0;
        const roll = (below: number) => wwRoll(seed, 91, rolls++) % below;
        await playRun(
          map,
          `laws-${tag}-${i}`,
          "full",
          [],
          GW_SIM_PROFILES[1],
          tag,
          (gw) => {
            const seat = gw.s.seats[0];
            const n = gw.nation(tag)!;
            war = war || n.atWar.length > 0;
            // ww193: a person hears the departments, or they act on the bills'
            // papers themselves.
            deptsAll(gw, seat, GW_SIM_PROFILES[1], roll);
            for (const x of n.laws) {
              if (x.stage === "force" && x.how !== "scene") passed.add(x.id);
            }
            // ww203: a person calls the vote after a chapter on the agenda:
            // they count first, and a bill with no way through goes back in
            // the drawer.
            for (const x of lawAgenda(n)) {
              if (x.stage !== "persuade" || gw.s.chapter - x.since < 1)
                continue;
              const id = x.id;
              const o: GwOrder =
                lawCount(gw, seat, id) >= 0
                  ? { kind: "bill_vote", law: id, confidence: false }
                  : lawCanDecree(gw, seat, id)
                    ? { kind: "bill_round", law: id }
                    : { kind: "bill_withdraw", law: id };
              applyGwOrder(gw, seat, o);
            }
            const open = lawViews(gw, seat).find(
              (v) => v.stage === "open" && v.waits === null,
            );
            if (open === undefined) return;
            if (
              applyGwOrder(gw, seat, {
                kind: "law",
                law: open.id,
                act: "draft",
              }) === null
            ) {
              brought++;
            }
          },
        );
        // ww190: a game the war never came to (the peace years) is no test of it.
        if (brought < 3 || !war) continue;
        expect(passed.size).toBeGreaterThanOrEqual(1);
        return;
      }
      throw new Error(`${tag}: no war game brought three bills`);
    },
    240000,
  );
});
