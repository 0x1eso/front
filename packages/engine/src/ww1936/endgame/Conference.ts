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
  WwConferenceView,
  WwDemandView,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  AGG_PCT,
  aggregateCost,
  demandCost,
  dismantleCost,
  maxReparations,
  participantPoints,
  regionBaseValue,
  reparationsCost,
  sharePm,
  takeNavyCost,
  turnOrder,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { SHIP_BASE } from "@openfront/engine-lib/ww1936/ShipStats";
import { effectiveBuildings } from "../economy/Buildings";
import { transferRegionPeaceful } from "../land/PoliticsBridge";
import { dissolveFaction, leaveFaction } from "../politics/Factions";
import { setGovernment } from "../politics/Ideology";
import { addSpirit } from "../politics/Spirits";
import { activateCountry, landRegained, releasableTags } from "./Activate";
import { endExile, offerTakeover } from "./Exile";
import { aiDemands } from "./PeaceAi";
import { endSubject, makeSubject } from "./Subjects";
import { loserIds } from "./Wars";
import type { Conference, Settled, StoredDemand, WwEndgame } from "./WwEndgame";

/** DEMAND_KINDS index of each kind (StoredDemand.kind, Settled.kind). */
export const KIND = Object.fromEntries(
  DEMAND_KINDS.map((k, i) => [k, i]),
) as Record<DemandKind, number>;
/** Kinds that hand regions out (take, take_group, take_for, annex_rest, occupation_zone, release, liberate). */
export const REGION_KINDS: ReadonlySet<number> = new Set(
  (
    [
      "take",
      "take_group",
      "take_for",
      "annex_rest",
      "occupation_zone",
      "release",
      "liberate",
    ] as const
  ).map((k) => KIND[k]),
);
/** The arms limitation spirit a disarm treaty puts on (content, spec §6.4). */
export const ARMS_LIMIT_SPIRIT = "gen_arms_limit";

const asc = (a: number, b: number) => a - b;

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

/**
 * Message params of countries: each as its tag under `name` and under
 * `nameTag` (the screens add the translated name of a `…Tag` param under
 * the name without "Tag", WorldWarModel.translateCountryParams).
 */
export function countryParams(
  eg: WwEndgame,
  named: Record<string, number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, id] of Object.entries(named)) {
    const tag = eg.ww.tagOf(id);
    out[k] = tag;
    out[`${k}Tag`] = tag;
  }
  return out;
}

