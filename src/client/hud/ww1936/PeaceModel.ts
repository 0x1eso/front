// World War 1936 P5 (spec §6, §20.1–§20.2, plan Task 9): what the peace
// conference card and the conference map mode read. The prices come from
// the engine-lib rules the engine's conference uses (EndgameRules:
// demandCost, aggregateCost, AGG_PCT, dismantleCost, reparationsCost,
// takeNavyCost, maxReparations, turnOrder) over the inputs the engine
// sends with the conference (WwConferenceView: base values, claims,
// conquer and topple goals, reservations), so a card's price is the
// engine's. The draft (what I am about to submit) and the map mode are a
// per-game client state (peaceUiOf), shared by the card, the land tap flow
// and the map pass.
import {
  COUNTRIES,
  type CountryTag,
  isCountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  type DemandKind,
  type PeaceDemand,
  WW_PEACE_DEMANDS_PER_ROUND,
  type WwConferenceView,
  type WwDemandView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  AGG_PCT,
  aggregateCost,
  demandCost,
  dismantleCost,
  maxReparations,
  reparationsCost,
  takeNavyCost,
  turnOrder,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { SHIP_BASE } from "@openfront/engine-lib/ww1936/ShipStats";
import { assetUrl } from "@openfront/shared/AssetUrls";
import {
  PEACE_DECIDED,
  PEACE_FREE,
  PEACE_MINE,
  PEACE_OTHER,
  PEACE_SELECTED,
  type PeaceMapRegion,
  type PeaceMapSource,
} from "../../render/gl/passes/PeaceMapPass";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { isCoreNow } from "./EconomyModel";
import { countryName, isKoreanUi } from "./WorldWarModel";

/** What the conference screens read from the game (a fake in tests). */
export type PeaceGame = Pick<
  GameView,
  "ticks" | "worldWarScenario" | "myPlayer" | "playerBySmallID"
> &
  Partial<
    Pick<
      GameView,
      "wwEndgame" | "wwLand" | "wwPolitics" | "wwEconomy" | "wwNavy"
    >
  >;

/** Why a demand would fail now: a translation key and its parameters. */
export interface PeaceWhy {
  key: string;
  /** A `country` given as a smallID becomes its name (whyText). */
  params?: Record<string, string | number>;
}

/** One demand of a list as the engine would take it now, in order. */
export interface DemandEval {
  /** The demand with its regions spelled out and its price (`cost`). */
  view: WwDemandView;
  ok: boolean;
  why: PeaceWhy | null;
}

/** The world facts a price reads (the game's views; a fake in tests). */
export interface PeaceWorld {
  controller(region: number): number;
  legalOwner(region: number): number;
  hasCore(smallID: number, region: number): boolean;
  /** Land neighbours. */
  neighbours(region: number): readonly number[];
  /** Members of the faction `smallID` leads; 0: it leads none. */
  ledFactionSize(smallID: number): number;
  /** Civilian factories. */
  civs(smallID: number): number;
  /** The supremacy weight of each ship it has. */
  shipWeights(smallID: number): readonly number[];
  smallIdOf(tag: CountryTag): number;
  tagOf(smallID: number): CountryTag | null;
}

const NO_WORLD: PeaceWorld = {
  controller: () => 0,
  legalOwner: () => 0,
  hasCore: () => false,
  neighbours: () => [],
  ledFactionSize: () => 0,
  civs: () => 0,
  shipWeights: () => [],
  smallIdOf: () => 0,
  tagOf: () => null,
};

/** Why keys (lane T's table). */
export const PEACE_WHY = {
  slots: "ww1936.peace.why.too_many_demands",
  bad: "ww1936.peace.why.bad_demand",
  score: "ww1936.peace.why.no_score",
  target: "ww1936.peace.why.no_target",
  core: "ww1936.peace.why.no_core",
  adjacent: "ww1936.peace.why.not_adjacent",
  used: "ww1936.peace.why.already_used",
  release: "ww1936.peace.why.lost_capital",
  ships: "ww1936.peace.why.no_ships",
  factories: "ww1936.peace.why.no_factories",
  faction: "ww1936.peace.why.no_faction",
  /** Settled in an earlier round (the map legend's words). */
  decided: "ww1936.peace.map_decided",
  /** Reserved by its controller this round (plan decision 15). */
  control: "ww1936.peace.line.failed_control",
} as const;
const WHY = PEACE_WHY;

/** Kinds that hand regions out (the engine's REGION_KINDS). */
const REGION_KINDS: ReadonlySet<DemandKind> = new Set<DemandKind>([
  "take",
  "take_group",
  "take_for",
  "annex_rest",
  "occupation_zone",
  "release",
  "liberate",
]);

/** The country-wide demands of the card's "+ Country demand" list, in its order (spec §20.1). */
export const COUNTRY_DEMANDS = [
  "annex_rest",
  "puppet",
  "change_government",
  "dismantle",
  "disarm",
  "reparations",
  "take_navy",
] as const satisfies readonly DemandKind[];
export type CountryDemandKind = (typeof COUNTRY_DEMANDS)[number];

/** The fleet share steps of "take_navy" (spec §6.4: 10–50%). */
export const NAVY_PCT_MIN = 10;
export const NAVY_PCT_MAX = 50;
export const NAVY_PCT_STEP = 10;

function blankView(kind: DemandKind, slot: number): WwDemandView {
  return {
    kind,
    slot,
    regions: [],
    target: 0,
    beneficiary: 0,
    k: 0,
    pct: 0,
    cost: 0,
  };
}

function pairKey(a: number, b: number): string {
  return `${a}:${b}`;
}

interface Priced {
  cost: number;
  regions: number[];
  why: PeaceWhy | null;
}

export class PeaceModel {
  private readonly stakeIdx = new Map<number, number>();
  private readonly claimSet = new Set<string>();
  private readonly conquerSet = new Set<string>();
  private readonly toppleSet = new Set<string>();
  private readonly reservedBy = new Map<number, number>();
  private readonly partIds = new Set<number>();
  /** Losers annexed or puppeted in the round before (its results). */
  private readonly takenOver = new Set<number>();

  constructor(
    readonly conference: WwConferenceView | null,
    readonly world: PeaceWorld = NO_WORLD,
  ) {
    const c = conference;
    if (c === null) return;
    c.stake.forEach((s, i) => this.stakeIdx.set(s.region, i));
    for (const [p, r] of c.claims) this.claimSet.add(pairKey(p, r));
    for (const [p, l] of c.conquer) this.conquerSet.add(pairKey(p, l));
    for (const [p, l] of c.topple) this.toppleSet.add(pairKey(p, l));
    for (const [r, p] of c.reserved) this.reservedBy.set(r, p);
    for (const p of c.participants) this.partIds.add(p.id);
    for (const l of c.lastRound) {
      if (l.ok && (l.kind === "annex_rest" || l.kind === "puppet")) {
        this.takenOver.add(l.target);
      }
    }
  }

  participant(me: number): WwConferenceView["participants"][number] | null {
    return this.conference?.participants.find((p) => p.id === me) ?? null;
  }

  isLoser(me: number): boolean {
    return this.conference?.losers.includes(me) ?? false;
  }

  /** A stake region's line (base value, settled by, zone); null: not at stake. */
  stakeRegion(region: number): WwConferenceView["stake"][number] | null {
    const i = this.stakeIdx.get(region);
    return i === undefined ? null : this.conference!.stake[i];
  }

  /** The engine's regionCost (plan decision 13): `p` demands, `b` receives. */
  regionCost(region: number, p: number, b = p): number {
    const s = this.stakeRegion(region);
    if (s === null) return 0;
    const ctrl = this.world.controller(region);
    return demandCost(s.base, {
      controls: ctrl === p,
      core: this.world.hasCore(b, region),
      claim: this.claimSet.has(pairKey(p, region)),
      conquerGoal: this.conquerSet.has(
        pairKey(p, this.world.legalOwner(region)),
      ),
      otherControls: ctrl !== p && ctrl !== b && this.partIds.has(ctrl),
    });
  }

  /** My price for `region` has the control discount (the band's "(control discount)"). */
  controlDiscount(region: number, me: number): boolean {
    return this.world.controller(region) === me;
  }

  /** Why `region` can't go to `p` now; null: it is free. */
  private regionBlock(
    region: number,
    p: number,
    taken: ReadonlySet<number>,
  ): PeaceWhy | null {
    const s = this.stakeRegion(region);
    if (s === null) return { key: WHY.bad };
    if (s.settledBy !== 0) return { key: WHY.decided };
    if (taken.has(region)) return { key: WHY.used };
    const by = this.reservedBy.get(region) ?? p;
    if (by !== p) return { key: WHY.control, params: { country: by } };
    return null;
  }

  private free(region: number, p: number, taken: ReadonlySet<number>) {
    return this.regionBlock(region, p, taken) === null;
  }

  /** The loser's stake regions still free for `p`, in stake order. */
  private rest(loser: number, p: number, taken: ReadonlySet<number>): number[] {
    return (this.conference?.stake ?? [])
      .map((s) => s.region)
      .filter(
        (r) => this.world.legalOwner(r) === loser && this.free(r, p, taken),
      );
  }

  /** Stake regions that are `tag`'s cores and still free for `p`. */
  private releaseRegions(
    tag: CountryTag,
    p: number,
    taken: ReadonlySet<number>,
  ): number[] {
    const t = this.world.smallIdOf(tag);
    if (t === 0) return [];
    return (this.conference?.stake ?? [])
      .map((s) => s.region)
      .filter((r) => this.world.hasCore(t, r) && this.free(r, p, taken));
  }

  private touchesMine(region: number, me: number): boolean {
    return (
      this.world.controller(region) === me ||
      this.world.neighbours(region).some((n) => this.world.controller(n) === me)
    );
  }

  /** A content group ∩ the stake, in group order (the engine's take_group expansion). */
  groupRegions(group: string): number[] {
    const g = CONTENT.groupIdx.get(group);
    if (g === undefined) return [];
    return g.regions.filter((r) => this.stakeIdx.has(r));
  }

  /**
   * "Whole group" (spec §20.2): the first content group (REGION_GROUPS, then
   * the P5 groups) holding the stake region `region`; null for none.
   */
  groupOf(region: number): string | null {
    if (!this.stakeIdx.has(region)) return null;
    for (const g of CONTENT.groups) {
      if (g.regions.includes(region)) return g.id;
    }
    return null;
  }

  /** The group whose stake part is exactly `regions` (a bundle's name), or null. */
  groupNamed(regions: readonly number[]): string | null {
    if (regions.length < 2) return null;
    const want = new Set(regions);
    for (const g of CONTENT.groups) {
      const part = g.regions.filter((r) => this.stakeIdx.has(r));
      if (part.length === want.size && part.every((r) => want.has(r))) {
        return g.id;
      }
    }
    return null;
  }

  /** The wire demand with its regions and targets spelled out (cost 0). */
  expand(d: PeaceDemand, slot: number): WwDemandView {
    const v = blankView(d.kind, slot);
    switch (d.kind) {
      case "take":
      case "demilitarise":
        v.regions = [d.region];
        break;
      case "take_group":
        v.regions = this.groupRegions(d.group);
        break;
      case "take_for":
        v.regions = [d.region];
        v.beneficiary = d.beneficiary;
        break;
      case "occupation_zone":
        v.regions =
          d.group !== undefined
            ? this.groupRegions(d.group)
            : d.region !== undefined
              ? [d.region]
              : [];
        break;
      case "release":
      case "liberate": {
        const t = this.world.smallIdOf(d.tag);
        v.target = t;
        v.beneficiary = t;
        break;
      }
      case "reparations":
        v.target = d.target;
        v.k = d.k;
        break;
      case "take_navy":
        v.target = d.target;
        v.pct = d.pct;
        break;
      case "annex_rest":
      case "puppet":
      case "change_government":
      case "dismantle":
      case "disarm":
        v.target = d.target;
        break;
    }
    return v;
  }

  /**
   * The engine's tryDemand, in order, for my list alone (spec §6.5): each
   * demand's price at the moment it is processed, and why it would fail.
   * Other participants' demands are not known; regions already settled or
   * reserved by their controller are.
   */
  evaluate(me: number, demands: readonly WwDemandView[]): DemandEval[] {
    let pts = this.participant(me)?.pts ?? 0;
    const taken = new Set<number>();
    const takenOver = new Set(this.takenOver);
    const seen = new Set<string>();
    return demands.map((d0, i) => {
      const view: WwDemandView = { ...d0, regions: [...d0.regions] };
      const r = this.price(me, view, pts, taken, takenOver);
      let why = r.why;
      if (i >= WW_PEACE_DEMANDS_PER_ROUND) {
        why = { key: WHY.slots, params: { max: WW_PEACE_DEMANDS_PER_ROUND } };
      } else if (why === null && seen.has(demandKey(view))) {
        why = { key: WHY.used };
      }
      seen.add(demandKey(view));
      view.cost = r.cost;
      if (why === null && r.cost > pts) why = { key: WHY.score };
      const ok = why === null;
      if (ok) {
        pts -= r.cost;
        for (const x of r.regions) taken.add(x);
        if (view.kind === "annex_rest" || view.kind === "puppet") {
          takenOver.add(view.target);
        }
        if (REGION_KINDS.has(view.kind) && r.regions.length > 0) {
          view.regions = r.regions;
        }
      }
      return { view, ok, why };
    });
  }

  /** One demand's price now and the regions it would settle (its own points check only for takes). */
  private price(
    me: number,
    d: WwDemandView,
    pts: number,
    taken: ReadonlySet<number>,
    takenOver: ReadonlySet<number>,
  ): Priced {
    const none = (why: PeaceWhy, cost = 0): Priced => ({
      cost,
      regions: [],
      why,
    });
    const sum = (regs: readonly number[], pct: number) =>
      aggregateCost(
        regs.map((r) => this.regionCost(r, me, me)),
        pct,
      );
    switch (d.kind) {
      case "take":
      case "take_group": {
        // Region by region (the engine's take): it succeeds when one does.
        if (d.regions.length === 0) return none({ key: WHY.target });
        let left = pts;
        let cost = 0;
        let full = 0;
        const got: number[] = [];
        let first: PeaceWhy | null = null;
        for (const r of d.regions) {
          const b = this.regionBlock(r, me, taken);
          if (b !== null) {
            first ??= b;
            continue;
          }
          const c = this.regionCost(r, me, me);
          full += c;
          if (c > left) continue;
          left -= c;
          cost += c;
          got.push(r);
        }
        if (got.length > 0) return { cost, regions: got, why: null };
        if (full > 0) return none({ key: WHY.score }, full);
        return none(first ?? { key: WHY.target });
      }
      case "take_for": {
        const r = d.regions[0] ?? 0;
        const blocked = this.regionBlock(r, me, taken);
        if (blocked !== null) return none(blocked);
        const b = d.beneficiary;
        if (!this.partIds.has(b) || !this.world.hasCore(b, r)) {
          return none({ key: WHY.core });
        }
        return { cost: this.regionCost(r, me, b), regions: [r], why: null };
      }
      case "annex_rest": {
        const rest = this.rest(d.target, me, taken);
        if (rest.length === 0) return none({ key: WHY.target });
        return {
          cost: sum(rest, AGG_PCT.annex_rest),
          regions: rest,
          why: null,
        };
      }
      case "occupation_zone": {
        if (d.regions.length === 0) return none({ key: WHY.target });
        const regs = d.regions.filter(
          (r) => this.free(r, me, taken) && this.touchesMine(r, me),
        );
        if (regs.length === 0) {
          const blocked = d.regions
            .map((r) => this.regionBlock(r, me, taken))
            .find((b) => b !== null);
          return none(blocked ?? { key: WHY.adjacent });
        }
        return {
          cost: sum(regs, AGG_PCT.occupation_zone),
          regions: regs,
          why: null,
        };
      }
      case "puppet": {
        if (takenOver.has(d.target)) return none({ key: WHY.bad });
        const rest = this.rest(d.target, me, taken);
        if (rest.length === 0) return none({ key: WHY.target });
        return { cost: sum(rest, AGG_PCT.puppet), regions: [], why: null };
      }
      case "release":
      case "liberate": {
        const tag = this.world.tagOf(d.beneficiary || d.target);
        if (
          tag === null ||
          !(this.conference?.releasable ?? []).includes(tag)
        ) {
          return none({ key: WHY.release });
        }
        const regs = this.releaseRegions(tag, me, taken);
        if (regs.length === 0) return none({ key: WHY.core });
        const pct = d.kind === "release" ? AGG_PCT.release : AGG_PCT.liberate;
        return { cost: sum(regs, pct), regions: regs, why: null };
      }
      case "change_government": {
        if (takenOver.has(d.target)) return none({ key: WHY.bad });
        const pct = this.toppleSet.has(pairKey(me, d.target))
          ? AGG_PCT.change_government_topple
          : AGG_PCT.change_government;
        return {
          cost: sum(this.rest(d.target, me, taken), pct),
          regions: [],
          why: null,
        };
      }
      case "dismantle": {
        const n = this.world.ledFactionSize(d.target);
        if (n === 0) return none({ key: WHY.faction });
        return { cost: dismantleCost(n), regions: [], why: null };
      }
      case "demilitarise": {
        const r = d.regions[0] ?? 0;
        const blocked = this.regionBlock(r, me, taken);
        if (blocked !== null) return none(blocked);
        const mine = this.world
          .neighbours(r)
          .some((n) => this.world.legalOwner(n) === me);
        if (!mine) return none({ key: WHY.adjacent });
        const cost = Math.max(
          1,
          Math.floor((this.regionCost(r, me, me) * AGG_PCT.demilitarise) / 100),
        );
        return { cost, regions: [], why: null };
      }
      case "reparations": {
        if (d.k < 1 || d.k > maxReparations(this.world.civs(d.target))) {
          return none({ key: WHY.factories }, reparationsCost(d.k));
        }
        if (this.rest(d.target, me, taken).length === 0) {
          return none({ key: WHY.target });
        }
        return { cost: reparationsCost(d.k), regions: [], why: null };
      }
      case "disarm": {
        const rest = this.rest(d.target, me, taken);
        if (rest.length === 0) return none({ key: WHY.target });
        return { cost: sum(rest, AGG_PCT.disarm), regions: [], why: null };
      }
      case "take_navy": {
        const weight = navyShare(this.world.shipWeights(d.target), d.pct);
        if (weight === 0) return none({ key: WHY.ships });
        return { cost: takeNavyCost(weight), regions: [], why: null };
      }
    }
  }

  /** My points left this round after `demands` (the ones that would pass). */
  remainingPts(me: number, demands: readonly WwDemandView[]): number {
    let left = this.participant(me)?.pts ?? 0;
    for (const e of this.evaluate(me, demands)) if (e.ok) left -= e.view.cost;
    return left;
  }

  /** What a demand would cost me now, alone. */
  previewCost(me: number, demand: WwDemandView): number {
    return this.evaluate(me, [demand])[0].view.cost;
  }

  /** The rows of my demand list: the draft when given, else what I submitted this round. */
  demandRows(me: number, draft?: readonly PeaceDemand[]): WwDemandView[] {
    if (draft !== undefined) return draft.map((d, i) => this.expand(d, i));
    return this.submitted(me) ?? [];
  }

  /** What I submitted this round (null: nothing yet; []: a pass). */
  submitted(me: number): WwDemandView[] | null {
    return this.conference?.mine.find((m) => m.id === me)?.submitted ?? null;
  }

  /** The AI demands that go in for me when the round ends unanswered (spec §6.5-1). */
  aiRows(me: number): WwDemandView[] {
    return this.conference?.mine.find((m) => m.id === me)?.ai ?? [];
  }

  /** Whether `tag` may be released or liberated here (with a free core at stake). */
  canRelease(tag: CountryTag, me = 0): boolean {
    if (!(this.conference?.releasable ?? []).includes(tag)) return false;
    return this.releaseRegions(tag, me, new Set()).length > 0;
  }

  /** My place in this round's turn order, 1-based (turnOrder by share, snake); 0: none. */
  turnPlace(me: number): number {
    const c = this.conference;
    if (c === null) return 0;
    const order = turnOrder(
      c.participants.map((p) => p.sharePm),
      c.participants.map((p) => p.id),
      c.round,
    );
    return order.indexOf(me) + 1;
  }

  /** Participants other than me holding a core of `region` ("Take for…"). */
  beneficiaries(region: number, me: number): number[] {
    return (this.conference?.participants ?? [])
      .map((p) => p.id)
      .filter((b) => b !== me && this.world.hasCore(b, region));
  }

  /**
   * An engine demand (the AI's, or what I submitted) as wire demands: a
   * bundle of regions is its group when it is one, else one demand a
   * region (the wire has no region lists, plan decision 11).
   */
  toWire(v: WwDemandView): PeaceDemand[] {
    const list = (zone: boolean): PeaceDemand[] => {
      const g = this.groupNamed(v.regions);
      if (g !== null) {
        return [
          zone
            ? { kind: "occupation_zone", group: g }
            : { kind: "take_group", group: g },
        ];
      }
      return v.regions.map((r) =>
        zone
          ? { kind: "occupation_zone", region: r }
          : { kind: "take", region: r },
      );
    };
    switch (v.kind) {
      case "take":
      case "take_group":
        return list(false);
      case "occupation_zone":
        return list(true);
      case "take_for":
        return v.regions.length === 0
          ? []
          : [
              {
                kind: "take_for",
                region: v.regions[0],
                beneficiary: v.beneficiary,
              },
            ];
      case "demilitarise":
        return v.regions.length === 0
          ? []
          : [{ kind: "demilitarise", region: v.regions[0] }];
      case "release":
      case "liberate": {
        const tag = this.world.tagOf(v.beneficiary || v.target);
        return tag === null ? [] : [{ kind: v.kind, tag }];
      }
      case "reparations":
        return [{ kind: "reparations", target: v.target, k: v.k }];
      case "take_navy":
        return [{ kind: "take_navy", target: v.target, pct: v.pct }];
      case "annex_rest":
      case "puppet":
      case "change_government":
      case "dismantle":
      case "disarm":
        return [{ kind: v.kind, target: v.target }];
    }
  }

  /** The AI's demands as a draft ("Fill with AI demands"; at most WW_PEACE_DEMANDS_PER_ROUND). */
  aiDraft(me: number): PeaceDemand[] {
    return this.aiRows(me)
      .flatMap((v) => this.toWire(v))
      .slice(0, WW_PEACE_DEMANDS_PER_ROUND);
  }

  /** Ticks left in the round (the engine's deadline: it stops while paused). */
  ticksLeft(tick: number): number {
    return Math.max(0, (this.conference?.roundEndTick ?? 0) - tick);
  }
}

/** The supremacy weight `take_navy {pct}` hands over: heaviest ships first, up to pct% of the fleet. */
export function navyShare(weights: readonly number[], pct: number): number {
  const sorted = weights.filter((w) => w > 0).sort((a, b) => b - a);
  let total = 0;
  for (const w of sorted) total += w;
  const limit = Math.floor((total * pct) / 100);
  let got = 0;
  for (const w of sorted) {
    if (got >= limit) break;
    got += w;
  }
  return got;
}

/** A demand's identity in a list (the same demand twice is "already demanded"). */
function demandKey(v: WwDemandView): string {
  if (REGION_KINDS.has(v.kind) && v.regions.length > 0) {
    const kind = v.kind === "take_group" ? "take" : v.kind;
    return `${kind}:${v.regions.join(",")}`;
  }
  return `${v.kind}:${v.target}`;
}

// ---- The world from the game's views ----

/** The facts a price reads, from the game's land, politics, endgame, economy and navy views. */
export function peaceWorldOf(game: PeaceGame): PeaceWorld {
  const sc = game.worldWarScenario();
  if (sc === null) return NO_WORLD;
  const land = game.wwLand?.() ?? null;
  const pol = game.wwPolitics?.() ?? null;
  const eg = game.wwEndgame?.() ?? null;
  const econ = game.wwEconomy?.() ?? null;
  const navy = game.wwNavy?.() ?? null;
  const owners = sc.ownerByRegion();
  return {
    controller: (r) =>
      land?.controller[r] ?? econ?.controller[r] ?? owners[r] ?? 0,
    legalOwner: (r) => pol?.legalOwner[r] ?? owners[r] ?? 0,
    hasCore: (id, r) => isCoreNow(eg, sc, r, id),
    neighbours: (r) => sc.regionNeighbours(r),
    ledFactionSize: (id) =>
      pol?.global?.factions.find((f) => f.leader === id)?.members.length ?? 0,
    civs: (id) => econ?.summary(id)?.civ ?? 0,
    shipWeights: (id) => {
      const out: number[] = [];
      for (const f of navy?.fleets.values() ?? []) {
        if (f.owner !== id) continue;
        f.counts.forEach((n, i) => {
          const cls = SHIP_CLASSES[i];
          const w = cls === undefined ? 0 : SHIP_BASE[cls].supWeight;
          for (let k = 0; k < n; k++) out.push(w);
        });
      }
      return out;
    },
    smallIdOf: (tag) => sc.smallIdOf(tag),
    tagOf: (id) => sc.tagOfSmallId(id) ?? null,
  };
}

/** The game's open conference as a model; null outside the mode or without one. */
export function peaceModelOf(game: PeaceGame): PeaceModel | null {
  const conf = game.wwEndgame?.()?.conference() ?? null;
  if (conf === null || conf.status !== "open") return null;
  return new PeaceModel(conf, peaceWorldOf(game));
}

/** My smallID (the country I control now, P5 controllers); null: spectating. */
export function peaceMe(game: PeaceGame): number | null {
  if (game.worldWarScenario() === null) return null;
  return game.myPlayer()?.smallID() ?? null;
}

/**
 * What the card shows me (spec §6.10, §20.1): "card" when I take part,
 * "band" when I am a loser ("waiting for the result"), null otherwise.
 */
export function peaceRole(game: PeaceGame): "card" | "band" | null {
  const m = peaceModelOf(game);
  const me = peaceMe(game);
  if (m === null || me === null) return null;
  if (m.participant(me) !== null) return "card";
  if (m.isLoser(me)) return "band";
  return null;
}

// ---- Names ----

/** A country's name on screen (the endgame's name for a renamed or civil-war country). */
export function peaceCountryName(game: PeaceGame, id: number): string {
  const sc = game.worldWarScenario();
  const tag = sc?.tagOfSmallId(id);
  if (sc === null || tag === undefined) return "";
  const eg = game.wwEndgame?.() ?? null;
  return eg !== null
    ? eg.displayName(id, (x) => sc.tagOfSmallId(x) ?? tag)
    : countryName(tag);
}

/** A country's flag picture (the endgame's flag for a woken or civil-war slot). */
export function peaceFlagUrl(game: PeaceGame, id: number): string | null {
  const sc = game.worldWarScenario();
  const tag = sc?.tagOfSmallId(id);
  if (sc === null || tag === undefined) return null;
  const flag =
    game.wwEndgame?.()?.countries.get(id)?.flag || COUNTRIES[tag].flag;
  return assetUrl(`flags/${flag}.svg`);
}

/** A region's name (scenario.json, P0 decision 15). */
export function peaceRegionName(sc: ScenarioIndex, region: number): string {
  const r = sc.region(region);
  if (r === undefined) return "";
  return isKoreanUi() ? r.nameKo : r.name;
}

/** A region group's name (one namespace for every group, P5 Phase B). */
export function peaceGroupName(group: string): string {
  return translateText(`ww1936.pol.group.${group}`);
}

export function demandName(kind: DemandKind): string {
  return translateText(`ww1936.demand.${kind}`);
}

/** A list of regions: its group's name, its one region, or "the first +N". */
export function regionsText(
  sc: ScenarioIndex,
  model: PeaceModel,
  regions: readonly number[],
): string {
  if (regions.length === 0) return "";
  const g = model.groupNamed(regions);
  if (g !== null) return peaceGroupName(g);
  const first = peaceRegionName(sc, regions[0]);
  return regions.length === 1
    ? first
    : `${first} ${translateText("ww1936.eventui.more", { n: regions.length - 1 })}`;
}

/** What a demand is about, in words: regions, a country, a tag to free, factories or a fleet share. */
export function demandTargetText(
  game: PeaceGame,
  model: PeaceModel,
  v: WwDemandView,
): string {
  const sc = game.worldWarScenario();
  if (sc === null) return "";
  switch (v.kind) {
    case "release":
    case "liberate":
      return peaceCountryName(game, v.beneficiary || v.target);
    case "reparations":
      return `${peaceCountryName(game, v.target)} · ${translateText(
        "ww1936.peace.reparations_n",
        { n: v.k },
      )}`;
    case "take_navy":
      return `${peaceCountryName(game, v.target)} · ${translateText(
        "ww1936.peace.navy_pct",
        { pct: v.pct },
      )}`;
    case "annex_rest":
    case "puppet":
    case "change_government":
    case "dismantle":
    case "disarm":
      return peaceCountryName(game, v.target);
    case "take_for":
      return `${regionsText(sc, model, v.regions)} → ${peaceCountryName(
        game,
        v.beneficiary,
      )}`;
    default:
      return regionsText(sc, model, v.regions);
  }
}

/** The conference's title name: its losers' names. */
export function losersText(game: PeaceGame, conf: WwConferenceView): string {
  return conf.losers.map((l) => peaceCountryName(game, l)).join(", ");
}

/** A "why" as text (a `country` given as a smallID becomes its name). */
export function whyText(game: PeaceGame, why: PeaceWhy): string {
  const params: Record<string, string | number> = { ...(why.params ?? {}) };
  if (typeof params.country === "number") {
    params.country = peaceCountryName(game, params.country);
  }
  return translateText(why.key, params);
}

/**
 * A peace-log line (lane W: ww1936.peace.line.<kind>) with its tags as
 * names; the engine's parameter names (by, target, beneficiary, n, group)
 * also fill the keys' (who, loser, to, what).
 */
export function peaceLineText(
  game: PeaceGame,
  line: { key: string; params: Record<string, string | number> },
): string {
  const sc = game.worldWarScenario();
  const name = (v: string | number): string | number => {
    if (typeof v !== "string" || !isCountryTag(v)) return v;
    const id = sc?.smallIdOf(v) ?? 0;
    return id > 0 ? peaceCountryName(game, id) : countryName(v);
  };
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(line.params)) {
    p[k.endsWith("Tag") ? k.slice(0, -3) : k] = name(v);
  }
  p.who ??= p.by ?? "";
  p.loser ??= p.target ?? "";
  p.to ??= p.beneficiary ?? p.tag ?? "";
  if (p.what === undefined) {
    p.what =
      typeof p.group === "string"
        ? peaceGroupName(p.group)
        : typeof p.region === "number" && sc !== null
          ? peaceRegionName(sc, p.region)
          : "";
  }
  return translateText(line.key, p);
}

