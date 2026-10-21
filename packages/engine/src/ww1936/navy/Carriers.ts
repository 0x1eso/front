// World War 1936 P4: carriers, decks and port strikes (P4 spec §9.4,
// §9.6, §13.4, §14.9), lane N2 (Task 4). A deck is DECK_SLOTS counts per
// ship row: (cv_fighter, cv_cas, cv_naval_bomber) × generations 1..3; its
// planes are on the deployed ledger (drawPlanes / returnPlanes), so stock
// + deployed only falls by the planes lost.
import { CARRIER_AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  admiralTraitBit,
  CarrierOrder,
  SHIP_CLASSES,
  WW_HIT_PORT_PM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { combineMods } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  orgDamageMilli,
  shotDamageMilli,
  visFactorPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { isNoStrike, strikeBlock } from "@openfront/engine-lib/ww1936/NoStrike";
import { GEN_DECK } from "@openfront/engine-lib/ww1936/ShipStats";
import { airDuelMilli, type DuelPlanes } from "../air/AirCombat";
import {
  drawPlanes,
  effectiveLevel,
  losePlanes,
  returnPlanes,
} from "../economy/Buildings";
import { onPlanesLost } from "./EndgameHooks";
import { applyShipDamage } from "./NavalBattles";
import type { Fleet, WwNavy } from "./WwNavy";

const AVIATOR = admiralTraitBit("aviation_enthusiast");
/** Spec §7.4: the aviation enthusiast's deck +10%. */
const AVIATOR_DECK_PCT = 10;
/** Spec §9.4: a strike's planes as air combat targets (fighters × 2, spec §14.3). */
const FIGHTER_WEIGHT = 2;
const CV = SHIP_CLASSES.indexOf("cv");

/**
 * fleet_port_strike / carrier_mix (spec §9.6, §13.4). A port strike needs
 * a carrier, an enemy's working naval base whose harbor zone is in the
 * fleet's sea region now, and never a no-strike region; it waits for the
 * region's next day (dailySeaRegion). A deck mix is in tenths summing to 10.
 */
export function issueCarrierOrder(
  navy: WwNavy,
  smallID: number,
  order: CarrierOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const f = navy.fleets.get(order.fleet);
  if (f === undefined || f.owner !== smallID) return "no_fleet";
  if (order.kind === "carrier_mix") {
    const [a, b, c] = order.mix;
    if (a + b + c !== 10) return "bad_index";
    f.mix = [a, b, c];
    navy.markFleet(f.id);
    return null;
  }
  const block =
    strikeBlock(navy.scenario, order.port) ??
    portStrikeBlock(navy, f, order.port);
  if (block !== null) return block;
  f.portStrike = order.port;
  navy.markFleet(f.id);
  return null;
}

/** Why `f` may not strike `port` now; null when it may. */
function portStrikeBlock(
  navy: WwNavy,
  f: Fleet,
  port: number,
): WwOrderBlock | null {
  if (!f.ships.some((id) => navy.ships.cls[navy.ships.rowOf(id)] === CV)) {
    return "bad_ship_class";
  }
  if (!navy.isPort(port)) return "no_naval_base";
  if (!navy.isEnemy(f.owner, navy.land.controller[port] ?? 0)) {
    return "not_at_war";
  }
  const members = navy.scenario.sr(navy.fleetZoneSr(f))?.members ?? [];
  if (!members.includes(navy.harborZone(port))) return "out_of_range";
  return null;
}

/** A row's deck as [type][generation − 1] counts (CARRIER_AIR_TYPES order). */
export function deckPlanes(navy: WwNavy, row: number): number[][] {
  const d = navy.ships.deckOf(row);
  return [0, 1, 2].map((ty) => [d[ty * 3], d[ty * 3 + 1], d[ty * 3 + 2]]);
}

/** Spec §9.6: the deck's size, generation × (100 + deckPct + traits) / 100. */
export function deckSize(navy: WwNavy, row: number, f: Fleet): number {
  const t = navy.ships;
  if (t.cls[row] !== CV) return 0;
  const adm = f.admiral === 0 ? undefined : navy.admirals.get(f.admiral);
  const pct =
    (navy.econ.country(t.owner[row])?.stats.deckPct ?? 0) +
    (((adm?.traits ?? 0) & AVIATOR) !== 0 ? AVIATOR_DECK_PCT : 0);
  return Math.floor((GEN_DECK[t.gen[row] - 1] * (100 + pct)) / 100);
}

/** Spec §9.4: a carrier strike's attack, centi: Σ deck planes × their naval attack. */
export function deckAttackCenti(
  navy: WwNavy,
  row: number,
  owner: number,
): number {
  const d = navy.ships.deckOf(row);
  let a = 0;
  CARRIER_AIR_TYPES.forEach((type, ty) => {
    for (let g = 0; g < 3; g++) {
      const n = d[ty * 3 + g];
      if (n > 0) a += n * navy.ww.air.planeStatsOf(owner, type, g + 1).naval;
    }
  });
  return a;
}

/**
 * Spec §9.6, §13.4 (lane A1's dailyAirCountry calls it): every docked
 * carrier of the country, by ship id, fills its deck to deck × mix / 10 a
 * type from the stock (the newest generation first); a type over its
 * share goes back (the oldest first). Carriers at sea keep what they have.
 */
export function fillDecks(navy: WwNavy, smallID: number): void {
  const ce = navy.econ.country(smallID);
  if (ce === null) return;
  const t = navy.ships;
  const carriers: { id: number; f: Fleet }[] = [];
  for (const f of navy.fleetsOf(smallID)) {
    if (f.docked === 0) continue;
    for (const id of f.ships) {
      if (t.cls[t.rowOf(id)] === CV) carriers.push({ id, f });
    }
  }
  carriers.sort((a, b) => a.id - b.id);
  for (const { id, f } of carriers) {
    const r = t.rowOf(id);
    const size = deckSize(navy, r, f);
    const d = t.deckOf(r);
    let changed = false;
    CARRIER_AIR_TYPES.forEach((type, ty) => {
      const want = Math.floor((size * f.mix[ty]) / 10);
      const have = d[ty * 3] + d[ty * 3 + 1] + d[ty * 3 + 2];
      if (have > want) {
        let over = have - want;
        const back = [0, 0, 0];
        for (let g = 0; g < 3 && over > 0; g++) {
          const take = Math.min(over, d[ty * 3 + g]);
          back[g] = take;
          d[ty * 3 + g] -= take;
          over -= take;
        }
        returnPlanes(ce, type, back);
        changed = true;
      } else if (have < want) {
        const got = drawPlanes(ce, type, want - have);
        got.forEach((c, g) => {
          d[ty * 3 + g] += c;
          if (c > 0) changed = true;
        });
      }
    });
    if (changed) navy.markFleet(f.id);
  }
}

/**
 * Spec §9.4, §14.4: strike planes lost, off the carriers' decks: `aaMilli`
 * milli planes to anti-air (split by count) plus the enemy deck fighters'
 * air combat (airDuelMilli, detection 1000; split by count × weight,
 * fighters × 2), rounded to whole planes, split across (carrier, type) by
 * largest remainder and taken oldest generation first; `by` gets the
 * kills (EndgameHooks.onPlanesLost). Returns the planes lost.
 */
export function loseStrikePlanes(
  navy: WwNavy,
  carriers: readonly number[],
  aaMilli: number,
  enemyFighters: readonly { owner: number; counts: readonly number[] }[],
  by: number,
): number {
  const t = navy.ships;
  const air = navy.ww.air;
  const units: {
    row: number;
    owner: number;
    ty: number;
    n: number;
    w: number;
  }[] = [];
  const defenders: DuelPlanes[] = [];
  let n = 0;
  let w = 0;
  for (const id of carriers) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const d = t.deckOf(r);
    const owner = t.owner[r];
    CARRIER_AIR_TYPES.forEach((type, ty) => {
      const weight = ty === 0 ? FIGHTER_WEIGHT : 1;
      let c = 0;
      for (let g = 0; g < 3; g++) {
        const k = d[ty * 3 + g];
        if (k <= 0) continue;
        c += k;
        defenders.push({
          stats: air.planeStatsOf(owner, type, g + 1),
          milli: k * 1000,
          weight,
        });
      }
      if (c > 0) {
        units.push({ row: r, owner, ty, n: c, w: weight });
        n += c;
        w += c * weight;
      }
    });
  }
  if (n === 0) return 0;
  const attackers: DuelPlanes[] = [];
  for (const e of enemyFighters) {
    e.counts.forEach((k, g) => {
      if (k > 0) {
        attackers.push({
          stats: air.planeStatsOf(e.owner, "cv_fighter", g + 1),
          milli: k * 1000,
          weight: 1,
        });
      }
    });
  }
  const duel =
    attackers.length === 0
      ? 0
      : Math.max(0, airDuelMilli(attackers, defenders, 1000));
  const lose = Math.min(n, Math.floor((aaMilli + duel + 500) / 1000));
  if (lose <= 0) return 0;
  const share = units.map(
    (u) => Math.floor((aaMilli * u.n) / n) + Math.floor((duel * u.n * u.w) / w),
  );
  const sum = share.reduce((a, b) => a + b, 0);
  const alloc = units.map((u, i) =>
    sum === 0 ? 0 : Math.min(u.n, Math.floor((lose * share[i]) / sum)),
  );
  let left = lose - alloc.reduce((a, b) => a + b, 0);
  const order = units
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = sum === 0 ? 0 : (lose * share[a]) % sum;
      const rb = sum === 0 ? 0 : (lose * share[b]) % sum;
      return rb - ra || a - b;
    });
  while (left > 0) {
    let gave = false;
    for (const i of order) {
      if (left === 0) break;
      if (alloc[i] < units[i].n) {
        alloc[i]++;
        left--;
        gave = true;
      }
    }
    if (!gave) break;
  }
  let lost = 0;
  units.forEach((u, i) => {
    let k = alloc[i];
    if (k <= 0) return;
    const d = t.deckOf(u.row);
    const counts = [0, 0, 0];
    for (let g = 0; g < 3 && k > 0; g++) {
      const take = Math.min(k, d[u.ty * 3 + g]);
      counts[g] = take;
      d[u.ty * 3 + g] -= take;
      k -= take;
    }
    const taken = counts[0] + counts[1] + counts[2];
    if (taken === 0) return;
    const type = CARRIER_AIR_TYPES[u.ty];
    const ce = navy.econ.country(u.owner);
    if (ce !== null) losePlanes(ce, type, counts);
    onPlanesLost(air, u.owner, by, type, taken);
    navy.markFleet(t.fleet[u.row]);
    lost += taken;
  });
  return lost;
}

