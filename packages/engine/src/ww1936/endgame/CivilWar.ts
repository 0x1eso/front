// World War 1936 P5 lane C (plan Task 7, spec §15): civil wars. A country
// splits by an ideology's popularity into the first free civil-war slot:
// regions (engine-lib splitRegionsForCivilWar), divisions, stock, manpower,
// ships and planes, laws and politics; the two fight a "civil" war that ends
// by annexation, never by a conference. All integer, fixed orders, no PRNG.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  CIVIL_WAR_SLOTS,
  COUNTRIES,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { equipKey, LAW_KINDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { CS_DORMANT, CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { MOVE_SEA } from "@openfront/engine-api/ww1936/LandTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  IDEO_COM,
  IDEO_FAS,
  IDEOLOGIES,
  Ideology,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  civilWarColor,
  civilWarNameKey,
  civilWarShareBp,
  packRgb,
  RegionGraphView,
  splitRegionsForCivilWar,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { addPopularity } from "@openfront/engine-lib/ww1936/PoliticsRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { SHIP_BASE } from "@openfront/engine-lib/ww1936/ShipStats";
import {
  evictDivisions,
  transferArmyTo,
  transferDivisionsTo,
  transferRegionPeaceful,
} from "../land/PoliticsBridge";
import type { Army } from "../land/WwLand";
import { navalPortsOf } from "../navy/Ports";
import { leaveFaction } from "../politics/Factions";
import { governmentLeader, setGovernment } from "../politics/Ideology";
import { setLawFree } from "../politics/Laws";
import { addSpirit } from "../politics/Spirits";
import { activateCountry } from "./Activate";
import { offerTakeover } from "./Exile";
import { makeSubject } from "./Subjects";
import type { WwEndgame } from "./WwEndgame";

/** Spec §15.4: the rebels' vote for their ideology, stability and war support (bp). */
const REBEL_POP_BP = 7000;
const REBEL_STAB_BP = 5000;
const REBEL_WS_BP = 7000;
/** Spec §15.4: the government's stability base falls by 10%. */
const GOV_STAB_LOSS_BP = 1000;
/** P3 spec §5.8: gen_civil_strife lasts 180 days. */
const STRIFE_DAYS = 180;
const COUNTRY_KEY = "ww1936.country.";

/**
 * Spec §15.1: `smallID` splits; true when a civil war began (P3 then does
 * nothing more). False — P3's government change instead — when the
 * ideology already rules, the country does not play (or is an exile, or is
 * already one side of a civil war), every civil-war slot is used, or the
 * split leaves the rebels nothing.
 */
export function startCivilWar(
  eg: WwEndgame,
  smallID: number,
  ideology: Ideology,
  tick: number,
): boolean {
  const ww = eg.ww;
  const sc = ww.scenario;
  const pol = ww.politics;
  const X = smallID;
  const c = pol.country(X);
  const ideo = IDEOLOGIES.indexOf(ideology);
  if (c === null || ideo < 0 || c.ruling === ideo) return false;
  if (!eg.isActor(X) || eg.isExile(X) || inCivilWar(eg, X)) return false;
  const slotTag = CIVIL_WAR_SLOTS.find((t) => {
    const id = sc.smallIdOf(t);
    return id > 0 && eg.countryStateArr[id] === CS_DORMANT;
  });
  if (slotTag === undefined) return false;
  const share = civilWarShareBp(c.pop[ideo]);
  const cands = sc.landRegions
    .filter((r) => pol.legalOwner[r.id] === X && ww.land.controller[r.id] === X)
    .map((r) => r.id);
  const capital = capitalRegionOf(eg, X, cands);
  const tag = nameTagOf(eg, X);
  const seeds = pol.content.seeds
    .filter((s) => s.tag === tag && s.ideology === ideology)
    .flatMap((s) => pol.content.groupIdx.get(s.group)?.regions ?? []);
  const rebel = splitRegionsForCivilWar(
    regionGraph(sc),
    cands,
    capital,
    seeds,
    (r) => sc.region(r)?.vp ?? 0,
    share,
  );
  if (rebel.length === 0) return false;
  const rebelSet = new Set(rebel);
  // What stands and docks there before the land moves (the woken slot may
  // evict X's divisions; a port changing sides sends X's fleets away).
  const before = divisionsBefore(eg, X);
  const held = holdPortFleets(eg, X, rebelSet);
  const portShips = held.ships;
  const slot = activateCountry(
    eg,
    slotTag,
    {
      regions: rebel,
      divisions: 0,
      techFrom: X,
      techAll: true,
      faction: "none",
      government: { ideology },
      nameKey: civilWarNameKey(ideology),
      nameArg: tag,
      color: packRgb(civilWarColor(COUNTRIES[tag].color, ideology)),
    },
    tick,
  );
  if (slot === 0) {
    // The woken slot failed: the fleets go back into their docks.
    for (const h of held.docks) {
      const f = eg.ww.navy.fleetsOf(X).find((x) => x.id === h.id);
      if (f === undefined) continue;
      f.docked = h.docked;
      eg.ww.navy.markFleet(f.id);
    }
    return false;
  }
  splitForces(eg, X, slot, rebelSet, share, before, portShips);
  splitPolitics(eg, X, slot, ideo, tick);
  ww.setWar(slot, X, tick, { kind: "declare", war: "civil" });
  // Laws once at war: P3 §5.6-4 lets a government at war keep its trade law.
  copyLaws(eg, X, slot, ideo);
  pol.recomputeStats(slot);
  pol.recomputeStats(X);
  pol.markGlobal();
  eg.news("news_civil_war", { tag, ideology });
  return true;
}

/**
 * Spec §15.5: civil war `warId` ended with side `winner` on top. The
 * losing party (its side's first member) is annexed by the winning one:
 * every region it holds legally or controls, a core of the winner wherever
 * the loser had one, its divisions disbanded, its fleets to the winner; it
 * is gone (no exile, no conference). A winning breakaway state takes the
 * old country's name; the Spanish pair gets esp_civil_war_ends.
 */
export function endCivilWar(
  eg: WwEndgame,
  warId: number,
  winner: 0 | 1,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const land = ww.land;
  const sc = ww.scenario;
  const w = eg.war(warId);
  if (w === null || w.kind !== "civil") return;
  const W = w.sides[winner].members[0]?.id ?? 0;
  const L = w.sides[1 - winner].members[0]?.id ?? 0;
  if (W === 0 || L === 0 || W === L) return;
  if (w.ended === null) {
    w.ended = { day: ww.inPrep(tick) ? 0 : ww.day(tick), winner };
    eg.dirtyWars = true;
  }
  const client = eg.humanClientOf(L);
  // Land: the legal owner now, control by P3's peaceful transfer (the
  // victory-point tile this tick); tiles on their way go on to W.
  // A region the loser merely held for a third country goes back to that
  // legal owner, not the winner.
  const taken: { r: number; to: number }[] = [];
  for (const r of sc.landRegions) {
    if (pol.legalOwner[r.id] === L) pol.setLegalOwner(r.id, W);
    if (eg.hasCore(L, r.id)) eg.addCore(W, r.id);
    if (land.controller[r.id] === L) {
      const owner = pol.legalOwner[r.id];
      taken.push({ r: r.id, to: owner > 0 && owner !== L ? owner : W });
    }
  }
  for (const t of ww.transfers()) {
    if (t.to === L || t.from === L) t.to = W;
  }
  // Forces: the divisions are disbanded (spec §15.5); the fleets join the
  // winner's navy, the air deployments go back to the stock (P4 decision 32).
  land.removeCountryForces(L);
  ww.navy.transferUnits(L, W, "transfer");
  ww.air.transferUnits(L, W, "transfer");
  for (const t of taken) transferRegionPeaceful(land, t.r, t.to, tick);
  for (const s of eg.subjectsOf(L)) {
    const sub = eg.subjectOf(s)!;
    makeSubject(eg, s, W, sub.level, sub.neutral, tick);
  }
  // Its other wars end as a capitulation ends them — without an exile:
  // the loser of a civil war does not go abroad.
  ww.addCapitulation(L, W, tick);
  for (const x of eg.wars) {
    if (x.ended !== null) continue;
    const m = eg.member(x, L);
    if (m !== null && m.state === "active") {
      eg.setMemberState(x.id, L, "capitulated");
    }
  }
  ww.endWarsOf(L);
  pol.onCapitulated(L, W, tick);
  if (pol.factionIdx(L) >= 0) leaveFaction(pol, L, tick);
  eg.setCountryState(L, CS_GONE);
  // Spec §3.5, §15.5: the winning breakaway state is the country now.
  if (isCivilWarSlot(eg, W)) {
    eg.nameKey[W] = `${COUNTRY_KEY}${nameTagOf(eg, L)}`;
    eg.nameArg[W] = null;
    eg.dirtyCountries.add(W);
  }
  // Spec §15.6: the Spanish Civil War's end (K5's event renames and lifts
  // the spirit).
  const esn = sc.smallIdOf("ESN");
  const esr = sc.smallIdOf("ESR");
  if (
    esn > 0 &&
    esr > 0 &&
    ((W === esn && L === esr) || (W === esr && L === esn))
  ) {
    pol.queueEvent("esp_civil_war_ends", W, W, 0, 0);
    pol.flushEvents(tick);
  }
  if (client !== null) offerTakeover(eg, client, L, tick);
  pol.recomputeStats(W);
  pol.markCountry(W);
  pol.markCountry(L);
  pol.markGlobal();
  land.markCountry(W);
  land.markCountry(L);
}

// ---- Helpers ----

/** A side's first member (a party, not a joiner) of an ongoing civil war. */
function inCivilWar(eg: WwEndgame, id: number): boolean {
  return eg.wars.some(
    (w) =>
      w.kind === "civil" &&
      w.ended === null &&
      w.sides.some((s) => s.members[0]?.id === id),
  );
}

function isCivilWarSlot(eg: WwEndgame, id: number): boolean {
  return (CIVIL_WAR_SLOTS as readonly string[]).includes(eg.ww.tagOf(id));
}

/**
 * The tag whose name the country carries: a breakaway state renamed after
 * its old country (`ww1936.country.<TAG>`) is that country; else its own.
 */
function nameTagOf(eg: WwEndgame, id: number): CountryTag {
  const key = eg.nameKey[id];
  if (key !== null && key.startsWith(COUNTRY_KEY)) {
    const t = key.slice(COUNTRY_KEY.length) as CountryTag;
    if (COUNTRIES[t] !== undefined) return t;
  }
  return eg.ww.tagOf(id);
}

/**
 * Spec §15.2: the capital stays — the scenario (or woken) capital when it
 * is a candidate, else the candidate with the most points (ties: smaller id).
 */
function capitalRegionOf(
  eg: WwEndgame,
  id: number,
  cands: readonly number[],
): number {
  const cap = eg.capitalRegion(id);
  if (cands.includes(cap)) return cap;
  let best = 0;
  let bestVp = -1;
  for (const r of cands) {
    const vp = eg.ww.scenario.region(r)?.vp ?? 0;
    if (vp > bestVp) {
      best = r;
      bestVp = vp;
    }
  }
  return best;
}

/** The land graph (P2's edges), neighbours ascending and once each. */
function regionGraph(sc: ScenarioIndex): RegionGraphView {
  return {
    neighbours: (r) =>
      [...new Set(sc.edgesOf(r).map((e) => e.to))].sort((a, b) => a - b),
  };
}

/** Region → edges from the nearest of `from` (BFS, land graph); absent: unreachable. */
function distancesFrom(
  sc: ScenarioIndex,
  from: readonly number[],
): Map<number, number> {
  const dist = new Map<number, number>();
  const q = [...from].sort((a, b) => a - b);
  for (const r of q) dist.set(r, 0);
  for (let h = 0; h < q.length; h++) {
    const d = dist.get(q[h])! + 1;
    for (const e of sc.edgesOf(q[h])) {
      if (dist.has(e.to)) continue;
      dist.set(e.to, d);
      q.push(e.to);
    }
  }
  return dist;
}

/** X's divisions that can change sides (not volunteers abroad, not at sea): id → region. */
function divisionsBefore(eg: WwEndgame, X: number): Map<number, number> {
  const land = eg.ww.land;
  const t = land.divisions;
  const out = new Map<number, number>();
  for (const r of land.rowsOf(X)) {
    if (t.mode[r] === MOVE_SEA) continue;
    const a = land.armies.get(t.army[r]);
    if (a !== undefined && a.volunteerFor > 0) continue;
    out.set(t.id[r], t.region[r]);
  }
  return out;
}

/**
 * Spec §15.3 ships: X's fleets docked at a working naval base of a rebel
 * region go to the rebels. They leave the dock before the land moves (else
 * P4's onControlChanged sends them to sea, or scuttles them when X has no
 * other base); splitShips hands their ships over the same tick. Ship ids.
 */
function holdPortFleets(
  eg: WwEndgame,
  X: number,
  rebel: ReadonlySet<number>,
): { ships: number[]; docks: { id: number; docked: number }[] } {
  const navy = eg.ww.navy;
  const out: number[] = [];
  const docks: { id: number; docked: number }[] = [];
  for (const f of navy.fleetsOf(X)) {
    if (f.docked === 0 || !rebel.has(f.docked)) continue;
    if (!navy.isPort(f.docked) || navy.harborZone(f.docked) === 0) continue;
    docks.push({ id: f.id, docked: f.docked });
    f.docked = 0;
    navy.markFleet(f.id);
    out.push(...f.ships);
  }
  return { ships: out.sort((a, b) => a - b), docks };
}

/** Spec §15.3: divisions, generals, ships, planes, stock, manpower, fuel. */
function splitForces(
  eg: WwEndgame,
  X: number,
  R: number,
  rebel: ReadonlySet<number>,
  share: number,
  before: ReadonlyMap<number, number>,
  portShips: readonly number[],
): void {
  splitDivisions(eg, X, R, rebel, share, before);
  splitShips(eg, X, R, share, portShips);
  splitPlanes(eg, X, R, rebel);
  const econ = eg.ww.economy;
  const xe = econ.country(X);
  const re = econ.country(R);
  if (xe === null || re === null) return;
  // Every stock slot (planes in stock too): ⌊× s⌋.
  for (let k = 0; k < xe.stock.length; k++) {
    const m = Math.floor((xe.stock[k] * share) / 10000);
    xe.stock[k] -= m;
    re.stock[k] += m;
  }
  // The pool is the share alone (a woken slot's own start pool would be
  // men out of nowhere).
  const men = Math.floor((xe.manpower * share) / 10000);
  xe.manpower -= men;
  re.manpower = men;
  const fuel = Math.floor((xe.fuelMilli * share) / 10000);
  xe.fuelMilli -= fuel;
  re.fuelMilli += fuel;
  econ.markCountryDirty(X);
  econ.markCountryDirty(R);
}

/**
 * Spec §15.3 divisions: X's divisions in the rebel regions are the rebels';
 * when their count is off round(n × s) by more than one, the nearest of X's
 * others (land-graph edges from the rebel regions, then id) join them, or
 * the rebels' nearest to X's regions go back, until it is round(n × s).
 * Whole armies change hands with their general; a split army's part is a
 * new rebel army. A division left on the other side's land goes to its own
 * side's nearest region at once.
 */
function splitDivisions(
  eg: WwEndgame,
  X: number,
  R: number,
  rebel: ReadonlySet<number>,
  share: number,
  before: ReadonlyMap<number, number>,
): void {
  const ww = eg.ww;
  const land = ww.land;
  const sc = ww.scenario;
  const t = land.divisions;
  const ids = [...before.keys()].sort((a, b) => a - b);
  const want = Math.floor((ids.length * share + 5000) / 10000);
  const going = new Set(ids.filter((id) => rebel.has(before.get(id)!)));
  if (going.size < want - 1) {
    const d = distancesFrom(sc, [...rebel]);
    const rest = ids
      .filter((id) => !going.has(id))
      .sort((a, b) => byDist(d, before, a, b));
    for (const id of rest) {
      if (going.size >= want) break;
      going.add(id);
    }
  } else if (going.size > want + 1) {
    const mine = sc.landRegions
      .filter((r) => !rebel.has(r.id) && land.controller[r.id] === X)
      .map((r) => r.id);
    const d = distancesFrom(sc, mine);
    const back = [...going].sort((a, b) => byDist(d, before, a, b));
    for (const id of back) {
      if (going.size <= want) break;
      going.delete(id);
    }
  }
  // By army, ascending: whole armies with their general, else a new army.
  const byArmy = new Map<number, number[]>();
  for (const id of [...going].sort((a, b) => a - b)) {
    const r = t.rowOf(id);
    if (r < 0 || t.owner[r] !== X) continue;
    const l = byArmy.get(t.army[r]);
    if (l === undefined) byArmy.set(t.army[r], [id]);
    else l.push(id);
  }
  const tplMap = new Map<number, number>();
  for (const armyId of [...byArmy.keys()].sort((a, b) => a - b)) {
    const list = byArmy.get(armyId)!;
    const a = land.armies.get(armyId);
    if (a !== undefined && a.divisions.every((id) => going.has(id))) {
      const general = a.general;
      const dest = transferArmyTo(land, a, R, tplMap);
      moveGeneral(eg, X, R, general, dest);
    } else {
      transferDivisionsTo(land, list, R);
    }
  }
  // Each side's divisions back on its own land.
  for (const r of sc.landRegions) {
    const c = land.controller[r.id];
    const rows = land.rowsIn(r.id);
    if (c !== R && rows.some((x) => t.owner[x] === R)) {
      evictDivisions(land, r.id, R);
    }
    if (c === R && rows.some((x) => t.owner[x] === X)) {
      evictDivisions(land, r.id, X);
    }
  }
  land.markCountry(X);
  land.markCountry(R);
}

function byDist(
  d: ReadonlyMap<number, number>,
  at: ReadonlyMap<number, number>,
  a: number,
  b: number,
): number {
  const da = d.get(at.get(a)!) ?? Number.MAX_SAFE_INTEGER;
  const db = d.get(at.get(b)!) ?? Number.MAX_SAFE_INTEGER;
  return da - db || a - b;
}

/**
 * Spec §15.3 generals: the army's general goes with it — out of X's list,
 * into the rebels' (P2's roster row keeps its country), at the head of the
 * army when that has none.
 */
function moveGeneral(
  eg: WwEndgame,
  X: number,
  R: number,
  general: number,
  dest: Army | null,
): void {
  if (general === 0) return;
  const land = eg.ww.land;
  const xl = land.country(X);
  const rl = land.country(R);
  if (xl === null || rl === null) return;
  const g = xl.generals.find((x) => x.id === general);
  if (g === undefined || rl.generals.some((x) => x.id === general)) return;
  xl.generals = xl.generals.filter((x) => x !== g);
  g.army = 0;
  if (dest !== null && dest.owner === R && dest.general === 0) {
    g.army = dest.id;
    dest.general = g.id;
    land.markArmy(dest.id);
  }
  rl.generals.push(g);
  land.markCountry(X);
  land.markCountry(R);
}

/**
 * Spec §15.3 ships: the held port fleets' ships go to the rebels (P4
 * transferShip: their port's new-ships fleet); then, while the rebels'
 * supremacy weight is under half their share of the two navies, X's
 * lightest ships (ties: id) that can reach a rebel base follow.
 */
function splitShips(
  eg: WwEndgame,
  X: number,
  R: number,
  share: number,
  portShips: readonly number[],
): void {
  const ww = eg.ww;
  const navy = ww.navy;
  const t = navy.ships;
  for (const id of portShips) {
    const r = t.rowOf(id);
    if (r >= 0 && t.owner[r] === X) navy.transferShip(id, R);
  }
  const harbors = navalPortsOf(ww, R)
    .map((p) => navy.harborZone(p))
    .filter((z) => z !== 0);
  if (harbors.length === 0) return;
  const weight = (r: number) => SHIP_BASE[SHIP_CLASSES[t.cls[r]]].supWeight;
  let xw = 0;
  let rw = 0;
  const xShips: { id: number; w: number }[] = [];
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0) continue;
    if (t.owner[r] === X) {
      xw += weight(r);
      xShips.push({ id: t.id[r], w: weight(r) });
    } else if (t.owner[r] === R) {
      rw += weight(r);
    }
  }
  // rw / (rw + xw) < s / 2, in bp.
  const short = () => rw * 20000 < (rw + xw) * share;
  if (!short()) return;
  xShips.sort((a, b) => a.w - b.w || a.id - b.id);
  const passable = navy.passable(R, true);
  for (const s of xShips) {
    if (!short()) break;
    const r = t.rowOf(s.id);
    if (r < 0 || t.owner[r] !== X) continue;
    const zone = navy.fleets.get(t.fleet[r])?.zone ?? 0;
    if (zone === 0) continue;
    if (seaPath(ww.scenario, [zone], harbors, passable) === null) continue;
    navy.transferShip(s.id, R);
    const nr = t.rowOf(s.id);
    if (nr >= 0 && t.owner[nr] === R) {
      xw -= s.w;
      rw += s.w;
    }
  }
}

