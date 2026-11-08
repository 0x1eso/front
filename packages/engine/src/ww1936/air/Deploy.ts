// World War 1936 P4: air deployments, bases and refills (P4 spec §13).
// Lane A1 (Task 7). A deployment group is (owner, zone, type, mission,
// volunteer host): one record per base it uses, the same target on every
// record. A group whose planes found no base keeps one empty record on
// base 0 (it waits and tries again on the country's day). Carrier wings
// are records on base −(ship id) that mirror their carrier's deck (spec
// §13.4): they never touch the stock, the deck holds the planes.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  CARRIER_AIR_TYPES,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_STATES,
  SHIP_CLASSES,
  WW_SPOT_FULL_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { CountryEconomy } from "../economy/WwEconomy";
import { deckDesignCounts, designSlotsFor } from "./DesignPlanes";
import { Wing, WwAir } from "./WwAir";

const MISSION_SUP = AIR_MISSIONS.indexOf("air_superiority");
const MISSION_STRIKE = AIR_MISSIONS.indexOf("naval_strike");
const MISSION_PATROL = AIR_MISSIONS.indexOf("naval_patrol");
const CV = SHIP_CLASSES.indexOf("cv");
/** Spec §13.4: a carrier "on its mission" flies: at sea, on station, sortied or in battle. */
const FLYING_STATES: ReadonlySet<number> = new Set(
  (["on_station", "sortie", "battle"] as const).map((s) =>
    FLEET_STATES.indexOf(s),
  ),
);

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

/** A carrier wing's record (spec §13.4): its base is −(ship id). */
export function isCarrierWing(d: Wing): boolean {
  return d.base < 0;
}

/** The deck slot of a carrier plane type (DECK_SLOTS: 3 types × 3 generations), −1 for any other type. */
export function deckSlotOf(type: number): number {
  return (CARRIER_AIR_TYPES as readonly string[]).indexOf(AIR_TYPES[type]);
}

/**
 * Spec §13.4: what a carrier wing flies today: its carrier's deck of its
 * type while the carrier is out on its mission in the wing's zone, else
 * null (sunk, docked, moving or gone elsewhere).
 */
export function carrierWingDeck(air: WwAir, d: Wing): number[] | null {
  const navy = air.navy;
  const r = navy.ships.rowOf(-d.base);
  const slot = deckSlotOf(d.type);
  if (r < 0 || slot < 0) return null;
  const f = navy.fleets.get(navy.ships.fleet[r]);
  if (
    f === undefined ||
    f.docked !== 0 ||
    !FLYING_STATES.has(f.state) ||
    air.ww.scenario.zoneSr(f.zone) !== d.sr
  ) {
    return null;
  }
  const deck = navy.ships.deckOf(r);
  return [deck[slot * 3], deck[slot * 3 + 1], deck[slot * 3 + 2]];
}

/**
 * P6 (lane E): the design planes a carrier wing flies today, per design
 * slot (the deck's design planes of its type): null when its carrier does
 * not fly (carrierWingDeck) or carries none.
 */
export function carrierWingDeckD(air: WwAir, d: Wing): number[] | null {
  const r = air.navy.ships.rowOf(-d.base);
  if (r < 0 || carrierWingDeck(air, d) === null) return null;
  return deckDesignCounts(air.ww.depth, d.owner, r, AIR_TYPES[d.type]);
}

/**
 * A carrier wing's losses off its carrier's deck (the record mirrors the
 * deck): `gens` per generation of its type, P6 (lane E) `slots` per
 * design slot off the deck's design planes.
 */
export function takeOffDeck(
  air: WwAir,
  d: Wing,
  gens: readonly number[],
  slots: readonly number[] | null,
): void {
  const navy = air.navy;
  const r = navy.ships.rowOf(-d.base);
  const slot = deckSlotOf(d.type);
  if (r < 0 || slot < 0) return;
  const deck = navy.ships.deckOf(r);
  gens.forEach((c, g) => {
    deck[slot * 3 + g] = Math.max(0, deck[slot * 3 + g] - c);
  });
  if (slots !== null) {
    const deckD = navy.ships.deckDOf(r);
    slots.forEach((c, s) => {
      deckD[s] = Math.max(0, deckD[s] - c);
    });
  }
  navy.markFleet(navy.ships.fleet[r]);
}

/** P6 (lane E): a design slot's stock key. */
const designKey = (slot: number) => equipKey("plane_design", slot);

/** P6 (lane E): moves up to `n` planes of design slot `slot` from the stock onto the deployed ledger. */
export function drawDesignSlot(
  ce: CountryEconomy,
  slot: number,
  n: number,
): number {
  const k = designKey(slot);
  const take = Math.max(0, Math.min(n, ce.stock[k]));
  ce.stock[k] -= take;
  ce.planesDeployed[k] += take;
  return take;
}

/** The planes of P4 type `type` in `owner`'s stock: its generations and (P6) its designs flying as it. */
export function stockOf(
  air: WwAir,
  ce: CountryEconomy,
  owner: number,
  type: number,
): number {
  const t = AIR_TYPES[type];
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) n += ce.stock[equipKey(t, g)];
  for (const s of designSlotsFor(air.ww.depth, owner, t)) {
    n += ce.stock[designKey(s)];
  }
  return n;
}

/**
 * Derived (Task 15's perf pass): the regions with an air base, ascending,
 * until a building changes — basesInRange scanned every region on each
 * call.
 */
const baseRegionsMemo = new WeakMap<WwAir, { ver: number; list: number[] }>();

