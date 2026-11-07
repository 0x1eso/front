import {
  GW_BACK_DIRECTIONS,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwAct,
  gwActPackProblems,
  gwActProblems,
  GwActSchema,
  GwAim,
  GwAimSchema,
  gwSplitPicks,
} from "@openfront/engine-api/ww1914/GwActs";
import { GwOrderSchema } from "@openfront/engine-api/ww1914/GwOrders";
import { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_CALENDARS,
  gwChapters,
} from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import {
  backable,
  backDirections,
  digPct,
  reworkEffects,
  reworkTell,
} from "@openfront/engine-lib/ww1914/SendBackRules";
import { GW_HEADS } from "@openfront/engine-lib/ww1914/StoryRows";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

const state = (r: GameRunner): GwSeatState => r.game.greatWar()!.s.seats[0];

const scene = (id: string, extra: Partial<GwScene>): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "report",
  cast: {},
  salience: 5,
  tags: ["home"],
  variants: [{ id: "base" }],
  scheduledOnly: true,
  ...extra,
});

const SCENES: GwScene[] = [
  scene("t_letter_r", {
    cast: { to: { person: "deu_bethmann" } },
    variants: [
      {
        id: "fits",
        when: { kind: "tone_fits", who: { role: "to" } },
      },
      {
        id: "mobilise",
        when: { kind: "picked", field: "subject", of: ["mobilise"] },
      },
      { id: "base" },
    ],
  }),
  scene("t_council", {
    cast: { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } },
  }),
  scene("t_council_other", {
    cast: { a: { picked: "attend" }, b: { picked: "attend", nth: 1 } },
  }),
  scene("t_visit", {}),
  scene("t_out", { cast: { a: { picked: "pair" } } }),
  scene("t_never", { when: { kind: "flag", flag: "t_never" } }),
];

const ACTS: GwAct[] = [
  {
    id: "t_letter",
    nation: ["DEU"],
    kind: "letter",
    scene: "t_letter_r",
    wait: 1,
    fields: [
      { id: "subject", options: [{ id: "serbia" }, { id: "mobilise" }] },
      { id: "tone", tones: ["warm", "threat"] },
    ],
  },
  {
    id: "t_council",
    nation: ["DEU"],
    kind: "order",
    scene: "t_council",
    wait: 0,
    fields: [
      {
        id: "agenda",
        options: [
          { id: "food" },
          { id: "shells", scene: "t_council_other" },
          { id: "shut", when: { kind: "flag", flag: "t_never" } },
        ],
      },
      { id: "attend", people: "cabinet", count: 2 },
    ],
  },
  {
    id: "t_visit",
    nation: ["DEU"],
    kind: "visit",
    scene: "t_visit",
    wait: 0,
    once: true,
    effects: [doWorld({ do: "inspect", fact: "shells", tag: "FRA" })],
  },
  {
    id: "t_shut",
    nation: ["DEU"],
    kind: "visit",
    when: { kind: "flag", flag: "t_never" },
    scene: "t_visit",
    wait: 0,
  },
  {
    id: "t_russia",
    nation: ["RUS"],
    kind: "visit",
    scene: "t_visit",
    wait: 0,
  },
  {
    id: "t_set_on",
    nation: ["DEU"],
    kind: "intrigue",
    scene: "t_visit",
    wait: 1,
    fields: [{ id: "pair", people: "cabinet", count: 2 }],
    caught: { pct: 100, scene: "t_out", wait: 2 },
  },
];

const AIMS: GwAim[] = [
  {
    id: "t_aim_peace",
    nation: ["DEU"],
    met: { kind: "chapter", min: 0 },
    tasks: ["deu_no_great_war"],
    effects: [{ kind: "flag", flag: "t_aim_set" }],
    dropped: [{ kind: "flag", flag: "t_aim_left" }],
  },
  {
    id: "t_aim_win",
    nation: ["DEU"],
    met: { kind: "chapter", max: -1 },
    tasks: ["deu_paris_by_winter", "deu_bread_for_the_winter"],
  },
];

const fixture = () =>
  useGwContent({
    scenes: [...GW_CONTENT.scenes, ...SCENES],
    people: GW_CONTENT.people,
    acts: ACTS,
    aims: AIMS,
  });

