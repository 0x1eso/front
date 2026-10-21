// World War 1936 P4: naval supremacy (P4 spec §8.5). Lane N1 (Task 3).
// Once a day per sea region: each side's power there — its fleets' ships
// by supremacy weight × generation HP % × HP ratio × mission ‰ × fuel ‰
// (a strike force in port at 500‰), and yesterday's naval air: 0.1 per
// naval strike or naval patrol plane, 0.05 per air superiority fighter —
// over its own plus its enemies' power.
import {
  fleetSupPowerMilli,
  supremacyPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { GEN_HP_PCT } from "@openfront/engine-lib/ww1936/ShipStats";
import { fuelPmOf, isAtStation, missionPm } from "./Missions";
import type { Fleet, WwNavy } from "./WwNavy";

/** Spec §8.5: milli-weight per milli-sortie of naval strike or patrol (0.1 a plane). */
const NAVAL_AIR_DIV = 10;
/** Spec §8.5: milli-weight per milli-sortie of air superiority fighters (0.05 a plane). */
const FIGHTER_AIR_DIV = 20;

/** Spec §8.5: one fleet's supremacy power, milli-weight. */
export function fleetSupPowerOf(navy: WwNavy, f: Fleet): number {
  const pm = missionPm(f, "sup", isAtStation(f));
  if (pm <= 0) return 0;
  const t = navy.ships;
  const ships: {
    supWeight: number;
    genHpPct: number;
    hpMilli: number;
    maxHpMilli: number;
  }[] = [];
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const s = navy.shipStatsOf(r);
    ships.push({
      supWeight: s.supWeight,
      genHpPct: GEN_HP_PCT[t.gen[r] - 1] ?? 100,
      hpMilli: t.hp[r],
      maxHpMilli: s.hpMilli,
    });
  }
  return fleetSupPowerMilli(ships, pm, fuelPmOf(navy, f.owner));
}

/** A sea region's supremacy by side (WwNavy.setSupremacy, side key order). */
export function supremacyRegion(navy: WwNavy, sr: number): void {
  const sc = navy.scenario;
  const idx = sc.srIdxOf(sr);
  const s = sc.sr(sr);
  if (idx < 0 || s === undefined || s.kind !== "sea") return;
  const power = new Map<number, number>();
  const add = (side: number, v: number) => {
    if (v > 0) power.set(side, (power.get(side) ?? 0) + v);
  };
  for (const z of s.members) {
    for (const id of navy.fleetsIn(z)) {
      const f = navy.fleets.get(id)!;
      add(navy.sideOf(f.owner), fleetSupPowerOf(navy, f));
    }
  }
  // Yesterday's naval air (A1, pre-flight A4): milli-sorties by country.
  const air = navy.ww.air.zoneState[idx];
  if (air !== undefined) {
    const naval = new Map<number, number>();
    const fighters = new Map<number, number>();
    const sum = (m: Map<number, number>, c: number, v: number) => {
      const side = navy.sideOf(c);
      m.set(side, (m.get(side) ?? 0) + v);
    };
    for (const [c, ms] of air.navalStrike) sum(naval, c, ms);
    for (const [c, ms] of air.navalAsw) sum(naval, c, ms);
    for (const [c, ms] of air.fightersSup) sum(fighters, c, ms);
    for (const [side, ms] of naval) add(side, Math.floor(ms / NAVAL_AIR_DIV));
    for (const [side, ms] of fighters) {
      add(side, Math.floor(ms / FIGHTER_AIR_DIV));
    }
  }
  const members = new Map<number, readonly number[]>();
  for (const x of navy.sideList()) members.set(x.key, x.members);
  const keys = [...power.keys()]
    .filter((k) => members.has(k))
    .sort((a, b) => a - b);
  const atWar = (a: number, b: number) => {
    for (const x of members.get(a)!) {
      for (const y of members.get(b)!) if (navy.isEnemy(x, y)) return true;
    }
    return false;
  };
  const out = new Map<number, number>();
  for (const side of keys) {
    let enemies = 0;
    for (const other of keys) {
      if (other !== side && atWar(side, other)) enemies += power.get(other)!;
    }
    out.set(side, supremacyPm(power.get(side)!, enemies));
  }
  navy.setSupremacy(sr, out);
}
