// P5 lane W (plan Task 2): the peace conference (spec §6; plan decisions
// 11–16, 33, 34). A conference opens the tick its wars end; its
// participants get points by war score; four rounds of up to five demands
// in snake order, control first; then the treaty. Integers only;
// participants by smallID, regions by id, demands by slot.
import {
  COUNTRIES,
  NAMED_DORMANT_TAGS,
} from "@openfront/engine-api/ww1936/Countries";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  CS_GONE,
  DEMAND_KINDS,
  DemandKind,
  PeaceDemand,
  WW_DISARM_DAYS,
  WW_DISARM_MAX_DIVISIONS,
  WW_PEACE_DEMANDS_PER_ROUND,
  WW_PEACE_LOG_SIZE,
  WW_PEACE_MAX_ROUNDS,
  WW_PEACE_ROUND_TICKS,
  WW_REPARATIONS_DAYS,
  WW_TRUCE_DAYS,
  WwConferenceView,
  WwDemandView,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  IDEO_DEM,
  IDEO_NEU,
  IDEOLOGIES,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  participantPoints,
  regionBaseValue,
  sharePm,
  turnOrder,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { wwRealTicks } from "@openfront/engine-lib/ww1936/Pace";
import {
  AssignIn,
  peaceAssignment,
  settleLosers,
  WW_PEACE_BIG_CITY_VP,
  WW_PEACE_LOSER_MIN_PCT,
} from "@openfront/engine-lib/ww1936/PeaceAssign";
import {
  demandKindIndex,
  expandPeaceDemand,
  PeaceDemandIn,
  PeaceFacts,
  peaceMainVictor,
  peacePlanCost,
  peaceRegionCost,
  peaceStakeHas,
  PeaceTable,
  planPeaceDemand,
  REGION_DEMAND_KINDS,
} from "@openfront/engine-lib/ww1936/PeaceRules";
import { SHIP_BASE } from "@openfront/engine-lib/ww1936/ShipStats";
import { capitulate as capitulateCountry } from "../Capitulation";
import { effectiveBuildings } from "../economy/Buildings";
import { transferRegionPeaceful } from "../land/PoliticsBridge";
import { dissolveFaction, leaveFaction } from "../politics/Factions";
import { setGovernment } from "../politics/Ideology";
import { addSpirit } from "../politics/Spirits";
import { activateCountry, landRegained, releasableTags } from "./Activate";
import { endCivilWar } from "./CivilWar";
import { endExile, offerTakeover } from "./Exile";
import { aiDemands, peaceAiShared } from "./PeaceAi";
import { endIndependenceWar, endSubject, makeSubject } from "./Subjects";
import {
  countryListParams,
  countryParams,
  loserIds,
  registerWarEnds,
} from "./Wars";
import { setTruce } from "./WhitePeace";
import type { Conference, Settled, StoredDemand, WwEndgame } from "./WwEndgame";

/** DEMAND_KINDS index of each kind (StoredDemand.kind, Settled.kind). */
export const KIND = Object.fromEntries(
  DEMAND_KINDS.map((k) => [k, demandKindIndex(k)]),
) as Record<DemandKind, number>;
/** Kinds that hand regions out (take, take_group, take_for, annex_rest, occupation_zone, release, liberate). */
export const REGION_KINDS: ReadonlySet<number> = new Set(
  [...REGION_DEMAND_KINDS].map((k) => KIND[k]),
);
/** The arms limitation spirit a disarm treaty puts on (content, spec §6.4). */
export const ARMS_LIMIT_SPIRIT = "gen_arms_limit";

const asc = (a: number, b: number) => a - b;

/** A round's real 30 s at the game's pace (Pace: fewer, longer ticks unlimited). */
const roundTicks = (eg: WwEndgame) =>
  wwRealTicks(eg.mg.config().gameConfig(), WW_PEACE_ROUND_TICKS);

// A war's end (Wars.checkWarEnds) opens conferences and hands civil and
// independence wars to their lanes through these (Wars.ts stays light).
registerWarEnds({
  openConference: (eg, warIds, tick) => openConference(eg, warIds, tick),
  endCivilWar: (eg, warId, winner, tick) =>
    endCivilWar(eg, warId, winner, tick),
  endIndependenceWar: (eg, warId, winner, tick) =>
    endIndependenceWar(eg, warId, winner, tick),
});

export function conferenceById(eg: WwEndgame, id: number): Conference | null {
  return eg.conferences.find((c) => c.id === id) ?? null;
}

/** A demand as state (plan decision 11). */
export function stored(
  kind: DemandKind,
  slot: number,
  regions: readonly number[] = [],
  o: Partial<Pick<StoredDemand, "target" | "beneficiary" | "k" | "pct">> = {},
): StoredDemand {
  return {
    kind: KIND[kind],
    slot,
    regions: [...regions],
    target: o.target ?? 0,
    beneficiary: o.beneficiary ?? 0,
    k: o.k ?? 0,
    pct: o.pct ?? 0,
  };
}

// ---- Prices (spec §6.3, plan decision 13; the card previews the same) ----

/** Spec §6.3 base(r) = 4 + 2 × VP + 2 × (civilian + military + dockyards) + ⌊tiles / 2000⌋. */
export function regionBase(eg: WwEndgame, region: number): number {
  const r = eg.ww.scenario.region(region);
  if (r === undefined) return 0;
  const econ = eg.ww.economy;
  const f =
    effectiveBuildings(econ, region, "civ") +
    effectiveBuildings(econ, region, "mil") +
    effectiveBuildings(econ, region, "dock");
  return regionBaseValue(r.vp, f, r.tiles);
}

/** The engine's facts for the engine-lib demand rules (PeaceRules). */
export function peaceFacts(eg: WwEndgame): PeaceFacts {
  const ww = eg.ww;
  return {
    controller: (r) => ww.land.controller[r] ?? 0,
    legalOwner: (r) => ww.politics.legalOwner[r] ?? 0,
    hasCore: (id, r) => eg.hasCore(id, r),
    neighbours: (r) => ww.scenario.regionNeighbours(r),
    regionCivs: (r) => effectiveBuildings(ww.economy, r, "civ"),
    ledFactionSize: (L) => {
      const idx = ledFaction(eg, L);
      return idx < 0 ? 0 : (ww.politics.faction(idx)?.members.length ?? 0);
    },
    ships: (L) => shipsOf(eg, L),
  };
}