afterEach(() => useGwContent(null));

const scheduled = (r: GameRunner) => state(r).scheduled;
const pickTwo = (r: GameRunner) =>
  seat(r)
    .acts!.find((a) => a.id === "t_council")!
    .fields.find((f) => f.id === "attend")!.people;

describe("the schedule", () => {
  test("every playing chapter has a slot or two, the closing none", () => {
    for (const id of Object.keys(
      GW_CALENDARS,
    ) as (keyof typeof GW_CALENDARS)[]) {
      for (const ch of gwChapters(id)) {
        if (ch.stage === "closing") expect(ch.acts).toBe(0);
        else expect([1, 2]).toContain(ch.acts);
      }
    }
  });

  test("the seat sees what state opens, and only its own", async () => {
    fixture();
    const { runner } = await gwRunner();
    const ids = seat(runner).acts!.map((a) => a.id);
    expect(ids).toContain("t_letter");
    expect(ids).not.toContain("t_shut");
    expect(ids).not.toContain("t_russia");
    const agenda = seat(runner)
      .acts!.find((a) => a.id === "t_council")!
      .fields.find((f) => f.id === "agenda")!;
    expect(agenda.options).toEqual(["food", "shells"]);
  });

  test("a letter spends the slot and its reply comes by tone and temperament", async () => {
    fixture();
    const { runner } = await gwRunner();
    const left = seat(runner).actsLeft!;
    order(runner, {
      kind: "act",
      act: "t_letter",
      picks: ["mobilise", "threat"],
    });
    expect(seat(runner).actsLeft).toBe(left - 1);
    expect(seat(runner).desk.some((c) => c.scene === "t_letter_r")).toBe(false);
    expect(scheduled(runner).map((q) => q.scene)).toContain("t_letter_r");
    playChapter(runner);
    const card = seat(runner).desk.find((c) => c.scene === "t_letter_r");
    expect(card).toBeDefined();
  });

  test("the tone is read against the person's temperament", async () => {
    fixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const p = gw.person("deu_bethmann")!;
    p.trust = 0;
    p.pride = 0;
    const s = gw.s.seats[0];
    const { holds } = await import("@openfront/engine/ww1914/SceneRun");
    s.acted.push({ act: "t_letter", chapter: 0, picks: { tone: ["threat"] } });
    const ctx = { gw, seat: s, cast: { to: p.id }, act: 0 };
    const fits = { kind: "tone_fits", who: { role: "to" } } as const;
    p.temperament = "cold";
    expect(holds(ctx, fits)).toBe(false);
    p.temperament = "anxious";
    expect(holds(ctx, fits)).toBe(true);
    const asked = { kind: "picked" as const, field: "tone", of: ["threat"] };
    expect(holds(ctx, asked)).toBe(true);
    expect(holds({ ...ctx, act: null }, asked)).toBe(false);
    expect(holds({ ...ctx, act: null }, { ...asked, act: "t_letter" })).toBe(
      true,
    );
  });

  test("slots run out, and a picked person fills the scene", async () => {
    fixture();
    const { runner } = await gwRunner();
    const [a, b] = pickTwo(runner);
    order(runner, { kind: "act", act: "t_council", picks: ["shells", a, b] });
    const card = seat(runner).desk.find((c) => c.scene === "t_council_other");
    expect(card?.cast).toEqual({ a, b });
    const before = seat(runner).desk.length;
    order(runner, { kind: "act", act: "t_visit", picks: [] });
    expect(seat(runner).desk.length).toBe(before);
    expect(state(runner).acted.length).toBe(1);
  });

  test("a bad pick is refused and costs nothing", async () => {
    fixture();
    const { runner } = await gwRunner();
    const [a] = pickTwo(runner);
    const left = seat(runner).actsLeft;
    for (const picks of [
      ["food", a, a],
      ["shut", a, "deu_moltke"],
      ["food", a],
      ["food", a, "nobody_here"],
    ]) {
      order(runner, { kind: "act", act: "t_council", picks });
    }
    expect(seat(runner).actsLeft).toBe(left);
    expect(state(runner).acted).toEqual([]);
  });

  test("`once` keeps an entry off the schedule after it is taken", async () => {
    fixture();
    const { runner } = await gwRunner();
    order(runner, { kind: "act", act: "t_visit", picks: [] });
    expect(seat(runner).acts!.map((a) => a.id)).not.toContain("t_visit");
    playChapter(runner);
    expect(seat(runner).acts!.map((a) => a.id)).not.toContain("t_visit");
  });

  test("an entry is rested for its cooldown", async () => {
    fixture();
    const { runner } = await gwRunner();
    order(runner, { kind: "act", act: "t_letter", picks: ["serbia", "warm"] });
    expect(seat(runner).acts!.map((a) => a.id)).not.toContain("t_letter");
  });

  test("a discovery comes on top of the act, with the same people", async () => {
    fixture();
    const { runner } = await gwRunner();
    const [a, b] = pickTwo(runner);
    order(runner, { kind: "act", act: "t_set_on", picks: [a, b] });
    const list = scheduled(runner);
    expect(list.map((q) => q.scene)).toEqual(
      expect.arrayContaining(["t_visit", "t_out"]),
    );
    playChapter(runner);
    playChapter(runner);
    const out = seat(runner).desk.find((c) => c.scene === "t_out");
    expect(out?.cast.a).toBe(a);
  });

  test("seeing with one's own eyes puts a wrong report right", async () => {
    fixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const truth = gw.nation("FRA")!.gauges.shells;
    gw.s.reports.push({
      uid: gw.s.nextReport++,
      fact: "shells",
      tag: "FRA",
      theatre: null,
      source: "agents",
      stamp: "unconfirmed",
      claim: truth + 1,
      truth,
      smallID: gw.s.seats[0].smallID,
      chapter: 0,
      checkDay: gw.s.day + 20,
    });
    order(runner, { kind: "act", act: "t_visit", picks: [] });
    const reports = seat(runner).world.reports.filter(
      (r) => r.fact === "shells" && r.tag === "FRA",
    );
    expect(reports[0].corrected).toBe(truth);
    expect(reports[1]).toMatchObject({
      source: "own_eyes",
      stamp: "confirmed",
      claim: truth,
    });
    expect(state(runner).log.map((l) => l.key)).toContain("report_corrected");
  });

  test("the fields split as the order flattens them", () => {
    const a = ACTS[1];
    expect(gwSplitPicks(a, ["food", "x", "y"])).toEqual({
      agenda: ["food"],
      attend: ["x", "y"],
    });
    expect(gwSplitPicks(a, ["food", "x"])).toBeNull();
    expect(gwSplitPicks(a, ["food", "x", "y", "z"])).toBeNull();
  });

  test("the orders are on the wire", () => {
    for (const o of [
      { kind: "act", act: "t_letter", picks: ["a", "b"] },
      { kind: "send_back", card: 7, direction: "cheaper" },
      { kind: "aim", aim: "deu_aim_x" },
      { kind: "terms", tag: "ITA", give: ["price"], ask: ["stay_out"] },
    ]) {
      expect(GwOrderSchema.safeParse(o).success).toBe(true);
    }
  });
});

