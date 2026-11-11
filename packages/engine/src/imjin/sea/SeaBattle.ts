// Imjin sea layer (design §6.2): battle circles. Two hostile fleets that see
// each other open a circle of 25 tiles; inside it every ship sails at
// tactical speed toward its slot or its target every tick, and every 5 ticks
// of the battle's own clock all ships fire at once (guns by broadside arc,
// arquebus, boarding), then fire spreads, currents foul crowded fleets,
// morale moves and the beaten flee.
import {
  admiralDeathPm,
  angleDiff,
  angleOf,
  ARQ_RANGE_MT,
  arqCrewLoss,
  BATTLE_RADIUS_MT,
  bears,
  BOARD_RANGE_MT,
  boardingRound,
  BURN_PM,
  canEnter,
  chancePm,
  CHANNEL_FRONT,
  commandRadiusMt,
  currentSpeedPct,
  currentState,
  CurrentState,
  degToAngle,
  distMt,
  engagedLoss,
  extinguishPm,
  FIRE_SHIP_HIT_PM,
  fireShipWindOk,
  fireSpreadPm,
  FOUL_MIN_SHIPS,
  FOUL_PM,
  GUN_RANGE_MT,
  gunDamageMt,
  hiddenAt,
  hitPct,
  hullLossMorale,
  icos,
  isin,
  isTaken,
  MORALE_ADMIRAL_DEAD,
  MORALE_AMBUSH,
  MORALE_FIRE,
  MORALE_FLAGSHIP_SUNK,
  MORALE_FLEE,
  MORALE_MAX,
  MORALE_OUTNUMBERED,
  MORALE_RALLY,
  MORALE_SINK_GAIN,
  MORALE_TURTLE,
  MORALE_WAVER,
  moraleLoss,
  MT,
  P_SEA_ADMIRAL,
  P_SEA_ARQ,
  P_SEA_BOARD,
  P_SEA_FIRE,
  P_SEA_FOUL,
  P_SEA_GUN,
  RALLY_NERVE,
  RALLY_QUIET_TICKS,
  shipBreaks,
  shipStats,
  SHOAL_STUCK_TICKS,
  SIGHT_OPEN_MT,
  sightMt,
  steadied,
  tacticalSpeed,
  turnToward,
  VOLLEY_TICKS,
  WIND_PERIOD_DAYS,
  windAt,
  windSpeedPct,
} from "@openfront/engine-lib/imjin/SeaRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { flagsAt, SeaCtx, tileAt, tileCentre } from "./SeaCtx";
import { slotPoint, splitFleet } from "./SeaFleets";
import {
  fullHull,
  SeaBattle,
  SeaFleet,
  SeaShip,
  SeaState,
  shipIndex,
} from "./SeaState";

type Pt = { x: number; y: number };

function dist(a: Pt, b: Pt): number {
  return distMt(b.x - a.x, b.y - a.y);
}

function fleetSees(ctx: SeaCtx, a: SeaFleet, b: SeaFleet, d: number): boolean {
  const fa = flagsAt(ctx, a.x, a.y);
  const fb = flagsAt(ctx, b.x, b.y);
  return d <= sightMt(fa.coastal) && !hiddenAt(fb.lee, b.still > 0, d);
}

function hasHostile(
  st: SeaState,
  ctx: SeaCtx,
  b: SeaBattle,
  owner: number,
): boolean {
  return st.fleets.some(
    (f) =>
      f.battle === b.id && f.ships.length > 0 && ctx.hostile(f.owner, owner),
  );
}

function join(st: SeaState, ctx: SeaCtx, f: SeaFleet, b: SeaBattle): void {
  f.battle = b.id;
  f.ambush = f.lurk;
  f.quiet = 0;
  f.path = [];
  f.pathIdx = 0;
  for (const s of st.ships) {
    if (s.fleet !== f.id) continue;
    s.tx = s.x;
    s.ty = s.y;
  }
  st.events.push({ tick: ctx.tick, kind: "battle_join", a: b.id, b: f.id });
}

function openBattle(
  st: SeaState,
  ctx: SeaCtx,
  a: SeaFleet,
  b: SeaFleet,
): SeaBattle {
  const cx = (a.x + b.x) >> 1;
  const cy = (a.y + b.y) >> 1;
  let current = flagsAt(ctx, cx, cy).current;
  if (!current) current = flagsAt(ctx, a.x, a.y).current;
  if (!current) current = flagsAt(ctx, b.x, b.y).current;
  const battle: SeaBattle = {
    id: st.nextId++,
    cx,
    cy,
    startTick: ctx.tick,
    current,
  };
  st.battles.push(battle);
  st.events.push({ tick: ctx.tick, kind: "battle_open", a: a.id, b: b.id });
  join(st, ctx, a, battle);
  join(st, ctx, b, battle);
  return battle;
}

