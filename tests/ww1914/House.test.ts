// The house and its factions (ww158, S1): the rows against their scenes and
// text, and the engine on fixture rows on the mini map, Germany: the draft talk,
// the count with factions, deals and amendments, the whip's word, the day by
// the true count, the way round, the Lords' delay, a consent chamber, the
// factions' own bills, tempers and splits, the extra calls, the v2 migration.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GwPack,
  gwPackProblems,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneEffects } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  flag,
  GwScene,
  gwSceneProblems,
  GwSceneSchema,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import { readVersioned } from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  GW_CONTENT,
  GwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { DEU_HOUSE } from "@openfront/engine-lib/ww1914/content/house/houses";
import {
  GW_HOUSE_CONTENT,
  GW_HOUSE_LAWS,
  gwHouseScenes,
} from "@openfront/engine-lib/ww1914/content/scenes/house";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import type {
  GwBillRow,
  GwFactionRow,
  GwHouseContent,
  GwHouseRow,
} from "@openfront/engine-lib/ww1914/HouseRows";
import {
  GW_HOUSE_CALLS,
  houseCalledScenes,
  houseIds,
} from "@openfront/engine-lib/ww1914/HouseRows";
import { GreatWar, GreatWarSnapshot } from "@openfront/engine/ww1914/GreatWar";
import {
  factionOf,
  houseCounts,
  houseStep,
  houseTally,
  houseView,
} from "@openfront/engine/ww1914/House";
import {
  lawCanDecree,
  lawDecree,
  lawPut,
  lawStep,
  lawWithdraw,
} from "@openfront/engine/ww1914/Laws";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { runEffects } from "@openfront/engine/ww1914/SceneRun";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const NATIONS: GwTag[] = ["DEU", "GBR", "AUH", "RUS"];
const KO = path.join(__dirname, "../../resources/ww1914/ko");
const packOf = (f: string): GwPack =>
  fs.existsSync(path.join(KO, f))
    ? (JSON.parse(fs.readFileSync(path.join(KO, f), "utf8")) as GwPack)
    : { version: 1, scenes: {}, people: {} };

// ---- The rows ----