/** A list of countries: comma-joined tags; one country also as `nameTag`. */
export function countryListParams(
  eg: WwEndgame,
  name: string,
  ids: readonly number[],
): Record<string, string> {
  if (ids.length === 1) return countryParams(eg, { [name]: ids[0] });
  return { [name]: ids.map((id) => eg.ww.tagOf(id)).join(",") };
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
): number {
  const i = c.stake.indexOf(region);
  const base = i >= 0 ? c.base[i] : regionBase(eg, region);
  const ctrl = eg.ww.land.controller[region] ?? 0;
  const legal = eg.ww.politics.legalOwner[region] ?? 0;
  return demandCost(base, {
    controls: ctrl === p,
    core: eg.hasCore(beneficiary, region),
    claim: c.claims.some(([x, r]) => x === p && r === region),
    conquerGoal: c.conquer.some(([x, l]) => x === p && l === legal),
    otherControls:
      ctrl !== p && ctrl !== beneficiary && c.parts.some((x) => x.id === ctrl),
  });
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

/**
 * Spec §6.4 occupation_zone: of `regions` (those `ok`), the ones `p`
 * controls or that border a region it controls, and — the zone is chosen
 * by group — those joined to them through the demand's own regions.
 */
export function zoneRegions(
  eg: WwEndgame,
  p: number,
  regions: readonly number[],
  ok: (r: number) => boolean,
): number[] {
  const sc = eg.ww.scenario;
  const ctrl = eg.ww.land.controller;
  const cand = new Set(regions.filter(ok));
  const got = new Set<number>();
  const q: number[] = [];
  for (const r of [...cand].sort(asc)) {
    if (ctrl[r] === p || sc.regionNeighbours(r).some((n) => ctrl[n] === p)) {
      got.add(r);
      q.push(r);
    }
  }
  for (let h = 0; h < q.length; h++) {
    for (const n of sc.regionNeighbours(q[h])) {
      if (!cand.has(n) || got.has(n)) continue;
      got.add(n);
      q.push(n);
    }
  }
  return [...got].sort(asc);
}

const settledOn = (c: Conference, L: number, ...kinds: DemandKind[]) =>
  c.settled.some(
    (s) => s.target === L && kinds.some((k) => s.kind === KIND[k]),
  );

/** What a demand would settle now: regions one by one, or all at one price; null: invalid. */
type Plan =
  | { each: [number, number][] }
  | { all: number[]; cost: number; receiver: number };

/** Spec §6.4 per kind; `free` = still to hand out to this participant. */
function planDemand(
  eg: WwEndgame,
  c: Conference,
  p: number,
  d: StoredDemand,
  free: (r: number) => boolean,
): Plan | null {
  const pol = eg.ww.politics;
  const legal = pol.legalOwner;
  const L = d.target;
  const rest = () => c.stake.filter((r) => legal[r] === L && free(r));
  const costs = (regs: readonly number[], b = p) =>
    regs.map((r) => regionCost(eg, c, r, p, b));
  const isPart = (id: number) => c.parts.some((x) => x.id === id);
  switch (DEMAND_KINDS[d.kind]) {
    case "take":
    case "take_group": {
      const each = d.regions
        .filter(free)
        .map((r): [number, number] => [r, regionCost(eg, c, r, p, p)]);
      return each.length === 0 ? null : { each };
    }
    case "take_for": {
      const b = d.beneficiary;
      if (b === p || !isPart(b)) return null;
      const each = d.regions
        .filter((r) => free(r) && eg.hasCore(b, r))
        .map((r): [number, number] => [r, regionCost(eg, c, r, p, b)]);
      return each.length === 0 ? null : { each };
    }
    case "annex_rest": {
      if (!c.losers.includes(L) || settledOn(c, L, "puppet")) return null;
      const regs = rest();
      if (regs.length === 0) return null;
      const cost = aggregateCost(costs(regs), AGG_PCT.annex_rest);
      return { all: regs, cost, receiver: p };
    }
    case "occupation_zone": {
      const regs = zoneRegions(eg, p, d.regions, free);
      if (regs.length === 0) return null;
      const cost = aggregateCost(costs(regs), AGG_PCT.occupation_zone);
      return { all: regs, cost, receiver: p };
    }
    case "puppet": {
      if (!c.losers.includes(L) || settledOn(c, L, "annex_rest", "puppet")) {
        return null;
      }
      const regs = rest();
      if (regs.length === 0) return null;
      return {
        all: [],
        cost: aggregateCost(costs(regs), AGG_PCT.puppet),
        receiver: p,
      };
    }
    case "release":
    case "liberate": {
      const T = d.beneficiary;
      if (T <= 0) return null;
      const regs = c.stake.filter((r) => free(r) && eg.hasCore(T, r));
      if (regs.length === 0) return null;
      const pct =
        DEMAND_KINDS[d.kind] === "release" ? AGG_PCT.release : AGG_PCT.liberate;
      return { all: regs, cost: aggregateCost(costs(regs), pct), receiver: T };
    }
    case "change_government": {
      if (
        !c.losers.includes(L) ||
        settledOn(c, L, "annex_rest", "puppet", "change_government")
      ) {
        return null;
      }
      const regs = rest();
      if (regs.length === 0) return null;
      const topple = c.topple.some(([x, l]) => x === p && l === L);
      const pct = topple
        ? AGG_PCT.change_government_topple
        : AGG_PCT.change_government;
      return { all: [], cost: aggregateCost(costs(regs), pct), receiver: p };
    }
    case "dismantle": {
      if (!c.losers.includes(L) || settledOn(c, L, "dismantle")) return null;
      const idx = ledFaction(eg, L);
      if (idx < 0) return null;
      const n = pol.faction(idx)?.members.length ?? 0;
      return { all: [], cost: dismantleCost(n), receiver: p };
    }
    case "demilitarise": {
      const each = d.regions
        .filter(
          (r) =>
            c.stake.includes(r) &&
            free(r) &&
            !c.settled.some(
              (s) => s.kind === KIND.demilitarise && s.regions.includes(r),
            ) &&
            eg.ww.scenario.regionNeighbours(r).some((n) => legal[n] === p),
        )
        .map((r): [number, number] => [
          r,
          Math.max(
            1,
            Math.floor(
              (regionCost(eg, c, r, p, p) * AGG_PCT.demilitarise) / 100,
            ),
          ),
        ]);
      return each.length === 0 ? null : { each };
    }
    case "reparations": {
      if (!c.losers.includes(L) || d.k < 1) return null;
      const regs = rest();
      if (regs.length === 0) return null;
      let civ = 0;
      for (const r of regs) civ += effectiveBuildings(eg.ww.economy, r, "civ");
      let owed = 0;
      for (const s of c.settled) {
        if (s.kind === KIND.reparations && s.target === L) owed += s.k;
      }
      if (owed + d.k > maxReparations(civ)) return null;
      return { all: [], cost: reparationsCost(d.k), receiver: p };
    }
    case "disarm": {
      if (!c.losers.includes(L) || settledOn(c, L, "disarm")) return null;
      const regs = rest();
      if (regs.length === 0) return null;
      return {
        all: [],
        cost: aggregateCost(costs(regs), AGG_PCT.disarm),
        receiver: p,
      };
    }
    case "take_navy": {
      if (!c.losers.includes(L)) return null;
      const ships = pickShips(eg, c, L, d.pct);
      if (ships.length === 0) return null;
      let w = 0;
      for (const s of ships) w += s.w;
      return {
        all: ships.map((s) => s.id),
        cost: takeNavyCost(w),
        receiver: p,
      };
    }
    default:
      return null;
  }
}

/** Spec §6.4 take_navy: the heaviest of L's ships not yet handed over, up to `pct`% of their weight. */
export function pickShips(
  eg: WwEndgame,
  c: Conference,
  L: number,
  pct: number,
): { id: number; w: number }[] {
  const gone = new Set<number>();
  for (const s of c.settled) {
    if (s.kind === KIND.take_navy) for (const id of s.regions) gone.add(id);
  }
  const ships = shipsOf(eg, L).filter((s) => !gone.has(s.id));
  let total = 0;
  for (const s of ships) total += s.w;
  const want = Math.floor((total * pct) / 100);
  const out: { id: number; w: number }[] = [];
  let sum = 0;
  for (const s of ships) {
    if (sum + s.w > want) continue;
    out.push(s);
    sum += s.w;
  }
  return out;
}

/** The regions settled so far (any participant), region → receiver. */
export function takenMap(c: Conference): Map<number, number> {
  const taken = new Map<number, number>();
  for (const s of c.settled) {
    if (!REGION_KINDS.has(s.kind)) continue;
    for (const r of s.regions) taken.set(r, s.beneficiary || s.by);
  }
  return taken;
}

/** A demand's price now, for the card and the AI (no reservations, no points). */
export function priceOf(
  eg: WwEndgame,
  c: Conference,
  p: number,
  d: StoredDemand,
  taken: ReadonlyMap<number, number> = takenMap(c),
): number {
  const stake = new Set(c.stake);
  const plan = planDemand(eg, c, p, d, (r) => stake.has(r) && !taken.has(r));
  if (plan === null) return 0;
  if ("each" in plan) {
    let s = 0;
    for (const [, cost] of plan.each) s += cost;
    return s;
  }
  return plan.cost;
}

// ---- Opening (spec §6.1–§6.2, plan decisions 12, 14, 34) ----

/** Spec §6.1: a conference for the ended wars `warIds`; its id (0: none). */
export function openConference(
  eg: WwEndgame,
  warIds: readonly number[],
  tick: number,
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
  const loserSet = new Set<number>();
  for (const w of wars) for (const id of loserIds(w)) loserSet.add(id);
  const losers = [...loserSet].sort(asc);
  const ws = new Map<number, number>();
  for (const w of wars) {
    for (const m of w.sides[w.ended!.winner as 0 | 1].members) {
      if (m.state !== "active" && m.state !== "exiled") continue;
      if (loserSet.has(m.id)) continue;
      ws.set(m.id, (ws.get(m.id) ?? 0) + m.wsMilli);
    }
  }
  const ids = [...ws.keys()].sort(asc);
  if (ids.length === 0 || losers.length === 0) return 0;
  const stake = ww.scenario.landRegions
    .map((r) => r.id)
    .filter((r) => loserSet.has(pol.legalOwner[r] ?? 0))
    .sort(asc);
  const base = stake.map((r) => regionBase(eg, r));
  let total = 0;
  for (const b of base) total += b;
  const pts = participantPoints(
    total,
    ids.map((id) => ws.get(id)!),
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
    roundEndTick: tick + WW_PEACE_ROUND_TICKS,
    openTick: tick,
    subs: [],
    ai: [],
    settled: [],
    lastRound: [],
  };
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

/** Round start (spec §6.5-1): who is human now, and every participant's AI demands. */
function refreshAi(eg: WwEndgame, c: Conference): void {
  for (const p of c.parts) p.human = eg.isHumanControlled(p.id);
  c.ai = c.parts.map((p) => ({ id: p.id, demands: aiDemands(eg, c.id, p.id) }));
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
  let list: StoredDemand[] = [];
  if (demands !== null) {
    if (demands.length > WW_PEACE_DEMANDS_PER_ROUND) return "too_many_demands";
    for (let i = 0; i < demands.length; i++) {
      const sd = expandDemand(eg, c, smallID, demands[i], i);
      if (sd === null) return "bad_demand";
      list.push(sd);
    }
  } else list = [];
  c.subs = c.subs.filter((s) => s.id !== smallID);
  c.subs.push({ id: smallID, demands: list, passed: demands === null });
  c.subs.sort((a, b) => a.id - b.id);
  const humans = c.parts.filter((p) => p.human);
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
  const stake = new Set(c.stake);
  const group = (g: string) => [
    ...new Set(
      (eg.ww.politics.content.groupIdx.get(g)?.regions ?? []).filter((r) =>
        stake.has(r),
      ),
    ),
  ];
  const loser = (t: number) => c.losers.includes(t);
  switch (d.kind) {
    case "take":
      return stake.has(d.region) ? stored("take", slot, [d.region]) : null;
    case "take_group": {
      const regs = group(d.group);
      return regs.length > 0 ? stored("take_group", slot, regs) : null;
    }
    case "take_for": {
      const b = d.beneficiary;
      if (b === p || !c.parts.some((x) => x.id === b)) return null;
      if (!stake.has(d.region) || !eg.hasCore(b, d.region)) return null;
      return stored("take_for", slot, [d.region], { beneficiary: b });
    }
    case "occupation_zone": {
      if ((d.group === undefined) === (d.region === undefined)) return null;
      const regs =
        d.group !== undefined
          ? group(d.group)
          : stake.has(d.region!)
            ? [d.region!]
            : [];
      return regs.length > 0 ? stored("occupation_zone", slot, regs) : null;
    }
    case "annex_rest":
    case "puppet":
    case "change_government":
    case "dismantle":
    case "disarm":
      return loser(d.target)
        ? stored(d.kind, slot, [], { target: d.target })
        : null;
    case "reparations":
      return loser(d.target) && d.k >= 1
        ? stored("reparations", slot, [], { target: d.target, k: d.k })
        : null;
    case "take_navy":
      return loser(d.target) && d.pct >= 10 && d.pct <= 50
        ? stored("take_navy", slot, [], { target: d.target, pct: d.pct })
        : null;
    case "release":
    case "liberate": {
      if (!releasableTags(eg, c.stake).includes(d.tag)) return null;
      const t = eg.ww.scenario.smallIdOf(d.tag);
      return t === 0
        ? null
        : stored(d.kind, slot, [], { target: t, beneficiary: t });
    }
    case "demilitarise":
      return stake.has(d.region)
        ? stored("demilitarise", slot, [d.region])
        : null;
  }
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
      next.roundEndTick = tick + WW_PEACE_ROUND_TICKS;
      next.subs = [];
      refreshAi(eg, next);
      eg.dirtyConf = true;
    }
  }
}