/**
 * The conference as the demand rules read it: a demand settled by a
 * participant that stopped playing does not count (its regions go back to
 * the pool; the treaty ignores it).
 */
export function peaceTable(eg: WwEndgame, c: Conference): PeaceTable {
  const live = (id: number) => eg.isActor(id);
  if (
    c.settled.every((s) => live(s.by)) &&
    c.claims.every(([p]) => live(p)) &&
    (c.assign ?? []).every(([, p]) => live(p))
  ) {
    return c;
  }
  // A claim of a participant that stopped playing holds nothing (Taiwan).
  return {
    ...c,
    settled: c.settled.filter((s) => live(s.by)),
    claims: c.claims.filter(([p]) => live(p)),
    assign: c.assign?.filter(([, p]) => live(p)),
  };
}

/** What one pass over a conference reads (built once per round, AI run or view). */
export interface PeaceCtx {
  facts: PeaceFacts;
  table: PeaceTable;
  /** The participant with the most war score still playing (0: none). */
  mainVictor: number;
}
export function peaceCtx(eg: WwEndgame, c: Conference): PeaceCtx {
  return {
    facts: peaceFacts(eg),
    table: peaceTable(eg, c),
    mainVictor: peaceMainVictor(c.parts.filter((p) => eg.isActor(p.id))),
  };
}

/** A stored demand as the engine-lib rules read it. */
export function demandIn(d: StoredDemand): PeaceDemandIn {
  return {
    kind: DEMAND_KINDS[d.kind],
    regions: d.regions,
    target: d.target,
    beneficiary: d.beneficiary,
    k: d.k,
    pct: d.pct,
  };
}

/**
 * Plan decision 13: the cost of `region` to `p`, received by `beneficiary`
 * (p itself, or take_for's receiver): control, claim and conquest goal by
 * p, the core by the receiver, ×200% when another participant controls it.
 */
export function regionCost(
  eg: WwEndgame,
  c: Conference,
  region: number,
  p: number,
  beneficiary: number,
  facts: PeaceFacts = peaceFacts(eg),
): number {
  const base = peaceStakeHas(c.stake, region)
    ? undefined
    : regionBase(eg, region);
  return peaceRegionCost(facts, c, region, p, beneficiary, base);
}

/**
 * Spec §6.4 dismantle: the faction `L` leads — still, or the one it founded
 * and lost the lead of when it capitulated (P3 passes the lead on); -1:
 * none.
 */
export function ledFaction(eg: WwEndgame, L: number): number {
  const pol = eg.ww.politics;
  const idx = pol.factionIdx(L);
  const f = idx < 0 ? null : pol.faction(idx);
  if (f === null) return -1;
  const tag = pol.tagOf(L);
  if (f.leader === L || f.nameTag === tag) return idx;
  const row = pol.content.factionNames.find((n) => n.id === f.name);
  return row?.creators[0] === tag ? idx : -1;
}

/** `L`'s ships, the heaviest first (supremacy weight; ties: ship id). */
export function shipsOf(eg: WwEndgame, L: number): { id: number; w: number }[] {
  const t = eg.ww.navy.ships;
  const out: { id: number; w: number }[] = [];
  for (let r = 0; r < t.rows; r++) {
    if (!t.alive(r) || t.owner[r] !== L) continue;
    out.push({ id: t.id[r], w: SHIP_BASE[SHIP_CLASSES[t.cls[r]]].supWeight });
  }
  return out.sort((a, b) => b.w - a.w || a.id - b.id);
}

/** The regions settled so far (any participant still playing), region → receiver. */
export function takenMap(eg: WwEndgame, c: Conference): Map<number, number> {
  const taken = new Map<number, number>();
  for (const s of c.settled) {
    if (!REGION_KINDS.has(s.kind) || !eg.isActor(s.by)) continue;
    for (const r of s.regions) taken.set(r, s.beneficiary || s.by);
  }
  return taken;
}

/** A demand's price now, for the card and the AI (no reservations, no points; 0: it can't be settled). */
export function priceOf(
  eg: WwEndgame,
  c: Conference,
  p: number,
  d: StoredDemand,
  taken: ReadonlyMap<number, number> = takenMap(eg, c),
  ctx: PeaceCtx = peaceCtx(eg, c),
  /** The stake regions not in `taken` (the AI passes the one it keeps; P5 final lane perf). */
  free?: (r: number) => boolean,
): number {
  let ok = free;
  if (ok === undefined) {
    const stake = new Set(c.stake);
    ok = (r) => stake.has(r) && !taken.has(r);
  }
  const plan = planPeaceDemand(ctx.facts, ctx.table, p, demandIn(d), ok);
  return typeof plan === "string" ? 0 : peacePlanCost(plan);
}

// ---- Opening (spec §6.1–§6.2, plan decisions 12, 14, 34) ----

/** Spec §6.1: a conference for the ended wars `warIds`; its id (0: none). */
export function openConference(
  eg: WwEndgame,
  warIds: readonly number[],
  tick: number,
  terms?: TermsOpening,
): number {
  const ww = eg.ww;
  const pol = ww.politics;
  const wars = [...warIds]
    .sort(asc)
    .map((id) => eg.war(id))
    .filter(
      (w): w is WwWar =>
        w !== null && w.ended !== null && w.ended.winner !== -1,
    );
  if (wars.length === 0) return 0;
  const loserSet = new Set<number>(terms?.losers ?? []);
  for (const w of wars) for (const id of loserIds(w)) loserSet.add(id);
  const losers = [...loserSet].sort(asc);
  const ws = new Map<number, number>();
  for (const w of wars) {
    for (const m of w.sides[w.ended!.winner as 0 | 1].members) {
      // Spec §6.1: the winners still playing (an exile plays).
      if (m.state !== "active" && m.state !== "exiled") continue;
      if (loserSet.has(m.id) || !eg.isActor(m.id)) continue;
      ws.set(m.id, (ws.get(m.id) ?? 0) + m.wsMilli);
    }
  }
  const ids = [...ws.keys()].sort(asc);
  if (ids.length === 0 || losers.length === 0) return 0;
  const ids0 = new Set(ids);
  const stake = ww.scenario.landRegions
    .map((r) => r.id)
    .filter((r) => loserSet.has(pol.legalOwner[r] ?? 0))
    .filter((r) => terms === undefined || termsStake(eg, r, ids0, loserSet))
    .sort(asc);
  const base = stake.map((r) => regionBase(eg, r));
  let total = 0;
  for (const b of base) total += b;
  const pts = participantPoints(
    total,
    ids.map((id) => ws.get(id)!),
    terms?.poolPct,
  );
  const { claims, conquer, topple } = goalsOf(eg, wars, ids, losers, stake);
  const human = ids.some((id) => eg.isHumanControlled(id));
  const busy =
    human &&
    eg.conferences.some((x) => x.status === 1 && x.parts.some((p) => p.human));
  const c: Conference = {
    id: eg.nextConfId++,
    warIds: wars.map((w) => w.id),
    losers,
    stake,
    base,
    parts: ids.map((id, i) => ({
      id,
      wsMilli: ws.get(id)!,
      pts: pts[i],
      human: eg.isHumanControlled(id),
    })),
    claims,
    conquer,
    topple,
    status: busy ? 0 : 1,
    doneDay: -1,
    round: 1,
    roundEndTick: tick + roundTicks(eg),
    openTick: tick,
    subs: [],
    ai: [],
    settled: [],
    lastRound: [],
    ...(terms === undefined ? {} : { asked: true as const }),
  };
  assignAtOpening(eg, c);
  eg.conferences.push(c);
  if (c.status === 1) refreshAi(eg, c);
  const params = countryListParams(eg, "losers", losers);
  for (const id of [...ids, ...losers]) {
    eg.message(id, "ww1936_conference_opened", params);
  }
  eg.news("news_peace_conference", params);
  eg.dirtyConf = true;
  return c.id;
}

