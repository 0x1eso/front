// World War 1936 P5 lane X (plan Task 5 Steps 3, 4, 6; spec §5.2, §10,
// §11): governments in exile — the host, the forces that escape, the
// exile's day (legitimacy, virtual factories, political power), its return
// or collapse — and the takeover cards of a human left without a country.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSION_TYPES,
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  LAND_ZONE_MISSIONS,
  WW_MAX_DEPLOY_COUNT,
} from "@openfront/engine-api/ww1936/AirTypes";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  type EquipmentType,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  CS_ACTIVE,
  CS_GONE,
  WW_CAPITULATION_STOCK_TO_VICTOR_PCT,
  WW_DISBANDED_EQUIP_TO_VICTOR_PCT,
  WW_EXILE_ESCAPE_PCT,
  WW_EXILE_LEGIT_START_BP,
  WW_EXILE_MANPOWER_KEEP_PCT,
  WW_EXILE_PLANES_PCT,
  WW_EXILE_SHIP_ESCAPE_HP_PCT,
  WW_EXILE_STOCK_KEEP_PCT,
  WW_EXILE_ZERO_DAYS,
  WW_TAKEOVER_CARD_TICKS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  idleOrder,
} from "@openfront/engine-api/ww1936/LandTypes";
import { recruitableMen } from "@openfront/engine-lib/ww1936/EconomyRules";
import { returnDivisionEquip, returnEquip } from "../economy/Stock";
import { leaveBattle } from "../land/Battles";
import { capitalRegion } from "../land/LandStartRun";
import { stopDivision } from "../land/Movement";
import { atSea } from "../land/SeaLift";
import { foughtTest } from "../land/Sustain";
import { cancelInvasion } from "../navy/Invasions";
import { bestNavalBase } from "../navy/Ports";
import { joinFaction } from "../politics/Factions";
import { addSpirit, removeSpirit } from "../politics/Spirits";
import { landRegained } from "./Activate";
import { captureOnCapitulation } from "./Capture";
import { takeoverCandidates } from "./Takeover";
import type { EconAdjust, WwEndgame } from "./WwEndgame";

const NO_ELECTIONS = "gen_exile_no_elections";
const AIR_SET: ReadonlySet<EquipmentType> = new Set(AIR_TYPES);

// ---- The host (spec §10.2) ----

/** Controls at least one region (spec §10.2 "땅이 있음"). */
function hasLand(eg: WwEndgame, id: number): boolean {
  return eg.ww.politics.controlsAnyRegion(id);
}

/**
 * Spec §10.2: among `victor`'s enemies that still play on their own land
 * (not `loser`, not capitulated, not exiles): the loser's faction (its
 * leader first), a guarantor, a member of its side in one of its wars,
 * else the most factories (civilian + military; ties the smaller smallID).
 * 0: no host.
 */
export function pickHost(eg: WwEndgame, loser: number, victor: number): number {
  const pol = eg.ww.politics;
  if (victor === 0) return 0;
  const cands = eg.ww
    .enemiesOf(victor)
    .filter(
      (h) =>
        h !== loser &&
        eg.countryStateArr[h] === CS_ACTIVE &&
        !eg.ww.isCapitulated(h) &&
        !eg.isExile(h) &&
        hasLand(eg, h),
    )
    .sort((a, b) => a - b);
  if (cands.length === 0) return 0;
  const byF = (a: number, b: number) =>
    eg.factoriesOf(b) - eg.factoriesOf(a) || a - b;
  const f = pol.factionIdx(loser);
  if (f >= 0) {
    const same = cands.filter((h) => pol.factionIdx(h) === f);
    const leader = pol.faction(f)?.leader ?? 0;
    if (same.includes(leader)) return leader;
    if (same.length > 0) return same.sort(byF)[0];
  }
  const guarantors = pol.guarantorsOf(loser);
  const g = cands.filter((h) => guarantors.includes(h));
  if (g.length > 0) return g.sort(byF)[0];
  const side = cands.filter((h) =>
    eg.warsOf(loser).some((w) => {
      const x = eg.war(w);
      if (x === null || x.ended !== null) return false;
      const s = eg.sideIndex(x, loser);
      return s >= 0 && eg.sideIndex(x, h) === s;
    }),
  );
  if (side.length > 0) return side.sort(byF)[0];
  return [...cands].sort(byF)[0];
}

