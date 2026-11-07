import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GwPack, GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import { GW_BLOCS, GwPressView } from "@openfront/engine-api/ww1914/GwPress";
import { GW_BLOC_ROWS } from "@openfront/engine/ww1914/BlocTable";
import { turningOf } from "@openfront/engine/ww1914/Blocs";
import { GreatWarSnapshot } from "@openfront/engine/ww1914/GreatWar";
import { GW_PRESS_ROWS } from "@openfront/engine/ww1914/PressTable";
import { sceneOf } from "@openfront/engine/ww1914/SceneRun";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { step } from "../ww1936/util";
import { gwRunner, order, playChapter, seat, view } from "./util";

const TAGS: GwTag[] = ["DEU", "GBR", "AUH", "RUS"];

function packOf(tag: GwTag): GwPack {
  const file = path.join(
    __dirname,
    `../../resources/ww1914/ko/${tag}.press.json`,
  );
  return GwPackSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

const pressOf = (r: Parameters<typeof seat>[0]): GwPressView =>
  seat(r).world.press!;
const gw = (r: Parameters<typeof seat>[0]) => r.game.greatWar()!;

describe("the tables and their text", () => {
  test.each(TAGS)("%s: every line the tables can call has text", (tag) => {
    const press = packOf(tag).press!;
    const row = GW_PRESS_ROWS[tag]!;
    const blocs = GW_BLOC_ROWS[tag]!;
    const out: string[] = [];
    for (const p of row.papers) {
      if (press.papers[p.id] === undefined) out.push(`paper ${p.id}`);
      if (press.gaps[p.id] === undefined) out.push(`gap ${p.id}`);
    }
    for (const st of row.stories) {
      const papers = Object.keys(st.tones);
      if (papers.length < 2) out.push(`${st.id}: one paper`);
      for (const p of papers) {
        if (!row.papers.some((x) => x.id === p)) out.push(`${st.id}: ${p}?`);
        if (press.heads[st.id]?.[p] === undefined) {
          out.push(`head ${st.id}.${p}`);
        }
      }
    }
    for (const id of Object.keys(press.heads)) {
      if (!row.stories.some((x) => x.id === id)) out.push(`unused head ${id}`);
    }
    for (const r of row.rumours) {
      if (press.rumours[r.id] === undefined) out.push(`rumour ${r.id}`);
    }
    for (const b of GW_BLOCS) {
      if (press.blocs[b] === undefined) out.push(`bloc ${b}`);
      for (const t of blocs.blocs[b].terms) {
        if (press.why[t.key] === undefined) out.push(`why ${t.key}`);
      }
    }
    for (const key of ["papers_kind", "papers_hard", "censor_cuts"]) {
      if (press.why[key] === undefined) out.push(`why ${key}`);
    }
    for (const t of blocs.ties) {
      if (press.ties[t.key] === undefined) out.push(`tie ${t.key}`);
      if (t.when !== undefined && press.ties[`${t.key}_off`] === undefined) {
        out.push(`tie ${t.key}_off`);
      }
    }
    expect(out).toEqual([]);
  });

  test.each(TAGS)(
    "%s: a story's decisions are real scenes and picks",
    (tag) => {
      const out: string[] = [];
      for (const st of GW_PRESS_ROWS[tag]!.stories) {
        if (!("chose" in st.on) || st.on.prefix === true) continue;
        const scenes = st.on.chose.map(sceneOf);
        if (scenes.some((s) => s === null)) out.push(`${st.id}: no scene`);
        const picks = scenes.flatMap((s) => s?.options?.map((o) => o.id) ?? []);
        for (const p of st.on.picks ?? []) {
          if (!picks.includes(p)) out.push(`${st.id}: no pick ${p}`);
        }
      }
      expect(out).toEqual([]);
    },
  );

  test.each(TAGS)("%s: a story's papers do not all agree", (tag) => {
    const same = GW_PRESS_ROWS[tag]!.stories.filter((s) => {
      const tones = new Set(Object.values(s.tones));
      return tones.size === 1 && !tones.has(0);
    }).map((s) => s.id);
    // The few days a whole country reads the same, or fears the same.
    expect(same.filter((x) => !ONE_VOICE.includes(x))).toEqual([]);
  });
});

const ONE_VOICE = [
  "war_speech",
  "balcony",
  "war_in",
  "unrest_big",
  "strikes",
  "america",
  "word_of_honour",
];

describe("turning", () => {
  test("a step from turned, or falling that fast, is leaving", () => {
    expect(turningOf(-2, 0)).toBe("leaving");
    expect(turningOf(-1, -2)).toBe("leaving");
    expect(turningOf(0, -1)).toBe(null);
    expect(turningOf(2, 1)).toBe(null);
  });
  test("turned and rising fast enough is coming back", () => {
    expect(turningOf(-3, 1)).toBe("back");
    expect(turningOf(-5, 1)).toBe(null);
    expect(turningOf(-4, 0)).toBe(null);
  });
});

describe("the papers in a game", () => {
  test("a first edition is there before the first decision", async () => {
    const { runner } = await gwRunner();
    const e = pressOf(runner).edition!;
    expect(e.chapter).toBe(0);
    expect(e.heads.length).toBeGreaterThanOrEqual(2);
  });

  test("every chapter has papers of different names on the story", async () => {
    const { runner } = await gwRunner();
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      playChapter(runner);
      const e = pressOf(runner).edition!;
      expect(e.chapter).toBe(view(runner).chapter - 1);
      expect(new Set(e.heads.map((h) => h.paper)).size).toBe(e.heads.length);
      seen.push(e.story);
    }
    expect(new Set(seen).size).toBeGreaterThan(3);
  });

  test("a decision is what the page is about", async () => {
    const { runner } = await gwRunner();
    const g = gw(runner);
    const s = g.s.seats[0];
    s.choices.push({
      scene: "deu_k_peace_resolution",
      pick: "accept_text",
      chapter: g.s.chapter,
      proxy: false,
    });
    order(runner, { kind: "ready", chapter: g.s.chapter, on: false });
    playChapter(runner);
    const e = pressOf(runner).edition!;
    expect(e.story).toBe("peace_text");
    expect(e.scene).toBe("deu_k_peace_resolution");
    expect(e.heads.map((h) => h.paper).sort()).toEqual(["dtz", "tag", "vor"]);
  });

  test("the same decision moves the blocs its papers speak to", async () => {
    const { runner } = await gwRunner();
    const g = gw(runner);
    const s = g.s.seats[0];
    s.choices.push({
      scene: "deu_k_peace_resolution",
      pick: "accept_text",
      chapter: g.s.chapter,
      proxy: false,
    });
    playChapter(runner);
    expect(s.press.opinion.parliament).toBeGreaterThan(0);
    expect(s.press.opinion.army).toBeLessThan(0);
  });
});

