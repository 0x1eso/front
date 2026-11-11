// Great War 1914: who fights whom (ww171 phase 4, design ww168 B5). A war is a
// pair (`s.wars`); a nation's `atWar` is derived from the live ones. `side` is
// a coalition label: `central`, `entente`, or null for a country that fights
// alone. The coalitions form when the first war between two powers of
// opposite camps begins (the general war); after that a neutral that goes to
// war on a coalition's member joins the other one, and a victim whose
// sympathies lie with the attacker's enemies stands with them. Every other
// war is a pair's own. Fronts open between any two at war on their two ends
// (Tables.GW_FRONT_ENDS).
import {
  GW_ALLY_GRACE,
  GW_FRONT_START,
  GW_FRONT_UP,
  GW_SIDES,
  GW_THEATRES,
  GwPlan,
  GwSide,
  GwTheatre,
  GwTheatreState,
  GwWar,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { armyCommander } from "./People";
import {
  GW_BEHIND,
  GW_COALITION_FRONTS,
  GW_ENTRIES,
  GW_FRONT_ENDS,
  GW_MOBILISE,
  GW_START_TREATIES,
  GW_TRANSFERS,
  GwStartTreaty,
} from "./Tables";
import {
  clampTo,
  fights,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

const P_PLAN = idHash("gw_ai_plan");
const P_HONOUR = idHash("gw_honour");

/** The powers whose first war on each other is the general war. */
export const GW_GREAT: readonly GwTag[] = ["DEU", "AUH", "RUS", "FRA", "GBR"];

/** Who stood where when the July war came, and the neutrals' leanings. */
const CASCADE: Readonly<Partial<Record<GwTag, GwSide>>> = {
  DEU: "central",
  AUH: "central",
  RUS: "entente",
  FRA: "entente",
  SRB: "entente",
  MNE: "entente",
  BEL: "entente",
  GBR: "entente",
};

/** The side a country would stand on in the general war, if it is known. */
export function naturalSide(gw: GreatWar, tag: GwTag): GwSide | null {
  const n = gw.nation(tag);
  if (n !== null && n.side !== null) return n.side;
  return CASCADE[tag] ?? GW_ENTRIES.find((e) => e.tag === tag)?.natural ?? null;
}

// ---- The pairs ----

/** The live war between two countries, or null. */
export function warOf(gw: GreatWar, a: GwTag, b: GwTag): GwWar | null {
  return (
    gw.s.wars.find(
      (w) =>
        w.ended === null &&
        ((w.a === a && w.b === b) || (w.a === b && w.b === a)),
    ) ?? null
  );
}

export const atWarWith = (gw: GreatWar, a: GwTag, b: GwTag): boolean =>
  gw.nation(a)?.atWar.includes(b) === true;

/** Every nation's `atWar`, from the live wars in the order they began. */
export function syncAtWar(gw: GreatWar): void {
  for (const n of gw.s.nations) n.atWar = [];
  for (const w of gw.s.wars) {
    if (w.ended !== null) continue;
    const a = gw.nation(w.a);
    const b = gw.nation(w.b);
    if (a !== null && !a.atWar.includes(w.b)) a.atWar.push(w.b);
    if (b !== null && !b.atWar.includes(w.a)) b.atWar.push(w.a);
  }
}

/** Neither stands in a coalition against the other: a war of their own. */
export function outsideCoalitions(gw: GreatWar, w: GwWar): boolean {
  const a = gw.nation(w.a)?.side ?? null;
  const b = gw.nation(w.b)?.side ?? null;
  return a === null || b === null || a === b;
}

/** The live wars outside the coalitions (design B7 keeps them few). */
export function pairWars(gw: GreatWar): GwWar[] {
  return gw.s.wars.filter((w) => w.ended === null && outsideCoalitions(gw, w));
}

/** The low step every war goes through: the pair, mobilised. */
function addWar(gw: GreatWar, a: GwTag, b: GwTag, cause: string): boolean {
  const na = gw.nation(a);
  const nb = gw.nation(b);
  if (a === b || na === null || nb === null || na.out || nb.out) return false;
  if (warOf(gw, a, b) !== null) return false;
  gw.s.wars.push({ a, b, since: gw.s.chapter, cause, ended: null });
  for (const n of [na, nb]) {
    n.mob = 2;
    n.entered ??= gw.s.chapter;
  }
  syncAtWar(gw);
  return true;
}

/** Seats of both, each told of the other: a line and a memory. */
function tellPair(gw: GreatWar, a: GwTag, b: GwTag, key: string): void {
  for (const [me, them] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const seat of seatsOf(gw, me)) {
      const c = gw.s.chapter;
      if (
        !seat.log.some(
          (l) => l.key === key && l.chapter === c && l.tag === them,
        )
      ) {
        seat.log.push({ key, chapter: c, tag: them });
      }
      seat.memory.push({
        key: `${key}_${them.toLowerCase()}`,
        who: null,
        chapter: gw.s.chapter,
        weight: 0,
      });
    }
  }
}

// ---- The fronts ----

/** Who fights a front now on `end`, the lead first. */
export function membersOf(gw: GreatWar, t: GwTheatre, end: GwSide): GwTag[] {
  const behind = GW_BEHIND[t];
  const waiting =
    behind !== undefined && gw.nation(behind.once)?.out !== true
      ? behind.tags
      : [];
  const live = (tag: GwTag) => {
    const n = gw.nation(tag);
    return n !== null && !n.out && n.atWar.length > 0 && !waiting.includes(tag);
  };
  const ends = GW_FRONT_ENDS[t];
  const far = ends[other(end)].filter(live);
  return ends[end].filter(
    (tag) => live(tag) && far.some((f) => atWarWith(gw, tag, f)),
  );
}

/** The end of a front `tag` fights on now, or null. */
export function memberEnd(
  gw: GreatWar,
  t: GwTheatre,
  tag: GwTag,
): GwSide | null {
  return GW_SIDES.find((e) => membersOf(gw, t, e).includes(tag)) ?? null;
}

/**
 * The end of a front a country's land and armies count for: on the old
 * theatres its coalition, as ever; otherwise the end it is listed on, while
 * it is at war with someone on the other. Null: the front isn't its war.
 */
export function sideIn(gw: GreatWar, t: GwTheatre, tag: GwTag): GwSide | null {
  const n = gw.nation(tag);
  if (n === null) return null;
  if (n.side !== null && GW_COALITION_FRONTS.includes(t)) return n.side;
  const ends = GW_FRONT_ENDS[t];
  return (
    GW_SIDES.find(
      (e) =>
        ends[e].includes(tag) &&
        n.atWar.some((x) => ends[other(e)].includes(x)),
    ) ?? null
  );
}

function refreshTheatre(gw: GreatWar, t: GwTheatreState): void {
  const up = GW_FRONT_UP[t.id];
  const a = membersOf(gw, t.id, up);
  const d = membersOf(gw, t.id, other(up));
  const live = a.length > 0 && d.length > 0;
  t.attacker = a[0] ?? null;
  t.defender = d[0] ?? null;
  if (live && !t.open) {
    t.open = true;
    if (t.since === null) {
      t.since = gw.s.chapter;
      t.line = GW_FRONT_START[t.id];
      // A front opened in the machine-gun years is dug in from its first day.
      t.trench = Math.min(3, Math.floor(warMonths(gw) / 5));
      news(gw, "front_opened", null, null, t.id);
    }
  } else if (!live) {
    t.open = false;
  }
  for (const seat of gw.s.seats) {
    const mine = [...a, ...d].includes(seat.tag);
    if (t.open && mine && t.commander === null) {
      t.commander = armyCommander(gw, seat, t.id);
    }
  }
}

/** Opens and closes the theatres to match who fights. */
export function refreshTheatres(gw: GreatWar): void {
  for (const id of GW_THEATRES) {
    refreshTheatre(gw, gw.s.theatres.find((t) => t.id === id)!);
  }
}

// ---- Coalitions ----

/** `tag` takes `side`: what joining a coalition does to the country itself. */
function takeSide(gw: GreatWar, tag: GwTag, side: GwSide): void {
  const n = gw.nation(tag)!;
  n.side = side;
  n.mob = 2;
  n.entered ??= gw.s.chapter;
  turn(gw, `entered_${tag.toLowerCase()}`);
  callMobilisation(gw, tag);
}

/** `tag` joins `side`: at war with all that fight on the other. */
export function enter(
  gw: GreatWar,
  tag: GwTag,
  side: GwSide,
  why: string,
): void {
  const n = gw.nation(tag);
  if (n === null || n.side !== null || n.out) return;
  // Nobody joins a coalition it is fighting.
  const own = gw.s.nations.filter((e) => e.side === side && !e.out);
  if (own.some((e) => n.atWar.includes(e.tag))) return;
  takeSide(gw, tag, side);
  for (const e of gw.s.nations) {
    if (e.side !== other(side) || e.out) continue;
    addWar(gw, tag, e.tag, "entered");
  }
  news(gw, why, tag);
  refreshTheatres(gw);
}

/** A seat whose war came before its mobilisation paper signs it now. */
function callMobilisation(gw: GreatWar, tag: GwTag): void {
  const row = GW_MOBILISE[tag];
  const seat = gw.s.seats.find((x) => x.tag === tag);
  if (row?.atWar !== true || seat === undefined) return;
  if (seat.seen[row.scene] !== undefined) return;
  if (seat.scheduled.some((q) => q.scene === row.scene)) return;
  seat.scheduled.push({ scene: row.scene, chapter: gw.s.chapter + 1 });
}

/** Beaten, or fallen apart: it leaves every war and its theatres close. */
export function leaveWar(gw: GreatWar, tag: GwTag, why: string): void {
  const n = gw.nation(tag);
  if (n === null || n.out) return;
  n.out = true;
  for (const w of gw.s.wars) {
    if (w.ended === null && (w.a === tag || w.b === tag)) {
      w.ended = gw.s.chapter;
    }
  }
  syncAtWar(gw);
  news(gw, why, tag);
  turn(gw, `out_${tag.toLowerCase()}`);
  transfers(gw, tag);
  refreshTheatres(gw);
}

/**
 * Two countries make a peace of their own (design B5's `makePeace`): only
 * their war ends. A coalition's member left with no war is out of it.
 */
export function makePeace(
  gw: GreatWar,
  a: GwTag,
  b: GwTag,
  why = "pair_peace",
): boolean {
  const w = warOf(gw, a, b);
  if (w === null) return false;
  w.ended = gw.s.chapter;
  syncAtWar(gw);
  news(gw, why, a, b);
  tellPair(gw, a, b, "pair_peace_made");
  for (const tag of [a, b]) {
    const n = gw.nation(tag)!;
    if (n.side === null || n.out || n.atWar.length > 0) continue;
    n.out = true;
    turn(gw, `out_${tag.toLowerCase()}`);
    transfers(gw, tag);
  }
  refreshTheatres(gw);
  return true;
}

/** Nobody signed: the staff moves on the plan in the safe. */
function standingPlan(gw: GreatWar): void {
  gw.s.plan = "west";
  for (const seat of seatsOf(gw, "DEU")) {
    if (!seat.flags.includes("f_west_plan")) seat.flags.push("f_west_plan");
    reason(gw, seat, "plan_standing");
  }
}

/** The divisions a fallen enemy freed go to the fronts that are left. */
function transfers(gw: GreatWar, out: GwTag): void {
  for (const row of GW_TRANSFERS) {
    const n = gw.nation(row.tag);
    if (row.out !== out || n === null || !fights(n)) continue;
    n.base[row.to] = clampTo((n.base[row.to] ?? 0) + row.bands, 1, 5);
    n.strength[row.to] = clampTo((n.strength[row.to] ?? 0) + row.bands, 1, 5);
  }
}

/** Germany nobody plays still has its generals: most go west, not all. */
function germanPlan(gw: GreatWar): GwPlan {
  const deu = gw.nation("DEU");
  if (deu === null || gw.s.seats.some((x) => x.tag === "DEU")) return "west";
  const east = { cautious: 25, principled: 15, opportunist: 10, hardline: 0 };
  return wwRoll(gw.s.seed, P_PLAN, 0) % 100 < east[deu.ai] ? "east" : "west";
}

/**
 * The general war: two powers of opposite camps go to war while there are no
 * coalitions yet. They found them, treaties pull their partners in, and on
 * the west plan Germany's road to France runs through Belgium.
 */
export function openGeneral(
  gw: GreatWar,
  a: GwTag,
  b: GwTag,
  cause: string,
): void {
  const s = gw.s;
  if (s.warChapter !== null || s.armistice !== null) return;
  const na = gw.nation(a);
  const nb = gw.nation(b);
  if (na === null || nb === null || na.out || nb.out) return;
  s.warChapter = s.chapter;
  if (s.plan === null) {
    if (s.seats.some((x) => x.tag === "DEU")) standingPlan(gw);
    else s.plan = germanPlan(gw);
  }
  turn(gw, "war_began");
  const nb0 = naturalSide(gw, b);
  const sa = naturalSide(gw, a) ?? (nb0 === null ? "central" : other(nb0));
  takeSide(gw, a, sa);
  takeSide(gw, b, other(sa));
  addWar(gw, a, b, cause);
  news(gw, "war_declared", a);
  news(gw, "war_declared", b);
  // Who already fights one founder alone stands with the other.
  for (const n of s.nations) {
    if (n.side !== null || n.out || n.atWar.length === 0) continue;
    const sides = new Set(n.atWar.map((x) => gw.nation(x)?.side ?? null));
    sides.delete(null);
    const only = [...sides];
    if (only.length === 1 && only[0] !== null) {
      enter(gw, n.tag, other(only[0]), "entered_war");
    }
  }
  refreshTheatres(gw);
  pullTreaties(gw);
  const deu = gw.nation("DEU");
  if (s.plan === "west" && deu !== null && fights(deu)) {
    if (atWarWith(gw, "DEU", "FRA")) {
      declareWar(gw, "DEU", "BEL", "plan_west", "belgium_invaded");
      if (atWarWith(gw, "DEU", "BEL")) turn(gw, "belgium_invaded");
    }
  }
}

/** The July war: Vienna on Belgrade, and whatever the treaties make of it. */
export function openWar(gw: GreatWar): void {
  openGeneral(gw, "AUH", "SRB", "july");
}

/**
 * `a` declares war on `b`. The first war of two powers of opposite camps is
 * the general war; a neutral going to war on a coalition's member joins the
 * other; a victim whose sympathies lie with the attacker's enemies joins
 * them (its news line: `why`); two neutrals of opposite camps each join their
 * own once the coalitions stand. Otherwise it is the pair's own (`war_pair`).
 * Treaties then pull partners in. False when no new war began.
 */
export function declareWar(
  gw: GreatWar,
  a: GwTag,
  b: GwTag,
  cause: string,
  why = "war_declared",
): boolean {
  const s = gw.s;
  const na = gw.nation(a);
  const nb = gw.nation(b);
  if (a === b || na === null || nb === null || na.out || nb.out) return false;
  if (s.armistice !== null || atWarWith(gw, a, b)) return false;
  if (na.side !== null && na.side === nb.side) return false;
  if (s.warChapter === null && GW_GREAT.includes(a) && GW_GREAT.includes(b)) {
    const sa = naturalSide(gw, a);
    const sb = naturalSide(gw, b);
    if (sa !== null && sb !== null && sa !== sb) {
      openGeneral(gw, a, b, cause);
      return atWarWith(gw, a, b);
    }
  }
  if (na.side === null && nb.side !== null) {
    enter(gw, a, other(nb.side), "war_declared");
  } else if (
    na.side !== null &&
    nb.side === null &&
    naturalSide(gw, b) === other(na.side)
  ) {
    enter(gw, b, other(na.side), why);
  } else if (na.side === null && nb.side === null && s.warChapter !== null) {
    // Two outside the coalitions, of opposite camps: each joins its own.
    const sa = naturalSide(gw, a);
    const sb = naturalSide(gw, b);
    if (sa !== null && sb !== null && sa !== sb) {
      enter(gw, a, sa, "war_declared");
      enter(gw, b, sb, why);
    }
  }
  const joined = atWarWith(gw, a, b);
  if (!joined && !addWar(gw, a, b, cause)) return false;
  const w = warOf(gw, a, b)!;
  // Whoever came in, the declaration was `a`'s.
  w.a = a;
  w.b = b;
  w.cause = cause;
  if (!joined) {
    news(gw, "war_pair", a, b);
    tellPair(gw, a, b, "pair_war_began");
  }
  refreshTheatres(gw);
  pullTreaties(gw);
  return true;
}

// ---- Treaties of June 1914 ----

/** Partners in a starting treaty, either way round. */
export function startAllies(a: GwTag, b: GwTag): boolean {
  return GW_START_TREATIES.some(
    (r) =>
      r.kind !== "guarantee" &&
      ((r.by === a && r.for === b) || (r.by === b && r.for === a)),
  );
}

const HONOUR_BY_AI = {
  hardline: 10,
  principled: 10,
  opportunist: -15,
  cautious: -10,
} as const;

/**
 * Whether `row.by` comes in now. A seat is bound in the general war's first
 * chapter by its own papers, as in July; after that it decides on its own tab
 * and is only told. A government nobody plays: the treaty's force, its
 * character, its state, a seeded roll.
 */
function honours(
  gw: GreatWar,
  row: GwStartTreaty,
  foe: GwTag,
  age: number,
): boolean {
  const s = gw.s;
  const n = gw.nation(row.by)!;
  if (ruledBySeat(gw, row.by)) {
    if (s.warChapter === s.chapter) return true;
    for (const seat of seatsOf(gw, row.by)) reason(gw, seat, "treaty_calls");
    return false;
  }
  if (row.by === "ROU" && s.secrets.includes("rou_treaty_dead")) return false;
  // The first answer counts most: a partner that let the war start alone
  // rarely finds its courage a month later.
  let pct = row.pct + HONOUR_BY_AI[n.ai] - age * 25;
  if (n.unrest >= 2) pct -= 20;
  if (row.kind === "protector" && s.temp >= 6) pct += 10;
  const roll =
    wwRoll(
      s.seed,
      P_HONOUR,
      s.chapter,
      idHash(`${row.id}_${row.by}`),
      idHash(foe),
    ) % 100;
  return roll < pct;
}

/** `by` comes in at `of`'s side against `foe`. */
function bring(gw: GreatWar, by: GwTag, of: GwTag, foe: GwTag): void {
  const side = gw.nation(of)?.side ?? null;
  const n = gw.nation(by)!;
  if (side !== null && n.side === null) enter(gw, by, side, "war_declared");
  if (!atWarWith(gw, by, foe)) declareWar(gw, by, foe, "treaty");
  for (const seat of seatsOf(gw, by)) reason(gw, seat, "treaty_honoured");
}

/** Not state: a pull in progress lets the inner ones wait for its next pass. */
let pulling = false;

/**
 * Every starting treaty whose case has come: a partner at war with one it is
 * bound against, the war young (GW_ALLY_GRACE chapters), the partner not the
 * one who started it where the treaty is defensive. Runs to a standstill.
 */
export function pullTreaties(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null || pulling) return;
  pulling = true;
  try {
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const row of GW_START_TREATIES) {
        if (row.kind === "guarantee") continue;
        const by = gw.nation(row.by);
        const of = gw.nation(row.for);
        if (by === null || of === null || by.out || of.out) continue;
        for (const foe of [...of.atWar]) {
          if (foe === row.by || atWarWith(gw, row.by, foe)) continue;
          if (row.against !== undefined && !row.against.includes(foe)) continue;
          const f = gw.nation(foe);
          if (f === null || (by.side !== null && by.side === f.side)) continue;
          const w = warOf(gw, row.for, foe);
          if (w === null || s.chapter - w.since > GW_ALLY_GRACE) continue;
          if (row.kind === "defensive" && w.a === row.for) continue;
          if (!honours(gw, row, foe, s.chapter - w.since)) continue;
          bring(gw, row.by, row.for, foe);
          moved = true;
        }
      }
      if (!moved) return;
    }
  } finally {
    pulling = false;
  }
}