/**
 * Spec §10.5: the 1936 capital; when a treaty took it, the remaining core
 * region with the most points (then any legal region; ties the smaller id).
 */
function exileCapital(eg: WwEndgame, id: number): number {
  const sc = eg.ww.scenario;
  const legal = eg.ww.politics.legalOwner;
  const tag = sc.tagOfSmallId(id);
  const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
  const cap = tile === null ? 0 : sc.regionAt(tile);
  if (cap !== 0 && legal[cap] === id) return cap;
  let best = 0;
  let bestKey = -1;
  for (const r of sc.landRegions) {
    if (legal[r.id] !== id) continue;
    // A core first, then the points.
    const key = (eg.hasCore(id, r.id) ? 1_000_000 : 0) + r.vp;
    if (key > bestKey) {
      best = r.id;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Spec §5.1-3, §10.2: `loser` (capitulating to `victor`) becomes a
 * government in exile when it has a host — never in a civil war, nor a
 * subject losing its war of independence. The record goes in first, so
 * the pairs made below enter the war records as "exiled".
 */
export function formExile(
  eg: WwEndgame,
  loser: number,
  victor: number,
  tick: number,
): boolean {
  const ww = eg.ww;
  const pol = ww.politics;
  if (loser <= 0 || eg.isExile(loser)) return false;
  for (const wid of eg.warsOf(loser)) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null) continue;
    const m = eg.member(w, loser);
    if (m === null || m.state === "left") continue;
    if (w.kind === "civil") return false;
    if (w.kind === "independence" && eg.subjectOf(loser) !== null) return false;
  }
  const host = pickHost(eg, loser, victor);
  if (host === 0) return false;
  const day = ww.inPrep(tick) ? 0 : ww.day(tick);
  eg.exiles.push({
    smallID: loser,
    host,
    legitBp: WW_EXILE_LEGIT_START_BP,
    sinceDay: day,
    zeroDays: 0,
    lastDelta: 0,
    faction: pol.factionIdx(loser),
    capital: exileCapital(eg, loser),
  });
  reindexExiles(eg);
  // Its own wars go on, as an exile.
  for (const wid of [...eg.warsOf(loser)]) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null) continue;
    if (eg.member(w, loser)?.state === "active") {
      eg.setMemberState(w.id, loser, "exiled");
    }
  }
  // Spec §10.2: into the host's faction (no ideology rule) …
  const hf = pol.factionIdx(host);
  if (pol.factionIdx(loser) < 0 && hf >= 0) joinFaction(pol, loser, hf, tick);
  // … and into every war the host fights, on its side, against the other
  // side's active members.
  for (const w of [...eg.wars]) {
    if (w.ended !== null) continue;
    const s = eg.sideIndex(w, host);
    if (s < 0 || eg.member(w, host)!.state === "left") continue;
    if (eg.sideIndex(w, loser) === 1 - s) continue;
    for (const e of [...w.sides[1 - s].members]) {
      if (e.state !== "active" || e.id === loser) continue;
      if (ww.isAtWar(loser, e.id) || !eg.isActor(e.id)) continue;
      ww.setWar(loser, e.id, tick, { kind: "into", warId: w.id });
    }
  }
  // Spec §10.4: no elections in exile.
  addSpirit(pol, loser, NO_ELECTIONS, undefined, day);
  // Plan decision 20: its side is its host's from now (P2 sides again).
  pol.factionsChanged();
  return true;
}

function reindexExiles(eg: WwEndgame): void {
  eg.exileIdx = new Map(eg.exiles.map((e, i) => [e.smallID, i]));
  eg.dirtyExiles = true;
}

function removeExile(eg: WwEndgame, id: number): void {
  eg.exiles = eg.exiles.filter((e) => e.smallID !== id);
  reindexExiles(eg);
}

// ---- A capitulation's forces (spec §5.2) ----

/**
 * Spec §5.2: what a capitulated country keeps. With a host (an exile):
 * the divisions on its side's land and the strongest 20% (rounded up) of
 * the others not encircled teleport to the host's capital (org 0), the
 * rest disband (half their equipment to the victor); the stock keeps
 * half, a quarter to the victor; a quarter of the manpower; planes half;
 * ships at sea or in a friendly port (an enemy port: at half HP or more)
 * base at the host, the others scuttle; lines, queue and trades end.
 * Without one: lane A's capture, P2's removal, the ships at sea to the
 * faction's leader (exileFleets), the rest and the planes gone.
 */