/** Open a battle between a raider and an escort (convoy war), or join one. */
export function engage(
  st: SeaState,
  ctx: SeaCtx,
  a: SeaFleet,
  b: SeaFleet,
): void {
  if (a.battle && a.battle === b.battle) return;
  const ba = st.battles.find((x) => x.id === a.battle);
  const bb = st.battles.find((x) => x.id === b.battle);
  if (ba && !bb) join(st, ctx, b, ba);
  else if (bb && !ba) join(st, ctx, a, bb);
  else if (!ba && !bb) openBattle(st, ctx, a, b);
}

/** Fleets that sail into a circle join; fleets that see each other open one. */
export function detectBattles(st: SeaState, ctx: SeaCtx): void {
  for (const f of st.fleets) {
    if (f.battle || f.ships.length === 0) continue;
    for (const b of st.battles) {
      if (dist(f, { x: b.cx, y: b.cy }) > BATTLE_RADIUS_MT) continue;
      if (!hasHostile(st, ctx, b, f.owner)) continue;
      join(st, ctx, f, b);
      break;
    }
  }
  const fl = st.fleets;
  for (let i = 0; i < fl.length; i++) {
    for (let j = i + 1; j < fl.length; j++) {
      const a = fl[i];
      const b = fl[j];
      if (a.ships.length === 0 || b.ships.length === 0) continue;
      if (!ctx.hostile(a.owner, b.owner)) continue;
      if (a.battle && b.battle) continue;
      const d = dist(a, b);
      if (d > SIGHT_OPEN_MT) continue;
      if (!fleetSees(ctx, a, b, d) || !fleetSees(ctx, b, a, d)) continue;
      const host = st.battles.find((x) => x.id === (a.battle || b.battle));
      if (host) {
        const out = a.battle ? b : a;
        if (dist(out, { x: host.cx, y: host.cy }) <= BATTLE_RADIUS_MT)
          join(st, ctx, out, host);
        continue;
      }
      openBattle(st, ctx, a, b);
    }
  }
}

interface Live {
  st: SeaState;
  ctx: SeaCtx;
  idx: Map<number, SeaShip>;
  fleets: Map<number, SeaFleet>;
}

function liveShips(L: Live, f: SeaFleet): SeaShip[] {
  const out: SeaShip[] = [];
  for (const id of f.ships) {
    const s = L.idx.get(id);
    if (s && s.hull > 0) out.push(s);
  }
  return out;
}

function nearest(
  from: Pt,
  ships: readonly SeaShip[],
  range = Infinity,
): SeaShip | null {
  let best: SeaShip | null = null;
  let bd = range + 1;
  for (const s of ships) {
    const d = dist(from, s);
    if (d < bd || (d === bd && best && s.id < best.id)) {
      best = s;
      bd = d;
    }
  }
  return bd <= range ? best : null;
}

function centroid(ships: readonly SeaShip[]): Pt {
  let x = 0;
  let y = 0;
  for (const s of ships) {
    x += s.x;
    y += s.y;
  }
  const n = Math.max(1, ships.length);
  return { x: Math.trunc(x / n), y: Math.trunc(y / n) };
}

function away(from: Pt, threat: Pt, len: number): Pt {
  const dx = from.x - threat.x;
  const dy = from.y - threat.y;
  const a = angleOf(dx, dy);
  return {
    x: from.x + Math.trunc((icos(a) * len) / 1024),
    y: from.y + Math.trunc((isin(a) * len) / 1024),
  };
}

function fleePoint(
  L: Live,
  f: SeaFleet,
  me: Pt,
  enemies: readonly SeaShip[],
): Pt {
  if (f.fleeTile >= 0) return tileCentre(L.ctx, f.fleeTile);
  return away(me, centroid(enemies), 10 * MT);
}

function battleEnemies(L: Live, b: SeaBattle, owner: number): SeaShip[] {
  const out: SeaShip[] = [];
  for (const s of L.st.ships) {
    if (s.hull <= 0) continue;
    const f = L.fleets.get(s.fleet);
    if (!f || f.battle !== b.id) continue;
    if (L.ctx.hostile(owner, s.owner)) out.push(s);
  }
  return out;
}

