// P5 lane W (plan Task 2): the conference AI (spec §6.9, §17.1; plan
// decision 30). Korea's 38th-parallel occupation zones first, always (owner
// ruling, pre-flight §0-8: control only; a zone nobody intended can hold
// goes to a participant that can); then the history table's demands when
// the historical AI is on and this participant keeps its row (≈75% per
// seed and conference — history is a guide); then the general AI: value
// per point, a seeded ±10% jitter, within the points and five slots, takes
// bundled into one slot. A human's card shows the same (its own country's
// values). The general AI never takes a Korean region.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
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
  maxReparations,
  turnOrder,
} from "@openfront/engine-lib/ww1936/EndgameRules";
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
  pickShips,
  priceOf,
  REGION_KINDS,
  regionCost,
  stored,
  takenMap,
  zoneRegions,
} from "./Conference";
import type { Conference, StoredDemand, WwEndgame } from "./WwEndgame";

/**
 * The region groups of Korea (content, peace table only — decision 32):
 * occupation zones, never taken by the AI.
 */
export const KOREA_GROUPS: readonly string[] = ["korea_north", "korea_south"];

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

/** The AI's demands of `smallID` this round of conference `conf`. */
export function aiDemands(
  eg: WwEndgame,
  conf: number,
  smallID: number,
): StoredDemand[] {
  const c = conferenceById(eg, conf);
  const part = c?.parts.find((p) => p.id === smallID);
  if (c === null || part === undefined || part.pts <= 0 || c.status === 2) {
    return [];
  }
  const stake = new Set(c.stake);
  const used = takenMap(c);
  const free = (r: number) => stake.has(r) && !used.has(r);
  const out: StoredDemand[] = [];
  let spent = 0;
  const take = (sd: StoredDemand, cost: number): void => {
    out.push(sd);
    spent += cost;
    if (REGION_KINDS.has(sd.kind) || sd.kind === KIND.demilitarise) {
      for (const r of sd.regions) used.set(r, smallID);
    }
  };
  // 1. Korea's zones (always), then the history table.
  for (const z of koreaPlan(eg, c, used)) {
    if (z.holder !== smallID || out.length >= WW_PEACE_DEMANDS_PER_ROUND) {
      continue;
    }
    const sd = stored("occupation_zone", out.length, z.regions.filter(free));
    const cost = priceOf(eg, c, smallID, sd, used);
    if (cost > 0) take(sd, cost);
  }
  for (const { L, dd } of historyLines(eg, c, smallID)) {
    if (out.length >= WW_PEACE_DEMANDS_PER_ROUND) break;
    const sd = fromDefault(eg, c, smallID, L, dd, out.length, free);
    if (sd === null) continue;
    const cost = priceOf(eg, c, smallID, sd, used);
    if (cost > 0) take(sd, cost);
  }
  // 2. The general AI in the slots left.
  generalAi(eg, c, part, out, used, spent);
  return out;
}

/**
 * Pre-flight §0-8: the Korea zone lines of the losers' history rows, each
 * to its line's participant when it can hold the zone (controls a region
 * of it or one next to it), else to the holder of an earlier Korean zone,
 * else to the strongest participant that can.
 */