export function capitulationForces(
  eg: WwEndgame,
  loser: number,
  victor: number,
  host: number,
  tick: number,
): void {
  if (host > 0 && eg.isExile(loser)) {
    exileForces(eg, loser, victor, host, tick);
    clearPlans(eg, loser);
    return;
  }
  // A: a quarter of the stock and half the divisions' equipment to the victor.
  captureOnCapitulation(eg, loser, victor);
  eg.ww.land.removeCountryForces(loser);
  // P4 (exileFleets first): ships at sea to the faction's leader, the rest scuttled.
  eg.ww.navy.onCapitulation(loser, victor);
  eg.ww.air.onCapitulation(loser, victor);
  clearPlans(eg, loser);
  const ce = eg.ww.economy.country(loser);
  if (ce !== null) {
    ce.stock.fill(0);
    ce.manpower = 0;
  }
}

/** Spec §5.2: lines, construction and naval lines go (trades: below or P1's daily check). */
function clearPlans(eg: WwEndgame, id: number): void {
  const econ = eg.ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  ce.lines = [];
  ce.queue = [];
  ce.navalLines = [];
  econ.markCountryDirty(id);
}

function exileForces(
  eg: WwEndgame,
  loser: number,
  victor: number,
  host: number,
  tick: number,
): void {
  const ww = eg.ww;
  const land = ww.land;
  const econ = ww.economy;
  const t = land.divisions;
  const ceL = econ.country(loser);
  const ceR = victor > 0 ? econ.country(victor) : null;
  const dest = capitalRegion(land, host);
  // Divisions: on its side's land all live; the others not encircled, the
  // strongest 20% (rounded up); aboard ships they sail on.
  const allied: number[] = [];
  const out: number[] = [];
  const lost: number[] = [];
  for (const r of land.rowsOf(loser)) {
    if (atSea(land, r)) continue;
    const c = land.controller[t.region[r]] ?? 0;
    if (c !== 0 && c !== loser && land.sameSide(host, c)) allied.push(r);
    else if (t.encircled[r] === 0) out.push(r);
    else lost.push(r);
  }
  out.sort((a, b) => land.strengthOf(b) - land.strengthOf(a) || a - b);
  const n = Math.ceil((out.length * WW_EXILE_ESCAPE_PCT) / 100);
  const saved = [...allied, ...out.slice(0, n)].sort((a, b) => a - b);
  lost.push(...out.slice(n));
  if (dest !== 0) {
    for (const r of saved) {
      leaveBattle(land, r);
      stopDivision(land, r);
      land.setDivisionRegion(r, dest);
      t.dest[r] = dest;
      t.org[r] = 0;
      land.markArmy(t.army[r]);
    }
  }
  for (const r of lost.sort((a, b) => a - b)) {
    if (ceR !== null) {
      for (let j = 0; j < GROUND_SLOTS; j++) {
        const q = t.equip[r * GROUND_SLOTS + j];
        returnEquip(
          ceR,
          GROUND_EQUIP_KEYS[j],
          Math.floor((q * WW_DISBANDED_EQUIP_TO_VICTOR_PCT) / 100),
        );
      }
    }
    land.killDivision(r, false);
  }
  // Its armies regroup where they are (an invasion plan ends).
  for (const a of land.armiesOf(loser).sort((x, y) => x.id - y.id)) {
    const sailing = a.divisions.some((id) => {
      const r = t.rowOf(id);
      return r >= 0 && atSea(land, r);
    });
    if (sailing) continue;
    cancelInvasion(ww.navy, a.id);
    a.order = idleOrder();
    a.path = [];
    a.front = [];
    a.pending = true;
    land.markArmy(a.id);
  }
  for (const inv of [...ww.navy.invasions.values()]) {
    if (inv.owner === loser && !land.armies.has(inv.army)) {
      cancelInvasion(ww.navy, inv.army);
    }
  }
  const cl = land.country(loser);
  if (cl !== null && ceL !== null) {
    for (const x of cl.trainees) returnDivisionEquip(ceL, x.equip, x.men);
    cl.training = [];
    cl.trainees = [];
    land.markCountry(loser);
  }
  exileNavy(eg, loser, victor, host, tick);
  // Planes: every deployment back to the stock (each type remembers the
  // mission of its biggest group), then half of them stay.
  const missions = new Map<number, [number, number]>();
  for (const d of ww.air.deploymentsOf(loser)) {
    const n = d.counts.reduce((a, b) => a + b, 0);
    if (n > (missions.get(d.type)?.[1] ?? 0))
      missions.set(d.type, [d.mission, n]);
    ww.air.removeDeployment(d.id, true);
  }
  if (ceL !== null) {
    EQUIP_KEYS.forEach(([type], k) => {
      const q = ceL.stock[k];
      if (q <= 0) return;
      if (AIR_SET.has(type)) {
        ceL.stock[k] = Math.floor((q * WW_EXILE_PLANES_PCT) / 100);
        return;
      }
      const toR = Math.floor((q * WW_CAPITULATION_STOCK_TO_VICTOR_PCT) / 100);
      if (ceR !== null) returnEquip(ceR, k, toR);
      ceL.stock[k] = Math.floor((q * WW_EXILE_STOCK_KEEP_PCT) / 100);
    });
    ceL.manpower = Math.floor(
      (ceL.manpower * WW_EXILE_MANPOWER_KEEP_PCT) / 100,
    );
    // An exile plays on: its deals end now (P1's daily check would keep them).
    for (const tr of [...econ.trades()]) {
      if (tr.buyer === loser || tr.seller === loser) econ.removeTrade(tr.id);
    }
  }
  if (ceR !== null && victor > 0) econ.markCountryDirty(victor);
  if (ceL !== null) exilePlanes(eg, loser, host, missions, tick);
}