/** What a country's house rows need of each other, the scenes and the pack. */
function houseProblems(c: GwContent, tag: GwTag, pack: GwPack): string[] {
  const out: string[] = [];
  const factions = (c.factions ?? []).filter((f) => f.tag === tag);
  const ids = new Set(factions.map((f) => f.id));
  const laws = new Map(GW_LAWS.map((l) => [l.id, l]));
  const scenes = new Map(c.scenes.map((s) => [s.id, s]));
  const people = new Set([
    ...c.people.map((p) => p.id),
    ...Object.keys(pack.people),
  ]);
  const house = (c.houses ?? []).find((h) => h.tag === tag);
  for (const f of factions) {
    if (pack.factions?.[f.id] === undefined) out.push(`${f.id}: no name`);
    for (const l of f.leaders) {
      if (!people.has(l.person)) out.push(`${f.id}: no person ${l.person}`);
    }
    if (f.radical !== undefined && !people.has(f.radical)) {
      out.push(`${f.id}: no person ${f.radical}`);
    }
    for (const b of f.bills ?? []) {
      if (!laws.has(b)) out.push(`${f.id}: no bill ${b}`);
    }
    for (const [law, text] of Object.entries(f.amends ?? {})) {
      if (laws.get(law)?.draft.some((d) => d.id === text) !== true) {
        out.push(`${f.id}: no text ${law}.${text}`);
      }
    }
    for (const s of [
      ...(f.steps ?? []).map((x) => x.scene),
      ...(f.splits?.scene === undefined ? [] : [f.splits.scene]),
      ...(f.joins?.scene === undefined ? [] : [f.joins.scene]),
    ]) {
      const sc = scenes.get(s);
      if (sc === undefined) out.push(`${f.id}: scene ${s} not written`);
      else if (sc.scheduledOnly !== true) out.push(`${s}: not scheduledOnly`);
    }
    if (f.splits !== undefined && !ids.has(f.splits.into)) {
      out.push(`${f.id}: splits into nothing`);
    }
    for (const x of f.joins === undefined
      ? []
      : [f.joins.into, ...f.joins.with]) {
      if (!ids.has(x)) out.push(`${f.id}: joins ${x}, not a faction`);
    }
    if (f.plot !== undefined && !(c.plots ?? []).some((p) => p.id === f.plot)) {
      out.push(`${f.id}: no plot ${f.plot}`);
    }
  }
  for (const b of (c.bills ?? []).filter((x) => laws.get(x.law)?.tag === tag)) {
    const law = laws.get(b.law)!;
    for (const f of Object.keys(b.stance)) {
      if (!ids.has(f)) out.push(`${b.law}: stance of ${f}, not a faction`);
    }
    for (const [t, sides] of Object.entries(b.texts ?? {})) {
      if (!law.draft.some((d) => d.id === t))
        out.push(`${b.law}: no text ${t}`);
      for (const f of Object.keys(sides)) {
        if (!ids.has(f)) out.push(`${b.law}.${t}: ${f}, not a faction`);
      }
    }
    if (b.by !== undefined && !ids.has(b.by)) out.push(`${b.law}: by ${b.by}?`);
  }
  for (const l of GW_HOUSE_LAWS.filter((x) => x.tag === tag)) {
    if (!(c.bills ?? []).some((b) => b.law === l.id)) {
      out.push(`${l.id}: a faction bill with no bill row`);
    }
  }
  if (house !== undefined) {
    for (const h of house.around?.heats ?? []) {
      if (!ids.has(h.faction)) out.push(`around heats ${h.faction}?`);
    }
    for (const ch of house.chambers) {
      if (ch.consent !== undefined && !ids.has(ch.consent)) {
        out.push(`${ch.id}: consent of ${ch.consent}?`);
      }
    }
  }
  // Every scene the house makes or the file writes: text, a brief, no tell.
  const tagScenes = c.scenes.filter(
    (s) =>
      s.nation.includes(tag) &&
      (houseCalledScenes(c).includes(s.id) ||
        /^gw_(ld|lb|fv|lr)_/.test(s.id) ||
        GW_HOUSE_LAWS.some((l) => s.id.endsWith(`_${l.id}`))),
  );
  const own = new Set([
    ...tagScenes.map((s) => s.id),
    ...GW_HOUSE_CONTENT_SCENES(tag),
  ]);
  const mine = c.scenes.filter((s) => own.has(s.id));
  out.push(...gwPackProblems(mine, pack));
  for (const s of mine) {
    const t = pack.scenes[s.id];
    if (t !== undefined && t.brief === undefined && s.silent !== true) {
      out.push(`${s.id}: no brief`);
    }
    if (GW_HOUSE_LAWS.some((l) => s.id.endsWith(`_${l.id}`))) continue;
    for (const o of s.options ?? []) {
      if (o.tell.length > 0) out.push(`${s.id}.${o.id}: a tell`);
    }
    for (const [n, node] of Object.entries(s.nodes ?? {})) {
      for (const r of node.replies) {
        if (r.tell.length > 0) out.push(`${s.id}.${n}.${r.id}: a tell`);
      }
    }
  }
  for (const l of GW_HOUSE_LAWS.filter((x) => x.tag === tag)) {
    for (const k of [`law_in_${l.id}`, `law_out_${l.id}`]) {
      if (pack.reasons?.[k] === undefined) out.push(`no reason ${k}`);
    }
  }
  return out;
}

/** The hand-written scenes of a country's house file. */
function GW_HOUSE_CONTENT_SCENES(tag: GwTag): string[] {
  return GW_CONTENT.scenes
    .filter((s) => s.nation.includes(tag))
    .filter((s) =>
      (GW_HOUSE_CONTENT.factions ?? []).some(
        (f) =>
          f.tag === tag &&
          [...(f.steps ?? []).map((x) => x.scene)].includes(s.id),
      ),
    )
    .map((s) => s.id);
}

