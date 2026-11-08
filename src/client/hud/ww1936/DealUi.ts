// World War 1936 diplomacy (ww161 Design B §7; ww162 lane L6): the
// client's draft of one diplomacy offer — a deal (two columns of items), an
// ultimatum or a collaboration government (both a list of regions) — and
// its map pick. While the composer is open the map's land taps go to it
// (LinePeaceModel.linePeaceMapTap asks dealMapTap first) and PeaceMapPass
// tints the regions it can take (linePeaceMapSource asks dealMapRegions).
import {
  WW_COLLAB_MAX_REGIONS,
  WW_DEAL_MAX_ITEMS,
  WW_ULT_MAX_REGIONS,
  type DealItem,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  PEACE_FREE,
  PEACE_MINE,
  PEACE_SELECTED,
  type PeaceMapRegion,
} from "../../render/gl/passes/PeaceMapPass";
import { translateText } from "../../Utils";
import { BLOCK_KEYS } from "./EconomyModel";
import { negPeaceFactsOf, type NegPeaceGame } from "./NegPeaceModel";
import { peaceColor, peaceRegionName } from "./PeaceModel";

export type DealMode = "deal" | "ultimatum" | "collab";
export type DealSide = "give" | "take";

/** An item kind's form while its numbers are being chosen (equipment, lend-lease, licence, promise, join war). */
export interface DealForm {
  side: DealSide;
  kind: DealItem["kind"];
  /** Equipment type or "fuel" (lend-lease); "" before one is picked. */
  item: string;
  gen: number;
  count: number;
  months: number;
  /** Promise / join war: the enemy country and the war; promise: the region group. */
  target: number;
  war: number;
  group: string;
}

export class DealUi {
  /** What is being composed (null: the composer is closed). */
  mode: DealMode | null = null;
  /** The country it goes to. */
  to = 0;
  give: DealItem[] = [];
  take: DealItem[] = [];
  /** Ultimatum and collaboration government: the regions. */
  regions: number[] = [];
  /** The "+ 추가" list open under this column (null: none). */
  adding: DealSide | null = null;
  form: DealForm | null = null;
  /** The region tapped last on the map (0: none) and why it was refused (null: it wasn't). */
  region = 0;
  note: string | null = null;
  /** Bumped on every change (the composer and the map redraw on it). */
  version = 0;

  /** The map's land taps go to the composer while it is open. */
  get map(): boolean {
    return this.mode !== null;
  }

  open(
    mode: DealMode,
    to: number,
    init: {
      give?: DealItem[];
      take?: DealItem[];
      regions?: number[];
    } = {},
  ): void {
    this.mode = mode;
    this.to = to;
    this.give = [...(init.give ?? [])];
    this.take = [...(init.take ?? [])];
    this.regions = [...(init.regions ?? [])];
    this.adding = null;
    this.form = null;
    this.region = 0;
    this.note = null;
    this.version++;
  }

  close(): void {
    if (this.mode === null) return;
    this.mode = null;
    this.to = 0;
    this.give = [];
    this.take = [];
    this.regions = [];
    this.adding = null;
    this.form = null;
    this.region = 0;
    this.note = null;
    this.version++;
  }

  list(side: DealSide): DealItem[] {
    return side === "give" ? this.give : this.take;
  }

  /** Adds `item` to `side` (false: the column is full). */
  add(side: DealSide, item: DealItem): boolean {
    const l = this.list(side);
    if (l.length >= WW_DEAL_MAX_ITEMS) return false;
    l.push(item);
    this.adding = null;
    this.form = null;
    this.version++;
    return true;
  }

  removeAt(side: DealSide, index: number): void {
    const l = this.list(side);
    if (index < 0 || index >= l.length) return;
    l.splice(index, 1);
    this.version++;
  }

  removeRegion(region: number): void {
    this.regions = this.regions.filter((r) => r !== region);
    this.version++;
  }

  toggleAdding(side: DealSide): void {
    this.adding = this.adding === side ? null : side;
    this.form = null;
    this.version++;
  }

  setForm(form: DealForm | null): void {
    this.form = form;
    this.version++;
  }

  bump(): void {
    this.version++;
  }
}

const uis = new WeakMap<object, DealUi>();
/** One diplomacy draft per game view. */
export function dealUiOf(game: object): DealUi {
  let u = uis.get(game);
  if (u === undefined) uis.set(game, (u = new DealUi()));
  return u;
}

function blockText(block: keyof typeof BLOCK_KEYS): string {
  return translateText(BLOCK_KEYS[block]);
}

/**
 * `me` and `to` fight on the same side of an ongoing war: a region either
 * of them only controls may change hands then (the ally-to-ally transfer).
 */
export function sameWarSide(
  game: NegPeaceGame,
  me: number,
  to: number,
): boolean {
  for (const w of game.wwEndgame?.()?.wars ?? []) {
    if (w.ended) continue;
    for (const s of w.sides) {
      const ids = s.members.map((m) => m.id);
      if (ids.includes(me) && ids.includes(to)) return true;
    }
  }
  return false;
}

/**
 * Who would give `region` in a deal between `me` and `to`: its legal owner
 * when that is one of us; between allies at war, also the one that only
 * controls it. 0: neither of us.
 */