/**
 * Spec §5.2, §10.4: the exile's planes fly from its host's air base (the
 * host's with the most room; ties the smaller region) — one P4 air_deploy
 * a type over that base's zone, its old mission when a land zone allows
 * it, else the first one that does. No host base (or no mission, carrier
 * wings): they wait in the stock.
 */
function exilePlanes(
  eg: WwEndgame,
  loser: number,
  host: number,
  missions: ReadonlyMap<number, [number, number]>,
  tick: number,
): void {
  const ww = eg.ww;
  const air = ww.air;
  const levels = ww.economy.buildingArray("air_base");
  let base = 0;
  let room = 0;
  for (let r = 1; r < levels.length; r++) {
    if (levels[r] === 0 || ww.land.controller[r] !== host) continue;
    const free = air.baseCapacity(r) - air.baseUse(r);
    if (free > room) {
      base = r;
      room = free;
    }
  }
  const sr = base === 0 ? 0 : ww.scenario.regionSr(base);
  const ce = ww.economy.country(loser);
  if (sr === 0 || ce === null) return;
  AIR_TYPES.forEach((type, ti) => {
    let count = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      count += ce.stock[equipKey(type, g)];
    }
    const old = missions.get(ti)?.[0] ?? -1;
    const fits = (m: AirMission) =>
      LAND_ZONE_MISSIONS.includes(m) && AIR_MISSION_TYPES[m].includes(type);
    const mission =
      old >= 0 && fits(AIR_MISSIONS[old])
        ? AIR_MISSIONS[old]
        : AIR_MISSIONS.find(fits);
    if (count <= 0 || mission === undefined) return;
    const order: WwOrder = {
      kind: "air_deploy",
      sr,
      type,
      mission,
      count: Math.min(count, WW_MAX_DEPLOY_COUNT),
    };
    air.issue(loser, order, tick);
  });
}

/**
 * Spec §5.2 ships of an exile: at sea or in a port no enemy holds, they
 * base at the host's best naval base (P4's fleet_base: they sail there);
 * in a port of the loser's (about to change hands) or an enemy's, a ship
 * below half its HP scuttles (removeShip, not sunk: nobody scores). No
 * host base: all scuttle.
 */
function exileNavy(
  eg: WwEndgame,
  loser: number,
  victor: number,
  host: number,
  tick: number,
): void {
  const ww = eg.ww;
  const navy = ww.navy;
  const base = bestNavalBase(ww, host);
  const hostile = (c: number) =>
    c !== 0 && (c === loser || c === victor || ww.isAtWar(loser, c));
  for (const f of navy.fleetsOf(loser).sort((a, b) => a.id - b.id)) {
    const enemyPort =
      f.docked !== 0 && hostile(ww.land.controller[f.docked] ?? 0);
    for (const id of [...f.ships]) {
      const r = navy.ships.rowOf(id);
      if (r < 0) continue;
      const max = navy.shipStatsOf(r).hpMilli;
      const weak =
        max > 0 && navy.ships.hp[r] * 100 < max * WW_EXILE_SHIP_ESCAPE_HP_PCT;
      if (base === 0 || (enemyPort && weak)) navy.removeShip(id, false, tick);
    }
    if (base === 0 || !navy.fleets.has(f.id)) continue;
    const order: WwOrder = { kind: "fleet_base", fleet: f.id, port: base };
    if (navy.issue(loser, order, tick, "ai") !== null) {
      // In a battle (or no way there yet): the home moves, P4 sails it later.
      f.home = base;
      navy.markFleet(f.id);
    }
  }
}

