// World War 1936 P4 (spec §18.3, plan decision 40): the map taps of the
// navy and the air war. P2's WwLandController asks it after its own army
// tokens (an army token is always tapped first, even over the air layer:
// the layer only colours). The flows:
//   1. a fleet's mission: token → card → [Mission] → chip → a glowing sea
//      region (its preview) → the same region again = the order;
//   2. move, merge (another of my tokens in the same sea), port strike (a
//      glowing enemy port, then the confirming tap);
//   3. the air layer: a tap chooses the zone (its card);
//   4. a landing: the army card's [Invade] → a glowing enemy coastal
//      region (its chips) → the same region again = preparation starts.
// A tap anywhere else drops the preview, then the mode, then the fleet.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { FleetMission } from "@openfront/engine-api/ww1936/NavyTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { hitFleet, layoutFleets } from "../../view/FleetTokenLayout";
import { landSelectionOf, WwSelectArmyEvent } from "./LandSelection";
import {
  invasionPreview,
  invasionTargets,
  mergeTargets,
  missionCandidates,
  moveTarget,
  NavyCtx,
  navyCtx,
  NavyGame,
  portStrikeTargets,
} from "./NavyModel";
import {
  SeaAirSelection,
  SeaAirTapMode,
  WwAirLayerEvent,
  WwAirZoneSelectedEvent,
  WwFleetSelectedEvent,
  WwSeaLayerEvent,
} from "./SeaAirSelection";
import { isCapitulated, TWO_TAP_MIN_MS } from "./WorldWarModel";

/** What the next map tap means: a tap mode (SeaAirSelection.tapMode) or none. */
export type SeaAirMode = "none" | SeaAirTapMode;

/** The tap flow's draft (spec §18.3), beside the shared SeaAirSelection. */
export class SeaAirDraft {
  mode: SeaAirMode = "none";
  /** The mission chip chosen (mission mode). */
  mission: FleetMission = "patrol";
  /** First tap: a sea region (mission), a zone (move), a region (port strike, landing); 0: none. */
  pending = 0;
  pendingAt = 0;
  /** The landing's army (invade mode). */
  army = 0;
  version = 0;
}

const states = new WeakMap<
  object,
  { selection: SeaAirSelection; draft: SeaAirDraft }
>();

/** One selection and draft per game view (the cards, the dials and lane R read them). */
export function seaAirOf(game: object): {
  selection: SeaAirSelection;
  draft: SeaAirDraft;
} {
  let s = states.get(game);
  if (s === undefined) {
    s = { selection: new SeaAirSelection(), draft: new SeaAirDraft() };
    states.set(game, s);
  }
  return s;
}

/** The chosen fleet, the zone, the layer or the draft changed: the cards redraw. */
export class WwSeaAirChangedEvent implements GameEvent {}

/** A card asks for a tap mode (mission with its chip, move, merge, port strike, invade with its army); "none" ends it. */
export class WwSeaAirModeEvent implements GameEvent {
  constructor(
    readonly mode: SeaAirMode,
    readonly mission: FleetMission = "patrol",
    readonly army = 0,
  ) {}
}

/** The render lane's layout and hit test (FleetTokenLayout), injectable for tests. */
export interface SeaAirTapDeps {
  layout: typeof layoutFleets;
  hit: typeof hitFleet;
  now: () => number;
}

/** What glows on the map now (spec §18.3): sea regions, or land regions; null: nothing. */
export interface SeaAirGlow {
  kind: "sea" | "land";
  ids: number[];
}

/** The regions a mode makes glow for its tap (lane R draws them). */
export function seaAirGlow(game: NavyGame): SeaAirGlow | null {
  const { selection, draft } = seaAirOf(game);
  if (draft.mode === "none") return null;
  const ctx = navyCtx(game);
  if (ctx === null) return null;
  if (draft.mode === "invade") {
    return { kind: "land", ids: invasionTargets(ctx, draft.army) };
  }
  const f = ctx.navy.fleets.get(selection.fleet);
  if (f === undefined) return null;
  switch (draft.mode) {
    case "mission":
      return { kind: "sea", ids: missionCandidates(ctx, f, draft.mission) };
    case "port_strike":
      return { kind: "land", ids: portStrikeTargets(ctx, f) };
    default:
      return null;
  }
}

export class WwSeaAirController implements Controller {
  readonly selection: SeaAirSelection;
  readonly draft: SeaAirDraft;
  private readonly deps: SeaAirTapDeps;
  private unregisterBack: (() => void) | null = null;

  constructor(
    private readonly game: NavyGame,
    private readonly eventBus: EventBus,
    /** Screen px per tile (the TransformHandler's scale). */
    private readonly zoom: () => number = () => 1,
    deps: Partial<SeaAirTapDeps> = {},
  ) {
    const s = seaAirOf(game);
    this.selection = s.selection;
    this.draft = s.draft;
    this.deps = {
      layout: layoutFleets,
      hit: hitFleet,
      now: () => Date.now(),
      ...deps,
    };
  }

