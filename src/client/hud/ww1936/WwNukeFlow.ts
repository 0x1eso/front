// World War 1936 P6 lane U4 (plan Task 13 Step 3, spec §20.9): the bomb,
// rocket and precision-raid flows as one state machine.
//   bomb:   [Drop the bomb] (zone card) → an enemy region glows → tap it
//           (the preview) → tap it again → [Confirm drop] (two taps):
//           four taps and a confirmation;
//   rocket: WwStrikeFlowEvent("rocket", site) → regions in reach glow → tap
//           one → kind and count steppers → [Launch];
//   raid:   [Precision raid] on a bomber deployment → an enemy region glows
//           → tap it → the building chips → [Raid] (two taps).
// A region on the no-strike list (Korea, Taiwan) never glows and is never
// taken (DepthIndustryModel.strikeTargets).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { ROCKET_KINDS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { RAID_TARGETS } from "@openfront/engine-lib/ww1936/ProjectRules";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import type { GameView } from "../../view/GameView";
import { WwStrikeFlowEvent } from "./DepthEvents";
import {
  DepthIndustryModel,
  NukePreview,
  offered,
  StrikeTargetRow,
} from "./DepthIndustryModel";
import { TWO_TAP_MIN_MS, TwoTap, wwActive } from "./WorldWarModel";

export type StrikeFlowKind = "nuke" | "rocket" | "raid_bomb";
export type StrikeStep =
  | "idle"
  /** Targets glow; nothing chosen. */
  | "target"
  /** Bomb: a region tapped once, its preview shows. */
  | "preview"
  /** Bomb: tapped twice, [Confirm drop] shows. */
  | "ready"
  /** Rocket and raid: the target is chosen; the steppers or chips show. */
  | "setup";

/** The flow changed: the cards redraw. */
export class WwStrikeFlowChangedEvent implements GameEvent {}

const MAX_ROCKETS = 30;

export class StrikeFlowState {
  kind: StrikeFlowKind | null = null;
  step: StrikeStep = "idle";
  /** Bomb: the air zone; rocket: the launch site; raid: the deployment. */
  from = 0;
  region = 0;
  /** Taps spent on the bomb flow (the button, the region twice, the first tap of the confirm). */
  taps = 0;
  /** Rocket: index into ROCKET_KINDS. */
  rocket: 0 | 1 = 0;
  count = 1;
  building: BuildingId | null = null;
  pendingAt = 0;
  version = 0;
}

const states = new WeakMap<object, StrikeFlowState>();

/** One flow per game view (the zone card, the map taps and the strike pass read it). */
export function strikeFlowOf(game: object): StrikeFlowState {
  let s = states.get(game);
  if (s === undefined) {
    s = new StrikeFlowState();
    states.set(game, s);
  }
  return s;
}

/** What glows on the map now: the shape seaAirGlow returns. */
export interface StrikeGlow {
  kind: "land";
  ids: number[];
}

const controllers = new WeakMap<object, WwNukeFlow>();

/** The game's flow controller; made on first ask when GameRenderer has not (a card used alone). */
export function ensureNukeFlow(game: GameView, eventBus: EventBus): WwNukeFlow {
  let c = controllers.get(game);
  if (c === undefined) {
    c = new WwNukeFlow(game, eventBus);
    c.init();
  }
  return c;
}

export class WwNukeFlow implements Controller {
  readonly state: StrikeFlowState;
  private readonly model: DepthIndustryModel;
  private readonly twoTap = new TwoTap();

  constructor(
    private readonly game: GameView,
    private readonly eventBus: EventBus,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.state = strikeFlowOf(game);
    this.model = new DepthIndustryModel(game);
    controllers.set(game, this);
  }

  init() {
    this.eventBus.on(WwStrikeFlowEvent, (e) => {
      if (e.kind === "nuke" || e.kind === "rocket" || e.kind === "raid_bomb") {
        this.start(e.kind, e.from);
      }
    });
  }

  // ---- state ----

  private changed() {
    this.state.version++;
    this.eventBus.emit(new WwStrikeFlowChangedEvent());
  }

  private myId(): number | null {
    const me = this.game.myPlayer();
    if (me === null || this.game.worldWarScenario() === null) return null;
    return wwActive(this.game, me.smallID()) ? me.smallID() : null;
  }

  /** The regions the flow offers for the next tap. */
  targetRows(): StrikeTargetRow[] {
    const s = this.state;
    switch (s.kind) {
      case "nuke":
        return this.model.zoneTargets(s.from);
      case "rocket":
        return this.model.rocketTargets(s.from, s.rocket);
      case "raid_bomb": {
        const d = this.game.wwAir?.()?.deployments.get(s.from);
        return d === undefined ? [] : this.model.zoneTargets(d.sr);
      }
      default:
        return [];
    }
  }

  targets(): number[] {
    return offered(this.targetRows());
  }

  /** The buildings a raid may name in the chosen region (they must stand there). */
  raidBuildings(): BuildingId[] {
    const eco = this.game.wwEconomy?.();
    if (eco === null || eco === undefined || this.state.region === 0) return [];
    return RAID_TARGETS.raid_bomb.filter(
      (b) => eco.effectiveBuildings(b, this.state.region) > 0,
    );
  }

  preview(): NukePreview | null {
    return this.state.region === 0 || this.state.kind !== "nuke"
      ? null
      : this.model.nukePreview(this.state.region);
  }

  // ---- steps ----