/**
 * Spec §13.4, §14.9 (dailySeaRegion calls it, once per order): the
 * fleet's carriers, at sea in the port's sea region, strike the ships
 * docked in an enemy naval base: hit 150‰, no interception, half the
 * damage on the most visible ships with the lowest HP ratio first
 * (overflowing to the next), half split by visibility. Anti-air: the
 * ships' AA × 0.5 + the base's anti-air level × 5 planes. The line is
 * `ww1936_naval_battle` with `portStrike: 1`.
 */
export function carrierPortStrike(
  navy: WwNavy,
  fleet: number,
  port: number,
  tick: number,
): void {
  const f = navy.fleets.get(fleet);
  if (f === undefined || f.docked !== 0) return;
  if (isNoStrike(navy.scenario, port) || portStrikeBlock(navy, f, port)) return;
  const t = navy.ships;
  const carriers: number[] = [];
  let attack = 0;
  for (const id of f.ships) {
    const r = t.rowOf(id);
    if (r < 0 || t.cls[r] !== CV || t.org[r] <= 0) continue;
    const a = deckAttackCenti(navy, r, f.owner);
    if (a <= 0) continue;
    carriers.push(id);
    attack += a;
  }
  if (attack === 0) return;
  const harbor = navy.harborZone(port);
  const targets: {
    id: number;
    r: number;
    owner: number;
    vis: number;
    max: number;
  }[] = [];
  for (const fid of navy.fleetsIn(harbor)) {
    const g = navy.fleets.get(fid)!;
    if (g.docked !== port || !navy.isEnemy(f.owner, g.owner)) continue;
    for (const id of g.ships) {
      const r = t.rowOf(id);
      const s = navy.shipStatsOf(r);
      targets.push({ id, r, owner: g.owner, vis: s.vis, max: s.hpMilli });
    }
  }
  targets.sort((a, b) => a.id - b.id);
  if (targets.length === 0) return;
  const st = navy.econ.country(f.owner)?.stats;
  const adm = f.admiral === 0 ? undefined : navy.admirals.get(f.admiral);
  const mods =
    combineMods(
      [
        ((st?.navalStrikePct ?? 0) + (st?.carrierStrikePct ?? 0)) * 100,
        (adm?.skills[3] ?? 0) * 500,
        ((adm?.traits ?? 0) & AVIATOR) !== 0 ? 2000 : 0,
      ],
      [],
    ) - 10_000;
  const dmgOf = (atk: number, vis: number) =>
    shotDamageMilli(
      atk,
      mods,
      WW_HIT_PORT_PM,
      visFactorPm(vis, false),
      1000,
      1000,
      1000,
    );
  const pending = new Map<number, number>();
  // Half focused: the most visible first, then the lowest HP ratio, then the id.
  const focus = [...targets].sort(
    (a, b) =>
      b.vis - a.vis || t.hp[a.r] * b.max - t.hp[b.r] * a.max || a.id - b.id,
  );
  let rest = Math.floor(attack / 2);
  for (const x of focus) {
    if (rest <= 0) break;
    const left = t.hp[x.r] - (pending.get(x.id) ?? 0);
    if (left <= 0) continue;
    const full = dmgOf(rest, x.vis);
    if (full <= 0) break;
    if (full <= left) {
      pending.set(x.id, (pending.get(x.id) ?? 0) + full);
      rest = 0;
    } else {
      pending.set(x.id, (pending.get(x.id) ?? 0) + left);
      rest -= Math.max(1, Math.ceil((rest * left) / full));
    }
  }
  // Half by visibility.
  const spread = attack - Math.floor(attack / 2);
  const visSum = targets.reduce((a, x) => a + x.vis, 0);
  for (const x of targets) {
    const d = dmgOf(Math.floor((spread * x.vis) / Math.max(1, visSum)), x.vis);
    if (d > 0) pending.set(x.id, (pending.get(x.id) ?? 0) + d);
  }
  let aaCenti = 0;
  for (const x of targets) aaCenti += navy.shipStatsOf(x.r).aa;
  const sunkBy = new Map<number, number>();
  for (const x of targets) {
    const d = pending.get(x.id) ?? 0;
    if (d <= 0) continue;
    const s = navy.shipStatsOf(x.r);
    applyShipDamage(
      navy,
      x.id,
      d,
      orgDamageMilli(d, s.orgMilli, s.hpMilli),
      tick,
      f.owner,
    );
    if (t.rowOf(x.id) < 0) {
      sunkBy.set(x.owner, (sunkBy.get(x.owner) ?? 0) + 1);
    }
  }
  const aaMilli =
    aaCenti * 5 + effectiveLevel(navy.econ, port, "anti_air") * 5000;
  loseStrikePlanes(
    navy,
    carriers,
    aaMilli,
    [],
    navy.land.controller[port] ?? 0,
  );
  // The line: the striker's and every struck owner's human players.
  const sr = navy.scenario.zoneSr(harbor);
  const total = [...sunkBy.values()].reduce((a, b) => a + b, 0);
  navy.message(f.owner, "events_display.ww1936_naval_battle", {
    sr,
    zone: harbor,
    port,
    portStrike: 1,
    ours: 0,
    theirs: total,
  });
  const struck = [...new Set(targets.map((x) => x.owner))];
  for (const o of struck.sort((a, b) => a - b)) {
    navy.message(o, "events_display.ww1936_naval_battle", {
      sr,
      zone: harbor,
      port,
      portStrike: 1,
      ours: sunkBy.get(o) ?? 0,
      theirs: 0,
    });
  }
  navy.markFleet(f.id);
}
