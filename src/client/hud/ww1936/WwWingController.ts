// World War 1936 ww8 (lane G, design §8.1, §8.5): the wing orders' map taps.
// With wings chosen and a mode on, the land flow asks this first:
//   mission  one tap on the target confirms (a reversible order): an enemy
//            or own region, a sea zone, or my army's token (follow);
//   base     two taps: the first previews, the same base again ferries;
//   field    two taps on an own region: a field strip is laid.
// A tap that hits nothing ends the mode (then the choice). Back does the same.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WING_MAX_PER_ORDER } from "@openfront/engine-api/ww1936/AirTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { hitToken, layoutTokens } from "../../view/LandTokenLayout";
import type { WingFocus, WingSlot } from "../../view/WingTokenLayout";
import { landSelectionOf, WwSelectArmyEvent } from "./LandSelection";
import { NavyCtx, navyCtx, NavyGame } from "./NavyModel";
import {
  WwAirZoneSelectedEvent,
  WwFleetSelectedEvent,
} from "./SeaAirSelection";
import {
  baseBlock,
  baseCandidates,
  chosenWings,
  missionOrder,
  OrderDraft,
  targetCandidates,
} from "./WingModel";
import {
  WingUi,
  wingUiOf,
  WwSelectWingsEvent,
  WwWingChangedEvent,
} from "./WingUi";
import { TWO_TAP_MIN_MS } from "./WorldWarModel";
import type { SeaAirGlow } from "./WwSeaAirController";

/** The regions or sea regions that glow for the chosen mode (the render lane draws them). */
export function wingGlow(game: NavyGame): SeaAirGlow | null {
  const ui = wingUiOf(game);
  if (ui.mode === "none") return null;
  const ctx = navyCtx(game);
  if (ctx === null) return null;
  const wings = chosenWings(ctx, ui);
  if (ui.mode === "base") {
    return { kind: "land", ids: baseCandidates(ctx, wings) };
  }
  if (ui.mode === "mission") {
    const chip = { mission: ui.mission, cls: ui.cls };
    return targetCandidates(ctx, wings, chip);
  }
  return null;
}

export function wingFocus(game: NavyGame): WingFocus {
  const ui = wingUiOf(game);
  const ctx = navyCtx(game);
  const wings = ctx === null ? [] : chosenWings(ctx, ui);
  const first = wings[0];
  let range: WingFocus["range"] = null;
  if (first !== undefined && first.rangeKm > 0) {
    if (ui.mode === "base" && ui.pending !== 0) {
      range = { base: ui.pending, rangeKm: first.rangeKm };
    } else if (first.base > 0 && ui.mode !== "field") {
      range = { base: first.base, rangeKm: first.rangeKm };
    }
  }
  return { chosen: new Set(ui.ids), expanded: ui.expanded, range };
}

export class WwWingController implements Controller {
  private unregisterBack: (() => void) | null = null;

  constructor(
    private readonly game: NavyGame,
    private readonly eventBus: EventBus,
    private readonly zoom: () => number = () => 1,
    private readonly now: () => number = () => Date.now(),
    /** The renderer's pickWing and setWingFocus. */
    private readonly pick:
      | ((x: number, y: number) => WingSlot | null)
      | null = null,
    private readonly setFocus: ((f: WingFocus) => void) | null = null,
  ) {}

  get ui(): WingUi {
    return wingUiOf(this.game);
  }

  init() {
    this.eventBus.on(WwSelectWingsEvent, (e) => {
      this.ui.select(e.ids, e.add);
      this.sync(true);
    });
    this.eventBus.on(WwWingChangedEvent, () => {
      this.sync(false);
      this.setFocus?.(wingFocus(this.game));
    });
    // One card at a time: another selection drops the wings.
    this.eventBus.on(WwSelectArmyEvent, (e) => {
      if (e.army !== null && this.ui.mode !== "mission") this.drop();
    });
    this.eventBus.on(WwFleetSelectedEvent, (e) => {
      if (e.fleet !== 0) this.drop();
    });
    this.eventBus.on(WwAirZoneSelectedEvent, (e) => {
      if (e.sr !== 0) this.drop();
    });
  }

  private drop(): void {
    if (this.ui.ids.length === 0 && this.ui.mode === "none") return;
    this.ui.clear();
    this.sync(false);
  }

  /** Back closes the mode, then the choice. */
  private sync(changed: boolean): void {
    const ui = this.ui;
    this.unregisterBack?.();
    this.unregisterBack = null;
    if (ui.ids.length > 0 || ui.mode !== "none") {
      this.unregisterBack = registerBackClosable(() => {
        if (ui.mode !== "none") ui.reset();
        else if (ui.ids.length > 0) ui.clear();
        else return false;
        this.eventBus.emit(new WwWingChangedEvent());
        return true;
      });
    }
    if (changed) {
      // Choosing wings hides the army, fleet and zone cards.
      if (landSelectionOf(this.game).army !== null) {
        this.eventBus.emit(new WwSelectArmyEvent(null));
      }
      this.eventBus.emit(new WwFleetSelectedEvent(0));
      this.eventBus.emit(new WwAirZoneSelectedEvent(0));
      this.eventBus.emit(new WwWingChangedEvent());
    }
  }