  /** Starts a flow; false when it may not (the card shows why). */
  start(kind: StrikeFlowKind, from: number): boolean {
    if (this.myId() === null) return false;
    const s = this.state;
    if (kind === "nuke" && this.model.nukeStartBlock(from) !== null) {
      return false;
    }
    s.kind = kind;
    s.from = from;
    s.region = 0;
    s.step = "target";
    s.taps = kind === "nuke" ? 1 : 0;
    s.count = 1;
    s.building = null;
    if (kind === "rocket") {
      const [flying, ballistic] = this.model.rocketStock();
      s.rocket = flying <= 0 && ballistic > 0 ? 1 : 0;
    }
    this.twoTap.tap("reset", 0);
    this.changed();
    return true;
  }

  cancel() {
    const s = this.state;
    if (s.step === "idle") return;
    s.kind = null;
    s.step = "idle";
    s.region = 0;
    s.taps = 0;
    this.changed();
  }

  /** A tap on a region; true when the flow took it. */
  tapRegion(region: number): boolean {
    const s = this.state;
    if (s.step === "idle" || this.myId() === null) return false;
    const ok = this.targets().includes(region);
    if (!ok) {
      // Elsewhere: the preview goes first, then the flow itself.
      if (s.step === "preview" || s.step === "ready" || s.step === "setup") {
        s.step = "target";
        s.region = 0;
        this.changed();
        return true;
      }
      this.cancel();
      return false;
    }
    const now = this.now();
    if (s.kind === "nuke") {
      if (s.region !== region || s.step === "target") {
        s.region = region;
        s.step = "preview";
        s.pendingAt = now;
        s.taps = 2;
        this.changed();
        return true;
      }
      if (s.step === "preview" && now - s.pendingAt >= TWO_TAP_MIN_MS) {
        s.step = "ready";
        s.taps = 3;
        this.changed();
      }
      return true;
    }
    s.region = region;
    s.step = "setup";
    if (s.kind === "raid_bomb") s.building = this.raidBuildings()[0] ?? null;
    this.changed();
    return true;
  }

  /** A map tap at tile (x, y); true when the flow took it. */
  handleTap(x: number, y: number): boolean {
    if (this.state.step === "idle") return false;
    const sc = this.game.worldWarScenario();
    if (sc === null) return false;
    const ty = Math.floor(y);
    let tx = Math.floor(x) % sc.width;
    if (tx < 0) tx += sc.width;
    if (ty < 0 || ty >= sc.height) return false;
    const id = sc.regionAt(ty * sc.width + tx);
    return this.tapRegion(sc.region(id) === undefined ? 0 : id);
  }

  glow(): StrikeGlow | null {
    const s = this.state;
    if (s.step === "idle") return null;
    return {
      kind: "land",
      ids: s.region !== 0 ? [s.region] : this.targets(),
    };
  }

  // ---- bomb ----

  confirmKey(): string {
    return `nuke:${this.state.region}`;
  }

  confirmArmed(): boolean {
    return this.twoTap.isArmed(this.confirmKey(), this.now());
  }

  /** [Confirm drop]: the first tap arms (the fourth tap), the second sends. */
  confirmDrop(): boolean {
    const s = this.state;
    if (s.kind !== "nuke" || s.step !== "ready") return false;
    const blocked = this.model.nukePreview(s.region)?.blocked ?? null;
    if (blocked !== null) return false;
    if (!this.twoTap.tap(this.confirmKey(), this.now())) {
      s.taps = 4;
      this.changed();
      return false;
    }
    this.send({ kind: "nuke_drop", region: s.region, rocket: false });
    this.cancel();
    return true;
  }

  // ---- rocket ----

  setRocketKind(kind: 0 | 1) {
    this.state.rocket = kind;
    this.state.count = Math.max(1, Math.min(this.state.count, this.maxCount()));
    this.changed();
  }

  maxCount(): number {
    const stock = this.model.rocketStock()[this.state.rocket];
    return Math.max(0, Math.min(MAX_ROCKETS, stock));
  }

  setCount(n: number) {
    this.state.count = Math.max(1, Math.min(Math.max(1, this.maxCount()), n));
    this.changed();
  }

  fire(): boolean {
    const s = this.state;
    if (s.kind !== "rocket" || s.step !== "setup" || s.region === 0) {
      return false;
    }
    if (this.maxCount() <= 0) return false;
    this.send({
      kind: "rocket_strike",
      site: s.from,
      target: s.region,
      rocket: ROCKET_KINDS[s.rocket],
      count: Math.max(1, Math.min(s.count, this.maxCount())),
    });
    this.cancel();
    return true;
  }

  // ---- raid ----

  setBuilding(b: BuildingId) {
    this.state.building = b;
    this.changed();
  }

  raidKey(): string {
    return `raid:${this.state.region}:${this.state.building}`;
  }

  raidArmed(): boolean {
    return this.twoTap.isArmed(this.raidKey(), this.now());
  }

  /** [Raid]: two taps. */
  confirmRaid(): boolean {
    const s = this.state;
    if (s.kind !== "raid_bomb" || s.step !== "setup" || s.building === null) {
      return false;
    }
    if (!this.twoTap.tap(this.raidKey(), this.now())) {
      this.changed();
      return false;
    }
    this.send({
      kind: "raid",
      raid: "raid_bomb",
      unit: s.from,
      target: s.region,
      building: s.building,
    });
    this.cancel();
    return true;
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }
}
