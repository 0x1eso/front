// World War 1936 P5 (spec §6.3–§6.5, plan decisions 11, 13, 15): the peace
// conference's demand rules as pure functions over the facts a demand
// reads. The engine's conference (lane W) settles demands with them and
// the conference card (lane U1) previews with them, so a card's price and
// its reason for a failing demand are the engine's. Integers only; regions
// by id, countries by smallID.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DEMAND_KINDS,
  DemandKind,
  PeaceDemand,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  AGG_PCT,
  aggregateCost,
  demandCost,
  dismantleCost,
  maxReparations,
  reparationsCost,
  takeNavyCost,
} from "./EndgameRules";

/** Spec §6.4 take_navy: the fleet share a demand may ask, percent. */
export const TAKE_NAVY_PCT_MIN = 10;
export const TAKE_NAVY_PCT_MAX = 50;

/** The world a demand reads (the engine's state, or the client's views). */
export interface PeaceFacts {
  controller(region: number): number;
  legalOwner(region: number): number;
  hasCore(smallID: number, region: number): boolean;
  /** Land neighbours. */
  neighbours(region: number): readonly number[];
  /** Civilian factories in the region now. */
  regionCivs(region: number): number;
  /** Members of the faction `loser` leads (or founded, spec §6.4 dismantle); 0: none. */
  ledFactionSize(loser: number): number;
  /** `loser`'s ships, the heaviest first (supremacy weight; ties: ship id). */
  ships(loser: number): readonly PeaceShip[];
}

export interface PeaceShip {
  readonly id: number;
  /** Supremacy weight. */
  readonly w: number;
}

/** A demand already settled (the engine's record; `kind` is its DEMAND_KINDS index). */
export interface PeaceSettledRow {
  readonly kind: number;
  /** Who settled it (take_navy: once per participant and loser). */
  readonly by: number;
  readonly target: number;
  readonly k: number;
  /** Regions, or the ship ids of a take_navy. */
  readonly regions: readonly number[];
}

/** A conference's inputs (the engine's record has this shape; the card builds it from its view). */
export interface PeaceTable {
  readonly stake: readonly number[];
  /** base(r) of each stake region, in stake order. */
  readonly base: readonly number[];
  readonly losers: readonly number[];
  readonly parts: readonly { readonly id: number }[];
  /** [participant, region]. */
  readonly claims: readonly (readonly [number, number])[];
  /** [participant, loser]. */
  readonly conquer: readonly (readonly [number, number])[];
  /** [participant, loser]. */
  readonly topple: readonly (readonly [number, number])[];
  readonly settled: readonly PeaceSettledRow[];
}

/** A demand spelled out (plan decision 11): its regions, target, receiver, k, pct. */
export interface PeaceDemandIn {
  readonly kind: DemandKind;
  readonly regions: readonly number[];
  readonly target: number;
  readonly beneficiary: number;
  readonly k: number;
  readonly pct: number;
}

/** Why a demand cannot be settled now (`ww1936.peace.why.<block>`). */
export type PeaceBlock =
  | "bad_demand"
  | "no_target"
  | "no_core"
  | "not_adjacent"
  | "no_ships"
  | "no_factories"
  | "no_faction"
  | "lost_capital"
  | "already_used"
  | SensitiveBlock;

/** Why a Korea or Taiwan region can't go this way (`ww1936.peace.why.<block>`). */
export type SensitiveBlock = "zone_only" | "claim_only";

/** The translation key of a reason (the card shows it). */
export function peaceBlockKey(block: PeaceBlock): string {
  const key = `ww1936.peace.why.${block}`;
  return key;
}

/**
 * What a demand would settle: region by region (take, take_group,
 * take_for, demilitarise — each at its own price, while the points last)
 * or all at one price (`all`: the regions handed out, or a take_navy's
 * ship ids; empty for a country-wide demand).
 */
