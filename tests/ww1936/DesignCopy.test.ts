// World War 1936 P6 lane E (plan Task 3 Step 8, spec §5.6, §26): designs
// crossing between countries — capture, lend-lease, the fallback to the
// nearest static equipment. The lane functions are called directly (plan
// decision 30); P5's capture and lend-lease call receiveKey (T1b).
import {
  DesignDef,
  KS_FIELDS,
  PlaneDesignStats,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey, WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  copyDesignTo,
  newestGen,
  receiveKey,
} from "@openfront/engine/ww1936/depth/DesignCopy";
import { saveDesign } from "@openfront/engine/ww1936/depth/Designs";
import { transferDivisionsTo } from "@openfront/engine/ww1936/land/PoliticsBridge";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffect,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { annexCountry } from "@openfront/engine/ww1936/politics/Territory";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, placeArmy, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const DEU = DEEP.tag.DEU;
const MED1: DesignDef = {
  kind: "tank",
  base: "medium_1",
  modules: ["gun_cs", "turret_2", "bogie", "welded", "petrol", "", ""],
  armorLevel: 0,
  engineLevel: 0,
  name: "Med I",
};
const MED2: DesignDef = { ...MED1, base: "medium_2", name: "Med II" };
const TD: DesignDef = {
  kind: "tank",
  base: "medium_2",
  modules: ["gun_small", "turret_none", "bogie", "welded", "petrol", "", ""],
  armorLevel: 2,
  engineLevel: 1,
  name: "Jager",
};
const FIGHTER: DesignDef = {
  kind: "plane",
  base: "small_1",
  modules: ["w_mg4", "w_mg2", "", ""],
  name: "Hawk",
};