  private idAt(ctx: NavyCtx, x: number, y: number): number {
    const s = ctx.scenario;
    const ty = Math.floor(y);
    let tx = Math.floor(x) % s.width;
    if (tx < 0) tx += s.width;
    if (ty < 0 || ty >= s.height) return 0;
    return s.regionAt(ty * s.width + tx);
  }

  /** True when this controller took the tap (a mode is on). */
  handleTap(
    x: number,
    y: number,
    radius = 24 / Math.max(1e-6, this.zoom()),
  ): boolean {
    const ui = this.ui;
    if (
      ui.mode === "none" ||
      ui.ids.length + (ui.mode === "field" ? 1 : 0) === 0
    ) {
      return false;
    }
    const ctx = navyCtx(this.game);
    if (ctx === null) return false;
    const wings = chosenWings(ctx, ui);
    if (wings.length === 0 && ui.mode !== "field") {
      ui.clear();
      this.changed();
      return true;
    }
    switch (ui.mode) {
      case "mission":
        this.missionTap(ctx, wings, x, y, radius);
        return true;
      case "base":
        this.baseTap(ctx, wings, this.idAt(ctx, x, y));
        return true;
      case "field":
        this.fieldTap(ctx, this.idAt(ctx, x, y));
        return true;
      default:
        return false;
    }
  }

  /** A tap on a wing token selects it; on a chip it opens the fan. */
  private tokenTap(x: number, y: number): boolean {
    const slot = this.pick?.(x, y) ?? null;
    const ctx = navyCtx(this.game);
    if (slot === null || ctx === null || slot.owner !== ctx.me) return false;
    const ui = this.ui;
    if (slot.kind === 0) {
      this.eventBus.emit(new WwSelectWingsEvent([slot.wing], false));
      return true;
    }
    if (ui.expanded.has(slot.base)) ui.expanded.delete(slot.base);
    else ui.expanded.add(slot.base);
    this.changed();
    return true;
  }

  private changed(): void {
    this.ui.bump();
    this.eventBus.emit(new WwWingChangedEvent());
  }

  private send(o: WwOrder): void {
    this.eventBus.emit(new SendWwOrderIntentEvent(o));
  }

  private cancel(): void {
    const ui = this.ui;
    if (ui.pending !== 0) ui.pending = 0;
    else ui.reset();
    this.changed();
  }

  private missionTap(
    ctx: NavyCtx,
    wings: ReturnType<typeof chosenWings>,
    x: number,
    y: number,
    radius: number,
  ): void {
    const ui = this.ui;
    const mission = ui.mission;
    let target = 0;
    let army = 0;
    // An army token of mine: follow (close support, air supply).
    if (ctx.land !== null && (mission === "cas" || mission === "air_supply")) {
      const mine = layoutTokens(
        ctx.land,
        this.game.ticks(),
        Math.max(1e-6, this.zoom()),
      ).filter((p) => ctx.land!.armies.get(p.army)?.owner === ctx.me);
      const hit = hitToken(mine, x, y, radius, null);
      if (hit !== null) army = hit;
    }
    if (army === 0) {
      target = this.idAt(ctx, x, y);
      if (target === 0) return this.cancel();
      if (target < SEA_ZONE_BASE && ctx.scenario.region(target) === undefined) {
        return this.cancel();
      }
    }
    const draft: OrderDraft = {
      mission,
      target,
      army,
      escort: 0,
      cls: ui.cls,
    };
    const r = missionOrder(ctx, wings, draft);
    if (r.order === null) {
      ui.refused = r.blocked ?? "bad_air_mission";
      this.changed();
      return;
    }
    this.send(r.order);
    ui.reset();
    ui.refused = "";
    this.changed();
  }

  private baseTap(
    ctx: NavyCtx,
    wings: ReturnType<typeof chosenWings>,
    region: number,
  ): void {
    const ui = this.ui;
    const ok = wings.filter((w) => baseBlock(ctx, w, region) === null);
    if (region === 0 || ok.length === 0) {
      const first = wings.find((w) => w.base !== region);
      if (region !== 0 && first !== undefined) {
        ui.refused = baseBlock(ctx, first, region) ?? "no_air_base";
        this.changed();
        return;
      }
      return this.cancel();
    }
    if (ui.pending !== region) {
      ui.pending = region;
      ui.pendingAt = this.now();
      ui.refused = "";
      this.changed();
      return;
    }
    if (this.now() - ui.pendingAt < TWO_TAP_MIN_MS) return;
    this.send({
      kind: "wing_base",
      wings: ok.map((w) => w.id).slice(0, WING_MAX_PER_ORDER),
      base: region,
    });
    ui.reset();
    this.changed();
  }

  private fieldTap(ctx: NavyCtx, region: number): void {
    const ui = this.ui;
    const c = ctx.economy.controller[region] ?? 0;
    if (
      region === 0 ||
      ctx.scenario.region(region) === undefined ||
      c !== ctx.me
    ) {
      return this.cancel();
    }
    if (ui.pending !== region) {
      ui.pending = region;
      ui.pendingAt = this.now();
      this.changed();
      return;
    }
    if (this.now() - ui.pendingAt < TWO_TAP_MIN_MS) return;
    this.send({ kind: "air_field", region });
    ui.reset();
    this.changed();
  }
}
