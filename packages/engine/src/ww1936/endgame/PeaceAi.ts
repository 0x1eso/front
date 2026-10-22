// P5 lane W (plan Task 2): the conference AI (spec §6.9, §17.1; plan
// decision 30). The fixed defaults first, always: Korea's 38th-parallel
// occupation zones (owner ruling, pre-flight §0-8: control only; a zone
// nobody intended can hold goes to a participant that can) and Taiwan to
// the participant claiming it (CHN), or the main victor's zone when none
// claims it. Then the history table's demands when the historical AI is on
// and this participant keeps its row (≈75% per seed and conference —
// history is a guide); then the general AI: value per point, a seeded ±10%
// jitter, within the points and five slots, takes bundled into one slot.
// A human's card shows the same (its own country's values). Korea's and
// Taiwan's regions follow PeaceRules.peaceRegionBlock everywhere.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DEMAND_KINDS,
  DemandKind,
  PeaceDefaultDemand,
  WW_PEACE_DEMANDS_PER_ROUND,
  WW_PEACE_HISTORY_KEEP_PCT,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  AGG_PCT,
  aggregateCost,
  reparationsCost,
  takeNavyCost,
  turnOrder,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  peacePickShips,
  peaceRegionBlock,
  peaceRegionCost,
  peaceReparationsRoom,
  peaceSettledOn,
  peaceZoneRegions,
  TAKE_NAVY_PCT_MAX,
  TAKE_NAVY_PCT_MIN,
  ZONE_ONLY_GROUPS,
} from "@openfront/engine-lib/ww1936/PeaceRules";
import {
  idHash,
  P_PEACE,
  P_PEACE_JITTER,
  wwRoll,
} from "@openfront/engine-lib/ww1936/Roll";
import { aiPersonality } from "../economy/AiEconomy";
import { effectiveBuildings } from "../economy/Buildings";
import { evalCondition } from "../politics/Conditions";
import { makeCtx, resolveSelector } from "../politics/Dispatch";
import { releasableTags } from "./Activate";
import {
  conferenceById,
  isMajor,
  KIND,
  ledFaction,
  PeaceCtx,
  peaceCtx,
  priceOf,
  REGION_KINDS,
  regionCost,
  stored,
  takenMap,
} from "./Conference";
import type { Conference, StoredDemand, WwEndgame } from "./WwEndgame";

/** The region groups of Korea (content, peace table only — decision 32): occupation zones only. */
export const KOREA_GROUPS: readonly string[] = ZONE_ONLY_GROUPS;

/**
 * Pre-flight §0-8: whether `participant` keeps the history row of
 * `loserTag` in conference `confId` (WW_PEACE_HISTORY_KEEP_PCT of seeds).
 */
export function keepsHistoryRow(
  seed: number,
  loserTag: CountryTag,
  participant: number,
  confId: number,
): boolean {
  const roll = wwRoll(seed, P_PEACE, idHash(loserTag), participant, confId);
  return (roll >>> 8) % 100 < WW_PEACE_HISTORY_KEEP_PCT;
}

/**
 * P5 final lane (perf: 30 participants × 150 stake regions took 50–60 ms in
 * one tick): what every participant's AI reads alike in one pass over a
 * conference — the demand rules' context, the fixed Korea and Taiwan
 * defaults, the releasable tags, each stake region's worth and each
 * loser's fleet weight a take_navy would pick. refreshAi builds it once;
 * the demands are the same as without it.
 */
export interface PeaceAiShared {
  conf: number;
  ctx: PeaceCtx;
  fixed: FixedDemand[];
  releasable: CountryTag[];
  worth: Map<number, number>;
  navyW: Map<number, number>;
  losers: Map<number, { lVp: number; zoneOnly: boolean }>;
  reparations: Map<number, number>;
  legalVp: Map<number, number> | null;
}