describe("the content of the schedule", () => {
  test("entries and aims parse, meet their scenes and have their text", async () => {
    const scenes = new Map(GW_CONTENT.scenes.map((s) => [s.id, s]));
    const out: string[] = [];
    for (const a of GW_CONTENT.acts ?? []) {
      GwActSchema.parse(a);
      out.push(...gwActProblems(a, scenes));
    }
    const mandates = (await import("@openfront/engine/ww1914/Mandates"))
      .GW_MANDATES;
    for (const a of GW_CONTENT.aims ?? []) {
      GwAimSchema.parse(a);
      for (const t of a.tasks) {
        const known = a.nation.every((n) =>
          (mandates[n] ?? []).some((m) => m.id === t),
        );
        if (!known) out.push(`${a.id}: no mandate ${t}`);
      }
    }
    const get = async (f: string) =>
      JSON.parse(
        fs.readFileSync(path.join(__dirname, "../../resources", f), "utf8"),
      ) as unknown;
    for (const tag of ["DEU", "GBR", "AUH", "RUS"] as const) {
      const pack = await loadGwPack(tag, get);
      out.push(
        ...gwActPackProblems(
          (GW_CONTENT.acts ?? []).filter((a) => a.nation.includes(tag)),
          (GW_CONTENT.aims ?? []).filter((a) => a.nation.includes(tag)),
          pack,
        ),
      );
    }
    expect(out).toEqual([]);
  });

  test("the check finds what it should", () => {
    const scenes = new Map(SCENES.map((s) => [s.id, s]));
    const bad: GwAct = {
      id: "t_bad",
      nation: ["DEU"],
      kind: "order",
      scene: "t_council",
      wait: 0,
      fields: [{ id: "attend", people: "cabinet" }],
    };
    expect(gwActProblems(bad, scenes).join()).toMatch(/nth past/);
    expect(gwActProblems({ ...bad, scene: "nope" }, scenes).join()).toMatch(
      /no scene/,
    );
  });
});

