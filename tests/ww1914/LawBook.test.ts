// The law book (ww203 §12): the vote by real seats, the agenda of three, a
// failed bill's lock and price, the confidence rule (Britain, France), and an
// Art. 87 decree facing the returned Duma. Real content, seats set by state.
import type {
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  gwLawStart,
  type GwLawState,
} from "@openfront/engine-api/ww1914/GwLaw";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import {
  GW_AGENDA_MAX,
  GW_FALL_HEAT,
  GW_LOCK_NARROW,
  GW_LOCK_WIDE,
  GW_LOST_WIDE,
} from "@openfront/engine-lib/ww1914/HouseRows";
import { govHeat } from "@openfront/engine/ww1914/Government";
import { GW_GOV } from "@openfront/engine/ww1914/GovTable";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { factionOf, houseStep } from "@openfront/engine/ww1914/House";
import { lawDraftable, lawStep } from "@openfront/engine/ww1914/Laws";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";

/** A seat of `tag` at war, a month-long chapter, its house started. */
async function atWar(tag: GwTag) {
  const made = await wwRunnerCapture(
    { greatWar1914: true, greatWar1914Calendar: "full" },
    [{ clientID: HUMAN, gwCountry: tag }],
    undefined,
    undefined,
    HUMAN,
  );
  step(made.runner, 2);
  const gw = made.runner.game.greatWar()!;
  const s = gw.s;
  s.warChapter = 0;
  s.dayShift = 800;
  s.day += 800;
  const { gwChapters } = await import("@openfront/engine-lib/ww1914/Calendars");
  s.chapter = gwChapters(s.calendar).findIndex((c) => c.spanDays >= 28) + 2;
  const seat = s.seats[0];
  const n = gw.nation(tag)!;
  n.authority = 80;
  const foe: Record<GwTag, GwTag> = {
    DEU: "FRA",
    AUH: "RUS",
    GBR: "DEU",
    FRA: "DEU",
    RUS: "DEU",
  } as Record<GwTag, GwTag>;
  n.atWar = [foe[tag]];
  n.side = tag === "DEU" || tag === "AUH" ? "central" : "entente";
  houseStep(gw);
  seat.desk = [];
  seat.scheduled = [];
  for (const f of seat.house!.factions) {
    f.heat = 0;
    f.step = 0;
    f.held = -1;
    f.asking = null;
  }
  return { gw, n, seat };
}

/** The bill on the agenda, waiting for the call; the chambers not yet sat. */
function onAgenda(
  gw: GreatWar,
  n: GwNationState,
  seat: GwSeatState,
  law: string,
): GwLawState {
  n.laws = n.laws.filter((x) => x.id !== law);
  const st: GwLawState = {
    ...gwLawStart(law),
    stage: "persuade",
    since: gw.s.chapter,
    text: GW_LAWS.find((r) => r.id === law)!.draft[0].id,
  };
  n.laws.push(st);
  seat.house!.sat = {};
  // Calm tempers: the last vote's heat doesn't carry into this one.
  for (const f of seat.house!.factions) {
    f.heat = 0;
    f.step = 0;
  }
  return st;
}

/** Real seats for the factions named; every other faction out of the house. */
function seats(
  seat: GwSeatState,
  chamber: string,
  by: Readonly<Record<string, number>>,
) {
  for (const f of seat.house!.factions) {
    f.status = by[f.id] === undefined ? "out" : "in";
    f.seats = by[f.id] === undefined ? null : { [chamber]: by[f.id] };
  }
}

const vote = (
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  confidence = false,
) => applyGwOrder(gw, seat, { kind: "bill_vote", law, confidence });

/** Every faction of the house turned against (temper 2). */
function allAgainst(seat: GwSeatState) {
  for (const f of seat.house!.factions) f.step = 2;
}

const billOf = (tag: GwTag) =>
  (gwContent().bills ?? []).find(
    (b) =>
      GW_LAWS.find((l) => l.id === b.law)?.tag === tag &&
      b.by === undefined &&
      b.houses === undefined,
  )!.law;

describe("the vote by real seats", () => {
  test("the 1917 Reichstag carries the Peace Resolution with SPD, Centre and Progressives; not without the Centre", async () => {
    const { gw, n, seat } = await atWar("DEU");
    n.inst.reichstag = 0;
    const law = "deu_peace_res";
    // 1912 seats; the right and the National Liberals against.
    seats(seat, "reichstag", {
      deu_cons: 75,
      deu_natlib: 45,
      deu_centre: 90,
      deu_progress: 41,
      deu_spd: 110,
      deu_minor: 33,
    });
    onAgenda(gw, n, seat, law);
    expect(vote(gw, seat, law)).toBe(null);
    const b = seat.house!.last!.ballot!;
    expect(b.law).toBe(law);
    expect(b.pass).toBe(true);
    const sum = (cast: string) =>
      b.chambers[0].blocks
        .filter((x) => x.cast === cast)
        .reduce((k, x) => k + x.seats, 0);
    expect([sum("for"), sum("against")]).toEqual([274, 120]);
    expect(b.chambers[0].size).toBe(397);
    // The government's friends cast first.
    expect(b.chambers[0].blocks[0].cast).toBe("for");
    expect(n.laws.find((x) => x.id === law)!.stage).toBe("force");

    // Away seats don't count: the National Liberals held away, it still passes
    // and their 45 are on the empty benches, not against.
    onAgenda(gw, n, seat, law);
    factionOf(seat, "deu_natlib")!.held = gw.s.chapter + 1;
    expect(vote(gw, seat, law)).toBe(null);
    const away = seat.house!.last!.ballot!.chambers[0].blocks.find(
      (x) => x.faction === "deu_natlib",
    )!;
    expect([away.cast, away.seats]).toEqual(["away", 45]);
    factionOf(seat, "deu_natlib")!.held = -1;

    // The Centre turned against: 184 to 210, it fails.
    onAgenda(gw, n, seat, law);
    factionOf(seat, "deu_centre")!.step = 2;
    expect(vote(gw, seat, law)).toBe(null);
    expect(seat.house!.last!.ballot!.pass).toBe(false);
    expect(n.laws.find((x) => x.id === law)!.stage).toBe("idle");
  });
});

