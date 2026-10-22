import { SUB_SWITCH_XP } from "@openfront/engine-api/ww1936/DepthTypes";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { DoctrineModel } from "../../../src/client/hud/ww1936/DoctrineModel";
import { doctrineGame } from "./DoctrineFixture";
import { detail } from "./EconomyFixture";
import { landDetail } from "./LandFixture";

const base = {
  details: [detail("DEU")],
  landDetails: [landDetail("DEU", { armyXpMilli: 150_000 })],
};

describe("DoctrineModel (spec §20.2, §20.3)", () => {
  it("track rows show level, next reward and days", () => {
    // Track 0 at 350 000 milli (level 2), +5.0 a day: 50 days to 600 000.
    const g = doctrineGame({
      ...base,
      detail: {
        doctrine: {
          gd: [0, -1, -1],
          sub: [0, -1, -1, -1, -1, -1, -1, -1, -1],
          masteryMilli: [350_000, 0, 0, 0, 0, 0, 0, 0, 0],
          gainMilli: [5_000, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      },
    });
    const m = new DoctrineModel(g.game as never);
    const rows = m.trackRows(0);
    expect(rows).toHaveLength(3);
    expect(rows[0].level).toBe(2);
    expect(rows[0].sub).toBe(0);
    expect(rows[0].next?.level).toBe(3);
    expect(rows[0].days).toBe(50);
    expect(m.daysToNext(0)).toBe(50);
    expect(m.nextReward(0)?.level).toBe(3);
    expect(rows[0].gainText).toBe("5.00");
    // No sub-doctrine picked: no reward line; no gain: no days.
    expect(rows[1].next).toBeNull();
    expect(rows[1].days).toBeNull();
    expect(m.domains()[0].tracks.map((t) => t.id)).toEqual([
      "infantry",
      "armor",
      "support",
    ]);
  });

  it("a switch shows the xp cost and the lock", () => {
    const g = doctrineGame({
      ...base,
      detail: {
        doctrine: {
          gd: [0, -1, -1],
          gdLock: [800, -1, -1],
          sub: [0, -1, -1, -1, -1, -1, -1, -1, -1],
        },
      },
    });
    const m = new DoctrineModel(g.game as never);
    // A first pick costs nothing.
    const first = m.pickBlock({ domain: 1, gd: 4 });
    expect(first).toMatchObject({ block: null, xpCost: 0, switching: false });
    // Switching the land doctrine costs 100 xp (the army has 150), locked until day 800.
    const sw = m.pickBlock({ domain: 0, gd: 1 });
    expect(sw.switching).toBe(true);
    expect(sw.xpCost).toBe(100);
    expect(sw.block).toBe("doctrine_locked");
    expect(sw.lockDays).toBeGreaterThan(0);
    // A sub-doctrine switch costs 25 xp.
    const sub = m.pickBlock({ track: 0, sub: 1 });
    expect(sub.xpCost).toBe(SUB_SWITCH_XP);
    expect(sub.block).toBeNull();
    // Not enough xp.
    const poor = doctrineGame({
      details: base.details,
      landDetails: [landDetail("DEU", { armyXpMilli: 10_000 })],
      detail: { doctrine: { gd: [0, -1, -1], gdLock: [-1, -1, -1] } },
    });
    expect(
      new DoctrineModel(poor.game as never).pickBlock({ domain: 0, gd: 1 })
        .block,
    ).toBe("no_xp");
  });

  it("the doctrine dial glows when a grand doctrine is unpicked", () => {
    const none = new DoctrineModel(doctrineGame(base).game as never).dial()!;
    expect(none.glow).toBe(true);
    expect(none.badge?.kind).toBe("unpicked");
    const all = doctrineGame({
      ...base,
      detail: {
        doctrine: {
          gd: [0, 4, 7],
          sub: [0, 3, 6, 9, 11, 13, 15, 17, 19],
        },
        command: { cpMilli: 0 },
      },
    });
    const done = new DoctrineModel(all.game as never).dial()!;
    expect(done.glow).toBe(false);
    expect(done.badge).toBeNull();
  });

  it("the band shows command power, and energy and congress only when they apply", () => {
    const g = doctrineGame({
      ...base,
      summary: { energyPm: 920, atomicStock: 2 },
    });
    const b = new DoctrineModel(g.game as never).band()!;
    expect(b.cpText).toBe("34.0");
    expect(b.energyPct).toBe(92);
    expect(b.nukes).toBe(2);
    expect(b.congressPct).toBeNull();
    const full = new DoctrineModel(doctrineGame(base).game as never).band()!;
    expect(full.energyPct).toBeNull();
    expect(full.nukes).toBeNull();
  });
});
