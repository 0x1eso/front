// World War 1936 P5 (spec §6, §20.1–§20.2, plan Task 9): what the peace
// conference card and the conference map mode read. A demand's legality,
// regions and price come from the engine-lib rules the engine's
// conference settles with (PeaceRules: planPeaceDemand, expandPeaceDemand,
// peaceRegionCost), over the inputs the engine sends with the conference
// (WwConferenceView: base values, claims, conquer and topple goals,
// reservations) and the client's views of the world, so a card's price
// and its reason for a failing demand are the engine's. The draft (what I
// am about to submit) and the map mode are a per-game client state
// (peaceUiOf), shared by the card, the land tap flow and the map pass.
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
import { turnOrder } from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  demandKindIndex,
  expandPeaceDemand,
  type PeaceBlock,
  peaceBlockKey,
  peaceClaimantTags,
  type PeaceDemandIn,
  type PeaceFacts,
  peaceRegionBlock,
  peaceRegionCost,
  type PeaceSensitivity,
  peaceSensitivity,
  type PeaceSettledRow,
  type PeaceShip,
  type PeaceTable,
  planPeaceDemand,
  REGION_DEMAND_KINDS,
  SENSITIVE_EXCLUDED_TAG,
  type SensitiveBlock,
  TAKE_NAVY_PCT_MAX,
  TAKE_NAVY_PCT_MIN,
} from "@openfront/engine-lib/ww1936/PeaceRules";
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
import {
  countryName,
  isKoreanUi,
  wwActive,
  type WwGame,
} from "./WorldWarModel";

/** What the conference screens read from the game (a fake in tests). */
export type PeaceGame = WwGame &
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
  /** The engine refuses the whole submission over it (bad_demand on the wire). */
  refused: boolean;
}

/** The world facts a demand reads (PeaceRules' PeaceFacts) and the tags. */
export interface PeaceWorld extends PeaceFacts {
  smallIdOf(tag: CountryTag): number;
  tagOf(smallID: number): CountryTag | null;
  /** Still playing (the engine's isActor; wwActive on the client). */
  isActor(smallID: number): boolean;
}

const NO_WORLD: PeaceWorld = {
  controller: () => 0,
  legalOwner: () => 0,
  hasCore: () => false,
  neighbours: () => [],
  regionCivs: () => 0,
  ledFactionSize: () => 0,
  ships: () => [],
  smallIdOf: () => 0,
  tagOf: () => null,
  isActor: () => true,
};

/** Why keys (lane T's table); the engine's blocks are `ww1936.peace.why.<block>`. */
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

function blockWhy(b: PeaceBlock): PeaceWhy {
  return { key: peaceBlockKey(b) };
}

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
export const NAVY_PCT_MIN = TAKE_NAVY_PCT_MIN;
export const NAVY_PCT_MAX = TAKE_NAVY_PCT_MAX;
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

function demandIn(v: WwDemandView): PeaceDemandIn {
  return {
    kind: v.kind,
    regions: v.regions,
    target: v.target,
    beneficiary: v.beneficiary,
    k: v.k,
    pct: v.pct,
  };
}

export class PeaceModel {
  private readonly stakeIdx = new Map<number, number>();
  private readonly reservedBy = new Map<number, number>();
  private readonly partIds = new Set<number>();
  /** The conference's inputs as PeaceRules reads them (the card's copy of the engine's record). */
  readonly table: PeaceTable;
  /** Views made from wire demands the engine would refuse (expandPeaceDemand: null). */
  private readonly refusedViews = new WeakSet<WwDemandView>();
  /** Korea's and Taiwan's rules for this conference (spec §6.9; PeaceRules). */
  readonly sens: PeaceSensitivity;

  constructor(
    readonly conference: WwConferenceView | null,
    readonly world: PeaceWorld = NO_WORLD,
  ) {
    const c = conference;
    c?.stake.forEach((s, i) => this.stakeIdx.set(s.region, i));
    for (const [r, p] of c?.reserved ?? []) this.reservedBy.set(r, p);
    for (const p of c?.participants ?? []) this.partIds.add(p.id);
    this.table = {
      stake: (c?.stake ?? []).map((s) => s.region),
      base: (c?.stake ?? []).map((s) => s.base),
      losers: c?.losers ?? [],
      parts: c?.participants ?? [],
      claims: c?.claims ?? [],
      conquer: c?.conquer ?? [],
      topple: c?.topple ?? [],
      // Everything settled so far, in settle order (lane W's view).
      settled: (c?.settled ?? []).map((x) => ({
        kind: demandKindIndex(x.kind),
        by: x.by,
        target: x.target,
        k: x.k,
        regions: x.regions,
      })),
    };
    // As the engine's peaceSens: Taiwan's claimants from the static
    // claims table, those still playing.
    this.sens = peaceSensitivity(
      (g) => CONTENT.groupIdx.get(g)?.regions ?? [],
      world.smallIdOf(SENSITIVE_EXCLUDED_TAG),
      c?.mainVictor ?? 0,
      peaceClaimantTags(CONTENT.claims)
        .map((tag) => world.smallIdOf(tag))
        .filter((id) => id > 0 && world.isActor(id)),
    );
  }

