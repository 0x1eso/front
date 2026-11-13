// ww210 S2: bargaining in the lobby (design ww209 §3, §7 case 4): a counter-
// offer taken, a promise with a short deadline broken (trust, shut, betray),
// a favour owed called in and refused, a threat bluffed, a wing peeled until
// it leaves, and word getting round. Real content, seats set by state.
import type {
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  gwLawStart,
  type GwLawState,
} from "@openfront/engine-api/ww1914/GwLaw";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import type { GwWingRow } from "@openfront/engine-lib/ww1914/HouseRows";
import { keepTableDue } from "@openfront/engine/ww1914/Bargain";
import {
  dealStep,
  dealsDossierView,
  markGiven,
} from "@openfront/engine/ww1914/Deals";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  factionOf,
  factionRow,
  houseStep,
  lobbyViews,
} from "@openfront/engine/ww1914/House";
import { moneyDo } from "@openfront/engine/ww1914/MoneyBills";
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
  n.atWar = ["DEU"];
  n.side = "entente";
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

/** The bill on the agenda, waiting for the call; tempers calm. */
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
  seat.house!.calls = 9;
  for (const f of seat.house!.factions) {
    f.heat = 0;
    f.step = 0;
  }
  return st;
}

const order = (gw: GreatWar, seat: GwSeatState, o: object) =>
  applyGwOrder(gw, seat, o as Parameters<typeof applyGwOrder>[2]);

const lobby = (gw: GreatWar, seat: GwSeatState, law: string, f: string) =>
  lobbyViews(gw, seat, law).find((l) => l.faction === f)!;

const summon = (gw: GreatWar, seat: GwSeatState, law: string, f: string) =>
  expect(order(gw, seat, { kind: "bill_lobby", law, faction: f })).toBe(null);

const trust = (seat: GwSeatState, id: string) =>
  factionOf(seat, id)!.trust ?? factionRow(id)!.trust ?? 0;

const LAW = "gbr_conscription";

