// World War 1936 P6 lane U1 (spec §20.4): choosing several armies at once
// (a long press on a token), the group-front tap flow's draft, and the
// army group colours the map's token pass draws under a token.
import { WW_GROUP_ARMIES } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwDepthView } from "../../view/WwDepthView";
import type { WwLandView } from "../../view/WwLandView";
import type { WwLandSelection } from "./LandSelection";

/** A press this long on one of my tokens starts the multi-select mode. */
export const MULTI_PRESS_MS = 500;

/** Group number → palette colour (CSS); the token shader holds the same 8. */
export const GROUP_COLORS: readonly string[] = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
];

/** Palette index 1..8 of group `id` (0 for none): numbers wrap round the 8 colours. */
export function groupColorIndex(id: number): number {
  return id <= 0 ? 0 : ((id - 1) % GROUP_COLORS.length) + 1;
}

export function groupColor(id: number): string {
  const i = groupColorIndex(id);
  return i === 0 ? "transparent" : GROUP_COLORS[i - 1];
}

/** The armies chosen at once, and the group whose front the next map taps pick. */
export class WwMultiSelect {
  active = false;
  armies: number[] = [];
  /** Group front flow (the group tab's or the bar's [전선]): its group, the first-tap region. */
  frontGroup: number | null = null;
  pending: number | null = null;
  version = 0;

  start(first: number): void {
    this.active = true;
    this.armies = [first];
    this.frontGroup = null;
    this.pending = null;
    this.version++;
  }

  has(army: number): boolean {
    return this.active && this.armies.includes(army);
  }

  /** Adds or drops an army; false when the group is full (WW_GROUP_ARMIES). Dropping the last ends the mode. */
  toggle(army: number): boolean {
    if (!this.active) return false;
    const i = this.armies.indexOf(army);
    if (i >= 0) {
      this.armies.splice(i, 1);
      if (this.armies.length === 0) this.cancel();
      else this.version++;
      return true;
    }
    if (this.armies.length >= WW_GROUP_ARMIES) return false;
    this.armies.push(army);
    this.version++;
    return true;
  }

  startFront(group: number): void {
    this.frontGroup = group;
    this.pending = null;
    this.version++;
  }

  cancel(): void {
    if (!this.active && this.frontGroup === null) return;
    this.active = false;
    this.armies = [];
    this.frontGroup = null;
    this.pending = null;
    this.version++;
  }
}

const selections = new WeakMap<object, WwMultiSelect>();
/** One multi-select per land selection (the controller, the bar and the token pass share it). */
export function multiSelectOf(selection: WwLandSelection): WwMultiSelect {
  let m = selections.get(selection);
  if (m === undefined) selections.set(selection, (m = new WwMultiSelect()));
  return m;
}

/** army id → group colour index (1..8), synced from the depth view; read by the token pass. */
export class ArmyGroupColors {
  version = 0;
  private readonly map = new Map<number, number>();
  private seenDepth = -1;
  private seenView: WwDepthView | null = null;

  sync(depth: WwDepthView): void {
    if (depth === this.seenView && depth.version === this.seenDepth) return;
    this.seenView = depth;
    this.seenDepth = depth.version;
    this.map.clear();
    for (const g of depth.armyGroups()) {
      const c = groupColorIndex(g.id);
      for (const a of g.armies) this.map.set(a, c);
    }
    this.version++;
  }

  colorOf(army: number): number {
    return this.map.get(army) ?? 0;
  }
}

const colors = new WeakMap<object, ArmyGroupColors>();
export function armyGroupColorsOf(view: WwLandView): ArmyGroupColors {
  let c = colors.get(view);
  if (c === undefined) colors.set(view, (c = new ArmyGroupColors()));
  return c;
}