const paper: GwScene = {
  ...scene("t_paper", {
    kind: "proposal",
    cast: { minister: { office: "chancellor" } },
    scheduledOnly: false,
    variants: [
      {
        id: "rewritten",
        when: { kind: "returned", changed: true },
      },
      { id: "base" },
    ],
    options: [
      {
        id: "sign",
        tell: ["money:-2", "morale:+2", "temp:+1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: -2 },
          { kind: "gauge", gauge: "morale", delta: 2 },
          { kind: "temp", delta: 1 },
        ],
      },
      { id: "refuse", tell: [], effects: [] },
    ],
  }),
};

describe("the rewrite rule", () => {
  const o = paper.options![0];

  test("a direction eases its cost a step and takes a step off the gain", () => {
    expect(reworkEffects(o.effects, "cheaper")).toEqual([
      { kind: "gauge", gauge: "money", delta: -1 },
      { kind: "gauge", gauge: "morale", delta: 1 },
      { kind: "temp", delta: 1 },
    ]);
    expect(reworkEffects(o.effects, "gentler")).toEqual([
      { kind: "gauge", gauge: "money", delta: -2 },
      { kind: "gauge", gauge: "morale", delta: 1 },
    ]);
  });

  test("firmer gains more and costs more", () => {
    expect(reworkEffects(o.effects, "firmer")).toEqual([
      { kind: "gauge", gauge: "money", delta: -3 },
      { kind: "gauge", gauge: "morale", delta: 3 },
      { kind: "temp", delta: 1 },
    ]);
  });

  test("nothing to ease leaves the paper as it was", () => {
    expect(reworkEffects(o.effects, "kinder")).toEqual(o.effects);
  });

  test("the tell follows the effects", () => {
    expect(reworkTell(o, "gentler")).toEqual(["money:-2", "morale:+1"]);
  });

  test("only directions that change the paper are on offer", () => {
    expect(backDirections(paper)).toEqual(["cheaper", "gentler", "firmer"]);
    for (const d of backDirections(paper)) {
      expect(GW_BACK_DIRECTIONS).toContain(d);
    }
  });

  test("a crisis link, a budget, a talk and a paper marked so stay", () => {
    expect(backable(paper)).toBe(true);
    expect(backable({ ...paper, kind: "crisis" })).toBe(false);
    expect(backable({ ...paper, kind: "letter" })).toBe(false);
    expect(backable({ ...paper, noBack: true })).toBe(false);
    expect(backable({ ...paper, id: "gw_bm_x" })).toBe(false);
    expect(
      backable({
        ...paper,
        options: [{ ...paper.options![0], screen: "budget" }],
      }),
    ).toBe(false);
  });

  test("the stubborn dig in more, more so when pressed", () => {
    const p = { temperament: "stubborn", trust: 0, pride: 2 } as const;
    const w = { temperament: "weary", trust: 0, pride: 2 } as const;
    expect(digPct(p, 0)).toBeGreaterThan(digPct(w, 0));
    expect(digPct(p, 2)).toBeGreaterThan(digPct(p, 0));
    expect(digPct({ ...w, trust: 3 }, 0)).toBeLessThan(digPct(w, 0));
    expect(digPct({ ...p, pride: 5, trust: -3 }, 9)).toBeLessThanOrEqual(95);
  });
});

/** Puts the fixture paper on the desk. */
function dealPaper(r: GameRunner) {
  const gw = r.game.greatWar()!;
  const s = gw.s.seats[0];
  s.scheduled.push({ scene: "t_paper", chapter: gw.s.chapter + 1 });
  playChapter(r);
  return seat(r).desk.find((c) => c.scene === "t_paper")!;
}