/** What a side that asked for terms brings to its conference (AskTerms.ts). */
export interface TermsOpening {
  /** Its members: they lose without having capitulated. */
  losers: readonly number[];
  /** The share of the usual pool, percent. */
  poolPct: number;
}

/**
 * Ask for terms: at stake is what a winner holds, and what borders it, but
 * no capital of a loser (it goes back, as on a line peace).
 */
function termsStake(
  eg: WwEndgame,
  r: number,
  winners: ReadonlySet<number>,
  losers: ReadonlySet<number>,
): boolean {
  const ctrl = eg.ww.land.controller;
  for (const L of losers) if (legalCapital(eg, L) === r) return false;
  if (winners.has(ctrl[r] ?? 0)) return true;
  return eg.ww.scenario
    .regionNeighbours(r)
    .some((n) => winners.has(ctrl[n] ?? 0));
}

/** ww88: an AI democracy gets nothing assigned; a human keeps what it holds. */
function keepsLand(eg: WwEndgame, id: number): boolean {
  return (
    eg.isHumanControlled(id) ||
    eg.ww.politics.country(id)?.ruling !== IDEO_DEM
  );
}

/** A loser's capital while it is legally its own (0: none). */
function legalCapital(eg: WwEndgame, id: number): number {
  const sc = eg.ww.scenario;
  const tag = sc.tagOfSmallId(id);
  const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
  const cap = tile === null ? 0 : sc.regionAt(tile);
  return cap !== 0 && eg.ww.politics.legalOwner[cap] === id ? cap : 0;
}

/** The losers still in the game that asked for terms: no capitulation, armies kept. */
function livingAsked(eg: WwEndgame, c: Conference): Set<number> {
  if (c.asked !== true) return new Set();
  return new Set(
    c.losers.filter((L) => eg.isActor(L) && !eg.ww.isCapitulated(L)),
  );
}

/** The conference as PeaceAssign reads it. */
export function assignInput(eg: WwEndgame, c: Conference): AssignIn {
  const ww = eg.ww;
  const sc = ww.scenario;
  const legal = ww.politics.legalOwner;
  const ctrl = ww.land.controller;
  const handed = new Map(c.handed ?? []);
  const winners = c.parts.filter((p) => eg.isActor(p.id));
  const isWinner = new Set(winners.map((p) => p.id));
  const caps = new Map(c.losers.map((L) => [L, legalCapital(eg, L)]));
  return {
    regions: c.stake.map((r, i) => {
      const L = legal[r] ?? 0;
      const reg = sc.region(r);
      const isCap = caps.get(L) === r;
      const held = ctrl[r] ?? 0;
      return {
        region: r,
        loser: L,
        value: c.base[i],
        group: sc.regionSr(r),
        holder: handed.has(r) || !isWinner.has(held) ? 0 : held,
        handedTo: handed.get(r) ?? 0,
        port: sc.isPort(r),
        keyCity: isCap || (reg?.vp ?? 0) >= WW_PEACE_BIG_CITY_VP,
      };
    }),
    winners: winners.map((p) => ({
      id: p.id,
      wsMilli: p.wsMilli,
      keeps: keepsLand(eg, p.id),
    })),
    neighbours: (r) => sc.regionNeighbours(r),
    legal: (r) => legal[r] ?? 0,
    capitalOf: (L) => caps.get(L) ?? 0,
  };
}

/** ww88: the assignment, its compensation, decided once so everyone sees it. */
function assignAtOpening(eg: WwEndgame, c: Conference): void {
  const ctrl = eg.ww.land.controller;
  const stake = new Set(c.stake);
  // A region lost again since it was handed over was fought for after all.
  const handed = eg.handedOver.filter(
    ([r, to]) => stake.has(r) && ctrl[r] === to,
  );
  eg.handedOver = eg.handedOver.filter(([r]) => !stake.has(r));
  if (handed.length > 0) c.handed = handed.sort((a, b) => a[0] - b[0]);
  const out = peaceAssignment(assignInput(eg, c), {
    safe: livingAsked(eg, c),
  });
  c.assign = out.assign;
  c.comp = out.comp;
  for (const [id, pts] of out.comp) {
    const p = c.parts.find((x) => x.id === id);
    if (p !== undefined) p.pts += pts;
  }
}

/**
 * Plan decision 14: claims (P3 CLAIMS, the participants' claim goals on the
 * losers, a claim war's goal of its first declarer) ∩ the stake, and the
 * conquer and topple goals on the losers. P3 forgets goals on a
 * capitulated country, so the war record's goal is what usually remains.
 */