export type PeacePlan =
  | { readonly each: readonly (readonly [number, number])[] }
  | {
      readonly all: readonly number[];
      readonly cost: number;
      readonly receiver: number;
    };

const KIND_IDX = Object.fromEntries(
  DEMAND_KINDS.map((k, i) => [k, i]),
) as Record<DemandKind, number>;

/** DEMAND_KINDS index of a kind (the engine's stored demands). */
export function demandKindIndex(kind: DemandKind): number {
  return KIND_IDX[kind];
}

/** Kinds that hand regions out (take, take_group, take_for, annex_rest, occupation_zone, release, liberate). */
export const REGION_DEMAND_KINDS: ReadonlySet<DemandKind> = new Set<DemandKind>(
  [
    "take",
    "take_group",
    "take_for",
    "annex_rest",
    "occupation_zone",
    "release",
    "liberate",
  ],
);

const isPart = (t: PeaceTable, id: number) => t.parts.some((x) => x.id === id);
const pairIn = (
  list: readonly (readonly [number, number])[],
  a: number,
  b: number,
) => list.some(([x, y]) => x === a && y === b);

// ---- Korea and Taiwan (spec §6.9, §16.4; owner decision 6; controller ruling) ----

/** Korea's groups: their regions are only ever an occupation zone (control only). */
export const ZONE_ONLY_GROUPS: readonly string[] = [
  "korea_north",
  "korea_south",
];
/** Taiwan: only a participant claiming it (CLAIMS: CHN) takes it. */
export const CLAIM_ONLY_GROUPS: readonly string[] = ["taiwan"];
/** The country that never takes or zones either again. */
export const SENSITIVE_EXCLUDED_TAG: CountryTag = "JPN";

/** The fixed conference rules of Korea's and Taiwan's regions for one conference. */
export interface PeaceSensitivity {
  /** Korea: only `occupation_zone`; a loser holding one legally is never annexed. */
  readonly zoneOnly: ReadonlySet<number>;
  /** Taiwan: taken only by a participant that claims it; with none, only the main victor's zone. */
  readonly claimOnly: ReadonlySet<number>;
  /** smallID of SENSITIVE_EXCLUDED_TAG (0: not in the game): never takes or zones either. */
  readonly excluded: number;
  /** The participant with the most war score (peaceMainVictor). */
  readonly mainVictor: number;
}

/** The rules from the content's groups (`groupRegions`: a group's regions). */
export function peaceSensitivity(
  groupRegions: (group: string) => readonly number[],
  excluded: number,
  mainVictor: number,
): PeaceSensitivity {
  const of = (groups: readonly string[]) =>
    new Set(groups.flatMap((g) => [...groupRegions(g)]));
  return {
    zoneOnly: of(ZONE_ONLY_GROUPS),
    claimOnly: of(CLAIM_ONLY_GROUPS),
    excluded,
    mainVictor,
  };
}

/** The main victor: most war score, ties the smaller smallID (round 1's first turn); 0: none. */
export function peaceMainVictor(
  parts: readonly { readonly id: number; readonly wsMilli: number }[],
): number {
  let best = 0;
  let bestWs = -1;
  for (const p of parts) {
    if (p.wsMilli > bestWs || (p.wsMilli === bestWs && p.id < best)) {
      best = p.id;
      bestWs = p.wsMilli;
    }
  }
  return best;
}

/**
 * Whether `region` may go to `receiver` by participant `p`'s demand of
 * `kind` (null: yes). Korea's regions: an occupation zone only, never for
 * the excluded country (zone_only). Taiwan's: taken (take, take_group,
 * take_for, annex_rest) or zoned only for a participant claiming it; with
 * no claiming participant, only the main victor's occupation zone; never
 * the excluded country (claim_only). Every other region: null. The engine
 * (submissions, reservations, settling, the AI) and the card ask this.
 */