describe("the rows", () => {
  test.each(NATIONS)("%s's house has its scenes and text", (tag) => {
    const pack = mergeGwPacks([
      packOf(`${tag}.house.json`),
      packOf(`${tag}.laws.json`),
      packOf(`${tag}.people.json`),
    ]);
    expect(houseProblems(GW_CONTENT, tag, pack)).toEqual([]);
  });

  test("every faction bill exists, and every faction's bills are bills", () => {
    const ids = new Set(GW_LAWS.map((l) => l.id));
    for (const f of GW_HOUSE_CONTENT.factions ?? []) {
      for (const b of f.bills ?? [])
        expect([f.id, ids.has(b)]).toEqual([f.id, true]);
    }
    for (const b of GW_HOUSE_CONTENT.bills ?? []) {
      expect([b.law, ids.has(b.law)]).toEqual([b.law, true]);
    }
  });

  test("a house comes into play only once its country has factions", () => {
    const tags = new Set((GW_HOUSE_CONTENT.factions ?? []).map((f) => f.tag));
    for (const h of GW_HOUSE_CONTENT.houses ?? []) {
      expect(tags.has(h.tag)).toBe(true);
    }
  });

  test("no atrocity is a faction's price, a bill or a way", () => {
    const words = /학살|추방|강제 이주|제노사이드/;
    for (const tag of NATIONS) {
      expect(JSON.stringify(packOf(`${tag}.house.json`))).not.toMatch(words);
    }
    // Driving a faction under is a consequence of a written decision only.
    for (const s of gwHouseScenes(GW_HOUSE_CONTENT, GW_LAWS)) {
      for (const e of gwSceneEffects(s)) {
        expect(e.kind === "world" && e.of.do === "faction_under").toBe(false);
      }
    }
  });
});

// ---- Fixture rows on the mini map, Germany ----

const SPD: GwFactionRow = {
  id: "t_spd",
  tag: "DEU",
  bloc: "workers",
  leaders: [{ person: "deu_ebert" }],
  radical: "deu_i_haase",
  seats: { reichstag: 3 },
  start: "in",
  strength: 3,
  steps: [
    { at: 2, scene: "t_spd_2" },
    { at: 4, scene: "t_spd_3" },
  ],
  feeds: [{ when: flag("t_spd_feed"), key: "fed" }],
  bills: ["deu_unions"],
  amends: { deu_aux: "unions_text" },
  wants: [{ id: "amnesty" }],
  splits: {
    when: flag("t_split"),
    into: "t_uspd",
    takes: 1,
    scene: "t_uspd_in",
  },
};
const USPD: GwFactionRow = {
  id: "t_uspd",
  tag: "DEU",
  bloc: "workers",
  leaders: [{ person: "deu_i_haase" }],
  seats: { reichstag: 1 },
  start: "out",
};
const CONS: GwFactionRow = {
  id: "t_cons",
  tag: "DEU",
  bloc: "business",
  leaders: [{ person: "deu_i_westarp" }],
  seats: { reichstag: 3, lords: 4 },
  start: "in",
};
const CENTRE: GwFactionRow = {
  id: "t_centre",
  tag: "DEU",
  bloc: "parliament",
  leaders: [{ person: "deu_erzberger" }],
  seats: { reichstag: 2 },
  start: "in",
  wants: [
    {
      id: "arbitration",
      keep: flag("t_kept"),
      chapters: 2,
      effects: [setFlag("t_paid")],
    },
  ],
};
const BILLS: GwBillRow[] = [
  {
    law: "deu_aux",
    stance: { t_spd: 1, t_cons: -1, t_centre: 0 },
    texts: { army_text: { t_spd: -1 } },
  },
  {
    law: "deu_bread_cards",
    stance: { t_spd: 1, t_cons: -1, t_centre: 0 },
    around: true,
  },
  { law: "deu_unions", stance: { t_spd: 1, t_cons: -1 }, by: "t_spd" },
];

