// World War 1936 ww8 (lane G, design §8.1, §8.5): the wing orders' map taps.
// With wings chosen and a mode on, the land flow asks this first:
//   mission  one tap on the target confirms (a reversible order): an enemy
//            or own region, a sea zone, or my army's token (follow);
//   base     two taps: the first previews, the same base again ferries;
//   field    two taps on an own region: a field strip is laid.
// A tap that hits nothing ends the mode (then the choice). Back does the same.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { AirGroupView } from "@openfront/engine-api/ww1936/AirTypes";
import { WING_MAX_PER_ORDER } from "@openfront/engine-api/ww1936/AirTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { hitToken, layoutTokens } from "../../view/LandTokenLayout";
import type { WingFocus, WingSlot } from "../../view/WingTokenLayout";
import { SLOT_AIRGROUP, SLOT_TOKEN } from "../../view/WingTokenLayout";
import {
  groupById,
  groupOrder,
  GroupPatch,
  groupRanges,
  shownGroup,
  toggleZone,
  zoneGlow,
} from "./AirGroupModel";
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
  WwSelectGroupEvent,
  WwSelectWingsEvent,
  WwWingChangedEvent,
} from "./WingUi";
import { TWO_TAP_MIN_MS } from "./WorldWarModel";
import type { SeaAirGlow } from "./WwSeaAirController";

/** The air group a slot stands for: a group token, or (zoom 6 up) one of its wings' tokens; 0 none. */
function groupOfSlot(slot: WingSlot): number {
  if (slot.kind === SLOT_AIRGROUP) return slot.wing;
  return slot.kind === SLOT_TOKEN ? (slot.group ?? 0) : 0;
}

/** Screen px within which an army token and an air token count as one pile. */
const OVERLAP_PX = 14;

/** The regions or sea regions that glow for the chosen mode (the render lane draws them). */
export function wingGlow(game: NavyGame): SeaAirGlow | null {
  const ui = wingUiOf(game);
  if (ui.airGroup !== 0 && ui.mode === "none") {
    const c = navyCtx(game);
    const g = c === null ? undefined : groupById(c, ui.airGroup);
    return c === null || g === undefined
      ? null
      : zoneGlow(c, shownGroup(g, ui.draft, Date.now()));
  }
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
  const grp =
    ctx === null || ui.airGroup === 0 ? undefined : groupById(ctx, ui.airGroup);
  if (grp !== undefined && grp.base > 0) {
    const far = Math.max(0, ...groupRanges(grp).map((r) => r.km));
    const near = Math.min(...groupRanges(grp).map((r) => r.km));
    if (far > 0) {
      range = {
        base: grp.base,
        rangeKm: far,
        warning: far * 100 >= near * 150,
      };
    }
  }
  if (first !== undefined && first.rangeKm > 0) {
    if (ui.mode === "base" && ui.pending !== 0) {
      range = { base: ui.pending, rangeKm: first.rangeKm };
    } else if (first.base > 0 && ui.mode !== "field") {
      range = { base: first.base, rangeKm: first.rangeKm };
    }
  }
  return {
    group: grp?.id ?? 0,
    chosen: new Set(ui.ids),
    expanded: ui.expanded,
    range,
  };
}