  init() {
    this.eventBus.on(WwFleetSelectedEvent, (e) => this.selectFleet(e.fleet));
    this.eventBus.on(WwAirZoneSelectedEvent, (e) => this.selectZone(e.sr));
    this.eventBus.on(WwSeaLayerEvent, (e) =>
      this.setLayer(
        e.on
          ? "sea"
          : this.selection.layer === "sea"
            ? "none"
            : this.selection.layer,
      ),
    );
    this.eventBus.on(WwAirLayerEvent, (e) =>
      this.setLayer(
        e.on
          ? "air"
          : this.selection.layer === "air"
            ? "none"
            : this.selection.layer,
      ),
    );
    this.eventBus.on(WwSeaAirModeEvent, (e) =>
      this.setMode(e.mode, e.mission, e.army),
    );
  }

  private myId(): number | null {
    if (this.game.worldWarScenario() === null) return null;
    const me = this.game.myPlayer();
    if (me === null || !me.isAlive()) return null;
    return isCapitulated(this.game, me.smallID()) ? null : me.smallID();
  }

  /** The landing flow keeps the army chosen (the army card shows its chips). */
  keepsArmy(): boolean {
    return this.draft.mode === "invade";
  }

  /**
   * A tap at tile (x, y) (fractions kept): true when the navy or the air
   * layer took it. `radius`: the tap's reach in tiles (24 px). With an
   * army chosen (`armyChosen`) a region tap is the army's: only my fleet
   * tokens and a landing's taps are taken.
   */
  handleTap(
    x: number,
    y: number,
    radius = 24 / Math.max(1e-6, this.zoom()),
    armyChosen = false,
  ): boolean {
    if (this.myId() === null) return false;
    const ctx = navyCtx(this.game);
    if (ctx === null) return false;
    const d = this.draft;
    const sel = this.selection;
    if (d.mode === "invade") {
      this.invadeTap(ctx, x, y);
      return true;
    }
    if (sel.fleet !== 0) {
      const f = ctx.navy.fleets.get(sel.fleet);
      if (f === undefined || f.owner !== ctx.me) this.selectFleet(0);
    }
    if (sel.fleet !== 0 && d.mode !== "none") {
      this.modeTap(ctx, x, y, radius);
      return true;
    }
    // A fleet token: mine is chosen (enemies' are only drawn).
    const hit = this.fleetAt(ctx, x, y);
    if (hit !== 0 && ctx.navy.fleets.get(hit)?.owner === ctx.me) {
      this.selectFleet(hit);
      return true;
    }
    if (armyChosen) return false;
    if (sel.layer === "air") {
      const sr = this.srAt(ctx, x, y);
      if (sr !== 0) {
        this.selectZone(sr === sel.sr ? 0 : sr);
        return true;
      }
    }
    if (sel.fleet !== 0) {
      this.selectFleet(0);
      return true;
    }
    if (sel.sr !== 0) {
      this.selectZone(0);
      return false;
    }
    return false;
  }

  private fleetAt(ctx: NavyCtx, x: number, y: number): number {
    const slots = this.deps.layout(
      ctx.navy,
      this.game.ticks(),
      0,
      Math.max(1e-6, this.zoom()),
    );
    return this.deps.hit(slots, x, y);
  }

  private idAt(ctx: NavyCtx, x: number, y: number): number {
    const s = ctx.scenario;
    const ty = Math.floor(y);
    let tx = Math.floor(x) % s.width;
    if (tx < 0) tx += s.width;
    if (ty < 0 || ty >= s.height) return 0;
    return s.regionAt(ty * s.width + tx);
  }

  /** The strategic region under a tile (a sea zone's, or a land region's). */
  private srAt(ctx: NavyCtx, x: number, y: number): number {
    const id = this.idAt(ctx, x, y);
    return id === 0 ? 0 : ctx.scenario.srOfZoneOrRegion(id);
  }

  private zoneAt(ctx: NavyCtx, x: number, y: number): number {
    const id = this.idAt(ctx, x, y);
    return id > SEA_ZONE_BASE && !ctx.scenario.isLake(id) ? id : 0;
  }

  private regionAt(ctx: NavyCtx, x: number, y: number): number {
    const id = this.idAt(ctx, x, y);
    return ctx.scenario.region(id) === undefined ? 0 : id;
  }

  /** The first tap of a target previews it; the same again (not a double tap) gives the order. */
  private targetTap(target: number, order: () => WwOrder | null): void {
    const d = this.draft;
    const now = this.deps.now();
    if (d.pending !== target) {
      d.pending = target;
      d.pendingAt = now;
      this.changed();
      return;
    }
    if (now - d.pendingAt < TWO_TAP_MIN_MS) return;
    const o = order();
    // Refused: the card shows why (the same judge); the preview stays.
    if (o === null) return;
    this.eventBus.emit(new SendWwOrderIntentEvent(o));
    d.mode = "none";
    d.pending = 0;
    this.changed();
  }