function withPaper() {
  useGwContent({
    scenes: [...GW_CONTENT.scenes, ...SCENES, paper],
    people: GW_CONTENT.people,
    acts: ACTS,
    aims: AIMS,
  });
}

/** A chancellor who will not dig in, or will. */
function setAuthor(r: GameRunner, temperament: string, trust: number) {
  const gw = r.game.greatWar()!;
  const p = gw.s.people.find((x) => x.office === "chancellor")!;
  p.temperament = temperament as typeof p.temperament;
  p.trust = trust;
  p.pride = 0;
  return p;
}

/** Tries seeds until the author, set up by `author`, answers as `changed`. */
async function backAnswered(
  changed: boolean,
  author: (r: GameRunner) => void,
  direction: "cheaper" | "gentler",
): Promise<{ runner: GameRunner; uid: number }> {
  for (let i = 0; i < 40; i++) {
    withPaper();
    const { runner } = await gwRunner({}, `GWBACK${i}`);
    const card = dealPaper(runner);
    author(runner);
    order(runner, { kind: "send_back", card: card.uid, direction });
    if (state(runner).returns[0].changed === changed) {
      return { runner, uid: card.uid };
    }
  }
  throw new Error("no seed answered so");
}

describe("친서", () => {
  const LETTER_TARGET =
    /_a_(l_)?(nicky|georgie|vienna|wilson|poincare|willy|ferdinand|alfonso)$/;
  const heads = new Set(
    Object.values(GW_HEADS).flatMap((rows) => rows.map((r) => r.person)),
  );
  const scenesById = new Map(GW_CONTENT.scenes.map((s) => [s.id, s]));

  test("one to a ruler finds him by headOf and joins the thread", () => {
    const letters = (GW_CONTENT.acts ?? []).filter(
      (a) => a.kind === "letter" && LETTER_TARGET.test(a.id),
    );
    expect(letters.length).toBeGreaterThanOrEqual(12);
    for (const a of letters) {
      const cast = Object.values(scenesById.get(a.scene)!.cast);
      expect(
        cast.some((r) => "ruler_of" in r),
        a.id,
      ).toBe(true);
      expect(
        cast.some((r) => "person" in r && heads.has(r.person)),
        a.id,
      ).toBe(false);
      const written = [
        ...(a.effects ?? []),
        ...(a.fields ?? []).flatMap((f) =>
          (f.options ?? []).flatMap((o) => o.effects ?? []),
        ),
      ];
      expect(
        written.some((e) => e.kind === "letter"),
        a.id,
      ).toBe(true);
    }
  });

  test("a letter from the schedule keeps the tone picked, and the reply knows", async () => {
    const { runner } = await gwRunner();
    order(runner, {
      kind: "act",
      act: "deu_a_nicky",
      picks: ["family", "warm"],
    });
    const gw = runner.game.greatWar()!;
    expect(gw.s.seats[0].story.letters).toEqual([
      expect.objectContaining({ with: "RUS", out: true, tone: "warm" }),
    ]);
    playChapter(runner);
    const reply = seat(runner).desk.find((c) => c.scene === "deu_a_nicky_r");
    expect(reply?.letterFrom).toBe("RUS");
  });

  test("no ruler to write to: the entry isn't on the schedule", async () => {
    const { runner } = await gwRunner();
    const ids = () => (seat(runner).acts ?? []).map((a) => a.id);
    expect(ids()).toContain("deu_a_nicky");
    const gw = runner.game.greatWar()!;
    gw.person("rus_nicholas")!.status = "dead";
    playChapter(runner);
    expect(ids()).not.toContain("deu_a_nicky");
  });
});

