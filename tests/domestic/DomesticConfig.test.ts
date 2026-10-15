import { effectiveMaxTimerMinutes } from "@openfront/engine-lib/domestic/Victory";
import { setup } from "../util/Setup";
import { domesticGame, HUMAN } from "./util";

describe("domestic game config", () => {
  test("domestic games last 30 minutes unless the lobby set a timer", async () => {
    expect((await domesticGame()).config().maxTimerMinutes()).toBe(30);
    expect(
      (await domesticGame({ maxTimerValue: null })).config().maxTimerMinutes(),
    ).toBe(30);
    expect(
      (await domesticGame({ maxTimerValue: 45 })).config().maxTimerMinutes(),
    ).toBe(45);
  });

  test("vanilla timers are unchanged", async () => {
    expect(
      (await setup("plains", {}, [HUMAN])).config().maxTimerMinutes(),
    ).toBeNull();
    expect(
      (await setup("plains", { maxTimerValue: 20 }, [HUMAN]))
        .config()
        .maxTimerMinutes(),
    ).toBe(20);
  });

  test("conquest needs 70% of the land by default, or the lobby's value", async () => {
    const config = (await domesticGame()).config();
    expect(config.conquestPercent()).toBe(70);
    expect(config.percentageTilesOwnedToWin(0)).toBe(70);
    expect(
      (await domesticGame({ conquestPercent: 55 }))
        .config()
        .percentageTilesOwnedToWin(0),
    ).toBe(55);
  });

  test("vanilla ignores conquestPercent and keeps 80", async () => {
    const config = (
      await setup("plains", { conquestPercent: 55 }, [HUMAN])
    ).config();
    expect(config.conquestPercent()).toBe(80);
    expect(config.percentageTilesOwnedToWin(0)).toBe(80);
  });

  test("overtime is forced off in domestic mode", async () => {
    const overtime = { enabled: true, startMinutes: 1 };
    const domestic = (await domesticGame({ overtime })).config();
    expect(domestic.overtimeConfig().enabled).toBe(false);
    expect(domestic.percentageTilesOwnedToWin(30 * 60)).toBe(70);
    const vanilla = (await setup("plains", { overtime }, [HUMAN])).config();
    expect(vanilla.overtimeConfig().enabled).toBe(true);
    expect(vanilla.percentageTilesOwnedToWin(30 * 60)).toBeLessThan(80);
  });

  test("the client reads the same timer from a bare GameConfig", () => {
    expect(
      effectiveMaxTimerMinutes({
        maxTimerValue: undefined,
        domesticMode: true,
      }),
    ).toBe(30);
    expect(effectiveMaxTimerMinutes({ maxTimerValue: undefined })).toBeNull();
    expect(
      effectiveMaxTimerMinutes({ maxTimerValue: 10, domesticMode: true }),
    ).toBe(10);
  });
});
