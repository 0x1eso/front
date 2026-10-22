// World War 1936 P6 lane I (plan Task 5, spec §8.2–§8.6): the agency, its
// upgrades, operatives and their missions, capture and release, exiles and
// faction-shared intelligence. Plan decision 30: a human country, the lane
// functions called directly for the long spans, findRoll-style searches
// for the stateless rolls.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { P_INTEL_CAPTURE } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  capturePmMilli,
  counterHalf,
  opStartBlock,
  OpStartInput,
  upgradeBlock,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { dailyIntel } from "@openfront/engine/ww1936/depth/Agency";
import { sharedIntel } from "@openfront/engine/ww1936/depth/FactionRules";
import { computeIntelRow } from "@openfront/engine/ww1936/depth/IntelLevels";
import {
  intelResistancePp,
  rebuildResistBoost,
} from "@openfront/engine/ww1936/depth/Operations";
import {
  captureMilliOf,
  counterMissions,
  dailyOperatives,
  M_BUILD_NETWORK,
  M_COUNTER,
  M_PROPAGANDA,
  M_SUPPORT_RES,
  ST_CAPTURED,
  ST_IDLE,
  ST_MISSION,
} from "@openfront/engine/ww1936/depth/Operatives";
import type {
  Operative,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { step, stepTo, takeRegion, wwRunner } from "./util";

vi.mock("@openfront/engine/ww1936/depth/FactionRules", async (orig) => {
  const m =
    await orig<typeof import("@openfront/engine/ww1936/depth/FactionRules")>();
  return { ...m, sharedIntel: vi.fn(m.sharedIntel) };
});

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(sharedIntel).mockReset();
});

const { DEU, GBR, FRA, POL, ITA } = DEEP.tag;
const HUMANS = [{ clientID: "HUMANGBR", country: "GBR" as const }];

async function game(): Promise<GameRunner> {
  const r = await wwRunner({}, HUMANS, DEEP.map);
  stepTo(r, WW_PREP_TICKS + 1);
  return r;
}

/** An operative of `owner` placed directly (state 2 on a mission unless told otherwise). */
function place(
  d: WwDepth,
  owner: number,
  o: Partial<Operative> & { uid: number },
): Operative {
  const c = d.country(owner)!;
  c.intel.agency = true;
  const op: Operative = {
    codename: c.intel.nextCodename++,
    skill: 1,
    abroadDays: 0,
    state: ST_MISSION,
    target: 0,
    mission: -1,
    op: 0,
    sinceDay: 0,
    travelLeft: 0,
    releaseDay: -1,
    recruitLeft: 0,
    ...o,
  };
  c.intel.operatives.push(op);
  return op;
}

/** The first uid ≥ from whose capture rolls on `days` match `want` (true: caught that day). */
function uidWhere(
  seed: number,
  target: number,
  pMilli: number,
  days: readonly number[],
  want: (day: number) => boolean,
  from = 1_000,
): number {
  for (let uid = from; uid < from + 200_000; uid++) {
    if (
      days.every(
        (day) =>
          wwRoll(seed, P_INTEL_CAPTURE, uid, day, target) % 1_000_000 <
            pMilli ===
          want(day),
      )
    ) {
      return uid;
    }
  }
  throw new Error("no uid");
}

