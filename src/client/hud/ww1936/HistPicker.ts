// World War 1936 (ww63): the production pickers of the historical catalogue.
// With the designer off a major picks what to build from its catalogue: this
// file turns the catalogue, the country's design slots (a catalogue entry is
// a slot whose def carries `hist`) and its research into the groups a picker
// lists: name first, a compact stats line from the conversion, and a locked
// entry with the tech it still needs. No Lit here.
import type {
  PlaneDesignStats,
  TankDesignStats,
  WwDesignSlotData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { EquipmentType } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ShipStats } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  histStatsOf,
  type HistStats,
} from "@openfront/engine-lib/ww1936/hist/Convert";
import type { GearStats } from "@openfront/engine-lib/ww1936/hist/ConvertGear";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import {
  histGearChargeMilli,
  histKindOf,
  histOwn,
  histStaticEntry,
  histStaticName,
} from "@openfront/engine-lib/ww1936/hist/Slots";
import {
  HIST_COUNTRIES,
  HIST_TANK_ROLES,
  type HistCountry,
  type HistEntry,
} from "@openfront/engine-lib/ww1936/hist/Types";
import { translateText } from "../../Utils";
import { designerOn, type DesignerFlagGame } from "./DesignerFlag";

/** The catalogue country of a tag (null: a minor, none). */
export function histCountryOfTag(
  tag: string | null | undefined,
): HistCountry | null {
  return tag !== null &&
    tag !== undefined &&
    (HIST_COUNTRIES as readonly string[]).includes(tag)
    ? (tag as HistCountry)
    : null;
}

/** One line of a picker: an entry, its pick target and why it is locked (if it is). */
export interface HistPickItem {
  /** Equipment type to pick: tank_design or plane_design for those, the gear type itself. */
  type: EquipmentType;
  /** Design slot, or the generation of a static gear key. */
  gen: number;
  /** The catalogue entry id. */
  id: string;
  name: string;
  /** The compact stats line. */
  stats: string;
  /** Names of the techs still missing (empty: usable). */
  lack: string[];
  /** A licensed entry of another country. */
  foreign: boolean;
  /** Researched, but the engine has not put it in its slot yet (it does so at the day's turn). */
  pending?: boolean;
}

export interface HistPickGroup {
  id: string;
  label: string;
  items: HistPickItem[];
}

