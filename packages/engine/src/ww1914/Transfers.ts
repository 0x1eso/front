// Great War 1914 (ww218 §4, §6): bands moved between fronts by rail, the home
// reserve, and what a country believes of the others' armies. A seat moves
// a band only through the chief of staff's paper "move"; the AI moves its own
// by its believed balance, never by the truth. Every roll has its own purpose.
import {
  GW_SIDES,
  GW_THEATRES,
  type GwAlloc,
  type GwNationState,
  type GwSeatState,
  type GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, type GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwProposal } from "@openfront/engine-api/ww1914/GwWorldView";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { hasTech } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { offensivesOf } from "./Offensives";
import { officeHolder } from "./People";
import { reads, spotBonus } from "./Spies";
import { easeStrain, endStrain } from "./Strain";
import { memberEnd, membersOf } from "./Wars";
import {
  clampTo,
  defOf,
  fights,
  news,
  other,
  reason,
  ruledBySeat,
} from "./World";

const P_BELIEF = idHash("gw_token_belief");

/** A band's strength cap, and the wear that costs a band (Fronts). */
const BAND_MAX = 5;
const WEAR_PER_BAND = 8;
/** Strain the receiving end sheds when a band arrives. */
const ARRIVE_EASE = 5;
/** Believed balance, tenths of a band, at which a staff wants a band. */
const SHORT_AT = -20;
const SHORT_AT_ANXIOUS = -10;
/** What a giving front may be left at, tenths: a hard staff takes a deficit. */
const GIVE_FLOOR = 0;
const GIVE_FLOOR_HARD = -10;
/** Chapters the ruler's ask stands (like a department's front course). */
const ASK_CHAPTERS = 1;
/** Chapters the reserve waits for the ruler's word before the default. */
const RESERVE_WAIT = 1;

/**
 * ww218 §2 mobility: rail at the start. Lane W stores the grown `rail` on the
 * nation (WarPower.ts); until merged this table is the reading.
 */
const RAIL_START: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 3,
  FRA: 2,
  GBR: 2,
  AUH: 1,
  RUS: 0,
};

export function railOf(gw: GreatWar, tag: GwTag): number {
  void gw;
  return RAIL_START[tag] ?? 1;
}

/** Chapters on the way: from a front 4 - rail, from home one fewer; at least 1. */
export function etaOf(
  gw: GreatWar,
  tag: GwTag,
  from: GwTheatre | null,
): number {
  const rail = railOf(gw, tag);
  return Math.max(1, (from === null ? 3 : 4) - rail);
}

/** Front-to-front moves on the rails at once: one, two at rail 3. */
function flyLimit(gw: GreatWar, tag: GwTag): number {
  return railOf(gw, tag) >= 3 ? 2 : 1;
}

type Lift = NonNullable<GwNationState["lift"]>;

function liftOf(n: GwNationState): Lift {
  n.lift ??= { fly: [], reserve: [] };
  return n.lift;
}

/** Bands waiting at home. */
export function reserveBands(n: GwNationState): number {
  return (n.lift?.reserve ?? []).reduce((a, r) => a + r.n, 0);
}

/**
 * New armies, freed divisions and conscription's men go home first: the chief
 * proposes where; `to` is where they go if nobody says (ww218 §4, decision 5B).
 */
export function toReserve(
  gw: GreatWar,
  tag: GwTag,
  to: GwTheatre,
  bands: number,
): void {
  const n = gw.nation(tag);
  if (n === null || bands <= 0) return;
  liftOf(n).reserve.push({ to, n: bands, since: gw.s.chapter });
}

/** An open front `tag` fights on now. */
function ownFront(gw: GreatWar, tag: GwTag, t: GwTheatre): boolean {
  const th = gw.s.theatres.find((x) => x.id === t);
  return th !== undefined && th.open && memberEnd(gw, t, tag) !== null;
}

/** Fronts no train reaches: the sea, and the colonies cut off by the fleets. */
const NO_RAIL: readonly GwTheatre[] = ["sea", "colonies"];

/** The open fronts `tag` fights on that bands can reach, in theatre order. */
export function frontsOf(gw: GreatWar, tag: GwTag): GwTheatre[] {
  return gw.s.theatres
    .filter(
      (t) =>
        t.open && !NO_RAIL.includes(t.id) && memberEnd(gw, t.id, tag) !== null,
    )
    .map((t) => t.id);
}