function koreaPlan(
  eg: WwEndgame,
  c: Conference,
  used: ReadonlyMap<number, number>,
): { group: string; holder: number; regions: number[] }[] {
  const pol = eg.ww.politics;
  const stake = new Set(c.stake);
  const free = (r: number) => stake.has(r) && !used.has(r);
  const isPart = (x: number) => c.parts.some((p) => p.id === x);
  const strongest = turnOrder(
    c.parts.map((p) => p.wsMilli),
    c.parts.map((p) => p.id),
    1,
  );
  const out: { group: string; holder: number; regions: number[] }[] = [];
  for (const L of c.losers) {
    const ctx = makeCtx(pol, L, 0, 0, eg.mg.ticks());
    for (const row of pol.content.peaceByLoser.get(pol.tagOf(L)) ?? []) {
      if (!evalCondition(ctx, row.when)) continue;
      for (const line of row.lines) {
        if (!evalCondition(ctx, line.when)) continue;
        for (const dd of line.demands) {
          if (
            dd.kind !== "occupation_zone" ||
            !KOREA_GROUPS.includes(dd.group)
          ) {
            continue;
          }
          const regions = groupRegions(eg, dd.group).filter(free);
          if (regions.length === 0) continue;
          const intended = resolveSelector(ctx, line.by);
          const can = (h: number) =>
            isPart(h) && zoneRegions(eg, h, regions, free).length > 0;
          const holder =
            [intended, ...out.map((o) => o.holder), ...strongest].find(can) ??
            (isPart(intended) ? intended : strongest[0]);
          out.push({ group: dd.group, holder, regions });
        }
      }
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
  p: number,
  L: number,
  dd: PeaceDefaultDemand,
  slot: number,
  free: (r: number) => boolean,
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
      if (!releasableTags(eg, c.stake).includes(dd.tag)) return null;
      const t = sc.smallIdOf(dd.tag);
      return t === 0
        ? null
        : stored(dd.kind, slot, [], { target: t, beneficiary: t });
    }
    case "reparations": {
      const k = Math.min(dd.k, reparationsRoom(eg, c, L, free));
      return k < 1 ? null : stored("reparations", slot, [], { target: L, k });
    }
    case "take_navy":
      return stored("take_navy", slot, [], {
        target: L,
        pct: Math.max(10, Math.min(50, dd.pct)),
      });
  }
}

/** Spec §6.4: the factories `L` may still owe (a quarter of what it keeps, less what others claimed). */
function reparationsRoom(
  eg: WwEndgame,
  c: Conference,
  L: number,
  free: (r: number) => boolean,
): number {
  let civ = 0;
  for (const r of c.stake) {
    if (eg.ww.politics.legalOwner[r] === L && free(r)) {
      civ += effectiveBuildings(eg.ww.economy, r, "civ");
    }
  }
  let owed = 0;
  for (const s of c.settled) {
    if (s.kind === KIND.reparations && s.target === L) owed += s.k;
  }
  return maxReparations(civ) - owed;
}