const n1 = (centi: number): string => {
  const v = Math.round(centi / 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const mm = (centi: number): number => Math.round(centi / 100);

/** The compact stats line of an entry: the numbers a player compares. */
export function histStatsLine(e: HistEntry): string {
  const s: HistStats = histStatsOf(e);
  switch (e.family) {
    case "tank": {
      const t = s as TankDesignStats;
      return translateText("ww1936.hist_pick.tank", {
        armor: mm(t.armor),
        pierce: mm(t.pierce),
        speed: n1(t.speedCenti),
        cost: n1(t.costMilli / 10),
        rel: Math.round(t.relPm / 10),
      });
    }
    case "plane": {
      const p = s as PlaneDesignStats;
      const bomb = Math.max(p.ground, p.strategic, p.naval);
      return translateText(
        bomb > 0 ? "ww1936.hist_pick.plane_bomb" : "ww1936.hist_pick.plane",
        {
          atk: n1(p.airAttack),
          def: n1(p.airDefense),
          bomb: n1(bomb),
          speed: p.speed,
          range: p.range,
          cost: n1(p.costMilli / 10),
          rel: Math.round(p.relPm / 10),
        },
      );
    }
    case "ship": {
      const h = s as ShipStats;
      return translateText("ww1936.hist_pick.ship", {
        hp: Math.round(h.hpMilli / 1000),
        gun: n1(Math.max(h.light, h.heavy)),
        armor: n1(h.armor),
        speed: Math.round(h.speedCentiKn / 100),
        cost: h.cost,
      });
    }
    default: {
      const g = s as GearStats;
      return translateText(
        g.pierceCenti > 0
          ? "ww1936.hist_pick.gear_pierce"
          : "ww1936.hist_pick.gear",
        {
          pct: g.statPct,
          pierce: mm(g.pierceCenti),
          cost: n1((histGearChargeMilli(e) ?? g.costMilli) / 10),
        },
      );
    }
  }
}

/** The names of the techs of `e` the country has not researched. */
function lacking(e: HistEntry, researched: ReadonlySet<string>): string[] {
  return e.techs
    .filter((t) => !researched.has(t))
    .map((t) => translateText(`ww1936.tech.${t}`));
}

function itemOf(
  e: HistEntry,
  type: EquipmentType,
  gen: number,
  lack: string[],
  foreign: boolean,
): HistPickItem {
  return {
    type,
    gen,
    id: e.id,
    name: translateText(`ww1936.hist.${e.id}`),
    stats: histStatsLine(e),
    lack,
    foreign,
  };
}

const TANK_ROLE_ORDER: readonly string[] = HIST_TANK_ROLES;

/**
 * Tank groups by role (light, medium, heavy, tank destroyer, self-propelled
 * gun and anti-air): the country's own entries in catalogue order (usable
 * when its slot is filled, else locked with the techs it lacks), then the
 * entries it holds a licence for.
 */
export function histTankGroups(
  country: HistCountry,
  designs: readonly WwDesignSlotData[],
  researched: ReadonlySet<string>,
): HistPickGroup[] {
  return slotGroups(
    country,
    "tank",
    designs,
    researched,
    (e) => (e.family === "tank" ? e.role : null),
    TANK_ROLE_ORDER,
    (r) => translateText(`ww1936.hist_pick.role_${r}`),
    "tank_design",
  );
}

/** Plane groups by air type. */
export function histPlaneGroups(
  country: HistCountry,
  designs: readonly WwDesignSlotData[],
  researched: ReadonlySet<string>,
  typeOrder: readonly string[],
): HistPickGroup[] {
  return slotGroups(
    country,
    "plane",
    designs,
    researched,
    (e) => (e.family === "plane" ? e.type : null),
    typeOrder,
    (t) => translateText(`ww1936.equip.${t}`),
    "plane_design",
  );
}

function slotGroups(
  country: HistCountry,
  kind: "tank" | "plane",
  designs: readonly WwDesignSlotData[],
  researched: ReadonlySet<string>,
  groupOf: (e: HistEntry) => string | null,
  order: readonly string[],
  label: (group: string) => string,
  type: EquipmentType,
): HistPickGroup[] {
  const own = histOwn(country, kind);
  const byGroup = new Map<string, HistPickItem[]>();
  const add = (g: string, it: HistPickItem) => {
    const l = byGroup.get(g);
    if (l === undefined) byGroup.set(g, [it]);
    else l.push(it);
  };
  own.forEach((e, i) => {
    const g = groupOf(e);
    if (g === null) return;
    const slot = i + 1;
    const row = designs.find(
      (d) => d.kind === kind && d.slot === slot && d.def.hist === e.id,
    );
    // A gift before its techs holds the slot but can't be made yet.
    const usable =
      row !== undefined &&
      !row.obsolete &&
      (row.origin === "own" || row.origin === "licensed");
    const it = itemOf(
      e,
      type,
      slot,
      usable ? [] : lacking(e, researched),
      false,
    );
    if (!usable && it.lack.length === 0) it.pending = true;
    add(g, it);
  });
  for (const d of designs) {
    if (d.kind !== kind || d.origin !== "licensed" || d.obsolete) continue;
    if (d.def.hist === undefined) continue;
    const e = histEntry(d.def.hist);
    const g = e === undefined ? null : groupOf(e);
    if (e === undefined || g === null) continue;
    add(g, itemOf(e, type, d.slot, [], true));
  }
  const keys = [...byGroup.keys()].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  return keys.map((g) => ({
    id: `${kind}:${g}`,
    label: label(g),
    items: byGroup.get(g)!,
  }));
}

/** The picker line of a static gear key (infantry equipment, support, guns) when the country has an entry standing in for it. */
export function histGearItem(
  country: HistCountry,
  type: EquipmentType,
  gen: number,
  researched: ReadonlySet<string>,
): HistPickItem | null {
  const e = histStaticEntry(country, type, gen, researched);
  if (e === undefined || histKindOf(e) !== null) return null;
  return itemOf(e, type, gen, lacking(e, researched), false);
}

/** Ship lines of a class: the country's own ships of the class (generation 1 hulls) and licensed ones. */
export function histShipItems(
  country: HistCountry,
  cls: string,
  designs: readonly WwDesignSlotData[],
  researched: ReadonlySet<string>,
): HistPickItem[] {
  const out: HistPickItem[] = [];
  histOwn(country, "ship").forEach((e, i) => {
    if (e.family !== "ship" || e.cls !== cls) return;
    const row = designs.find(
      (d) => d.kind === "ship" && d.slot === i + 1 && d.def.hist === e.id,
    );
    // A gift before its techs holds the slot but can't be made yet.
    const usable =
      row !== undefined &&
      !row.obsolete &&
      (row.origin === "own" || row.origin === "licensed");
    const it = itemOf(
      e,
      "tank_design",
      i + 1,
      usable ? [] : lacking(e, researched),
      false,
    );
    if (!usable && it.lack.length === 0) it.pending = true;
    out.push(it);
  });
  for (const d of designs) {
    if (d.kind !== "ship" || d.origin !== "licensed" || d.obsolete) continue;
    const e = d.def.hist === undefined ? undefined : histEntry(d.def.hist);
    if (e === undefined || e.family !== "ship" || e.cls !== cls) continue;
    out.push(itemOf(e, "tank_design", d.slot, [], true));
  }
  return out;
}

/** Whether the country has catalogue entries of a design kind (a picker for it replaces the generic rows). */
export function histHasKind(
  country: HistCountry,
  kind: "tank" | "plane" | "ship",
): boolean {
  return histOwn(country, kind).length > 0;
}

/** Plane air types the country's catalogue has entries for. */
export function histPlaneTypes(country: HistCountry): ReadonlySet<string> {
  const out = new Set<string>();
  for (const e of histOwn(country, "plane")) {
    if (e.family === "plane") out.add(e.type);
  }
  return out;
}

/** The catalogue country of the viewer while the designer is off (null: a minor, or the designer is on). */
export function histCountryOfGame(
  game:
    | (DesignerFlagGame & {
        myPlayer?: () => { countryTag?: () => string | null } | null;
      })
    | null
    | undefined,
): HistCountry | null {
  if (designerOn(game)) return null;
  return histCountryOfTag(game?.myPlayer?.()?.countryTag?.() ?? null);
}

/** The name of the entry standing in for a static key in a country (null: the generic name). */
export function staticItemName(
  country: HistCountry | null,
  type: string,
  gen: number,
  researched?: ReadonlySet<string>,
): string | null {
  if (country === null) return null;
  const key = histStaticName(country, type, gen, researched);
  return key === null ? null : translateText(key);
}