/** A country's colour (its territory colour; the endgame's for a civil-war slot). */
export function peaceColor(game: PeaceGame, id: number): number {
  const c = game.wwEndgame?.()?.countries.get(id)?.color ?? null;
  if (c !== null) return c;
  try {
    const p = game.playerBySmallID(id) as unknown as {
      territoryColor?: () => { toRgb(): { r: number; g: number; b: number } };
    };
    const rgb = p.territoryColor?.().toRgb();
    if (rgb !== undefined) return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
  } catch {
    // A slot whose first update has not arrived.
  }
  return 0x9ca3af;
}

// ---- The client state: the draft and the map mode ----

/** My draft for this round and the conference map mode (one per game). */
export class PeaceUi {
  conf = 0;
  round = 0;
  draft: PeaceDemand[] = [];
  /** The draft as last sent (JSON), "pass" after a pass; null: nothing sent this round. */
  sent: string | null = null;
  /** The conference map mode is on (spec §20.2). */
  map = false;
  /** The stake region tapped last in the map mode (0: none). */
  region = 0;
  /** Bumped on every change (the card and the map redraw on it). */
  version = 0;

  /**
   * A new conference or round starts a new draft: what I submitted this
   * round (after a reload), else nothing.
   */
  sync(conf: number, round: number, submitted: PeaceDemand[] | null): void {
    if (conf === this.conf && round === this.round) return;
    if (conf !== this.conf) {
      this.map = false;
      this.region = 0;
    }
    this.conf = conf;
    this.round = round;
    this.draft = submitted ?? [];
    this.sent = submitted === null ? null : JSON.stringify(submitted);
    this.version++;
  }