  /**
   * Why `region` can't go to `receiver` by `kind` from `p` (Korea: zone
   * only; Taiwan: its claimant only — spec §6.9); null: it can.
   */
  sensitiveBlock(
    p: number,
    receiver: number,
    kind: DemandKind,
    region: number,
  ): SensitiveBlock | null {
    return peaceRegionBlock(this.sens, this.table, p, receiver, kind, region);
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

  /** The engine's region price (plan decision 13): `p` demands, `b` receives. */
  regionCost(region: number, p: number, b = p): number {
    if (this.stakeRegion(region) === null) return 0;
    return peaceRegionCost(this.world, this.table, region, p, b);
  }

  /** My price for `region` has the control discount (the band's "(control discount)"). */
  controlDiscount(region: number, me: number): boolean {
    return this.world.controller(region) === me;
  }

  /**
   * Why `region` is not free for `p` (the engine's `free`: at stake, not
   * settled, not reserved by another participant's control); null: free.
   */
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

  /** A content group ∩ the stake, in group order (the engine's take_group expansion). */
  groupRegions(group: string): number[] {
    const g = CONTENT.groupIdx.get(group);
    if (g === undefined) return [];
    return [...new Set(g.regions.filter((r) => this.stakeIdx.has(r)))];
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
      const part = new Set(g.regions.filter((r) => this.stakeIdx.has(r)));
      if (part.size === want.size && [...part].every((r) => want.has(r))) {
        return g.id;
      }
    }
    return null;
  }

  /**
   * The wire demand spelled out as the engine does (expandPeaceDemand, cost
   * 0). One the engine would refuse comes back blank and marked refused.
   */
  expand(d: PeaceDemand, slot: number, me = 0): WwDemandView {
    const x = expandPeaceDemand(this.table, me, d, {
      groupRegions: (g) => CONTENT.groupIdx.get(g)?.regions ?? [],
      releasable: this.conference?.releasable ?? [],
      smallIdOf: (tag) => this.world.smallIdOf(tag),
      hasCore: (id, r) => this.world.hasCore(id, r),
      sensitivity: this.sens,
    });
    const v = blankView(d.kind, slot);
    if (x === null) {
      // Keep what names the row on the card (and what the reason reads).
      if ("region" in d && d.region !== undefined) v.regions = [d.region];
      if ("group" in d && d.group !== undefined) {
        v.regions = this.groupRegions(d.group);
      }
      if (d.kind === "take_for") v.beneficiary = d.beneficiary;
      if ("target" in d) v.target = d.target;
      if (d.kind === "release" || d.kind === "liberate") {
        v.target = v.beneficiary = this.world.smallIdOf(d.tag);
      }
      this.refusedViews.add(v);
      return v;
    }
    v.regions = [...x.regions];
    v.target = x.target;
    v.beneficiary = x.beneficiary;
    v.k = x.k;
    v.pct = x.pct;
    return v;
  }