/**
 * Spec §15.3 planes: X's air deployments at bases in rebel regions are the
 * rebels' (their planes move from X's deployed ledger to the rebels'); the
 * planes in stock are split with the stock; carrier wings follow their
 * decks (the ships' rule).
 */
function splitPlanes(
  eg: WwEndgame,
  X: number,
  R: number,
  rebel: ReadonlySet<number>,
): void {
  const air = eg.ww.air;
  const econ = eg.ww.economy;
  const xe = econ.country(X);
  const re = econ.country(R);
  if (xe === null || re === null) return;
  const moving = air
    .deploymentsOf(X)
    .filter((d) => d.base > 0 && d.volunteerFor === 0 && rebel.has(d.base))
    .sort((a, b) => a.id - b.id);
  if (moving.length === 0) return;
  // A group's target (owner, zone, type, mission) is its planes now.
  const groupSum = new Map<string, number>();
  const keyOf = (d: (typeof moving)[number]) =>
    `${d.sr}:${d.type}:${d.mission}`;
  for (const d of moving) {
    const type = AIR_TYPES[d.type];
    d.counts.forEach((n, i) => {
      const k = equipKey(type, i + 1);
      if (k < 0 || n <= 0) return;
      const m = Math.min(n, xe.planesDeployed[k]);
      xe.planesDeployed[k] -= m;
      re.planesDeployed[k] += m;
    });
    d.owner = R;
    d.auto = false;
    const sum = d.counts.reduce((a, b) => a + b, 0);
    groupSum.set(keyOf(d), (groupSum.get(keyOf(d)) ?? 0) + sum);
    air.markDeployment(d.id);
  }
  for (const d of moving) d.target = groupSum.get(keyOf(d)) ?? 0;
  air.markCountry(X);
  air.markCountry(R);
}

