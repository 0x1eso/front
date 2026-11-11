// Imjin sea layer (ww175 design §6): the pure integer rules that the engine's
// tile fleets (`packages/engine/src/imjin/sea/`) and the client's battle card
// preview share. No floats in any rule: positions are milli-tiles, headings
// are binary angles (1024 to a circle, 0 = east, 256 = south on the map),
// hull is milli-points, and every chance is ‰ against a `wwRoll`.
import { idHash, wwRoll } from "../ww1936/Roll";

// ---------------------------------------------------------------------------
// Clock and ranges

/** Game ticks a second (the server's 100 ms turn). */
export const SEA_TICKS_PER_SECOND = 10;
/** One volley every 5 ticks (design §6.2). */
export const VOLLEY_TICKS = 5;
/** Milli-tiles in a tile. */
export const MT = 1000;
/** Strategic speed: about 2 tiles a tick. */
export const STRATEGIC_SPEED_MT = 2000;
/** The battle circle's radius: 25 tiles. */
export const BATTLE_RADIUS_MT = 25 * MT;
export const GUN_RANGE_MT = 4 * MT;
export const ARQ_RANGE_MT = 2 * MT;
export const BOARD_RANGE_MT = 1 * MT;
/** Sighting (design §4): open sea 12 tiles, coastal 10; a still fleet in lee is hidden beyond 3. */
export const SIGHT_OPEN_MT = 12 * MT;
export const SIGHT_COASTAL_MT = 10 * MT;
export const LEE_HIDE_MT = 3 * MT;
/** A convoy group is intercepted by a hostile fleet within 8 tiles. */
export const CONVOY_INTERCEPT_MT = 8 * MT;
/** A fleeing ship that strikes a shoal is stuck for 20 s. */
export const SHOAL_STUCK_TICKS = 20 * SEA_TICKS_PER_SECOND;
/** At most 3 ships abreast fire forward in a narrow channel. */
export const CHANNEL_FRONT = 3;
/** Turtle ships a country may have afloat. */
export const TURTLE_CAP = 5;

// ---------------------------------------------------------------------------
// Roll purposes (local, so the shared Roll.ts list stays untouched)

export const P_SEA_GUN = idHash("imjin_sea_gun");
export const P_SEA_ARQ = idHash("imjin_sea_arq");
export const P_SEA_BOARD = idHash("imjin_sea_board");
export const P_SEA_FIRE = idHash("imjin_sea_fire");
export const P_SEA_WIND = idHash("imjin_sea_wind");
export const P_SEA_CURRENT = idHash("imjin_sea_current");
export const P_SEA_FOUL = idHash("imjin_sea_foul");
export const P_SEA_ADMIRAL = idHash("imjin_sea_admiral");

/** Triangular roll in [-2000, 2000] from one 32-bit `wwRoll` value. */
export function triRoll(r: number): number {
  return ((r & 0xffff) % 2001) + ((r >>> 16) % 2001) - 2000;
}

/** True with chance `pm` ‰ for a 32-bit roll. */
export function chancePm(r: number, pm: number): boolean {
  return (r >>> 0) % 1000 < pm;
}

// ---------------------------------------------------------------------------
// Integer geometry: a 64-step sin table (×1024), linearly interpolated over
// 1024 binary-angle steps.

export const ANGLE_FULL = 1024;
export const ANGLE_MASK = 1023;
export const TRIG_ONE = 1024;

export const SIN64: readonly number[] = [
  0, 100, 200, 297, 392, 483, 569, 650, 724, 792, 851, 903, 946, 980, 1004,
  1019, 1024, 1019, 1004, 980, 946, 903, 851, 792, 724, 650, 569, 483, 392, 297,
  200, 100, 0, -100, -200, -297, -392, -483, -569, -650, -724, -792, -851, -903,
  -946, -980, -1004, -1019, -1024, -1019, -1004, -980, -946, -903, -851, -792,
  -724, -650, -569, -483, -392, -297, -200, -100,
];

/** sin × 1024 of a binary angle. */
export function isin(angle: number): number {
  const a = angle & ANGLE_MASK;
  const i = a >> 4;
  const f = a & 15;
  const s0 = SIN64[i];
  const s1 = SIN64[(i + 1) & 63];
  return s0 + Math.trunc(((s1 - s0) * f) / 16);
}