export function peaceAiShared(eg: WwEndgame, c: Conference): PeaceAiShared {
  const base = peaceCtx(eg, c);
  // A loser's ship list once per pass (each participant prices take_navy).
  const ships = new Map<number, ReturnType<PeaceCtx["facts"]["ships"]>>();
  const ctx: PeaceCtx = {
    ...base,
    facts: {
      ...base.facts,
      ships: (L) => {
        let s = ships.get(L);
        if (s === undefined) {
          s = base.facts.ships(L);
          ships.set(L, s);
        }
        return s;
      },
    },
  };
  return {
    conf: c.id,
    ctx,
    fixed: fixedPlan(eg, c, takenMap(eg, c), ctx),
    releasable: releasableTags(eg, c.stake),
    worth: new Map(),
    navyW: new Map(),
    losers: new Map(),
    reparations: new Map(),
    legalVp: null,
  };
}

/** The AI's demands of `smallID` this round of conference `conf`. */
export function aiDemands(
  eg: WwEndgame,
  conf: number,
  smallID: number,
  shared?: PeaceAiShared,
): StoredDemand[] {
  const c = conferenceById(eg, conf);
  const part = c?.parts.find((p) => p.id === smallID);
  if (c === null || part === undefined || part.pts <= 0 || c.status === 2) {
    return [];
  }
  const sh =
    shared !== undefined && shared.conf === c.id
      ? shared
      : peaceAiShared(eg, c);
  const stake = new Set(c.stake);
  const used = takenMap(eg, c);
  const free = (r: number) => stake.has(r) && !used.has(r);
  const ctx = sh.ctx;
  const out: StoredDemand[] = [];
  let spent = 0;
  const take = (sd: StoredDemand, cost: number): void => {
    out.push(sd);
    spent += cost;
    if (REGION_KINDS.has(sd.kind) || sd.kind === KIND.demilitarise) {
      for (const r of sd.regions) used.set(r, smallID);
    }
  };
  // 1. Korea's zones and Taiwan (always), then the history table.
  for (const z of sh.fixed) {
    if (z.holder !== smallID || out.length >= WW_PEACE_DEMANDS_PER_ROUND) {
      continue;
    }
    const sd = stored(z.kind, out.length, z.regions.filter(free));
    const cost = priceOf(eg, c, smallID, sd, used, ctx, free);
    if (cost > 0) take(sd, cost);
  }
  for (const { L, dd } of historyLines(eg, c, smallID)) {
    if (out.length >= WW_PEACE_DEMANDS_PER_ROUND) break;
    const sd = fromDefault(eg, c, L, dd, out.length, free, ctx, sh);
    if (sd === null) continue;
    const cost = priceOf(eg, c, smallID, sd, used, ctx, free);
    if (cost > 0) take(sd, cost);
  }
  // 2. The general AI in the slots left.
  generalAi(eg, c, part, out, used, spent, ctx, sh);
  return out;
}

/** A fixed default: who asks, how, for which regions. */
export interface FixedDemand {
  kind: "occupation_zone" | "take_group";
  holder: number;
  regions: number[];
}

/**
 * The defaults every AI (and every human card) carries whatever the roll
 * (owner ruling, pre-flight §0-8; spec §6.9, §16.4):
 * - Korea: the zone lines of the losers' history rows, each to its line's
 *   participant when it may and can hold the zone (controls a region of it
 *   or one next to it), else to the holder of an earlier Korean zone, else
 *   to the strongest participant that can.
 * - Taiwan: a take for the strongest participant claiming it; with none,
 *   the main victor's occupation zone (when it can hold it).
 */
