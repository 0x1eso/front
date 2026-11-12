import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { GW_AFTER_CHAPTERS } from "@openfront/engine/ww1914/Aftermath";
import { aimMet } from "@openfront/engine/ww1914/Aims";
import { blocNow } from "@openfront/engine/ww1914/Blocs";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { armistice } from "@openfront/engine/ww1914/Peace";
import { describe, expect, test } from "vitest";
import { step } from "../ww1936/util";
import { gwRunner, order, seat as seatOf } from "./util";

const gwOf = (r: GameRunner) => r.game.greatWar()!;

async function war(tag: GwTag = "DEU", id = "GWT1") {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  gw.s.seats[0].tag = tag;
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  // The mini map's war is small: the sides a real one would have by the end.
  // Since a defensive pact no longer drags its two in (b278d6832), Germany
  // and France stay out of the mini map's Balkan war: seat them as well.
  gw.nation("GBR")!.side = "entente";
  gw.nation("FRA")!.side = "entente";
  gw.nation("DEU")!.side = "central";
  return { runner, gw, seat: gw.s.seats[0] };
}

/** Lets the table talk until the seat is due or the month is over. */
function untilDue(r: GameRunner): void {
  for (let i = 0; i < 400; i++) {
    const t = seatOf(r).table;
    if (t?.due !== null || t.done) return;
    order(r, { kind: "table_next" });
  }
  throw new Error("the table never came round");
}

function pass(gw: GreatWar, runner: GameRunner, n: number): void {
  for (let i = 0; i < n && gw.s.ended === null; i++) {
    advanceChapter(gw, runner.game.ticks(), false);
  }
}

describe("the painted map", () => {
  test("is stored on the seat, refuses own land, and is open only in the war", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, "GWP0");
    order(runner, { kind: "claims", places: ["verdun"] });
    expect(seatOf(runner).claims?.places).toEqual([]);
    const { runner: r, seat } = await war("DEU", "GWP1");
    order(r, { kind: "claims", places: ["berlin"] });
    expect(seat.claims).toEqual([]);
    order(r, { kind: "claims", places: ["verdun", "liege"] });
    expect(seat.claims).toEqual(["verdun", "liege"]);
    expect(seat.claimsSigned).toBeGreaterThanOrEqual(0);
    expect(seatOf(r).claims?.open).toBe(true);
    expect(seatOf(r).claims?.priced).toBe(true);
  });

  test("the first signing is free, a change costs more each time", async () => {
    const { runner, gw, seat } = await war("DEU", "GWP2");
    const n = gw.nation("DEU")!;
    n.authority = 60;
    order(runner, { kind: "claims", places: ["verdun"] });
    expect(n.authority).toBe(60);
    order(runner, { kind: "claims", places: ["verdun", "riga"] });
    const first = 60 - n.authority;
    expect(first).toBeGreaterThan(0);
    order(runner, { kind: "claims", places: ["riga"] });
    expect(60 - first - n.authority).toBeGreaterThan(first);
    expect(seat.log.some((l) => l.key === "claims_changed")).toBe(true);
  });

  test("how much was painted moves the blocs, and only after it is signed", async () => {
    const { runner, gw, seat } = await war("DEU", "GWP3");
    const workers = blocNow(gw, seat, "workers");
    const army = blocNow(gw, seat, "army");
    const wide = [
      "verdun",
      "liege",
      "namur",
      "antwerp",
      "riga",
      "kovno",
      "warsaw",
      "lodz",
      "vilna",
    ];
    order(runner, { kind: "claims", places: wide });
    expect(blocNow(gw, seat, "workers")).toBeLessThan(workers);
    expect(blocNow(gw, seat, "army")).toBeGreaterThanOrEqual(army);
    const why = seatOf(runner).world.press?.blocs.find(
      (b) => b.id === "workers",
    );
    expect(why?.why.map((w) => w.key)).toContain("claims_wide");
  });

  test("a friend hears of it, and the foreign minister's paper comes after", async () => {
    const { runner, gw, seat } = await war("DEU", "GWP4");
    const auh = gw.nation("AUH");
    const before = auh?.trust.DEU ?? 0;
    order(runner, { kind: "claims", places: ["verdun", "trieste"] });
    if (auh !== null) expect(auh.trust.DEU).toBe(before - 1);
    expect(seat.scheduled.map((q) => q.scene)).toContain("gw_t_claims_deu");
  });

  test("the staff writes a paper for the painted front", async () => {
    const { runner, gw, seat } = await war("DEU", "GWP5");
    pass(gw, runner, 1);
    const wants = proposalsFor(gw, seat).find((p) => p.id === "cos_plan")!.main;
    const place = wants === "east" ? "verdun" : "riga";
    order(runner, { kind: "claims", places: [place] });
    const paper = proposalsFor(gw, seat).find((p) => p.id === "claim_front");
    expect(paper?.main).not.toBe(wants);
    expect(paper?.claimed).toEqual([place]);
  });

  test("an aim isn't met while half the painted land is out of reach", async () => {
    const { runner, seat, gw } = await war("DEU", "GWP6");
    order(runner, { kind: "aim", aim: "deu_aim_east" });
    gw.nation("RUS")!.out = true;
    expect(aimMet(gw, seat)).toBe(true);
    order(runner, { kind: "claims", places: ["riga", "warsaw"] });
    expect(aimMet(gw, seat)).toBe(false);
    gw.s.held.riga = "DEU";
    expect(aimMet(gw, seat)).toBe(true);
  });
});