function goalsOf(
  eg: WwEndgame,
  wars: readonly WwWar[],
  ids: readonly number[],
  losers: readonly number[],
  stake: readonly number[],
): {
  claims: [number, number][];
  conquer: [number, number][];
  topple: [number, number][];
} {
  const pol = eg.ww.politics;
  const inStake = new Set(stake);
  const claims: [number, number][] = [];
  const conquer: [number, number][] = [];
  const topple: [number, number][] = [];
  for (const p of ids) {
    const tag = pol.tagOf(p);
    const groups = new Set<string>();
    const goals: { type: string; on: number }[] = [];
    for (const cl of pol.content.claims) {
      if (cl.tag === tag) for (const g of cl.groups) groups.add(g);
    }
    for (const g of pol.country(p)?.warGoals ?? []) {
      if (!losers.includes(g.on)) continue;
      if (g.type === "claim" && g.group !== "") groups.add(g.group);
      else goals.push({ type: g.type, on: g.on });
    }
    for (const w of wars) {
      if (w.goal === null || w.sides[0].members[0]?.id !== p) continue;
      const on = w.sides[1].members[0]?.id ?? 0;
      if (w.goal.type === "claim" && w.goal.group !== "") {
        groups.add(w.goal.group);
      } else if (losers.includes(on)) goals.push({ type: w.goal.type, on });
    }
    const regs = new Set<number>();
    for (const g of groups) {
      for (const r of pol.content.groupIdx.get(g)?.regions ?? []) {
        if (inStake.has(r)) regs.add(r);
      }
    }
    for (const r of [...regs].sort(asc)) claims.push([p, r]);
    for (const type of ["conquer", "topple"] as const) {
      const ons = [
        ...new Set(goals.filter((g) => g.type === type).map((g) => g.on)),
      ].sort(asc);
      for (const on of ons)
        (type === "conquer" ? conquer : topple).push([p, on]);
    }
  }
  return { claims, conquer, topple };
}

/**
 * Round start (spec §6.5-1): who is human now, and every participant's AI
 * demands (none for one that stopped playing).
 */
function refreshAi(eg: WwEndgame, c: Conference): void {
  for (const p of c.parts) p.human = eg.isHumanControlled(p.id);
  // P5 final lane (perf): what every participant reads alike, once.
  const shared = peaceAiShared(eg, c);
  c.ai = c.parts.map((p) => ({
    id: p.id,
    demands: eg.isActor(p.id) ? aiDemands(eg, c.id, p.id, shared) : [],
  }));
}

// ---- Submissions (spec §6.5-2, plan decisions 11, 15) ----

/** peace_submit / peace_pass (null demands). */
export function submitDemands(
  eg: WwEndgame,
  smallID: number,
  conf: number,
  demands: readonly PeaceDemand[] | null,
  tick: number,
): WwOrderBlock | null {
  const c = conferenceById(eg, conf);
  if (c === null || c.status !== 1) return "conference_closed";
  if (!c.parts.some((p) => p.id === smallID)) return "not_participant";
  const list: StoredDemand[] = [];
  if (demands !== null) {
    if (demands.length > WW_PEACE_DEMANDS_PER_ROUND) return "too_many_demands";
    for (let i = 0; i < demands.length; i++) {
      const sd = expandDemand(eg, c, smallID, demands[i], i);
      if (sd === null) return "bad_demand";
      list.push(sd);
    }
  }
  c.subs = c.subs.filter((s) => s.id !== smallID);
  c.subs.push({ id: smallID, demands: list, passed: demands === null });
  c.subs.sort((a, b) => a.id - b.id);
  const humans = c.parts.filter((p) => p.human && eg.isActor(p.id));
  if (humans.every((p) => c.subs.some((s) => s.id === p.id))) {
    c.roundEndTick = Math.min(c.roundEndTick, tick + 1);
  }
  eg.dirtyConf = true;
  return null;
}

/** Plan decision 11: a wire demand spelled out into regions; null: refused (bad_demand). */
export function expandDemand(
  eg: WwEndgame,
  c: Conference,
  p: number,
  d: PeaceDemand,
  slot: number,
): StoredDemand | null {
  const content = eg.ww.politics.content;
  const x = expandPeaceDemand(c, p, d, {
    groupRegions: (g) => content.groupIdx.get(g)?.regions ?? [],
    releasable:
      d.kind === "release" || d.kind === "liberate"
        ? releasableTags(eg, c.stake)
        : [],
    smallIdOf: (tag) => eg.ww.scenario.smallIdOf(tag),
    hasCore: (id, r) => eg.hasCore(id, r),
  });
  return x === null
    ? null
    : stored(x.kind, slot, x.regions, {
        target: x.target,
        beneficiary: x.beneficiary,
        k: x.k,
        pct: x.pct,
      });
}

// ---- Rounds (spec §6.5–§6.6, plan decisions 13, 15, 33, 34) ----

/** Spec §6.2 (plan decisions 33, 34): round deadlines; AI-only conferences run to the end this tick. */
export function stepConferences(eg: WwEndgame, tick: number): void {
  for (const c of [...eg.conferences]) {
    if (c.status !== 1) continue;
    if (!c.parts.some((p) => p.human)) {
      // AI only: every round now (plan decision 33).
      while (c.status === 1) closeRound(eg, c, tick);
      continue;
    }
    if (tick >= c.roundEndTick) closeRound(eg, c, tick);
  }
  if (
    !eg.conferences.some((c) => c.status === 1 && c.parts.some((p) => p.human))
  ) {
    const next = eg.conferences.find((c) => c.status === 0);
    if (next !== undefined) {
      next.status = 1;
      next.round = 1;
      next.roundEndTick = tick + roundTicks(eg);
      next.subs = [];
      refreshAi(eg, next);
      eg.dirtyConf = true;
    }
  }
}

function closeRound(eg: WwEndgame, c: Conference, tick: number): void {
  const settled = resolveRound(eg, c);
  const taken = takenMap(eg, c);
  const allTaken = c.stake.every((r) => taken.has(r));
  // B10: an empty first round doesn't end it (a pass must not void it).
  const empty = settled === 0 && c.round > 1;
  if (c.round >= WW_PEACE_MAX_ROUNDS || empty || allTaken) {
    finishConference(eg, c, tick);
    return;
  }
  c.round++;
  c.roundEndTick = tick + roundTicks(eg);
  c.subs = [];
  refreshAi(eg, c);
  for (const p of c.parts) {
    if (p.human) eg.message(p.id, "ww1936_conference_round", { n: c.round });
  }
  eg.dirtyConf = true;
}

/** This round's demands of `id`: its submission (a pass: none), else its AI default. */
function demandsOf(c: Conference, id: number): StoredDemand[] {
  const s = c.subs.find((x) => x.id === id);
  if (s !== undefined) return s.passed ? [] : s.demands;
  return c.ai.find((x) => x.id === id)?.demands ?? [];
}

/**
 * Plan decision 15 (control first): a region any of a participant's
 * demands names and that it controls now is its reservation this round.
 */
