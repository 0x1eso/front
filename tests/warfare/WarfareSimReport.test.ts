import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { RunRecord, summarizeRuns } from "../../scripts/warfare-sim-report";

function run(
  warfare: boolean,
  winner: string | null,
  minutes: number,
  asiaLand: number,
  built: Record<string, number> = {},
): RunRecord {
  return { seed: 1, warfare, winner, minutes, asiaLand, built };
}

describe("warfare sim report", () => {
  test("compares off and on side by side", () => {
    const rows = summarizeRuns([
      run(false, "China", 20, 0.5),
      run(false, "Brazil", 24, 0.2),
      run(true, "Japan", 28, 0.3, { [UnitType.Airport]: 4 }),
      run(true, null, 30, 0.25),
    ]);
    const get = (label: string) => rows.find((r) => r.label === label)!;
    expect(get("Asia-start wins")).toEqual({
      label: "Asia-start wins",
      off: "1/2",
      on: "1/2",
    });
    expect(get("games won")).toMatchObject({ off: "2/2", on: "1/2" });
    expect(get("game minutes (mean)")).toMatchObject({
      off: "22.0",
      on: "29.0",
    });
    expect(get("Asia-start land at end (mean)")).toMatchObject({
      off: "35.0%",
      on: "27.5%",
    });
    expect(get("Airport built per game")).toMatchObject({
      off: "0.0",
      on: "2.0",
    });
  });
});