describe("sending a paper back", () => {
  test("a paper rewritten comes next chapter and pays out as rewritten", async () => {
    const { runner } = await backAnswered(
      true,
      (r) => setAuthor(r, "weary", 3),
      "cheaper",
    );
    expect(seat(runner).desk.some((c) => c.scene === "t_paper")).toBe(false);
    playChapter(runner);
    const again = seat(runner).desk.find((c) => c.scene === "t_paper")!;
    expect(again.back).toEqual({ direction: "cheaper", changed: true });
    expect(again.backTo).toEqual([]);
    expect(again.variant).toBe("rewritten");
    expect(again.options[0].tell).toEqual(["money:-1", "morale:+1", "temp:+1"]);
    const gw = runner.game.greatWar()!;
    const morale = gw.nation("DEU")!.gauges.morale;
    order(runner, { kind: "choose", card: again.uid, option: "sign" });
    expect(gw.nation("DEU")!.gauges.morale).toBe(Math.min(5, morale + 1));
  });

  test("someone who digs in sends it as it was, and holds it against the seat", async () => {
    let pride = 0;
    const { runner } = await backAnswered(
      false,
      (r) => {
        const p = setAuthor(r, "stubborn", -3);
        p.pride = 4;
        pride = 4;
      },
      "gentler",
    );
    const gw = runner.game.greatWar()!;
    const p = gw.s.people.find((x) => x.office === "chancellor")!;
    expect(p.pride).toBe(pride + 1);
    expect(p.memory.some((m) => m.key === "back_dug")).toBe(true);
    playChapter(runner);
    const again = seat(runner).desk.find((c) => c.scene === "t_paper")!;
    expect(again.back).toEqual({ direction: "gentler", changed: false });
    expect(again.variant).toBe("base");
    expect(again.options[0].tell).toEqual(["money:-2", "morale:+2", "temp:+1"]);
    expect(state(runner).log.map((l) => l.key)).toContain("paper_sent_back");
  });

  const dealtWith = async (over: Partial<GwScene>) => {
    useGwContent({
      scenes: [...GW_CONTENT.scenes, ...SCENES, { ...paper, ...over }],
      people: GW_CONTENT.people,
      acts: ACTS,
      aims: AIMS,
    });
    const { runner } = await gwRunner();
    return dealPaper(runner);
  };

  test("a foreign ruler's letter can't go back", async () => {
    const letter = await dealtWith({
      kind: "letter",
      who: "tsar",
      cast: { tsar: { ruler_of: "RUS" } },
    });
    expect(letter.backTo).toEqual([]);
  });

  test("a paper only foreigners are on has nobody to go back to", async () => {
    const card = await dealtWith({ cast: { tsar: { ruler_of: "RUS" } } });
    expect(card.cast.tsar).toBe("rus_nicholas");
    expect(card.backTo).toEqual([]);
    const named = await dealtWith({
      author: "tsar",
      cast: {
        tsar: { ruler_of: "RUS" },
        chan: { office: "chancellor" },
      },
    });
    expect(named.backTo).toEqual([]);
  });

  test("a foreigner on the paper: it goes back to the seat's own man", async () => {
    const card = await dealtWith({
      cast: {
        tsar: { ruler_of: "RUS" },
        chan: { office: "chancellor" },
      },
    });
    expect(card.backTo).not.toEqual([]);
    expect(card.backWho).toBe(card.cast.chan);
  });

  test("a paper can't go back twice, nor for a direction not on offer", async () => {
    withPaper();
    const { runner } = await gwRunner();
    const card = dealPaper(runner);
    expect(card.backTo).toEqual(["cheaper", "gentler", "firmer"]);
    order(runner, { kind: "send_back", card: card.uid, direction: "kinder" });
    expect(state(runner).returns).toEqual([]);
    order(runner, { kind: "send_back", card: card.uid, direction: "firmer" });
    playChapter(runner);
    const again = seat(runner).desk.find((c) => c.scene === "t_paper")!;
    order(runner, { kind: "send_back", card: again.uid, direction: "firmer" });
    expect(state(runner).returns.length).toBe(1);
  });

  test("nothing to read or say goes back", async () => {
    withPaper();
    const { runner } = await gwRunner();
    for (const c of seat(runner).desk) {
      if (c.options.length === 0) expect(c.backTo).toEqual([]);
    }
  });

  test("the last chapter sends nothing back", async () => {
    withPaper();
    const { runner } = await gwRunner();
    const card = dealPaper(runner);
    runner.game.greatWar()!.s.chapter = view(runner).chapterCount - 1;
    order(runner, { kind: "send_back", card: card.uid, direction: "firmer" });
    expect(state(runner).returns).toEqual([]);
  });
});

