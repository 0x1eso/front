import type {
  GwBallot,
  GwBallotChamber,
  GwHouseView,
} from "@openfront/engine-api/ww1914/GwHouse";
import type {
  GwAgendaView,
  GwArticleView,
  GwBookView,
} from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, render, TemplateResult } from "lit";
import { describe, expect, test } from "vitest";
import { headlineText } from "../../../src/client/hud/ww1914/GwBlocs";
import { bookSection, textName } from "../../../src/client/hud/ww1914/GwBook";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import {
  blocFactions,
  houseChip,
} from "../../../src/client/hud/ww1914/GwHouse";
import { promiseText } from "../../../src/client/hud/ww1914/GwText";
import { GwVote, voteOverlay } from "../../../src/client/hud/ww1914/GwVote";
import { tallyAt, votePlan } from "../../../src/client/hud/ww1914/GwVoteModel";

const house = (over: Partial<GwHouseView> = {}): GwHouseView => ({
  bill: null,
  calls: 0,
  record: { right: 0, wrong: 0 },
  whipPerson: "deu_helfferich",
  factions: [],
  out: null,
  around: "bundesrat",
  closed: [],
  gone: false,
  ballot: null,
  ...over,
});

const PACK = {
  version: 1,
  people: {
    deu_helfferich: { name: "헬페리히", lean: "" },
    deu_ebert: { name: "에베르트", lean: "" },
    deu_i_westarp: { name: "베스타르프", lean: "" },
  },
  scenes: {
    gw_law_deu_aux: {
      title: "조국 봉사법",
      text: { base: "." },
      opt: {
        army_text: "**군이 쓴 글을 낸다.** 위원회 없이.",
        unions_text: "**노조가 쓴 글을 낸다.** 공장 위원회와 함께.",
      },
    },
  },
  factions: {
    deu_spd: { name: "사민당", why: { spd_bread: "빵이 바닥났다." } },
    deu_cons: { name: "보수당" },
  },
} as unknown as GwPack;