describe("the table", () => {
  test("the armistice sets it, and the winners speak first", async () => {
    const { runner, gw } = await war("DEU", "GWT2");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    const t = seatOf(runner).table!;
    expect(t.role).toBe("lost");
    expect(t.order[0]).toBe("FRA");
    expect(t.order).toContain("DEU");
    expect(t.lines[0].word).toBe("open");
    // ww190: the aftermath's months come after the sessions.
    expect(gw.s.conferenceLeft).toBe(3 + GW_AFTER_CHAPTERS);
  });

  test("nobody awaited: the table talks by itself, at reading speed", async () => {
    const { runner, gw } = await war("GBR", "GWT3");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    const said = () => seatOf(runner).table!.lines.length;
    const at = said();
    step(runner, 3);
    expect(said()).toBe(at);
    step(runner, 60);
    expect(said()).toBeGreaterThan(at);
  });

  test("a winner's fair claim passes; a loser's capital doesn't", async () => {
    const { runner, gw } = await war("GBR", "GWT4");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    untilDue(runner);
    expect(seatOf(runner).table!.due?.kind).toBe("turn");
    order(runner, { kind: "table_claim", place: "metz" });
    order(runner, { kind: "table_next" });
    step(runner, 2);
    const c = gw.s.table!.claims.find((x) => x.place === "metz")!;
    expect(c.against).toBe("DEU");
    expect(c.state).toBe("agreed");
    untilDue(runner);
    order(runner, { kind: "table_claim", place: "berlin" });
    order(runner, { kind: "table_next" });
    untilDue(runner);
    const b = gw.s.table!.claims.find((x) => x.place === "berlin")!;
    expect(b.state).toBe("open");
    expect(b.step).toBe("refused");
    const due = seatOf(runner).table!.due;
    expect(due?.kind === "word" && due.words).toContain("press");
  });

  test("a claim can't be made out of turn, on a neutral, or twice", async () => {
    const { runner, gw } = await war("GBR", "GWT5");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    order(runner, { kind: "table_claim", place: "metz" });
    expect(gw.s.table!.claims.some((c) => c.by === "GBR")).toBe(false);
    untilDue(runner);
    order(runner, { kind: "table_claim", place: "athens" });
    expect(gw.s.table!.claims.some((c) => c.place === "athens")).toBe(false);
  });

  test("a loser can refuse, at a price; past the winner's patience it is taken", async () => {
    const { runner, gw } = await war("DEU", "GWT6");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    const bread = gw.nation("DEU")!.gauges.bread;
    const words: string[] = [];
    for (let i = 0; i < 300 && !seatOf(runner).table!.done; i++) {
      const due = seatOf(runner).table!.due;
      if (due?.kind === "word") {
        words.push(...due.words);
        order(runner, {
          kind: "table_word",
          claim: due.claim,
          word: due.words.includes("no") ? "no" : "drop",
          trade: null,
        });
      } else if (due?.kind === "turn") {
        order(runner, { kind: "table_pass" });
      } else {
        order(runner, { kind: "table_next" });
      }
    }
    const t = gw.s.table!;
    expect(words).toContain("no");
    expect(t.held.DEU).toBeGreaterThan(0);
    expect(gw.nation("DEU")!.gauges.bread).toBeLessThan(bread);
    expect(t.claims.some((c) => c.state === "imposed")).toBe(true);
  });

  test("a trade leaves the land where it is and goes on the bill", async () => {
    const { runner, gw } = await war("DEU", "GWT7");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    untilDue(runner);
    const due = seatOf(runner).table!.due!;
    expect(due.kind).toBe("word");
    if (due.kind !== "word") return;
    expect(due.words).toContain("offer");
    order(runner, {
      kind: "table_word",
      claim: due.claim,
      word: "offer",
      trade: "reparations",
    });
    const c = gw.s.table!.claims[due.claim];
    expect(c.offer).toBe("reparations");
    expect(c.offerBy).toBe("DEU");
    order(runner, { kind: "table_next" });
    step(runner, 2);
    expect(["traded", "open"]).toContain(c.state);
  });

  test("whatever the seats leave, the month ends and the treaty signs", async () => {
    const { runner, gw, seat } = await war("DEU", "GWT8");
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 5 + GW_AFTER_CHAPTERS);
    expect(gw.s.table!.closed).toBe(true);
    expect(gw.s.table!.claims.every((c) => c.state !== "open")).toBe(true);
    expect(seat.memoir?.map?.role).toBe("lost");
    expect(gw.s.ended).toBe("armistice_conference");
  });

  test("with nobody beaten a country asks at most for what it stands on", async () => {
    const { runner, gw } = await war("GBR", "GWT9");
    armistice(gw, "compromise", null);
    pass(gw, runner, 5);
    const t = gw.s.table!;
    expect(t.claims.filter((c) => c.by !== "GBR")).toEqual([]);
  });

  test("what a country was refused it doesn't ask for again next month", async () => {
    const { runner, gw } = await war("DEU", "GWT12");
    armistice(gw, "compromise", null);
    gw.s.held.togo = "FRA";
    pass(gw, runner, 3);
    const asked = gw.s.table!.claims.filter((c) => c.by === "FRA");
    expect(new Set(asked.map((c) => c.place)).size).toBe(asked.length);
  });

  test("a country that left a war its side won has no chair", async () => {
    const { runner, gw } = await war("RUS", "GWT10");
    gw.nation("RUS")!.out = true;
    armistice(gw, "central_lost", "DEU");
    pass(gw, runner, 1);
    expect(seatOf(runner).table!.role).toBe("watch");
    expect(seatOf(runner).table!.due).toBeNull();
  });

  test("the lines stop at the armistice: no front moves the map", async () => {
    const { runner, gw } = await war("DEU", "GWT11");
    pass(gw, runner, 2);
    armistice(gw, "compromise", null);
    pass(gw, runner, 1);
    const lines = gw.s.theatres.map((t) => t.progress);
    pass(gw, runner, 2);
    expect(gw.s.theatres.map((t) => t.progress)).toEqual(lines);
  });
});