export function peaceRegionBlock(
  s: PeaceSensitivity,
  t: PeaceTable,
  p: number,
  receiver: number,
  kind: DemandKind,
  region: number,
): SensitiveBlock | null {
  if (s.zoneOnly.has(region)) {
    return kind === "occupation_zone" && p !== s.excluded ? null : "zone_only";
  }
  if (!s.claimOnly.has(region)) return null;
  if (p === s.excluded || receiver === s.excluded) return "claim_only";
  const holders = t.claims.filter(([, r]) => r === region).map(([x]) => x);
  if (holders.length > 0) {
    const gets =
      kind === "take" ||
      kind === "take_group" ||
      kind === "take_for" ||
      kind === "annex_rest" ||
      kind === "occupation_zone";
    return gets && holders.includes(receiver) ? null : "claim_only";
  }
  return kind === "occupation_zone" && p === s.mainVictor ? null : "claim_only";
}

/** A loser that legally holds a Korea region at stake is never annexed. */
function holdsZoneOnly(
  f: PeaceFacts,
  t: PeaceTable,
  s: PeaceSensitivity,
  loser: number,
): boolean {
  return t.stake.some((r) => s.zoneOnly.has(r) && f.legalOwner(r) === loser);
}

/**
 * Plan decision 13: the cost of `region` to `p`, received by `b` (p
 * itself, or take_for's receiver): control, claim and conquest goal by p,
 * the core by the receiver, ×200% when another participant controls it.
 * `base` defaults to the region's stake value.
 */
export function peaceRegionCost(
  f: PeaceFacts,
  t: PeaceTable,
  region: number,
  p: number,
  b: number,
  base?: number,
): number {
  const i = t.stake.indexOf(region);
  const ctrl = f.controller(region);
  return demandCost(base ?? (i >= 0 ? t.base[i] : 0), {
    controls: ctrl === p,
    core: f.hasCore(b, region),
    claim: pairIn(t.claims, p, region),
    conquerGoal: pairIn(t.conquer, p, f.legalOwner(region)),
    otherControls: ctrl !== p && ctrl !== b && isPart(t, ctrl),
  });
}

/** Whether a demand of one of `kinds` on `loser` is already settled. */
export function peaceSettledOn(
  t: PeaceTable,
  loser: number,
  ...kinds: DemandKind[]
): boolean {
  return t.settled.some(
    (s) => s.target === loser && kinds.some((k) => s.kind === KIND_IDX[k]),
  );
}

/** `loser`'s stake regions still free (stake order). */
export function peaceRest(
  f: PeaceFacts,
  t: PeaceTable,
  loser: number,
  free: (r: number) => boolean,
): number[] {
  return t.stake.filter((r) => f.legalOwner(r) === loser && free(r));
}

/**
 * Spec §6.4 occupation_zone: of `regions` (those `ok`), the ones `p`
 * controls or that border a region it controls, and — the zone is chosen
 * by group — those joined to them through the demand's own regions.
 */
export function peaceZoneRegions(
  f: PeaceFacts,
  p: number,
  regions: readonly number[],
  ok: (r: number) => boolean,
): number[] {
  const cand = new Set(regions.filter(ok));
  const got = new Set<number>();
  const q: number[] = [];
  for (const r of [...cand].sort((a, b) => a - b)) {
    if (
      f.controller(r) === p ||
      f.neighbours(r).some((n) => f.controller(n) === p)
    ) {
      got.add(r);
      q.push(r);
    }
  }
  for (let h = 0; h < q.length; h++) {
    for (const n of f.neighbours(q[h])) {
      if (!cand.has(n) || got.has(n)) continue;
      got.add(n);
      q.push(n);
    }
  }
  return [...got].sort((a, b) => a - b);
}

