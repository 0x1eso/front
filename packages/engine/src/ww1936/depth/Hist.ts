// ww61: the historical equipment catalogue in the engine. With the designer
// off (the default) a major's catalogue entries ARE its design slots: entry i
// of a kind sits in slot i + 1 of that kind, appears when its techs are
// researched, and is never freed. Entries a country receives (licence,
// capture, gift, market) go to the slots after its own catalogue.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  DesignDef,
  DesignKind,
  KeyStatsTable,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { histStatsOf } from "@openfront/engine-lib/ww1936/hist/Convert";
import type { GearStats } from "@openfront/engine-lib/ww1936/hist/ConvertGear";
import { tankStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import {
  histKindOf,
  histOwn,
  histSlotOf,
  histStaticEntry,
} from "@openfront/engine-lib/ww1936/hist/Slots";
import {
  HIST_COUNTRIES,
  HistCountry,
  HistEntry,
} from "@openfront/engine-lib/ww1936/hist/Types";
import {
  rowScore,
  STATIC_KEY_STATS,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import type { DesignSlot, WwDepth } from "./WwDepth";

const PLANE_BASE_BY_TYPE: Readonly<Record<string, string>> = {
  heavy_fighter: "medium_1",
  bomber: "medium_1",
  transport_plane: "medium_1",
  strat_bomber: "large_1",
};

/** The designer is on only when the game config says so. */
export function designerOn(d: WwDepth): boolean {
  return d.mg.config().gameConfig().ww1936Designer === true;
}

/** The catalogue country of a smallID (null: not a major, or the designer is on). */
export function histCountryOf(d: WwDepth, id: number): HistCountry | null {
  if (designerOn(d)) return null;
  const tag: CountryTag = d.ww.tagOf(id);
  return (HIST_COUNTRIES as readonly string[]).includes(tag)
    ? (tag as HistCountry)
    : null;
}

/** Slots at the start of a kind that belong to the country's own catalogue (0 for minors). */
export function histOwnCount(d: WwDepth, id: number, kind: DesignKind): number {
  const c = histCountryOf(d, id);
  return c === null ? 0 : histOwn(c, kind).length;
}

/** The def a catalogue entry takes in a design slot. */
export function histDef(e: HistEntry): DesignDef | null {
  const kind = histKindOf(e);
  if (kind === "tank" && e.family === "tank") {
    const base =
      e.role === "light"
        ? "light_2"
        : e.role === "heavy"
          ? "heavy_1"
          : "medium_1";
    return {
      kind,
      base,
      modules: ["", "", "", "", "", ""],
      armorLevel: 0,
      engineLevel: 0,
      name: e.id,
      hist: e.id,
    };
  }
  if (kind === "plane" && e.family === "plane") {
    return {
      kind,
      base: PLANE_BASE_BY_TYPE[e.type] ?? "small_1",
      modules: ["", "", "", ""],
      name: e.id,
      hist: e.id,
    };
  }
  if (kind === "ship" && e.family === "ship") {
    return {
      kind,
      base: `${e.cls}_1`,
      modules: ["", "", ""],
      name: e.id,
      hist: e.id,
    };
  }
  return null;
}

/** Whether the country has every tech of an entry. */
export function histUnlocked(d: WwDepth, id: number, e: HistEntry): boolean {
  const done = d.ww.economy.country(id)?.researched;
  return done !== undefined && e.techs.every((t) => done.has(t));
}

/**
 * Daily: puts the country's newly unlocked catalogue entries into their
 * slots. Cheap: nothing happens unless the researched set grew.
 */
export function dailyHist(d: WwDepth, id: number, day: number): void {
  const country = histCountryOf(d, id);
  const c = d.country(id);
  if (country === null || c === null) return;
  const size = d.ww.economy.country(id)?.researched.size ?? 0;
  if (d.histSeen.get(id) === size) return;
  d.histSeen.set(id, size);
  for (const kind of ["tank", "plane", "ship"] as const) {
    const own = histOwn(country, kind);
    for (let i = 0; i < own.length; i++) {
      if (c.des[kind][i] !== null || !histUnlocked(d, id, own[i])) continue;
      const def = histDef(own[i]);
      if (def === null) continue;
      c.des[kind][i] = {
        def: def as DesignSlot["def"],
        origin: "own",
        from: 0,
        fromSlot: 0,
        obsolete: false,
        savedDay: day,
      };
      d.markDesign(id, kind, i + 1);
    }
  }
}

/** The catalogue entry a design slot of a country holds (undefined: a plain design or empty). */
export function histOfSlot(
  d: WwDepth,
  id: number,
  kind: DesignKind,
  slot: number,
): HistEntry | undefined {
  const h = d.designSlot(id, kind, slot)?.def.hist;
  return h === undefined ? undefined : histEntry(h);
}

const GEAR_FIELDS = [KS.soft, KS.hard, KS.def, KS.brk] as const;

/**
 * A major's static keys take their numbers from its catalogue (rule 7): a
 * tank key from the entry standing in for it (histStaticEntry), the other
 * keys from the generation-1 row scaled by the entry's percent (the spread
 * between real weapons stays small), an anti-tank key with its real pierce.
 */
export function fillHistStatics(
  d: WwDepth,
  id: number,
  t: KeyStatsTable,
): void {
  const country = histCountryOf(d, id);
  if (country === null) return;
  const filled = new Array<boolean>(GROUND_STATIC_SLOTS).fill(false);
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
    const e = histStaticEntry(country, type, gen);
    const o = j * KS_FIELDS;
    if (e === undefined) {
      // No entry for this generation: the country's last stand-in of the type,
      // never the generic row, which outclasses the whole catalogue later on.
      const prev =
        gen > 1
          ? GROUND_EQUIP_KEYS.findIndex(
              (k) => EQUIP_KEYS[k][0] === type && EQUIP_KEYS[k][1] === gen - 1,
            )
          : -1;
      if (prev >= 0 && filled[prev]) {
        for (let f = 0; f < KS_FIELDS; f++)
          t.stats[o + f] = t.stats[prev * KS_FIELDS + f];
        t.score[j] = t.score[prev];
        filled[j] = true;
      }
      continue;
    }
    filled[j] = true;
    if (e.family === "tank") {
      if (type !== "light_tank" && type !== "medium_tank") continue;
      const s = tankStatsOfEntry(e);
      t.stats[o + KS.soft] = s.soft;
      t.stats[o + KS.hard] = s.hard;
      t.stats[o + KS.def] = s.def;
      t.stats[o + KS.brk] = s.brk;
      t.stats[o + KS.pierce] = s.pierce;
      t.stats[o + KS.armor] = s.armor;
      t.stats[o + KS.hardnessPm] = s.hardnessPm;
      t.stats[o + KS.speedCenti] = s.speedCenti;
      t.stats[o + KS.aa] = s.aa;
      t.stats[o + KS.relPm] = s.relPm;
      t.stats[o + KS.fuelPct] = s.fuelPct;
      t.stats[o + KS.flags] = s.flags;
      t.score[j] = rowScore(t.stats, j, t.group[j], t.year[j]);
      continue;
    }
    if (
      e.family !== "infantry" &&
      e.family !== "support" &&
      e.family !== "gun"
    ) {
      continue;
    }
    const g = histStatsOf(e) as GearStats;
    // The generation-1 row of the same type is the 100 % reference.
    const j1 =
      EQUIP_KEYS[GROUND_EQUIP_KEYS[j]][0] === type
        ? GROUND_EQUIP_KEYS.findIndex(
            (k) => EQUIP_KEYS[k][0] === type && EQUIP_KEYS[k][1] === 1,
          )
        : j;
    const o1 = j1 * KS_FIELDS;
    for (const f of GEAR_FIELDS) {
      t.stats[o + f] = Math.floor(
        (STATIC_KEY_STATS.stats[o1 + f] * g.statPct) / 100,
      );
    }
    if (g.pierceCenti > 0) t.stats[o + KS.pierce] = g.pierceCenti;
  }
}

/**
 * Daily, designer off: static plane stock (the start stock, planes a generic
 * line made, gifts, planes back from a wing) becomes the country's
 * catalogue plane that stands in for the key: the entry flagged
 * `staticFor` "<type>:<gen>", else its first unlocked plane of that type.
 * So the start stock is a real, named item.
 */
export function sweepHistPlanes(d: WwDepth, id: number): void {
  const country = histCountryOf(d, id);
  const ce = d.ww.economy.country(id);
  const c = d.country(id);
  if (country === null || ce === null || c === null) return;
  const own = histOwn(country, "plane");
  for (const type of AIR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      const key = equipKey(type, g);
      if (key < 0 || ce.stock[key] <= 0) continue;
      let slot = -1;
      for (let i = 0; i < own.length && slot < 0; i++) {
        if (own[i].staticFor === `${type}:${g}` && c.des.plane[i] !== null) {
          slot = i;
        }
      }
      for (let i = 0; i < own.length && slot < 0; i++) {
        const e = own[i];
        if (
          e.family === "plane" &&
          e.type === type &&
          c.des.plane[i] !== null
        ) {
          slot = i;
        }
      }
      if (slot < 0) continue;
      ce.stock[equipKey("plane_design", slot + 1)] += ce.stock[key];
      ce.stock[key] = 0;
    }
  }
}