describe("the aim", () => {
  test("nothing handed: the tasks wait for the seat's word", async () => {
    fixture();
    const { runner } = await gwRunner();
    expect(seat(runner).aims?.aim).toBeNull();
    expect(seat(runner).aims?.priced).toBe(false);
    expect(seat(runner).world.mandates).toEqual([]);
  });

  test("a country with no list keeps its three tasks", async () => {
    useGwContent({ ...GW_CONTENT, aims: [] });
    const { runner } = await gwRunner();
    expect(seat(runner).aims).toBeNull();
    expect(seat(runner).world.mandates.length).toBe(3);
  });

  test("declaring is free at first, and sets the tasks", async () => {
    fixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    const authority = n.authority;
    order(runner, { kind: "aim", aim: "t_aim_peace" });
    expect(seat(runner).aims?.aim).toBe("t_aim_peace");
    expect(n.authority).toBe(authority);
    expect(state(runner).flags).toContain("t_aim_set");
    expect(seat(runner).world.mandates[0]).toBe("deu_no_great_war");
    expect(seat(runner).world.mandates.length).toBe(3);
  });

  test("changing it has a price, each time more, and the record keeps it", async () => {
    fixture();
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    const n = gw.nation("DEU")!;
    n.authority = 60;
    order(runner, { kind: "aim", aim: "t_aim_peace" });
    order(runner, { kind: "aim", aim: "t_aim_win" });
    expect(n.authority).toBe(50);
    expect(state(runner).flags).toContain("t_aim_left");
    expect(seat(runner).aims?.dropped).toEqual(["t_aim_peace"]);
    expect(state(runner).log.map((l) => l.key)).toContain("aim_changed");
    order(runner, { kind: "aim", aim: "t_aim_peace" });
    expect(n.authority).toBe(35);
  });

  test("the same aim twice is refused, and so is another country's", async () => {
    fixture();
    const { runner } = await gwRunner();
    order(runner, { kind: "aim", aim: "t_aim_peace" });
    order(runner, { kind: "aim", aim: "t_aim_peace" });
    order(runner, { kind: "aim", aim: "rus_nothing" });
    expect(state(runner).aimsDropped).toEqual([]);
  });

  test("scenes read it and the memoir judges it", async () => {
    fixture();
    const { runner } = await gwRunner();
    order(runner, { kind: "aim", aim: "t_aim_peace" });
    const gw = runner.game.greatWar()!;
    const { holds } = await import("@openfront/engine/ww1914/SceneRun");
    const { aimRecord } = await import("@openfront/engine/ww1914/Aims");
    const ctx = { gw, seat: gw.s.seats[0], cast: {} };
    expect(holds(ctx, { kind: "aim", of: ["t_aim_peace"] })).toBe(true);
    expect(holds(ctx, { kind: "aim_met" })).toBe(true);
    expect(holds(ctx, { kind: "aim_changed", min: 1 })).toBe(false);
    expect(aimRecord(gw, gw.s.seats[0])).toEqual({
      id: "t_aim_peace",
      met: true,
      dropped: [],
    });
  });
});