/** Spec §6.4 take_navy: the heaviest of `loser`'s ships not yet handed over, up to `pct`% of their weight. */
export function peacePickShips(
  f: PeaceFacts,
  t: PeaceTable,
  loser: number,
  pct: number,
): PeaceShip[] {
  const gone = new Set<number>();
  for (const s of t.settled) {
    if (s.kind === KIND_IDX.take_navy) for (const id of s.regions) gone.add(id);
  }
  const ships = f.ships(loser).filter((s) => !gone.has(s.id));
  let total = 0;
  for (const s of ships) total += s.w;
  const want = Math.floor((total * pct) / 100);
  const out: PeaceShip[] = [];
  let sum = 0;
  for (const s of ships) {
    if (sum + s.w > want) continue;
    out.push(s);
    sum += s.w;
  }
  return out;
}

/** Spec §6.4 reparations: the factories `loser` may still owe (a quarter of the civilian factories it keeps, less what was settled). */
export function peaceReparationsRoom(
  f: PeaceFacts,
  t: PeaceTable,
  loser: number,
  free: (r: number) => boolean,
): number {
  let civ = 0;
  for (const r of peaceRest(f, t, loser, free)) civ += f.regionCivs(r);
  let owed = 0;
  for (const s of t.settled) {
    if (s.kind === KIND_IDX.reparations && s.target === loser) owed += s.k;
  }
  return maxReparations(civ) - owed;
}

/**
 * Spec §6.4 per kind (plan decision 13): what `d` by `p` would settle now
 * and at what price, or why it can't. `free(r)`: the region is at stake,
 * not settled, and not reserved by another participant's control this
 * round (plan decision 15). `s`: Korea's and Taiwan's rules
 * (peaceRegionBlock). A puppet settled on a loser keeps its other regions
 * (HOI4: the puppet keeps what nobody took before). Points are the
 * caller's (spent only when it settles).
 */
