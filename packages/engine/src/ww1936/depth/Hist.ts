// ww61: the historical equipment catalogue in the engine. With the designer
// off (the default) a major's catalogue entries ARE its design slots: entry i
// of a kind sits in slot i + 1 of that kind, appears when its techs are
// researched, and is never freed. Entries a country receives (licence,
// capture, gift, market) go to the slots after its own catalogue.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  DesignDef,
  DesignKind,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import { histKindOf, histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import {
  HIST_COUNTRIES,
  HistCountry,
  HistEntry,
} from "@openfront/engine-lib/ww1936/hist/Types";
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