const HOUSE: GwHouseRow = {
  ...DEU_HOUSE,
  around: { ...DEU_HOUSE.around!, heats: [{ faction: "t_spd", by: 1 }] },
};

const wire = (id: string): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  scheduledOnly: true,
  salience: 5,
  tags: [],
  cast: {},
  variants: [{ id: "base" }],
});

function fixture(
  house: GwHouseRow = HOUSE,
  extra: Partial<GwHouseContent> = {},
) {
  const rows: GwHouseContent = {
    houses: [house],
    factions: [SPD, USPD, CONS, CENTRE],
    bills: BILLS,
    ...extra,
  };
  useGwContent({
    ...GW_CONTENT,
    ...rows,
    scenes: [
      ...GW_CONTENT.scenes.filter((s) => !/^gw_(ld|lb|fv|lr)_/.test(s.id)),
      ...gwHouseScenes(rows, GW_LAWS),
      ...["t_spd_2", "t_spd_3", "t_uspd_in"].map(wire),
    ],
  });
}

afterEach(() => useGwContent(null));

/** At war in the late summer of 1916, the house formed. */
async function atWar(house?: GwHouseRow, extra?: Partial<GwHouseContent>) {
  fixture(house, extra);
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  const s = gw.s;
  s.warChapter = 0;
  const n = gw.nation("DEU")!;
  n.atWar = ["FRA"];
  n.side = "central";
  s.dayShift = 800;
  s.day += 800;
  n.authority = 80;
  // A war chapter, a month long, and the people of 1916 on the scene.
  const { gwChapters } = await import("@openfront/engine-lib/ww1914/Calendars");
  s.chapter = gwChapters(s.calendar).findIndex((c) => c.spanDays >= 28) + 2;
  for (const id of ["deu_ebert", "deu_erzberger", "deu_groener"]) {
    gw.person(id)!.status = "active";
  }
  const seat = s.seats[0];
  houseStep(gw);
  seat.desk = [];
  seat.scheduled = [];
  for (const f of seat.house!.factions) {
    f.asking = null;
    f.asked = -9;
  }
  return { runner, gw, n, seat };
}

const ctxOf = (gw: GreatWar, seat: GwSeatState) => ({ gw, seat, cast: {} });

/** Takes the bill up and drafts it in this text, through the draft talk. */
function drafted(gw: GreatWar, seat: GwSeatState, law: string, text: string) {
  expect(applyGwOrder(gw, seat, { kind: "law", law, act: "draft" })).toBe(null);
  const card = seat.desk.find((c) => c.scene === houseIds.draft(law))!;
  expect(card).toBeDefined();
  expect(
    applyGwOrder(gw, seat, { kind: "reply", card: card.uid, reply: "pick" }),
  ).toBe(null);
  expect(
    applyGwOrder(gw, seat, { kind: "reply", card: card.uid, reply: text }),
  ).toBe(null);
}

const count = (gw: GreatWar, seat: GwSeatState, law: string) =>
  houseTally(houseCounts(gw, seat, law, 0)).count;

describe("the papers the house makes", () => {
  test("are well-formed scenes, and none shows a price", () => {
    const rows: GwHouseContent = {
      houses: [HOUSE],
      factions: [SPD, USPD, CONS, CENTRE],
      bills: BILLS,
    };
    const made = gwHouseScenes(rows, GW_LAWS);
    expect(made.map((s) => s.id).sort()).toEqual(
      [
        "gw_ld_deu_aux",
        "gw_ld_deu_bread_cards",
        "gw_ld_deu_unions",
        "gw_lb_t_spd",
        "gw_lb_t_uspd",
        "gw_lb_t_cons",
        "gw_lb_t_centre",
        "gw_fv_t_spd",
        "gw_lr_deu",
      ].sort(),
    );
    for (const s of made) {
      expect(GwSceneSchema.safeParse(s).success).toBe(true);
      expect([s.id, gwSceneProblems(s)]).toEqual([s.id, []]);
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies) expect(r.tell).toEqual([]);
      }
    }
    expect(houseCalledScenes(rows)).toEqual(
      expect.arrayContaining(["gw_lr_deu", "gw_fv_t_spd", "t_spd_2"]),
    );
  });
});