describe("the agenda", () => {
  test("takes three, refuses a fourth; a failed bill locks its article and costs authority", async () => {
    const { gw, n, seat } = await atWar("DEU");
    const open = GW_LAWS.filter(
      (r) => r.tag === "DEU" && lawDraftable(gw, seat, r.id),
    );
    expect(open.length).toBeGreaterThan(GW_AGENDA_MAX);
    for (const r of open.slice(0, GW_AGENDA_MAX)) onAgenda(gw, n, seat, r.id);
    const fourth = open[GW_AGENDA_MAX].id;
    expect(applyGwOrder(gw, seat, { kind: "bill_submit", law: fourth })).toBe(
      "agenda_full",
    );
    // A house bill of the three, lost wide: locked six chapters, ten of authority.
    const law = open
      .slice(0, GW_AGENDA_MAX)
      .find((r) => (gwContent().bills ?? []).some((b) => b.law === r.id))!.id;
    allAgainst(seat);
    const before = n.authority;
    expect(vote(gw, seat, law)).toBe(null);
    const st = n.laws.find((x) => x.id === law)!;
    expect(st.stage).toBe("idle");
    expect(st.lockTo).toBe(gw.s.chapter + GW_LOCK_WIDE);
    expect(n.authority).toBe(before - GW_LOST_WIDE);
    expect(seat.house!.last!.band).toBe("lost_wide");
    // One vote a chamber a chapter, and the article waits.
    expect(vote(gw, seat, open[1].id === law ? open[0].id : open[1].id)).toBe(
      "recess",
    );
    expect(applyGwOrder(gw, seat, { kind: "bill_submit", law })).toBe(
      "law_locked",
    );
    expect(GW_LOCK_NARROW).toBeLessThan(GW_LOCK_WIDE);
  });
});

describe("a confidence matter", () => {
  test("Britain loses wide: the cabinet's fall row heats", async () => {
    const { gw, n, seat } = await atWar("GBR");
    const law = billOf("GBR");
    onAgenda(gw, n, seat, law);
    allAgainst(seat);
    const was = govHeat(seat, "gbr_table");
    expect(vote(gw, seat, law)).toBe(null);
    expect(govHeat(seat, "gbr_table")).toBe(was + GW_FALL_HEAT);
  });

  test("France loses a question of confidence: the chamber row takes a step", async () => {
    const { gw, n, seat } = await atWar("FRA");
    const law = billOf("FRA");
    onAgenda(gw, n, seat, law);
    allAgainst(seat);
    const row = GW_GOV.find((r) => r.id === "fra_chamber")!;
    const was = govHeat(seat, "fra_chamber");
    const next = row.steps.find((x) => x.at > was)!.at;
    expect(vote(gw, seat, law, true)).toBe(null);
    expect(govHeat(seat, "fra_chamber")).toBeGreaterThanOrEqual(next);
  });
});

describe("Article 87", () => {
  test("a decree made while the Duma is away lapses when the returned Duma votes it down", async () => {
    const { gw, n, seat } = await atWar("RUS");
    const law = "rus_press";
    seat.flags = seat.flags.filter((f) => f !== "f_gov_rus_session");
    onAgenda(gw, n, seat, law);
    expect(applyGwOrder(gw, seat, { kind: "bill_round", law })).toBe(null);
    const st = n.laws.find((x) => x.id === law)!;
    expect([st.stage, st.how, st.faces]).toEqual(["force", "decreed", -2]);
    // The Duma sits again: the decree goes on the agenda to be confirmed.
    seat.flags.push("f_gov_rus_session");
    gw.s.chapter++;
    lawStep(gw);
    expect(st.stage).toBe("persuade");
    expect(st.kept).not.toBe(null);
    expect(st.faces).toBe(gw.s.chapter + 2);
    // Meanwhile it is still the law; voted down, it lapses.
    allAgainst(seat);
    seat.house!.sat = {};
    expect(vote(gw, seat, law)).toBe(null);
    expect([st.stage, st.how, st.kept]).toEqual(["idle", "repealed", null]);
  });
});