/**
 * A focus, event or decision gives (or takes, with a negative count) units of
 * one catalogue item. Designer off and the item the receiver's own tank or
 * plane: its slot is opened if its techs are not yet researched (the stock of
 * an item is a design-slot stock), and the units go there. Returns false when
 * the item does not apply (designer on, not a major's own tank or plane), so
 * the caller falls back to the plain (type, gen) static stock. Gear items
 * (rifles, trucks, guns) are static keys already and always fall back.
 */
export function grantHistItem(
  d: WwDepth,
  id: number,
  itemId: string,
  count: number,
): boolean {
  const country = histCountryOf(d, id);
  const e = histEntry(itemId);
  const c = d.country(id);
  const ce = d.ww.economy.country(id);
  if (country === null || e === undefined || e.country !== country) {
    return false;
  }
  if (c === null || ce === null) return false;
  const kind = histKindOf(e);
  if (kind !== "tank" && kind !== "plane") return false;
  const slot = histSlotOf(country, itemId);
  if (slot <= 0) return false;
  if (c.des[kind][slot - 1] === null) {
    const def = histDef(e);
    if (def === null) return false;
    c.des[kind][slot - 1] = {
      def: def as DesignSlot["def"],
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    d.markDesign(id, kind, slot);
  }
  const key = equipKey(kind === "tank" ? "tank_design" : "plane_design", slot);
  if (key < 0) return false;
  ce.stock[key] = Math.max(0, ce.stock[key] + count);
  return true;
}