  /**
   * The engine's resolution of my list alone (spec §6.5; Conference
   * tryDemand over planPeaceDemand), in order: each demand's price at the
   * moment it is processed, what it settles, and why it would fail. Other
   * participants' demands of this round are not known; regions settled
   * before and regions their controllers reserved are.
   */
  evaluate(me: number, demands: readonly WwDemandView[]): DemandEval[] {
    let pts = this.participant(me)?.pts ?? 0;
    const taken = new Set<number>();
    const table: PeaceTable = {
      ...this.table,
      settled: [...this.table.settled],
    };
    const settled = table.settled as PeaceSettledRow[];
    const free = (r: number) => this.regionBlock(r, me, taken) === null;
    return demands.map((d0, i) => {
      const view: WwDemandView = { ...d0, regions: [...d0.regions] };
      const refused = this.refusedViews.has(d0);
      const fail = (why: PeaceWhy, cost = 0): DemandEval => {
        view.cost = cost;
        return { view, ok: false, why, refused };
      };
      if (i >= WW_PEACE_DEMANDS_PER_ROUND) {
        return fail({
          key: WHY.slots,
          params: { max: WW_PEACE_DEMANDS_PER_ROUND },
        });
      }
      if (refused) {
        // Korea / Taiwan regions are left out of a demand (expandPeaceDemand):
        // say why rather than "not possible".
        const to = view.kind === "take_for" ? view.beneficiary : me;
        for (const r of view.regions) {
          const b = this.sensitiveBlock(me, to, view.kind, r);
          if (b !== null) return fail(blockWhy(b));
        }
        return fail({ key: WHY.bad });
      }
      const plan = planPeaceDemand(
        this.world,
        table,
        me,
        demandIn(view),
        free,
        this.sens,
      );
      if (typeof plan === "string") {
        // "Nothing left" over named regions: say which way they are gone.
        if (plan === "no_target" && view.regions.length > 0) {
          const b = view.regions
            .map((r) => this.regionBlock(r, me, taken))
            .find((x) => x !== null);
          if (b !== undefined) return fail(b);
        }
        return fail(blockWhy(plan));
      }
      const kind = view.kind;
      if ("each" in plan) {
        // Region by region while the points last (tryDemand).
        const got: number[] = [];
        let cost = 0;
        let full = 0;
        for (const [r, c] of plan.each) {
          full += c;
          if (c > pts - cost) continue;
          cost += c;
          got.push(r);
        }
        if (got.length === 0) return fail({ key: WHY.score }, full);
        pts -= cost;
        if (kind !== "demilitarise") for (const r of got) taken.add(r);
        view.regions = got;
        view.cost = cost;
        for (const r of got) {
          settled.push({
            kind: demandKindIndex(kind === "take_group" ? "take" : kind),
            by: me,
            target: this.world.legalOwner(r),
            k: 0,
            regions: [r],
          });
        }
        return { view, ok: true, why: null, refused };
      }
      if (plan.cost > pts) return fail({ key: WHY.score }, plan.cost);
      pts -= plan.cost;
      view.cost = plan.cost;
      if (REGION_DEMAND_KINDS.has(kind)) {
        for (const r of plan.all) taken.add(r);
        view.regions = [...plan.all];
      }
      settled.push({
        kind: demandKindIndex(kind),
        by: me,
        target: view.target,
        k: view.k,
        regions: [...plan.all],
      });
      return { view, ok: true, why: null, refused };
    });
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
    if (draft !== undefined) return draft.map((d, i) => this.expand(d, i, me));
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

  /** Whether `tag` may be released or liberated here by `me` (the engine would take it). */
  canRelease(tag: CountryTag, me = 0): boolean {
    const v = this.expand({ kind: "release", tag }, 0, me);
    if (this.refusedViews.has(v)) return false;
    const plan = planPeaceDemand(
      this.world,
      this.table,
      me,
      demandIn(v),
      (r) => this.regionBlock(r, me, new Set()) === null,
      this.sens,
    );
    return typeof plan !== "string";
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
        return v.regions.map((r) => ({
          kind: "take_for",
          region: r,
          beneficiary: v.beneficiary,
        }));
      case "demilitarise":
        return v.regions.map((r) => ({ kind: "demilitarise", region: r }));
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

// ---- The world from the game's views ----

/** The facts a demand reads, from the game's land, politics, endgame, economy and navy views. */
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
    regionCivs: (r) => econ?.region(r).civ ?? sc.region(r)?.civ ?? 0,
    ledFactionSize: (L) => {
      // The faction L leads, or founded and lost the lead of when it
      // capitulated (the engine's ledFaction, spec §6.4 dismantle).
      const idx = pol?.factionIdx(L) ?? -1;
      const f = pol?.global?.factions.find((x) => x.idx === idx) ?? null;
      if (f === null) return 0;
      const tag = sc.tagOfSmallId(L);
      const founded =
        f.leader === L ||
        (tag !== undefined && f.nameTag === tag) ||
        (tag !== undefined &&
          CONTENT.factionNames.find((n) => n.id === f.name)?.creators[0] ===
            tag);
      return founded ? f.members.length : 0;
    },
    ships: (L) => {
      const out: PeaceShip[] = [];
      for (const f of navy?.fleets.values() ?? []) {
        if (f.owner !== L) continue;
        if (f.ships.length > 0) {
          for (const s of f.ships) {
            out.push({ id: s.id, w: SHIP_BASE[s.cls].supWeight });
          }
          continue;
        }
        // Another country's fleet: its class counts only (ids stand in).
        let n = 0;
        f.counts.forEach((count, i) => {
          const cls = SHIP_CLASSES[i];
          if (cls === undefined) return;
          for (let k = 0; k < count; k++) {
            out.push({ id: -(f.id * 1000 + n++), w: SHIP_BASE[cls].supWeight });
          }
        });
      }
      return out.sort((a, b) => b.w - a.w || a.id - b.id);
    },
    smallIdOf: (tag) => sc.smallIdOf(tag),
    tagOf: (id) => sc.tagOfSmallId(id) ?? null,
    isActor: (id) => wwActive(game, id),
  };
}

/** The game's open conference as a model; null outside the mode or without one. */
export function peaceModelOf(game: PeaceGame): PeaceModel | null {
  const conf = game.wwEndgame?.()?.conference() ?? null;
  if (conf === null || conf.status !== "open") return null;
  // One model per conference update: its tables come from the conference
  // object (each update replaces it), its world reads the views live.
  const hit = models.get(game);
  if (hit !== undefined && hit.conference === conf) return hit;
  const m = new PeaceModel(conf, peaceWorldOf(game));
  models.set(game, m);
  return m;
}
const models = new WeakMap<object, PeaceModel>();

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
  const own = game.wwEndgame?.()?.countries.get(id)?.flag ?? "";
  const flag = own !== "" ? own : COUNTRIES[tag].flag;
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
 * names (`who`/`loser`/`to`/`tag`, each also as its `…Tag` raw tag); the
 * key's `what` is built from `group`, `region` or `regions` (comma-joined
 * ids).
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
  p.what ??=
    typeof p.group === "string"
      ? peaceGroupName(p.group)
      : typeof p.region === "number" && sc !== null
        ? peaceRegionName(sc, p.region)
        : typeof p.regions === "string" && sc !== null
          ? regionIdsText(sc, p.regions)
          : "";
  return translateText(line.key, p);
}