function reservations(
  eg: WwEndgame,
  c: Conference,
  order: readonly number[],
  taken: ReadonlyMap<number, number>,
): Map<number, number> {
  const ctrl = eg.ww.land.controller;
  const reserved = new Map<number, number>();
  for (const id of order) {
    if (!eg.isActor(id)) continue;
    for (const d of demandsOf(c, id)) {
      if (!REGION_KINDS.has(d.kind)) continue;
      for (const r of d.regions) {
        if (taken.has(r) || reserved.has(r) || ctrl[r] !== id) continue;
        reserved.set(r, id);
      }
    }
  }
  return reserved;
}

function resolveRound(eg: WwEndgame, c: Conference): number {
  const order = turnOrder(
    c.parts.map((p) => p.wsMilli),
    c.parts.map((p) => p.id),
    c.round,
  );
  const taken = takenMap(eg, c);
  const ctx = peaceCtx(eg, c);
  const reserved = reservations(eg, c, order, taken);
  const stake = new Set(c.stake);
  c.lastRound = [];
  let n = 0;
  for (let slot = 0; slot < WW_PEACE_DEMANDS_PER_ROUND; slot++) {
    for (const id of order) {
      // A participant that stopped playing settles nothing (its turn passes).
      if (!eg.isActor(id)) continue;
      const part = c.parts.find((p) => p.id === id)!;
      for (const d of demandsOf(c, id)) {
        if (d.slot !== slot) continue;
        const free = (r: number) =>
          stake.has(r) && !taken.has(r) && (reserved.get(r) ?? id) === id;
        const res = tryDemand(eg, c, part, d, free, taken, ctx);
        c.lastRound.push({
          by: id,
          kind: d.kind,
          // T23 determinism lane: a copy (settled holds the same array; a
          // restored game has two).
          regions: [...res.regions],
          target: d.target,
          ok: res.ok,
        });
        if (res.ok) n++;
      }
    }
  }
  eg.dirtyConf = true;
  return n;
}

/** One demand at its turn: settled when valid and affordable (points are spent only then). */
function tryDemand(
  eg: WwEndgame,
  c: Conference,
  part: Conference["parts"][number],
  d: StoredDemand,
  free: (r: number) => boolean,
  taken: Map<number, number>,
  ctx: PeaceCtx,
): { ok: boolean; regions: number[] } {
  const p = part.id;
  // The table again for each demand: this round's settlements count.
  const plan = planPeaceDemand(
    ctx.facts,
    peaceTable(eg, c),
    p,
    demandIn(d),
    free,
  );
  if (typeof plan === "string") return { ok: false, regions: [] };
  const legal = eg.ww.politics.legalOwner;
  const kind = DEMAND_KINDS[d.kind];
  const row = (s: Partial<Settled>): Settled => ({
    kind: d.kind,
    by: p,
    regions: [],
    target: d.target,
    beneficiary: p,
    k: d.k,
    pct: d.pct,
    round: c.round,
    cost: 0,
    ...s,
  });
  if ("each" in plan) {
    const got: number[] = [];
    const b = kind === "take_for" ? d.beneficiary : p;
    const k = kind === "take_group" ? KIND.take : d.kind;
    for (const [r, cost] of plan.each) {
      if (cost > part.pts || !free(r)) continue;
      part.pts -= cost;
      got.push(r);
      if (kind !== "demilitarise") taken.set(r, b);
      c.settled.push(
        row({
          kind: k,
          regions: [r],
          target: legal[r] ?? 0,
          beneficiary: b,
          cost,
        }),
      );
    }
    return { ok: got.length > 0, regions: got };
  }
  if (plan.cost > part.pts) return { ok: false, regions: [] };
  part.pts -= plan.cost;
  const regions =
    kind === "take_navy" ? [...plan.all] : [...plan.all].sort(asc);
  if (REGION_KINDS.has(d.kind)) {
    for (const r of regions) taken.set(r, plan.receiver);
  }
  c.settled.push(
    row({
      regions,
      target:
        kind === "occupation_zone" || kind === "release" || kind === "liberate"
          ? (legal[regions[0]] ?? 0)
          : d.target,
      beneficiary: plan.receiver,
      cost: plan.cost,
    }),
  );
  return { ok: true, regions };
}

// ---- The treaty (spec §6.7, in this order) ----