  /** The draft is not what was sent (or nothing was). */
  dirty(): boolean {
    return this.sent !== JSON.stringify(this.draft);
  }

  setDraft(list: readonly PeaceDemand[]): void {
    this.draft = list.slice(0, WW_PEACE_DEMANDS_PER_ROUND);
    this.version++;
  }

  /** Adds a demand; false when the round's slots are full. */
  add(d: PeaceDemand): boolean {
    if (this.draft.length >= WW_PEACE_DEMANDS_PER_ROUND) return false;
    this.draft = [...this.draft, d];
    this.version++;
    return true;
  }

  remove(i: number): void {
    this.draft = this.draft.filter((_, n) => n !== i);
    this.version++;
  }

  markSent(passed: boolean): void {
    this.sent = passed ? "pass" : JSON.stringify(this.draft);
    this.version++;
  }

  openMap(): void {
    this.map = true;
    this.region = 0;
    this.version++;
  }

  closeMap(): void {
    if (!this.map) return;
    this.map = false;
    this.region = 0;
    this.version++;
  }

  pick(region: number): void {
    this.region = region;
    this.version++;
  }

  /** The conference ended: nothing left to draw or send. */
  reset(): void {
    if (this.conf === 0 && !this.map) return;
    this.conf = 0;
    this.round = 0;
    this.draft = [];
    this.sent = null;
    this.map = false;
    this.region = 0;
    this.version++;
  }
}