/**
 * A peace-log line's `regions` (lane W: comma-joined region ids) in words:
 * the content group they make up, else the first region's name "+N".
 */
export function regionIdsText(sc: ScenarioIndex, ids: string): string {
  const regions = ids
    .split(",")
    .map((x) => Number(x))
    .filter((r) => Number.isInteger(r) && r > 0);
  if (regions.length === 0) return "";
  if (regions.length > 1) {
    const want = new Set(regions);
    const g = CONTENT.groups.find(
      (x) =>
        x.regions.length === want.size && x.regions.every((r) => want.has(r)),
    );
    if (g !== undefined) return peaceGroupName(g.id);
  }
  const first = peaceRegionName(sc, regions[0]);
  return regions.length === 1
    ? first
    : `${first} ${translateText("ww1936.eventui.more", { n: regions.length - 1 })}`;
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
    // What the engine holds: nothing, a pass (no demands), or a list.
    this.sent =
      submitted === null
        ? null
        : submitted.length === 0
          ? "pass"
          : JSON.stringify(submitted);
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

  /** A pass leaves no demands this round (the engine's), so the draft empties. */
  markSent(passed: boolean): void {
    if (passed) this.draft = [];
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
  // What the map shows depends on: the conference update, my draft and
  // pick, control, legal owners, factories and fleets (the prices), and
  // who I am. Compared as numbers each frame; the key string is made only
  // when one changed.
  const seen = new Float64Array(7).fill(-1);
  let key = "";
  let changed = false;
  const put = (i: number, v: number) => {
    if (seen[i] === v) return;
    seen[i] = v;
    changed = true;
  };
  return {
    key: () => {
      const ui = peaceUiOf(game);
      if (!ui.map) return "";
      changed = key === "";
      put(0, confRevision(game.wwEndgame?.()?.conference() ?? null));
      put(1, ui.version);
      put(2, game.wwLand?.()?.version ?? 0);
      put(3, game.wwPolitics?.()?.version ?? 0);
      put(4, game.wwEconomy?.()?.version ?? 0);
      put(5, game.wwNavy?.()?.version ?? 0);
      put(6, game.myPlayer()?.smallID() ?? 0);
      if (changed) key = Array.from(seen).join(":");
      return key;
    },
    regions: () => peaceMapRegions(game),
  };
}