export function dealRegionGiver(
  game: NegPeaceGame,
  me: number,
  to: number,
  region: number,
): number {
  const f = negPeaceFactsOf(game);
  if (f === null) return 0;
  const legal = f.legalOwner(region);
  if (legal === me || legal === to) return legal;
  if (sameWarSide(game, me, to)) {
    const c = f.controller(region);
    if (c === me || c === to) return c;
  }
  return 0;
}

/**
 * The land tap flow asks this first while the composer is open: a deal
 * toggles the region in the giver's column (mine: "I give"; theirs: "I
 * get"); an ultimatum or a collaboration government toggles it in the
 * list when it is the target's legal land. The capital is refused with
 * its reason. False when no composer is open.
 */
export function dealMapTap(game: NegPeaceGame, region: number): boolean {
  const ui = dealUiOf(game);
  if (ui.mode === null) return false;
  const me = game.myPlayer()?.smallID() ?? 0;
  const f = negPeaceFactsOf(game);
  if (f === null || me <= 0) {
    ui.close();
    return false;
  }
  ui.region = Math.max(0, region);
  ui.note = null;
  if (region <= 0) {
    ui.bump();
    return true;
  }
  if (ui.mode === "deal") {
    const giver = dealRegionGiver(game, me, ui.to, region);
    if (giver === 0) {
      ui.bump();
      return true;
    }
    const side: DealSide = giver === me ? "give" : "take";
    const l = ui.list(side);
    const at = l.findIndex((x) => x.kind === "region" && x.region === region);
    if (at >= 0) {
      ui.removeAt(side, at);
      return true;
    }
    if (f.capital(giver) === region) {
      ui.note = blockText("deal_bad_item");
      ui.bump();
      return true;
    }
    if (!ui.add(side, { kind: "region", region })) {
      ui.note = translateText("ww1936.deal.full", { n: WW_DEAL_MAX_ITEMS });
      ui.bump();
    }
    return true;
  }
  // Ultimatum, collaboration government: the target's legal land.
  if (f.legalOwner(region) !== ui.to) {
    ui.bump();
    return true;
  }
  if (ui.regions.includes(region)) {
    ui.removeRegion(region);
    return true;
  }
  if (ui.mode === "ultimatum" && f.capital(ui.to) === region) {
    ui.note = blockText("ultimatum_bad_regions");
    ui.bump();
    return true;
  }
  if (ui.mode === "collab" && f.controller(region) !== me) {
    ui.note = blockText("collab_bad_region");
    ui.bump();
    return true;
  }
  const cap =
    ui.mode === "ultimatum" ? WW_ULT_MAX_REGIONS : WW_COLLAB_MAX_REGIONS;
  if (ui.regions.length >= cap) {
    ui.note = translateText("ww1936.deal.full", { n: cap });
    ui.bump();
    return true;
  }
  ui.regions.push(region);
  ui.bump();
  return true;
}

/**
 * The composer's map: a deal tints both countries' land it may name (the
 * picked regions in the receiver's colour); an ultimatum or a
 * collaboration government tints the target's land (the picked ones in my
 * colour). Empty when no composer is open.
 */
export function dealMapRegions(game: NegPeaceGame): PeaceMapRegion[] {
  const ui = dealUiOf(game);
  const sc = game.worldWarScenario();
  const f = sc === null ? null : negPeaceFactsOf(game);
  const me = game.myPlayer()?.smallID() ?? 0;
  if (ui.mode === null || sc === null || f === null || me <= 0) return [];
  const picked = new Map<number, number>();
  if (ui.mode === "deal") {
    for (const x of ui.give)
      if (x.kind === "region") picked.set(x.region, ui.to);
    for (const x of ui.take) if (x.kind === "region") picked.set(x.region, me);
  } else {
    for (const r of ui.regions) picked.set(r, me);
  }
  const allies = ui.mode === "deal" && sameWarSide(game, me, ui.to);
  const w = sc.width;
  const out: PeaceMapRegion[] = [];
  for (const r of sc.landRegions) {
    const legal = f.legalOwner(r.id);
    let shown: boolean;
    if (ui.mode === "deal") {
      const c = allies ? f.controller(r.id) : 0;
      shown =
        legal === me ||
        legal === ui.to ||
        (allies && (c === me || c === ui.to));
    } else if (ui.mode === "collab") {
      shown = legal === ui.to && f.controller(r.id) === me;
    } else {
      shown = legal === ui.to;
    }
    if (!shown) continue;
    const to = picked.get(r.id);
    let state = to === undefined ? PEACE_FREE : PEACE_MINE;
    if (r.id === ui.region) state |= PEACE_SELECTED;
    const t = sc.centerTile(r.id);
    out.push({
      region: r.id,
      state,
      rgb: to === undefined ? 0xffffff : peaceColor(game, to),
      value: r.vp,
      x: t % w,
      y: Math.floor(t / w),
    });
  }
  return out;
}

/** The last tapped region's name and its refusal (the composer's line under the chips). */
export function dealTapLine(
  game: NegPeaceGame,
): { region: string; note: string | null } | null {
  const ui = dealUiOf(game);
  const sc = game.worldWarScenario();
  if (ui.mode === null || sc === null) return null;
  return {
    region: ui.region > 0 ? peaceRegionName(sc, ui.region) : "",
    note: ui.note,
  };
}
