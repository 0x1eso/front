// The Imjin War's own state on top of the 1936 machinery (ww175 design §5-6,
// ww177 merge 1): the tile sea layer (fleets, battle circles, convoy groups),
// the land battles' orders, the sieges, the convoy cargo that landed, and the
// war's opening. Only an Imjin game builds it (WorldWar.imjinWar); a 1936
// game never reaches this file, so its digests cannot move.
import type { ImjinData } from "@openfront/engine-api/imjin/ImjinTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_SUPPLY_CONVOY_KM } from "@openfront/engine-api/ww1936/NavyTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  ATTACK_ORDERS,
  DEFENCE_STANCES,
} from "@openfront/engine-lib/imjin/LandRules";
import {
  channelShores,
  currentState,
  distMt,
  shipKindIndex,
  shipStats,
  WIND_PERIOD_DAYS,
  windAt,
} from "@openfront/engine-lib/imjin/SeaRules";
import { seaFlagsAt } from "@openfront/engine-lib/imjin/Terrain";
import { dateOfDay, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "../game/Game";
import { PathFinding } from "../pathfinding/PathFinder";
import { effectiveLevel } from "../ww1936/economy/Buildings";
import { USE_SUPPLY } from "../ww1936/navy/Convoys";
import { navalPortsOf } from "../ww1936/navy/Ports";
import type { WorldWar } from "../ww1936/WorldWar";
import { emptyEndState, ImjinEndings, type ImjinEndState } from "./Endings";
import { siegeDays } from "./land/Sieges";
import { imjinSeaAi, imjinSeaBattleAi } from "./sea/SeaAi";
import { addConvoyGroup } from "./sea/SeaConvoys";
import type { SeaCtx } from "./sea/SeaCtx";
import type { SeaOrder } from "./sea/SeaFleets";
import { seaOrder } from "./sea/SeaFleets";
import { seedSeaStart } from "./sea/SeaStart";
import { emptySeaState, seaHash, type SeaState } from "./sea/SeaState";
import { seaTick } from "./sea/SeaTick";

/** One land battle's orders (design §5 "Orders"), by battle region. */
export interface ImjinBattleOrders {
  region: number;
  since: number;
  /** ATTACK_ORDERS / DEFENCE_STANCES indices in effect. */
  att: number;
  def: number;
  /** Given for the next phase (-1: none) and whether a human gave it. */
  pendAtt: number;
  pendDef: number;
  /** 1 once a human gave the side's order (the AI leaves it then). */
  humanAtt: number;
  humanDef: number;
  /** ImjinEdge index of the attack's crossing (0: none). */
  edge: number;
  /** 1: the attacker walked into an ambush; its orders are locked. */
  ambushed: number;
  /** 1 once each side's hwacha fired. */
  hwAtt: number;
  hwDef: number;
}

/** A fort region under siege (design §5 "Sieges"). */
export interface ImjinSiege {
  region: number;
  owner: number;
  sinceDay: number;
  grainDays: number;
  fort: number;
  breachDays: number;
  morale: number;
}

/** A supply route's last landed cargo (milli a day) and its day. */
export interface ImjinLanded {
  route: number;
  perDay: number;
  day: number;
}

export interface ImjinState {
  sea: SeaState;
  orders: ImjinBattleOrders[];
  sieges: ImjinSiege[];
  landed: ImjinLanded[];
  /** The day the war opened (-1: not yet). */
  warDay: number;
  /** The day Ming came in (-1: not yet). */
  mingDay: number;
  /** ww177 P7a: Ming's silver, the days Japan is out, the ending. */
  end: ImjinEndState;
}

/** What the sim and the screens count (not state: derived from events). */
export interface ImjinStats {
  seaBattles: number;
  sunk: number;
  raids: number;
  groupsLanded: number;
  sieges: number;
}

/** Days of supply a convoy group carries; groups leave this often. */
const GROUP_DAYS = 3;
/** A landing feeds its hub this many days (a group lands every GROUP_DAYS). */
const LANDED_KEEP_DAYS = 2 * GROUP_DAYS;

export const EDGE_KINDS = [
  "none",
  "small_river",
  "great_river",
  "ford",
] as const;

export class WwImjin {
  st: ImjinState = {
    sea: emptySeaState(),
    orders: [],
    sieges: [],
    landed: [],
    warDay: -1,
    mingDay: -1,
    end: emptyEndState(),
  };
  /** ww177 P7a: the war's end (design §10). */
  readonly endings = new ImjinEndings(this);
  readonly stats: ImjinStats = {
    seaBattles: 0,
    sunk: 0,
    raids: 0,
    groupsLanded: 0,
    sieges: 0,
  };
  /** Derived: the client's data changed. */
  private dirty = true;
  private water: ReturnType<typeof PathFinding.Water> | null = null;
  private portTiles = new Map<number, number>();
  private lastDay = -1;

  constructor(
    readonly mg: Game,
    readonly ww: WorldWar,
  ) {}

  idOf(tag: CountryTag): number {
    return this.ww.scenario.smallIdOf(tag);
  }

  /** Once, at the game's start: the fleets of the year. */
  start(): void {
    if (this.st.sea.fleets.length === 0) seedSeaStart(this);
  }

  /** A water tile off a port region's coast (the fleets' berth), or -1. */
  portTile(region: number): number {
    const hit = this.portTiles.get(region);
    if (hit !== undefined) return hit;
    const map = this.mg.map();
    const sc = this.ww.scenario;
    const r = sc.region(region);
    let out = -1;
    if (r !== undefined) {
      const start = sc.vpTile(r);
      const seen = new Set<number>([start]);
      let ring = [start];
      for (let d = 0; d < 120 && out < 0 && ring.length > 0; d++) {
        const next: number[] = [];
        for (const t of ring) {
          for (const n of map.neighbors(t)) {
            if (seen.has(n)) continue;
            seen.add(n);
            if (map.isWater(n) && map.isOcean(n)) {
              if (out < 0 || n < out) out = n;
            } else if (!map.isWater(n)) next.push(n);
          }
        }
        ring = next;
      }
    }
    this.portTiles.set(region, out);
    return out;
  }

  /** The sea context of this tick. */
  ctx(tick: number): SeaCtx {
    const ww = this.ww;
    const map = this.mg.map();
    const day = ww.inPrep(tick) ? 0 : ww.day(tick);
    const k = tick - dayStartTick(day, ww.prepEndTick());
    this.water ??= PathFinding.Water(this.mg);
    const water = this.water;
    const land = ww.land;
    return {
      seed: ww.politics.seed,
      tick,
      month: dateOfDay(day, ww.epoch).month,
      day,
      night: k >= 4,
      width: map.width(),
      height: map.height(),
      ref: (x, y) => map.ref(x, y),
      tileX: (t) => map.x(t),
      tileY: (t) => map.y(t),
      isWater: (t) => map.isWater(t),
      flags: (t) => seaFlagsAt(ww.scenario, t),
      zoneOf: (t) => ww.scenario.regionAt(t),
      hostile: (a, b) => a !== b && land.isEnemy(a, b),
      path: (from, to) => water.findPath(from, to),
      nearestPort: (owner, x, y) => this.nearestPort(owner, x, y),
      portLevelAt: (owner, t) => this.portLevelAt(owner, t),
      currentAxis: (current) => currentAxisOf(ww, current),
      keepsPrizes: (owner) => owner !== this.idOf("JOS"),
    };
  }

  private nearestPort(owner: number, x: number, y: number): number {
    let best = -1;
    let bestD = Infinity;
    const map = this.mg.map();
    for (const r of navalPortsOf(this.ww, owner)) {
      const t = this.portTile(r);
      if (t < 0) continue;
      const dx = map.x(t) * 1000 - x;
      const dy = map.y(t) * 1000 - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** The naval base level at a berth tile for `owner` (0: none there). */
  private portLevelAt(owner: number, tile: number): number {
    const map = this.mg.map();
    let best = 0;
    for (const r of navalPortsOf(this.ww, owner)) {
      const t = this.portTile(r);
      if (t < 0 || map.manhattanDist(t, tile) > 6) continue;
      best = Math.max(best, effectiveLevel(this.ww.economy, r, "naval_base"));
    }
    return best;
  }

  // ---- Clock ----

  tick(ticks: number): void {
    const ww = this.ww;
    if (ww.inPrep(ticks)) return;
    const day = ww.day(ticks);
    const newDay = day !== this.lastDay;
    if (newDay) {
      this.lastDay = day;
      this.daily(day, ticks);
    }
    imjinSeaBattleAi(this, ticks);
    const ctx = this.ctx(ticks);
    seaTick(this.st.sea, ctx, newDay);
    this.drainSea(day);
    this.dirty = true;
  }

  private daily(day: number, tick: number): void {
    this.openWar(day);
    this.mingEntry(day);
    this.launchGroups(day, tick);
    imjinSeaAi(this, day, tick);
    siegeDays(this, day);
    this.endings.day(day);
    // Expired landings no longer feed.
    this.st.landed = this.st.landed.filter(
      (l) =>
        day - l.day <= LANDED_KEEP_DAYS && this.ww.navy.routes.has(l.route),
    );
  }

  /** Events and arrivals of the tick: counted, then cleared. */
  private drainSea(day: number): void {
    const sea = this.st.sea;
    for (const e of sea.events) {
      if (e.kind === "battle_open") this.stats.seaBattles++;
      else if (e.kind === "sunk") this.stats.sunk++;
      else if (e.kind === "raid") this.stats.raids++;
    }
    sea.events = [];
    for (const a of sea.arrivals) {
      this.stats.groupsLanded++;
      const perDay = Math.floor(a.cargo / GROUP_DAYS);
      const i = this.st.landed.findIndex((l) => l.route === a.route);
      if (i >= 0) this.st.landed[i] = { route: a.route, perDay, day };
      else {
        this.st.landed.push({ route: a.route, perDay, day });
        this.st.landed.sort((x, y) => x.route - y.route);
      }
    }
    sea.arrivals = [];
  }

  /**
   * Design §8: the war's opening is ImjinJapan's (readiness and the strike);
   * this only notes the day it opened, for the sea layer and the screens.
   */
  private openWar(day: number): void {
    if (this.st.warDay >= 0) return;
    if (this.ww.isAtWar(this.idOf("JPN"), this.idOf("JOS"))) {
      this.st.warDay = day;
    }
  }

  /** Ming's entry is the meter's (JoseonMing); this notes the day it came. */
  private mingEntry(day: number): void {
    if (this.st.mingDay >= 0 || this.st.warDay < 0) return;
    if (this.ww.isAtWar(this.idOf("MIN"), this.idOf("JPN"))) {
      this.st.mingDay = day;
    }
  }

  /**
   * Design §6.2 "Convoys": every supply route sends a visible group every
   * GROUP_DAYS days, carrying that many days of the route's capacity; what
   * lands feeds the hub (seaHubCapacityMilli reads landedPerDay).
   */
  private launchGroups(day: number, tick: number): void {
    const navy = this.ww.navy;
    const sea = this.st.sea;
    const ctx = this.ctx(tick);
    for (const r of [...navy.routes.values()].sort((a, b) => a.id - b.id)) {
      if (r.use !== USE_SUPPLY || r.got <= 0) continue;
      if ((day + r.id) % GROUP_DAYS !== 0) continue;
      const to = this.portTile(r.ref);
      const from = this.sourceTile(r.owner, r.zones[0] ?? 0);
      if (to < 0 || from < 0) continue;
      const cargo = imjinRouteCapacityMilli(r) * GROUP_DAYS;
      if (cargo <= 0) continue;
      addConvoyGroup(sea, ctx, r.owner, r.id, from, to, r.got, cargo);
    }
  }

  /** The berth of `owner`'s port whose harbour is `zone`, or the zone's centre. */
  private sourceTile(owner: number, zone: number): number {
    const sc = this.ww.scenario;
    for (const p of navalPortsOf(this.ww, owner)) {
      if (sc.harborOf(p) === zone) {
        const t = this.portTile(p);
        if (t >= 0) return t;
      }
    }
    return zone === 0 ? -1 : sc.zoneCenter(zone);
  }

  /** The cargo a route landed lately, milli a day (0: nothing landed). */
  landedPerDay(route: number): number {
    return this.st.landed.find((l) => l.route === route)?.perDay ?? 0;
  }

  // ---- Land battles' orders ----

  ordersOf(region: number, since: number): ImjinBattleOrders {
    let o = this.st.orders.find((x) => x.region === region);
    if (o !== undefined && o.since === since) return o;
    if (o !== undefined) this.st.orders = this.st.orders.filter((x) => x !== o);
    o = {
      region,
      since,
      att: 0,
      def: 0,
      pendAtt: -1,
      pendDef: -1,
      humanAtt: 0,
      humanDef: 0,
      edge: 0,
      ambushed: 0,
      hwAtt: 0,
      hwDef: 0,
    };
    this.st.orders.push(o);
    this.st.orders.sort((a, b) => a.region - b.region);
    return o;
  }

  /** Drops the orders of battles that ended. */
  pruneOrders(): void {
    const b = this.ww.land.battles;
    this.st.orders = this.st.orders.filter((o) => {
      const x = b.get(o.region);
      return x !== undefined && x.sinceTick === o.since;
    });
  }

  // ---- Orders (the same for humans and the AI) ----

  /** A fleet order; null when it took effect. */
  fleetOrder(
    smallID: number,
    fleet: number,
    order: SeaOrder,
    tick: number,
  ): WwOrderBlock | null {
    const ok = seaOrder(this.st.sea, this.ctx(tick), smallID, fleet, order);
    if (ok) this.dirty = true;
    return ok ? null : "bad_index";
  }

  /**
   * ww177 merge 3: a player's fire ship. The fleet must be in a battle; its
   * live small boat nearest an enemy there is set alight (the AI's pick).
   */
  fireShipOrder(
    smallID: number,
    fleet: number,
    tick: number,
  ): WwOrderBlock | null {
    const sea = this.st.sea;
    const f = sea.fleets.find((x) => x.id === fleet);
    if (!f || f.owner !== smallID || f.battle === 0) return "bad_index";
    const ctx = this.ctx(tick);
    const inBattle = new Set(
      sea.fleets.filter((x) => x.battle === f.battle).map((x) => x.id),
    );
    const foes = sea.ships.filter(
      (s) =>
        s.hull > 0 && inBattle.has(s.fleet) && ctx.hostile(f.owner, s.owner),
    );
    let pick = -1;
    let best = Infinity;
    for (const id of f.ships) {
      const s = sea.ships.find((x) => x.id === id);
      if (!s || s.hull <= 0 || s.fireShip || !shipStats(s.kind).small) continue;
      for (const e of foes) {
        const d = distMt(e.x - s.x, e.y - s.y);
        if (d < best) {
          best = d;
          pick = s.id;
        }
      }
    }
    if (pick < 0) return "bad_index";
    return this.fleetOrder(
      smallID,
      fleet,
      { kind: "fire_ship", ship: pick },
      tick,
    );
  }

  /**
   * ww177 merge 3: a player's escort. The fleet sails with its owner's
   * supply route whose convoy group is nearest; with none at sea, the
   * route that carries most.
   */
  escortOrder(
    smallID: number,
    fleet: number,
    tick: number,
  ): WwOrderBlock | null {
    const sea = this.st.sea;
    const f = sea.fleets.find((x) => x.id === fleet);
    if (!f || f.owner !== smallID) return "bad_index";
    const routes = [...this.ww.navy.routes.values()]
      .filter((r) => r.owner === smallID && r.use === USE_SUPPLY && r.got > 0)
      .sort((a, b) => a.id - b.id);
    if (routes.length === 0) return "bad_index";
    const ids = new Set(routes.map((r) => r.id));
    let route = -1;
    let best = Infinity;
    for (const g of sea.groups) {
      if (g.owner !== smallID || !ids.has(g.route)) continue;
      const d = distMt(g.x - f.x, g.y - f.y);
      if (d < best) {
        best = d;
        route = g.route;
      }
    }
    if (route < 0) {
      let got = -1;
      for (const r of routes) {
        if (r.got > got) {
          got = r.got;
          route = r.id;
        }
      }
    }
    return this.fleetOrder(smallID, fleet, { kind: "escort", route }, tick);
  }

  /** A land battle order for the next phase; null when it took effect. */
  battleOrder(
    smallID: number,
    region: number,
    attack: boolean,
    index: number,
  ): WwOrderBlock | null {
    const land = this.ww.land;
    const b = land.battles.get(region);
    if (b === undefined) return "bad_index";
    const list = attack ? ATTACK_ORDERS : DEFENCE_STANCES;
    if (index < 0 || index >= list.length) return "bad_index";
    const side = attack
      ? land.sideOf(b.attLead)
      : land.sideOf(land.controller[region]);
    if (land.sideOf(smallID) !== side) return "bad_index";
    const o = this.ordersOf(region, b.sinceTick);
    if (attack) {
      o.pendAtt = index;
      o.humanAtt = 1;
    } else {
      o.pendDef = index;
      o.humanDef = 1;
    }
    this.dirty = true;
    return null;
  }

  // ---- Screens ----

  takeData(): ImjinData | null {
    if (!this.dirty) return null;
    this.dirty = false;
    const tick = this.mg.ticks();
    const sea = this.st.sea;
    return {
      fleets: sea.fleets.map((f) => ({
        id: f.id,
        owner: f.owner,
        x: f.x,
        y: f.y,
        heading: f.heading,
        ships: f.ships.length,
        order: f.order,
        formation: f.formation,
        morale: f.morale,
        battle: f.battle,
        target: f.path.length > 0 ? f.path[f.path.length - 1] : -1,
        hullPm: fleetHullPm(sea, f.ships),
      })),
      ships: sea.ships.map((s) => [
        s.id,
        s.fleet,
        s.owner,
        s.x,
        s.y,
        s.heading,
        shipKindIndex(s.kind),
        s.fire,
      ]),
      battles: sea.battles.map((b) => this.battleView(b, tick)),
      winds: this.windsView(tick),
      groups: sea.groups.map((g) => ({
        id: g.id,
        owner: g.owner,
        x: g.x,
        y: g.y,
        convoys: g.convoys,
      })),
      orders: this.st.orders.map((o) => ({
        region: o.region,
        att: o.att,
        def: o.def,
        pendAtt: o.pendAtt,
        pendDef: o.pendDef,
        edge: o.edge,
        ambushed: o.ambushed,
      })),
      sieges: this.st.sieges.map((s) => ({
        region: s.region,
        grainDays: s.grainDays,
        fort: s.fort,
        morale: s.morale,
      })),
      ending: this.st.end.ending,
    };
  }

  /**
   * ww177 merge 3: a battle circle's current, its time to turn, and who
   * holds both its shores (design §6.2: that side sees the turn coming).
   */
  private battleView(
    b: {
      id: number;
      cx: number;
      cy: number;
      startTick: number;
      current: number;
    },
    tick: number,
  ): ImjinData["battles"][number] {
    const out = { id: b.id, cx: b.cx, cy: b.cy, current: b.current };
    if (b.current === 0) return { ...out, turnIn: 0, flow: 0, shores: 0 };
    const ww = this.ww;
    const sc = ww.scenario;
    const st = currentState(ww.politics.seed, b.id, tick - b.startTick);
    const land = (tx: number, ty: number) => {
      if (tx < 0 || ty < 0 || tx >= sc.width || ty >= sc.height) return -1;
      const id = sc.regionAt(ty * sc.width + tx);
      return id < SEA_ZONE_BASE ? id : 0;
    };
    const [ra, rb] = channelShores(
      land,
      b.cx,
      b.cy,
      currentAxisOf(ww, b.current),
    );
    const ca = ra === 0 ? 0 : (ww.land.controller[ra] ?? 0);
    const cb = rb === 0 ? 0 : (ww.land.controller[rb] ?? 0);
    return {
      ...out,
      turnIn: st.ticksToTurn,
      flow: st.sign,
      shores: ww.land.sameSide(ca, cb) ? ca : 0,
    };
  }

  /** ww177 merge 3: the wind over every zone a fleet is in, as the sea layer reads it. */
  private windsView(tick: number): number[][] {
    const ww = this.ww;
    const sc = ww.scenario;
    const day = ww.inPrep(tick) ? 0 : ww.day(tick);
    const month = dateOfDay(day, ww.epoch).month;
    const zones = new Set<number>();
    for (const f of this.st.sea.fleets) {
      const tx = Math.floor(f.x / 1000);
      const ty = Math.floor(f.y / 1000);
      if (tx < 0 || ty < 0 || tx >= sc.width || ty >= sc.height) continue;
      // The zone the sea layer reads the wind by (SeaCtx.zoneOf).
      zones.add(sc.regionAt(ty * sc.width + tx));
    }
    return [...zones]
      .sort((a, b) => a - b)
      .map((z) => {
        const w = windAt(
          ww.politics.seed,
          z,
          Math.floor(day / WIND_PERIOD_DAYS),
          month,
        );
        return [z, w.to, w.strength];
      });
  }

  // ---- Snapshot, hash ----

  hash(): number {
    let h = seaHash(this.st.sea);
    const mix = (v: number) => {
      h = (Math.imul(h, 31) + (v | 0)) | 0;
    };
    for (const o of this.st.orders) {
      for (const v of [
        o.region,
        o.since,
        o.att,
        o.def,
        o.pendAtt,
        o.pendDef,
        o.humanAtt,
        o.humanDef,
        o.edge,
        o.ambushed,
        o.hwAtt,
        o.hwDef,
      ])
        mix(v);
    }
    for (const s of this.st.sieges) {
      for (const v of [
        s.region,
        s.owner,
        s.sinceDay,
        s.grainDays,
        s.fort,
        s.breachDays,
        s.morale,
      ])
        mix(v);
    }
    for (const l of this.st.landed)
      for (const v of [l.route, l.perDay, l.day]) mix(v);
    mix(this.st.warDay);
    mix(this.st.mingDay);
    mix(this.endings.hash());
    return h >>> 0;
  }

  snapshot(): string {
    return JSON.stringify(this.st);
  }

  restore(s: string): void {
    this.st = JSON.parse(s) as ImjinState;
    // A save from before P7a has no ending state.
    this.st.end ??= emptyEndState();
    this.dirty = true;
  }

  /** The day state (not snapshot state: rebuilt from the clock). */
  restoreDay(day: number): void {
    this.lastDay = day;
  }
}

function fleetHullPm(sea: SeaState, ships: readonly number[]): number {
  let have = 0;
  let full = 0;
  for (const id of ships) {
    const s = sea.ships.find((x) => x.id === id);
    if (s === undefined) continue;
    have += s.hull;
    full += shipStats(s.kind).hull * 1000;
  }
  return full === 0 ? 0 : Math.floor((have * 1000) / full);
}

/**
 * A channel current's axis as SeaRules' binary angle (1024 a circle, 0
 * east, 256 south) from the map's heading (64 a circle, 0 north, 16 east).
 */
export function currentAxisOf(ww: WorldWar, current: number): number {
  const dir = ww.scenario.data.imjin?.currents[current - 1]?.dir ?? 16;
  return (dir * 16 - 256) & 1023;
}

/**
 * Design §6.2: a supply route's day of capacity, as 1936's sea hub reckons
 * it from the convoys on it, before any loss at sea (the groups carry it;
 * what lands is what the hub gets).
 */
export function imjinRouteCapacityMilli(r: {
  got: number;
  km: number;
}): number {
  return Math.floor((r.got * WW_SUPPLY_CONVOY_KM * 1000) / Math.max(1, r.km));
}

/** The imjin_fleet and imjin_battle orders (WwOrderExecution); null: done. */
export function issueImjinOrder(
  ww: WorldWar,
  smallID: number,
  order: Extract<WwOrder, { kind: "imjin_fleet" | "imjin_battle" }>,
  tick: number,
): WwOrderBlock | null {
  const im = ww.imjinWar;
  if (im === null) return "system_off";
  if (order.kind === "imjin_battle") {
    return im.battleOrder(smallID, order.region, order.attack, order.index);
  }
  switch (order.order) {
    case "move":
    case "lure":
      return im.fleetOrder(
        smallID,
        order.fleet,
        { kind: order.order, tile: order.tile },
        tick,
      );
    case "hold":
    case "break_off":
      return im.fleetOrder(smallID, order.fleet, { kind: order.order }, tick);
    case "board":
    case "keep_range":
      return im.fleetOrder(
        smallID,
        order.fleet,
        { kind: "engage", mode: order.order },
        tick,
      );
    case "fire_ship":
      return im.fireShipOrder(smallID, order.fleet, tick);
    case "escort":
      return im.escortOrder(smallID, order.fleet, tick);
    case "formation":
      return im.fleetOrder(
        smallID,
        order.fleet,
        { kind: "formation", formation: order.formation },
        tick,
      );
  }
}
