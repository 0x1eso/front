// ww199: a beaten country's fate (design ww198 + the owner's vassal). On the
// real 1914 set, since the places are what move.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_MAP_TAGS,
  gwCountry,
  GwTag,
} from "@openfront/engine-api/ww1914/GwCountries";
import { gwRealmName } from "@openfront/engine-api/ww1914/GwFate";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwTableClaim } from "@openfront/engine-api/ww1914/GwTable";
import {
  GW_FATE_TERM_DAYS,
  gwSignPaperIds,
} from "@openfront/engine-lib/ww1914/FateRows";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  stepTalk,
  tableBargain,
  tablePropose,
  talkDue,
  talkView,
} from "@openfront/engine/ww1914/Bargain";
import { capitulate } from "@openfront/engine/ww1914/Capitulation";
import { openDepts } from "@openfront/engine/ww1914/Departments";
import {
  applyClaim,
  applyVassals,
  fateDo,
  fateStep,
  foundOnRule,
  laySettlePaper,
  realmViews,
  revancheOf,
} from "@openfront/engine/ww1914/Fate";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { holderOf, moveLand } from "@openfront/engine/ww1914/Land";
import { outMidWar } from "@openfront/engine/ww1914/Peace";
import { resistOf } from "@openfront/engine/ww1914/Rule";
import { closeTable, pairTableStep } from "@openfront/engine/ww1914/Table";
import {
  atWarWith,
  declareWar,
  enter,
  openGeneral,
} from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string): Promise<GreatWar> {
  const start = { ...startOf(id, "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  return gw;
}

/**
 * ww205: Romania gives up to a Germany the seat plays; its table waits for
 * the seat's whole proposal, painted: Bucharest annexed, the rest held.
 */
async function romaniaAtTheTable(
  id: string,
  opts: {
    all?: boolean;
    fates?: GwSeatState["fates"];
  } = {},
) {
  const start = startOf(id, "full", []);
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  openGeneral(gw, "DEU", "FRA", "test");
  enter(gw, "AUH", "central", "test");
  enter(gw, "ROU", "entente", "test");
  // ww217: `all`: every Romanian place held, so it gives up fully.
  const held = opts.all === true ? (["craiova", "constanta"] as const) : [];
  for (const p of ["bucharest", "ploesti", "iasi", ...held] as const) {
    moveLand(gw, p, "DEU", null, "occupation");
  }
  capitulate(gw, "ROU");
  const seat = gw.s.seats.find((x) => x.tag === "DEU")!;
  pairTableStep(gw);
  seat.fates = opts.fates ?? {
    bucharest: { fate: "annex" },
    iasi: { fate: "occupy", term: "short" },
    ploesti: { fate: "occupy", term: "long" },
  };
  expect(tablePropose(gw, seat)).toBeNull();
  // Nobody else waits on the seat: the beaten answers.
  stepTalk(gw, false);
  const t = gw.s.table!;
  const at = (p: GwPlace) => t.claims.find((c) => c.place === p)!;
  return { gw, seat, t, at };
}

/** The player that owns a tile of `place`, by tag. */
function ownerOnMap(gw: GreatWar, place: GwPlace): GwTag {
  const id = gw.world.places.get(place)!;
  gw.scenario.ensureRegionTiles(gw.mg.map());
  const tile = gw.scenario.regionTiles(id)[0];
  return gw.tagOf(gw.mg.map().ownerID(tile));
}

/** Romania in the war, its land held by the Central Powers, and it gives up. */
async function romaniaGivesUp(id: string): Promise<GreatWar> {
  const gw = await world(id);
  openGeneral(gw, "DEU", "FRA", "test");
  enter(gw, "AUH", "central", "test");
  enter(gw, "BGR", "central", "test");
  enter(gw, "ROU", "entente", "test");
  for (const p of ["bucharest", "ploesti", "iasi"] as const) {
    moveLand(gw, p, "DEU", null, "occupation");
  }
  moveLand(gw, "craiova", "AUH", null, "occupation");
  moveLand(gw, "constanta", "BGR", null, "occupation");
  capitulate(gw, "ROU");
  return gw;
}

const claim = (
  c: Partial<GwTableClaim> & Pick<GwTableClaim, "place" | "by" | "against">,
): GwTableClaim => ({
  id: 0,
  session: 0,
  state: "agreed",
  step: "asked",
  offer: null,
  offerBy: null,
  offers: 0,
  pressed: false,
  ...c,
});

describe("a beaten country's fate (ww199)", () => {
  test("Romania gives up mid-war: its own table opens at once with Germany, Austria-Hungary and Bulgaria, and the war goes on", async () => {
    const gw = await romaniaGivesUp("GWFATE1");
    expect(gw.nation("ROU")!.out).toBe(true);
    expect(gw.s.armistice).toBeNull();
    expect(gw.s.pairTables).toContainEqual(
      expect.objectContaining({
        a: "DEU",
        b: "ROU",
        winner: "DEU",
        with: ["AUH", "BGR"],
      }),
    );
    pairTableStep(gw);
    const t = gw.s.table!;
    expect(t.order).toEqual(["DEU", "AUH", "BGR", "ROU"]);
    // Nobody plays them: it talks and signs at once, and the land has fates.
    expect(t.closed).toBe(true);
    expect((gw.s.fates ?? []).length).toBeGreaterThan(0);
    expect(gw.nation("DEU")!.atWar).toContain("FRA");
  });

  test("a country that sues or falls at home mid-war gets its table too, once", async () => {
    const gw = await world("GWFATE7");
    openGeneral(gw, "DEU", "FRA", "test");
    enter(gw, "AUH", "central", "test");
    enter(gw, "ROU", "entente", "test");
    moveLand(gw, "bucharest", "DEU", null, "occupation");
    moveLand(gw, "craiova", "AUH", null, "occupation");
    outMidWar(gw, "ROU", "nation_collapsed");
    // Asked again for the same fall: still one table.
    capitulate(gw, "ROU");
    const rows = (gw.s.pairTables ?? []).filter((r) => r.b === "ROU");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ a: "DEU", winner: "DEU", with: ["AUH"] });
  });

  test("a founded Poland owns its places with its own player; no smallID of June 1914 moved", async () => {
    const gw = await world("GWFATE2");
    // The countries with land come first, in GW_TAGS order, as before ww199.
    const landed = gw.world.tags.slice(0, gw.world.landed);
    expect(landed).toEqual(GW_MAP_TAGS.filter((t) => landed.includes(t)));
    expect(gw.world.tags.indexOf("POL")).toBeGreaterThanOrEqual(
      gw.world.landed,
    );
    const ids = Object.fromEntries(
      landed.map((t) => [t, gw.world.tags.indexOf(t) + 1]),
    );
    openGeneral(gw, "DEU", "RUS", "test");
    for (const p of ["warsaw", "lodz", "lublin"] as const) {
      moveLand(gw, p, "DEU", null, "occupation");
    }
    foundOnRule(gw, "poland", "DEU");
    expect(ownerOnMap(gw, "warsaw")).toBe("POL");
    expect(holderOf(gw, "lodz")).toBe("POL");
    const pol = gw.nation("POL")!;
    expect(pol.client).toMatchObject({ id: "poland", by: "DEU" });
    expect(pol.side).toBe(gw.nation("DEU")!.side);
    expect(realmViews(gw)).toContainEqual(
      expect.objectContaining({ tag: "POL" }),
    );
    for (const t of landed) {
      expect(gw.world.tags.indexOf(t) + 1).toBe(ids[t]);
      expect(gw.mg.playerBySmallID(ids[t]).isPlayer()).toBe(true);
    }
  });

  test("military government for a term runs past the armistice and goes home at the end of it", async () => {
    const gw = await world("GWFATE3");
    openGeneral(gw, "DEU", "FRA", "test");
    moveLand(gw, "lille", "DEU", null, "occupation");
    moveLand(gw, "sedan", "DEU", null, "occupation");
    const c = claim({
      place: "lille",
      by: "DEU",
      against: "FRA",
      fate: "occupy",
      term: "short",
    });
    applyClaim(gw, c);
    const row = gw.s.rule!.find((r) => r.by === "DEU" && r.of === "FRA")!;
    expect(row.until).toBe(gw.s.day + GW_FATE_TERM_DAYS.short);
    gw.s.armistice = { kind: "entente_lost", chapter: gw.s.chapter, by: null };
    gw.s.day += 365;
    fateStep(gw);
    expect(holderOf(gw, "lille")).toBe("DEU");
    gw.s.day = row.until!;
    fateStep(gw);
    expect(holderOf(gw, "lille")).toBe("FRA");
    expect(ownerOnMap(gw, "lille")).toBe("FRA");
    expect(gw.s.news.some((n) => n.key === "fate_term_over")).toBe(true);
  });

  test("a hardline winner and a principled one leave different maps", async () => {
    const hard = await romaniaGivesUp("GWFATE4");
    const soft = await romaniaGivesUp("GWFATE4");
    for (const tag of ["DEU", "AUH", "BGR"] as const) {
      hard.nation(tag)!.ai = "hardline";
      soft.nation(tag)!.ai = "principled";
    }
    pairTableStep(hard);
    pairTableStep(soft);
    const kept = (gw: GreatWar) =>
      (gw.s.fates ?? []).filter((f) => f.fate !== "return").length;
    const mapOf = (gw: GreatWar) =>
      JSON.stringify({ held: gw.s.held, realms: realmViews(gw) });
    expect(kept(hard)).toBeGreaterThan(kept(soft));
    expect(mapOf(hard)).not.toEqual(mapOf(soft));
    // The principled winners take nothing for good.
    expect(
      (soft.s.fates ?? []).some(
        (f) => f.fate === "annex" || f.fate === "occupy",
      ),
    ).toBe(false);
  });

  test("a vassal keeps the beaten country's colour, is named as the victor's dependency, and follows it into war", async () => {
    const gw = await world("GWFATE5");
    moveLand(gw, "lille", "DEU", null, "occupation");
    applyVassals(gw, [
      claim({ place: "lille", by: "DEU", against: "FRA", fate: "vassal" }),
    ]);
    // Lille goes to France's slot, in France's colour and flag.
    expect(ownerOnMap(gw, "lille")).toBe("VFR");
    expect(gwCountry("VFR").color).toEqual(gwCountry("FRA").color);
    expect(gwCountry("VFR").flag).toBe(gwCountry("FRA").flag);
    const realm = realmViews(gw).find((r) => r.tag === "VFR")!;
    expect(realm.vassal).toEqual({ by: "DEU", of: "FRA" });
    expect(gwRealmName(realm)?.key).toBe("gw.vassal.DEU_FRA");
    // France itself stays France.
    expect(gw.nation("FRA")!.vassal).toBeUndefined();
    // Germany goes to war; its vassal goes with it.
    gw.s.chapter++;
    expect(declareWar(gw, "DEU", "NLD", "test")).toBe(true);
    fateStep(gw);
    expect(atWarWith(gw, "VFR", "NLD")).toBe(true);
  });

  test("the overlord's papers move a vassal's loyalty, and a settle paper is laid once", async () => {
    const gw = await world("GWFATE6");
    moveLand(gw, "lille", "DEU", null, "occupation");
    applyVassals(gw, [
      claim({ place: "lille", by: "DEU", against: "FRA", fate: "vassal" }),
    ]);
    const v = gw.nation("VFR")!.vassal!;
    const [loyalty, resist] = [v.loyalty, v.resist];
    const seat = {
      tag: "DEU",
      scheduled: [],
      desk: [],
    } as unknown as GwSeatState;
    fateDo(gw, seat, { do: "loyalty", of: "FRA", by: -1, resist: 1 });
    expect(v.loyalty).toBe(loyalty - 1);
    expect(v.resist).toBe(Math.min(3, resist + 1));
    // Another country's papers don't reach it.
    const fra = {
      tag: "FRA",
      scheduled: [],
      desk: [],
    } as unknown as GwSeatState;
    fateDo(gw, fra, { do: "loyalty", by: 2 });
    expect(v.loyalty).toBe(loyalty - 1);
    // The treaty card: the seat's own, once however often the table asks.
    expect(laySettlePaper(gw, seat, gwSignPaperIds("DEU"))).toBe(true);
    expect(laySettlePaper(gw, seat, gwSignPaperIds("DEU"))).toBe(true);
    expect(seat.scheduled.map((q) => q.scene)).toEqual(["deu_settle_sign"]);
  });

  test("ww205: a whole proposal gets an answer for every place, and the capital is refused", async () => {
    const { t, at } = await romaniaAtTheTable("GWTALK1");
    const mine = t.claims.filter((c) => c.by === "DEU");
    expect(mine.map((c) => c.place).sort()).toEqual([
      "bucharest",
      "iasi",
      "ploesti",
    ]);
    for (const c of mine) {
      expect(c.round).toBe(1);
      expect(c.why).toBeDefined();
    }
    expect(at("bucharest")).toMatchObject({
      state: "open",
      step: "refused",
      why: "capital",
    });
    // The softer fates are taken as they are.
    expect(at("iasi").state).toBe("agreed");
    expect(t.lines.some((l) => l.word === "propose" && l.who === "DEU")).toBe(
      true,
    );
  });

  test("ww205: stepping down from annexing the refused capital gets it accepted", async () => {
    const { gw, seat, t, at } = await romaniaAtTheTable("GWTALK2");
    // A hard government, but a broken people: it bears a military one.
    expect(gw.nation("ROU")!.ai).toBe("hardline");
    gw.nation("ROU")!.gauges.morale = 2;
    const id = at("bucharest").id;
    expect(
      tableBargain(gw, seat, [{ claim: id, move: "down", place: null }]),
    ).toBeNull();
    expect(at("bucharest")).toMatchObject({ fate: "occupy", round: 2 });
    stepTalk(gw, false);
    expect(at("bucharest").state).toBe("agreed");
    // Fixed, not yet moved: the treaty applies it when signed.
    expect(t.closed).toBe(false);
  });

  test("ww205: insisting past what the beaten bears makes it walk out, and the war goes on", async () => {
    const { gw, seat, t, at } = await romaniaAtTheTable("GWTALK3");
    gw.nation("ROU")!.ai = "hardline";
    const id = at("bucharest").id;
    for (let i = 0; i < 3 && !t.closed; i++) {
      expect(
        tableBargain(gw, seat, [{ claim: id, move: "insist", place: null }]),
      ).toBeNull();
      stepTalk(gw, false);
    }
    expect(t.closed).toBe(true);
    expect(gw.s.walkedOut).toEqual(["ROU"]);
    expect(t.lines.some((l) => l.word === "walk" && l.who === "ROU")).toBe(
      true,
    );
    expect(gw.nation("ROU")!.out).toBe(false);
    expect(atWarWith(gw, "DEU", "ROU")).toBe(true);
    // No treaty: nothing agreed moved, and Germany still holds what it held.
    expect(holderOf(gw, "iasi")).toBe("DEU");
    expect((gw.s.fates ?? []).some((f) => f.of === "ROU")).toBe(false);
  });

  test("ww216: once the table has risen no settlement choice comes: the waiting answer and the draft at work are withdrawn with a note", async () => {
    const settlePapers = (seat: GwSeatState, form: string) =>
      [...seat.desk, ...(seat.depts?.tray ?? [])].filter(
        (c) =>
          c.paper?.form === form &&
          "type" in c.paper &&
          c.paper.type === "settle",
      );
    const signs = (seat: GwSeatState) =>
      [...seat.scheduled, ...seat.desk].filter((q) =>
        gwSignPaperIds("DEU").includes(q.scene),
      );
    // The answer came while the table sat; the table signs before it is picked.
    const a = await romaniaAtTheTable("GWSETTLE1");
    expect(a.seat.depts!.tasks.map((x) => [x.type, x.topic])).toContainEqual([
      "settle",
      "ROU",
    ]);
    expect(signs(a.seat)).toHaveLength(1);
    a.gw.s.chapter++;
    openDepts(a.gw, a.seat);
    expect(settlePapers(a.seat, "answer")).toHaveLength(1);
    closeTable(a.gw);
    expect(a.t.closed).toBe(true);
    expect(settlePapers(a.seat, "answer")).toHaveLength(0);
    expect(settlePapers(a.seat, "stall")).toEqual([
      expect.objectContaining({
        paper: expect.objectContaining({ reason: "moot", topic: "ROU" }),
      }),
    ]);
    expect(signs(a.seat)).toHaveLength(0);
    // The draft still at work when the table rose: withdrawn, no answer later.
    const b = await romaniaAtTheTable("GWSETTLE2");
    closeTable(b.gw);
    expect(b.t.closed).toBe(true);
    expect(b.seat.depts!.tasks.some((x) => x.type === "settle")).toBe(false);
    expect(settlePapers(b.seat, "stall")).toHaveLength(1);
    b.gw.s.chapter++;
    openDepts(b.gw, b.seat);
    expect(settlePapers(b.seat, "answer")).toHaveLength(0);
    expect(signs(b.seat)).toHaveLength(0);
  });

  test("ww210: an ultimatum refused brings the advance back; a ransom keeps the land for money", async () => {
    const hard = await romaniaAtTheTable("GWTALK4");
    const cap = hard.at("bucharest").id;
    const due = talkDue(hard.gw, hard.seat);
    expect(due?.kind === "bargain" && due.moves?.[cap]).toEqual(
      expect.arrayContaining(["ultimatum", "ransom", "promise_leave"]),
    );
    // The capital is never annexed, whatever is threatened: the war resumes.
    expect(
      tableBargain(hard.gw, hard.seat, [
        { claim: cap, move: "ultimatum", place: null },
      ]),
    ).toBeNull();
    stepTalk(hard.gw, false);
    expect(hard.t.closed).toBe(true);
    expect(atWarWith(hard.gw, "DEU", "ROU")).toBe(true);

    const { gw, seat, t, at } = await romaniaAtTheTable("GWTALK5");
    gw.nation("ROU")!.gauges.money = 3;
    const id = at("bucharest").id;
    expect(
      tableBargain(gw, seat, [{ claim: id, move: "ransom", place: null }]),
    ).toBeNull();
    stepTalk(gw, false);
    expect(at("bucharest")).toMatchObject({
      state: "traded",
      move: "ransom",
      ransom: 3,
      offer: "reparations",
    });
    expect(t.bill.ROU).toBe(3);
  });
  test("ww217: a fully capitulated loser only protests; a protest blocks nothing, and pushing it through costs more over time", async () => {
    // Its capital and every place held: Romania gives up fully.
    const { gw, seat, t, at } = await romaniaAtTheTable("GWFULL1", {
      all: true,
      fates: {
        bucharest: { fate: "occupy", term: "long" },
        ploesti: { fate: "annex" },
        iasi: { fate: "annex" },
        craiova: { fate: "annex" },
        constanta: { fate: "annex" },
      },
    });
    expect(t.talk!.full).toBe(true);
    expect(talkView(gw)).toMatchObject({ full: true, mood: "bowed" });
    expect(at("bucharest").state).toBe("agreed");
    const protested = ["constanta", "craiova", "iasi", "ploesti"] as const;
    for (const p of protested) {
      expect(at(p)).toMatchObject({ state: "open", step: "refused" });
      expect(at(p).protest).toBe(true);
      // Its reasons are its own, never an army or allies it no longer has.
      expect(["army", "allies"]).not.toContain(at(p).why);
    }
    expect(t.lines.some((l) => l.word === "protest" && l.who === "ROU")).toBe(
      true,
    );
    // No veto to insist against: push it through, or ease the place.
    const due = talkDue(gw, seat);
    expect(due?.kind).toBe("bargain");
    expect(due?.kind === "bargain" && due.moves?.[at("iasi").id]).toEqual([
      "push",
      "down",
      "drop",
    ]);
    expect(
      tableBargain(gw, seat, [
        { claim: at("iasi").id, move: "insist", place: null },
      ]),
    ).toBe("table_no");
    expect(
      tableBargain(gw, seat, [
        { claim: at("iasi").id, move: "push", place: null },
        { claim: at("ploesti").id, move: "push", place: null },
        { claim: at("constanta").id, move: "push", place: null },
        { claim: at("craiova").id, move: "down", place: null },
      ]),
    ).toBeNull();
    for (const p of ["iasi", "ploesti", "constanta"] as const) {
      expect(at(p)).toMatchObject({ state: "imposed", move: "push" });
    }
    // However hard it was pushed, it never walks out.
    t.talk!.strain.ROU = 99;
    stepTalk(gw, false);
    expect(t.talk!.walked).toEqual([]);
    expect(at("craiova").fate).toBe("occupy");
    closeTable(gw);
    expect(t.closed).toBe(true);
    expect(gw.s.walkedOut ?? []).toEqual([]);
    expect(holderOf(gw, "iasi")).toBe("DEU");
    expect((gw.s.fates ?? []).find((f) => f.place === "iasi")?.fate).toBe(
      "annex",
    );
    const rows = gw.s.protests ?? [];
    expect(rows.map((r) => r.place).sort()).toEqual(
      expect.arrayContaining(["constanta", "iasi", "ploesti"]),
    );
    expect(rows.every((r) => r.by === "DEU" && r.of === "ROU")).toBe(true);
    // The costs build over the months that follow, then stop.
    const neutral = gw.s.nations.find(
      (n) => n.side === null && !n.out && n.tag !== "USA",
    )!;
    const usa = gw.nation("USA")!;
    const before = {
      ready: usa.readiness,
      trust: neutral.trust.DEU ?? 0,
      revanche: revancheOf(gw, "ROU", "DEU"),
      resist: resistOf(gw, "DEU", "ROU"),
    };
    for (let i = 0; i < 24; i++) {
      gw.s.chapter++;
      fateStep(gw);
    }
    expect(rows.every((r) => r.weight === 3)).toBe(true);
    expect(usa.readiness).toBeGreaterThan(before.ready);
    expect(neutral.trust.DEU ?? 0).toBeLessThan(before.trust);
    expect(revancheOf(gw, "ROU", "DEU")).toBeGreaterThan(before.revanche);
    expect(resistOf(gw, "DEU", "ROU")).toBeGreaterThan(before.resist);
    expect(seat.log.some((l) => l.key === "table_protest_builds")).toBe(true);
  });

  test("ww217: a conditional loser can still refuse and walk out; the war resumes and the next terms are harsher", async () => {
    const { gw, seat, t, at } = await romaniaAtTheTable("GWCOND1");
    // Its army and allies still in being: a conditional peace, with a veto.
    expect(t.talk!.full).toBeUndefined();
    const first = Object.fromEntries(
      t.claims.filter((c) => c.by === "DEU").map((c) => [c.place, c.fate]),
    );
    expect(first).toMatchObject({ iasi: "occupy", ploesti: "occupy" });
    expect(at("bucharest")).toMatchObject({ step: "refused", why: "capital" });
    expect(at("bucharest").protest).toBeUndefined();
    const id = at("bucharest").id;
    for (let i = 0; i < 3 && !t.closed; i++) {
      tableBargain(gw, seat, [{ claim: id, move: "insist", place: null }]);
      stepTalk(gw, false);
    }
    expect(t.closed).toBe(true);
    expect(gw.s.walkedOut).toEqual(["ROU"]);
    expect(atWarWith(gw, "DEU", "ROU")).toBe(true);
    expect(gw.nation("ROU")!.out).toBe(false);
    // The seat's terms come back a step harsher; the capital still unannexed.
    expect(seat.fates).toMatchObject({
      iasi: { fate: "occupy", term: "long" },
      ploesti: { fate: "annex" },
      bucharest: { fate: "annex" },
    });
    // It gives up again; the next table starts from the harder terms.
    capitulate(gw, "ROU");
    pairTableStep(gw);
    const t2 = gw.s.table!;
    expect(t2).not.toBe(t);
    expect(t2.talk!.full).toBeUndefined();
    expect(tablePropose(gw, seat)).toBeNull();
    const next = (p: GwPlace) =>
      t2.claims.find((c) => c.by === "DEU" && c.place === p)!;
    expect(next("iasi")).toMatchObject({ fate: "occupy", term: "long" });
    expect(next("ploesti").fate).toBe("annex");
  });
});