export function fixedPlan(
  eg: WwEndgame,
  c: Conference,
  used: ReadonlyMap<number, number>,
  ctx: PeaceCtx = peaceCtx(eg, c),
): FixedDemand[] {
  const pol = eg.ww.politics;
  const stake = new Set(c.stake);
  const free = (r: number) => stake.has(r) && !used.has(r);
  const isPart = (x: number) => c.parts.some((p) => p.id === x);
  const strongest = turnOrder(
    c.parts.map((p) => p.wsMilli),
    c.parts.map((p) => p.id),
    1,
  ).filter((id) => eg.isActor(id));
  const may = (h: number, kind: DemandKind, r: number) =>
    peaceRegionBlock(ctx.sens, ctx.table, h, h, kind, r) === null;
  const out: FixedDemand[] = [];
  for (const L of c.losers) {
    const lctx = makeCtx(pol, L, 0, 0, eg.mg.ticks());
    for (const row of pol.content.peaceByLoser.get(pol.tagOf(L)) ?? []) {
      if (!evalCondition(lctx, row.when)) continue;
      for (const line of row.lines) {
        if (!evalCondition(lctx, line.when)) continue;
        for (const dd of line.demands) {
          if (
            dd.kind !== "occupation_zone" ||
            !KOREA_GROUPS.includes(dd.group)
          ) {
            continue;
          }
          const regions = groupRegions(eg, dd.group).filter(free);
          if (regions.length === 0) continue;
          const intended = resolveSelector(lctx, line.by);
          const can = (h: number) =>
            isPart(h) &&
            eg.isActor(h) &&
            regions.every((r) => may(h, "occupation_zone", r)) &&
            peaceZoneRegions(ctx.facts, h, regions, free).length > 0;
          const holder =
            [intended, ...out.map((o) => o.holder), ...strongest].find(can) ??
            0;
          if (holder !== 0) {
            out.push({ kind: "occupation_zone", holder, regions });
          }
        }
      }
    }
  }
  const taiwan = c.stake.filter((r) => ctx.sens.claimOnly.has(r) && free(r));
  if (taiwan.length > 0) {
    const claimant = strongest.find((p) =>
      taiwan.every((r) => may(p, "take_group", r)),
    );
    const victor = ctx.sens.mainVictor;
    if (claimant !== undefined) {
      out.push({ kind: "take_group", holder: claimant, regions: taiwan });
    } else if (
      eg.isActor(victor) &&
      taiwan.every((r) => may(victor, "occupation_zone", r)) &&
      peaceZoneRegions(ctx.facts, victor, taiwan, free).length > 0
    ) {
      out.push({ kind: "occupation_zone", holder: victor, regions: taiwan });
    }
  }
  return out;
}

/** Spec §6.9: the history table's demands of `p` (historical AI on, its row kept, conditions met), Korea's aside. */
function historyLines(
  eg: WwEndgame,
  c: Conference,
  p: number,
): { L: number; dd: PeaceDefaultDemand }[] {
  const pol = eg.ww.politics;
  if (!eg.mg.config().historicalAi()) return [];
  const out: { L: number; dd: PeaceDefaultDemand }[] = [];
  for (const L of c.losers) {
    const tag = pol.tagOf(L);
    if (!keepsHistoryRow(pol.seed, tag, p, c.id)) continue;
    const ctx = makeCtx(pol, L, 0, 0, eg.mg.ticks());
    for (const row of pol.content.peaceByLoser.get(tag) ?? []) {
      if (!evalCondition(ctx, row.when)) continue;
      for (const line of row.lines) {
        if (!evalCondition(ctx, line.when)) continue;
        if (resolveSelector(ctx, line.by) !== p) continue;
        for (const dd of line.demands) {
          if (
            dd.kind === "occupation_zone" &&
            KOREA_GROUPS.includes(dd.group)
          ) {
            continue;
          }
          out.push({ L, dd });
        }
      }
    }
  }
  return out;
}

function groupRegions(eg: WwEndgame, group: string): number[] {
  return [
    ...new Set(eg.ww.politics.content.groupIdx.get(group)?.regions ?? []),
  ];
}