export function planPeaceDemand(
  f: PeaceFacts,
  t: PeaceTable,
  p: number,
  d: PeaceDemandIn,
  free: (r: number) => boolean,
  s: PeaceSensitivity,
): PeacePlan | PeaceBlock {
  const L = d.target;
  const loser = t.losers.includes(L);
  const costs = (regs: readonly number[]) =>
    regs.map((r) => peaceRegionCost(f, t, r, p, p));
  const all = (
    regs: readonly number[],
    cost: number,
    receiver = p,
  ): PeacePlan => ({ all: regs, cost, receiver });
  // The first Korea / Taiwan reason met (a free region the rule refused).
  let why: SensitiveBlock | null = null;
  const puppeted = (r: number) => peaceSettledOn(t, f.legalOwner(r), "puppet");
  /** Of `regs`, those free and allowed to go to `receiver` by this kind. */
  const open = (regs: readonly number[], receiver = p): number[] =>
    regs.filter((r) => {
      if (!free(r) || puppeted(r)) return false;
      const b = peaceRegionBlock(s, t, p, receiver, d.kind, r);
      if (b !== null) why ??= b;
      return b === null;
    });
  switch (d.kind) {
    case "take":
    case "take_group": {
      const each = open(d.regions).map((r): [number, number] => [
        r,
        peaceRegionCost(f, t, r, p, p),
      ]);
      return each.length > 0 ? { each } : (why ?? "no_target");
    }
    case "take_for": {
      const b = d.beneficiary;
      if (b === p || !isPart(t, b)) return "bad_demand";
      const cand = d.regions.filter((r) => free(r) && !puppeted(r));
      const each = open(
        cand.filter((r) => f.hasCore(b, r)),
        b,
      ).map((r): [number, number] => [r, peaceRegionCost(f, t, r, p, b)]);
      if (each.length > 0) return { each };
      if (why !== null) return why;
      return cand.length > 0 ? "no_core" : "no_target";
    }
    case "annex_rest": {
      if (!loser || peaceSettledOn(t, L, "puppet")) return "bad_demand";
      if (holdsZoneOnly(f, t, s, L)) return "zone_only";
      const regs = open(peaceRest(f, t, L, free));
      if (regs.length === 0) return why ?? "no_target";
      return all(regs, aggregateCost(costs(regs), AGG_PCT.annex_rest));
    }
    case "occupation_zone": {
      const cand = open(d.regions);
      const regs = peaceZoneRegions(f, p, cand, () => true);
      if (regs.length > 0) {
        return all(regs, aggregateCost(costs(regs), AGG_PCT.occupation_zone));
      }
      if (cand.length > 0) return "not_adjacent";
      return why ?? "no_target";
    }
    case "puppet": {
      if (!loser || peaceSettledOn(t, L, "annex_rest", "puppet")) {
        return "bad_demand";
      }
      const regs = peaceRest(f, t, L, free);
      if (regs.length === 0) return "no_target";
      return all([], aggregateCost(costs(regs), AGG_PCT.puppet));
    }
    case "release":
    case "liberate": {
      const T = d.beneficiary;
      if (T <= 0) return "lost_capital";
      const cores = t.stake.filter((r) => f.hasCore(T, r));
      if (cores.length === 0) return "no_core";
      const regs = open(cores, T);
      if (regs.length === 0) return why ?? "no_target";
      const pct = d.kind === "release" ? AGG_PCT.release : AGG_PCT.liberate;
      return all(regs, aggregateCost(costs(regs), pct), T);
    }
    case "change_government": {
      if (
        !loser ||
        peaceSettledOn(t, L, "annex_rest", "puppet", "change_government")
      ) {
        return "bad_demand";
      }
      const regs = peaceRest(f, t, L, free);
      if (regs.length === 0) return "no_target";
      const pct = pairIn(t.topple, p, L)
        ? AGG_PCT.change_government_topple
        : AGG_PCT.change_government;
      return all([], aggregateCost(costs(regs), pct));
    }
    case "dismantle": {
      if (!loser || peaceSettledOn(t, L, "dismantle")) return "bad_demand";
      const n = f.ledFactionSize(L);
      return n <= 0 ? "no_faction" : all([], dismantleCost(n));
    }
    case "demilitarise": {
      const cand = d.regions.filter((r) => {
        if (!t.stake.includes(r) || !free(r)) return false;
        if (
          t.settled.some(
            (x) => x.kind === KIND_IDX.demilitarise && x.regions.includes(r),
          )
        ) {
          return false;
        }
        const b = peaceRegionBlock(s, t, p, p, "demilitarise", r);
        if (b !== null) why ??= b;
        return b === null;
      });
      const each = cand
        .filter((r) => f.neighbours(r).some((n) => f.legalOwner(n) === p))
        .map((r): [number, number] => [
          r,
          Math.max(
            1,
            Math.floor(
              (peaceRegionCost(f, t, r, p, p) * AGG_PCT.demilitarise) / 100,
            ),
          ),
        ]);
      if (each.length > 0) return { each };
      if (cand.length > 0) return "not_adjacent";
      return why ?? "no_target";
    }
    case "reparations": {
      if (!loser || d.k < 1) return "bad_demand";
      if (peaceRest(f, t, L, free).length === 0) return "no_target";
      if (d.k > peaceReparationsRoom(f, t, L, free)) return "no_factories";
      return all([], reparationsCost(d.k));
    }
    case "disarm": {
      if (!loser || peaceSettledOn(t, L, "disarm")) return "bad_demand";
      const regs = peaceRest(f, t, L, free);
      if (regs.length === 0) return "no_target";
      return all([], aggregateCost(costs(regs), AGG_PCT.disarm));
    }
    case "take_navy": {
      if (!loser) return "bad_demand";
      // Once per participant and loser (not pct% of what is left each round).
      if (
        t.settled.some(
          (x) => x.kind === KIND_IDX.take_navy && x.target === L && x.by === p,
        )
      ) {
        return "already_used";
      }
      const ships = peacePickShips(f, t, L, d.pct);
      if (ships.length === 0) return "no_ships";
      let w = 0;
      for (const x of ships) w += x.w;
      return all(
        ships.map((x) => x.id),
        takeNavyCost(w),
      );
    }
  }
}