/** Sail one ship a tick toward a point: turn, then move on its heading. */
function sail(
  L: Live,
  s: SeaShip,
  f: SeaFleet,
  p: Pt,
  cur: CurrentState | null,
  pursued: boolean,
  settleHeading: number | null,
): void {
  const ctx = L.ctx;
  const stats = shipStats(s.kind);
  const rate = degToAngle(stats.turnDeg);
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  const d = distMt(dx, dy);
  if (d < 50) {
    if (settleHeading !== null)
      s.heading = turnToward(s.heading, settleHeading, rate);
    return;
  }
  const want = angleOf(dx, dy);
  s.heading = turnToward(s.heading, want, rate);
  const fl = flagsAt(ctx, s.x, s.y);
  const t = tileAt(ctx, s.x, s.y);
  const wind = windAt(
    ctx.seed,
    t < 0 ? 0 : ctx.zoneOf(t),
    Math.floor(ctx.day / WIND_PERIOD_DAYS),
    ctx.month,
  );
  const curPct =
    cur && fl.channel && fl.current
      ? currentSpeedPct(s.heading, ctx.currentAxis(fl.current), cur.sign)
      : 0;
  let v = tacticalSpeed(stats, {
    coastal: fl.coastal,
    shoal: fl.shoal,
    windPct: windSpeedPct(stats.sail, s.heading, wind),
    currentPct: curPct,
  });
  if (Math.abs(angleDiff(s.heading, want)) > 256) v >>= 1;
  v = Math.min(v, d);
  if (v <= 0) return;
  const tries: Pt[] = [
    {
      x: s.x + Math.trunc((icos(s.heading) * v) / 1024),
      y: s.y + Math.trunc((isin(s.heading) * v) / 1024),
    },
    { x: s.x + Math.trunc((icos(s.heading) * v) / 1024), y: s.y },
    { x: s.x, y: s.y + Math.trunc((isin(s.heading) * v) / 1024) },
  ];
  for (let k = 0; k < tries.length; k++) {
    const n = tries[k];
    const nt = tileAt(ctx, n.x, n.y);
    if (nt < 0) continue;
    if (!ctx.isWater(nt)) {
      if (k === 0 && f.fleeing && pursued) {
        s.hull = 0; // run onto a beach under fire: abandoned
        L.st.events.push({
          tick: ctx.tick,
          kind: "abandoned",
          a: s.id,
          b: f.id,
        });
        return;
      }
      continue;
    }
    if (!canEnter(stats, ctx.flags(nt).shoal)) {
      if (k === 0 && f.fleeing) {
        s.stuck = SHOAL_STUCK_TICKS;
        return;
      }
      continue;
    }
    s.x = n.x;
    s.y = n.y;
    return;
  }
}