/** Why a band can't go from `from` (null: the reserve) to `to`, or null. */
export function moveBlock(
  gw: GreatWar,
  tag: GwTag,
  from: GwTheatre | null,
  to: GwTheatre,
): GwOrderBlock | null {
  const n = gw.nation(tag);
  if (n === null || !fights(n) || gw.s.armistice !== null) return "no_front";
  if (from === to || NO_RAIL.includes(to) || !ownFront(gw, tag, to)) {
    return "no_front";
  }
  if ((n.strength[to] ?? 0) >= BAND_MAX) return "front_full";
  if (from === null) return reserveBands(n) > 0 ? null : "no_band";
  if (NO_RAIL.includes(from) || !ownFront(gw, tag, from)) return "no_front";
  if ((n.strength[from] ?? 1) <= 1) return "no_band";
  const flying = (n.lift?.fly ?? []).filter((f) => f.from !== null).length;
  if (flying >= flyLimit(gw, tag)) return "in_flight";
  return null;
}

/** Sends a band on its way; false when it can't go. */
export function startMove(
  gw: GreatWar,
  tag: GwTag,
  from: GwTheatre | null,
  to: GwTheatre,
): boolean {
  if (moveBlock(gw, tag, from, to) !== null) return false;
  const n = gw.nation(tag)!;
  const lift = liftOf(n);
  if (from === null) {
    const r = lift.reserve[0];
    r.n -= 1;
    if (r.n <= 0) lift.reserve.shift();
  } else {
    n.strength[from] = clampTo((n.strength[from] ?? 1) - 1, 1, BAND_MAX);
    n.base[from] = clampTo((n.base[from] ?? 1) - 1, 1, BAND_MAX);
  }
  lift.fly.push({ from, to, at: gw.s.chapter + etaOf(gw, tag, from) });
  return true;
}

/**
 * Chapter step, before the fronts are judged: bands due arrive. One whose
 * front is gone waits in the reserve for another.
 */
export function arrivals(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    const lift = n.lift;
    if (lift === undefined || lift.fly.length === 0) continue;
    const due = lift.fly.filter((f) => f.at <= gw.s.chapter);
    if (due.length === 0) continue;
    lift.fly = lift.fly.filter((f) => f.at > gw.s.chapter);
    for (const f of due) {
      const end = memberEnd(gw, f.to, n.tag);
      if (!fights(n) || end === null || !ownFront(gw, n.tag, f.to)) {
        const next = frontsOf(gw, n.tag)[0];
        if (next !== undefined) toReserve(gw, n.tag, next, 1);
        continue;
      }
      n.strength[f.to] = clampTo((n.strength[f.to] ?? 0) + 1, 1, BAND_MAX);
      n.base[f.to] = clampTo((n.base[f.to] ?? 0) + 1, 1, BAND_MAX);
      easeStrain(gw, f.to, end, -ARRIVE_EASE);
      news(gw, "band_arrived", n.tag, null, f.to);
    }
  }
}

/**
 * Chapter step, after new armies: a seat's reserve that waited a chapter for
 * the ruler's word goes where it was bound; a country nobody plays sends its
 * reserve at once to its most strained front.
 */
export function reserveStep(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (n.lift === undefined || n.lift.reserve.length === 0) continue;
    if (!fights(n)) continue;
    const seat = ruledBySeat(gw, n.tag);
    for (const r of [...n.lift.reserve]) {
      if (seat && gw.s.chapter < r.since + RESERVE_WAIT) continue;
      const to = seat ? reserveDefault(gw, n.tag, r.to) : strained(gw, n.tag);
      if (to === null) continue;
      for (let k = r.n; k > 0; k--) {
        if (!startMove(gw, n.tag, null, to)) break;
      }
    }
  }
}

/** The bound front, or the most strained one when it is gone or full. */
function reserveDefault(
  gw: GreatWar,
  tag: GwTag,
  to: GwTheatre,
): GwTheatre | null {
  return moveBlock(gw, tag, null, to) === null ? to : strained(gw, tag);
}

/** The front of `tag`'s that strains most and can take a band, or null. */
function strained(gw: GreatWar, tag: GwTag): GwTheatre | null {
  let best: GwTheatre | null = null;
  let worst = -1;
  for (const t of frontsOf(gw, tag)) {
    if (moveBlock(gw, tag, null, t) !== null) continue;
    const th = gw.s.theatres.find((x) => x.id === t)!;
    const v = endStrain(th, memberEnd(gw, t, tag)!);
    if (v > worst) {
      worst = v;
      best = t;
    }
  }
  return best;
}