/** Spec §6.7: the conference's results, then its record (status 2, doneDay). */
export function finishConference(
  eg: WwEndgame,
  c: Conference,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const land = ww.land;
  const day = ww.inPrep(tick) ? 0 : ww.day(tick);
  const actor = (id: number) => eg.isActor(id);
  // A participant that stopped playing gets nothing: its settlements are
  // ignored (their regions fall back to the loser in step 6).
  const bought = c.settled.filter((s) => actor(s.by));
  const landBefore = legalValues(eg, livingAsked(eg, c));
  // ww88: the assignment, as takes that cost nothing: what nobody bought.
  const live = [...bought, ...assignmentRows(eg, c, bought)];
  const of = (k: DemandKind) => live.filter((s) => s.kind === KIND[k]);
  // 1. The ended wars' pairs (P3 end_war's pair removal only).
  const pairs: [number, number][] = [];
  for (const [key, w] of eg.pairWar) {
    if (c.warIds.includes(w))
      pairs.push([Math.floor(key / eg.size), key % eg.size]);
  }
  for (const [a, b] of pairs) ww.endWar(a, b);
  // 2. Factions dismantled.
  for (const s of of("dismantle")) {
    const idx = ledFaction(eg, s.target);
    if (idx >= 0) dissolveFaction(pol, idx, tick);
  }
  // 3. Regions taken: legal owner and control (cores unchanged, spec §7).
  for (const s of [...of("take"), ...of("take_for"), ...of("annex_rest")]) {
    const to = s.beneficiary;
    if (!actor(to)) continue;
    for (const r of s.regions) {
      pol.setLegalOwner(r, to);
      transferRegionPeaceful(land, r, to, tick);
    }
  }
  // 4. Countries released or liberated (spec §3.3).
  for (const s of [...of("release"), ...of("liberate")]) {
    const p = s.by;
    const T = s.beneficiary;
    const tag = ww.tagOf(T);
    const release = s.kind === KIND.release;
    const ruling = IDEOLOGIES[pol.country(p)?.ruling ?? IDEO_NEU];
    const named =
      (NAMED_DORMANT_TAGS as readonly string[]).includes(tag) &&
      eg.countryState(T) === "dormant";
    const leads = pol.faction(pol.factionIdx(p))?.leader === p;
    activateCountry(
      eg,
      tag,
      {
        regions: s.regions,
        overlord: release ? { smallID: p, level: "puppet" } : undefined,
        government: release || named ? { ideology: ruling } : undefined,
        equipFrom: p,
        techFrom: p,
        faction: release ? "overlord" : leads ? pol.factionIdx(p) : "none",
      },
      tick,
    );
  }
  // 5. Occupation zones: control only, until the end (spec §6.4).
  for (const s of of("occupation_zone")) {
    for (const r of s.regions) {
      if (!eg.isZone(r))
        eg.zones.push({ region: r, holder: s.by, untilDay: -1 });
      transferRegionPeaceful(land, r, s.by, tick);
    }
    eg.dirtyZones = true;
  }
  // 6. What nobody took or was assigned goes back to its loser, which lives
  // again (one that asked for terms never stopped).
  const asked = livingAsked(eg, c);
  const revived: number[] = [];
  for (const L of c.losers) {
    const left: number[] = [];
    for (const r of c.stake) {
      if (pol.legalOwner[r] !== L || eg.isZone(r)) continue;
      left.push(r);
    }
    if (left.length === 0 && !asked.has(L)) {
      eg.setCountryState(L, CS_GONE);
      continue;
    }
    for (const r of left) transferRegionPeaceful(land, r, L, tick);
    revived.push(L);
    if (!asked.has(L)) {
      landRegained(eg, L, tick);
      // Its peace is made: out of its other wars too, so no second
      // conference shares out its land (spec §4.4).
      for (const w of eg.wars) {
        if (w.ended !== null || c.warIds.includes(w.id)) continue;
        if (eg.member(w, L)?.state === "capitulated") {
          eg.setMemberState(w.id, L, "left");
        }
      }
    }
    const puppet = of("puppet").find((s) => s.target === L);
    if (puppet !== undefined) {
      makeSubject(eg, L, puppet.by, "puppet", false, tick);
    } else if (pol.factionIdx(L) >= 0) {
      // Pre-flight §0-9: a peace takes the loser out of its alliance.
      leaveFaction(pol, L, tick);
    }
    const gov = of("change_government").find((s) => s.target === L);
    if (gov !== undefined) {
      setGovernment(pol, L, pol.country(gov.by)?.ruling ?? IDEO_NEU, tick);
    }
  }
  // 7. Demilitarised regions, reparations, disarmament (a living loser only).
  for (const L of revived) {
    for (const s of of("demilitarise")) {
      for (const r of s.regions) {
        if (pol.legalOwner[r] !== L) continue;
        if (!eg.dmz.some(([x, y]) => x === r && y === L)) eg.dmz.push([r, L]);
        if (ww.economy.fort[r] !== 0) {
          ww.economy.fort[r] = 0;
          ww.economy.markRegionDirty(r);
        }
      }
    }
    for (const s of of("reparations")) {
      if (s.target !== L) continue;
      eg.reparations.push({
        from: L,
        to: s.by,
        k: s.k,
        untilDay: day + WW_REPARATIONS_DAYS,
      });
    }
    if (of("disarm").some((s) => s.target === L)) disarm(eg, L, day);
  }
  // 8. Ships handed over; a dead loser's last ships are scuttled.
  for (const s of of("take_navy")) {
    for (const id of s.regions) {
      const r = ww.navy.ships.rowOf(id);
      if (r >= 0 && ww.navy.ships.owner[r] === s.target) {
        ww.navy.transferShip(id, s.by);
      }
    }
  }
  for (const L of c.losers) {
    if (revived.includes(L)) continue;
    for (const s of shipsOf(eg, L)) ww.navy.removeShip(s.id, false, tick);
  }
  // 9. Exiles end (X: one that holds land again plays on; the treaty is
  // no liberation, so "collapsed"); a gone human without a card takes over.
  for (const L of c.losers) {
    const back = revived.includes(L);
    if (eg.isExile(L)) endExile(eg, L, tick, "collapsed");
    const client = eg.humanClientOf(L);
    if (
      client !== null &&
      !back &&
      !eg.isActor(L) &&
      !eg.takeoverCards.some((x) => x.client === client)
    ) {
      offerTakeover(eg, client, L, tick);
    }
  }
  // 10. A lost independence war frees its subjects.
  for (const id of c.warIds) {
    const w = eg.war(id);
    if (w === null || w.kind !== "independence" || w.ended?.winner !== 0) {
      continue;
    }
    for (const m of w.sides[0].members) {
      const sub = eg.subjectOf(m.id);
      if (sub !== null && c.losers.includes(sub.overlord)) {
        endSubject(eg, m.id, tick);
      }
    }
  }
  // 11. The record and the news.
  const lines = treatyLines(eg, c, live);
  eg.peaceLog.unshift({ day, losers: [...c.losers], lines });
  if (eg.peaceLog.length > WW_PEACE_LOG_SIZE) {
    eg.peaceLog.length = WW_PEACE_LOG_SIZE;
  }
  const params = countryListParams(eg, "losers", c.losers);
  eg.news("news_peace_treaty", { ...params, lines: lines.length });
  for (const id of [...c.parts.map((p) => p.id), ...c.losers]) {
    eg.message(id, "ww1936_conference_result", params);
  }
  c.status = 2;
  c.doneDay = day;
  c.subs = [];
  eg.dirtyConf = true;
  eg.dirtyPeaceLog = true;
  eg.dirtyWars = true;
  eg.adminDirty = true;
  if (asked.size > 0) finishTerms(eg, c, asked, landBefore, day, tick);
}

/** Each country's legal land value, by the conference's base. */
function legalValues(
  eg: WwEndgame,
  ids: ReadonlySet<number>,
): Map<number, number> {
  const out = new Map<number, number>();
  if (ids.size === 0) return out;
  const legal = eg.ww.politics.legalOwner;
  for (const r of eg.ww.scenario.landRegions) {
    const o = legal[r.id] ?? 0;
    if (ids.has(o)) out.set(o, (out.get(o) ?? 0) + regionBase(eg, r.id));
  }
  return out;
}

/**
 * ww88 Ask for terms: a truce with every winner; a loser left under
 * WW_PEACE_LOSER_MIN_PCT of its land can't stand and capitulates the usual
 * way to the main victor.
 */