function tacticalFleet(
  L: Live,
  b: SeaBattle,
  f: SeaFleet,
  cur: CurrentState | null,
): void {
  const ships = liveShips(L, f);
  if (ships.length === 0) return;
  const flag = ships[0];
  const enemies = battleEnemies(L, b, f.owner);
  const ctx = L.ctx;
  const x0 = f.x;
  const y0 = f.y;
  if (f.formationTicks > 0 && --f.formationTicks === 0)
    f.formation = f.formationTo;
  const wind = windAt(
    ctx.seed,
    ctx.zoneOf(Math.max(0, tileAt(ctx, flag.x, flag.y))),
    Math.floor(ctx.day / WIND_PERIOD_DAYS),
    ctx.month,
  );

  let flagTarget: Pt = { x: flag.x, y: flag.y };
  const near = nearest(flag, enemies);
  if (f.fleeing) flagTarget = fleePoint(L, f, flag, enemies);
  else if (near) {
    const d = dist(flag, near);
    switch (f.order) {
      case "board":
        flagTarget = { x: near.x, y: near.y };
        break;
      case "keep_range":
      case "escort": {
        if (d < 2500) flagTarget = away(flag, near, 2 * MT);
        else if (d > 3500) flagTarget = { x: near.x, y: near.y };
        else {
          // Turn broadside on: the perpendicular nearer the present heading.
          const brg = angleOf(near.x - flag.x, near.y - flag.y);
          const h1 = (brg + 256) & 1023;
          const h2 = (brg - 256) & 1023;
          const h =
            Math.abs(angleDiff(flag.heading, h1)) <=
            Math.abs(angleDiff(flag.heading, h2))
              ? h1
              : h2;
          flagTarget = {
            x: flag.x + Math.trunc((icos(h) * MT) / 1024),
            y: flag.y + Math.trunc((isin(h) * MT) / 1024),
          };
        }
        break;
      }
      case "break_off":
        flagTarget = away(flag, centroid(enemies), 5 * MT);
        break;
      case "move":
      case "lure":
        if (f.target >= 0) flagTarget = tileCentre(ctx, f.target);
        break;
      case "hold":
        break;
    }
  } else if ((f.order === "move" || f.order === "lure") && f.target >= 0) {
    flagTarget = tileCentre(ctx, f.target);
  }

  const pursued = near !== null && dist(flag, near) <= GUN_RANGE_MT;
  const radius = commandRadiusMt(f.admiral.alive ? f.admiral.tactics : 0);
  const channel = flagsAt(ctx, flag.x, flag.y).channel;
  const n = f.ships.length;
  for (let i = 0; i < f.ships.length; i++) {
    const s = L.idx.get(f.ships[i]);
    if (!s || s.hull <= 0) continue;
    if (s.stuck > 0) {
      s.stuck--;
      continue;
    }
    if (s.fouled) continue;
    let p: Pt;
    let settle: number | null = null;
    if (f.fleeing) p = flagTarget;
    else if (s.fireShip) {
      const e = nearest(s, enemies);
      const ok =
        e !== null &&
        fireShipWindOk(wind.to, wind.strength, angleOf(e.x - s.x, e.y - s.y));
      p = ok && e ? { x: e.x, y: e.y } : { x: s.x, y: s.y };
    } else if (s === flag) p = flagTarget;
    else if (dist(s, flag) <= radius) {
      const stats = shipStats(s.kind);
      const e =
        f.order === "board" && stats.boardAtk > 0 && f.morale >= MORALE_WAVER
          ? nearest(s, enemies, 6 * MT)
          : null;
      if (e) p = { x: e.x, y: e.y };
      else {
        p = slotPoint(f, i, n, flag.x, flag.y, flag.heading, channel);
        settle = flag.heading;
      }
    } else p = { x: s.tx, y: s.ty };
    s.tx = p.x;
    s.ty = p.y;
    sail(L, s, f, p, cur, pursued, settle);
  }
  const lead = liveShips(L, f)[0] ?? flag;
  f.x = lead.x;
  f.y = lead.y;
  f.heading = lead.heading;
  f.still = f.x === x0 && f.y === y0 ? f.still + 1 : 0;
}

function fireShipContacts(L: Live, b: SeaBattle): void {
  for (const s of L.st.ships) {
    if (!s.fireShip || s.hull <= 0) continue;
    const f = L.fleets.get(s.fleet);
    if (!f || f.battle !== b.id) continue;
    const t = nearest(s, battleEnemies(L, b, s.owner), BOARD_RANGE_MT);
    if (!t) continue;
    const full = fullHull(t.kind);
    t.hull -= Math.floor((full * FIRE_SHIP_HIT_PM) / 1000);
    t.fire = 1;
    s.hull = 0;
    const tf = L.fleets.get(t.fleet);
    if (tf)
      tf.morale = Math.max(
        0,
        tf.morale -
          moraleLoss(
            MORALE_FIRE,
            tf.admiral.alive ? tf.admiral.nerve : 0,
            false,
          ),
      );
    L.st.events.push({ tick: L.ctx.tick, kind: "fire_ship", a: s.id, b: t.id });
  }
}

/** A spatial grid of 4-tile cells over the battle's ships (lookups only). */
class Grid {
  private cells = new Map<number, SeaShip[]>();
  constructor(ships: readonly SeaShip[]) {
    for (const s of ships) {
      const k = Grid.key(
        Math.floor(s.x / GUN_RANGE_MT),
        Math.floor(s.y / GUN_RANGE_MT),
      );
      const c = this.cells.get(k);
      if (c) c.push(s);
      else this.cells.set(k, [s]);
    }
  }
  private static key(cx: number, cy: number): number {
    return (cy + 1) * 8192 + (cx + 1);
  }
  /** Ships within `range` (≤ 4 tiles) of a point, in id order. */
  near(p: Pt, range: number): SeaShip[] {
    const cx = Math.floor(p.x / GUN_RANGE_MT);
    const cy = Math.floor(p.y / GUN_RANGE_MT);
    const out: SeaShip[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.cells.get(Grid.key(cx + dx, cy + dy));
        if (!c) continue;
        for (const s of c) if (s.hull > 0 && dist(p, s) <= range) out.push(s);
      }
    out.sort((a, b) => a.id - b.id);
    return out;
  }
}

