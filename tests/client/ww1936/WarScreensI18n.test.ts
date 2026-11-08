// War overhaul (ww7), lane E: every string the new army card, battle card
// and group tab draw is in en and ko with the same placeholders, parses as
// an ICU message, and has a space after } before Hangul.
import {
  LAND_ATTACK_TACTICS,
  LAND_DEFENSE_TACTICS,
} from "@openfront/engine-api/ww1936/LandTypes";
import fs from "fs";
import IntlMessageFormat from "intl-messageformat";
import path from "path";
import { describe, expect, it } from "vitest";

const lang = (code: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../../resources/lang/${code}.json`),
      "utf8",
    ),
  ) as Record<string, unknown>;

function get(obj: Record<string, unknown>, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o !== null && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

function params(msg: string): string[] {
  return [
    ...new Set([...msg.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1])),
  ].sort();
}

const KEYS = [
  ...[
    "battle_band",
    "battle_initiative",
    "battle_odds",
    "battle_range",
    "battle_reinforce",
    "battle_tactic_cancel",
    "block_no_target",
    "btn_defend",
    "btn_done",
    "gaps",
    "hint_defend",
    "odds_high",
    "odds_low",
    "odds_mid",
    "order_attack",
    "order_attack_running",
    "order_defend",
    "stance_label",
  ].map((k) => `ww1936.land.${k}`),
  ...[
    "level_0",
    "level_1",
    "level_2",
    "level_hint_0",
    "level_hint_1",
    "level_hint_2",
  ].map((k) => `ww1936.auto.${k}`),
  "ww1936.ag.zone",
  ...LAND_ATTACK_TACTICS.map((k) => `ww1936.tactic.${k}`),
  ...LAND_DEFENSE_TACTICS.map((k) => `ww1936.tactic.${k}`),
];

describe("war overhaul screens: strings", () => {
  const en = lang("en");
  const ko = lang("ko");

  it.each(KEYS)("%s is in en and ko with the same placeholders", (key) => {
    const e = get(en, key);
    const k = get(ko, key);
    expect(typeof e).toBe("string");
    expect(typeof k).toBe("string");
    expect(params(k as string)).toEqual(params(e as string));
    expect(k).not.toMatch(/\}[가-힣]/);
    new IntlMessageFormat(e as string, "en");
    new IntlMessageFormat(k as string, "ko");
  });

  it("the odds words, the stances and the auto levels read as the owner's spec says", () => {
    expect(
      ["low", "mid", "high"].map((k) => get(ko, `ww1936.land.odds_${k}`)),
    ).toEqual(["낮음", "보통", "높음"]);
    expect(
      ["careful", "balanced", "aggressive"].map((k) =>
        get(ko, `ww1936.stance.${k}`),
      ),
    ).toEqual(["신중", "보통", "과감"]);
    expect(get(ko, "ww1936.auto.level_1")).toBe("수비 자동");
    expect(get(ko, "ww1936.auto.level_2")).toBe("공세 자동");
    expect(get(ko, "ww1936.land.btn_attack")).toBe("공격");
    expect(get(ko, "ww1936.land.btn_defend")).toBe("방어");
    expect(get(ko, "ww1936.land.btn_move")).toBe("이동");
    expect(get(ko, "ww1936.land.btn_auto")).toBe("자동");
    expect(get(ko, "ww1936.land.battle_tactic_cancel")).toBe("상쇄");
  });

  it("the plural lines read right in English", () => {
    const say = (key: string, n: number) =>
      new IntlMessageFormat(get(en, key) as string, "en").format({ n });
    expect(say("ww1936.land.gaps", 1)).toBe("1 border region uncovered");
    expect(say("ww1936.land.gaps", 3)).toBe("3 border regions uncovered");
    expect(say("ww1936.land.order_defend", 1)).toBe("Defending 1 region");
    expect(say("ww1936.land.order_defend", 4)).toBe("Defending 4 regions");
  });
});