const uis = new WeakMap<object, PeaceUi>();
/** One conference client state per game view. */
export function peaceUiOf(game: object): PeaceUi {
  let u = uis.get(game);
  if (u === undefined) uis.set(game, (u = new PeaceUi()));
  return u;
}

/**
 * The land tap flow asks this first (WwLandController): while the
 * conference map mode is on, a map tap picks the stake region under it
 * (anywhere else: none) and nothing else happens. False when it is off.
 */
export function peaceMapTap(game: PeaceGame, region: number): boolean {
  const ui = peaceUiOf(game);
  if (!ui.map) return false;
  const m = peaceModelOf(game);
  if (m === null) {
    ui.closeMap();
    return false;
  }
  ui.pick(m.stakeRegion(region) === null ? 0 : region);
  return true;
}

// ---- The map mode's data ----

let confSeq = 0;
const confIds = new WeakMap<object, number>();
/** Changes whenever the endgame view holds a new conference object (each update replaces it). */
export function confRevision(conf: WwConferenceView | null): number {
  if (conf === null) return 0;
  let n = confIds.get(conf);
  if (n === undefined) confIds.set(conf, (n = ++confSeq));
  return n;
}

/** The map mode's regions (spec §20.2): every stake region's state, colour and my price. */
export function peaceMapRegions(game: PeaceGame): PeaceMapRegion[] {
  const ui = peaceUiOf(game);
  const sc = game.worldWarScenario();
  const m = peaceModelOf(game);
  const me = peaceMe(game);
  if (!ui.map || sc === null || m === null || me === null) return [];
  const mine = new Set<number>();
  for (const e of m.evaluate(me, m.demandRows(me, ui.draft))) {
    for (const r of e.view.regions) mine.add(r);
  }
  const myColor = peaceColor(game, me);
  const w = sc.width;
  return m.conference!.stake.map((s) => {
    const ctrl = m.world.controller(s.region);
    let state = PEACE_FREE;
    let rgb = 0xffffff;
    if (s.settledBy !== 0) {
      state = PEACE_DECIDED;
      rgb = peaceColor(game, s.settledBy);
    } else if (mine.has(s.region)) {
      state = PEACE_MINE;
      rgb = myColor;
    } else if (ctrl !== me && m.participant(ctrl) !== null) {
      state = PEACE_OTHER;
      rgb = peaceColor(game, ctrl);
    }
    if (s.region === ui.region) state |= PEACE_SELECTED;
    const t = sc.centerTile(s.region);
    return {
      region: s.region,
      state,
      rgb,
      value: m.regionCost(s.region, me, me),
      x: t % w,
      y: Math.floor(t / w),
    };
  });
}

/** What PeaceMapPass reads (GameRenderer hands it to the map renderer). */
export function peaceMapSource(game: PeaceGame): PeaceMapSource {
  return {
    key: () => {
      const ui = peaceUiOf(game);
      if (!ui.map) return "";
      const conf = game.wwEndgame?.()?.conference() ?? null;
      return [
        confRevision(conf),
        ui.version,
        game.wwLand?.()?.version ?? 0,
        game.wwPolitics?.()?.version ?? 0,
        game.myPlayer()?.smallID() ?? 0,
      ].join(":");
    },
    regions: () => peaceMapRegions(game),
  };
}