/**
 * P4's hook (navy/EndgameHooks.exileNavyAndAir, first in the navy's
 * onCapitulation; spec §5.2 without a host): the loser's ships at sea go to
 * its faction's leader (another member when the loser led it; P4's
 * transferShip: to its nearest base, or gone without one); what is still
 * the loser's after this — ships in port — P4 removes (scuttled). An
 * exile's fleets went with capitulationForces.
 */
export function exileFleets(
  eg: WwEndgame,
  loser: number,
  victor: number,
): void {
  void victor;
  if (eg.isExile(loser)) return;
  const pol = eg.ww.politics;
  const navy = eg.ww.navy;
  const fi = pol.factionIdx(loser);
  if (fi < 0) return;
  let to = pol.faction(fi)?.leader ?? 0;
  if (to === loser || !eg.isActor(to)) {
    to = 0;
    let bestF = -1;
    for (const m of pol.factionMembers(fi)) {
      if (m === loser || !eg.isActor(m)) continue;
      const f = eg.factoriesOf(m);
      if (f > bestF) {
        to = m;
        bestF = f;
      }
    }
  }
  if (to === 0) return;
  for (const f of navy.fleetsOf(loser).sort((a, b) => a.id - b.id)) {
    if (f.docked !== 0) continue;
    for (const id of [...f.ships]) navy.transferShip(id, to);
  }
}

// ---- The exile's day (spec §10.3–§10.5) ----

/** The other side's leader in the exile's oldest war (0: none). */
function opposingLeader(eg: WwEndgame, id: number): number {
  const w = eg.war(eg.oldestWarOf(id));
  if (w === null) return 0;
  const s = eg.sideIndex(w, id);
  return s < 0 ? 0 : w.sides[1 - s].leader;
}

/**
 * Spec §10.2–§10.5, the exile's turn: a new host when its host went (none:
 * the exile ends), home when it holds its capital, then legitimacy: −2,
 * +1 per percent of its legal points its side holds, +3 when its
 * divisions fought, +2 under a major host (the gains × legitimacyGainPct),
 * 0..10,000; 30 days at 0 end it.
 */
export function stepExile(eg: WwEndgame, id: number, day: number): void {
  const i = eg.exileIdx.get(id);
  if (i === undefined) return;
  const ww = eg.ww;
  const tick = eg.mg.ticks();
  const ex = eg.exiles[i];
  if (!eg.isActor(ex.host) || eg.isExile(ex.host)) {
    const enemy = opposingLeader(eg, id);
    const h = enemy === 0 ? 0 : pickHost(eg, id, enemy);
    if (h === 0) {
      endExile(eg, id, tick, "collapsed");
      return;
    }
    ex.host = h;
    eg.dirtyExiles = true;
    ww.politics.factionsChanged();
  }
  if (ex.capital > 0 && ww.land.controller[ex.capital] === id) {
    endExile(eg, id, tick, "returned");
    return;
  }
  const land = ww.land;
  const legal = ww.politics.legalOwner;
  let total = 0;
  let held = 0;
  for (const r of ww.scenario.landRegions) {
    if (legal[r.id] !== id) continue;
    total += r.vp;
    const c = land.controller[r.id] ?? 0;
    if (c !== 0 && land.sameSide(id, c)) held += r.vp;
  }
  let gain = total > 0 ? Math.floor((held * 100) / total) : 0;
  const fought = foughtTest(id, day, ww.prepEndTick());
  const t = land.divisions;
  if (land.rowsOf(id).some((r) => fought(t.lastFight[r]))) gain += 3;
  if (COUNTRIES[ww.tagOf(ex.host)].major) gain += 2;
  const pct = ww.politics.stats(id).legitimacyGainPct;
  const delta = -2 + Math.floor((gain * Math.max(0, 100 + pct)) / 100);
  const next = Math.max(0, Math.min(10_000, ex.legitBp + delta));
  ex.lastDelta = next - ex.legitBp;
  ex.legitBp = next;
  ex.zeroDays = next === 0 ? ex.zeroDays + 1 : 0;
  eg.dirtyExiles = true;
  if (ex.zeroDays >= WW_EXILE_ZERO_DAYS) endExile(eg, id, tick, "collapsed");
}

