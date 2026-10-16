import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { mean } from "./domestic-sim-report";

/** World-map nations that start in Asia (names from resources/maps/world/manifest.json). */
export const ASIA_NATIONS: ReadonlySet<string> = new Set([
  "Russia",
  "Siberia",
  "Mongolia",
  "China",
  "India",
  "Kazakhstan",
  "Iran",
  "Saudi Arabia",
  "Oman",
  "Pakistan",
  "Bhutan",
  "Sri Lanka",
  "Thailand",
  "Philippines",
  "Taiwan",
  "Japan",
  "Indonesia",
]);

/** The units the report counts. */
export const WARFARE_SIM_TYPES: readonly UnitType[] = [
  UnitType.CoastalBattery,
  UnitType.Airport,
  UnitType.CoastalBarrage,
  UnitType.Bomber,
  UnitType.TransportPlane,
  UnitType.CargoPlane,
];

/** One simulated game. */
export interface RunRecord {
  seed: number;
  warfare: boolean;
  /** The winning nation's name; null when the run hit its time limit. */
  winner: string | null;
  /** Game minutes until the win, or the whole run. */
  minutes: number;
  /** Share of the land (0..1) the Asia-start nations held at the end. */
  asiaLand: number;
  /** Units built over the game, by unit type. */
  built: Record<string, number>;
}

export interface SummaryRow {
  label: string;
  off: string;
  on: string;
}

const pct = (v: number | null) =>
  v === null ? "-" : `${(v * 100).toFixed(1)}%`;
const num = (v: number | null) => (v === null ? "-" : v.toFixed(1));

/** The same measures with the option off and on (spec §14b, "수치 검증"). */
export function summarizeRuns(runs: readonly RunRecord[]): SummaryRow[] {
  const side = (warfare: boolean) => runs.filter((r) => r.warfare === warfare);
  const row = (
    label: string,
    measure: (rs: readonly RunRecord[]) => string,
  ): SummaryRow => ({
    label,
    off: measure(side(false)),
    on: measure(side(true)),
  });
  return [
    row("games", (rs) => String(rs.length)),
    row(
      "Asia-start wins",
      (rs) =>
        `${rs.filter((r) => r.winner !== null && ASIA_NATIONS.has(r.winner)).length}/${rs.length}`,
    ),
    row(
      "games won",
      (rs) => `${rs.filter((r) => r.winner !== null).length}/${rs.length}`,
    ),
    row("game minutes (mean)", (rs) => num(mean(rs.map((r) => r.minutes)))),
    row("Asia-start land at end (mean)", (rs) =>
      pct(mean(rs.map((r) => r.asiaLand))),
    ),
    ...WARFARE_SIM_TYPES.map((type) =>
      row(`${type} built per game`, (rs) =>
        num(mean(rs.map((r) => r.built[type] ?? 0))),
      ),
    ),
  ];
}
