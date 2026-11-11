// Great War 1914, ww180 (8): the war of words. Four campaigns, ordered from
// the 정보부 tab's 뒷공작 rows (or the AI's character):
// - home: posters, speeches and the papers keep the nerve up (morale), less
//   each time the people have heard it before;
// - hush: the censor keeps bad news out of the papers for a while (morale
//   losses from the casualty lists, a broken front and rumours are held), at
//   once a cost with the house; what was kept out may come out later, worse;
// - leaflets: on an enemy's home front, his order falls slowly, faster where
//   bread is short and the streets are restless;
// - papers: a neutral's papers are bought: its lean moves our way and its
//   readiness rises, until the money is found out and it turns.
// Results come as silent cards; nothing shows before the pick.
import {
  GwInstitution,
  GwPropState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwPropAct,
  GwPropCan,
  GwPropView,
} from "@openfront/engine-api/ww1914/GwAgents";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { GW_SPY_POWERS, intelOf } from "./Spies";
import { atWarWith, naturalSide } from "./Wars";
import {
  clampTo,
  fights,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_HOME = idHash("gw_prop_home");
const P_HUSH = idHash("gw_prop_hush");
const P_LEAF = idHash("gw_prop_leaflets");
const P_PAPER = idHash("gw_prop_papers");
const P_PAPER_OUT = idHash("gw_prop_papers_out");
const P_AI = idHash("gw_prop_ai");

const NEVER = -1_000_000;
/** How long each campaign runs, in days. */
const HOME_DAYS = 120;
const HUSH_DAYS = 90;
const LEAF_DAYS = 180;
const PAPER_DAYS = 120;
const OPS_KEPT = 6;
/** The house that answers for a censor; others pay in authority. */
const HOUSE: Partial<Record<GwTag, GwInstitution>> = {
  DEU: "reichstag",
  GBR: "commons",
  FRA: "chamber",
  RUS: "duma",
};
/** Neutrals whose papers can be bought. */
const NEUTRAL_PAPERS: readonly GwTag[] = [
  "USA",
  "ITA",
  "ROU",
  "BGR",
  "GRC",
  "OTT",
];
/** Percent a chapter the AI starts each campaign, by character. */
const AI_PCT: Record<
  "cautious" | "hardline" | "opportunist" | "principled",
  Record<GwPropAct, number>
> = {
  hardline: { home: 30, hush: 25, leaflets: 10, papers: 6 },
  opportunist: { home: 25, hush: 20, leaflets: 12, papers: 10 },
  cautious: { home: 15, hush: 10, leaflets: 5, papers: 4 },
  principled: { home: 10, hush: 0, leaflets: 5, papers: 3 },
};

const idx = (gw: GreatWar, tag: GwTag) =>
  gw.s.nations.findIndex((n) => n.tag === tag);
const roll = (gw: GreatWar, p: number, ...k: number[]) =>
  wwRoll(gw.s.seed, p, gw.s.chapter, ...k) % 100;

function live(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  return n !== null && !n.out;
}

/** A country's campaigns, filled on first use. */
export function propOf(gw: GreatWar, tag: GwTag): GwPropState {
  const n = gw.nation(tag)!;
  n.prop ??= {
    home: NEVER,
    worn: 0,
    hush: NEVER,
    hidden: 0,
    leaflets: [],
    papers: [],
    ops: [],
  };
  return n.prop;
}

function record(gw: GreatWar, a: GwTag, act: GwPropAct, tag: GwTag | null) {
  const p = propOf(gw, a);
  p.ops.push({ act, tag, ok: false, out: false, chapter: gw.s.chapter });
  if (p.ops.length > OPS_KEPT) p.ops.splice(0, 1);
}

function lastOp(gw: GreatWar, a: GwTag, act: GwPropAct, tag?: GwTag | null) {
  const ops = gw.nation(a)?.prop?.ops ?? [];
  for (let i = ops.length - 1; i >= 0; i--) {
    if (ops[i].act === act && (tag === undefined || ops[i].tag === tag)) {
      return ops[i];
    }
  }
  return undefined;
}

/** Enemies whose home front leaflets can reach. */
function leafletTargets(gw: GreatWar, a: GwTag): GwTag[] {
  const n = gw.nation(a);
  if (n === null || !fights(n)) return [];
  return n.atWar.filter((f) => live(gw, f));
}

function running(list: readonly { tag: GwTag; until: number }[], day: number) {
  return list.filter((x) => x.until >= day);
}

/** Whether `a` can start `act` now (on `tag` where it takes one). */
export function propOpen(
  gw: GreatWar,
  a: GwTag,
  act: GwPropAct,
  tag?: GwTag,
): boolean {
  const n = gw.nation(a);
  if (n === null || n.out) return false;
  const p = n.prop;
  const day = gw.s.day;
  switch (act) {
    case "home":
      return fights(n) && (p?.home ?? NEVER) < day;
    case "hush":
      return fights(n) && (p?.hush ?? NEVER) < day;
    case "leaflets": {
      const on = running(p?.leaflets ?? [], day).map((x) => x.tag);
      const open = leafletTargets(gw, a).filter((x) => !on.includes(x));
      return tag === undefined ? open.length > 0 : open.includes(tag);
    }
    case "papers": {
      if (naturalSide(gw, a) === null) return false;
      const on = running(p?.papers ?? [], day).map((x) => x.tag);
      const open = NEUTRAL_PAPERS.filter(
        (x) =>
          x !== a &&
          live(gw, x) &&
          gw.nation(x)?.side === null &&
          !on.includes(x),
      );
      return tag === undefined ? open.length > 0 : open.includes(tag);
    }
  }
}

/** The row's own first pick: the weakest enemy, the likeliest neutral. */
function defaultTag(gw: GreatWar, a: GwTag, act: GwPropAct): GwTag | null {
  if (act === "leaflets") {
    const open = leafletTargets(gw, a).filter((x) => propOpen(gw, a, act, x));
    const order = (x: GwTag) => gw.nation(x)!.gauges.order;
    return [...open].sort((x, y) => order(x) - order(y))[0] ?? null;
  }
  return NEUTRAL_PAPERS.find((x) => propOpen(gw, a, "papers", x)) ?? null;
}

/** Starts a campaign: the scene's `prop` effect, and the AI's. */
export function propEffect(
  gw: GreatWar,
  a: GwTag,
  act: GwPropAct,
  tag?: GwTag,
): void {
  const n = gw.nation(a);
  if (n === null) return;
  const tagged = act === "leaflets" || act === "papers";
  const x = tagged ? (tag ?? defaultTag(gw, a, act)) : null;
  // Nothing to do now: the card says the campaign came to nothing.
  if ((tagged && x === null) || !propOpen(gw, a, act, x ?? undefined)) {
    record(gw, a, act, x);
    return;
  }
  const p = propOf(gw, a);
  const day = gw.s.day;
  record(gw, a, act, x);
  switch (act) {
    case "home":
      p.home = day + HOME_DAYS;
      p.worn++;
      return;
    case "hush": {
      p.hush = day + HUSH_DAYS;
      // The house is not told why the papers are quiet; it notices.
      const house = HOUSE[a];
      const v = house === undefined ? undefined : n.inst[house];
      if (house !== undefined && v !== undefined) {
        n.inst[house] = clampTo(v - 1, -5, 5);
      } else {
        n.authority = clampTo(n.authority - 5, 0, 100);
      }
      for (const seat of seatsOf(gw, a)) reason(gw, seat, "prop_hush_cost");
      return;
    }
    case "leaflets":
      p.leaflets = [
        ...running(p.leaflets, day),
        { tag: x!, until: day + LEAF_DAYS },
      ];
      return;
    case "papers":
      p.papers = [
        ...running(p.papers, day),
        { tag: x!, until: day + PAPER_DAYS },
      ];
      return;
  }
}

/** Whether a scene's `prop` condition holds for the seat. */
export function propHolds(
  gw: GreatWar,
  seat: GwSeatState,
  can: GwPropCan,
  tag?: GwTag,
  act?: GwPropAct,
): boolean {
  if (can === "ok" || can === "out") {
    const ops = gw.nation(seat.tag)?.prop?.ops ?? [];
    const o =
      act === undefined ? ops[ops.length - 1] : lastOp(gw, seat.tag, act);
    return o?.[can] === true;
  }
  return propOpen(gw, seat.tag, can, tag);
}

// ---- Chapter step ----

function homeStep(gw: GreatWar, a: GwTag, p: GwPropState): void {
  if (p.home < gw.s.day) return;
  const n = gw.nation(a)!;
  // Heard once, believed; heard every season, shrugged off.
  const pct = 45 - 10 * Math.min(3, p.worn - 1);
  if (n.gauges.morale >= 4 || roll(gw, P_HOME, idx(gw, a)) >= pct) return;
  moveGauge(gw, a, "morale", 1, "morale_propaganda");
  const o = lastOp(gw, a, "home");
  if (o !== undefined) o.ok = true;
}

/** The hush ends: what it held comes out, or stays buried. */
function hushStep(gw: GreatWar, a: GwTag, p: GwPropState): void {
  if (p.hidden === 0 || p.hush >= gw.s.day) return;
  const o = lastOp(gw, a, "hush");
  const out = roll(gw, P_HUSH, idx(gw, a)) < 15 + 15 * p.hidden;
  const kept = p.hidden;
  p.hidden = 0;
  if (o !== undefined) o.ok = true;
  if (!out) return;
  if (o !== undefined) o.out = true;
  moveGauge(gw, a, "morale", -Math.min(2, kept), "morale_hush_out");
  const n = gw.nation(a)!;
  const house = HOUSE[a];
  const v = house === undefined ? undefined : n.inst[house];
  if (house !== undefined && v !== undefined) {
    n.inst[house] = clampTo(v - 1, -5, 5);
  }
  news(gw, "prop_hush_out", a);
}

function leafletStep(gw: GreatWar, a: GwTag, p: GwPropState): void {
  for (const l of running(p.leaflets, gw.s.day)) {
    const nx = gw.nation(l.tag);
    if (nx === null || nx.out || !atWarWith(gw, a, l.tag)) continue;
    const o = lastOp(gw, a, "leaflets", l.tag);
    // Slowly, and by the state of the place: hunger and anger read them.
    const g = nx.gauges;
    const pct =
      8 +
      (g.order <= 2 ? 8 : 0) +
      (g.bread <= 1 ? 8 : 0) +
      (g.morale <= 1 ? 6 : 0) +
      6 * nx.unrest;
    if (roll(gw, P_LEAF, idx(gw, a), idx(gw, l.tag)) >= pct) continue;
    moveGauge(gw, l.tag, "order", -1, "order_leaflets");
    if (o !== undefined) {
      // A second hit closes the campaign: the readers have read enough.
      if (o.ok) l.until = gw.s.day - 1;
      o.ok = true;
    }
  }
}

function paperStep(gw: GreatWar, a: GwTag, p: GwPropState): void {
  const side = naturalSide(gw, a);
  for (const b of running(p.papers, gw.s.day)) {
    const nx = gw.nation(b.tag);
    if (nx === null || nx.out || nx.side !== null || side === null) continue;
    const o = lastOp(gw, a, "papers", b.tag);
    const k = idx(gw, b.tag);
    const outPct = 6 + 3 * intelOf(gw, b.tag).counter;
    if (roll(gw, P_PAPER_OUT, idx(gw, a), k) < outPct) {
      // The money is traced: the papers turn on whoever paid them.
      b.until = gw.s.day - 1;
      if (o !== undefined) o.out = true;
      nx.lean = clampTo(nx.lean + (side === "entente" ? -1 : 1), -1, 1);
      nx.trust[a] = clampTo((nx.trust[a] ?? 0) - 1, -3, 3);
      news(gw, "prop_papers_out", b.tag, a);
      for (const seat of seatsOf(gw, a)) reason(gw, seat, "prop_papers_out");
      continue;
    }
    if (roll(gw, P_PAPER, idx(gw, a), k) >= 35) continue;
    const toward = side === "entente" ? 1 : -1;
    if (nx.lean !== toward) nx.lean = clampTo(nx.lean + toward, -1, 1);
    else nx.readiness = clampTo(nx.readiness + 3, 0, 100);
    if (o !== undefined) o.ok = true;
  }
}

function aiStep(gw: GreatWar, a: GwTag): void {
  const n = gw.nation(a)!;
  const pct = AI_PCT[n.ai];
  const k = idx(gw, a);
  const g = n.gauges;
  if (g.morale <= 2 && propOpen(gw, a, "home")) {
    if (roll(gw, P_AI, k, 1) < pct.home) propEffect(gw, a, "home");
  }
  if (g.morale <= 1 && propOpen(gw, a, "hush")) {
    if (roll(gw, P_AI, k, 2) < pct.hush) propEffect(gw, a, "hush");
  }
  if (propOpen(gw, a, "leaflets") && roll(gw, P_AI, k, 3) < pct.leaflets) {
    propEffect(gw, a, "leaflets");
  }
  if (propOpen(gw, a, "papers") && roll(gw, P_AI, k, 4) < pct.papers) {
    propEffect(gw, a, "papers");
  }
}

/** Chapter step (from Intel.intelStep, after the agents). */
export function propagandaStep(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    const p = n.prop;
    if (p === undefined || n.out) continue;
    homeStep(gw, n.tag, p);
    hushStep(gw, n.tag, p);
    leafletStep(gw, n.tag, p);
    paperStep(gw, n.tag, p);
  }
  for (const a of GW_SPY_POWERS) {
    if (!live(gw, a) || ruledBySeat(gw, a)) continue;
    aiStep(gw, a);
  }
}

/** The seat's own campaigns; a result shows once its card came. */
export function propView(gw: GreatWar, seat: GwSeatState): GwPropView {
  const p = gw.nation(seat.tag)?.prop;
  const day = gw.s.day;
  if (p === undefined) {
    return { home: false, hush: false, leaflets: [], papers: [], ops: [] };
  }
  const now = gw.s.chapter;
  return {
    home: p.home >= day,
    hush: p.hush >= day,
    leaflets: running(p.leaflets, day).map((x) => x.tag),
    papers: running(p.papers, day).map((x) => x.tag),
    ops: p.ops.map((o) => ({
      act: o.act,
      tag: o.tag,
      ok: o.chapter >= now ? null : o.ok,
      out: o.chapter >= now ? null : o.out,
      chapter: o.chapter,
    })),
  };
}
