// World War 1936 P4: the starting navies (P4 spec §6; plan decision 31).
// The foundation deals the START_NAVY rows (lane G's data) into fleets,
// naval lines and admirals; without a historical order of battle (test
// maps) a country starts with no ships.
import {
  admiralTraitBit,
  SHIP_CLASSES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { ADMIRALS } from "@openfront/engine-lib/ww1936/Admirals";
import {
  fleetNameIdx,
  shipNameIdx,
} from "@openfront/engine-lib/ww1936/ShipNames";
import { lineUnitCost } from "@openfront/engine-lib/ww1936/ShipStats";
import {
  resolveRegionName,
  START_NAVY,
} from "@openfront/engine-lib/ww1936/StartNavy";
import { bestNavalBase } from "./Ports";
import type { Fleet, WwNavy } from "./WwNavy";

/** StartFleetDef.counts order: BB BC CV CA CL DD SS. */
const COUNT_ORDER: readonly ShipClass[] = [
  "bb",
  "bc",
  "cv",
  "ca",
  "cl",
  "dd",
  "ss",
];

/** Spec §6: every country's start navy, then the admirals. WwNavy.start calls it once. */
export function startNavy(navy: WwNavy): void {
  const sc = navy.scenario;
  if (sc.data.historicalOob === true) {
    for (const def of START_NAVY) {
      const owner = sc.smallIdOf(def.tag);
      // P5 (pre-flight §0-4): a country with no land (a dormant slot) starts with no navy.
      if (owner === 0 || navy.econ.regionsOf(owner).length === 0) continue;
      // Ships are dealt to the fleets class by class in table order (the
      // first fleet takes the first counts[c] ships of class c).
      const queues = new Map<
        ShipClass,
        { cls: ShipClass; gen: number; name?: string }[]
      >();
      for (const s of def.ships) {
        let q = queues.get(s.cls);
        if (q === undefined) queues.set(s.cls, (q = []));
        q.push(s);
      }
      const take = (f: Fleet, cls: ShipClass, n: number) => {
        const q = queues.get(cls) ?? [];
        for (let i = 0; i < n && q.length > 0; i++) {
          const s = q.shift()!;
          const nameIdx =
            s.name === undefined
              ? navy.numberedName(owner, s.cls)
              : shipNameIdx(def.tag, s.cls, s.name) ||
                navy.numberedName(owner, s.cls);
          navy.addShip(f, s.cls, s.gen, nameIdx);
        }
      };
      for (const fd of def.fleets) {
        const port = resolveRegionName(sc, fd.base);
        const f = navy.newFleet(owner, port, fleetNameIdx(fd.key));
        COUNT_ORDER.forEach((cls, i) => take(f, cls, fd.counts[i]));
        navy.removeFleetIfEmpty(f.id);
      }
      // Ships no fleet took wait in the best base's new-ships fleet.
      const rest = [...queues.values()].some((q) => q.length > 0);
      const base = bestNavalBase(navy.ww, owner);
      if (rest && base !== 0) {
        const f = navy.newFleet(owner, base, 0);
        f.newShips = true;
        for (const cls of COUNT_ORDER) take(f, cls, Infinity);
        navy.removeFleetIfEmpty(f.id);
      }
      const ce = navy.econ.country(owner);
      if (ce === null) continue;
      for (const ld of def.lines) {
        const port =
          ld.port === undefined
            ? bestNavalBase(navy.ww, owner)
            : resolveRegionName(sc, ld.port);
        ce.navalLines.push({
          id: ce.nextNavalLineId++,
          cls: SHIP_CLASSES.indexOf(ld.cls),
          gen: ld.gen,
          docks: ld.docks,
          activeDocks: 0,
          progress: Math.floor(
            (lineUnitCost(ld.cls, ld.gen) * 1000 * ld.progressPct) / 100,
          ),
          left: ld.count,
          port,
          fill: 1000,
          lastOutput: 0,
          names: ld.names
            .map((n) => shipNameIdx(def.tag, ld.cls, n))
            .filter((i) => i > 0),
        });
      }
    }
  }
  // Spec §7.4: the admirals of the countries in the game (decision 17: id = ADMIRALS index + 1).
  ADMIRALS.forEach((a, i) => {
    const owner = sc.smallIdOf(a.tag);
    if (owner === 0 || navy.econ.regionsOf(owner).length === 0) return;
    let traits = 0;
    for (const t of a.traits) traits |= admiralTraitBit(t);
    navy.admirals.set(i + 1, {
      id: i + 1,
      owner,
      xpMilli: 0,
      level: 1,
      skills: [a.atk, a.def, a.man, a.coord],
      traits,
      fleet: 0,
      usage: [0, 0, 0, 0],
    });
  });
}