// ---- Beliefs: what a country thinks another has on a front ----

/** A band in tenths: strength less its wear. */
export function bandTenths(n: GwNationState, t: GwTheatre): number {
  const band = n.strength[t] ?? 1;
  const wear = clampTo(n.wear[t] ?? 0, 0, WEAR_PER_BAND - 1);
  return band * 10 - Math.floor((wear * 10) / WEAR_PER_BAND);
}

export type Seen =
  | "own"
  | "ally"
  | "contact"
  | "report"
  | "air"
  | "codes"
  | "none";

export interface Belief {
  sure: number;
  seen: Seen;
  /** The believed band, tenths; 0 at sure 0. */
  tenths: number;
  /** Percent off the truth the belief is (the roll and any deceit). */
  off: number;
}

/** Range of the estimate, percent either way, by sure 0..3. */
export const BELIEF_RANGE = [0, 40, 20, 10];

/** Allies on the same coalition, or the same end of this front. */
function friends(gw: GreatWar, t: GwTheatre, a: GwTag, b: GwTag): boolean {
  if (a === b) return true;
  const side = gw.nation(a)?.side ?? null;
  if (side !== null && side === gw.nation(b)?.side) return true;
  const ea = memberEnd(gw, t, a);
  return ea !== null && ea === memberEnd(gw, t, b);
}

/** A confirmed report on `of`'s strength there in the last 2 chapters (a seat's). */
function forceReport(
  gw: GreatWar,
  viewer: GwTag,
  t: GwTheatre,
  of: GwTag,
): boolean {
  const seat = gw.s.seats.find((x) => x.tag === viewer && x.memoir === null);
  if (seat === undefined) return false;
  return gw.s.reports.some(
    (r) =>
      r.smallID === seat.smallID &&
      r.fact === "force" &&
      r.tag === of &&
      r.theatre === t &&
      gw.s.chapter - r.chapter <= 2 &&
      (r.stamp === "confirmed" ||
        (r.stamp === "unconfirmed" && r.checkDay === null)),
  );
}

/** How sure `viewer` is of `of` on `t` (ww218 §5), and on what it rests. */
export function sureOf(
  gw: GreatWar,
  viewer: GwTag,
  t: GwTheatre,
  of: GwTag,
): { sure: number; seen: Seen } {
  if (viewer === of) return { sure: 3, seen: "own" };
  if (friends(gw, t, viewer, of)) return { sure: 2, seen: "ally" };
  const vn = gw.nation(viewer);
  if (vn === null) return { sure: 0, seen: "none" };
  const codes = reads(gw, viewer, of) || vn.intel?.raided?.[t] === gw.s.chapter;
  if (memberEnd(gw, t, viewer) === null) {
    return codes ? { sure: 1, seen: "codes" } : { sure: 0, seen: "none" };
  }
  let sure = 1;
  let seen: Seen = "contact";
  if (forceReport(gw, viewer, t, of)) {
    sure++;
    seen = "report";
  }
  if (hasTech(vn, "aerial_photos") || spotBonus(gw, viewer, t) >= 10) {
    sure++;
    seen = "air";
  }
  if (codes) {
    sure++;
    seen = "codes";
  }
  return { sure: Math.min(3, sure), seen };
}

/** A foe massing in secret reads low; a feint reads high (percent). */
function deceit(gw: GreatWar, t: GwTheatre, of: GwTag): number {
  let out = 0;
  for (const o of offensivesOf(gw)) {
    if (o.tag !== of || o.theatre !== t) continue;
    if (o.feint) out += 25;
    else if (o.method === "surprise" && o.launch === null) out -= 25;
  }
  return out;
}

/**
 * What `viewer` believes `of` has on `t`: the truth off by a roll of up to
 * (4 - sure) x 10 percent, never dead on below sure 3, plus deceit. The roll
 * holds two chapters, so the guess doesn't jump every month.
 */