export function airBaseRegions(air: WwAir): readonly number[] {
  const ver = air.econ.buildVer;
  const hit = baseRegionsMemo.get(air);
  if (hit !== undefined && hit.ver === ver) return hit.list;
  const levels = air.econ.buildingArray("air_base");
  const list: number[] = [];
  for (let r = 1; r < levels.length; r++) if (levels[r] !== 0) list.push(r);
  baseRegionsMemo.set(air, { ver, list });
  return list;
}

/**
 * Spec §13.3: the working air bases `side` controls whose center is within
 * `rangeKm` of zone `sr`, nearest first (ties: the smaller region),
 * whatever room they have left.
 */
export function basesInRange(
  air: WwAir,
  side: number,
  sr: number,
  rangeKm: number,
): { base: number; km: number }[] {
  const sc = air.ww.scenario;
  const land = air.land;
  const levels = air.econ.buildingArray("air_base");
  const out: { base: number; km: number }[] = [];
  for (const r of airBaseRegions(air)) {
    if (levels[r] === 0 || sc.region(r) === undefined) continue;
    const c = land.controller[r] ?? 0;
    if (c === 0 || land.sideOf(c) !== side) continue;
    if (air.baseCapacity(r) <= 0) continue;
    const km = sc.srKm(r, sr);
    if (km <= rangeKm) out.push({ base: r, km });
  }
  out.sort((a, b) => a.km - b.km || a.base - b.base);
  return out;
}

/** Whether `owner`'s side has spotted an enemy fleet in sea region `sr` (N1's spotting). */
function spottedEnemyIn(air: WwAir, owner: number, sr: number): boolean {
  const navy = air.navy;
  const i = air.ww.scenario.srIdxOf(sr);
  if (i < 0) return false;
  const spot = navy.srState[i].spot.get(air.land.sideOf(owner));
  if (spot === undefined) return false;
  for (const [fleet, pm] of spot) {
    if (pm < WW_SPOT_FULL_PM) continue;
    const f = navy.fleets.get(fleet);
    if (f !== undefined && air.land.isEnemy(owner, f.owner)) return true;
  }
  return false;
}

/**
 * Spec §13.4: the carrier wings. Every carrier out on its mission puts its
 * deck in the air over its sea region: carrier fighters on air
 * superiority, the others on naval strike when our side has spotted an
 * enemy fleet there, else on naval patrol. The records mirror the decks.
 */
export function carrierWings(air: WwAir, owner: number): void {
  const navy = air.navy;
  const t = navy.ships;
  const sc = air.ww.scenario;
  const want = new Map<
    string,
    {
      ship: number;
      sr: number;
      type: number;
      mission: number;
      counts: number[];
      /** P6 (lane E): the deck's design planes of the type, per slot. */
      dcounts: number[] | null;
    }
  >();
  for (const f of navy.fleetsOf(owner)) {
    if (f.docked !== 0 || !FLYING_STATES.has(f.state)) continue;
    const sr = sc.zoneSr(f.zone);
    if (sr === 0) continue;
    let strike: boolean | null = null;
    for (const ship of f.ships) {
      const r = t.rowOf(ship);
      if (r < 0 || t.cls[r] !== CV) continue;
      const deck = t.deckOf(r);
      CARRIER_AIR_TYPES.forEach((ct, slot) => {
        const counts = [deck[slot * 3], deck[slot * 3 + 1], deck[slot * 3 + 2]];
        const dcounts = deckDesignCounts(air.ww.depth, owner, r, ct);
        if (sum(counts) === 0 && dcounts === null) return;
        let mission = MISSION_SUP;
        if (ct !== "cv_fighter") {
          strike ??= spottedEnemyIn(air, owner, sr);
          mission = strike ? MISSION_STRIKE : MISSION_PATROL;
        }
        const type = AIR_TYPES.indexOf(ct);
        want.set(`${ship}:${type}`, {
          ship,
          sr,
          type,
          mission,
          counts,
          dcounts,
        });
      });
    }
  }
  for (const d of air.wingsOf(owner)) {
    if (!isCarrierWing(d)) continue;
    const key = `${-d.base}:${d.type}`;
    const w = want.get(key);
    if (w === undefined || w.sr !== d.sr) {
      // The deck keeps its planes: the record goes without touching the stock.
      d.counts.fill(0);
      d.dcounts.fill(0);
      air.removeWing(d.id, true);
      continue;
    }
    want.delete(key);
    const wd = w.dcounts;
    if (
      d.mission !== w.mission ||
      d.counts.some((c, i) => c !== w.counts[i]) ||
      d.dcounts.some((c, s) => c !== (wd?.[s] ?? 0))
    ) {
      d.mission = w.mission;
      d.counts = [...w.counts];
      if (wd !== null) d.dcounts = [...wd];
      else d.dcounts.fill(0);
      d.goalCount = sum(w.counts) + (wd === null ? 0 : sum(wd));
      air.markWing(d.id);
    }
  }
  const rest = [...want.values()].sort(
    (a, b) => a.ship - b.ship || a.type - b.type,
  );
  for (const w of rest) {
    air.addWing({
      owner,
      sr: w.sr,
      type: w.type,
      mission: w.mission,
      counts: w.counts,
      goalCount: sum(w.counts) + (w.dcounts === null ? 0 : sum(w.dcounts)),
      base: -w.ship,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
      ...(w.dcounts === null ? {} : { dcounts: w.dcounts }),
    });
  }
}
