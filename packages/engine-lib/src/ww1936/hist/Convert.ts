// World War 1936 historical catalogue: the one entry point of the
// conversions (dispatch by family) and the printable table.
import {
  PlaneDesignStats,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { ShipStats } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  GearStats,
  gunStatsOfEntry,
  infantryStatsOfEntry,
  supportStatsOfEntry,
} from "./ConvertGear";
import { planeStatsOfEntry } from "./ConvertPlane";
import { shipStatsOfEntry } from "./ConvertShip";
import { HistTankStats, tankStatsOfEntry } from "./ConvertTank";
import { HistEntry } from "./Types";

export type HistStats =
  | TankDesignStats
  | PlaneDesignStats
  | ShipStats
  | GearStats;

/** The game stats of any catalogue entry, from its real specification. */
export function histStatsOf(e: HistEntry): HistStats {
  switch (e.family) {
    case "tank":
      return tankStatsOfEntry(e);
    case "plane":
      return planeStatsOfEntry(e);
    case "ship":
      return shipStatsOfEntry(e);
    case "infantry":
      return infantryStatsOfEntry(e);
    case "support":
      return supportStatsOfEntry(e);
    case "gun":
      return gunStatsOfEntry(e);
  }
}

const pad = (v: string | number, n: number) => String(v).padStart(n);
const c1 = (centi: number) => (centi / 100).toFixed(1);

/** One printed line per entry, with a header first (used by the tests and the report). */
export function histTableLines(entries: readonly HistEntry[]): string[] {
  const out: string[] = [];
  const tanks = entries.filter((e) => e.family === "tank");
  if (tanks.length > 0) {
    out.push(
      "tank            role   armor pierce soft hard  def  brk  spd  rel  IC   fuel  res(st/oil/cr/tu)",
    );
    for (const e of tanks) {
      const s: HistTankStats = tankStatsOfEntry(e);
      out.push(
        `${e.id.padEnd(15)} ${e.role.padEnd(6)} ${pad(c1(s.armor), 5)} ${pad(c1(s.pierce), 6)} ${pad(c1(s.soft), 4)} ${pad(c1(s.hard), 4)} ${pad(c1(s.def), 4)} ${pad(c1(s.brk), 4)} ${pad(c1(s.speedCenti), 4)} ${pad(s.relPm / 10, 4)} ${pad((s.costMilli / 1000).toFixed(1), 5)} ${pad(s.fuelPct, 4)}  ${s.resources[4]}/${s.resources[0]}/${s.resources[5]}/${s.resources[3]}`,
      );
    }
  }
  const planes = entries.filter((e) => e.family === "plane");
  if (planes.length > 0) {
    out.push(
      "plane           type            atk  def agi grd str nav  spd  rng  rel   IC",
    );
    for (const e of planes) {
      const s = planeStatsOfEntry(e);
      out.push(
        `${e.id.padEnd(15)} ${e.type.padEnd(15)} ${pad(c1(s.airAttack), 4)} ${pad(c1(s.airDefense), 4)} ${pad(s.agility, 3)} ${pad(c1(s.ground), 4)} ${pad(c1(s.strategic), 4)} ${pad(c1(s.naval), 4)} ${pad(s.speed, 4)} ${pad(s.range, 4)} ${pad(s.relPm / 10, 4)} ${pad((s.costMilli / 1000).toFixed(1), 5)}`,
      );
    }
  }
  const ships = entries.filter((e) => e.family === "ship");
  if (ships.length > 0) {
    out.push(
      "ship            cls   hp   light heavy hPierce torp  armor   aa   kn  range  cost",
    );
    for (const e of ships) {
      const s = shipStatsOfEntry(e);
      out.push(
        `${e.id.padEnd(15)} ${e.cls.padEnd(3)} ${pad(s.hpMilli / 1000, 4)} ${pad(c1(s.light), 6)} ${pad(c1(s.heavy), 5)} ${pad(c1(s.heavyPierce), 7)} ${pad(c1(s.torpedo), 5)} ${pad(c1(s.armor), 6)} ${pad(c1(s.aa), 5)} ${pad(s.speedCentiKn / 100, 4)} ${pad(s.rangeKm, 6)} ${pad(s.cost, 6)}`,
      );
    }
  }
  const gear = entries.filter(
    (e) =>
      e.family === "infantry" || e.family === "support" || e.family === "gun",
  );
  if (gear.length > 0) {
    out.push("gear            kind       pct  pierce  milli");
    for (const e of gear) {
      const s = histStatsOf(e) as GearStats;
      const kind =
        e.family === "gun"
          ? e.role
          : e.family === "support"
            ? e.spec.kind
            : "infantry";
      out.push(
        `${e.id.padEnd(15)} ${kind.padEnd(10)} ${pad(s.statPct, 3)} ${pad(c1(s.pierceCenti), 7)} ${pad(s.costMilli, 6)}`,
      );
    }
  }
  return out;
}