/** cos × 1024 of a binary angle. */
export function icos(angle: number): number {
  return isin(angle + 256);
}

/** Signed difference b − a folded into [-512, 511]. */
export function angleDiff(a: number, b: number): number {
  return ((((b - a) & ANGLE_MASK) + 512) & ANGLE_MASK) - 512;
}

/** Floor square root of a non-negative integer. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

export function distMt(dx: number, dy: number): number {
  return isqrt(dx * dx + dy * dy);
}

/**
 * Binary angle of a vector: the best of the 64 table directions by dot
 * product, then refined by halving steps. Integer only.
 */
export function angleOf(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < 64; i++) {
    const a = i << 4;
    const d = dx * icos(a) + dy * isin(a);
    if (d > bestDot) {
      bestDot = d;
      best = a;
    }
  }
  for (let step = 8; step >= 1; step >>= 1) {
    for (const c of [best - step, best + step]) {
      const a = c & ANGLE_MASK;
      const d = dx * icos(a) + dy * isin(a);
      if (d > bestDot) {
        bestDot = d;
        best = a;
      }
    }
  }
  return best & ANGLE_MASK;
}

/** Rotate a (forward, starboard) offset by a heading into map (dx, dy). */
export function rotate(
  fwd: number,
  stbd: number,
  heading: number,
): { dx: number; dy: number } {
  const c = icos(heading);
  const s = isin(heading);
  return {
    dx: Math.trunc((fwd * c - stbd * s) / TRIG_ONE),
    dy: Math.trunc((fwd * s + stbd * c) / TRIG_ONE),
  };
}

/** Degrees to binary angle steps (at least 1). */
export function degToAngle(deg: number): number {
  return Math.max(1, Math.floor((deg * ANGLE_FULL) / 360));
}

/** Turn `heading` toward `want` by at most `rate` steps. */
export function turnToward(
  heading: number,
  want: number,
  rate: number,
): number {
  const d = angleDiff(heading, want);
  if (d > rate) return (heading + rate) & ANGLE_MASK;
  if (d < -rate) return (heading - rate) & ANGLE_MASK;
  return want & ANGLE_MASK;
}

// ---------------------------------------------------------------------------
// Ships (design §6.2 table). One row = one ship; a small-boat row is 3 boats
// and its numbers are the row's.

export const SHIP_KINDS = [
  "panokseon",
  "turtle",
  "hyeopseon",
  "atakebune",
  "sekibune",
  "kobaya",
  "fuchuan",
  "shachuan",
  "transport",
] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

export type ShoalRule = "free" | "slow" | "no";

export interface SeaShipStats {
  /** Tactical speed, milli-tiles a tick. */
  speed: number;
  /** Turn rate, degrees a tick. */
  turnDeg: number;
  /** Hull points. */
  hull: number;
  /** Gun damage per volley (range 4). */
  guns: number;
  /** Arquebus crew damage per volley (range 2). */
  arq: number;
  /** Boarding attack; 0 = cannot board. */
  boardAtk: number;
  /** Boarding defence. */
  boardDef: number;
  /** Full crew (rowers and fighters). */
  crew: number;
  /** Added to the hit chance against this ship (bigger hulls are easier). */
  size: number;
  /** Sail-heavy hull: ±20/30% by wind instead of ±10%. */
  sail: boolean;
  /** Guns bear all round (the turtle ship). */
  allRound: boolean;
  /** Cannot be boarded (the turtle ship). */
  boardImmune: boolean;
  /** Each contact with an enemy ship costs that fleet 40 morale. */
  ram: boolean;
  /** ‰ of arquebus crew damage blocked by bulwarks. */
  bulwarkPm: number;
  shoal: ShoalRule;
  /** A small boat: +20% speed on coastal tiles; may become a fire ship. */
  small: boolean;
  /** Holds the fleet's nerve while afloat: morale losses ×90%. */
  anchor: boolean;
}

function row(
  speed: number,
  turnDeg: number,
  hull: number,
  guns: number,
  arq: number,
  boardAtk: number,
  boardDef: number,
  crew: number,
  size: number,
  extra: Partial<SeaShipStats> = {},
): SeaShipStats {
  return {
    speed,
    turnDeg,
    hull,
    guns,
    arq,
    boardAtk,
    boardDef,
    crew,
    size,
    sail: false,
    allRound: false,
    boardImmune: false,
    ram: false,
    bulwarkPm: 0,
    shoal: "free",
    small: false,
    anchor: false,
    ...extra,
  };
}