/**
 * Spec §10.5–§10.6. "returned": a normal country again (its war records'
 * "exiled" back to "active", elections again). "collapsed": its divisions,
 * fleets and planes disband (the equipment to the host's stock), its wars
 * end, it is gone; a human gets a takeover card. An exile that holds land
 * when it collapses only stops being an exile (it plays on with its land).
 */
export function endExile(
  eg: WwEndgame,
  id: number,
  tick: number,
  reason: "returned" | "collapsed",
): void {
  const i = eg.exileIdx.get(id);
  if (i === undefined) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const tag = ww.tagOf(id);
  const host = eg.exiles[i].host;
  const withLand = pol.controlsAnyRegion(id);
  if (reason === "returned" || withLand) {
    removeExile(eg, id);
    for (const w of eg.wars) {
      if (w.ended !== null) continue;
      if (eg.member(w, id)?.state === "exiled") {
        eg.setMemberState(w.id, id, "active");
      }
    }
    removeSpirit(pol, id, NO_ELECTIONS);
    landRegained(eg, id, tick);
    pol.factionsChanged();
    if (reason === "returned") {
      eg.news("news_exile_returned", { tag });
      eg.messageAll("ww1936_exile_returned", { tag });
    } else {
      eg.messageAll("ww1936_exile_ended", { tag });
    }
    return;
  }
  disbandExile(eg, id, host, tick);
  // The card reads the faction of the exile's record: before it goes.
  const client = eg.humanClientOf(id);
  if (client !== null) offerTakeover(eg, client, id, tick);
  removeExile(eg, id);
  for (const w of eg.wars) {
    if (w.ended !== null) continue;
    const m = eg.member(w, id);
    if (m !== null && (m.state === "exiled" || m.state === "active")) {
      eg.setMemberState(w.id, id, "capitulated");
    }
  }
  ww.endWarsOf(id);
  removeSpirit(pol, id, NO_ELECTIONS);
  eg.setCountryState(id, CS_GONE);
  pol.factionsChanged();
  eg.messageAll("ww1936_exile_ended", { tag });
}

/** Spec §10.6: an exile's forces go; their equipment and the stock to the host. */
function disbandExile(
  eg: WwEndgame,
  id: number,
  host: number,
  tick: number,
): void {
  void tick;
  const ww = eg.ww;
  const land = ww.land;
  const econ = ww.economy;
  const t = land.divisions;
  const ce = econ.country(id);
  const ceH = econ.country(host);
  for (const r of [...land.rowsOf(id)]) {
    if (ceH !== null) {
      for (let j = 0; j < GROUND_SLOTS; j++) {
        returnEquip(ceH, GROUND_EQUIP_KEYS[j], t.equip[r * GROUND_SLOTS + j]);
      }
    }
    land.killDivision(r, false);
  }
  const cl = land.country(id);
  if (cl !== null && ceH !== null) {
    for (const x of cl.trainees) returnDivisionEquip(ceH, x.equip, 0);
  }
  land.removeCountryForces(id);
  // Still an exile here: P4's hook leaves its fleets to P4, which removes them.
  ww.navy.onCapitulation(id, host);
  for (const d of ww.air.deploymentsOf(id)) ww.air.removeDeployment(d.id, true);
  ww.air.onCapitulation(id, host);
  if (ce !== null) {
    if (ceH !== null) {
      ce.stock.forEach((q, k) => returnEquip(ceH, k, q));
      econ.markCountryDirty(host);
    }
    ce.stock.fill(0);
    ce.manpower = 0;
  }
  clearPlans(eg, id);
}