/** Sends the group's order at once and shows it until the view catches up (taps in a row build on it). */
export function sendGroupOrder(
  eventBus: EventBus,
  ui: WingUi,
  g: AirGroupView,
  patch: GroupPatch,
  now = Date.now(),
): void {
  const order = groupOrder(g, patch);
  if (order.kind !== "air_group_order") return;
  eventBus.emit(new SendWwOrderIntentEvent(order));
  ui.groupRefused = "";
  ui.draft = {
    group: g.id,
    zones: [...order.zones],
    priority: order.priority,
    army: order.army ?? 0,
    at: now,
  };
  ui.bump();
  eventBus.emit(new WwWingChangedEvent());
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
    this.eventBus.on(WwSelectGroupEvent, (e) => {
      this.ui.clear();
      this.ui.airGroup = e.group;
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
    if (
      this.ui.ids.length === 0 &&
      this.ui.mode === "none" &&
      this.ui.airGroup === 0 &&
      this.ui.chooser === null
    ) {
      return;
    }
    this.ui.clear();
    this.sync(false);
  }

  /** Back closes the mode, then the choice. */
  private sync(changed: boolean): void {
    const ui = this.ui;
    this.unregisterBack?.();
    this.unregisterBack = null;
    if (
      ui.ids.length > 0 ||
      ui.mode !== "none" ||
      ui.airGroup !== 0 ||
      ui.chooser !== null
    ) {
      this.unregisterBack = registerBackClosable(() => {
        if (ui.chooser !== null) ui.chooser = null;
        else if (ui.mode !== "none") ui.reset();
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
    // w51: a chosen group takes the tap for its zones, its army, another token.
    if (ui.mode === "none" && ui.airGroup !== 0) {
      return this.groupTap(x, y, radius);
    }
    // No order mode: a tap on one of my wing tokens (or a base chip) chooses it.
    if (ui.mode === "none") return this.tokenTap(x, y, radius);
    if (ui.ids.length + (ui.mode === "field" ? 1 : 0) === 0) return false;
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
  private tokenTap(x: number, y: number, radius: number): boolean {
    const slot = this.pick?.(x, y) ?? null;
    const ctx = navyCtx(this.game);
    if (slot === null || ctx === null || slot.owner !== ctx.me) return false;
    const ui = this.ui;
    // w51: an army's token wins the tap; only a token truly on top of an air
    // token (their centres within a token's size) asks which one.
    const army = this.armyAt(ctx, x, y, radius);
    if (army !== null) {
      const overlap = OVERLAP_PX / Math.max(1e-6, this.zoom());
      const d2 =
        (army.x - slot.x) * (army.x - slot.x) +
        (army.y - slot.y) * (army.y - slot.y);
      const group = groupOfSlot(slot);
      if (d2 > overlap * overlap || group === 0) return false;
      ui.chooser = { army: army.army, group };
      this.sync(false);
      this.changed();
      return true;
    }
    if (groupOfSlot(slot) !== 0) {
      this.eventBus.emit(new WwSelectGroupEvent(groupOfSlot(slot)));
      return true;
    }
    if (slot.kind === SLOT_TOKEN) {
      this.eventBus.emit(new WwSelectWingsEvent([slot.wing], false));
      return true;
    }
    if (ui.expanded.has(slot.base)) ui.expanded.delete(slot.base);
    else ui.expanded.add(slot.base);
    this.changed();
    return true;
  }

  /** My army token under the tap (reach `radius` tiles), with its place; null none. */
  private armyAt(
    ctx: NavyCtx,
    x: number,
    y: number,
    radius: number,
  ): { army: number; x: number; y: number } | null {
    if (ctx.land === null) return null;
    const land = ctx.land;
    const mine = layoutTokens(
      land,
      this.game.ticks(),
      Math.max(1e-6, this.zoom()),
    ).filter((p) => land.armies.get(p.army)?.owner === ctx.me);
    const hit = hitToken(mine, x, y, radius, null);
    if (hit === null) return null;
    // ww162: from zoom 6 an army stands as several division counters; its
    // place here is the counter nearest the tap (the one the tap is on).
    let p: (typeof mine)[number] | undefined;
    let best = Infinity;
    for (const q of mine) {
      if (q.army !== hit) continue;
      const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
      if (d < best) {
        best = d;
        p = q;
      }
    }
    return p === undefined ? null : { army: hit, x: p.x, y: p.y };
  }

  /** A tap with a group chosen: another token, my army (follow), or a zone (add or remove). */
  private groupTap(x: number, y: number, radius: number): boolean {
    const ui = this.ui;
    const ctx = navyCtx(this.game);
    const g = ctx === null ? undefined : groupById(ctx, ui.airGroup);
    if (ctx === null || g === undefined) {
      ui.clear();
      this.sync(false);
      this.changed();
      return false;
    }
    const slot = this.pick?.(x, y) ?? null;
    if (slot !== null && slot.owner === ctx.me) {
      const group = groupOfSlot(slot);
      if (group !== 0) {
        if (group === g.id) {
          ui.clear();
          this.sync(false);
          this.changed();
        } else {
          this.eventBus.emit(new WwSelectGroupEvent(group));
        }
        return true;
      }
      this.eventBus.emit(new WwSelectWingsEvent([slot.wing], false));
      return true;
    }
    const now = Date.now();
    const cur = shownGroup(g, ui.draft, now);
    const army = this.armyAt(ctx, x, y, radius);
    if (army !== null) {
      this.sendGroup(g, { zones: [], priority: 0, army: army.army }, now);
      return true;
    }
    if (ui.pickTarget) {
      const region = this.idAt(ctx, x, y);
      ui.pickTarget = false;
      if (region !== 0 && ctx.scenario.region(region) !== undefined) {
        this.sendGroup(g, { target: region }, now);
      } else {
        this.changed();
      }
      return true;
    }
    const sr = this.srAt(ctx, x, y);
    if (sr === 0) return false;
    // The engine's rule: some type reaches the zone from some base of my side.
    const maxKm = Math.max(0, ...groupRanges(g).map((r) => r.km));
    const bases = ctx.air.detail?.bases ?? [];
    const reachable =
      maxKm === 0 ||
      bases.length === 0 ||
      bases.some((b) => ctx.scenario.srKm(b.region, sr) <= maxKm);
    if (!reachable && !g.zones.includes(sr)) {
      ui.groupRefused = "range";
      this.changed();
      return true;
    }
    const edit = toggleZone(
      cur.army !== 0 ? { zones: [], priority: 0 } : cur,
      sr,
    );
    if (edit.blocked !== null) {
      ui.groupRefused = edit.blocked;
      this.changed();
      return true;
    }
    this.sendGroup(
      g,
      { zones: edit.zones, priority: edit.priority, army: 0 },
      now,
    );
    return true;
  }

  private srAt(ctx: NavyCtx, x: number, y: number): number {
    const id = this.idAt(ctx, x, y);
    return id === 0 ? 0 : ctx.scenario.srOfZoneOrRegion(id);
  }

  private sendGroup(
    g: AirGroupView,
    patch: GroupPatch,
    now = Date.now(),
  ): void {
    sendGroupOrder(this.eventBus, this.ui, g, patch, now);
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