describe("a bill through the house", () => {
  test("the house forms with its factions and their leaders", async () => {
    const { gw, seat } = await atWar();
    expect(seat.house?.factions.map((f) => [f.id, f.status])).toEqual([
      ["t_spd", "in"],
      ["t_uspd", "out"],
      ["t_cons", "in"],
      ["t_centre", "in"],
    ]);
    expect(factionOf(seat, "t_cons")?.leader).toBe("deu_i_westarp");
    const v = houseView(gw, seat)!;
    expect(v.factions.map((f) => f.id)).toEqual([
      "t_spd",
      "t_cons",
      "t_centre",
    ]);
    expect(v.around).toBe("bundesrat");
  });

  test("drafted with a minister, no text priced; then into the house with extra calls", async () => {
    const { gw, n, seat } = await atWar();
    expect(
      applyGwOrder(gw, seat, {
        kind: "law",
        law: "deu_aux",
        act: "draft",
        sponsor: "deu_groener",
      }),
    ).toBe(null);
    const card = seat.desk.find((c) => c.scene === "gw_ld_deu_aux")!;
    expect(card.cast.who).toBe("deu_groener");
    applyGwOrder(gw, seat, { kind: "reply", card: card.uid, reply: "pick" });
    applyGwOrder(gw, seat, {
      kind: "reply",
      card: card.uid,
      reply: "army_text",
    });
    const st = n.laws.find((x) => x.id === "deu_aux")!;
    expect([st.stage, st.text, st.sponsor]).toEqual([
      "persuade",
      "army_text",
      "deu_groener",
    ]);
    expect(seat.house!.calls).toBe(GW_HOUSE_CALLS);
  });

  test("the count is the factions' sides by their seats; a deal and an amendment move it", async () => {
    const { gw, n, seat } = await atWar();
    n.inst.reichstag = 0;
    drafted(gw, seat, "deu_aux", "army_text");
    const st = n.laws.find((x) => x.id === "deu_aux")!;
    const base = count(gw, seat, "deu_aux");
    // army_text: the SPD against (-3), the conservatives against (-3), centre away.
    expect(base).toBe(st.support - 6);
    const ctx = ctxOf(gw, seat);
    runEffects(ctx, [doWorld({ do: "deal", id: "t_centre" })]);
    expect(count(gw, seat, "deu_aux")).toBe(base + 2);
    const p = seat.promises.find((x) => x.key === "house_t_centre_deu_aux")!;
    expect(p.who).toBe("deu_erzberger");
    expect(seat.flags).toContain("t_paid");
    runEffects(ctx, [doWorld({ do: "amend", id: "t_spd" })]);
    expect(st.text).toBe("unions_text");
    expect(count(gw, seat, "deu_aux")).toBe(base + 2 + 6);
  });

  test("the whip speaks each chapter, as a report that may be wrong, and is judged after the vote", async () => {
    const { gw, n, seat } = await atWar();
    n.inst.reichstag = 5;
    drafted(gw, seat, "deu_aux", "unions_text");
    houseStep(gw);
    const r = gw.s.reports.filter(
      (x) => x.fact === "count" && x.about === "deu_aux",
    );
    expect(r.length).toBe(1);
    expect(r[0].source).toBe("whip");
    const st = n.laws.find((x) => x.id === "deu_aux")!;
    expect(st.whip).toBe(r[0].claim);
    expect(houseView(gw, seat)!.bill?.whip?.word).toBeDefined();
    st.stage = "vote";
    lawPut(ctxOf(gw, seat), "deu_aux");
    expect(st.stage).toBe("force");
    const h = seat.house!;
    expect(h.right + h.wrong).toBe(1);
    expect(h.last?.law).toBe("deu_aux");
    expect(seat.desk.some((c) => c.scene === houseIds.result("DEU"))).toBe(
      true,
    );
    expect(
      seat.log.some(
        (l) => l.key === "house_voted_for" && l.who === "deu_ebert",
      ),
    ).toBe(true);
  });

  test("short of the count it goes back to the house, whatever the day", async () => {
    const { gw, n, seat } = await atWar();
    n.inst.reichstag = -5;
    drafted(gw, seat, "deu_aux", "army_text");
    const st = n.laws.find((x) => x.id === "deu_aux")!;
    st.stage = "vote";
    const authority = n.authority;
    lawPut(ctxOf(gw, seat), "deu_aux");
    expect(st.stage).toBe("persuade");
    expect(n.authority).toBe(authority - 5);
    expect(seat.house!.last?.band).toBe("lost_wide");
  });

  test("round the house where the constitution reaches, at a price shown after", async () => {
    const { gw, n, seat } = await atWar();
    n.inst.reichstag = -5;
    drafted(gw, seat, "deu_bread_cards", "city_cards");
    const st = n.laws.find((x) => x.id === "deu_bread_cards")!;
    st.stage = "vote";
    expect(lawCanDecree(gw, seat, "deu_bread_cards")).toBe(true);
    const heat = factionOf(seat, "t_spd")!.heat;
    lawDecree(ctxOf(gw, seat), "deu_bread_cards");
    expect([st.stage, st.how]).toEqual(["force", "decreed"]);
    expect(n.authority).toBe(80 - 20);
    expect(factionOf(seat, "t_spd")!.heat).toBe(heat + 1);
    expect(seat.house!.around).toBe(1);
    // Labour law isn't the Bundesrat's.
    expect(lawCanDecree(gw, seat, "deu_aux")).toBe(false);
  });

  test("the Lords put a bill off once; past the delay they can't stop it", async () => {
    const house: GwHouseRow = {
      ...HOUSE,
      chambers: [
        { id: "reichstag", inst: "reichstag", kind: "vote" },
        { id: "lords", kind: "lords" },
      ],
    };
    const { gw, n, seat } = await atWar(house);
    n.inst.reichstag = 5;
    drafted(gw, seat, "deu_aux", "unions_text");
    const st = n.laws.find((x) => x.id === "deu_aux")!;
    st.stage = "vote";
    lawPut(ctxOf(gw, seat), "deu_aux");
    expect(st.stage).toBe("vote");
    expect(st.delayTo).toBe(gw.s.chapter + 3);
    seat.scheduled = [];
    lawStep(gw);
    expect(seat.scheduled.some((q) => q.scene === "gw_lv_deu_aux")).toBe(false);
    gw.s.chapter = st.delayTo;
    lawStep(gw);
    expect(seat.scheduled.some((q) => q.scene === "gw_lv_deu_aux")).toBe(true);
    lawPut(ctxOf(gw, seat), "deu_aux");
    expect(st.stage).toBe("force");
  });

  test("a consent chamber fails a bill its consent faction won't carry", async () => {
    const house: GwHouseRow = {
      ...DEU_HOUSE,
      chambers: [
        {
          id: "budapest",
          inst: "reichstag",
          kind: "consent",
          consent: "t_centre",
        },
      ],
    };
    const { gw, n, seat } = await atWar(house, {
      factions: [SPD, USPD, CONS, { ...CENTRE, seats: { budapest: 2 } }],
    });
    n.inst.reichstag = 5;
    drafted(gw, seat, "deu_aux", "unions_text");
    expect(count(gw, seat, "deu_aux")).toBeLessThan(0);
    runEffects(ctxOf(gw, seat), [doWorld({ do: "deal", id: "t_centre" })]);
    expect(count(gw, seat, "deu_aux")).toBeGreaterThanOrEqual(0);
  });
});