describe("World War 1936 P6: intelligence (lane I)", () => {
  it("operative builds network, gets captured deterministically, is released after a year", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    expect(d.issue(GBR, { kind: "intel_found" }, r.game.ticks())).toBeNull();
    const seed = ww.politics.seed;
    // Ten days on the road from day 100: there on day 109, rolls from
    // day 110; caught on day 115, not before.
    const caught = 115;
    const p = capturePmMilli(false, 1, counterHalf(0, false), false);
    const days = [110, 111, 112, 113, 114, 115];
    d.nextUid = uidWhere(seed, DEU, p, days, (day) => day === caught);
    expect(
      d.issue(GBR, { kind: "operative_recruit" }, r.game.ticks()),
    ).toBeNull();
    const o = d.country(GBR)!.intel.operatives[0];
    // 30 days of recruiting.
    for (let day = 70; day < 100; day++) dailyOperatives(d, GBR, day);
    expect(o.recruitLeft).toBe(0);
    expect(
      d.issue(
        GBR,
        {
          kind: "operative_assign",
          operative: o.uid,
          target: DEU,
          mission: "build_network",
        },
        r.game.ticks(),
      ),
    ).toBeNull();
    expect(o.state).toBe(1);
    for (let day = 100; day < 110; day++) dailyOperatives(d, GBR, day);
    expect(o.state).toBe(ST_MISSION);
    expect(d.netMilli(GBR, DEU)).toBe(0);
    for (let day = 110; day < caught; day++) dailyOperatives(d, GBR, day);
    expect(d.netMilli(GBR, DEU)).toBe(5 * 3_000);
    const msg = vi.spyOn(d, "message");
    dailyOperatives(d, GBR, caught);
    expect(o.state).toBe(ST_CAPTURED);
    expect(o.releaseDay).toBe(caught + 365);
    expect(d.netMilli(GBR, DEU)).toBe(0);
    expect(msg.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [GBR, "ww1936_operative_captured"],
      [DEU, "ww1936_operative_captured"],
    ]);
    expect(
      ww.politics.opinions.some(
        (x) => x.a === DEU && x.b === GBR && x.value === -20,
      ),
    ).toBe(true);
    for (let day = caught + 1; day < caught + 365; day++) {
      dailyOperatives(d, GBR, day);
    }
    expect(o.state).toBe(ST_CAPTURED);
    dailyOperatives(d, GBR, caught + 365);
    expect(o.state).toBe(ST_IDLE);
    expect(o.target).toBe(0);
    expect(msg.mock.calls[msg.mock.calls.length - 1]?.[1]).toBe(
      "ww1936_operative_released",
    );
  });

  it("an agency upgrade holds two civilian factories for 90 days", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    expect(
      d.issue(GBR, { kind: "intel_upgrade", id: "ag_ops_1" }, r.game.ticks()),
    ).toBe("no_agency");
    expect(d.issue(GBR, { kind: "intel_found" }, r.game.ticks())).toBeNull();
    const ce = ww.economy.country(GBR)!;
    const paid = ce.totals.paidCivs;
    expect(
      d.issue(GBR, { kind: "intel_upgrade", id: "ag_ops_2" }, r.game.ticks()),
    ).toBe("bad_index");
    expect(
      d.issue(GBR, { kind: "intel_upgrade", id: "ag_ops_1" }, r.game.ticks()),
    ).toBeNull();
    expect(
      d.issue(GBR, { kind: "intel_upgrade", id: "ag_cipher" }, r.game.ticks()),
    ).toBe("bad_index");
    expect(d.civsOut(GBR)).toBe(2);
    // P1's next day pays them (refreshTotals reads civsOut).
    step(r, 8);
    expect(ce.totals.paidCivs).toBe(paid + 2);
    const c = d.country(GBR)!;
    const done = c.intel.upMilli / 11_111;
    for (let n = done; n < 89; n++) dailyIntel(d, GBR, 200 + n);
    expect(c.intel.upId).toBeGreaterThanOrEqual(0);
    expect(d.civsOut(GBR)).toBe(2);
    dailyIntel(d, GBR, 300);
    expect(c.intel.upId).toBe(-1);
    expect(c.intel.upgrades & 1).toBe(1);
    expect(d.civsOut(GBR)).toBe(0);
    // The pure rule the screens grey the cards with.
    const u = {
      agency: true,
      upgrades: 0,
      upgrade: "ag_crypto_2" as const,
      inProgress: false,
      computing1: true,
      freeCivs: 5,
    };
    expect(upgradeBlock(u)).toBe("bad_index");
    expect(upgradeBlock({ ...u, upgrades: 1 << 3 })).toBeNull();
    expect(upgradeBlock({ ...u, upgrades: 1 << 3, computing1: false })).toBe(
      "bad_index",
    );
    expect(upgradeBlock({ ...u, upgrades: 1 << 3, freeCivs: 1 })).toBe(
      "no_civs",
    );
    expect(upgradeBlock({ ...u, agency: false })).toBe("no_agency");
  });

  it("propaganda stops at minus 15 points per target", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const seed = ww.politics.seed;
    const days = Array.from({ length: 520 }, (_, i) => 1_000 + i);
    const p = capturePmMilli(false, 3, counterHalf(0, false), false);
    const o = place(d, GBR, {
      uid: uidWhere(seed, DEU, p, [...days, 2_000], () => false),
      skill: 3,
      target: DEU,
      mission: M_PROPAGANDA,
    });
    d.setNetMilli(GBR, DEU, 300_000);
    const deu = ww.politics.country(DEU)!;
    deu.stabBaseBp = 6_000;
    deu.wsBaseBp = 6_000;
    for (const day of days) dailyOperatives(d, GBR, day);
    expect(o.state).toBe(ST_MISSION);
    expect(deu.stabBaseBp).toBe(4_500);
    expect(deu.wsBaseBp).toBe(4_500);
    expect(d.country(GBR)!.intel.propagandaBp).toEqual([[DEU, 1_500]]);
    // Not below the floor either: 20%.
    deu.wsBaseBp = 2_000;
    d.country(GBR)!.intel.propagandaBp = [];
    dailyOperatives(d, GBR, 2_000);
    expect(deu.wsBaseBp).toBe(2_000);
    expect(deu.stabBaseBp).toBe(4_497);
  });

  it("an exile supports resistance at its own occupied cores with half the network threshold", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const { warsaw, krakow } = DEEP.region;
    takeRegion(r.game, warsaw, "DEU");
    takeRegion(r.game, krakow, "DEU");
    const eg = ww.endgame;
    expect(eg.isAdministered(warsaw)).toBe(true);
    const day = ww.day(r.game.ticks());
    eg.exiles.push({
      smallID: POL,
      host: GBR,
      legitBp: 5_000,
      sinceDay: day,
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: warsaw,
    });
    eg.rebuildDerived();
    eg.resBp[krakow] = 3_000;
    eg.resBp[warsaw] = 1_000;
    const pol = place(d, POL, {
      uid: 5,
      skill: 3,
      target: DEU,
      mission: M_SUPPORT_RES,
    });
    const fra = place(d, FRA, {
      uid: 6,
      skill: 3,
      target: DEU,
      mission: M_SUPPORT_RES,
    });
    d.setNetMilli(POL, DEU, 150_000);
    d.setNetMilli(FRA, DEU, 150_000);
    rebuildResistBoost(d);
    // 10pp × 3 / 3, ×1.5 for the exile: 15; France below its 200‰.
    expect(intelResistancePp(d, warsaw)).toBe(15);
    expect(intelResistancePp(d, krakow)).toBe(15);
    expect(d.resistBoost).toEqual([
      [warsaw, 15],
      [krakow, 15],
    ]);
    // An exile at its own cores runs half the risk (spec §8.6).
    expect(captureMilliOf(d, POL, pol)).toBe(capturePmMilli(false, 3, 0, true));
    expect(captureMilliOf(d, FRA, fra)).toBe(
      capturePmMilli(false, 3, 0, false),
    );
    d.setNetMilli(FRA, DEU, 200_000);
    rebuildResistBoost(d);
    expect(intelResistancePp(d, warsaw)).toBe(15 + 10);
    // The P5 resistance target reads it (WwDepth.resistanceAdjPp).
    expect(d.resistanceAdjPp(warsaw)).toBe(25);
    // op_uprising's network floor is halved for the exile too (opStartBlock).
    const i: OpStartInput = {
      agency: true,
      op: "op_uprising",
      networkPm: 250,
      operativesFree: 1,
      pp: 100,
      infEquipment: 1_000,
      atWar: true,
      targetHasCaptive: false,
      targetControlsMyCore: true,
      ideologyBp: 0,
      targetStabilityBp: 5_000,
      halfThreshold: false,
    };
    expect(opStartBlock(i)).toBe("network_low");
    expect(opStartBlock({ ...i, halfThreshold: true })).toBeNull();
    expect(
      opStartBlock({ ...i, halfThreshold: true, targetControlsMyCore: false }),
    ).toBe("op_unavailable");
  });

  it("support resistance never targets Korean or Taiwanese regions", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const eg = ww.endgame;
    const { paris, lyon, berlin, munich } = DEEP.region;
    takeRegion(r.game, paris, "DEU");
    takeRegion(r.game, lyon, "DEU");
    // A region no one else holds a core on is never administered (P5
    // decision 32: Korea and Taiwan), even when taken.
    eg.removeCore(FRA, lyon);
    expect(eg.isAdministered(paris)).toBe(true);
    expect(eg.isAdministered(lyon)).toBe(false);
    place(d, GBR, { uid: 7, skill: 3, target: DEU, mission: M_SUPPORT_RES });
    d.setNetMilli(GBR, DEU, 1_000_000);
    rebuildResistBoost(d);
    expect(intelResistancePp(d, paris)).toBeGreaterThan(0);
    for (const reg of [lyon, berlin, munich]) {
      expect(intelResistancePp(d, reg)).toBe(0);
    }
    for (const [reg] of d.resistBoost) {
      expect(eg.isAdministered(reg)).toBe(true);
      expect(d.noStrike(reg)).toBe(false);
    }
  });

  it("faction shared intel uses half the member's network", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    expect(ww.sameFaction(GBR, FRA)).toBe(true);
    const day = ww.day(r.game.ticks());
    const row = () => [0, 1, 2, 3].map((k) => d.intelOf(GBR, ITA, k));
    computeIntelRow(d, GBR, day);
    const before = row();
    d.setNetMilli(FRA, ITA, 600_000);
    // The rule off: France's network is France's.
    vi.mocked(sharedIntel).mockImplementation(() => false);
    computeIntelRow(d, GBR, day);
    expect(row()).toEqual(before);
    // fr_shared_intel on (lane W3's rule): half of 600‰ is 15 points.
    vi.mocked(sharedIntel).mockImplementation((_d, a, b) =>
      ww.sameFaction(a, b),
    );
    computeIntelRow(d, GBR, day);
    expect(row()).toEqual(before.map((v) => v + 15));
    // max(mine, the member's half): my own 400‰ wins (20 points).
    d.setNetMilli(GBR, ITA, 400_000);
    computeIntelRow(d, GBR, day);
    expect(row()).toEqual(before.map((v) => v + 20));
    // A same-faction member is never below 80.
    computeIntelRow(d, GBR, day);
    for (let k = 0; k < 4; k++) {
      expect(d.intelOf(GBR, FRA, k)).toBeGreaterThanOrEqual(80);
    }
  });

  it("the intel_network, decrypt and agency effects", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const ctx = makeCtx(ww.politics, POL, POL, DEU, r.game.ticks());
    applyEffects(ctx, [
      { kind: "agency", upgrade: "ag_cipher" },
      { kind: "intel_network", on: "target", pm: 250 },
      { kind: "decrypt", on: { tag: "DEU" }, pm: 300 },
    ]);
    const c = d.country(POL)!;
    expect(c.intel.agency).toBe(true);
    expect(c.intel.upgrades).toBe(1 << 5);
    expect(d.netMilli(POL, DEU)).toBe(250_000);
    expect(d.decrypted).toEqual([
      { o: POL, t: DEU, progressMilli: 300_000, activeUntil: -1 },
    ]);
    applyEffects(ctx, [{ kind: "intel_network", on: "target", pm: -400 }]);
    expect(d.netMilli(POL, DEU)).toBe(0);
  });

  it("operatives of a country that no longer plays act on nobody", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const { paris } = DEEP.region;
    const tick = r.game.ticks();
    // France keeps counter-intelligence at home; Britain supports the
    // resistance in Paris, taken by Germany.
    place(d, FRA, { uid: 61, target: FRA, mission: M_COUNTER });
    const gbr = place(d, GBR, {
      uid: 62,
      skill: 3,
      target: DEU,
      mission: M_SUPPORT_RES,
    });
    const abroad = place(d, GBR, {
      uid: 63,
      target: FRA,
      mission: M_BUILD_NETWORK,
    });
    takeRegion(r.game, paris, "DEU");
    d.setNetMilli(GBR, DEU, 1_000_000);
    expect(counterMissions(d, FRA)).toBe(1);
    rebuildResistBoost(d);
    expect(intelResistancePp(d, paris)).toBe(10);
    // France out of the game: its counter-intelligence counts for nothing,
    // it is no target any more, and Britain's operative there comes home.
    ww.addCapitulation(FRA, DEU, tick);
    expect(ww.isActor(FRA)).toBe(false);
    expect(counterMissions(d, FRA)).toBe(0);
    expect(
      d.issue(
        GBR,
        {
          kind: "operative_assign",
          operative: gbr.uid,
          target: FRA,
          mission: "build_network",
        },
        tick,
      ),
    ).toBe("bad_target");
    expect(d.issue(GBR, { kind: "crypto_target", target: FRA }, tick)).toBe(
      "bad_target",
    );
    dailyOperatives(d, GBR, 300);
    expect(abroad.state).toBe(ST_IDLE);
    // Britain out of the game: its operatives in the field are frozen and
    // the resistance table forgets them on its next day.
    ww.addCapitulation(GBR, DEU, tick);
    expect(gbr.state).toBe(ST_MISSION);
    rebuildResistBoost(d);
    expect(intelResistancePp(d, paris)).toBe(0);
    expect(d.resistBoost).toEqual([]);
  });

  it("refused intelligence orders change nothing", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const tick = r.game.ticks();
    const orders: [Parameters<WwDepth["issue"]>[1], string][] = [
      [{ kind: "intel_found" }, "no_pp"],
      [{ kind: "intel_upgrade", id: "ag_ops_1" }, "no_agency"],
      [{ kind: "operative_recruit" }, "no_agency"],
      [
        {
          kind: "operative_assign",
          operative: 1,
          target: DEU,
          mission: "build_network",
        },
        "no_agency",
      ],
      [{ kind: "operative_recall", operative: 1 }, "no_agency"],
      [
        {
          kind: "operation_start",
          op: "op_sabotage",
          target: DEU,
          operatives: [1],
        },
        "no_agency",
      ],
      [{ kind: "operation_cancel", operation: 1 }, "no_agency"],
      [{ kind: "crypto_target", target: DEU }, "no_agency"],
      [{ kind: "crypto_activate", target: DEU }, "no_agency"],
    ];
    const check = () => {
      const hash = d.hash();
      const snap = JSON.stringify(d.snapshot());
      const pp = ww.politics.country(GBR)!.ppMilli;
      for (const [o, why] of orders) {
        expect(d.issue(GBR, o, tick), o.kind).toBe(why);
      }
      expect(d.hash()).toBe(hash);
      expect(JSON.stringify(d.snapshot())).toBe(snap);
      expect(ww.politics.country(GBR)!.ppMilli).toBe(pp);
    };
    ww.politics.country(GBR)!.ppMilli = 0;
    check();
    // With an agency: a full slot, an idle operative, no network, no codes.
    ww.politics.country(GBR)!.ppMilli = 20_000;
    const o = place(d, GBR, { uid: 71, state: ST_IDLE });
    orders.splice(
      0,
      orders.length,
      [{ kind: "intel_found" }, "bad_index"],
      [{ kind: "intel_upgrade", id: "ag_ops_2" }, "bad_index"],
      [{ kind: "operative_recruit" }, "no_slot"],
      [
        {
          kind: "operative_assign",
          operative: o.uid,
          target: GBR,
          mission: "build_network",
        },
        "bad_target",
      ],
      [
        {
          kind: "operative_assign",
          operative: o.uid,
          target: DEU,
          mission: "counter_intelligence",
        },
        "bad_target",
      ],
      [{ kind: "operative_recall", operative: o.uid }, "bad_index"],
      [
        {
          kind: "operation_start",
          op: "op_sabotage",
          target: DEU,
          operatives: [o.uid],
        },
        "network_low",
      ],
      [
        {
          kind: "operation_start",
          op: "op_capture_cipher",
          target: DEU,
          operatives: [o.uid],
        },
        "no_operative",
      ],
      [{ kind: "operation_cancel", operation: 999 }, "bad_index"],
      [{ kind: "crypto_target", target: GBR }, "bad_target"],
      [{ kind: "crypto_activate", target: DEU }, "not_decrypted"],
    );
    check();
  });

  it("lane I's state folds into the hash", async () => {
    const r = await game();
    const d = r.game.worldWar()!.depth;
    const o = place(d, GBR, { uid: 81, target: DEU, mission: M_BUILD_NETWORK });
    d.ops.push({
      uid: 82,
      kind: 0,
      owner: GBR,
      target: DEU,
      operatives: [81],
      startDay: 1,
      endDay: 61,
    });
    d.infiltrations.push([GBR, DEU, 1]);
    d.decrypted.push({ o: GBR, t: DEU, progressMilli: 5, activeUntil: -1 });
    const c = d.country(GBR)!;
    const changes: [string, () => void][] = [
      ["agency", () => (c.intel.agency = !c.intel.agency)],
      ["upgrades", () => (c.intel.upgrades ^= 4)],
      ["upId", () => (c.intel.upId += 1)],
      ["upMilli", () => (c.intel.upMilli += 1)],
      ["nextCodename", () => (c.intel.nextCodename += 1)],
      ["cryptoTarget", () => (c.intel.cryptoTarget += 1)],
      ["propagandaBp", () => c.intel.propagandaBp.push([DEU, 3])],
      ["collabPp", () => c.intel.collabPp.push([DEU, 10])],
      ["operative skill", () => (o.skill += 1)],
      ["operative state", () => (o.state ^= 1)],
      ["operative target", () => (o.target += 1)],
      ["operative mission", () => (o.mission += 1)],
      ["operative op", () => (o.op += 1)],
      ["operative abroadDays", () => (o.abroadDays += 1)],
      ["operative travelLeft", () => (o.travelLeft += 1)],
      ["operative releaseDay", () => (o.releaseDay += 1)],
      ["operative recruitLeft", () => (o.recruitLeft += 1)],
      ["operative sinceDay", () => (o.sinceDay += 1)],
      ["operation end", () => (d.ops[0].endDay += 1)],
      ["operation operatives", () => d.ops[0].operatives.push(83)],
      ["infiltration", () => (d.infiltrations[0][2] = 2)],
      ["decryption", () => (d.decrypted[0].progressMilli += 1)],
      ["exploitation", () => (d.decrypted[0].activeUntil = 90)],
      ["intel row", () => (d.intelLevels[GBR * d.cap * 4 + DEU * 4] ^= 1)],
    ];
    for (const [what, change] of changes) {
      const before = d.hash();
      change();
      expect(d.hash(), what).not.toBe(before);
    }
  });
});