/** A plan's full price (every region of a region-by-region plan). */
export function peacePlanCost(plan: PeacePlan): number {
  if ("cost" in plan) return plan.cost;
  let s = 0;
  for (const [, c] of plan.each) s += c;
  return s;
}

/** What the wire demand needs to be spelled out (plan decision 11). */
export interface PeaceExpandFacts {
  /** A content region group's regions. */
  groupRegions(group: string): readonly number[];
  /** The tags a release / liberate may name here (spec §6.4). */
  readonly releasable: readonly CountryTag[];
  smallIdOf(tag: CountryTag): number;
  hasCore(smallID: number, region: number): boolean;
  /** Korea's and Taiwan's rules: a region they refuse is never spelled in. */
  readonly sensitivity: PeaceSensitivity;
}

/**
 * Plan decision 11: a wire demand spelled out into regions (groups ∩ the
 * stake, without the Korea / Taiwan regions peaceRegionBlock refuses to
 * `p`), its target, receiver, k and pct; null when it is not a demand this
 * conference can take from `p` (the engine answers bad_demand).
 */
export function expandPeaceDemand(
  t: PeaceTable,
  p: number,
  d: PeaceDemand,
  x: PeaceExpandFacts,
): PeaceDemandIn | null {
  const inStake = (r: number) => t.stake.includes(r);
  const allowed = (r: number, receiver = p) =>
    peaceRegionBlock(x.sensitivity, t, p, receiver, d.kind, r) === null;
  const group = (g: string) => [
    ...new Set(x.groupRegions(g).filter((r) => inStake(r) && allowed(r))),
  ];
  const loser = (id: number) => t.losers.includes(id);
  const out = (
    regions: readonly number[],
    o: Partial<Omit<PeaceDemandIn, "kind" | "regions">> = {},
  ): PeaceDemandIn => ({
    kind: d.kind,
    regions,
    target: o.target ?? 0,
    beneficiary: o.beneficiary ?? 0,
    k: o.k ?? 0,
    pct: o.pct ?? 0,
  });
  switch (d.kind) {
    case "take":
    case "demilitarise":
      return inStake(d.region) && allowed(d.region) ? out([d.region]) : null;
    case "take_group": {
      const regs = group(d.group);
      return regs.length > 0 ? out(regs) : null;
    }
    case "take_for": {
      const b = d.beneficiary;
      if (b === p || !isPart(t, b)) return null;
      if (!inStake(d.region) || !x.hasCore(b, d.region)) return null;
      if (!allowed(d.region, b)) return null;
      return out([d.region], { beneficiary: b });
    }
    case "occupation_zone": {
      if ((d.group === undefined) === (d.region === undefined)) return null;
      const regs =
        d.group !== undefined
          ? group(d.group)
          : inStake(d.region!) && allowed(d.region!)
            ? [d.region!]
            : [];
      return regs.length > 0 ? out(regs) : null;
    }
    case "annex_rest":
    case "puppet":
    case "change_government":
    case "dismantle":
    case "disarm":
      return loser(d.target) ? out([], { target: d.target }) : null;
    case "reparations":
      return loser(d.target) && d.k >= 1
        ? out([], { target: d.target, k: d.k })
        : null;
    case "take_navy":
      return loser(d.target) &&
        d.pct >= TAKE_NAVY_PCT_MIN &&
        d.pct <= TAKE_NAVY_PCT_MAX
        ? out([], { target: d.target, pct: d.pct })
        : null;
    case "release":
    case "liberate": {
      if (!x.releasable.includes(d.tag)) return null;
      const id = x.smallIdOf(d.tag);
      return id === 0 ? null : out([], { target: id, beneficiary: id });
    }
  }
}