/** Spec §10.4: virtual military factories and the manpower of its occupied cores. */
export function exileEconomy(eg: WwEndgame, id: number, out: EconAdjust): void {
  const i = eg.exileIdx.get(id);
  if (i === undefined) return;
  const legit = eg.exiles[i].legitBp;
  out.virtualMil += Math.floor(legit / 1000);
  const ww = eg.ww;
  const ce = ww.economy.country(id);
  if (ce === null) return;
  const permille = ce.law().conscriptionPermille;
  let men = 0;
  for (const r of ww.scenario.landRegions) {
    if (!eg.hasCore(id, r.id)) continue;
    const c = ww.land.controller[r.id] ?? 0;
    if (c === 0 || !ww.isAtWar(id, c)) continue;
    men += recruitableMen(r.pop, 100, permille, ce.stats.recruitablePct);
  }
  out.manpower += Math.floor((men * 15 * legit) / (100 * 10_000));
}

/** Spec §10.4: an exile's daily political power, 50..100%. */
export function exilePpFactorPct(eg: WwEndgame, id: number): number {
  const i = eg.exileIdx.get(id);
  if (i === undefined) return 100;
  return 50 + Math.floor(eg.exiles[i].legitBp / 200);
}

// ---- Takeover (spec §11) ----

/** Spec §11.2: no candidate (or none left) — the human watches. */
function spectate(eg: WwEndgame, client: string, from: number): void {
  // Told while the country is still theirs (the message goes to its player).
  const p = eg.mg.playerBySmallID(from);
  if (p.isPlayer()) {
    eg.mg.displayMessage(
      "events_display.ww1936_spectating",
      MessageType.WORLD_WAR,
      p.id(),
    );
  }
  eg.setControl(client, 0);
}

/**
 * Spec §11.1–§11.2: a human whose country is gone gets a takeover card
 * (30 s: the top three same-faction AI countries), else spectates.
 */
export function offerTakeover(
  eg: WwEndgame,
  client: string,
  fromSmallID: number,
  tick: number,
): void {
  const candidates = takeoverCandidates(eg, fromSmallID);
  const before = eg.takeoverCards.length;
  eg.takeoverCards = eg.takeoverCards.filter((c) => c.client !== client);
  if (eg.takeoverCards.length !== before) eg.dirtyTakeover = true;
  if (candidates.length === 0) {
    spectate(eg, client, fromSmallID);
    return;
  }
  eg.takeoverCards.push({
    client,
    from: fromSmallID,
    candidates,
    deadlineTick: tick + WW_TAKEOVER_CARD_TICKS,
    pick: 0,
  });
  eg.takeoverCards.sort((a, b) =>
    a.client < b.client ? -1 : a.client > b.client ? 1 : 0,
  );
  eg.dirtyTakeover = true;
}

/**
 * Spec §11.3 (plan decision 35), order 8: in clientID order, every card
 * picked or past its deadline — the pick (else the first candidate) when
 * no human has it and it still plays, else the first such candidate left,
 * else spectating. The old country's event cards go.
 */
export function resolveTakeovers(eg: WwEndgame, tick: number): void {
  if (eg.takeoverCards.length === 0) return;
  const due = eg.takeoverCards.filter(
    (c) => c.pick > 0 || tick >= c.deadlineTick,
  );
  if (due.length === 0) return;
  eg.takeoverCards = eg.takeoverCards.filter((c) => !due.includes(c));
  eg.dirtyTakeover = true;
  const pol = eg.ww.politics;
  const free = (id: number) =>
    id > 0 && !eg.isHumanControlled(id) && eg.isActor(id);
  for (const c of due) {
    const first = c.pick > 0 ? c.pick : (c.candidates[0] ?? 0);
    const to = free(first) ? first : (c.candidates.find(free) ?? 0);
    const old = pol.country(c.from);
    if (old !== null && old.pending.length > 0) {
      old.pending = [];
      pol.markCountry(c.from);
    }
    if (to === 0) {
      spectate(eg, c.client, c.from);
      continue;
    }
    eg.setControl(c.client, to);
    eg.messageAll("ww1936_takeover", {
      client: c.client,
      fromTag: eg.ww.tagOf(c.from),
      toTag: eg.ww.tagOf(to),
    });
  }
}

/**
 * takeover_pick from `client` (spec §11.3; routed by clientID, since the
 * sender has no country left): one of its card's candidates, resolved at
 * order 8 of the next tick (the order applies in its execution's init,
 * after this tick's WorldWarExecution).
 */
export function takeoverPick(
  eg: WwEndgame,
  client: string,
  pick: number,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const card = eg.takeoverCards.find((c) => c.client === client);
  if (card === undefined || !card.candidates.includes(pick)) {
    return "no_takeover";
  }
  card.pick = pick;
  eg.dirtyTakeover = true;
  return null;
}
