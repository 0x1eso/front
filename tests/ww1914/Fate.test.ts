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
import { capitulate } from "@openfront/engine/ww1914/Capitulation";
import {
  applyClaim,
  applyVassals,
  fateDo,
  fateStep,
  foundOnRule,
  laySettlePaper,
  realmViews,
} from "@openfront/engine/ww1914/Fate";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { holderOf, moveLand } from "@openfront/engine/ww1914/Land";
import { pairTableStep } from "@openfront/engine/ww1914/Table";
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
});