/** A history demand as state (target omitted = the row's loser); null when nothing is left for it. */
function fromDefault(
  eg: WwEndgame,
  c: Conference,
  L: number,
  dd: PeaceDefaultDemand,
  slot: number,
  free: (r: number) => boolean,
  ctx: PeaceCtx,
  sh: PeaceAiShared,
): StoredDemand | null {
  const sc = eg.ww.scenario;
  const loserOf = (t: CountryTag | undefined) => {
    const id = t === undefined ? L : sc.smallIdOf(t);
    return c.losers.includes(id) ? id : 0;
  };
  switch (dd.kind) {
    case "take_group":
    case "occupation_zone":
    case "demilitarise": {
      const regs = groupRegions(eg, dd.group).filter(free);
      return regs.length === 0 ? null : stored(dd.kind, slot, regs);
    }
    case "take_for": {
      const b = sc.smallIdOf(dd.beneficiary);
      if (!c.parts.some((x) => x.id === b)) return null;
      const regs = groupRegions(eg, dd.group).filter(
        (r) => free(r) && eg.hasCore(b, r),
      );
      return regs.length === 0
        ? null
        : stored("take_for", slot, regs, { beneficiary: b });
    }
    case "annex_rest":
    case "puppet":
    case "change_government":
    case "dismantle":
    case "disarm": {
      const t = loserOf(dd.target);
      return t === 0 ? null : stored(dd.kind, slot, [], { target: t });
    }
    case "release":
    case "liberate": {
      if (!sh.releasable.includes(dd.tag)) return null;
      const t = sc.smallIdOf(dd.tag);
      return t === 0
        ? null
        : stored(dd.kind, slot, [], { target: t, beneficiary: t });
    }
    case "reparations": {
      const k = Math.min(
        dd.k,
        peaceReparationsRoom(ctx.facts, ctx.table, L, free),
      );
      return k < 1 ? null : stored("reparations", slot, [], { target: L, k });
    }
    case "take_navy":
      return stored("take_navy", slot, [], {
        target: L,
        pct: Math.max(TAKE_NAVY_PCT_MIN, Math.min(TAKE_NAVY_PCT_MAX, dd.pct)),
      });
  }
}

/** Country-wide demands that need the loser to keep land (spec §6.4). */
const LIVES: ReadonlySet<DemandKind> = new Set<DemandKind>([
  "puppet",
  "change_government",
  "reparations",
  "disarm",
]);

interface Cand {
  kind: DemandKind;
  v: number;
  cost: number;
  /** Ties and jitter: the region, or the target country. */
  key: number;
  sd: StoredDemand;
  /** v × 1000 / cost, floored (the sort's key, once). */
  score: number;
  /** KIND[kind] (the sort's tie-break, once). */
  k: number;
}

/**
 * Spec §17.1: every candidate's value `v` and price `c`, by v × 1000 / c
 * (ties: kind, then region / target), picked while the points last;
 * takes in one slot (in score order), take_for one per receiver, the
 * zones in one.
 */