/** Spec §15.4. */
function splitPolitics(
  eg: WwEndgame,
  X: number,
  R: number,
  ideo: number,
  tick: number,
): void {
  const pol = eg.ww.politics;
  const xc = pol.country(X);
  const rc = pol.country(R);
  if (xc === null || rc === null) return;
  const day = pol.day();
  if (rc.ruling !== ideo) setGovernment(pol, R, ideo, tick);
  // The leader: X's table's leader of the ideology (else its title).
  const leader = governmentLeader(pol, X, ideo, day);
  rc.leader = leader;
  rc.advisors = rc.advisors.map((a) => (a === leader ? null : a));
  xc.advisors = xc.advisors.map((a) => (a === leader ? null : a));
  // 70% for the ideology, the rest as X's other ideologies stand.
  for (let i = 0; i < rc.pop.length; i++) rc.pop[i] = xc.pop[i];
  addPopularity(rc.pop, ideo, REBEL_POP_BP - rc.pop[ideo]);
  rc.stabBaseBp = REBEL_STAB_BP;
  rc.wsBaseBp = REBEL_WS_BP;
  addSpirit(pol, R, "gen_civil_strife", STRIFE_DAYS, day);
  // X: the ideology's vote to the others, stability −10%, the strife.
  addPopularity(xc.pop, ideo, -xc.pop[ideo]);
  xc.stabBaseBp = Math.max(0, xc.stabBaseBp - GOV_STAB_LOSS_BP);
  addSpirit(pol, X, "gen_civil_strife", STRIFE_DAYS, day);
  pol.markCountry(X);
  pol.markCountry(R);
}

/**
 * Spec §15.3 laws: X's, then P3 §5.6-4 for the rebels' ideology — an
 * authoritarian government gives up free trade; the rebels are at war from
 * their first tick, so a closed economy stays.
 */
function copyLaws(eg: WwEndgame, X: number, R: number, ideo: number): void {
  const pol = eg.ww.politics;
  const xe = pol.econ.country(X);
  if (xe === null || pol.econ.country(R) === null) return;
  for (const k of LAW_KINDS) setLawFree(pol, R, k, xe.laws[k]);
  const authoritarian = ideo === IDEO_COM || ideo === IDEO_FAS;
  if (authoritarian && xe.laws.trade === "free_trade") {
    setLawFree(pol, R, "trade", "export_focus");
  }
}