async function game() {
  const runner = await wwRunner(
    {},
    [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "DEU" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, ww, d: ww.depth };
}

function techs(ww: WorldWar, id: number, list: WwTechId[]): void {
  const ce = ww.economy.country(id)!;
  for (const t of list) ce.addTech(t);
}

describe("World War 1936 P6: design copies", () => {
  it("captured enemy design is copied into a free slot", async () => {
    const { ww, d } = await game();
    techs(ww, DEU, ["medium_tank_1", "medium_tank_2"]);
    expect(saveDesign(d, DEU, MED1, 0, "own", 0, 0, 0)).toBe(1);
    expect(saveDesign(d, DEU, MED2, 0, "own", 0, 0, 0)).toBe(2);
    // Britain holds a design of its own in slot 1 already.
    expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(1);
    const from = equipKey("tank_design", 2);
    const got = receiveKey(d, DEU, from, GBR, "captured");
    expect(got).toBe(equipKey("tank_design", 2));
    const s = d.designSlot(GBR, "tank", 2)!;
    expect(s.origin).toBe("captured");
    expect(s.from).toBe(DEU);
    expect(s.fromSlot).toBe(2);
    expect(s.obsolete).toBe(false);
    expect(s.def.name).toBe("Med II");
    // The same original design is copied once (spec §5.6).
    expect(receiveKey(d, DEU, from, GBR, "captured")).toBe(got);
    expect(d.country(GBR)!.des.tank.filter((x) => x !== null)).toHaveLength(2);
    // Taken again from Britain, the copy names Germany's slot as its source.
    expect(copyDesignTo(d, GBR, 2, "tank", DEEP.tag.FRA, "captured")).toBe(1);
    const fr = d.designSlot(DEEP.tag.FRA, "tank", 1)!;
    expect([fr.from, fr.fromSlot]).toEqual([DEU, 2]);
    // And back home it is Germany's own design again.
    expect(receiveKey(d, GBR, got, DEU, "captured")).toBe(from);
    // A static key stays; an empty design slot is lost.
    const inf = equipKey("infantry_equipment", 1);
    expect(receiveKey(d, DEU, inf, GBR, "captured")).toBe(inf);
    expect(
      receiveKey(d, DEU, equipKey("tank_design", 9), GBR, "captured"),
    ).toBe(-1);
  });

  it("lend-leased design arrives as received design", async () => {
    const { ww, d } = await game();
    techs(ww, GBR, ["medium_tank_1"]);
    expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(1);
    const got = receiveKey(
      d,
      GBR,
      equipKey("tank_design", 1),
      DEEP.tag.FRA,
      "received",
    );
    expect(got).toBe(equipKey("tank_design", 1));
    expect(d.designSlot(DEEP.tag.FRA, "tank", 1)!.origin).toBe("received");
    // A licence over the received copy raises it (it may be built then).
    copyDesignTo(d, GBR, 1, "tank", DEEP.tag.FRA, "licensed");
    expect(d.designSlot(DEEP.tag.FRA, "tank", 1)!.origin).toBe("licensed");
    // A later capture does not lower it.
    copyDesignTo(d, GBR, 1, "tank", DEEP.tag.FRA, "captured");
    expect(d.designSlot(DEEP.tag.FRA, "tank", 1)!.origin).toBe("licensed");
  });

  it("received design keeps sender stats", async () => {
    const { ww, d } = await game();
    techs(ww, GBR, ["medium_tank_1", "medium_tank_2", "anti_tank_1"]);
    expect(saveDesign(d, GBR, TD, 0, "own", 0, 0, 0)).toBe(1);
    expect(saveDesign(d, GBR, FIGHTER, 0, "own", 0, 0, 0)).toBe(1);
    // Turkey has none of the techs: the copy is the sender's design.
    const to = DEEP.tag.TUR;
    expect(receiveKey(d, GBR, equipKey("tank_design", 1), to, "received")).toBe(
      equipKey("tank_design", 1),
    );
    expect(
      receiveKey(d, GBR, equipKey("plane_design", 1), to, "received"),
    ).toBe(equipKey("plane_design", 1));
    const a = d.designStatsOf(GBR, "tank", 1) as TankDesignStats;
    const b = d.designStatsOf(to, "tank", 1) as TankDesignStats;
    expect(b).toEqual(a);
    expect(a.role).toBe("tank_destroyer");
    expect(d.designStatsOf(to, "plane", 1) as PlaneDesignStats).toEqual(
      d.designStatsOf(GBR, "plane", 1),
    );
    // The receiver's divisions read the same numbers (KeyStatsTable row).
    const j = GROUND_STATIC_SLOTS;
    const ka = ww.land.keyStatsOf(GBR);
    const kb = ww.land.keyStatsOf(to);
    expect(kb.group[j]).toBe(ka.group[j]);
    expect([...kb.stats.subarray(j * KS_FIELDS, (j + 1) * KS_FIELDS)]).toEqual([
      ...ka.stats.subarray(j * KS_FIELDS, (j + 1) * KS_FIELDS),
    ]);
  });

  it("full design slots fall back to the nearest static equipment", async () => {
    const { ww, d } = await game();
    techs(ww, DEU, [
      "medium_tank_1",
      "medium_tank_2",
      "heavy_tank_1",
      "anti_tank_1",
    ]);
    techs(ww, GBR, ["medium_tank_1", "medium_tank_2"]);
    for (let i = 0; i < 12; i++) {
      expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(i + 1);
    }
    for (let i = 0; i < 16; i++) {
      expect(saveDesign(d, GBR, FIGHTER, 0, "own", 0, 0, 0)).toBe(i + 1);
    }
    const heavy: DesignDef = {
      ...MED1,
      base: "heavy_1",
      modules: ["gun_cs", "turret_3", "bogie", "welded", "petrol", "", ""],
    };
    const light: DesignDef = {
      ...MED1,
      base: "light_1",
      modules: ["auto20", "turret_1", "bogie", "riveted", "petrol", ""],
    };
    const spa: DesignDef = {
      ...MED1,
      modules: ["howitzer", "turret_open", "bogie", "welded", "petrol", "", ""],
    };
    for (const def of [MED2, heavy, light, TD, spa, FIGHTER]) {
      saveDesign(d, DEU, def, 0, "own", 0, 0, 0);
    }
    const key = (slot: number) => equipKey("tank_design", slot);
    // Britain: medium tanks of generation 2, light tanks of generation 1.
    expect(receiveKey(d, DEU, key(1), GBR, "captured")).toBe(
      equipKey("medium_tank", 2),
    );
    expect(receiveKey(d, DEU, key(2), GBR, "captured")).toBe(
      equipKey("medium_tank", 2),
    );
    expect(receiveKey(d, DEU, key(3), GBR, "captured")).toBe(
      equipKey("light_tank", 1),
    );
    expect(receiveKey(d, DEU, key(4), GBR, "captured")).toBe(
      equipKey("anti_tank", newestGen(d, GBR, "anti_tank")),
    );
    expect(receiveKey(d, DEU, key(5), GBR, "captured")).toBe(
      equipKey("artillery", newestGen(d, GBR, "artillery")),
    );
    expect(
      receiveKey(d, DEU, equipKey("plane_design", 1), GBR, "received"),
    ).toBe(equipKey("fighter", newestGen(d, GBR, "fighter")));
    expect(newestGen(d, GBR, "fighter")).toBe(1);
  });

  // Review E1 (spec §26 risk 1): units changing owner carry their designs.
  describe("an annexation", () => {
    const TUR = DEEP.tag.TUR;
    const HEAVY: DesignDef = {
      kind: "tank",
      base: "heavy_1",
      modules: ["gun_cs", "turret_3", "bogie", "welded", "petrol", "", ""],
      armorLevel: 1,
      engineLevel: 0,
      name: "Heavy",
    };
    const AA_DD: DesignDef = {
      kind: "ship",
      base: "dd_1",
      modules: ["", "", "sec_aa", ""],
      name: "AA",
    };

    /** Turkey: a heavy tank design (slot 1) in a division and the stock, an AA destroyer design (slot 1) on a ship. */
    async function turkey() {
      const g = await game();
      const { runner, ww, d } = g;
      techs(ww, TUR, ["medium_tank_1", "heavy_tank_1"]);
      ww.land.country(TUR)!.armyXpMilli = 500_000;
      expect(saveDesign(d, TUR, HEAVY, 0, "own", 0, 0, 0)).toBe(1);
      expect(saveDesign(d, TUR, AA_DD, 0, "own", 0, 0, 0)).toBe(1);
      const ce = ww.economy.country(TUR)!;
      // 40 go to the division, 47 stay in the stock.
      ce.stock[equipKey("tank_design", 1)] = 87;
      const tpl = ww.land.country(TUR)!.nextTemplateId;
      expect(
        ww.land.issue(
          TUR,
          {
            kind: "template_save",
            template: 0,
            base: 0,
            name: "Heavy",
            battalions: ["heavy_armor"],
            support: [],
          },
          "ai",
        ),
      ).toBeNull();
      const army = placeArmy(runner.game, "TUR", DEEP.region.isthmus, 1, tpl);
      const div = army.divisions[0];
      const fid = ww.navy.createFleet(TUR, DEEP.region.isthmus, [["dd", 1, 1]]);
      const ship = ww.navy.fleets.get(fid)!.ships[0];
      const t = ww.navy.ships;
      t.design[t.rowOf(ship)] = 1;
      return { ...g, div, ship };
    }

    it("tank-design divisions, ships and stock keep their designs under the annexer", async () => {
      const { runner, ww, d, div, ship } = await turkey();
      const land = ww.land;
      const r0 = land.divisions.rowOf(div);
      const before = land.baseStatsOf(r0);
      expect(land.divisions.equipOf(r0)[GROUND_STATIC_SLOTS]).toBe(40);
      const t = ww.navy.ships;
      const aa = ww.navy.shipStatsOf(t.rowOf(ship)).aa;
      // Britain's slot 1 holds a design of its own: the copies go to slot 2.
      techs(ww, GBR, ["medium_tank_1"]);
      expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(1);
      expect(
        saveDesign(
          d,
          GBR,
          { ...AA_DD, modules: ["", "", "", ""] },
          0,
          "own",
          0,
          0,
          0,
        ),
      ).toBe(1);
      const gbr = ww.economy.country(GBR)!;
      const gbrHad = gbr.stock[equipKey("tank_design", 2)];
      annexCountry(
        ww.politics,
        GBR,
        TUR,
        "transfer",
        false,
        runner.game.ticks(),
      );
      const r = land.divisions.rowOf(div);
      expect(land.divisions.owner[r]).toBe(GBR);
      const eq = land.divisions.equipOf(r);
      expect(eq[GROUND_STATIC_SLOTS]).toBe(0);
      expect(eq[GROUND_STATIC_SLOTS + 1]).toBe(40);
      const copy = d.designSlot(GBR, "tank", 2)!;
      expect(copy.origin).toBe("received");
      expect([copy.from, copy.fromSlot]).toEqual([TUR, 1]);
      const after = land.baseStatsOf(r);
      for (const k of [
        "soft",
        "hard",
        "def",
        "brk",
        "armor",
        "pierce",
      ] as const) {
        expect(after[k], k).toBe(before[k]);
      }
      // The stock: Turkey's 47 heavy tanks are Britain's slot-2 tanks.
      expect(gbr.stock[equipKey("tank_design", 2)]).toBe(gbrHad + 47);
      expect(gbr.stock[equipKey("tank_design", 1)]).toBe(0);
      // The ship: Britain's copy of the AA destroyer, the same numbers.
      const rs = t.rowOf(ship);
      expect(t.owner[rs]).toBe(GBR);
      expect(t.design[rs]).toBe(2);
      expect(d.designSlot(GBR, "ship", 2)!.def.modules).toEqual(AA_DD.modules);
      expect(ww.navy.shipStatsOf(rs).aa).toBe(aa);
    });

    it("a civil war's split and a ship transfer carry their designs too", async () => {
      const { ww, d, div, ship } = await turkey();
      techs(ww, GBR, ["medium_tank_1"]);
      expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(1);
      const land = ww.land;
      const before = land.baseStatsOf(land.divisions.rowOf(div));
      // P5's split path (civil war, exile): PoliticsBridge.transferDivisionsTo.
      expect(transferDivisionsTo(land, [div], GBR)).not.toBeNull();
      const r = land.divisions.rowOf(div);
      expect(land.divisions.owner[r]).toBe(GBR);
      const eq = land.divisions.equipOf(r);
      expect([eq[GROUND_STATIC_SLOTS], eq[GROUND_STATIC_SLOTS + 1]]).toEqual([
        0, 40,
      ]);
      expect(land.baseStatsOf(r).soft).toBe(before.soft);
      // P5's ships_transfer path: WwNavy.transferShip.
      const t = ww.navy.ships;
      const aa = ww.navy.shipStatsOf(t.rowOf(ship)).aa;
      ww.navy.transferShip(ship, GBR);
      const rs = t.rowOf(ship);
      expect(rs).toBeGreaterThanOrEqual(0);
      expect(t.owner[rs]).toBe(GBR);
      expect(t.design[rs]).toBe(1);
      expect(d.designSlot(GBR, "ship", 1)!.origin).toBe("received");
      expect(ww.navy.shipStatsOf(rs).aa).toBe(aa);
    });

    it("send_equipment hands over a design as the receiver's copy (review)", async () => {
      const { runner, ww, d } = await turkey();
      techs(ww, GBR, ["medium_tank_1"]);
      expect(saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0)).toBe(1);
      const key = (s: number) => equipKey("tank_design", s);
      const tur = ww.economy.country(TUR)!;
      const gbr = ww.economy.country(GBR)!;
      const had = tur.stock[key(1)];
      applyEffect(makeCtx(ww.politics, TUR, TUR, TUR, runner.game.ticks()), {
        kind: "send_equipment",
        to: { tag: "GBR" },
        type: "tank_design",
        count: 6,
      });
      expect(tur.stock[key(1)]).toBe(had - 6);
      // Britain's slot 1 is its own medium: Turkey's heavy lands in slot 2.
      expect(gbr.stock[key(1)]).toBe(0);
      expect(gbr.stock[key(2)]).toBe(6);
      expect(d.designSlot(GBR, "tank", 2)!.def.base).toBe("heavy_1");
    });

    it("with Britain's slots full the units fall back to the nearest static equipment", async () => {
      const { runner, ww, d, div, ship } = await turkey();
      techs(ww, GBR, ["medium_tank_1"]);
      for (let i = 0; i < 12; i++) saveDesign(d, GBR, MED1, 0, "own", 0, 0, 0);
      for (let i = 0; i < 24; i++) {
        saveDesign(
          d,
          GBR,
          { ...AA_DD, modules: ["", "", "", ""] },
          0,
          "own",
          0,
          0,
          0,
        );
      }
      const gbr = ww.economy.country(GBR)!;
      const med = equipKey("medium_tank", newestGen(d, GBR, "medium_tank"));
      const had = gbr.stock[med];
      annexCountry(
        ww.politics,
        GBR,
        TUR,
        "transfer",
        false,
        runner.game.ticks(),
      );
      const land = ww.land;
      const eq = land.divisions.equipOf(land.divisions.rowOf(div));
      // A heavy design: the medium tank (spec §5.6).
      expect(eq[GROUND_STATIC_SLOTS]).toBe(0);
      expect(eq[GROUND_EQUIP_KEYS.indexOf(med)]).toBe(40);
      expect(gbr.stock[med]).toBe(had + 47);
      // A ship with no slot: the base class.
      expect(ww.navy.ships.design[ww.navy.ships.rowOf(ship)]).toBe(0);
    });
  });
});