function generalAi(
  eg: WwEndgame,
  c: Conference,
  part: Conference["parts"][number],
  out: StoredDemand[],
  used: Map<number, number>,
  spentBefore: number,
  ctx: PeaceCtx,
  sh: PeaceAiShared,
): void {
  const id = part.id;
  const pol = eg.ww.politics;
  const sc = eg.ww.scenario;
  const ctrl = eg.ww.land.controller;
  const legal = pol.legalOwner;
  const econ = eg.ww.economy;
  const ruling = pol.country(id)?.ruling ?? IDEO_NEU;
  const dem = ruling === IDEO_DEM;
  const aggressive =
    aiPersonality(pol.tagOf(id)) === "aggressor" ||
    ruling === IDEO_COM ||
    ruling === IDEO_FAS;
  const stake = new Set(c.stake);
  const free = (r: number) => stake.has(r) && !used.has(r);
  // Korea's and Taiwan's rules (the same for a human's card).
  const may = (kind: DemandKind, r: number, receiver = id) =>
    peaceRegionBlock(ctx.sens, ctx.table, id, receiver, kind, r) === null;
  const claim = (r: number) => c.claims.some(([x, y]) => x === id && y === r);
  const bordersMine = (r: number) =>
    sc.regionNeighbours(r).some((n) => legal[n] === id);
  const worth = (r: number): number => {
    const known = sh.worth.get(r);
    if (known !== undefined) return known;
    const reg = sc.region(r);
    if (reg === undefined) return 0;
    let res = 0;
    for (const x of reg.res) res += x;
    const f =
      effectiveBuildings(econ, r, "civ") +
      effectiveBuildings(econ, r, "mil") +
      effectiveBuildings(econ, r, "dock");
    const v = 10 * reg.vp + 8 * f + 2 * res;
    sh.worth.set(r, v);
    return v;
  };
  const takeValueOf = (r: number, coreOf: number): number => {
    let v =
      worth(r) +
      (eg.hasCore(coreOf, r) ? 40 : 0) +
      (claim(r) ? 30 : 0) +
      (ctrl[r] === id ? 20 : 0) +
      (bordersMine(r) ? 10 : -20);
    if (dem) {
      const other = eg.coreHolders(r).some((h) => h !== id && h !== coreOf);
      v = Math.floor((v * (other ? 20 : 50)) / 100);
    }
    return Math.max(0, v);
  };
  // Its own takes' values, once a region (the region and country loops
  // both read them; P5 final lane perf).
  const ownValue = new Map<number, number>();
  const takeValue = (r: number, coreOf = id): number => {
    if (coreOf !== id) return takeValueOf(r, coreOf);
    let v = ownValue.get(r);
    if (v === undefined) {
      v = takeValueOf(r, id);
      ownValue.set(r, v);
    }
    return v;
  };
  // Every participant's legal points, one pass for all (P5 final lane perf).
  if (sh.legalVp === null) {
    const vp = new Map<number, number>();
    for (const r of sc.landRegions) {
      const o = legal[r.id] ?? 0;
      if (o > 0) vp.set(o, (vp.get(o) ?? 0) + r.vp);
    }
    sh.legalVp = vp;
  }
  const myVp = sh.legalVp.get(id) ?? 0;
  const cands: Cand[] = [];
  const add = (
    kind: DemandKind,
    v: number,
    key: number,
    sd: StoredDemand,
    known?: number,
  ) => {
    if (v <= 0) return;
    const cost =
      known ??
      (sd.regions.length === 1 && (kind === "take" || kind === "take_for")
        ? regionCost(eg, c, sd.regions[0], id, sd.beneficiary || id, ctx.facts)
        : priceOf(eg, c, id, sd, used, ctx, free));
    if (cost <= 0) return;
    const jv = jitter(eg, c, id, kind, key, v);
    cands.push({
      kind,
      v: jv,
      cost,
      key,
      sd,
      score: Math.floor((jv * 1000) / cost),
      k: KIND[kind],
    });
  };
  // A one-region occupation zone's price, as priceOf → planPeaceDemand
  // reckons it once the region is free, allowed (may) and held or bordered
  // (P5 final lane perf: the same number without the plan's sets): 0 when a
  // puppet settlement locks the region.
  const zoneCost = (r: number): number => {
    const locked =
      peaceSettledOn(ctx.table, ctx.facts.legalOwner(r), "puppet") &&
      !ctx.sens.zoneOnly.has(r) &&
      !ctx.sens.claimOnly.has(r);
    if (locked) return 0;
    return aggregateCost(
      [peaceRegionCost(ctx.facts, ctx.table, r, id, id)],
      AGG_PCT.occupation_zone,
    );
  };
  // The participants of its own faction (take_for's receivers), in order.
  const friends = c.parts.filter(
    (b) => b.id !== id && pol.sameFaction(id, b.id),
  );
  // Regions (Korea: occupation zones only; Taiwan: its claimant — spec §6.9).
  for (const r of c.stake) {
    if (!free(r)) continue;
    if (may("take", r)) add("take", takeValue(r), r, stored("take", 0, [r]));
    for (const b of friends) {
      if (!eg.hasCore(b.id, r)) continue;
      if (!may("take_for", r, b.id)) continue;
      add(
        "take_for",
        Math.floor((takeValue(r, b.id) * 60) / 100),
        r,
        stored("take_for", 0, [r], { beneficiary: b.id }),
      );
    }
    if (
      may("occupation_zone", r) &&
      // peaceZoneRegions of one free region: held, or next to a held one.
      (ctrl[r] === id || sc.regionNeighbours(r).some((n) => ctrl[n] === id))
    ) {
      const pct = dem && isMajor(eg, legal[r]) ? 70 : 20;
      const v = Math.floor((takeValue(r) * pct) / 100);
      if (v > 0) {
        add(
          "occupation_zone",
          v,
          r,
          stored("occupation_zone", 0, [r]),
          zoneCost(r),
        );
      }
    }
    if (
      may("demilitarise", r) &&
      sc.regionNeighbours(r).some((n) => eg.hasCore(id, n)) &&
      bordersMine(r)
    ) {
      add("demilitarise", 20, r, stored("demilitarise", 0, [r]));
    }
  }
  // Countries. A loser's stake points and whether it holds a Korea region
  // legally are the same for every participant (P5 final lane perf).
  const loserFacts = (L: number): { lVp: number; zoneOnly: boolean } => {
    let f = sh.losers.get(L);
    if (f === undefined) {
      let lVp = 0;
      for (const r of c.stake) if (legal[r] === L) lVp += sc.region(r)?.vp ?? 0;
      const zoneOnly = c.stake.some(
        (r) => legal[r] === L && ctx.sens.zoneOnly.has(r),
      );
      f = { lVp, zoneOnly };
      sh.losers.set(L, f);
    }
    return f;
  };
  for (const L of c.losers) {
    const rest = c.stake.filter((r) => legal[r] === L && free(r));
    let restV = 0;
    for (const r of rest) restV += takeValue(r);
    const { lVp, zoneOnly } = loserFacts(L);
    const major = isMajor(eg, L);
    // P5 final lane (perf): the country-wide prices priceOf → planPeaceDemand
    // would give, from the rest's region prices reckoned once (puppet,
    // regime change and disarm sum them).
    let restCosts: number[] | null = null;
    const restCost = (pct: number): number => {
      if (rest.length === 0) return 0;
      restCosts ??= rest.map((r) =>
        peaceRegionCost(ctx.facts, ctx.table, r, id, id),
      );
      return aggregateCost(restCosts, pct);
    };
    const settledOn = (...kinds: DemandKind[]) =>
      peaceSettledOn(ctx.table, L, ...kinds);
    // Never annexed while it holds a Korea region legally (spec §6.9): zoneOnly.
    if (aggressive && lVp * 100 < myVp * 15 && !zoneOnly) {
      add(
        "annex_rest",
        Math.floor((restV * 110) / 100),
        L,
        stored("annex_rest", 0, [], { target: L }),
      );
    }
    const puppetPct = aggressive ? 60 : dem && !major ? 30 : 0;
    add(
      "puppet",
      Math.floor((restV * puppetPct) / 100),
      L,
      stored("puppet", 0, [], { target: L }),
      settledOn("annex_rest", "puppet") ? 0 : restCost(AGG_PCT.puppet),
    );
    const lr = pol.country(L)?.ruling ?? IDEO_NEU;
    if (lr !== ruling) {
      const topple = ctx.table.topple.some(([x, y]) => x === id && y === L);
      add(
        "change_government",
        lr === IDEO_COM || lr === IDEO_FAS ? 200 : 120,
        L,
        stored("change_government", 0, [], { target: L }),
        settledOn("annex_rest", "puppet", "change_government")
          ? 0
          : restCost(
              topple
                ? AGG_PCT.change_government_topple
                : AGG_PCT.change_government,
            ),
      );
    }
    if (ledFaction(eg, L) >= 0) {
      add("dismantle", 150, L, stored("dismantle", 0, [], { target: L }));
    }
    // Before any take of its own the free regions are every participant's:
    // the room is shared (P5 final lane perf).
    const fresh = out.length === 0;
    let k = fresh ? sh.reparations.get(L) : undefined;
    if (k === undefined) {
      k = peaceReparationsRoom(ctx.facts, ctx.table, L, free);
      if (fresh) sh.reparations.set(L, k);
    }
    if (k >= 1) {
      add(
        "reparations",
        10 * k,
        L,
        stored("reparations", 0, [], { target: L, k }),
        rest.length === 0 ? 0 : reparationsCost(k),
      );
    }
    if (major) {
      add(
        "disarm",
        100,
        L,
        stored("disarm", 0, [], { target: L }),
        settledOn("disarm") ? 0 : restCost(AGG_PCT.disarm),
      );
    }
    // One fleet hand-over a loser (not a share of what is left each round).
    const navyDone = ctx.table.settled.some(
      (s) => s.kind === KIND.take_navy && s.target === L,
    );
    let w = 0;
    if (!navyDone) {
      const known = sh.navyW.get(L);
      if (known !== undefined) {
        w = known;
      } else {
        for (const s of peacePickShips(
          ctx.facts,
          ctx.table,
          L,
          TAKE_NAVY_PCT_MAX,
        ))
          w += s.w;
        sh.navyW.set(L, w);
      }
    }
    if (w > 0) {
      const usedNavy = ctx.table.settled.some(
        (s) => s.kind === KIND.take_navy && s.target === L && s.by === id,
      );
      add(
        "take_navy",
        3 * w,
        L,
        stored("take_navy", 0, [], { target: L, pct: TAKE_NAVY_PCT_MAX }),
        usedNavy ? 0 : takeNavyCost(w),
      );
    }
  }
  for (const tag of sh.releasable) {
    const T = sc.smallIdOf(tag);
    if (T === 0) continue;
    const kind = dem ? "liberate" : "release";
    const regs = c.stake.filter(
      (r) => free(r) && eg.hasCore(T, r) && may(kind, r, T),
    );
    if (regs.length === 0) continue;
    let v = 0;
    for (const r of regs) v += worth(r);
    add(
      kind,
      Math.floor((v * (dem ? 80 : 50)) / 100),
      T,
      stored(kind, 0, [], { target: T, beneficiary: T }),
    );
  }
  cands.sort((a, b) => b.score - a.score || a.k - b.k || a.key - b.key);
  // Picking: within the points, five slots, no region twice, one
  // country-wide settlement (annex / puppet / regime change) per loser.
  let spent = spentBefore;
  const bundles = new Map<string, StoredDemand>();
  const country = new Set<string>();
  for (const s of out) {
    if (!REGION_KINDS.has(s.kind)) country.add(`${s.kind}:${s.target}`);
  }
  const fate = (L: number) =>
    (["annex_rest", "puppet", "change_government"] as const).some((k) =>
      country.has(`${KIND[k]}:${L}`),
    );
  // A demand that needs the loser to live on keeps one of its regions out
  // of the takes; a demilitarised region waits for the takes (it holds
  // only on land the loser keeps, spec §6.4).
  const keep = new Set<number>();
  // A puppet keeps what nobody took before it (the engine's lock): no takes
  // of its regions after it.
  const puppets = new Set<number>();
  for (const s of [...ctx.table.settled, ...out]) {
    if (LIVES.has(DEMAND_KINDS[s.kind])) keep.add(s.target);
    if (s.kind === KIND.puppet) puppets.add(s.target);
  }
  // A loser's free stake regions, kept until `used` changes (P5 final lane
  // perf: strands asked it of every candidate).
  let usedVer = 0;
  const leftMemo = new Map<number, { ver: number; left: number[] }>();
  const leftOf = (L: number): number[] => {
    const m = leftMemo.get(L);
    if (m !== undefined && m.ver === usedVer) return m.left;
    const left = c.stake.filter((r) => legal[r] === L && free(r));
    leftMemo.set(L, { ver: usedVer, left });
    return left;
  };
  const usesOf = (x: Cand): number[] =>
    x.kind === "release" || x.kind === "liberate"
      ? c.stake.filter((r) => free(r) && eg.hasCore(x.sd.beneficiary, r))
      : x.kind === "annex_rest"
        ? leftOf(x.sd.target)
        : x.sd.regions;
  const strands = (regs: readonly number[]) =>
    [...keep].some((L) => {
      const left = leftOf(L);
      return left.length > 0 && left.every((r) => regs.includes(r));
    });
  const ordered = [
    ...cands.filter((x) => x.kind !== "demilitarise"),
    ...cands.filter((x) => x.kind === "demilitarise"),
  ];
  for (const x of ordered) {
    if (spent + x.cost > part.pts) continue;
    const sd = x.sd;
    if (LIVES.has(x.kind) && leftOf(sd.target).length === 0) continue;
    if (x.kind !== "demilitarise" && strands(usesOf(x))) continue;
    if (
      x.kind !== "demilitarise" &&
      x.kind !== "annex_rest" &&
      usesOf(x).some((r) => puppets.has(legal[r]))
    ) {
      continue;
    }
    const regional =
      x.kind === "take" ||
      x.kind === "take_for" ||
      x.kind === "occupation_zone" ||
      x.kind === "demilitarise" ||
      x.kind === "release" ||
      x.kind === "liberate";
    if (regional && sd.regions.some((r) => used.has(r))) continue;
    if (x.kind === "release" || x.kind === "liberate") {
      const regs = c.stake.filter(
        (r) => free(r) && eg.hasCore(sd.beneficiary, r),
      );
      if (regs.length === 0) continue;
    }
    const ck = `${KIND[x.kind]}:${sd.target}`;
    if (!regional) {
      if (country.has(ck)) continue;
      const fateKind =
        x.kind === "annex_rest" ||
        x.kind === "puppet" ||
        x.kind === "change_government";
      if (fateKind && fate(sd.target)) continue;
    }
    const bundle =
      x.kind === "take"
        ? "take"
        : x.kind === "take_for"
          ? `take_for:${sd.beneficiary}`
          : x.kind === "occupation_zone"
            ? "zone"
            : null;
    const open = bundle === null ? undefined : bundles.get(bundle);
    if (open !== undefined) {
      open.regions.push(...sd.regions);
    } else {
      if (out.length >= WW_PEACE_DEMANDS_PER_ROUND) continue;
      const slotted = { ...sd, regions: [...sd.regions], slot: out.length };
      // Takes go in one take_group slot (plan Task 2 Step 8).
      if (x.kind === "take") slotted.kind = KIND.take_group;
      out.push(slotted);
      if (bundle !== null) bundles.set(bundle, slotted);
    }
    spent += x.cost;
    if (!regional) country.add(ck);
    if (LIVES.has(x.kind)) keep.add(sd.target);
    if (x.kind === "puppet") puppets.add(sd.target);
    if (x.kind === "annex_rest") {
      for (const r of c.stake) {
        if (legal[r] === sd.target && free(r)) {
          used.set(r, id);
          usedVer++;
        }
      }
    } else if (x.kind === "release" || x.kind === "liberate") {
      for (const r of c.stake) {
        if (free(r) && eg.hasCore(sd.beneficiary, r)) {
          used.set(r, id);
          usedVer++;
        }
      }
    } else {
      for (const r of sd.regions) {
        used.set(r, id);
        usedVer++;
      }
    }
  }
}

/** Pre-flight §0-8: a seeded ±10% on a value (per participant, demand and conference). */
function jitter(
  eg: WwEndgame,
  c: Conference,
  id: number,
  kind: DemandKind,
  key: number,
  v: number,
): number {
  const roll = wwRoll(
    eg.ww.politics.seed,
    P_PEACE_JITTER,
    id,
    KIND[kind] * 65536 + key,
    c.id,
  );
  return Math.floor((v * (90 + ((roll >>> 8) % 21))) / 100);
}