function add(m: Map<number, number>, k: number, v: number): void {
  m.set(k, (m.get(k) ?? 0) + v);
}

function volley(
  L: Live,
  b: SeaBattle,
  members: readonly SeaFleet[],
  cur: CurrentState | null,
): void {
  const { st, ctx } = L;
  const all = st.ships.filter((s) => {
    const f = L.fleets.get(s.fleet);
    return s.hull > 0 && f !== undefined && f.battle === b.id;
  });
  const grid = new Grid(all);
  const tick = ctx.tick;

  // Channel front cap: only the 3 ships of a fleet nearest the enemy fire.
  const mayFire = new Set<number>();
  for (const f of members) {
    const mine = all.filter((s) => s.fleet === f.id);
    const inCh = mine.filter((s) => flagsAt(ctx, s.x, s.y).channel);
    for (const s of mine) if (!inCh.includes(s)) mayFire.add(s.id);
    if (inCh.length === 0) continue;
    const c = centroid(all.filter((s) => ctx.hostile(f.owner, s.owner)));
    inCh.sort((a, z) => dist(a, c) - dist(z, c) || a.id - z.id);
    for (const s of inCh.slice(0, CHANNEL_FRONT)) mayFire.add(s.id);
  }

  const fullOf = new Map<number, number>();
  for (const s of all) add(fullOf, s.fleet, fullHull(s.kind));
  const hullDmg = new Map<number, number>();
  const crewDmg = new Map<number, number>();
  const captorOf = new Map<number, number>();
  const ambushed = new Set<number>();
  const enemiesOf = (s: SeaShip, range: number) =>
    grid.near(s, range).filter((t) => ctx.hostile(s.owner, t.owner));
  const density = (t: SeaShip) =>
    grid.near(t, MT).filter((o) => o.fleet === t.fleet && o.id !== t.id).length;

  for (const s of all) {
    const f = L.fleets.get(s.fleet)!;
    if (f.fleeing || s.fouled || s.fireShip || !mayFire.has(s.id)) continue;
    const stats = shipStats(s.kind);
    const wav = f.morale < MORALE_WAVER;
    const gunnery = f.admiral.alive ? f.admiral.gunnery : 0;
    const amb = f.ambush === 1;
    const inCh = flagsAt(ctx, s.x, s.y).channel;
    if (stats.guns > 0) {
      let tgt: SeaShip | null = null;
      let bd = Infinity;
      for (const t of enemiesOf(s, GUN_RANGE_MT)) {
        if (!bears(stats, s.heading, angleOf(t.x - s.x, t.y - s.y), inCh))
          continue;
        const d = dist(s, t);
        if (d < bd) {
          bd = d;
          tgt = t;
        }
      }
      if (tgt) {
        const tf = L.fleets.get(tgt.fleet)!;
        const hit = hitPct({
          distMt: bd,
          targetSize: shipStats(tgt.kind).size,
          density: density(tgt),
          gunnery,
          targetFormation: tf.formation,
        });
        add(
          hullDmg,
          tgt.id,
          gunDamageMt(
            stats.guns,
            hit,
            wwRoll(ctx.seed, P_SEA_GUN, s.id, tick),
            amb,
            wav,
          ),
        );
        if (amb) ambushed.add(tgt.fleet);
      }
    }
    if (stats.arq > 0) {
      const tgt = nearest(s, enemiesOf(s, ARQ_RANGE_MT), ARQ_RANGE_MT);
      if (tgt) {
        const ts = shipStats(tgt.kind);
        const hit = hitPct({
          distMt: dist(s, tgt),
          targetSize: ts.size,
          density: density(tgt),
          gunnery,
          targetFormation: L.fleets.get(tgt.fleet)!.formation,
        });
        add(
          crewDmg,
          tgt.id,
          arqCrewLoss(
            stats.arq,
            hit,
            wwRoll(ctx.seed, P_SEA_ARQ, s.id, tick),
            ts.bulwarkPm,
            amb,
            wav,
          ),
        );
        if (amb) ambushed.add(tgt.fleet);
      }
    }
    if (f.order === "board" && stats.boardAtk > 0 && !wav) {
      const cands = enemiesOf(s, BOARD_RANGE_MT).filter((t) => {
        if (shipStats(t.kind).boardImmune) return false;
        const tf = L.fleets.get(t.fleet)!;
        return !(tf.formation === "loose" && captorOf.has(t.id));
      });
      const tgt = nearest(s, cands, BOARD_RANGE_MT);
      if (tgt) {
        const tf = L.fleets.get(tgt.fleet)!;
        const r = boardingRound(
          {
            crew: s.crew,
            value: stats.boardAtk,
            skill: f.admiral.alive ? f.admiral.boarding : 0,
          },
          {
            crew: tgt.crew,
            value: shipStats(tgt.kind).boardDef,
            skill: tf.admiral.alive ? tf.admiral.boarding : 0,
          },
          wwRoll(ctx.seed, P_SEA_BOARD, s.id, tick),
        );
        add(crewDmg, s.id, r.attLoss);
        add(crewDmg, tgt.id, r.defLoss);
        if (!captorOf.has(tgt.id)) captorOf.set(tgt.id, f.id);
      }
    }
  }

  // Apply the volley at once.
  const lost = new Map<number, number>();
  const flagHit = new Map<number, number>();
  const hurt = new Set<number>();
  for (const s of all) {
    const dh = hullDmg.get(s.id) ?? 0;
    if (dh > 0) {
      add(lost, s.fleet, Math.min(dh, s.hull));
      const f = L.fleets.get(s.fleet)!;
      if (f.ships[0] === s.id) add(flagHit, f.id, dh);
      s.hull -= dh;
      hurt.add(s.fleet);
    }
    const dc = crewDmg.get(s.id) ?? 0;
    if (dc > 0) {
      s.crew = Math.max(0, s.crew - dc);
      hurt.add(s.fleet);
    }
  }

  const gains = new Map<number, number>();
  const sinkGain = (owner: number) => {
    for (const f of members)
      if (ctx.hostile(f.owner, owner)) add(gains, f.id, MORALE_SINK_GAIN);
  };
  // Boarded ships taken: Japan and Ming keep them, Joseon burns them.
  for (const s of all) {
    const capF = captorOf.get(s.id);
    if (capF === undefined || s.hull <= 0) continue;
    if (!isTaken(s.crew, shipStats(s.kind).crew)) continue;
    const captor = L.fleets.get(capF)!;
    const loser = L.fleets.get(s.fleet)!;
    add(lost, loser.id, s.hull);
    if (ctx.keepsPrizes(captor.owner)) {
      sinkGain(s.owner);
      loser.ships = loser.ships.filter((id) => id !== s.id);
      s.owner = captor.owner;
      s.fleet = captor.id;
      s.fire = 0;
      s.fireShip = 0;
      s.crew = Math.max(1, Math.floor(shipStats(s.kind).crew / 4));
      captor.ships.push(s.id);
      st.events.push({ tick, kind: "taken", a: s.id, b: captor.id });
    } else {
      s.hull = 0;
      st.events.push({ tick, kind: "burnt", a: s.id, b: captor.id });
    }
  }

  // Fire: spread to ships within a tile, burn, and put out.
  const fires = new Map<number, number>();
  const burning = all.filter((s) => s.fire && s.hull > 0);
  const lit = new Set<number>();
  for (const bs of burning) {
    for (const o of grid.near(bs, MT)) {
      if (o.fire || o.id === bs.id || lit.has(o.id) || o.hull <= 0) continue;
      const of = L.fleets.get(o.fleet);
      if (!of) continue;
      if (
        chancePm(
          wwRoll(ctx.seed, P_SEA_FIRE, bs.id, o.id, tick),
          fireSpreadPm(of.formation),
        )
      )
        lit.add(o.id);
    }
  }
  for (const bs of burning) {
    const full = fullHull(bs.kind);
    const burn = Math.min(bs.hull, Math.floor((full * BURN_PM) / 1000));
    bs.hull -= burn;
    add(lost, bs.fleet, burn);
    hurt.add(bs.fleet);
    const ex = extinguishPm(bs.crew, shipStats(bs.kind).crew);
    if (chancePm(wwRoll(ctx.seed, P_SEA_FIRE, bs.id, tick, 7), ex)) bs.fire = 0;
  }
  for (const s of all)
    if (lit.has(s.id)) {
      s.fire = 1;
      add(fires, s.fleet, 1);
    }

  // The turtle ship's ram: each contact costs the enemy fleet 40 morale.
  const rams = new Map<number, number>();
  for (const t of all) {
    if (t.hull <= 0 || !shipStats(t.kind).ram) continue;
    const hitFleets = new Set<number>();
    for (const e of enemiesOf(t, BOARD_RANGE_MT)) hitFleets.add(e.fleet);
    for (const fid of hitFleets) add(rams, fid, 1);
  }

  // Currents: crowded fleets against the flow foul; a turn frees them.
  if (cur) {
    const prev = currentState(
      ctx.seed,
      b.id,
      tick - b.startTick - VOLLEY_TICKS,
    );
    if (prev.turns !== cur.turns) for (const s of all) s.fouled = 0;
    for (const f of members) {
      const inCh = all.filter((s) => {
        if (s.fleet !== f.id || s.hull <= 0) return false;
        const fl = flagsAt(ctx, s.x, s.y);
        return fl.channel && fl.current !== 0;
      });
      if (inCh.length < FOUL_MIN_SHIPS) continue;
      const axis = ctx.currentAxis(flagsAt(ctx, inCh[0].x, inCh[0].y).current);
      if (currentSpeedPct(f.heading, axis, cur.sign) >= 0) continue;
      for (const s of inCh)
        if (
          !s.fouled &&
          chancePm(wwRoll(ctx.seed, P_SEA_FOUL, s.id, tick), FOUL_PM)
        )
          s.fouled = 1;
    }
  }

  // Sinkings, the flagship and the admiral.
  const flagSunk = new Set<number>();
  for (const s of all) {
    if (s.hull > 0) continue;
    const f = L.fleets.get(s.fleet);
    if (f && f.ships.includes(s.id)) {
      // The admiral goes down with his flagship: the shock falls once, not
      // again on each ship that takes slot 0 after it (ww177 merge 2).
      if (f.ships[0] === s.id && f.admiral.alive) {
        flagSunk.add(f.id);
        f.admiral.alive = 0;
      }
      sinkGain(s.owner);
      st.events.push({ tick, kind: "sunk", a: s.id, b: f.id });
    }
  }
  const admiralDead = new Set<number>();
  for (const f of members) {
    const h = flagHit.get(f.id) ?? 0;
    const flag = L.idx.get(f.ships[0]);
    if (!f.admiral.alive || !flag || h * 20 < fullHull(flag.kind)) continue;
    if (
      chancePm(
        wwRoll(ctx.seed, P_SEA_ADMIRAL, f.id, tick),
        admiralDeathPm(ctx.night),
      )
    ) {
      f.admiral.alive = 0;
      admiralDead.add(f.id);
      st.events.push({ tick, kind: "admiral_dead", a: f.id, b: 0 });
    }
  }

  // Morale (ww177 merge 2: losses by the share engaged, the flagship's
  // steadying, flight by ship until the fleet breaks).
  for (const f of members) {
    const mine = all.filter((s) => s.fleet === f.id && s.hull > 0);
    const foes = all.filter((s) => s.hull > 0 && ctx.hostile(f.owner, s.owner));
    let fight = hullLossMorale(lost.get(f.id) ?? 0, fullOf.get(f.id) ?? 0);
    fight += MORALE_FIRE * (fires.get(f.id) ?? 0);
    fight += MORALE_TURTLE * (rams.get(f.id) ?? 0);
    if (foes.length > mine.length) fight += MORALE_OUTNUMBERED;
    const engaged = mine.filter((s) =>
      grid
        .near(s, GUN_RANGE_MT)
        .some((t) => t.hull > 0 && ctx.hostile(f.owner, t.owner)),
    ).length;
    let loss = engagedLoss(fight, engaged, mine.length);
    if (ambushed.has(f.id)) loss += MORALE_AMBUSH;
    if (flagSunk.has(f.id)) loss += MORALE_FLAGSHIP_SUNK;
    if (admiralDead.has(f.id)) loss += MORALE_ADMIRAL_DEAD;
    const nerve = f.admiral.alive ? f.admiral.nerve : 0;
    const anchor = mine.some((s) => shipStats(s.kind).anchor);
    const holds =
      f.admiral.alive === 1 && mine.some((s) => s.id === f.ships[0]);
    const m =
      f.morale -
      steadied(moraleLoss(loss, nerve, anchor), holds) +
      (gains.get(f.id) ?? 0);
    f.morale = Math.max(0, Math.min(MORALE_MAX, m));
    f.ambush = 0;
    f.quiet = hurt.has(f.id) ? 0 : f.quiet + VOLLEY_TICKS;
    if (!f.fleeing && f.morale < MORALE_FLEE) {
      f.fleeing = 1;
      f.fleeTile = ctx.nearestPort(f.owner, f.x, f.y);
      st.events.push({ tick, kind: "flee", a: f.id, b: 0 });
    } else if (
      f.fleeing &&
      f.admiral.alive &&
      f.admiral.nerve >= RALLY_NERVE &&
      f.quiet >= RALLY_QUIET_TICKS
    ) {
      f.fleeing = 0;
      f.morale = Math.max(f.morale, MORALE_RALLY);
      st.events.push({ tick, kind: "rally", a: f.id, b: 0 });
    } else if (!f.fleeing) {
      // Before the fleet breaks, its battered ships leave one by one.
      const going = mine
        .filter(
          (s) =>
            s.id !== f.ships[0] &&
            shipBreaks(
              Math.floor((s.hull * 1000) / fullHull(s.kind)),
              Math.floor((s.crew * 1000) / Math.max(1, shipStats(s.kind).crew)),
              f.morale,
            ),
        )
        .map((s) => s.id);
      const nf = going.length > 0 ? splitFleet(st, f.id, going) : undefined;
      if (nf) {
        nf.fleeing = 1;
        nf.admiral.alive = 0;
        nf.fleeTile = ctx.nearestPort(nf.owner, nf.x, nf.y);
        nf.quiet = 0;
        st.events.push({ tick, kind: "flee", a: nf.id, b: f.id });
      }
    }
  }
}

