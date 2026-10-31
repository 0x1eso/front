import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    `[${key}] ${Object.entries(params ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join(",")}`,
}));

import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  WW_EVENT_TIMEOUT_LONG_TICKS,
  WW_EVENT_TIMEOUT_TICKS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { describeEffects } from "@openfront/engine-lib/ww1936/Describe";
import {
  FOCUS_EFFECT_SCALE,
  scaleFocusEffect,
  scaleFocusEffects,
} from "@openfront/engine-lib/ww1936/FocusScale";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { addSpirit } from "@openfront/engine/ww1936/politics/Spirits";
import { lineText } from "../../../src/client/hud/ww1936/PoliticsModel";
import { politicsFixture } from "../../ww1936/politicsFixture";
import { byTag, HUMAN, pol, POL, step, wwRunner } from "../../ww1936/util";

const here = { where: { region: "x" } } as unknown as { where: never };

describe("event timers", () => {
  it("60 s and 90 s", () => {
    expect(WW_EVENT_TIMEOUT_TICKS).toBe(600);
    expect(WW_EVENT_TIMEOUT_LONG_TICKS).toBe(900);
  });
});

describe("focus effect scale", () => {
  const S = FOCUS_EFFECT_SCALE;
  const cases: [Effect, Effect][] = [
    [
      { kind: "pp", amount: 20 },
      { kind: "pp", amount: 20 * S },
    ],
    [
      { kind: "stability", pct: 5 },
      { kind: "stability", pct: 5 * S },
    ],
    [
      { kind: "war_support", pct: -4 },
      { kind: "war_support", pct: -4 * S },
    ],
    [
      { kind: "research_bonus", branch: "industry", pct: 15, uses: 2 },
      { kind: "research_bonus", branch: "industry", pct: 15 * S, uses: 2 },
    ],
    [
      { kind: "build", ...here, building: "factory", count: 2 },
      { kind: "build", ...here, building: "factory", count: 2 * S },
    ],
    [
      { kind: "equipment", type: "infantry", gen: 1, count: 100 },
      { kind: "equipment", type: "infantry", gen: 1, count: 100 * S },
    ],
    [
      { kind: "army_xp", amount: 10 },
      { kind: "army_xp", amount: 10 * S },
    ],
    [
      { kind: "navy_xp", amount: 10 },
      { kind: "navy_xp", amount: 10 * S },
    ],
    [
      { kind: "resource", ...here, res: "steel", amount: 4 },
      { kind: "resource", ...here, res: "steel", amount: 4 * S },
    ],
    [
      { kind: "popularity", ideology: "ruling", pp: 3 },
      { kind: "popularity", ideology: "ruling", pp: 3 * S },
    ],
    [
      { kind: "opinion", of: "all", value: 10, days: 100 },
      { kind: "opinion", of: "all", value: 10 * S, days: 100 },
    ],
  ] as never;

  it.each(cases)("scales %j", (e, want) => {
    expect(scaleFocusEffect(e)).toEqual(want);
  });

  it("leaves structural effects alone, recurses into if", () => {
    const keep: Effect[] = [
      { kind: "set_flag", flag: "f" },
      { kind: "research_slot", amount: 1 },
      { kind: "fire_event", id: "e" },
    ];
    expect(scaleFocusEffects(keep)).toEqual(keep);
    const nested = scaleFocusEffect({
      kind: "if",
      cond: { kind: "always", value: true },
      then: [{ kind: "pp", amount: 1 }],
    });
    expect(nested).toMatchObject({ then: [{ kind: "pp", amount: S }] });
  });

  it("the effect text shows the scaled numbers", () => {
    const text = describeEffects(
      scaleFocusEffects([{ kind: "pp", amount: 20 }]),
    )
      .map(lineText)
      .join("|");
    expect(text).toContain(`amount=${20 * S}`);
  });
});

describe("a spirit added by a focus", () => {
  beforeEach(() =>
    usePoliticsContent(
      politicsFixture({
        spirits: [{ id: "t_b", stats: { outputPct: 5 }, icon: "flag" }],
      }),
    ),
  );
  afterEach(() => usePoliticsContent(null));

  it("counts its modifiers three times; a decision's does not", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    step(runner);
    const p = pol(runner.game);
    const deu = byTag(runner.game, "DEU").smallID();
    addSpirit(p, deu, "t_b", undefined, 0);
    expect(p.country(deu)!.stats.outputPct).toBe(5);
    addSpirit(p, deu, "t_b", undefined, 0, true);
    expect(p.country(deu)!.stats.outputPct).toBe(5 * FOCUS_EFFECT_SCALE);
  });
});