function finishTerms(
  eg: WwEndgame,
  c: Conference,
  asked: ReadonlySet<number>,
  before: ReadonlyMap<number, number>,
  day: number,
  tick: number,
): void {
  const parts = c.parts.filter((p) => eg.isActor(p.id));
  for (const L of asked) {
    for (const p of parts) setTruce(eg, L, p.id, day + WW_TRUCE_DAYS);
    const cap = legalCapital(eg, L);
    if (cap !== 0) transferRegionPeaceful(eg.ww.land, cap, L, tick);
  }
  const now = legalValues(eg, asked);
  const victor = peaceMainVictor(parts);
  for (const L of [...asked].sort(asc)) {
    const was = before.get(L) ?? 0;
    if ((now.get(L) ?? 0) * 100 >= was * WW_PEACE_LOSER_MIN_PCT) continue;
    const p = eg.mg.playerBySmallID(L);
    const to = eg.mg.playerBySmallID(victor);
    if (!p.isPlayer() || !to.isPlayer()) continue;
    capitulateCountry(eg.mg, eg.ww, p, tick, to);
  }
}

/**
 * ww88: the assignment as settlements (one per winner and loser, cost 0),
 * read at the treaty: what a demand bought stays bought, a participant that
 * stopped playing gets nothing, a puppet gets back what its master has no
 * core or claim on, and a loser left too small now is gone now.
 */
function assignmentRows(
  eg: WwEndgame,
  c: Conference,
  bought: readonly Settled[],
): Settled[] {
  if (c.assign === undefined) return [];
  const legal = eg.ww.politics.legalOwner;
  const spoken = new Set<number>();
  const safe = livingAsked(eg, c);
  const puppetBy = new Map<number, number>();
  for (const s of bought) {
    if (REGION_KINDS.has(s.kind)) for (const r of s.regions) spoken.add(r);
    if (s.kind === KIND.release || s.kind === KIND.liberate) {
      safe.add(s.beneficiary);
    }
    if (s.kind === KIND.puppet) {
      safe.add(s.target);
      puppetBy.set(s.target, s.by);
    }
  }
  for (const r of c.stake) if (eg.isZone(r)) spoken.add(r);
  const assign = new Map<number, number>();
  const assignedOf = new Set(c.assign.map(([r]) => r));
  // A puppet with nothing of its own lives on in what its master gives back.
  const bare = (L: number) =>
    c.stake.every(
      (r) => legal[r] !== L || assignedOf.has(r) || spoken.has(r),
    );
  for (const [r, p] of c.assign) {
    if (spoken.has(r) || !eg.isActor(p)) continue;
    const L = legal[r] ?? 0;
    const givesBack =
      puppetBy.get(L) === p &&
      bare(L) &&
      !eg.hasCore(p, r) &&
      !c.claims.some(([x, y]) => x === p && y === r);
    if (!givesBack) assign.set(r, p);
  }
  settleLosers(assignInput(eg, c), assign, { safe, bought: spoken });
  const rows = new Map<string, Settled>();
  for (const [r, p] of [...assign].sort((a, b) => a[0] - b[0])) {
    if (spoken.has(r)) continue;
    const L = legal[r] ?? 0;
    const key = `${p}:${L}`;
    const row = rows.get(key);
    if (row !== undefined) {
      row.regions.push(r);
      continue;
    }
    rows.set(key, {
      kind: KIND.take,
      by: p,
      regions: [r],
      target: L,
      beneficiary: p,
      k: 0,
      pct: 0,
      round: 0,
      cost: 0,
    });
  }
  return [...rows.values()];
}

/** Spec §6.4 disarm: 1,095 days of arms limitation; divisions past 12 disband, the weakest first. */
function disarm(eg: WwEndgame, L: number, day: number): void {
  const pol = eg.ww.politics;
  const land = eg.ww.land;
  eg.disarm = eg.disarm.filter(([x]) => x !== L);
  eg.disarm.push([L, day + WW_DISARM_DAYS]);
  if (pol.content.spiritIdx.has(ARMS_LIMIT_SPIRIT)) {
    addSpirit(pol, L, ARMS_LIMIT_SPIRIT, WW_DISARM_DAYS, day);
  }
  const rows = [...land.rowsOf(L)];
  if (rows.length <= WW_DISARM_MAX_DIVISIONS) return;
  const t = land.divisions;
  rows.sort(
    (a, b) => land.strengthOf(a) - land.strengthOf(b) || t.id[a] - t.id[b],
  );
  for (const r of rows.slice(0, rows.length - WW_DISARM_MAX_DIVISIONS)) {
    land.killDivision(r, false);
  }
}

/**
 * Spec §6.7-11: one line per participant and kind (and receiver or loser):
 * ww1936.peace.line.<kind> with lane T's params — `who`, `loser`, `to`,
 * `tag` as country tags (each also as `…Tag`), `n`, `pct` — and, for the
 * key's {what}, `group` (the regions are exactly one content group's stake
 * part) or `region` (one region), plus `regions` (comma-joined ids).
 */
function treatyLines(
  eg: WwEndgame,
  c: Conference,
  settled: readonly Settled[],
): { key: string; params: Record<string, string | number> }[] {
  const groups = new Map<
    string,
    {
      by: number;
      kind: number;
      other: number;
      regions: number[];
      k: number;
      pct: number;
      loser: number;
    }
  >();
  for (const s of settled) {
    const kind = DEMAND_KINDS[s.kind];
    const other =
      kind === "take_for" || kind === "release" || kind === "liberate"
        ? s.beneficiary
        : REGION_KINDS.has(s.kind) || kind === "demilitarise"
          ? 0
          : s.target;
    // One line per loser too (a take of two losers' regions is two lines).
    const key = `${s.by}:${s.kind}:${other}:${s.target}`;
    const g = groups.get(key);
    if (g === undefined) {
      groups.set(key, {
        by: s.by,
        kind: s.kind,
        other,
        regions: [...s.regions],
        k: s.k,
        pct: s.pct,
        loser: s.target,
      });
    } else {
      g.regions.push(...s.regions);
      g.k += s.k;
      g.pct = Math.max(g.pct, s.pct);
    }
  }
  const rows = [...groups.values()].sort(
    (a, b) =>
      a.by - b.by || a.kind - b.kind || a.other - b.other || a.loser - b.loser,
  );
  return rows.map((g) => {
    const kind = DEMAND_KINDS[g.kind];
    const params: Record<string, string | number> = {
      ...countryParams(eg, { who: g.by }),
    };
    const loser = c.losers.includes(g.loser) ? g.loser : (c.losers[0] ?? 0);
    switch (kind) {
      case "take_for":
        Object.assign(params, countryParams(eg, { to: g.other }));
        break;
      case "release":
      case "liberate":
        Object.assign(params, countryParams(eg, { tag: g.other }));
        break;
      default:
        if (loser > 0) Object.assign(params, countryParams(eg, { loser }));
    }
    if (kind === "take_navy") {
      params.pct = g.pct;
      params.n = g.regions.length;
    } else if (kind === "reparations") {
      params.n = g.k;
    } else if (g.regions.length > 0) {
      const regs = [...g.regions].sort(asc);
      params.n = regs.length;
      params.regions = regs.join(",");
      // The key's {what}: the screens name the group or the region.
      if (regs.length === 1) params.region = regs[0];
      else {
        const named = groupNamed(eg, c, regs);
        if (named !== null) params.group = named;
      }
    }
    return { key: `ww1936.peace.line.${kind}`, params };
  });
}