/** Drop sunk ships and empty fleets. */
export function removeDead(st: SeaState): void {
  st.ships = st.ships.filter((s) => s.hull > 0);
  const alive = new Set(st.ships.map((s) => s.id));
  for (const f of st.fleets) f.ships = f.ships.filter((id) => alive.has(id));
  st.fleets = st.fleets.filter((f) => f.ships.length > 0);
}

function leave(st: SeaState, ctx: SeaCtx, f: SeaFleet): void {
  f.battle = 0;
  f.ambush = 0;
  f.path = [];
  f.pathIdx = 0;
  const from = tileAt(ctx, f.x, f.y);
  if (f.fleeing) {
    const p = f.fleeTile >= 0 && from >= 0 ? ctx.path(from, f.fleeTile) : null;
    if (p) {
      f.path = p;
      f.order = "move";
      f.target = f.fleeTile;
    } else {
      f.fleeing = 0;
      f.order = "hold";
    }
  } else if (
    (f.order === "move" || f.order === "lure") &&
    f.target >= 0 &&
    from >= 0
  ) {
    const p = ctx.path(from, f.target);
    if (p) f.path = p;
    else f.order = "hold";
  }
  st.events.push({ tick: ctx.tick, kind: "battle_leave", a: f.id, b: 0 });
}