export const SEA_SHIPS: Readonly<Record<ShipKind, SeaShipStats>> = {
  panokseon: row(180, 12, 100, 8, 2, 4, 9, 160, 8, { bulwarkPm: 500 }),
  turtle: row(170, 10, 120, 7, 0, 0, 0, 120, 5, {
    allRound: true,
    boardImmune: true,
    ram: true,
  }),
  hyeopseon: row(280, 15, 25, 1, 1, 1, 2, 30, -10, { small: true }),
  atakebune: row(120, 4, 140, 3, 8, 9, 6, 220, 10, {
    sail: true,
    shoal: "no",
    anchor: true,
  }),
  sekibune: row(220, 8, 60, 1, 4, 6, 3, 90, 3, { shoal: "slow" }),
  kobaya: row(300, 15, 20, 0, 2, 3, 1, 30, -10, { small: true }),
  fuchuan: row(140, 5, 130, 6, 3, 7, 7, 200, 10, { sail: true, shoal: "no" }),
  shachuan: row(200, 9, 70, 3, 2, 4, 4, 100, 3),
  transport: row(150, 6, 40, 0, 0, 0, 1, 40, 5, { sail: true }),
};

export function shipStats(kind: ShipKind): SeaShipStats {
  return SEA_SHIPS[kind];
}

export function shipKindIndex(kind: ShipKind): number {
  return SHIP_KINDS.indexOf(kind);
}

// ---------------------------------------------------------------------------
// Formations: ships keep slots around the flagship (slot 0).

export const FORMATIONS = [
  "line",
  "column",
  "crane",
  "wedge",
  "loose",
] as const;
export type Formation = (typeof FORMATIONS)[number];

/** ‰ added to the chance of being hit: tight +200, loose −200. */
export function formationHitPm(f: Formation): number {
  if (f === "column" || f === "wedge") return 200;
  if (f === "loose") return -200;
  return 0;
}

/** Tight formations spread fire at 40%, loose at 10%, the rest at 25%. */
export function fireSpreadPm(f: Formation): number {
  if (f === "column" || f === "wedge") return 400;
  if (f === "loose") return 100;
  return 250;
}

/** A change of formation takes 15 s, 2 s less per point of admiral tactics, at least 5 s. */
export function formationChangeTicks(tactics: number): number {
  return Math.max(50, 150 - 20 * tactics);
}

/**
 * Slot offset (forward, starboard) in milli-tiles in the flagship's frame.
 * Slot 0 is the flagship. In a narrow channel every formation folds into a
 * column.
 */