function ctx(v: GwHouseView | undefined, draw: (c: GwCtx) => TemplateResult) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { date: "1916-11-09", chapter: 20 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      audiences: 0,
      world: { house: v },
    } as unknown as GwSeatView,
    pack: PACK,
    ui: { notes: [] } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(draw(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

const article = (over: Partial<GwArticleView> = {}): GwArticleView => ({
  id: "deu_aux",
  chapter: "conscription",
  bills: ["army_text", "unions_text"],
  force: null,
  how: "none",
  stage: "open",
  can: "submit",
  why: null,
  lockTo: null,
  house: true,
  repeal: null,
  ...over,
});

const agenda = (over: Partial<GwAgendaView> = {}): GwAgendaView => ({
  law: "deu_aux",
  text: "unions_text",
  replaces: null,
  stage: "persuade",
  origin: "seat",
  by: null,
  sponsor: "deu_helfferich",
  age: 2,
  auto: null,
  chambers: ["reichstag"],
  paper: { word: "tight", conf: "mostly", chapter: 19 },
  counting: false,
  counter: "finance",
  call: true,
  callWhy: null,
  confidence: true,
  round: false,
  withdraw: true,
  delayTo: null,
  lobby: [
    {
      faction: "deu_spd",
      seats: { reichstag: 110 },
      leader: "deu_ebert",
      word: "for",
      conf: "sure",
      deal: true,
      shut: null,
      call: true,
      press: ["file", "threat"],
      prices: [],
    },
    {
      faction: "deu_cons",
      seats: { reichstag: 75 },
      leader: "deu_i_westarp",
      word: "waver",
      conf: "heard",
      deal: false,
      shut: "creed",
      call: false,
      press: [],
      prices: null,
    },
  ],
  ...over,
});

function bookCtx(book: GwBookView | undefined, h: GwHouseView | null) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { date: "1916-11-09", chapter: 20 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      audiences: 0,
      people: [{ id: "deu_helfferich", office: "finance" }],
      world: { house: h ?? undefined, book },
    } as unknown as GwSeatView,
    pack: PACK,
    ui: { notes: [], summoned: 0, armedRepeal: null } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(html`${bookSection(c)}`, root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  const q = (sel: string) => root.querySelector(sel) as HTMLButtonElement;
  return { c, sent, root, q };
}

describe("the house on the screens: the law book (ww203), the factions", () => {
  test("a country with no house and no book shows nothing", () => {
    expect(bookCtx(undefined, null).root.textContent?.trim()).toBe("");
  });

  test("chapters fold; an open article goes to a sponsor; a shut one says why", () => {
    const { c, root, sent, q } = bookCtx(
      {
        articles: [
          article(),
          article({
            id: "deu_censor",
            chapter: "censorship",
            bills: ["only"],
            force: "only",
            can: null,
            why: "locked",
            lockTo: 23,
          }),
        ],
        agenda: [],
        max: 3,
        calls: 2,
      },
      house(),
    );
    expect(root.querySelector("[data-gw-article]")).toBeNull();
    q("[data-gw-book-fold=conscription]").click();
    expect(root.textContent).toContain("조국 봉사법");
    // The bills by the lead of their options, never what they do.
    expect(root.querySelector("[data-gw-book-bills]")).not.toBeNull();
    expect(textName(c, "deu_aux", "army_text")).toBe("군이 쓴 글을 낸다.");
    q("[data-gw-book-submit=deu_aux]").click();
    q('[data-gw-book-sponsor="deu_helfferich"]').click();
    expect(sent).toEqual([
      { kind: "bill_submit", law: "deu_aux", sponsor: "deu_helfferich" },
    ]);
    q("[data-gw-book-fold=censorship]").click();
    expect(root.querySelector("[data-gw-book-submit=deu_censor]")).toBeNull();
    expect(root.querySelector("[data-gw-book-why=locked]")).not.toBeNull();
    expect(root.querySelector("[data-gw-book-force]")).not.toBeNull();
  });

  test("the agenda: the count in words, the call, confidence asked twice, the lobby", () => {
    const { root, sent, q } = bookCtx(
      { articles: [], agenda: [agenda()], max: 3, calls: 0 },
      house({ around: "art87", closed: ["duma"], gone: true }),
    );
    expect(root.querySelector("[data-gw-house-gone]")).not.toBeNull();
    // The tests run without a language: the line is its key.
    expect(root.querySelector("[data-gw-agenda-paper]")?.textContent).toContain(
      "gw.agenda.paper",
    );
    q("[data-gw-agenda-vote=deu_aux]").click();
    q('[data-gw-agenda-act="confidence"]').click();
    expect(sent).toEqual([
      { kind: "bill_vote", law: "deu_aux", confidence: false },
    ]);
    q('[data-gw-agenda-act="confidence"]').click();
    expect(sent[1]).toEqual({
      kind: "bill_vote",
      law: "deu_aux",
      confidence: true,
    });
    q("[data-gw-agenda-lobby=deu_aux]").click();
    const spd = root.querySelector("[data-gw-lobby=deu_spd]")?.textContent;
    expect(spd).toContain("에베르트");
    expect(root.querySelector("[data-gw-lobby-deal]")).not.toBeNull();
    // No free call and no time: he can't be summoned now.
    expect(q("[data-gw-lobby-call=deu_spd]").disabled).toBe(true);
    expect(root.querySelector("[data-gw-lobby-call=deu_cons]")).toBeNull();
    expect(root.querySelector("[data-gw-lobby-shut=creed]")).not.toBeNull();
    q("[data-gw-lobby-press=deu_spd]").click();
    q("[data-gw-lobby-how=file]").click();
    expect(sent[2]).toEqual({
      kind: "bill_press",
      law: "deu_aux",
      faction: "deu_spd",
      how: "file",
    });
    q("[data-gw-agenda-count=deu_aux]").click();
    expect(sent[3]).toEqual({ kind: "bill_count", law: "deu_aux" });
    // ww204: summoned, he asks nothing that can be given: he is sent off.
    expect(root.querySelector("[data-gw-lobby-prices=deu_cons]")).toBeNull();
    expect(root.querySelector("[data-gw-lobby-no-price]")).not.toBeNull();
    q("[data-gw-price-leave=deu_spd]").click();
    expect(sent[4]).toEqual({
      kind: "bill_price",
      law: "deu_aux",
      faction: "deu_spd",
      want: null,
    });
  });

  test("a summoned leader's prices show by kind, in his words, and one is taken", () => {
    const base = agenda().lobby[0];
    const { root, sent, q } = bookCtx(
      {
        articles: [],
        agenda: [
          agenda({
            lobby: [
              {
                ...base,
                deal: false,
                prices: [
                  { id: "spd_peace", kind: "promise" },
                  { id: "spd_post", kind: "post" },
                ],
              },
            ],
          }),
        ],
        max: 3,
        calls: 1,
      },
      house({}),
    );
    q("[data-gw-agenda-lobby=deu_aux]").click();
    const box = root.querySelector("[data-gw-lobby-prices=deu_spd]");
    expect(box?.textContent).toContain("gw.lobby.price.promise");
    expect(box?.textContent).toContain("gw.lobby.price.post");
    q("[data-gw-price-take=spd_post]").click();
    expect(sent).toEqual([
      {
        kind: "bill_price",
        law: "deu_aux",
        faction: "deu_spd",
        want: "spd_post",
      },
    ]);
  });

  test("the Bundesrat seats Prussia's 17 together at the head of the table", () => {
    const ch: GwBallotChamber = {
      chamber: "bundesrat",
      size: 61,
      block: 14,
      blocks: [
        { faction: "deu_south", cast: "for", seats: 17, beat: "firm" },
        {
          faction: null,
          cast: "for",
          seats: 17,
          beat: "firm",
          state: "prussia",
        },
        { faction: null, cast: "for", seats: 27, beat: "firm" },
      ],
      pass: true,
      delay: false,
    };
    const plan = votePlan(ch, () => null);
    const prussia = plan.dots.filter((d) => d.block === 1);
    expect(prussia.length).toBe(17);
    const xs = prussia.map((d) => d.x);
    const ys = prussia.map((d) => d.y);
    // One packed block inside the table, not spread round its edge.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(40);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(20);
    expect(Math.min(...ys)).toBeGreaterThan(30);
    expect(plan.dots.length).toBe(61);
  });

  test("a ballot plays its beats in order and stamps where the line is crossed", () => {
    const ch: GwBallotChamber = {
      chamber: "reichstag",
      size: 397,
      block: 0,
      blocks: [
        { faction: "deu_spd", cast: "for", seats: 110, beat: "firm" },
        { faction: "deu_cons", cast: "against", seats: 75, beat: "firm" },
        { faction: "deu_progress", cast: "for", seats: 41, beat: "firm" },
        { faction: "deu_natlib", cast: "against", seats: 30, beat: "waver" },
        { faction: "deu_natlib", cast: "away", seats: 15, beat: "waver" },
        { faction: "deu_centre", cast: "for", seats: 90, beat: "swing" },
        { faction: "deu_minor", cast: "against", seats: 20, beat: "betray" },
      ],
      pass: true,
      delay: false,
    };
    const blocs: Record<string, string> = {
      deu_spd: "workers",
      deu_cons: "army",
      deu_progress: "parliament",
      deu_natlib: "business",
      deu_centre: "parliament",
      deu_minor: "court",
    };
    const plan = votePlan(ch, (f) => blocs[f] ?? null);
    // Beats in the record's order, each later than the last.
    const at = plan.lines.map((l) => l.at);
    expect(at).toEqual([...at].sort((x, y) => x - y));
    expect(plan.lines.map((l) => l.block.beat)).toEqual([
      "firm",
      "firm",
      "firm",
      "waver",
      "waver",
      "swing",
      "betray",
    ]);
    // 241 for, 125 against, 15 away: the line is 184, crossed by the Centre.
    expect(plan.present).toBe(366);
    expect(plan.need).toBe(184);
    const centre = plan.lines[5].at;
    expect(plan.stampAt).toBeGreaterThanOrEqual(centre);
    expect(plan.stampAt).toBeLessThan(plan.lines[6].at + 1);
    expect(tallyAt(plan, plan.stampAt).for).toBe(184);
    expect(tallyAt(plan, Infinity)).toEqual({
      for: 241,
      against: 125,
      away: 15,
    });
    // The seats beyond the blocks sit empty; all 397 are drawn.
    expect(plan.dots).toHaveLength(397);
    // A uid plays once; the one standing at load is only remembered.
    let now = 0;
    const v = new GwVote(() => now);
    const ballot: GwBallot = {
      uid: 4,
      law: "deu_peace_res",
      text: null,
      chapter: 20,
      how: "vote",
      chambers: [ch],
      pass: true,
      band: "narrow",
    };
    expect(v.offer(ballot, () => null)).toBe(false);
    expect(v.offer({ ...ballot, uid: 5 }, () => null)).toBe(true);
    expect(v.offer({ ...ballot, uid: 5 }, () => null)).toBe(false);
    expect(v.at()).toEqual({ k: 0, t: 0 });
    now = 60_000;
    expect(v.tick()).toBe(true);
    expect(v.still).toBe(true);
    v.close();
    expect(v.active).toBe(false);
  });

  test("ww209: the budget's pinned row bargains, and a defying wing is named in the vote", () => {
    const spd = {
      ...agenda().lobby[0],
      prices: [
        {
          id: "spd_bread",
          kind: "promise" as const,
          terms: ["session" as const, "war_end" as const],
        },
      ],
      counters: ["text" as const, "against" as const],
      threats: ["condemn" as const],
      favour: { can: true, owes: true },
      wing: {
        person: "deu_ebert",
        seats: 30,
        prices: null,
        peeled: false,
        call: true,
      },
    };
    const budget = agenda({
      law: "deu_budget",
      text: null,
      lobby: [spd],
      money: { kind: "budget", n: 0, year: 1916, fail: "runs_on" },
    });
    const rival = agenda({ by: "deu_cons", lobby: [] });
    const { c, root, sent, q } = bookCtx(
      { articles: [], agenda: [rival], max: 3, calls: 1, pinned: [budget] },
      house(),
    );
    // Pinned above the agenda, not counted in it, with what losing it does.
    const pinned = root.querySelector("[data-gw-pinned]")!;
    expect(
      pinned.compareDocumentPosition(
        root.querySelector("[data-gw-agenda-box]")!,
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      pinned.querySelector('[data-gw-agenda-money="budget"]'),
    ).not.toBeNull();
    expect(pinned.querySelector("[data-gw-agenda-money-fail]")).not.toBeNull();
    q("[data-gw-agenda-lobby=deu_budget]").click();
    q('[data-gw-price-term="session"]').click();
    q("[data-gw-price-favour=spd_bread]").click();
    q('[data-gw-counter="against"]').click();
    q("[data-gw-counter-pick=deu_aux]").click();
    q("[data-gw-lobby-call-favour=deu_spd]").click();
    q("[data-gw-lobby-press=deu_spd]").click();
    q('[data-gw-lobby-threat="condemn"]').click();
    q("[data-gw-wing-call=deu_spd]").click();
    const law = "deu_budget";
    const faction = "deu_spd";
    expect(sent).toEqual([
      { kind: "bill_term", law, faction, want: "spd_bread", term: "session" },
      { kind: "bill_favour", law, faction, want: "spd_bread", call: false },
      {
        kind: "bill_counter",
        law,
        faction,
        counter: "against",
        pick: "deu_aux",
      },
      { kind: "bill_favour", law, faction, want: null, call: true },
      { kind: "bill_threat", law, faction, threat: "condemn" },
      { kind: "bill_peel", law, faction, want: null },
    ]);

    // The vote: the party casts, then its wing stands up against it, named.
    const ch: GwBallotChamber = {
      chamber: "reichstag",
      size: 397,
      block: 0,
      blocks: [
        { faction: "deu_spd", cast: "for", seats: 96, beat: "firm" },
        { faction: "deu_centre", cast: "for", seats: 90, beat: "swing" },
        {
          faction: "deu_spd",
          cast: "against",
          seats: 14,
          beat: "defy",
          person: "deu_ebert",
          wing: true,
        },
      ],
      pass: true,
      delay: false,
    };
    const plan = votePlan(ch, () => null);
    expect(plan.lines[2].at).toBeGreaterThan(plan.lines[1].at);
    const now = 0;
    const v = new GwVote(() => now);
    const ballot: GwBallot = {
      uid: 1,
      law,
      text: null,
      chapter: 20,
      how: "vote",
      chambers: [ch],
      pass: true,
      band: "narrow",
    };
    v.offer(null, () => null);
    expect(v.offer(ballot, () => null)).toBe(true);
    const scene = document.createElement("div");
    render(voteOverlay(c, v), scene);
    const line = scene.querySelector('[data-gw-vote-line="defy"]')!;
    expect(line.textContent).toContain("gw.vote.wing_of");
    expect(line.textContent).toContain("gw.vote.beat.defy_by");
  });

  test("the 정국 tab lists a bloc's factions in words; the band shows one chip while one is out", () => {
    const v = house({
      factions: [
        {
          id: "deu_spd",
          bloc: "workers",
          status: "in",
          strength: 3,
          temper: 2,
          trend: -1,
          why: "spd_bread",
          leader: "deu_ebert",
          chambers: ["reichstag"],
        },
      ],
      out: { id: "deu_spd", bloc: "workers" },
    });
    const { root } = ctx(v, (c) => html`${blocFactions(c, "workers")}`);
    expect(root.textContent).toContain("사민당");
    expect(root.textContent).toContain("빵이 바닥났다.");
    expect(root.textContent).toContain("gw.house.strength.3");
    expect(
      ctx(v, (c) => html`${blocFactions(c, "army")}`).root.textContent?.trim(),
    ).toBe("");
    const chip = ctx(v, (c) => html`${houseChip(c)}`).root;
    expect(chip.querySelector("[data-gw-house-out=deu_spd]")).not.toBeNull();
  });

  test("a house story's headline falls back to the pack's heads, the faction named", () => {
    const pack = {
      ...PACK,
      factions: { ...PACK.factions, deu_uspd: { name: "독립사민당" } },
      heads: {
        house_split: {
          head: "{faction}, 따로 서다",
          deck: "{who}이(가) 이끈다.",
        },
        house_joined_deu_bloc: { head: "{faction}만의 머리기사" },
      },
    } as unknown as GwPack;
    const e = {
      chapter: 20,
      story: "house_split",
      scene: null,
      who: "deu_ebert",
      faction: "deu_uspd",
      heads: [],
      rumour: null,
    };
    const h = { paper: "vorwaerts", tone: 1, blank: false, soft: false };
    expect(headlineText(pack, e, h)).toEqual({
      head: "독립사민당, 따로 서다",
      deck: "에베르트가 이끈다.",
    });
    const joined = { ...e, story: "house_joined", faction: "deu_bloc" };
    expect(headlineText(pack, joined, h).head).toBe("deu_bloc만의 머리기사");
  });

  test("a deal's promise reads as a sentence naming the leader and the bill", () => {
    const pack = {
      ...PACK,
      promises: {
        house_deal:
          "「{bill}」에 {who}의 무리가 찬성하는 대신, 그가 청한 것을 들어주기로 했다.",
        house_deal_plain: "{who}의 무리가 찬성하는 대신.",
      },
    } as unknown as GwPack;
    const p = {
      key: "house_deu_spd_deu_aux",
      who: "deu_ebert",
      due: "1917-01-01",
      kept: false,
      broken: false,
    };
    expect(promiseText(pack, p as never)).toBe(
      "「조국 봉사법」에 에베르트의 무리가 찬성하는 대신, 그가 청한 것을 들어주기로 했다.",
    );
    expect(
      promiseText(pack, { ...p, key: "house_deu_spd_deu_nothing" } as never),
    ).toBe("에베르트의 무리가 찬성하는 대신.");
  });
});
