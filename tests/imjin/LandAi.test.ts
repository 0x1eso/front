// ww177 I5a: the Imjin War's land AI (design §9): the drive's way, the
// order picks by the same rules a player has, the personalities, and the
// AI landing and peace on the Imjin rules.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  aimBonusVp,
  aimCost,
  aimDistances,
  guardBonusVp,
  IMJIN_AI_PLANS,
} from "@openfront/engine-lib/imjin/LandAi";
import {
  aiAttackOrder,
  aiDefenceStance,
  rowMixOf,
} from "@openfront/engine-lib/imjin/LandRound";
import { AI_PLANS, planOf } from "@openfront/engine-lib/ww1936/AiPlans";
import {
  imjinAim,
  imjinNextStep,
} from "@openfront/engine/imjin/land/ImjinLandAi";
import { aiWantsPeace } from "@openfront/engine/ww1936/endgame/WhitePeace";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, stepTo, wwRunner } from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};

const ROLLS = Array.from({ length: 24 }, (_, i) => i);

describe("the drive's way (pure)", () => {
  test("open ground first, passes last; the pull grows near the aim", () => {
    expect(aimCost("plain")).toBeLessThan(aimCost("forest"));
    expect(aimCost("forest")).toBeLessThan(aimCost("pass"));
    // 0 - 1 - 3 by an open road, 0 - 2 - 3 through a pass: the road wins.
    const nb = [
      [1, 2],
      [0, 3],
      [0, 3],
      [1, 2],
    ];
    const t = ["plain", "plain", "pass", "plain"] as const;
    const d = aimDistances(
      4,
      3,
      (r) => nb[r],
      (r) => aimCost(t[r]),
      () => true,
    );
    expect(d[3]).toBe(0);
    expect(d[1]).toBeLessThan(d[2]);
    expect(d[0]).toBe(d[1] + aimCost("plain"));
    expect(aimBonusVp(3)).toBeGreaterThan(aimBonusVp(12));
    expect(aimBonusVp(1000)).toBe(0);
    expect(guardBonusVp("pass")).toBeGreaterThan(0);
    expect(guardBonusVp("walled")).toBeGreaterThan(0);
    expect(guardBonusVp("plain")).toBe(0);
  });

  test("the personalities: Japan pushes harder than 1936 Japan, Joseon guards more", () => {
    const jpn = planOf("JPN", 7, 3, false, IMJIN_AI_PLANS);
    const old = planOf("JPN", 7, 3, false, AI_PLANS);
    expect(jpn.reattackPm).toBeLessThan(old.reattackPm);
    expect(jpn.regroupPm).toBeLessThan(old.regroupPm);
    expect(jpn.landingSupPm).toBeLessThan(old.landingSupPm);
    const jos = planOf("JOS", 7, 1, false, IMJIN_AI_PLANS);
    expect(jos.reservePct).toBeGreaterThan(planOf("JOS", 7, 1).reservePct);
    // A human's armies keep the default.
    expect(planOf("JPN", 7, 3, true, IMJIN_AI_PLANS).reattackPm).toBe(
      planOf("JPN", 7, 3, true).reattackPm,
    );
  });
});

describe("the battle orders (pure)", () => {
  const jpn = rowMixOf("JPN");
  const min = rowMixOf("MIN");
  const jos = rowMixOf("JOS");

  test("the siege picks: guns breach, the ladders not into a counter-charge", () => {
    const picks = ROLLS.map((r) => aiAttackOrder(min, "walled", 2, null, r));
    expect(picks).toContain("barrage");
    expect(picks).toContain("storm");
    const after = ROLLS.map((r) =>
      aiAttackOrder(jpn, "walled", 2, "counter_charge", r),
    );
    expect(after).not.toContain("storm");
    expect(after).toContain("volley_advance");
  });

  test("volleys on open ground; the gap only when the reload shows", () => {
    const open = ROLLS.map((r) => aiAttackOrder(jpn, "plain", 0, null, r));
    const rough = ROLLS.map((r) => aiAttackOrder(jpn, "forest", 0, null, r));
    const n = (l: string[]) => l.filter((o) => o === "volley_advance").length;
    expect(n(open)).toBeGreaterThan(n(rough));
    const blind = ROLLS.map((r) =>
      aiAttackOrder(jos, "plain", 0, "massed_volley", r),
    );
    expect(blind).not.toContain("charge_gap");
    expect(blind).not.toContain("charge");
    const seen = ROLLS.map((r) =>
      aiAttackOrder(jos, "plain", 0, "massed_volley", r, { seesRhythm: true }),
    );
    expect(seen).toContain("charge_gap");
    const bait = ROLLS.map((r) =>
      aiAttackOrder(jos, "plain", 0, "counter_charge", r),
    );
    expect(bait).toContain("feigned_retreat");
  });

  test("the defence strikes a crossing and screens with archers in rough ground", () => {
    const cross = ROLLS.map((r) =>
      aiDefenceStance(jos, null, r, { crossing: true, terrain: "plain" }),
    );
    expect(cross.filter((s) => s === "strike_crossing").length).toBe(18);
    const pass = ROLLS.map((r) =>
      aiDefenceStance(jos, null, r, { terrain: "pass" }),
    );
    const plain = ROLLS.map((r) =>
      aiDefenceStance(jos, null, r, { terrain: "plain" }),
    );
    const screen = (l: string[]) =>
      l.filter((s) => s === "archer_screen").length;
    expect(screen(pass)).toBeGreaterThan(screen(plain));
    const jp = ROLLS.map((r) =>
      aiDefenceStance(jpn, null, r, { terrain: "plain" }),
    );
    expect(jp).toContain("massed_volley");
  });
});

describe("in a game", () => {
  test("Japan's aim, its next region, its landing and no 1936 peace", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    const g = r.game;
    const ww = g.worldWar()!;
    const land = ww.land;
    const sc = ww.scenario;
    const jpn = byTag(g, "JPN").smallID();
    const jos = byTag(g, "JOS").smallID();
    const min = byTag(g, "MIN").smallID();
    const name = (id: number) => sc.region(id)?.name;
    // At peace nobody is anybody's aim.
    expect(imjinAim(land, jpn)).toBe(0);
    // Past the preparation minute, when war can be fought.
    stepTo(r, WW_PREP_TICKS + 1);
    ww.setWar(jpn, jos, g.ticks());
    expect(name(imjinAim(land, jpn))).toBe("Hanseong");
    // Ming is not at war: no aim; Joseon has no chain.
    expect(imjinAim(land, min)).toBe(0);
    expect(imjinAim(land, jos)).toBe(0);
    const next = imjinNextStep(land, jpn, imjinAim(land, jpn));
    expect(land.controller[next]).toBe(jos);
    expect(
      sc.regionNeighbours(next).some((n) => land.controller[n] === jpn),
    ).toBe(true);
    // The AI lands by the player's (easy) rules in the Imjin War.
    expect(ww.isHumanControlled(jpn)).toBe(false);
    expect(ww.navy.easyInvasion(jpn)).toBe(true);
    // No stalemate peace: the truce is the way to stop.
    const eg = ww.endgame;
    const wid = [...eg.warsOf(jpn)][0];
    const w = eg.war(wid)!;
    expect(aiWantsPeace(eg, w, jpn, ww.day(g.ticks()) + 2000)).toBe(false);
  });
});
