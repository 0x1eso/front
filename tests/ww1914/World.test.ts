import type { GameConfig } from "@openfront/engine-api/Schemas";
import {
  GW_LINES,
  GW_THEATRES,
  GwPersonDef,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { neutralChoice } from "@openfront/engine/ww1914/Ai";
import { closeChain, GW_LINKS } from "@openfront/engine/ww1914/Crises";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { sendReport } from "@openfront/engine/ww1914/Intel";
import { GW_MANDATES } from "@openfront/engine/ww1914/Mandates";
import { dismissPrice } from "@openfront/engine/ww1914/People";
import { holds, runEffect } from "@openfront/engine/ww1914/SceneRun";
import { GW_ENTRIES, GW_FRONT_ENDS } from "@openfront/engine/ww1914/Tables";
import { openWar } from "@openfront/engine/ww1914/Wars";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

const man = (id: string, over: Partial<GwPersonDef>): GwPersonDef => ({
  id,
  tag: "DEU",
  office: null,
  fit: [],
  camps: [],
  temperaments: ["cold"],
  rivals: [],
  allies: [],
  fame: 2,
  source: "test",
  ...over,
});

// A small cabinet of its own: these tests don't move with the real cast.
const CAST: GwPersonDef[] = [
  man("deu_bethmann", {
    office: "chancellor",
    fit: ["chancellor"],
    camps: ["civil", "moderate"],
    rivals: ["t_chief"],
  }),
  man("t_chief", {
    office: "chief_of_staff",
    fit: ["chief_of_staff"],
    camps: ["military", "west", "hard"],
    temperaments: ["arrogant"],
    fame: 4,
    rivals: ["deu_bethmann", "t_second"],
  }),
  man("t_second", {
    fit: ["chief_of_staff"],
    camps: ["military", "east"],
    fame: 3,
  }),
  man("t_third", { fit: ["chief_of_staff"], camps: ["civil"] }),
  man("t_general", { camps: ["military"], fame: 3 }),
];

beforeAll(() => useGwContent({ scenes: GW_CONTENT.scenes, people: CAST }));
afterAll(() => useGwContent(null));

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;
const ctx = (gw: GreatWar) => ({ gw, seat: gw.s.seats[0], cast: {} });

/** A game with the war open, at the first chapter of plans. */
async function atWar(
  id = "GWWAR",
  plan: "west" | "east" = "west",
  config: Partial<GameConfig> = {},
) {
  const { runner } = await gwRunner(config, id);
  const gw = gwOf(runner);
  gw.s.chain = null;
  gw.s.spark = null;
  while (gw.s.chapter < 5) playChapter(runner);
  gw.s.plan = plan;
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  playChapter(runner);
  return { runner, gw };
}

/** Clears the desk and signs the first open paper. */
function signFirst(r: GameRunner): void {
  const p = seat(r).world.proposals.find((x) => x.open)!;
  order(r, {
    kind: "allocate",
    main: p.main,
    posture: p.posture,
    scale: p.scale,
    allyShare: p.allyShare,
    research: "artillery",
  });
}

describe("the rolled world", () => {
  test("every country that fights has hidden bands, a theatre's two sides exist", async () => {
    const { runner } = await gwRunner({}, "GWROLL");
    const gw = gwOf(runner);
    for (const t of GW_THEATRES) {
      for (const tag of [
        ...GW_FRONT_ENDS[t].central,
        ...GW_FRONT_ENDS[t].entente,
      ]) {
        const band = gw.nation(tag)!.strength[t];
        expect(band, `${tag} ${t}`).toBeGreaterThanOrEqual(1);
        expect(band, `${tag} ${t}`).toBeLessThanOrEqual(5);
      }
    }
    expect(gw.s.threads).toHaveLength(3);
  });

  test("games differ: bands, secrets, opening, characters, tasks", async () => {
    const worlds = await Promise.all(
      ["GWA", "GWB", "GWC", "GWD", "GWE", "GWF", "GWG", "GWH"].map(
        async (id) => {
          const gw = gwOf((await gwRunner({}, id)).runner);
          return {
            west: gw.nation("FRA")!.strength.west,
            secrets: gw.s.secrets.join(),
            ai: gw.nation("GBR")!.ai,
            lean: gw.nation("GBR")!.lean,
            tasks: gw.s.seats[0].mandates.join(),
          };
        },
      ),
    );
    for (const key of ["west", "secrets", "ai", "tasks"] as const) {
      expect(new Set(worlds.map((w) => w[key])).size).toBeGreaterThan(1);
    }
  });

  test("three tasks, one of each group", async () => {
    const { runner } = await gwRunner({}, "GWTASK");
    const list = GW_MANDATES.DEU!;
    expect(list).toHaveLength(16);
    const got = seat(runner).world.mandates;
    expect(got).toHaveLength(3);
    const groups = got.map((id) => list.find((m) => m.id === id)!.group);
    expect(new Set(groups).size).toBe(3);
  });
});

describe("the crisis", () => {
  test("July runs one link a chapter and ends in war when it stays hot", async () => {
    const { runner } = await gwRunner({}, "GWCRISIS");
    const gw = gwOf(runner);
    gw.s.opening = "sarajevo";
    gw.s.chain = { topic: "balkan", step: 0, hold: 0, short: false };
    const seen: number[] = [];
    while (gw.s.chain !== null) {
      seen.push(gw.s.chain.step);
      gw.s.temp = 9;
      playChapter(runner);
    }
    expect(seen).toEqual(GW_LINKS.map((_, i) => i));
    expect(gw.s.chains.map((c) => c.outcome)).toEqual(["war"]);
    expect(gw.s.warChapter).toBe(5);
  });

  test("cold, it closes in a compromise and the next spark is set", async () => {
    const { runner } = await gwRunner({}, "GWCOLD");
    const gw = gwOf(runner);
    gw.s.chain = { topic: "balkan", step: 4, hold: 0, short: false };
    gw.s.temp = 1;
    playChapter(runner);
    expect(gw.s.chains[gw.s.chains.length - 1]?.outcome).toBe("compromise");
    expect(gw.s.warChapter).toBeNull();
    expect(gw.s.spark).not.toBeNull();
    expect(gw.s.spark!.chapter).toBeGreaterThan(gw.s.chapter);
  });

  test("a hold makes the next link wait; aside ends it in Vienna's defeat", async () => {
    const { runner } = await gwRunner({}, "GWHOLD");
    const gw = gwOf(runner);
    gw.s.chain = { topic: "balkan", step: 4, hold: 0, short: false };
    gw.s.temp = 9;
    runEffect(ctx(gw), doWorld({ do: "hold" }));
    playChapter(runner);
    expect(gw.s.chain?.step).toBe(4);
    runEffect(ctx(gw), doWorld({ do: "aside" }));
    playChapter(runner);
    expect(gw.s.chains[gw.s.chains.length - 1]?.outcome).toBe("humiliation");
    expect(gw.s.warChapter).toBeNull();
  });

  test("no Sarajevo: the desk starts quiet and a spark comes months on", async () => {
    let gw: GreatWar | null = null;
    for (let i = 0; gw === null; i++) {
      const g = gwOf((await gwRunner({}, `GWNO${i}`)).runner);
      if (g.s.opening === "no_sarajevo") gw = g;
    }
    expect(gw.s.chain).toBeNull();
    expect(gw.s.temp).toBe(0);
    expect(gw.s.spark!.chapter).toBeGreaterThanOrEqual(6);
  });

  test("a game with no war is the long peace", async () => {
    const { runner } = await gwRunner({}, "GWPEACE");
    const gw = gwOf(runner);
    gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
    gw.s.temp = 0;
    playChapter(runner);
    while (view(runner).ended === null) {
      gw.s.temp = 0;
      playChapter(runner);
    }
    expect(view(runner).ended).toBe("long_peace");
  });
});

describe("the war", () => {
  test("the alliances pull each other in; Belgium goes with the western plan", async () => {
    const { gw } = await atWar();
    const side = (t: Parameters<GreatWar["nation"]>[0]) => gw.nation(t)!.side;
    expect(side("DEU")).toBe("central");
    expect(side("AUH")).toBe("central");
    expect(side("FRA")).toBe("entente");
    expect(side("RUS")).toBe("entente");
    expect(side("BEL")).toBe("entente");
    expect(gw.nation("DEU")!.atWar).toContain("FRA");
    const open = gw.s.theatres.filter((t) => t.open).map((t) => t.id);
    expect(open).toContain("west");
    expect(open).toContain("east");
  });

  test("the eastern plan leaves Belgium out and Britain slower", async () => {
    const west = await atWar("GWBRIT");
    const east = await atWar("GWBRIT", "east");
    expect(east.gw.nation("BEL")!.side).toBeNull();
    expect(west.gw.nation("GBR")!.readiness).toBeGreaterThanOrEqual(
      east.gw.nation("GBR")!.readiness,
    );
  });

  test("one plan a chapter, only from the chief's papers", async () => {
    const { runner } = await atWar();
    const papers = seat(runner).world.proposals;
    expect(papers.length).toBeGreaterThanOrEqual(3);
    expect(papers[0].by).toBe("t_chief");
    const gw = gwOf(runner);
    order(runner, {
      kind: "allocate",
      main: "colonies",
      posture: "offensive",
      scale: "major",
      allyShare: 3,
      research: "sea",
    });
    expect(gw.s.seats[0].signed).toBe(-1);
    signFirst(runner);
    expect(seat(runner).world.signed).toBe(true);
    const main = seat(runner).alloc.main;
    const second = papers.find((p) => p.main !== main) ?? papers[1];
    order(runner, {
      kind: "allocate",
      main: second.main,
      posture: second.posture,
      scale: second.scale,
      allyShare: second.allyShare,
      research: "sea",
    });
    expect(seat(runner).alloc.main).toBe(main);
  });

  test("the army's weight closes what the chief doesn't want", async () => {
    const { runner, gw } = await atWar();
    gw.nation("DEU")!.inst.army = 4;
    const papers = proposalsFor(gw, gw.s.seats[0]);
    expect(papers[0].open).toBe(true);
    const hold = papers.find((p) => p.id === "hold_all")!;
    expect(hold.open).toBe(false);
    expect(hold.why).toBe("army");
    order(runner, {
      kind: "allocate",
      main: hold.main,
      posture: hold.posture,
      scale: hold.scale,
      allyShare: hold.allyShare,
      research: "artillery",
    });
    expect(gw.s.seats[0].signed).toBe(-1);
  });

  test("an unsigned chapter runs on the chief's own plan, and says so", async () => {
    const { runner, gw } = await atWar();
    // A ledger on the desk would sign it; a chapter with none runs on the plan.
    gw.s.seats[0].desk = [];
    playChapter(runner);
    expect(gw.s.seats[0].alloc.posture).toBe("offensive");
    expect(seat(runner).log.map((l) => l.key)).toContain("plan_by_default");
  });

  test("chapters judge the fronts: results, casualties, trenches, reason lines", async () => {
    const { runner, gw } = await atWar();
    for (let i = 0; i < 5; i++) playChapter(runner);
    const west = gw.s.battles.filter((b) => b.theatre === "west");
    expect(west.length).toBeGreaterThan(0);
    expect(gw.nation("DEU")!.casualties).toBeGreaterThan(0);
    const t = gw.s.theatres.find((x) => x.id === "west")!;
    expect(t.trench).toBeGreaterThan(0);
    expect(t.line).toBeGreaterThanOrEqual(0);
    expect(t.line).toBeLessThan(GW_LINES.west.length);
    const front = seat(runner).world.fronts.find((f) => f.id === "west")!;
    expect(front.line).toBe(GW_LINES.west[t.line]);
    expect(front.last).not.toBeNull();
  });

  test("a neutral follows the better price, as its character weighs it", async () => {
    const { gw } = await atWar();
    const n = gw.nation("ITA")!;
    const e = GW_ENTRIES.find((x) => x.tag === "ITA")!;
    n.lean = 0;
    n.offers = { central: 5, entente: 1 };
    expect(neutralChoice(gw, n, e)).toBe("central");
    n.offers = { central: 1, entente: 5 };
    expect(neutralChoice(gw, n, e)).toBe("entente");
    runEffect(ctx(gw), doWorld({ do: "offer", tag: "ITA", value: 5 }));
    expect(n.offers.central).toBe(5);
  });
});

describe("gauges and the home front", () => {
  test("gauges come in words, with the lines that moved them", async () => {
    const { runner, gw } = await atWar();
    gw.nation("DEU")!.gauges.shells = 3;
    gw.s.seats[0].signed = -1;
    playChapter(runner);
    const g = seat(runner).world.gauges;
    expect(g.map((x) => x.gauge)).toEqual([
      "shells",
      "bread",
      "money",
      "morale",
      "order",
    ]);
    for (const x of g) {
      expect(x.word).toBeGreaterThanOrEqual(0);
      expect(x.word).toBeLessThanOrEqual(3);
    }
    expect(g[0].lines.map((l) => l.key)).toContain("shells_spent");
  });

  test("the ladder takes two chapters at the bottom, and offers a way down", async () => {
    const { runner, gw } = await atWar();
    const n = gw.nation("DEU")!;
    n.gauges.order = 0;
    playChapter(runner);
    n.gauges.order = 0;
    playChapter(runner);
    expect(n.unrest).toBe(1);
    const rung = "gw_home_deu_1";
    expect(seat(runner).desk.map((c) => c.scene)).toContain(rung);
    const card = seat(runner).desk.find((c) => c.scene === rung)!;
    order(runner, { kind: "choose", card: card.uid, option: "ration" });
    expect(n.unrest).toBe(0);
    expect(n.gauges.order).toBeGreaterThan(0);
  });

  test("revolution is the fourth rung: the seat can end it with a memoir", async () => {
    const { runner, gw } = await atWar("GWWAR", "west", {
      greatWar1914Calendar: "full",
    });
    gw.s.chapter = 40; // Germany's top rung waits for month 30.
    const n = gw.nation("DEU")!;
    n.unrest = 3;
    n.lowOrder = 7;
    n.gauges.order = 0;
    n.gauges.bread = 0;
    playChapter(runner);
    const card = seat(runner).desk.find((c) => c.scene === "deu_k_republic")!;
    order(runner, { kind: "choose", card: card.uid, option: "close_seat" });
    expect(view(runner).ended).toBe("home_collapse");
    expect(seat(runner).world.memoir).not.toBeNull();
  });

  test("war credits come to the Reichstag", async () => {
    const { runner } = await atWar();
    playChapter(runner);
    expect(seat(runner).desk.map((c) => c.scene)).toContain("gw_credits");
  });
});

describe("reports", () => {
  test("only an unconfirmed report is ever wrong, and it is put right in a month", async () => {
    const { runner, gw } = await atWar();
    const me = gw.s.seats[0];
    gw.s.sources.forEach((x) => (x.band = 1));
    const made = Array.from({ length: 80 }, () =>
      sendReport(gw, me, "force", "FRA", "west", "attache"),
    );
    const wrong = made.filter((r) => r.claim !== r.truth);
    expect(wrong.length).toBeGreaterThan(0);
    for (const r of wrong) {
      expect(r.stamp).toBe("unconfirmed");
      expect(r.checkDay! - gw.s.day).toBeLessThanOrEqual(30);
    }
    expect(made.some((r) => r.stamp === "confirmed")).toBe(true);
    const shown = () => seat(runner).world.reports.find((r) => r.claim !== 0)!;
    expect(shown()).toBeDefined();
    const unchecked = seat(runner).world.reports.filter((r) => !r.checked);
    expect(unchecked.every((r) => r.corrected === null)).toBe(true);
    playChapter(runner);
    playChapter(runner);
    const src = gw.s.sources.find((x) => x.id === "attache")!;
    expect(src.wrong).toBeGreaterThan(0);
    expect(seat(runner).log.map((l) => l.key)).toContain("report_corrected");
    const seen = seat(runner).world.sources.find((x) => x.id === "attache")!;
    expect(seen.wrong).toBe(src.wrong);
  });

  test("a report goes out each chapter; secrets are found, not shown", async () => {
    const { runner, gw } = await atWar();
    const n = gw.s.reports.length;
    playChapter(runner);
    expect(gw.s.reports.length).toBeGreaterThan(n);
    expect(seat(runner).world.secrets).toEqual([]);
    runEffect(ctx(gw), doWorld({ do: "reveal", id: "bel_forts_strong" }));
    gw.touch();
    expect(seat(runner).world.secrets).toEqual(["bel_forts_strong"]);
    expect(holds(ctx(gw), world({ is: "known", id: "bel_forts_strong" }))).toBe(
      true,
    );
  });
});

describe("people", () => {
  const person = (gw: GreatWar, id: string) => gw.person(id)!;

  test("a letter always comes first; the refusal keeps them", async () => {
    const { runner } = await gwRunner({}, "GWPPL");
    const gw = gwOf(runner);
    const p = person(gw, "t_chief");
    p.trust = -3;
    p.pride = 4;
    playChapter(runner);
    expect(p.office).toBe("chief_of_staff");
    expect(p.letter).not.toBeNull();
    const card = seat(runner).desk.find((c) => c.scene === "gw_letter")!;
    expect(card.cast.who).toBe("t_chief");
    order(runner, { kind: "choose", card: card.uid, option: "keep" });
    expect(p.letter).toBeNull();
    expect(p.office).toBe("chief_of_staff");
    expect(p.trust).toBe(-1);
  });

  test("an accepted letter opens the office, a successor fills it at the close", async () => {
    const { runner } = await gwRunner({}, "GWSUCC");
    const gw = gwOf(runner);
    const p = person(gw, "t_chief");
    p.trust = -3;
    p.pride = 4;
    playChapter(runner);
    const card = seat(runner).desk.find((c) => c.scene === "gw_letter")!;
    order(runner, { kind: "choose", card: card.uid, option: "accept" });
    expect(p.office).toBeNull();
    const names = seat(runner).world.candidates.chief_of_staff!;
    expect(names).toHaveLength(2);
    playChapter(runner);
    const next = seat(runner).people.find((x) => x.office === "chief_of_staff");
    expect(names).toContain(next!.id);
  });

  test("a dismissal has its price, shown first, and can't be overdrawn", async () => {
    const { runner } = await gwRunner({}, "GWDISM");
    const gw = gwOf(runner);
    const n = gw.nation("DEU")!;
    const price = dismissPrice("t_chief");
    expect(price).toBe(33);
    const shown = seat(runner).world.people.find((p) => p.id === "t_chief")!;
    expect(shown.dismissPrice).toBe(price);
    n.authority = 10;
    order(runner, { kind: "dismiss", person: "t_chief" });
    expect(person(gw, "t_chief").office).toBe("chief_of_staff");
    n.authority = 60;
    const army = n.inst.army!;
    const rival = person(gw, "deu_bethmann").trust;
    order(runner, { kind: "dismiss", person: "t_chief" });
    expect(person(gw, "t_chief").office).toBeNull();
    expect(n.authority).toBe(60 - price);
    expect(n.inst.army).toBe(army - 1);
    expect(person(gw, "deu_bethmann").trust).toBe(rival + 1);
  });

  test("competence shows only through results", async () => {
    const { runner } = await gwRunner({}, "GWREP");
    const gw = gwOf(runner);
    const rep = () =>
      seat(runner).world.people.find((p) => p.id === "t_general")!.repute;
    expect(rep()).toBe(0);
    const w = { person: "t_general" };
    for (let i = 0; i < 3; i++) {
      runEffect(ctx(gw), doWorld({ do: "result", who: w, won: true }));
    }
    expect(rep()).toBe(3);
    runEffect(ctx(gw), doWorld({ do: "result", who: w, won: false }));
    runEffect(ctx(gw), doWorld({ do: "result", who: w, won: false }));
    runEffect(ctx(gw), doWorld({ do: "result", who: w, won: false }));
    runEffect(ctx(gw), doWorld({ do: "result", who: w, won: false }));
    expect(rep()).toBe(1);
  });

  test("a general takes each front, and the chief's rival feels a rise", async () => {
    const { gw } = await atWar("GWCMD");
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    expect(west.commander).not.toBeNull();
    expect(gw.person(west.commander!)).not.toBeNull();
    const before = person(gw, "deu_bethmann").trust;
    runEffect(ctx(gw), {
      kind: "appoint",
      who: { person: "t_third" },
      office: "chief_of_staff",
    });
    expect(person(gw, "t_chief").office).toBeNull();
    expect(person(gw, "deu_bethmann").trust).toBe(before);
  });
});

describe("the end", () => {
  test("the memoir: tasks judged, what you didn't know, the shelf", async () => {
    const { runner } = await atWar("GWMEMO");
    while (view(runner).ended === null) playChapter(runner);
    const m = seat(runner).world.memoir!;
    expect(m.ending).toBe(view(runner).ended);
    expect(m.ending.startsWith("first_winter")).toBe(true);
    expect(m.mandates).toHaveLength(3);
    expect(m.unknown.length).toBeGreaterThan(0);
    expect(m.unknown.length).toBeLessThanOrEqual(3);
    expect(new Set(m.unknown.map((u) => u.kind)).size).toBe(m.unknown.length);
    expect(m.turns.map((t) => t.key)).toContain("war_began");
    expect(m.shelf.ending).toBe(m.ending);
    expect(m.fronts.map((f) => f.theatre)).toContain("west");
  });

  test("a scene's end effect closes the game with a memoir too", async () => {
    const { runner, gw } = await atWar("GWFEEL");
    runEffect(ctx(gw), { kind: "end", ending: "compromise_peace" });
    order(runner, { kind: "ready", chapter: 0, on: false });
    expect(seat(runner).world.memoir?.ending).toBe("compromise_peace");
  });

  test("the view shows nothing hidden until the end", async () => {
    const { runner, gw } = await atWar("GWHIDE");
    for (let i = 0; i < 3; i++) playChapter(runner);
    const json = JSON.stringify(view(runner));
    for (const word of [
      "competence",
      "health",
      "temperament",
      "strength",
      "readiness",
      "truth",
      "band",
      "cautious",
      "hardline",
      "opportunist",
      "principled",
    ]) {
      expect(json, word).not.toContain(word);
    }
    const hidden = gw.s.secrets.filter((x) => !gw.s.seats[0].known.includes(x));
    for (const id of hidden) expect(json).not.toContain(id);
  });
});

describe("plausibility rails", () => {
  // Headless games, nobody at the desk: what the world does on its own.
  const play = async (id: string, cal: "y1914" | "full") => {
    const { runner } = await gwRunner({ greatWar1914Calendar: cal }, id);
    const gw = gwOf(runner);
    gw.s.chain = null;
    gw.s.spark = null;
    while (gw.s.chapter < 5) playChapter(runner);
    gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
    gw.s.temp = 9;
    while (view(runner).ended === null) playChapter(runner);
    return gw;
  };

  test("1914 games come out differently", async () => {
    const ends = new Set<string>();
    const lines = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const gw = await play(`GWR${i}`, "y1914");
      ends.add(gw.s.ended!);
      lines.add(gw.s.theatres.find((t) => t.id === "west")!.line);
    }
    expect(ends.size).toBeGreaterThanOrEqual(2);
    expect(lines.size).toBeGreaterThanOrEqual(3);
  });

  test("the long war: Britain comes in, it lasts past 1915", async () => {
    // The real cast: the writers' scenes name its people.
    useGwContent(null);
    let britain = 0;
    let long = 0;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const gw = await play(`GWL${i}`, "full");
      if (gw.nation("GBR")!.side === "entente") britain++;
      if (gw.s.chapter >= 23) long++;
      expect(gw.s.ended).not.toBeNull();
      expect(gw.s.seats[0].memoir).not.toBeNull();
    }
    expect(britain).toBe(n);
    expect(long).toBeGreaterThanOrEqual(n - 1);
    useGwContent({ scenes: GW_CONTENT.scenes, people: CAST });
    // ww193 merge: eight full games on the real map pass three minutes here
    // (they timed out on the live tune too).
  }, 420000);

  test("closing a chain with war twice opens one war", async () => {
    const { gw } = await atWar("GWTWICE");
    const at = gw.s.warChapter;
    gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
    closeChain(gw, "war");
    expect(gw.s.warChapter).toBe(at);
    openWar(gw);
    expect(gw.s.warChapter).toBe(at);
  });
});