describe("terms offered first", () => {
  const target = (r: GameRunner, tag: string) =>
    seat(r).terms!.targets.find((t) => t.tag === tag);

  async function neutralItaly() {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    return { runner, gw, ita: gw.nation("ITA")! };
  }

  test("the lists follow the state: neutrals can stay out, nobody plays them", async () => {
    const { runner } = await neutralItaly();
    expect(target(runner, "ITA")?.ask).toContain("stay_out");
    expect(target(runner, "ITA")?.ask).not.toContain("peace");
    expect(target(runner, "DEU")).toBeUndefined();
  });

  test("a good price is taken, and the answer comes at the close", async () => {
    const { runner, gw, ita } = await neutralItaly();
    ita.trust.DEU = 3;
    const readiness = ita.readiness;
    order(runner, {
      kind: "terms",
      tag: "ITA",
      give: ["guarantee"],
      ask: ["stay_out"],
    });
    expect(seat(runner).terms!.sent).toBe(true);
    expect(seat(runner).terms!.log[0].yes).toBeNull();
    playChapter(runner);
    const a = seat(runner).terms!.log[0];
    expect(a.yes).toBe(true);
    expect(ita.readiness).toBeLessThan(readiness + 10);
    expect(gw.nation("DEU")!.trust.ITA).toBeGreaterThan(0);
    expect(state(runner).log.some((l) => l.key === "terms_yes")).toBe(true);
    expect(state(runner).log.find((l) => l.key === "terms_yes")?.tag).toBe(
      "ITA",
    );
  });

  test("too little is refused, with a plain reason", async () => {
    const { runner, ita } = await neutralItaly();
    ita.trust.DEU = 0;
    ita.lean = 1;
    order(runner, { kind: "terms", tag: "ITA", give: [], ask: ["credit"] });
    playChapter(runner);
    const a = seat(runner).terms!.log[0];
    expect(a.yes).toBe(false);
    expect(a.why).toBe("too_little");
  });

  test("distrust is said as distrust", async () => {
    const { runner, ita } = await neutralItaly();
    ita.trust.DEU = -3;
    order(runner, { kind: "terms", tag: "ITA", give: [], ask: ["credit"] });
    playChapter(runner);
    expect(seat(runner).terms!.log[0].why).toBe("no_trust");
  });

  test("nobody hears of peace in the first months", async () => {
    const { runner, gw } = await neutralItaly();
    const s = gw.s.seats[0];
    gw.nation("DEU")!.side = "central";
    const rus = gw.nation("RUS")!;
    rus.side = "entente";
    s.terms.push({
      tag: "RUS",
      give: [],
      ask: ["peace"],
      chapter: gw.s.chapter,
      yes: null,
      why: null,
    });
    playChapter(runner);
    expect(state(runner).terms[0].why).toBe("too_soon");
  });

  test("a clause given once costs more the next time", async () => {
    const { runner, gw, ita } = await neutralItaly();
    ita.trust.DEU = 3;
    ita.lean = 0;
    const s = gw.s.seats[0];
    for (const yes of [null, null]) {
      s.terms.push({
        tag: "ITA",
        give: [],
        ask: ["stay_out"],
        chapter: gw.s.chapter,
        yes,
        why: null,
      });
      playChapter(runner);
      ita.trust.DEU = 3;
    }
    expect(s.terms.map((t) => t.yes)).toEqual([true, false]);
  });

  test("a guarantee is given once", async () => {
    const { runner, ita } = await neutralItaly();
    ita.trust.DEU = 3;
    expect(target(runner, "ITA")?.give).toContain("guarantee");
    order(runner, {
      kind: "terms",
      tag: "ITA",
      give: ["guarantee"],
      ask: [],
    });
    playChapter(runner);
    for (let i = 0; i < 4; i++) playChapter(runner);
    expect(target(runner, "ITA")?.give).not.toContain("guarantee");
  });

  test("a neutral far from its bar is not bought cheaply", async () => {
    const { runner, gw, ita } = await neutralItaly();
    gw.nation("DEU")!.side = "central";
    gw.s.day += 400;
    ita.trust.DEU = 0;
    ita.lean = 0;
    ita.readiness = 0;
    order(runner, {
      kind: "terms",
      tag: "ITA",
      give: ["price"],
      ask: ["join"],
    });
    playChapter(runner);
    expect(state(runner).terms[0].yes).toBe(false);
    expect(ita.side).toBeNull();
  });

  test("one a chapter, and the same country rests", async () => {
    const { runner } = await neutralItaly();
    order(runner, { kind: "terms", tag: "ITA", give: [], ask: ["credit"] });
    order(runner, { kind: "terms", tag: "GBR", give: [], ask: ["credit"] });
    expect(state(runner).terms.length).toBe(1);
    playChapter(runner);
    expect(target(runner, "ITA")).toBeUndefined();
    expect(target(runner, "GBR")).toBeDefined();
  });

  test("nothing at all, a clause not open, or a stranger's tag is refused", async () => {
    const { runner } = await neutralItaly();
    order(runner, { kind: "terms", tag: "ITA", give: [], ask: [] });
    order(runner, { kind: "terms", tag: "ITA", give: [], ask: ["peace"] });
    order(runner, { kind: "terms", tag: "XXX", give: [], ask: ["credit"] });
    order(runner, { kind: "terms", tag: "DEU", give: [], ask: ["credit"] });
    expect(state(runner).terms).toEqual([]);
    expect(view(runner).chapter).toBe(0);
  });
});