describe("the factions", () => {
  test("a strong faction asks for its bill; refused twice, it brings it itself", async () => {
    const { gw, n, seat } = await atWar();
    houseStep(gw);
    const spd = factionOf(seat, "t_spd")!;
    expect(spd.asking).toBe("deu_unions");
    expect(
      seat.scheduled.some((q) => q.scene === houseIds.visit("t_spd")),
    ).toBe(true);
    const ctx = ctxOf(gw, seat);
    runEffects(ctx, [doWorld({ do: "bill_answer", id: "t_spd", yes: false })]);
    expect([spd.ignored, spd.asking]).toEqual([1, null]);
    expect(spd.heat).toBeGreaterThan(0);
    spd.ignored = 2;
    spd.heat = 0;
    spd.step = 0;
    houseStep(gw);
    const st = n.laws.find((x) => x.id === "deu_unions")!;
    expect([st.stage, st.origin, st.by]).toEqual([
      "persuade",
      "house",
      "t_spd",
    ]);
    lawWithdraw(gw, seat, "deu_unions");
    expect(st.stage).toBe("persuade");
  });

  test("yes to his bill: it comes in with his text", async () => {
    const { gw, n, seat } = await atWar();
    houseStep(gw);
    runEffects(ctxOf(gw, seat), [
      doWorld({ do: "bill_answer", id: "t_spd", yes: true }),
    ]);
    const st = n.laws.find((x) => x.id === "deu_unions")!;
    expect([st.stage, st.origin, st.text]).toEqual([
      "persuade",
      "faction",
      "youth_clause",
    ]);
  });

  test("temper climbs while a feed holds, each step brings its scene, the radical leads at 3", async () => {
    const { gw, seat } = await atWar();
    seat.flags.push("t_spd_feed");
    const spd = factionOf(seat, "t_spd")!;
    for (let i = 0; i < 6 && spd.step < 3; i++) {
      seat.scheduled = seat.scheduled.filter((q) => q.scene.startsWith("t_"));
      houseStep(gw);
      gw.s.chapter++;
    }
    expect(spd.step).toBe(3);
    expect(seat.scheduled.map((q) => q.scene)).toEqual(
      expect.arrayContaining(["t_spd_2", "t_spd_3"]),
    );
    expect(spd.leader).toBe("deu_i_haase");
    expect(houseView(gw, seat)!.out).toBe(null);
  });

  test("a split by state: the new faction sits, taking strength", async () => {
    const { gw, seat } = await atWar();
    seat.flags.push("t_split");
    houseStep(gw);
    expect(factionOf(seat, "t_uspd")!.status).toBe("in");
    expect(factionOf(seat, "t_spd")!.strength).toBe(2);
    expect(seat.scheduled.some((q) => q.scene === "t_uspd_in")).toBe(true);
  });

  test("a lobby talk takes the house's extra calls before the summons", async () => {
    const { gw, seat } = await atWar();
    drafted(gw, seat, "deu_aux", "army_text");
    seat.audiences = 0;
    const call = houseView(gw, seat)!.bill!.factions.find(
      (f) => f.id === "t_centre",
    )!;
    expect(call.call).toBe(houseIds.lobby("t_centre"));
    expect(
      applyGwOrder(gw, seat, {
        kind: "summon",
        person: "deu_erzberger",
        topic: call.call!,
      }),
    ).toBe(null);
    expect(seat.house!.calls).toBe(GW_HOUSE_CALLS - 1);
    expect(seat.audiences).toBe(0);
  });
});

describe("a save", () => {
  test("a version 1 bill reads back with the house's defaults", async () => {
    const { gw, n } = await atWar();
    const old = JSON.parse(JSON.stringify(gw.snapshot()));
    const deu = old.nations.find((x: { tag: string }) => x.tag === "DEU");
    deu.laws = [
      {
        id: "deu_aux",
        stage: "persuade",
        since: 1,
        support: 0,
        how: "none",
        text: "army_text",
        lost: 0,
        after: false,
      },
    ];
    const back = readVersioned(GreatWarSnapshot, { v: 1, d: old });
    const st = back.nations.find((x) => x.tag === "DEU")!.laws[0];
    expect([st.origin, st.by, st.deals, st.whip, st.delayTo]).toEqual([
      "seat",
      null,
      [],
      -1,
      -1,
    ]);
    void n;
  });
});
