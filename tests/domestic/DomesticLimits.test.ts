import {
  CONQUEST_PERCENT_MAX,
  CONQUEST_PERCENT_MIN,
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-api/domestic/Limits";
import { GameConfigSchema, IntentSchema } from "@openfront/engine-api/Schemas";
import * as Balance from "@openfront/engine-lib/domestic/Balance";

// The UI clamps to the Balance constants and the schemas validate with the
// engine-api limits; they must be one and the same, or SocketIngress kicks
// players whose clamped value fails validation.
describe("domestic limits", () => {
  test("Balance re-exports the engine-api limits", () => {
    expect(Balance.CONQUEST_PERCENT_MIN).toBe(CONQUEST_PERCENT_MIN);
    expect(Balance.CONQUEST_PERCENT_MAX).toBe(CONQUEST_PERCENT_MAX);
    expect(Balance.RECRUIT_TARGET_MIN_PCT).toBe(RECRUIT_TARGET_MIN_PCT);
    expect(Balance.RECRUIT_TARGET_MAX_PCT).toBe(RECRUIT_TARGET_MAX_PCT);
  });

  test("recruit target schema accepts exactly the limits", () => {
    const ok = (percent: number) =>
      IntentSchema.safeParse({ type: "set_recruit_target", percent }).success;
    expect(ok(RECRUIT_TARGET_MIN_PCT)).toBe(true);
    expect(ok(RECRUIT_TARGET_MAX_PCT)).toBe(true);
    expect(ok(RECRUIT_TARGET_MIN_PCT - 1)).toBe(false);
    expect(ok(RECRUIT_TARGET_MAX_PCT + 1)).toBe(false);
  });

  test("conquestPercent schema accepts exactly the limits", () => {
    const shape = GameConfigSchema.shape.conquestPercent;
    const ok = (v: number) => shape.safeParse(v).success;
    expect(ok(CONQUEST_PERCENT_MIN)).toBe(true);
    expect(ok(CONQUEST_PERCENT_MAX)).toBe(true);
    expect(ok(CONQUEST_PERCENT_MIN - 1)).toBe(false);
    expect(ok(CONQUEST_PERCENT_MAX + 1)).toBe(false);
  });
});