describe("press policy", () => {
  async function atWar() {
    const { runner } = await gwRunner();
    const g = gw(runner);
    const s = g.s.seats[0];
    const n = g.nation("DEU")!;
    n.atWar = ["FRA"];
    n.side = "central";
    return { runner, g, s, n };
  }

  test("no censor is possible in a German peace", async () => {
    const { runner } = await gwRunner();
    const before = gw(runner).nation("DEU")!.authority;
    order(runner, { kind: "press_censor", up: true });
    expect(gw(runner).s.seats[0].press.censor).toBe(0);
    expect(gw(runner).nation("DEU")!.authority).toBe(before);
  });

  test("a tighter censor costs authority and is one act a chapter", async () => {
    const { runner, s, n } = await atWar();
    const before = n.authority;
    order(runner, { kind: "press_censor", up: true });
    expect(s.press.censor).toBe(1);
    expect(n.authority).toBe(before - GW_PRESS_ROWS.DEU!.price);
    order(runner, { kind: "press_censor", up: true });
    expect(s.press.censor).toBe(1);
    expect(pressOf(runner).acted).toBe(true);
  });

  test("a strict censor leaves gaps where it would hurt, and rumour grows", async () => {
    const { runner, g, s } = await atWar();
    s.press.censor = 2;
    s.press.warBegun = true;
    s.choices.push({
      scene: "deu_h_strike_january",
      pick: "military_rule",
      chapter: g.s.chapter,
      proxy: false,
    });
    playChapter(runner);
    const e = pressOf(runner).edition!;
    expect(e.story).toBe("jan_strike");
    const vor = e.heads.find((h) => h.paper === "vor")!;
    expect(vor.blank).toBe(true);
    expect(vor.tone).toBe(0);
    expect(s.press.opinion.workers).toBe(0);
    expect(s.press.rumour).toBeGreaterThan(0);
    expect(s.press.opinion.press).toBeLessThan(0);
  });

  test("no gap: the rumour dies down", async () => {
    const { runner } = await gwRunner();
    const seatState = gw(runner).s.seats[0];
    seatState.press.rumour = 3;
    playChapter(runner);
    expect(seatState.press.rumour).toBe(2);
  });

  test("high rumour has a line in the margin", async () => {
    const { runner, s } = await atWar();
    s.press.rumour = 3;
    playChapter(runner);
    expect(pressOf(runner).edition!.rumour).not.toBeNull();
  });

  test("an invitation spends an audience and moves two blocs", async () => {
    const { runner, s } = await atWar();
    const before = s.audiences;
    order(runner, { kind: "press_invite", paper: "vor" });
    expect(s.audiences).toBe(before - 1);
    expect(s.press.opinion.workers).toBe(1);
    expect(s.press.opinion.court).toBe(-1);
    expect(pressOf(runner).papers.find((p) => p.id === "vor")!.friend).toBe(
      true,
    );
  });

  test("an invited paper holds back its blow", async () => {
    const { runner, g, s } = await atWar();
    order(runner, { kind: "press_invite", paper: "vor" });
    s.choices.push({
      scene: "deu_k_peace_resolution",
      pick: "dissolve",
      chapter: g.s.chapter,
      proxy: false,
    });
    s.choices.push({
      scene: "deu_h_strike_january",
      pick: "military_rule",
      chapter: g.s.chapter,
      proxy: false,
    });
    playChapter(runner);
    const vor = pressOf(runner).edition!.heads.find((h) => h.paper === "vor")!;
    expect(vor.soft).toBe(true);
    expect(vor.tone).toBe(0);
  });

  test("Pravda does not come to the palace", async () => {
    expect(
      GW_PRESS_ROWS.RUS!.papers.find((p) => p.id === "pravda")!.noInvite,
    ).toBe(true);
  });

  test("a leak names its man and he remembers", async () => {
    const { runner, g, s } = await atWar();
    const p = g.person("deu_jagow")!;
    const trust = p.trust;
    order(runner, { kind: "press_leak", person: "deu_jagow" });
    expect(p.trust).toBe(trust - 1);
    expect(p.memory.some((m) => m.key === "leaked_on")).toBe(true);
    playChapter(runner);
    const e = pressOf(runner).edition!;
    expect(e.story).toBe("leak");
    expect(e.who).toBe("deu_jagow");
    expect(s.press.event).toBeNull();
  });

  test("a stranger can't be leaked on", async () => {
    const { runner, g } = await atWar();
    order(runner, { kind: "press_leak", person: "gbr_grey" });
    expect(g.person("gbr_grey")!.memory).toEqual([]);
    expect(pressOf(runner).acted).toBe(false);
  });

  test("war brings the censor once, and a player can then lift it", async () => {
    const { runner, s } = await atWar();
    playChapter(runner);
    expect(s.press.censor).toBe(1);
    expect(pressOf(runner).edition!.story).toBe("war_censor");
    order(runner, { kind: "press_censor", up: false });
    expect(s.press.censor).toBe(0);
    playChapter(runner);
    expect(s.press.censor).toBe(0);
  });
});