export function beliefOf(
  gw: GreatWar,
  viewer: GwTag,
  t: GwTheatre,
  of: GwTag,
): Belief {
  const n = gw.nation(of);
  const truth = n === null ? 0 : bandTenths(n, t);
  const { sure, seen } = sureOf(gw, viewer, t, of);
  if (sure >= 3 && seen === "own") return { sure, seen, tenths: truth, off: 0 };
  if (sure === 0) return { sure, seen, tenths: 0, off: 0 };
  const span = (4 - sure) * 10;
  const roll = wwRoll(
    gw.s.seed,
    P_BELIEF,
    Math.floor(gw.s.chapter / 2),
    GW_TAGS.indexOf(viewer) * GW_TAGS.length + GW_TAGS.indexOf(of),
    GW_THEATRES.indexOf(t),
  );
  let off = (roll % (2 * span + 1)) - span;
  if (sure < 3 && Math.abs(off) < 5) off = off < 0 ? -5 : 5;
  if (seen !== "ally") off += deceit(gw, t, of);
  const tenths = Math.max(1, Math.floor((truth * (100 + off)) / 100));
  return { sure, seen, tenths, off };
}

/**
 * The balance on `t` as `viewer` sees it, tenths of a band, + for its end:
 * the best band counts whole and the rest two fifths (Fronts.bandOf).
 * `less`: a band taken from `viewer` there. Null: not its front.
 */
export function balanceOf(
  gw: GreatWar,
  viewer: GwTag,
  t: GwTheatre,
  less = 0,
): number | null {
  const end = memberEnd(gw, t, viewer);
  if (end === null) return null;
  const sum = (side: (typeof GW_SIDES)[number]) => {
    const list = membersOf(gw, t, side).map((tag) => {
      const b =
        tag === viewer
          ? bandTenths(gw.nation(tag)!, t) - less * 10
          : beliefOf(gw, viewer, t, tag).tenths;
      return Math.max(0, b);
    });
    if (list.length === 0) return 0;
    const best = Math.max(...list);
    const rest = list.reduce((a, b) => a + b, 0) - best;
    return best + Math.floor((rest * 2) / 5);
  };
  return sum(end) - sum(other(end));
}

/** A staff's move: from the front that can best spare a band to the shortest. */
function staffMove(
  gw: GreatWar,
  tag: GwTag,
  shortAt: number,
  giveFloor: number,
  keep: GwTheatre | null,
): { from: GwTheatre; to: GwTheatre } | null {
  const list = frontsOf(gw, tag).map((t) => ({
    t,
    bal: balanceOf(gw, tag, t)!,
  }));
  const short = list
    .filter((x) => x.bal <= shortAt)
    .sort((a, b) => a.bal - b.bal)[0];
  if (short === undefined) return null;
  const giver = list
    .filter(
      (x) =>
        x.t !== short.t &&
        x.t !== keep &&
        moveBlock(gw, tag, x.t, short.t) === null &&
        balanceOf(gw, tag, x.t, 1)! >= giveFloor,
    )
    .sort((a, b) => b.bal - a.bal)[0];
  return giver === undefined ? null : { from: giver.t, to: short.t };
}

/**
 * ww218 §6: a country nobody plays (or a regent's) moves a band when its
 * believed balance somewhere is two bands short and another front can spare
 * one. A hardline staff leaves the giver a band short; the rest none.
 */
export function aiTransfer(gw: GreatWar): void {
  if (gw.s.warChapter === null || gw.s.armistice !== null) return;
  for (const n of gw.s.nations) {
    if (!fights(n) || ruledBySeat(gw, n.tag)) continue;
    const floor = n.ai === "hardline" ? GIVE_FLOOR_HARD : GIVE_FLOOR;
    const m = staffMove(gw, n.tag, SHORT_AT, floor, null);
    if (m !== null) startMove(gw, n.tag, m.from, m.to);
  }
}

// ---- The chief's paper "move" (ww218 §4) ----

interface Chief {
  bold: boolean;
  anxious: boolean;
  wants: GwTheatre | null;
}

function chiefOf(gw: GreatWar, seat: GwSeatState): Chief {
  const cos = officeHolder(gw, seat, "chief_of_staff");
  const camps = cos === null ? [] : (defOf(cos.id)?.camps ?? []);
  const fronts = frontsOf(gw, seat.tag);
  const first =
    gw.s.plan === "east" || camps.includes("east") ? "east" : "west";
  return {
    bold:
      cos !== null &&
      (cos.temperament === "arrogant" ||
        cos.temperament === "stubborn" ||
        camps.includes("hard")),
    anxious: cos?.temperament === "anxious",
    wants: fronts.includes(first) ? first : (fronts[0] ?? null),
  };
}