interface Cand {
  kind: DemandKind;
  v: number;
  cost: number;
  /** Ties and jitter: the region, or the target country. */
  key: number;
  sd: StoredDemand;
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
  const korea = new Set<number>();
  for (const g of KOREA_GROUPS)
    for (const r of groupRegions(eg, g)) korea.add(r);
  const claim = (r: number) => c.claims.some(([x, y]) => x === id && y === r);
  const bordersMine = (r: number) =>
    sc.regionNeighbours(r).some((n) => legal[n] === id);
  const worth = (r: number): number => {
    const reg = sc.region(r);
    if (reg === undefined) return 0;
    let res = 0;
    for (const x of reg.res) res += x;
    const f =
      effectiveBuildings(econ, r, "civ") +
      effectiveBuildings(econ, r, "mil") +
      effectiveBuildings(econ, r, "dock");
    return 10 * reg.vp + 8 * f + 2 * res;
  };
  const takeValue = (r: number, coreOf = id): number => {
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
  let myVp = 0;
  for (const r of sc.landRegions) if (legal[r.id] === id) myVp += r.vp;
  const cands: Cand[] = [];
  const add = (kind: DemandKind, v: number, key: number, sd: StoredDemand) => {
    if (v <= 0) return;
    const cost =
      sd.regions.length === 1 && (kind === "take" || kind === "take_for")
        ? regionCost(eg, c, sd.regions[0], id, sd.beneficiary || id)
        : priceOf(eg, c, id, sd, used);
    if (cost <= 0) return;
    cands.push({ kind, v: jitter(eg, c, id, kind, key, v), cost, key, sd });
  };
  // Regions (never a Korean one: occupation zones only, spec §6.9).
  for (const r of c.stake) {
    if (!free(r) || korea.has(r)) continue;
    add("take", takeValue(r), r, stored("take", 0, [r]));
    for (const b of c.parts) {
      if (b.id === id || !pol.sameFaction(id, b.id) || !eg.hasCore(b.id, r)) {
        continue;
      }
      add(
        "take_for",
        Math.floor((takeValue(r, b.id) * 60) / 100),
        r,
        stored("take_for", 0, [r], { beneficiary: b.id }),
      );
    }
    if (zoneRegions(eg, id, [r], free).length > 0) {
      const pct = dem && isMajor(eg, legal[r]) ? 70 : 20;
      add(
        "occupation_zone",
        Math.floor((takeValue(r) * pct) / 100),
        r,
        stored("occupation_zone", 0, [r]),
      );
    }
    if (
      sc.regionNeighbours(r).some((n) => eg.hasCore(id, n)) &&
      bordersMine(r)
    ) {
      add("demilitarise", 20, r, stored("demilitarise", 0, [r]));
    }
  }
  // Countries.
  for (const L of c.losers) {
    const rest = c.stake.filter((r) => legal[r] === L && free(r));
    let restV = 0;
    for (const r of rest) restV += takeValue(r);
    let lVp = 0;
    for (const r of c.stake) if (legal[r] === L) lVp += sc.region(r)?.vp ?? 0;
    const major = isMajor(eg, L);
    if (
      aggressive &&
      lVp * 100 < myVp * 15 &&
      !rest.some((r) => korea.has(r))
    ) {
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
    );
    const lr = pol.country(L)?.ruling ?? IDEO_NEU;
    if (lr !== ruling) {
      add(
        "change_government",
        lr === IDEO_COM || lr === IDEO_FAS ? 200 : 120,
        L,
        stored("change_government", 0, [], { target: L }),
      );
    }
    if (ledFaction(eg, L) >= 0) {
      add("dismantle", 150, L, stored("dismantle", 0, [], { target: L }));
    }
    const k = reparationsRoom(eg, c, L, free);
    if (k >= 1) {
      add(
        "reparations",
        10 * k,
        L,
        stored("reparations", 0, [], { target: L, k }),
      );
    }
    if (major) add("disarm", 100, L, stored("disarm", 0, [], { target: L }));
    let w = 0;
    for (const s of pickShips(eg, c, L, 50)) w += s.w;
    if (w > 0) {
      add(
        "take_navy",
        3 * w,
        L,
        stored("take_navy", 0, [], { target: L, pct: 50 }),
      );
    }
  }
  for (const tag of releasableTags(eg, c.stake)) {
    const T = sc.smallIdOf(tag);
    if (T === 0) continue;
    const regs = c.stake.filter((r) => free(r) && eg.hasCore(T, r));
    if (regs.length === 0 || regs.some((r) => korea.has(r))) continue;
    let v = 0;
    for (const r of regs) v += worth(r);
    const kind = dem ? "liberate" : "release";
    add(
      kind,
      Math.floor((v * (dem ? 80 : 50)) / 100),
      T,
      stored(kind, 0, [], { target: T, beneficiary: T }),
    );
  }
  const score = (x: Cand) => Math.floor((x.v * 1000) / x.cost);
  cands.sort(
    (a, b) =>
      score(b) - score(a) || KIND[a.kind] - KIND[b.kind] || a.key - b.key,
  );
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
  for (const x of cands) {
    if (spent + x.cost > part.pts) continue;
    const sd = x.sd;
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
    if (x.kind === "annex_rest") {
      for (const r of c.stake) {
        if (legal[r] === sd.target && free(r)) used.set(r, id);
      }
    } else if (x.kind === "release" || x.kind === "liberate") {
      for (const r of c.stake) {
        if (free(r) && eg.hasCore(sd.beneficiary, r)) used.set(r, id);
      }
    } else {
      for (const r of sd.regions) used.set(r, id);
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