describe("the blocs", () => {
  test("support is read from the bodies, with its reasons", async () => {
    const { runner } = await gwRunner();
    const g = gw(runner);
    const n = g.nation("DEU")!;
    n.inst.reichstag = 3;
    g.touch();
    const up = pressOf(runner).blocs.find((b) => b.id === "parliament")!;
    n.inst.reichstag = -3;
    const down = pressOf(runner).blocs.find((b) => b.id === "parliament")!;
    expect(up.support - down.support).toBe(6);
    expect(down.why[0]).toEqual({ key: "reichstag_heard", up: false });
  });

  test("the papers' word feeds its bloc", async () => {
    const { runner } = await gwRunner();
    const s = gw(runner).s.seats[0];
    const before = pressOf(runner).blocs.find((b) => b.id === "workers")!;
    s.press.opinion.workers = -2;
    const after = pressOf(runner).blocs.find((b) => b.id === "workers")!;
    expect(after.support).toBe(before.support - 2);
    expect(after.why.some((w) => w.key === "papers_hard")).toBe(true);
  });

  test("a bloc that turns says so on the log", async () => {
    const { runner } = await gwRunner();
    const g = gw(runner);
    g.nation("DEU")!.inst.army = -5;
    playChapter(runner);
    expect(g.s.seats[0].log.some((l) => l.key === "bloc_deu_army")).toBe(true);
  });

  test("a tie breaks when its condition goes", async () => {
    const { runner } = await gwRunner();
    const g = gw(runner);
    const tie = () =>
      pressOf(runner).ties.find((t) => t.key === "sword_throne")!;
    expect(tie().on).toBe(true);
    g.nation("DEU")!.inst.army = 4;
    expect(tie().on).toBe(false);
  });

  test("a scene can ask a bloc and move the papers' word", async () => {
    const { runner } = await gwRunner();
    const g = gw(runner);
    const s = g.s.seats[0];
    expect(s.press.opinion.army).toBe(0);
    const { holds, runEffect } =
      await import("@openfront/engine/ww1914/SceneRun");
    const ctx = { gw: g, seat: s, cast: {} };
    runEffect(ctx, { kind: "opinion", bloc: "army", delta: 2 });
    runEffect(ctx, { kind: "rumour", delta: 2 });
    runEffect(ctx, { kind: "censor", delta: 2 });
    expect(s.press.opinion.army).toBe(2);
    expect(holds(ctx, { kind: "rumour", min: 2 })).toBe(true);
    expect(holds(ctx, { kind: "censor", max: 0 })).toBe(true);
    expect(holds(ctx, { kind: "bloc", bloc: "army", min: 2 })).toBe(true);
  });
});

describe("what the seat may know", () => {
  test("the press state crosses a snapshot unchanged", async () => {
    const { runner } = await gwRunner();
    order(runner, { kind: "press_invite", paper: "tag" });
    playChapter(runner);
    const g = gw(runner);
    const before = g.hash();
    const copy = GreatWarSnapshot.schema.parse(
      JSON.parse(JSON.stringify(g.snapshot())),
    );
    g.restoreState(copy);
    expect(g.hash()).toBe(before);
    expect(g.s.seats[0].press.friend).toBe("tag");
    step(runner, 2);
    expect(pressOf(runner).edition).not.toBeNull();
  });
});
