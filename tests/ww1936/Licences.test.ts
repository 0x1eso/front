// World War 1936 P6 (plan Task 4, spec §7.1): production licences — the
// card a human licensor answers, the design copied as "licensed", the
// civilian factory fee outside a faction, the surcharge by the year gap,
// a static licence standing in for the techs, and the end that stops the
// lines. Numbers on human countries (plan decision 30).
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { LICENCE_CARD_TICKS } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  endLicence,
  grantLicence,
  licenceCostPctFor,
  licenceKeys,
} from "@openfront/engine/ww1936/depth/Licences";
import { dayCommonMarket } from "@openfront/engine/ww1936/depth/Market";
import type {
  DesignSlot,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

/**
 * Lane E's copyDesignTo is still the foundation's stub on this base (it
 * copies nothing): where it gives no slot, this stand-in copies the
 * design into the first free slot as the spec §5.6 path does. With lane
 * E merged the real copy answers first.
 */
vi.mock("@openfront/engine/ww1936/depth/DesignCopy", async (orig) => {
  const real =
    await orig<typeof import("@openfront/engine/ww1936/depth/DesignCopy")>();
  return {
    ...real,
    copyDesignTo: (
      d: WwDepth,
      from: number,
      slot: number,
      kind: "tank" | "ship" | "plane",
      to: number,
      origin: "own" | "captured" | "received" | "licensed",
    ): number | null => {
      const got = real.copyDesignTo(d, from, slot, kind, to, origin);
      if (got !== null) return got;
      const src = d.designSlot(from, kind, slot);
      const slots = d.country(to)?.des[kind];
      if (src === null || slots === undefined) return null;
      const i = slots.findIndex((s) => s === null);
      if (i < 0) return null;
      slots[i] = {
        def: JSON.parse(JSON.stringify(src.def)) as DesignSlot["def"],
        origin,
        from,
        fromSlot: slot,
        obsolete: false,
        savedDay: 0,
      };
      d.markDesign(to, kind, i + 1);
      return i + 1;
    },
  };
});

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const { DEU, ITA, FRA } = DEEP.tag;

async function deep(humans: ("DEU" | "ITA" | "FRA")[]) {
  const runner = await wwRunner(
    {},
    humans.map((country) => ({ clientID: `HUMAN${country}`, country })),
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const tick = runner.game.ticks();
  return { runner, ww, d: ww.depth, tick, day: ww.day(tick) };
}

function giveTank(d: WwDepth, id: number, slot: number, def: DesignDef): void {
  d.country(id)!.des.tank[slot - 1] = {
    def: def as DesignSlot["def"],
    origin: "own",
    from: 0,
    fromSlot: 0,
    obsolete: false,
    savedDay: 0,
  };
  d.markDesign(id, "tank", slot);
}

describe("World War 1936 P6: production licences", () => {
  it("licence copies design and pays a civilian factory", async () => {
    const { d, tick } = await deep(["DEU", "FRA", "ITA"]);
    giveTank(d, DEU, 1, TEST_TANK);
    const key = equipKey("tank_design", 1);
    const msg = vi.spyOn(d, "message");
    // France (another faction) asks Germany (a human): a card for 20 s.
    expect(
      d.issue(FRA, { kind: "licence_request", from: DEU, key }, tick),
    ).toBeNull();
    expect(d.market.pending).toEqual([
      {
        id: expect.any(Number),
        from: FRA,
        to: DEU,
        key,
        ship: 0,
        deadlineTick: tick + LICENCE_CARD_TICKS,
      },
    ]);
    expect(
      d.issue(FRA, { kind: "licence_request", from: DEU, key }, tick),
    ).toBe("licence_exists");
    const request = d.market.pending[0].id;
    // Only the asked answers.
    expect(
      d.issue(FRA, { kind: "licence_answer", request, accept: true }, tick),
    ).toBe("bad_index");
    expect(
      d.issue(DEU, { kind: "licence_answer", request, accept: true }, tick),
    ).toBeNull();
    expect(d.market.pending).toEqual([]);
    expect(d.market.licences).toHaveLength(1);
    const l = d.market.licences[0];
    expect(l).toMatchObject({ from: DEU, to: FRA, key, ship: 0 });
    // The design is France's now, as a licensed copy it may produce.
    expect(d.designSlot(FRA, "tank", l.slot)).toMatchObject({
      def: TEST_TANK,
      origin: "licensed",
      from: DEU,
      fromSlot: 1,
    });
    expect(licenceKeys(d, FRA)).toEqual([equipKey("tank_design", l.slot)]);
    expect(msg).toHaveBeenCalledWith(FRA, "ww1936_licence_granted", {
      countryTag: "DEU",
      design: "Test Tank",
      item: "tank_design",
      gen: 1,
    });
    expect(msg).toHaveBeenCalledWith(
      DEU,
      "ww1936_licence_granted",
      expect.objectContaining({ countryTag: "FRA" }),
    );
    // The fee: one civilian factory from France to Germany while it lives.
    expect(d.civsOut(FRA)).toBe(1);
    expect(d.civsIn(DEU)).toBe(1);
    // Italy is in Germany's faction: the licence is free.
    expect(
      d.issue(ITA, { kind: "licence_request", from: DEU, key }, tick),
    ).toBeNull();
    const r2 = d.market.pending[0].id;
    expect(
      d.issue(DEU, { kind: "licence_answer", request: r2, accept: true }, tick),
    ).toBeNull();
    expect(d.market.licences.map((x) => x.to)).toEqual([FRA, ITA]);
    expect(d.civsOut(ITA)).toBe(0);
    expect(d.civsIn(DEU)).toBe(1);
    // A refusal: the requester hears of it.
    expect(
      d.issue(
        FRA,
        { kind: "licence_request", from: DEU, key: equipKey("artillery", 1) },
        tick,
      ),
    ).toBeNull();
    const r3 = d.market.pending[0].id;
    expect(
      d.issue(
        DEU,
        { kind: "licence_answer", request: r3, accept: false },
        tick,
      ),
    ).toBeNull();
    expect(msg).toHaveBeenCalledWith(FRA, "ww1936_licence_denied", {
      countryTag: "DEU",
      design: "artillery",
      item: "artillery",
      gen: 1,
    });
    expect(d.market.licences).toHaveLength(2);
  });

  it("a card nobody answers is refused when its time is up", async () => {
    const { d, tick, day } = await deep(["DEU", "FRA"]);
    expect(
      d.issue(
        FRA,
        { kind: "licence_request", from: DEU, key: equipKey("artillery", 1) },
        tick,
      ),
    ).toBeNull();
    const msg = vi.spyOn(d, "message");
    dayCommonMarket(d, day + 1, tick + LICENCE_CARD_TICKS - 1);
    expect(d.market.pending).toHaveLength(1);
    dayCommonMarket(d, day + 2, tick + LICENCE_CARD_TICKS);
    expect(d.market.pending).toEqual([]);
    expect(d.market.licences).toEqual([]);
    expect(msg).toHaveBeenCalledWith(
      FRA,
      "ww1936_licence_denied",
      expect.objectContaining({ countryTag: "DEU" }),
    );
  });

  it("licence production costs 10 percent more plus 10 percent a year of gap", async () => {
    const { ww, d, day } = await deep(["DEU", "FRA"]);
    const fra = ww.economy.country(FRA)!;
    const deu = ww.economy.country(DEU)!;
    for (const t of ["medium_tank_1", "medium_tank_2", "medium_tank_3"]) {
      deu.addTech(t as "medium_tank_1");
    }
    // France makes light tanks of 1936 only.
    expect(fra.researched.has("light_tank_1")).toBe(true);
    expect(fra.researched.has("light_tank_2")).toBe(false);
    const m1 = equipKey("medium_tank", 1); // 1939
    const m3 = equipKey("medium_tank", 3); // 1943
    expect(licenceCostPctFor(d, FRA, m1)).toBe(0); // no licence
    expect(grantLicence(d, DEU, FRA, m1, 0, day)).toBeNull();
    expect(grantLicence(d, DEU, FRA, m3, 0, day)).toBeNull();
    // 1939 − 1936: +10 + 30.
    expect(licenceCostPctFor(d, FRA, m1)).toBe(40);
    // 1943 − 1936: the gap's part stops at +50.
    expect(licenceCostPctFor(d, FRA, m3)).toBe(60);
    // France's own light tank II (1938) narrows the gap.
    fra.addTech("light_tank_2");
    expect(licenceCostPctFor(d, FRA, m1)).toBe(20);
    expect(licenceCostPctFor(d, FRA, m3)).toBe(60);
    // Its own medium tank I: no licence surcharge on it; the gap to
    // 1943 is 4 years.
    fra.addTech("medium_tank_1");
    expect(licenceCostPctFor(d, FRA, m1)).toBe(0);
    expect(licenceCostPctFor(d, FRA, m3)).toBe(50);
    // A licensed design: its year (medium II chassis, 1941) against
    // France's newest own tank (medium I, 1939).
    giveTank(d, DEU, 1, TEST_TANK);
    expect(
      grantLicence(d, DEU, FRA, equipKey("tank_design", 1), 0, day),
    ).toBeNull();
    const slot = d.market.licences[2].slot;
    expect(licenceCostPctFor(d, FRA, equipKey("tank_design", slot))).toBe(30);
    // Germany's own design costs it nothing extra.
    expect(licenceCostPctFor(d, DEU, equipKey("tank_design", 1))).toBe(0);
  });

  it("a static licence builds a generation without its tech", async () => {
    const { ww, d, day } = await deep(["DEU", "FRA"]);
    const econ = ww.economy;
    const fra = econ.country(FRA)!;
    econ.country(DEU)!.addTech("medium_tank_1");
    expect(fra.researched.has("medium_tank_1")).toBe(false);
    expect(addLine(econ, fra, "medium_tank", 1, 1)).toBe("no_tech");
    // Germany cannot license what it does not make.
    expect(
      d.issue(
        FRA,
        {
          kind: "licence_request",
          from: DEU,
          key: equipKey("medium_tank", 2),
        },
        1,
      ),
    ).toBe("no_partner");
    expect(
      grantLicence(d, DEU, FRA, equipKey("medium_tank", 1), 0, day),
    ).toBeNull();
    expect(licenceKeys(d, FRA)).toEqual([equipKey("medium_tank", 1)]);
    expect(addLine(econ, fra, "medium_tank", 1, 1)).toBeNull();
    // Not the generation after it.
    expect(addLine(econ, fra, "medium_tank", 2, 1)).toBe("no_tech");
    // Bombs and convoys never cross borders.
    econ.country(DEU)!.stock[equipKey("convoy", 1)] = 10;
    expect(
      d.issue(
        FRA,
        { kind: "licence_request", from: DEU, key: equipKey("convoy", 1) },
        1,
      ),
    ).toBe("no_partner");
  });

  it("war ends a licence and stops its line", async () => {
    const { ww, d, tick, day } = await deep(["DEU", "FRA"]);
    const econ = ww.economy;
    const fra = econ.country(FRA)!;
    econ.country(DEU)!.addTech("medium_tank_1");
    giveTank(d, DEU, 1, TEST_TANK);
    const m1 = equipKey("medium_tank", 1);
    expect(grantLicence(d, DEU, FRA, m1, 0, day)).toBeNull();
    expect(
      grantLicence(d, DEU, FRA, equipKey("tank_design", 1), 0, day),
    ).toBeNull();
    const slot = d.market.licences[1].slot;
    const designKey = equipKey("tank_design", slot);
    expect(addLine(econ, fra, "medium_tank", 1, 3)).toBeNull();
    expect(addLine(econ, fra, "tank_design", slot, 2)).toBeNull();
    // A line France builds by its own techs is not the licence's.
    expect(addLine(econ, fra, "light_tank", 1, 1)).toBeNull();
    const lines = () =>
      fra.lines
        .filter((l) => l.key === m1 || l.key === designKey)
        .map((l) => [l.key, l.factories]);
    expect(lines()).toEqual([
      [m1, 3],
      [designKey, 2],
    ]);
    expect(d.civsOut(FRA)).toBe(2);
    const msg = vi.spyOn(d, "message");
    ww.setWar(DEU, FRA, tick);
    dayCommonMarket(d, day + 1, tick);
    expect(d.market.licences).toEqual([]);
    expect(d.civsOut(FRA)).toBe(0);
    // The lines stay, stopped; the copy may still be used, not produced.
    expect(lines()).toEqual([
      [m1, 0],
      [designKey, 0],
    ]);
    expect(fra.lines.every((l) => l.key !== m1 || l.active === 0)).toBe(true);
    expect(
      fra.lines.find((l) => l.key === equipKey("light_tank", 1))?.factories,
    ).toBe(1);
    expect(d.designSlot(FRA, "tank", slot)?.origin).toBe("received");
    expect(licenceKeys(d, FRA)).toEqual([]);
    expect(addLine(econ, fra, "medium_tank", 1, 1)).toBe("no_tech");
    expect(msg).toHaveBeenCalledWith(
      FRA,
      "ww1936_licence_ended",
      expect.objectContaining({ countryTag: "DEU", item: "medium_tank" }),
    );
  });

  it("either side may end a licence; the licensee keeps what it built", async () => {
    const { ww, d, day } = await deep(["DEU", "FRA"]);
    const fra = ww.economy.country(FRA)!;
    ww.economy.country(DEU)!.addTech("medium_tank_1");
    const m1 = equipKey("medium_tank", 1);
    expect(grantLicence(d, DEU, FRA, m1, 0, day)).toBeNull();
    fra.stock[m1] = 40;
    const id = d.market.licences[0].id;
    expect(d.issue(ITA, { kind: "licence_cancel", licence: id }, 1)).toBe(
      "bad_index",
    );
    expect(d.issue(DEU, { kind: "licence_cancel", licence: id }, 1)).toBeNull();
    expect(d.market.licences).toEqual([]);
    expect(fra.stock[m1]).toBe(40);
    expect(grantLicence(d, DEU, FRA, m1, 0, day)).toBeNull();
    endLicence(d, d.market.licences[0]);
    expect(d.market.licences).toEqual([]);
  });
});