  private modeTap(ctx: NavyCtx, x: number, y: number, radius: number): void {
    void radius;
    const d = this.draft;
    const f = ctx.navy.fleets.get(this.selection.fleet)!;
    switch (d.mode) {
      case "mission": {
        const sr = this.srAt(ctx, x, y);
        if (!missionCandidates(ctx, f, d.mission).includes(sr)) {
          return this.cancel();
        }
        return this.targetTap(sr, () => ({
          kind: "fleet_mission",
          fleet: f.id,
          mission: d.mission,
          sr,
        }));
      }
      case "move": {
        const zone = this.zoneAt(ctx, x, y);
        if (zone === 0 || moveTarget(ctx, f, zone).km === null) {
          return this.cancel();
        }
        return this.targetTap(zone, () => ({
          kind: "fleet_move",
          fleet: f.id,
          zone,
        }));
      }
      case "port_strike": {
        const region = this.regionAt(ctx, x, y);
        if (!portStrikeTargets(ctx, f).includes(region)) return this.cancel();
        return this.targetTap(region, () => ({
          kind: "fleet_port_strike",
          fleet: f.id,
          port: region,
        }));
      }
      case "merge": {
        const into = this.fleetAt(ctx, x, y);
        if (!mergeTargets(ctx, f).includes(into)) return this.cancel();
        this.eventBus.emit(
          new SendWwOrderIntentEvent({
            kind: "fleet_merge",
            fleet: f.id,
            into,
          }),
        );
        d.mode = "none";
        d.pending = 0;
        // The merged fleet is gone: the card follows the one it joined.
        this.selectFleet(into);
        return;
      }
      default:
        return this.cancel();
    }
  }

  private invadeTap(ctx: NavyCtx, x: number, y: number): void {
    const d = this.draft;
    const region = this.regionAt(ctx, x, y);
    if (!invasionTargets(ctx, d.army).includes(region)) return this.cancel();
    this.targetTap(region, () =>
      invasionPreview(ctx, d.army, region)?.block === null
        ? { kind: "army_invade", army: d.army, target: region }
        : null,
    );
  }

  /** Elsewhere: the preview, else the mode, goes. */
  private cancel(): void {
    const d = this.draft;
    if (d.pending !== 0) d.pending = 0;
    else d.mode = "none";
    this.changed();
  }

  setMode(mode: SeaAirMode, mission: FleetMission = "patrol", army = 0): void {
    const d = this.draft;
    d.mode = mode;
    d.mission = mission;
    d.army = mode === "invade" ? army : 0;
    d.pending = 0;
    if (mode !== "none" && mode !== "invade") this.selection.setTapMode(mode);
    this.changed();
  }

  selectFleet(fleet: number): void {
    const sel = this.selection;
    const d = this.draft;
    if (fleet === 0 && sel.fleet === 0) return;
    if (sel.fleet === fleet) {
      // The same token again: the card stays; any mode ends.
      if (d.mode !== "none") this.setMode("none");
      return;
    }
    sel.selectFleet(fleet);
    if (d.mode !== "invade") {
      d.mode = "none";
      d.pending = 0;
    }
    // One card at a time: a fleet hides the zone's card and the army's.
    if (fleet !== 0 && sel.sr !== 0) sel.selectZone(0);
    if (fleet !== 0) this.dropArmy();
    this.unregisterBack?.();
    this.unregisterBack = null;
    if (fleet !== 0) {
      this.unregisterBack = registerBackClosable(() => {
        if (this.selection.fleet === 0) return false;
        this.selectFleet(0);
        return true;
      });
    }
    this.changed();
  }

  selectZone(sr: number): void {
    const sel = this.selection;
    if (sel.sr === sr) return;
    sel.selectZone(sr);
    if (sr !== 0 && sel.fleet !== 0) this.selectFleet(0);
    if (sr !== 0) this.dropArmy();
    this.changed();
  }

  /** The army card gives way (not while a landing's taps keep the army). */
  private dropArmy(): void {
    if (this.draft.mode === "invade") return;
    if (landSelectionOf(this.game).army !== null) {
      this.eventBus.emit(new WwSelectArmyEvent(null));
    }
  }

  setLayer(layer: SeaAirSelection["layer"]): void {
    if (this.selection.layer === layer) return;
    this.selection.setLayer(layer);
    if (layer !== "air" && this.selection.sr !== 0)
      this.selection.selectZone(0);
    this.changed();
  }

  private changed(): void {
    this.draft.version++;
    this.eventBus.emit(new WwSeaAirChangedEvent());
  }
}