/** The content group whose stake part is exactly `regions` (two or more), or null. */
function groupNamed(
  eg: WwEndgame,
  c: Conference,
  regions: readonly number[],
): string | null {
  const want = new Set(regions);
  const stake = new Set(c.stake);
  for (const g of eg.ww.politics.content.groups) {
    const part = new Set(g.regions.filter((r) => stake.has(r)));
    if (part.size !== want.size) continue;
    if ([...part].every((r) => want.has(r))) return g.id;
  }
  return null;
}

// ---- The card (spec §21.4, pre-flight §A W × U1) ----

/** The conference card's data: prices and reservations as the engine computes them. */
export function conferenceView(eg: WwEndgame, conf: number): WwConferenceView {
  const c = conferenceById(eg, conf);
  const empty: WwConferenceView = {
    id: conf,
    losers: [],
    status: "done",
    round: 0,
    roundEndTick: 0,
    participants: [],
    stake: [],
    mine: [],
    lastRound: [],
    releasable: [],
    claims: [],
    conquer: [],
    topple: [],
    reserved: [],
    settled: [],
    mainVictor: 0,
  };
  if (c === null) return empty;
  const order = turnOrder(
    c.parts.map((p) => p.wsMilli),
    c.parts.map((p) => p.id),
    c.round,
  );
  const taken = takenMap(eg, c);
  const ctx = peaceCtx(eg, c);
  const ws = c.parts.map((p) => p.wsMilli);
  const view = (id: number, ds: readonly StoredDemand[]): WwDemandView[] =>
    ds.map((d) => ({
      kind: DEMAND_KINDS[d.kind],
      slot: d.slot,
      regions: [...d.regions],
      target: d.target,
      beneficiary: d.beneficiary,
      k: d.k,
      pct: d.pct,
      cost: priceOf(eg, c, id, d, taken, ctx),
    }));
  const reserved =
    c.status === 1
      ? reservations(eg, c, order, taken)
      : new Map<number, number>();
  return {
    id: c.id,
    losers: [...c.losers],
    status: c.status === 2 ? "done" : c.status === 1 ? "open" : "queued",
    round: c.round,
    roundEndTick: c.roundEndTick,
    participants: c.parts.map((p) => ({
      id: p.id,
      pts: p.pts,
      sharePm: sharePm(p.wsMilli, ws),
      order: order.indexOf(p.id),
      human: p.human,
      final: c.subs.some((s) => s.id === p.id),
    })),
    stake: c.stake.map((r, i) => ({
      region: r,
      base: c.base[i],
      settledBy: taken.get(r) ?? 0,
      zone:
        eg.isZone(r) ||
        c.settled.some(
          (s) => s.kind === KIND.occupation_zone && s.regions.includes(r),
        ),
    })),
    mine: c.parts
      .filter((p) => p.human)
      .map((p) => {
        const sub = c.subs.find((s) => s.id === p.id);
        return {
          id: p.id,
          submitted: sub === undefined ? null : view(p.id, sub.demands),
          ai: view(p.id, c.ai.find((a) => a.id === p.id)?.demands ?? []),
        };
      }),
    lastRound: c.lastRound.map((x) => ({
      by: x.by,
      kind: DEMAND_KINDS[x.kind],
      regions: [...x.regions],
      target: x.target,
      ok: x.ok,
    })),
    releasable: releasableTags(eg, c.stake),
    claims: c.claims.map(([p, r]): [number, number] => [p, r]),
    conquer: c.conquer.map(([p, l]): [number, number] => [p, l]),
    topple: c.topple.map(([p, l]): [number, number] => [p, l]),
    reserved: [...reserved]
      .sort((a, b) => a[0] - b[0])
      .map(([r, p]): [number, number] => [r, p]),
    // In the order they settled; a participant that stopped playing's left out.
    settled: ctx.table.settled.map((x) => {
      const s = x as Settled;
      return {
        round: s.round,
        by: s.by,
        kind: DEMAND_KINDS[s.kind],
        target: s.target,
        beneficiary: s.beneficiary,
        regions: [...s.regions],
        k: s.k,
        pct: s.pct,
        cost: s.cost,
      };
    }),
    mainVictor: ctx.mainVictor,
    assign: (c.assign ?? []).map(([r, p]): [number, number] => [r, p]),
    comp: (c.comp ?? []).map(([p, n]): [number, number] => [p, n]),
    handed: (c.handed ?? []).map(([r]) => r),
    gone: goneNow(eg, c),
    asked: c.asked === true,
  };
}

/** The losers the treaty would leave with nothing as things stand now. */
function goneNow(eg: WwEndgame, c: Conference): number[] {
  const live = c.settled.filter((s) => eg.isActor(s.by));
  const rows = assignmentRows(eg, c, live);
  const lost = new Set<number>();
  for (const s of [...live, ...rows]) {
    if (REGION_KINDS.has(s.kind)) for (const r of s.regions) lost.add(r);
  }
  const legal = eg.ww.politics.legalOwner;
  const asked = livingAsked(eg, c);
  const freed = new Set(
    live
      .filter((s) => s.kind === KIND.release || s.kind === KIND.liberate)
      .map((s) => s.beneficiary),
  );
  return c.losers.filter(
    (L) =>
      !asked.has(L) &&
      !freed.has(L) &&
      c.stake.every((r) => legal[r] !== L || lost.has(r)),
  );
}

/** Spec §6.4: a loser is a major (the AI's values; COUNTRIES). */
export function isMajor(eg: WwEndgame, id: number): boolean {
  return COUNTRIES[eg.ww.tagOf(id)].major;
}