function closeRound(eg: WwEndgame, c: Conference, tick: number): void {
  const settled = resolveRound(eg, c);
  const taken = takenMap(c);
  const allTaken = c.stake.every((r) => taken.has(r));
  if (c.round >= WW_PEACE_MAX_ROUNDS || settled === 0 || allTaken) {
    finishConference(eg, c, tick);
    return;
  }
  c.round++;
  c.roundEndTick = tick + WW_PEACE_ROUND_TICKS;
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
    for (const d of demandsOf(c, id)) {
      if (!REGION_KINDS.has(d.kind)) continue;
      for (const r of d.regions) {
        if (!taken.has(r) && !reserved.has(r) && ctrl[r] === id) {
          reserved.set(r, id);
        }
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
  const taken = takenMap(c);
  const reserved = reservations(eg, c, order, taken);
  const stake = new Set(c.stake);
  c.lastRound = [];
  let n = 0;
  for (let slot = 0; slot < WW_PEACE_DEMANDS_PER_ROUND; slot++) {
    for (const id of order) {
      const part = c.parts.find((p) => p.id === id)!;
      for (const d of demandsOf(c, id)) {
        if (d.slot !== slot) continue;
        const free = (r: number) =>
          stake.has(r) && !taken.has(r) && (reserved.get(r) ?? id) === id;
        const res = tryDemand(eg, c, part, d, free, taken);
        c.lastRound.push({
          by: id,
          kind: d.kind,
          regions: res.regions,
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
): { ok: boolean; regions: number[] } {
  const p = part.id;
  const plan = planDemand(eg, c, p, d, free);
  if (plan === null) return { ok: false, regions: [] };
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
  const regions = kind === "take_navy" ? plan.all : [...plan.all].sort(asc);
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
  const of = (k: DemandKind) => c.settled.filter((s) => s.kind === KIND[k]);
  const actor = (id: number) => eg.isActor(id);
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
    const ruling = IDEOLOGIES[pol.country(p)?.ruling ?? 3];
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
  // 6. What nobody took goes back to its loser, which lives again.
  const revived: number[] = [];
  for (const L of c.losers) {
    const left = c.stake.filter(
      (r) => pol.legalOwner[r] === L && !eg.isZone(r),
    );
    if (left.length === 0) {
      eg.setCountryState(L, CS_GONE);
      continue;
    }
    for (const r of left) transferRegionPeaceful(land, r, L, tick);
    landRegained(eg, L, tick);
    revived.push(L);
    const puppet = c.settled.find(
      (s) => s.kind === KIND.puppet && s.target === L,
    );
    if (puppet !== undefined) {
      makeSubject(eg, L, puppet.by, "puppet", false, tick);
    } else if (pol.factionIdx(L) >= 0) {
      // Pre-flight §0-9: a peace takes the loser out of its alliance.
      leaveFaction(pol, L, tick);
    }
    const gov = c.settled.find(
      (s) => s.kind === KIND.change_government && s.target === L,
    );
    if (gov !== undefined) {
      setGovernment(pol, L, pol.country(gov.by)?.ruling ?? 3, tick);
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
  // 9. Exiles end (back home when the treaty left land); a gone human takes over.
  for (const L of c.losers) {
    const back = revived.includes(L);
    if (eg.isExile(L)) endExile(eg, L, tick, back ? "returned" : "collapsed");
    const client = eg.humanClientOf(L);
    if (client !== null && !back && !eg.isActor(L)) {
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
  const lines = treatyLines(eg, c);
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
 * ww1936.peace.line.<kind> with its countries as tags (…Tag params), the
 * regions as comma-joined ids (`regions`, the screens name them) and
 * their count `n`.
 */
function treatyLines(
  eg: WwEndgame,
  c: Conference,
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
  for (const s of c.settled) {
    const kind = DEMAND_KINDS[s.kind];
    const other =
      kind === "take_for" || kind === "release" || kind === "liberate"
        ? s.beneficiary
        : REGION_KINDS.has(s.kind) || kind === "demilitarise"
          ? 0
          : s.target;
    const key = `${s.by}:${s.kind}:${other}`;
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
    (a, b) => a.by - b.by || a.kind - b.kind || a.other - b.other,
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
    }
    return { key: `ww1936.peace.line.${kind}`, params };
  });
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
  };
  if (c === null) return empty;
  const order = turnOrder(
    c.parts.map((p) => p.wsMilli),
    c.parts.map((p) => p.id),
    c.round,
  );
  const taken = takenMap(c);
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
      cost: priceOf(eg, c, id, d, taken),
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
  };
}

/** Spec §6.4: a loser is a major (the AI's values; COUNTRIES). */
export function isMajor(eg: WwEndgame, id: number): boolean {
  return COUNTRIES[eg.ww.tagOf(id)].major;
}