export function formationSlot(
  f: Formation,
  slot: number,
  count: number,
): { fwd: number; stbd: number } {
  if (slot <= 0) return { fwd: 0, stbd: 0 };
  const side = slot % 2 === 1 ? 1 : -1;
  const j = (slot + 1) >> 1;
  switch (f) {
    case "column":
      return { fwd: -slot * MT, stbd: 0 };
    case "line":
      return { fwd: 0, stbd: side * j * MT };
    case "wedge":
      return { fwd: -j * 800, stbd: side * j * 800 };
    case "loose": {
      const r = Math.floor(slot / 3);
      const c = slot % 3;
      return { fwd: -r * 1500, stbd: (c === 0 ? 0 : c === 1 ? 1 : -1) * 1500 };
    }
    case "crane": {
      // A U open ahead: the flagship at the rear of the bowl, the wings
      // reaching forward on a circle of radius R around (R, 0).
      const perSide = Math.max(1, count >> 1);
      const r = Math.max(2 * MT, count * 350);
      const phi = Math.floor((j * 427) / perSide); // up to ~150°
      return {
        fwd: r - Math.trunc((r * icos(phi)) / TRIG_ONE),
        stbd: side * Math.trunc((r * isin(phi)) / TRIG_ONE),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Fire arcs and the volley

/**
 * Whether a ship heading `heading` can bear on `bearing`: 45°-135° off the
 * heading on either side (a broadside), all round for the turtle ship. In a
 * channel the front ships may also fire ahead (anything but the stern arc).
 */
export function bears(
  stats: SeaShipStats,
  heading: number,
  bearing: number,
  inChannel = false,
): boolean {
  if (stats.allRound) return true;
  const off = Math.abs(angleDiff(heading, bearing));
  if (inChannel) return off <= 384;
  return off >= 128 && off <= 384;
}

export interface HitInput {
  distMt: number;
  targetSize: number;
  /** Friendly ships within a tile of the target, capped at 3. */
  density: number;
  /** Admiral gunnery 0-5. */
  gunnery: number;
  targetFormation: Formation;
}

/** hit% = clamp(90 − 15×tiles + size + 10×density + 5×gunnery, 5, 95), then the formation's ±20%. */
export function hitPct(h: HitInput): number {
  const base =
    90 -
    Math.floor((15 * h.distMt) / MT) +
    h.targetSize +
    10 * Math.min(3, h.density) +
    5 * h.gunnery;
  const clamped = Math.max(5, Math.min(95, base));
  const f = formationHitPm(h.targetFormation);
  return Math.max(5, Math.min(95, Math.floor((clamped * (1000 + f)) / 1000)));
}

/**
 * Gun damage in milli-hull: guns × hit% / 100 × (10000 + roll) / 10000, with
 * a triangular ±2000 roll; ×2 for an ambush volley, −25% when wavering.
 */
export function gunDamageMt(
  guns: number,
  hit: number,
  roll: number,
  ambush = false,
  wavering = false,
): number {
  let d = Math.floor((guns * hit * (10000 + triRoll(roll))) / 1000);
  if (ambush) d *= 2;
  if (wavering) d = Math.floor((d * 3) / 4);
  return d;
}

/** Arquebus crew losses: 2 × arq × hit% / 100, rolled, less the bulwarks. */
export function arqCrewLoss(
  arq: number,
  hit: number,
  roll: number,
  bulwarkPm: number,
  ambush = false,
  wavering = false,
): number {
  let d = Math.floor((2 * arq * hit * (10000 + triRoll(roll))) / 1_000_000);
  d = Math.floor((d * (1000 - bulwarkPm)) / 1000);
  if (ambush) d *= 2;
  if (wavering) d = Math.floor((d * 3) / 4);
  return d;
}

export interface BoardingSide {
  crew: number;
  value: number;
  /** Admiral boarding skill 0-5: +5% a point. */
  skill: number;
}

/**
 * One volley of boarding: crew × attack faces crew × defence; a tenth of the
 * two crews fall, split by the opposing strength, rolled ±20%.
 */
export function boardingRound(
  att: BoardingSide,
  def: BoardingSide,
  roll: number,
): { attLoss: number; defLoss: number } {
  const a = att.crew * att.value * (100 + 5 * att.skill);
  const d = def.crew * Math.max(1, def.value) * (100 + 5 * def.skill);
  if (a <= 0) return { attLoss: 0, defLoss: 0 };
  const pool = Math.max(2, Math.floor((att.crew + def.crew) / 10));
  const swing = 10000 + Math.trunc(triRoll(roll) / 2);
  const defLoss = Math.floor((pool * a * swing) / ((a + d) * 10000));
  const attLoss = Math.floor((pool * d * (20000 - swing)) / ((a + d) * 10000));
  return {
    attLoss: Math.min(att.crew, attLoss),
    defLoss: Math.min(def.crew, defLoss),
  };
}

/** A ship is taken when its crew falls to 10% of full. */
export function isTaken(crew: number, fullCrew: number): boolean {
  return crew * 10 <= fullCrew;
}

// ---------------------------------------------------------------------------
// Fire

/** A fire ship on contact: the target loses 30% hull and catches fire. */
export const FIRE_SHIP_HIT_PM = 300;
/** A burning ship loses 10% of its full hull a volley. */
export const BURN_PM = 100;

/** The crew puts a fire out with chance 30% × crew share. */
export function extinguishPm(crew: number, fullCrew: number): number {
  if (fullCrew <= 0) return 0;
  return Math.floor((300 * crew) / fullCrew);
}

/** A fire ship needs a wind that is not against its run to the target. */
export function fireShipWindOk(
  windTo: number,
  windStrength: number,
  bearing: number,
): boolean {
  if (windStrength <= 0) return true;
  return icos(bearing - windTo) >= 0;
}

// ---------------------------------------------------------------------------
// Wind: one per sea zone, re-rolled every 10 game days with a seasonal lean.

export interface Wind {
  /** Binary angle the wind blows toward. */
  to: number;
  /** 0 calm, 1 fair, 2 strong. */
  strength: number;
}

/** Days a wind holds. */
export const WIND_PERIOD_DAYS = 10;
const NORTH = 768;
const SOUTH_EAST = 128;

/** The wind of a sea zone for a 10-day period; summer leans southerly, winter northwesterly. */
export function windAt(
  seed: number,
  zone: number,
  period: number,
  month: number,
): Wind {
  const r = wwRoll(seed, P_SEA_WIND, zone, period);
  const strengthRoll = (r >>> 24) % 10;
  const strength = strengthRoll < 2 ? 0 : strengthRoll < 8 ? 1 : 2;
  const summer = month >= 5 && month <= 8;
  const winter = month >= 11 || month <= 2;
  const lean = (r & 0xff) % 10 < 6;
  const jitter = ((r >>> 8) & 0x7f) - 64;
  let to: number;
  if (summer && lean) to = NORTH + jitter;
  else if (winter && lean) to = SOUTH_EAST + jitter;
  else to = (r >>> 12) & ANGLE_MASK;
  return { to: to & ANGLE_MASK, strength };
}

/** Speed change in % from the wind: sail-heavy +20 downwind / −30 upwind, oared ±10. */
export function windSpeedPct(sail: boolean, heading: number, w: Wind): number {
  if (w.strength <= 0) return 0;
  const rel = icos(heading - w.to);
  let pct: number;
  if (sail) pct = rel >= 0 ? (20 * rel) / TRIG_ONE : (30 * rel) / TRIG_ONE;
  else pct = (10 * rel) / TRIG_ONE;
  pct = Math.trunc(pct);
  return w.strength === 2 ? Math.trunc((pct * 3) / 2) : pct;
}

// ---------------------------------------------------------------------------
// Currents in channels: the flow turns on the battle's own clock, every
// 30-60 s, seeded per battle.

export interface CurrentState {
  /** +1 flows along the channel's axis, −1 against it. */
  sign: number;
  /** Ticks until the next turn. */
  ticksToTurn: number;
  /** How many times it has turned in this battle. */
  turns: number;
}

export function currentInterval(
  seed: number,
  battleId: number,
  n: number,
): number {
  return 300 + (wwRoll(seed, P_SEA_CURRENT, battleId, n, 1) % 301);
}

export function currentState(
  seed: number,
  battleId: number,
  battleTicks: number,
): CurrentState {
  let sign = wwRoll(seed, P_SEA_CURRENT, battleId) % 2 === 0 ? 1 : -1;
  let t = Math.max(0, battleTicks);
  let n = 0;
  for (;;) {
    const len = currentInterval(seed, battleId, n);
    if (t < len) return { sign, ticksToTurn: len - t, turns: n };
    t -= len;
    sign = -sign;
    n++;
  }
}

/** Speed change in %: +60 with the current, −60 against it. */
export function currentSpeedPct(
  heading: number,
  axis: number,
  sign: number,
): number {
  return Math.trunc((60 * sign * icos(heading - axis)) / TRIG_ONE);
}

/** A fleet of more than 6 ships against a current fouls each ship with 5% a volley. */
export const FOUL_MIN_SHIPS = 7;
export const FOUL_PM = 50;

// ---------------------------------------------------------------------------
// Speed

export interface SpeedInput {
  coastal: boolean;
  shoal: boolean;
  windPct: number;
  currentPct: number;
}

/** Milli-tiles a tick at tactical speed; 0 where the ship cannot sail. */
export function tacticalSpeed(s: SeaShipStats, at: SpeedInput): number {
  if (at.shoal && s.shoal === "no") return 0;
  let pct = 100 + at.windPct + at.currentPct;
  if (at.coastal && s.small) pct += 20;
  let v = Math.floor((s.speed * Math.max(10, pct)) / 100);
  if (at.shoal && s.shoal === "slow") v = Math.floor(v / 2);
  return v;
}

export function canEnter(s: SeaShipStats, shoal: boolean): boolean {
  return !(shoal && s.shoal === "no");
}

// ---------------------------------------------------------------------------
// Morale (0-1000)

export const MORALE_MAX = 1000;
export const MORALE_WAVER = 300;
export const MORALE_FLEE = 150;
export const MORALE_RALLY = 250;
export const RALLY_QUIET_TICKS = 10 * SEA_TICKS_PER_SECOND;
export const RALLY_NERVE = 4;
export const MORALE_PER_HULL_PCT = 6;
export const MORALE_FIRE = 30;
export const MORALE_TURTLE = 40;
export const MORALE_AMBUSH = 100;
export const MORALE_OUTNUMBERED = 2;
export const MORALE_SINK_GAIN = 20;
export const MORALE_ADMIRAL_DEAD = 400;
export const MORALE_FLAGSHIP_SUNK = 300;

/** A loss scaled down 5% a point of admiral nerve, and 10% while an anchor ship floats. */
export function moraleLoss(
  base: number,
  nerve: number,
  anchor: boolean,
): number {
  let v = Math.floor((base * (100 - 5 * nerve)) / 100);
  if (anchor) v = Math.floor((v * 9) / 10);
  return v;
}

/**
 * ww177 merge 2 (design §6.2: a sea battle lasts 30-120 s): a volley's
 * fighting losses (hull, fire, ram, outnumbered) fall on the fleet by the
 * share of its ships engaged, within gun range of a foe (at least one).
 * Shocks (ambush, flagship sunk, admiral dead) fall whole.
 */
export function engagedLoss(
  loss: number,
  engaged: number,
  ships: number,
): number {
  if (ships <= 0) return loss;
  const e = Math.max(1, Math.min(ships, engaged));
  return Math.floor((loss * e) / ships);
}

/** The flagship's steadying: while it floats with its admiral, losses ×3/4. */
export const FLAGSHIP_STEADY_PCT = 75;

export function steadied(loss: number, flagshipHolds: boolean): number {
  return flagshipHolds ? Math.floor((loss * FLAGSHIP_STEADY_PCT) / 100) : loss;
}

/**
 * Flight by ship until the fleet breaks (below MORALE_FLEE): a ship other
 * than the flagship leaves alone once its hull or crew is below 70% of full,
 * 85% once its fleet wavers.
 */
export const SHIP_BREAK_PM = 700;
export const SHIP_BREAK_WAVER_PM = 850;

export function shipBreaks(
  hullPm: number,
  crewPm: number,
  fleetMorale: number,
): boolean {
  const bar = fleetMorale < MORALE_WAVER ? SHIP_BREAK_WAVER_PM : SHIP_BREAK_PM;
  return hullPm < bar || crewPm < bar;
}

/** Morale lost for a volley's hull losses: 6 a 1% of the fleet's full hull. */
export function hullLossMorale(lostMt: number, fullMt: number): number {
  if (fullMt <= 0) return 0;
  return Math.floor((MORALE_PER_HULL_PCT * 100 * lostMt) / fullMt);
}

/** Admiral death chance when the flagship takes 5% hull or more in a volley. */
export function admiralDeathPm(night: boolean): number {
  return night ? 30 : 10;
}

export function commandRadiusMt(tactics: number): number {
  return (4 + tactics) * MT;
}

// ---------------------------------------------------------------------------
// Ports, convoys and the lure

/** Hull repaired a day in port, ‰ of full: 4% at level 1, +2% a level more. */
export function repairPmPerDay(level: number): number {
  if (level <= 0) return 0;
  return 40 + 20 * (level - 1);
}

/** Cargo lost (‰) by an unescorted convoy group to a raider's guns and arquebus. */
export function raidLossPm(guns: number, arq: number): number {
  return Math.min(800, 10 * (guns + arq));
}

/** An AI pursuer takes a lure when strength ratio × aggression passes its bar (all ‰). */
export function takesBait(
  ratioPm: number,
  aggressionPm: number,
  barPm: number,
): boolean {
  return Math.floor((ratioPm * aggressionPm) / 1000) >= barPm;
}

/** Sight range from a tile: coastal 10, open 12. */
export function sightMt(coastal: boolean): number {
  return coastal ? SIGHT_COASTAL_MT : SIGHT_OPEN_MT;
}

/** A still fleet in lee is hidden beyond 3 tiles. */
export function hiddenAt(lee: boolean, still: boolean, d: number): boolean {
  return lee && still && d > LEE_HIDE_MT;
}