/** Whether the chief is against taking a band from `from`. */
function objects(
  gw: GreatWar,
  seat: GwSeatState,
  c: Chief,
  from: GwTheatre | null,
): boolean {
  if (from === null) return false;
  if (c.bold && from === c.wants) return true;
  const after = balanceOf(gw, seat.tag, from, 1) ?? 0;
  return after < (c.bold ? GIVE_FLOOR_HARD : GIVE_FLOOR);
}

/** The ask still standing, or null. */
function askOf(gw: GreatWar, seat: GwSeatState) {
  const a = seat.moveAsk;
  if (a === undefined || gw.s.chapter > a.chapter + ASK_CHAPTERS) return null;
  return a;
}

/**
 * The paper "move" among the chief's, at most one: the ruler's ask first, then
 * the reserve waiting at home, then the chief's own when a front is short.
 * It keeps the chief's first plan and moves a band besides. The ruler's ask
 * he agrees with comes first, so he signs it if nobody does.
 */
export function withMove(
  gw: GreatWar,
  seat: GwSeatState,
  out: GwProposal[],
): GwProposal[] {
  const n = gw.nation(seat.tag);
  if (n === null || out.length === 0) return out;
  const c = chiefOf(gw, seat);
  let pick: { from: GwTheatre | null; to: GwTheatre; asked: boolean } | null =
    null;
  const ask = askOf(gw, seat);
  if (ask !== null && moveBlock(gw, seat.tag, ask.from, ask.to) === null) {
    pick = { from: ask.from, to: ask.to, asked: true };
  }
  if (pick === null && reserveBands(n) > 0) {
    const to = strained(gw, seat.tag);
    if (to !== null) pick = { from: null, to, asked: false };
  }
  if (pick === null) {
    const m = staffMove(
      gw,
      seat.tag,
      c.anxious ? SHORT_AT_ANXIOUS : SHORT_AT,
      c.bold ? GIVE_FLOOR_HARD : GIVE_FLOOR,
      c.bold ? c.wants : null,
    );
    if (m !== null) pick = { ...m, asked: false };
  }
  if (pick === null) return out;
  const base = out.find((p) => p.open) ?? null;
  const plan: Omit<GwAlloc, "research"> =
    base === null
      ? { main: out[0].main, posture: "hold", scale: "limited", allyShare: 0 }
      : {
          main: base.main,
          posture: base.posture,
          scale: base.scale,
          allyShare: base.allyShare,
        };
  const against = pick.asked && objects(gw, seat, c, pick.from);
  const paper: GwProposal = {
    id: "move",
    by: base?.by ?? out[0].by,
    ...plan,
    open: true,
    why: null,
    estimate: base?.estimate ?? out[0].estimate,
    tell: [...(base?.tell ?? []), "move"],
    claimed: base?.claimed ?? [],
    move: {
      from: pick.from,
      to: pick.to,
      eta: etaOf(gw, seat.tag, pick.from),
      asked: pick.asked,
      objects: against,
    },
  };
  return pick.asked && !against
    ? [paper, ...out]
    : [out[0], paper, ...out.slice(1)];
}

/** The paper "move" signed: the band goes; a chief against it is overruled. */
export function signMove(gw: GreatWar, seat: GwSeatState, p: GwProposal): void {
  const m = p.move;
  if (m === undefined) return;
  if (!startMove(gw, seat.tag, m.from, m.to)) return;
  if (m.asked) delete seat.moveAsk;
  reason(gw, seat, m.from === null ? "move_reserve" : "move_signed");
  if (!m.objects) return;
  const cos = officeHolder(gw, seat, "chief_of_staff");
  if (cos === null) return;
  seat.memory.push({
    key: "dept_overruled",
    who: cos.id,
    chapter: gw.s.chapter,
    weight: -1,
  });
  reason(gw, seat, "move_overruled", cos.id);
}

/** The order move_band: the ruler asks the chief to move a band. */
export function moveBandOrder(
  gw: GreatWar,
  seat: GwSeatState,
  from: GwTheatre | null,
  to: GwTheatre,
): GwOrderBlock | null {
  const no = moveBlock(gw, seat.tag, from, to);
  if (no !== null) return no;
  seat.moveAsk = { from, to, chapter: gw.s.chapter };
  return null;
}