/** One tick of every battle: sail, fire ships, the volley, leaving and ending. */
export function battleStep(st: SeaState, ctx: SeaCtx): void {
  for (const b of [...st.battles]) {
    const L: Live = {
      st,
      ctx,
      idx: shipIndex(st),
      fleets: new Map(st.fleets.map((f) => [f.id, f])),
    };
    const members = st.fleets.filter((f) => f.battle === b.id);
    const age = ctx.tick - b.startTick;
    const cur = b.current ? currentState(ctx.seed, b.id, age) : null;
    for (const f of members) tacticalFleet(L, b, f, cur);
    fireShipContacts(L, b);
    if (age > 0 && age % VOLLEY_TICKS === 0) volley(L, b, members, cur);
    removeDead(st);
    const centre = { x: b.cx, y: b.cy };
    for (const f of st.fleets)
      if (f.battle === b.id && dist(f, centre) > BATTLE_RADIUS_MT)
        leave(st, ctx, f);
    const left = st.fleets.filter((f) => f.battle === b.id);
    const fight = left.some((a) =>
      left.some((z) => ctx.hostile(a.owner, z.owner)),
    );
    if (!fight) {
      for (const f of left) leave(st, ctx, f);
      st.battles = st.battles.filter((x) => x.id !== b.id);
      st.events.push({ tick: ctx.tick, kind: "battle_end", a: b.id, b: 0 });
    }
  }
}

/** Mark fleets lying still in lee at the end of the tick. */
export function updateLurk(st: SeaState, ctx: SeaCtx): void {
  for (const f of st.fleets)
    f.lurk = !f.battle && f.still > 0 && flagsAt(ctx, f.x, f.y).lee ? 1 : 0;
}
