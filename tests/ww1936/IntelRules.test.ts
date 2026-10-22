// World War 1936 P6 (spec §8, plan Task 1 Step 21): intelligence levels,
// bands, cryptology, networks, capture, operations, fog labels.
import {
  ID_AIR,
  ID_ARMY,
  ID_CIVIL,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  capturePmMilli,
  counterHalf,
  decryptPerDayMilli,
  fogCountLabel,
  fogPreviewValue,
  intelBand,
  IntelInput,
  intelLevel,
  networkGainMilli,
  opSuccessPm,
} from "@openfront/engine-lib/ww1936/IntelRules";

const base: IntelInput = {
  domain: ID_ARMY,
  sameFaction: false,
  neighbour: false,
  atWar: false,
  networkMilliPm: 0,
  department: false,
  infiltrated: false,
  decrypted: false,
  exploiting: false,
  recon: false,
  skirmisher: false,
  radar: false,
  targetCounterMissions: 0,
  intelPct: 0,
};
const lvl = (o: Partial<IntelInput>) => intelLevel({ ...base, ...o });

describe("intelligence rules", () => {
  it("each line of the level", () => {
    expect(lvl({})).toBe(5);
    expect(lvl({ neighbour: true })).toBe(15);
    expect(lvl({ sameFaction: true })).toBe(80);
    expect(lvl({ atWar: true })).toBe(20);
    expect(lvl({ networkMilliPm: 1_000_000 })).toBe(55);
    expect(lvl({ department: true })).toBe(15);
    expect(lvl({ infiltrated: true })).toBe(35);
    expect(lvl({ infiltrated: true, domain: ID_CIVIL })).toBe(5);
    expect(lvl({ decrypted: true })).toBe(15);
    expect(lvl({ exploiting: true })).toBe(35);
    expect(lvl({ exploiting: true, domain: ID_CIVIL })).toBe(20);
    expect(lvl({ recon: true, skirmisher: true })).toBe(45);
    expect(lvl({ recon: true, domain: ID_AIR })).toBe(5);
    expect(lvl({ radar: true, domain: ID_AIR })).toBe(15);
    expect(lvl({ radar: true })).toBe(5);
    expect(lvl({ atWar: true, targetCounterMissions: 3 })).toBe(0);
    expect(lvl({ intelPct: 25 })).toBe(7);
    expect(
      lvl({
        neighbour: true,
        atWar: true,
        networkMilliPm: 1_000_000,
        department: true,
        infiltrated: true,
        exploiting: true,
        recon: true,
      }),
    ).toBe(100);
  });

  it("band edges", () => {
    expect([19, 20, 49, 50, 79, 80].map(intelBand)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it("a day of code-breaking: Britain against Germany", () => {
    expect(decryptPerDayMilli(100, 255)).toBe(1_633);
    expect(decryptPerDayMilli(0, 255)).toBe(0);
  });

  it("network growth by skill, the counter-intelligence cut capped at 90%", () => {
    expect(networkGainMilli(1, 0, 0, false)).toBe(3_000);
    expect(networkGainMilli(2, 0, 0, false)).toBe(4_500);
    expect(networkGainMilli(3, 0, 0, false)).toBe(6_000);
    expect(networkGainMilli(1, 0, 4, true)).toBe(300);
  });

  it("capture chances", () => {
    expect(capturePmMilli(false, 1, counterHalf(0, false), false)).toBe(2_000);
    expect(capturePmMilli(true, 3, counterHalf(0, true), false)).toBe(5_000);
    expect(capturePmMilli(true, 3, counterHalf(0, true), true)).toBe(2_500);
  });

  it("operation success", () => {
    expect(opSuccessPm(600, 2_000, true, 0)).toBe(850);
    expect(opSuccessPm(1_000, 3_000, true, 0)).toBe(950);
  });

  it("fog labels and the preview value", () => {
    expect([0, 1, 2, 3].map((b) => fogCountLabel(12, b))).toEqual([
      "?",
      "6~18",
      "9~15",
      "12",
    ]);
    expect(fogPreviewValue(12, 3)).toBe(12);
    expect(fogPreviewValue(12, 2)).toBe(15);
    expect(fogPreviewValue(12, 1)).toBe(18);
    expect(fogPreviewValue(12, 0)).toBe(24);
  });
});
