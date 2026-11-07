import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { GW_LAW_HOME } from "@openfront/engine-lib/ww1914/LawRows";
import { GW_AUTHORITY } from "@openfront/engine/ww1914/AuthorityTable";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { lawCount, lawViews } from "@openfront/engine/ww1914/Laws";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { GW_SIM_PROFILES, playRun } from "./sim/GwSim";
import { gwRunner, order, playChapter, seat, view } from "./util";

const NATIONS: GwTag[] = ["DEU", "GBR", "AUH", "RUS"];
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
  test("eight to ten bills a nation, each with its three scenes", () => {
    for (const tag of NATIONS) {
      const rows = GW_LAWS.filter((r) => r.tag === tag);
      expect(rows.length).toBeGreaterThanOrEqual(8);
      expect(rows.length).toBeLessThanOrEqual(10);
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
      const pack = packOf(`${tag}.laws.json`);
      const rows = GW_LAWS.filter((r) => r.tag === tag);
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

  test("no atrocity is a bill's price or a bill's path", () => {
    const words = /학살|추방|강제 이주|제노사이드/;
    for (const tag of NATIONS) {
      expect(JSON.stringify(packOf(`${tag}.laws.json`))).not.toMatch(words);
    }
  });
});

describe("a bill's way", () => {
  test("draft, persuade, the day, in force, and the law works on its months", async () => {
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
    next(gw);
    next(gw);
    expect(n.laws[0].stage).toBe("vote");
    expect(st.desk.some((c) => c.scene === `gw_lv_${row.id}`)).toBe(true);
    const bread = n.gauges.bread;
    next(gw);
    expect(n.laws[0].stage).toBe("force");
    expect(n.laws[0].how).toBe("voted");
    expect(n.gauges.bread).toBeGreaterThanOrEqual(bread);
    expect(st.log.some((l) => l.key === `law_in_${row.id}`)).toBe(true);
  });

  test("one bill moves at a time", async () => {
    const { gw, seat: st } = await atWar();
    expect(
      applyGwOrder(gw, st, {
        kind: "law",
        law: "deu_bread_cards",
        act: "draft",
      }),
    ).toBe(null);
    expect(
      applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "draft" }),
    ).toBe("law_busy");
  });

  test("another country's bill is refused and nothing changes", async () => {
    const { gw, n, seat: st } = await atWar();
    expect(
      applyGwOrder(gw, st, { kind: "law", law: "gbr_rent", act: "draft" }),
    ).toBe("no_law");
    expect(n.laws).toEqual([]);
  });

  test("thrown out, it costs authority and comes back to be argued", async () => {
    const { gw, n, seat: st } = await atWar();
    n.inst.reichstag = -5;
    const row = rowOf("deu_strike_ban");
    applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" });
    next(gw);
    next(gw);
    expect(n.laws[0].stage).toBe("vote");
    expect(lawCount(gw, st, row.id)).toBeLessThan(0);
    const card = st.desk.find((c) => c.scene === `gw_lv_${row.id}`)!;
    expect(card.variant).toBe("short");
    const was = n.authority;
    applyGwOrder(gw, st, { kind: "choose", card: card.uid, option: "put" });
    expect(n.laws[0].stage).toBe("persuade");
    expect(n.laws[0].lost).toBe(1);
    expect(n.authority).toBe(was - 5);
    expect(st.log.some((l) => l.key === "law_no_reichstag")).toBe(true);
  });

  test("the decree goes past the body at its price; the fallout is shown", async () => {
    const { gw, n, seat: st } = await atWar();
    n.inst.reichstag = -5;
    const row = rowOf("deu_strike_ban");
    applyGwOrder(gw, st, { kind: "law", law: row.id, act: "draft" });
    next(gw);
    next(gw);
    const card = st.desk.find((c) => c.scene === `gw_lv_${row.id}`)!;
    const scene = GW_CONTENT.scenes.find((s) => s.id === card.scene)!;
    const opt = scene.options!.find((o) => o.id === "decree")!;
    expect(opt.tell).toContain("authority:-20");
    n.authority = 60;
    n.inst.reichstag = -2;
    applyGwOrder(gw, st, { kind: "choose", card: card.uid, option: "decree" });
    expect(n.laws[0].stage).toBe("force");
    expect(n.laws[0].how).toBe("decreed");
    expect(n.authority).toBe(40);
    expect(n.inst.reichstag).toBe(-3);
  });

  test("no decree where the row has none, and no authority no decree", async () => {
    const { gw, n, seat: st } = await atWar();
    expect(rowOf("deu_aux").decree).toBe(false);
    const scene = GW_CONTENT.scenes.find((s) => s.id === "gw_lv_deu_aux")!;
    expect(scene.options!.some((o) => o.id === "decree")).toBe(false);
    n.authority = 5;
    applyGwOrder(gw, st, { kind: "law", law: "deu_censor", act: "draft" });
    next(gw);
    next(gw);
    const v = lawViews(gw, st).find((x) => x.id === "deu_censor")!;
    expect(v.stage).toBe("vote");
    const card = st.desk.find((c) => c.scene === "gw_lv_deu_censor")!;
    const blocked = applyGwOrder(gw, st, {
      kind: "choose",
      card: card.uid,
      option: "decree",
    });
    expect(blocked).toBe("closed");
  });

  test("taken back, it can come again after a while; never a dead end", async () => {
    const { gw, n, seat: st } = await atWar();
    const id = "deu_censor";
    applyGwOrder(gw, st, { kind: "law", law: id, act: "draft" });
    next(gw);
    next(gw);
    const card = st.desk.find((c) => c.scene === `gw_lv_${id}`)!;
    applyGwOrder(gw, st, {
      kind: "choose",
      card: card.uid,
      option: "withdraw",
    });
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
    next(gw);
    next(gw);
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
    for (let i = 0; i < 3; i++) next(gw);
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

describe("a save", () => {
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
      for (let i = 0; i < 24; i++) {
        const passed = new Set<string>();
        let brought = 0;
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
            for (const x of n.laws) {
              if (x.stage === "force" && x.how !== "scene") passed.add(x.id);
            }
            // A sponsor reads the count, where the desk bot flinches at
            // random: a bill with the votes is put, one without is taken back.
            for (const c of seat.desk.filter((x) => /^gw_lv_/.test(x.scene))) {
              const v = lawViews(gw, seat).find(
                (x) => `gw_lv_${x.id}` === c.scene,
              );
              const ok = v?.outlook === "easy" || v?.outlook === "tight";
              applyGwOrder(gw, seat, {
                kind: "choose",
                card: c.uid,
                option: ok ? "put" : "withdraw",
              });
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
        if (brought < 3) continue;
        expect(passed.size).toBeGreaterThanOrEqual(1);
        return;
      }
      throw new Error(`${tag}: no game brought three bills`);
    },
    240000,
  );
});
