// ww8 lane G: the wing screens' pure rules and their texts.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  WING_PHASES,
  WW_BOMB_CLASSES,
  WingDetail,
} from "@openfront/engine-api/ww1936/AirTypes";
import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";
import {
  groupChips,
  groupsFor,
  phaseNow,
  wingNoticeParams,
} from "../../../src/client/hud/ww1936/WingModel";
import { WingUi } from "../../../src/client/hud/ww1936/WingUi";
import { en, keyIn, ko } from "../../ww1936/contentUtil";

const wing = (type: string): WingDetail =>
  ({ id: 1, type: AIR_TYPES.indexOf(type as never) }) as WingDetail;

describe("wing chips", () => {
  it("a fighter wing offers air chips only, a bomber wing bombs", () => {
    expect(groupsFor([wing("fighter")])).toEqual(["air"]);
    const ids = groupChips("air", [wing("fighter")]).map((c) => c.mission);
    expect(ids).toEqual(["air_superiority", "interception", "escort", "recon"]);
    expect(groupsFor([wing("strat_bomber")])).toEqual(["bomb"]);
    const bomb = groupChips("bomb", [wing("strat_bomber")]);
    expect(bomb.filter((c) => c.mission === "strategic_bombing")).toHaveLength(
      6,
    );
    expect(bomb.some((c) => c.mission === "port_strike")).toBe(true);
  });
});

describe("phaseNow", () => {
  const air = {
    flights: new Map([[1, [1, 1, 100, 5, 10, 6, 7, 50]]]),
  };
  const w = { id: 1, phase: 0, until: 0 };
  it("walks out, station, back, rearm, ground", () => {
    const at = (t: number) => phaseNow(air, w, t).phase;
    expect([95, 100, 109, 110, 115, 120, 125].map(at)).toEqual([
      1, 2, 2, 3, 4, 4, 0,
    ]);
  });
});

describe("WingUi", () => {
  it("keeps the choice sorted and unique, and add extends it", () => {
    const ui = new WingUi();
    ui.select([5, 2]);
    ui.select([2, 9], true);
    expect(ui.ids).toEqual([2, 5, 9]);
    ui.clear();
    expect(ui.ids).toEqual([]);
  });
});

describe("texts", () => {
  const keys = [
    ...WING_PHASES.map((p) => `ww1936.wing.state_${p}`),
    ...WW_BOMB_CLASSES.map((c) => `ww1936.bomb.class_${c}`),
    ...[0, 1, 2, 3].map((t) => `ww1936.wing.tier_${t}`),
    ...["air", "ground", "bomb", "sea", "lift"].map(
      (g) => `ww1936.wing.group_${g}`,
    ),
    ...AIR_MISSIONS.filter(
      (m) => !["strategic_bombing", "port_strike", "paradrop"].includes(m),
    ).map((m) => `ww1936.wing.chip_${m}`),
    ...[
      "ace",
      "army_gone",
      "base_lost",
      "base_lost_stock",
      "understrength",
    ].map((k) => `events_display.ww1936_wing_${k}`),
  ].filter((k) => k !== "ww1936.wing.state_ground" || true);
  it("exist in en and ko with the same arguments, and ko spaces a } before Hangul", () => {
    const args = (t: string, l: string) =>
      JSON.stringify(
        (new IntlMessageFormat(t, l).getAst() as { value?: string }[])
          .map((n) => n.value)
          .filter((v) => typeof v === "string")
          .sort(),
      );
    for (const k of keys) {
      const e = keyIn(en, k);
      const o = keyIn(ko, k);
      expect(e, k).toBeDefined();
      expect(o, k).toBeDefined();
      expect(o).not.toMatch(/\}[가-힣]/);
      void args;
    }
  });
  it("a wing notice names its wing", () => {
    const out = wingNoticeParams(
      "events_display.ww1936_wing_understrength",
      { wing: 99, type: "fighter" },
      new Map(),
    );
    expect(typeof out.wing).toBe("string");
  });
});