describe("ww210: bargaining in the lobby", () => {
  test("a counter taken; a short deadline broken; a favour owed called in", async () => {
    const { gw, n, seat } = await atWar("GBR");
    const st = onAgenda(gw, n, seat, LAW);
    // He named his own text: offering it back is what he asked, so he takes it.
    summon(gw, seat, LAW, "gbr_liberals");
    expect(lobby(gw, seat, LAW, "gbr_liberals").counters).toContain("text");
    const counter = {
      kind: "bill_counter",
      law: LAW,
      faction: "gbr_liberals",
      counter: "text",
      pick: null,
    };
    expect(order(gw, seat, counter)).toBe(null);
    const lib = lobby(gw, seat, LAW, "gbr_liberals");
    expect(lib.counter).toMatchObject({ kind: "text", answer: "take" });
    expect(lib.deal).toBe(true);
    expect(st.deals).toContain("gbr_liberals");
    expect(seat.desk.some((c) => c.scene === "gw_lb_gbr_liberals")).toBe(false);

    // A promise within this session (3 chapters), taken from the Unionists.
    summon(gw, seat, LAW, "gbr_unionists");
    const price = lobby(gw, seat, LAW, "gbr_unionists").prices!.find(
      (p) => p.terms?.includes("session") === true,
    )!;
    const term = {
      kind: "bill_term",
      law: LAW,
      faction: "gbr_unionists",
      want: price.id,
      term: "session",
    };
    expect(order(gw, seat, term)).toBe(null);
    const p = seat.promises.find(
      (x) => x.key === `house_gbr_unionists_${LAW}`,
    )!;
    expect([p.term, p.faction, p.due]).toEqual([
      "session",
      "gbr_unionists",
      gw.s.chapter + 3,
    ]);
    // Broken: trust -2 at the month, his door shut, his faction betrays.
    const before = trust(seat, "gbr_unionists");
    p.broken = true;
    houseStep(gw);
    expect(trust(seat, "gbr_unionists")).toBe(before - 2);
    expect(lobby(gw, seat, LAW, "gbr_unionists").shut).toBe("broken");
    expect(
      order(gw, seat, { kind: "bill_vote", law: LAW, confidence: false }),
    ).toBe(null);
    const blocks = seat.house!.last!.ballot!.chambers.flatMap((c) => c.blocks);
    expect(
      blocks.some((b) => b.faction === "gbr_unionists" && b.beat === "betray"),
    ).toBe(true);

    // 빚으로 남긴다: the Irish paid now, no vote asked; called in later.
    const next = onAgenda(gw, n, seat, "gbr_munitions");
    summon(gw, seat, "gbr_munitions", "gbr_irish");
    const irish = lobby(gw, seat, "gbr_munitions", "gbr_irish");
    expect(irish.favour?.can).toBe(true);
    const owe = {
      kind: "bill_favour",
      law: "gbr_munitions",
      faction: "gbr_irish",
      want: irish.prices![0].id,
      call: false,
    };
    expect(order(gw, seat, owe)).toBe(null);
    expect(next.deals).not.toContain("gbr_irish");
    expect(lobby(gw, seat, "gbr_munitions", "gbr_irish").favour?.owes).toBe(
      true,
    );
    const call = { ...owe, want: null, call: true };
    expect(order(gw, seat, call)).toBe(null);
    expect(next.deals).toContain("gbr_irish");
    expect(seat.house!.deals2!.map((d) => [d.kind, d.fate])).toEqual([
      ["owe", "called"],
    ]);
    const box = dealsDossierView(gw, seat, { files: [], asks: [] })!.deals!;
    expect(box.map((d) => [d.kind, d.faction, d.fate])).toEqual([
      ["owe", "gbr_irish", "called"],
    ]);
  });

  test("a favour refused when called; the next threat on him is free; a threat bluffed", async () => {
    const { gw, n, seat } = await atWar("GBR");
    onAgenda(gw, n, seat, LAW);
    applyGwOrder(gw, seat, {
      kind: "bill_lobby",
      law: LAW,
      faction: "gbr_labour",
    });
    const want = lobby(gw, seat, LAW, "gbr_labour").prices![0].id;
    expect(
      order(gw, seat, {
        kind: "bill_favour",
        law: LAW,
        faction: "gbr_labour",
        want,
        call: false,
      }),
    ).toBe(null);
    // He has turned cold: called in, he refuses, and the favour is gone.
    const labour = factionOf(seat, "gbr_labour")!;
    labour.trust = -2;
    const call = {
      kind: "bill_favour",
      law: LAW,
      faction: "gbr_labour",
      want: null,
      call: true,
    };
    expect(order(gw, seat, call)).toBe(null);
    expect(seat.house!.deals2![0].fate).toBe("refused");
    expect(order(gw, seat, call)).toBe("no_favour");
    // The next threat on him costs no trust.
    const threats = lobby(gw, seat, LAW, "gbr_labour").threats!;
    expect(threats).toContain("condemn");
    const threat = {
      kind: "bill_threat",
      law: LAW,
      faction: "gbr_labour",
      threat: "condemn",
    };
    expect(order(gw, seat, threat)).toBe(null);
    expect(labour.trust).toBe(-2);
    // His faction votes against all the same; the threat is not carried out.
    labour.step = 2;
    expect(
      order(gw, seat, { kind: "bill_vote", law: LAW, confidence: false }),
    ).toBe(null);
    dealStep(gw);
    const d = seat.house!.deals2!.find((x) => x.kind === "threat")!;
    expect(d.due).toBe(gw.s.chapter + 2);
    gw.s.chapter += 3;
    const authority = n.authority;
    dealStep(gw);
    expect(d.fate).toBe("bluffed");
    expect(n.authority).toBe(authority - 5);
    // Threats are void on his bloc for a while.
    onAgenda(gw, n, seat, "gbr_munitions");
    expect(lobby(gw, seat, "gbr_munitions", "gbr_labour").threats).toEqual([]);
  });

  test("a wing met apart votes for on its own; met twice, it leaves", async () => {
    const { gw, n, seat } = await atWar("GBR");
    const row = factionRow("gbr_liberals")! as { wing?: GwWingRow };
    const lib = factionOf(seat, "gbr_liberals")!;
    row.wing = {
      person: lib.leader!,
      ideals: { class: 1 },
      share: 3,
    };
    try {
      onAgenda(gw, n, seat, LAW);
      const peel = (law: string, want: string | null) =>
        order(gw, seat, {
          kind: "bill_peel",
          law,
          faction: "gbr_liberals",
          want,
        });
      expect(lobby(gw, seat, LAW, "gbr_liberals").wing?.call).toBe(true);
      expect(peel(LAW, null)).toBe(null);
      const wing = lobby(gw, seat, LAW, "gbr_liberals").wing!;
      expect(wing.prices!.length).toBeGreaterThan(0);
      expect(peel(LAW, wing.prices![0].id)).toBe(null);
      expect(lobby(gw, seat, LAW, "gbr_liberals").wing?.peeled).toBe(true);
      expect([lib.split, lib.peels?.length]).toEqual([1, 1]);
      lib.step = 2;
      expect(
        order(gw, seat, { kind: "bill_vote", law: LAW, confidence: false }),
      ).toBe(null);
      const commons = seat.house!.last!.ballot!.chambers.find(
        (c) => c.chamber === "commons",
      )!;
      const mine = commons.blocks.filter((b) => b.faction === "gbr_liberals");
      expect(mine.some((b) => b.cast === "for" && b.beat === "swing")).toBe(
        true,
      );
      expect(mine.some((b) => b.cast === "against")).toBe(true);
      // Again on another bill within the year: the wing leaves.
      const had = (lib.seats ?? factionRow("gbr_liberals")!.seats)!.commons!;
      onAgenda(gw, n, seat, "gbr_munitions");
      expect(peel("gbr_munitions", null)).toBe(null);
      const again = lobby(gw, seat, "gbr_munitions", "gbr_liberals").wing!;
      expect(peel("gbr_munitions", again.prices![0].id)).toBe(null);
      expect(lib.peels).toEqual([]);
      expect(lib.seats!.commons!).toBeLessThan(had);
    } finally {
      delete row.wing;
    }
  });

  test("word gets round: two promises broken to a bloc, its leaders take only what is paid now", async () => {
    const { gw, n, seat } = await atWar("GBR");
    onAgenda(gw, n, seat, LAW);
    for (const law of ["x1", "x2"]) {
      seat.promises.push({
        key: `house_gbr_unionists_${law}`,
        who: "gbr_bonar_law",
        // Past the door's shutting, still within the word's year.
        due: gw.s.chapter - 7,
        kept: false,
        broken: true,
        keep: null,
        back: null,
      });
    }
    summon(gw, seat, LAW, "gbr_unionists");
    const v = lobby(gw, seat, LAW, "gbr_unionists");
    expect(v.paidOnly).toBe(true);
    expect(
      v.prices!.every((p) => ["money", "concession"].includes(p.kind)),
    ).toBe(true);
    expect(v.counters).not.toContain("favour");
    // One kept after them clears it.
    seat.promises.push({
      key: "house_gbr_unionists_x3",
      who: "gbr_bonar_law",
      due: gw.s.chapter + 3,
      kept: true,
      broken: false,
      keep: null,
      back: null,
    });
    expect(lobby(gw, seat, LAW, "gbr_unionists").paidOnly).toBe(false);
  });

  test("ww210 merge: money for his region kept a year or cut and broken; a table promise outlives its table", async () => {
    const { gw, seat } = await atWar("GBR");
    const ctx = { gw, seat, cast: {} };
    const rows = () => seat.house!.deals2 ?? [];
    // Kept a year in the budget: kept, +1 trust.
    moneyDo(ctx, { do: "earmark", id: "gbr_irish_land", on: true });
    markGiven(gw, seat, "gbr_irish", "gbr_irish_land", null);
    const before = trust(seat, "gbr_irish");
    gw.s.chapter += 13;
    dealStep(gw);
    expect(rows()[rows().length - 1]).toMatchObject({
      kind: "mark",
      fate: "kept",
    });
    expect(trust(seat, "gbr_irish")).toBe(before + 1);
    // Cut from the budget before the year is out: broken, -2.
    moneyDo(ctx, { do: "earmark", id: "gbr_ulster_division", on: true });
    markGiven(gw, seat, "gbr_unionists", "gbr_ulster_division", null);
    const had = trust(seat, "gbr_unionists");
    moneyDo(ctx, { do: "earmark", id: "gbr_ulster_division", on: false });
    dealStep(gw);
    expect(rows()[rows().length - 1]).toMatchObject({
      kind: "mark",
      mark: "gbr_ulster_division",
      fate: "broken",
    });
    expect(trust(seat, "gbr_unionists")).toBe(had - 2);
    // The notebook's box shows with no files or asks.
    expect(dealsDossierView(gw, seat, undefined)!.deals![0].mark).toBe(
      "gbr_ulster_division",
    );

    // A promise to leave, made at a table a new one replaced: still due.
    const deu = gw.nation("DEU")!;
    deu.atWar = ["GBR"];
    gw.s.table = {
      closed: true,
      claims: [
        {
          id: 1,
          place: "lille",
          by: "DEU",
          against: "GBR",
          session: 0,
          state: "agreed",
          step: "asked",
          offer: null,
          offerBy: null,
          offers: 0,
          pressed: false,
          move: "promise_leave",
          due: gw.s.chapter + 2,
        },
      ],
    } as never;
    keepTableDue(gw);
    gw.s.table = null;
    gw.s.chapter += 3;
    dealStep(gw);
    // At war again by its day: broken, and remembered.
    expect(seat.flags).toContain("f_revanche_deu");
    expect(gw.s.tableDue).toEqual([]);
  });
});
