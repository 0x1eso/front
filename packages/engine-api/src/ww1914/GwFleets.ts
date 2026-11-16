// Great War 1914 (ww221): fleets as light state and the fleet tokens a seat
// sees. Battle fleets (capital ships), cruisers and submarines, as counts, in
// seven sea areas. The engine keeps the truth (GreatWarState.fleets); a
// seat's view carries ours exact and the others as the seat believes them.
import { z } from "zod";
import { GW_TAGS, type GwTag } from "./GwCountries";
import type { GwPlace } from "./GwPlaces";

/** The sea areas; `med` includes the Aegean. Text gw.fleet.area.<area>. */
export const GW_SEA_AREAS = [
  "north",
  "channel",
  "atlantic",
  "baltic",
  "med",
  "adriatic",
  "black",
] as const;
export type GwSeaArea = (typeof GW_SEA_AREAS)[number];

/** battle: dreadnoughts and battlecruisers; cruisers; subs: boats. */
export const GW_FLEET_KINDS = ["battle", "cruisers", "subs"] as const;
export type GwFleetKind = (typeof GW_FLEET_KINDS)[number];

/** What a fleet out is doing; text gw.fleet.mission.<m>. In port it waits. */
export const GW_FLEET_MISSIONS = [
  "patrol",
  "raid",
  "escort",
  "strike", // a sortie, for the next fight
  "invasion_support",
] as const;
export type GwFleetMission = (typeof GW_FLEET_MISSIONS)[number];

/** How a sortie goes: all of it, or only a part drawn out. */
export const GW_SORTIE_WAYS = ["full", "part"] as const;
export type GwSortieWay = (typeof GW_SORTIE_WAYS)[number];

/** Why a fleet can't go there (A appends them to GW_ORDER_BLOCKS). */
export const GW_FLEET_BLOCKS = [
  "sea_shut", // a passage is held against it (the straits, the Sound, Otranto, the Channel)
  "fleet_moving", // already on its way
  "fleet_repair", // wear 4 or more: in repair
] as const;
export type GwFleetBlock = (typeof GW_FLEET_BLOCKS)[number];

export const GwFleetSchema = z.object({
  /** Stable id, `<tag>_<kind>_<home area>` lower case, e.g. "gbr_battle_north". */
  id: z.string(),
  tag: z.enum(GW_TAGS),
  kind: z.enum(GW_FLEET_KINDS),
  /** Capital ships, cruisers or boats; 0 is an empty squadron that may build. */
  ships: z.number().int(),
  /** 0..8; at 4 or more it can't sortie and repairs in port, -1 a chapter. */
  wear: z.number().int(),
  area: z.enum(GW_SEA_AREAS),
  port: z.boolean(),
  mission: z.enum(GW_FLEET_MISSIONS),
  /** Ordered to sortie: how (with mission "strike"). */
  sortie: z.enum(GW_SORTIE_WAYS).optional(),
  /** On its way: the area and the chapter it gets there. */
  to: z.enum(GW_SEA_AREAS).optional(),
  eta: z.number().int().optional(),
  /** Chapter of its last fight. */
  fought: z.number().int().optional(),
  /** Chapter it last came into port (fleet_idle). */
  portSince: z.number().int().optional(),
  /** Most ships it has had (a third lost: the diary). */
  peak: z.number().int(),
  /** Ships the world still believes it has: losses hide until found out. */
  known: z.number().int(),
  /** Chapter it last put out, and who heard it go (port hides). */
  outAt: z.number().int().optional(),
  heardBy: z.array(z.enum(GW_TAGS)).optional(),
  /** Came into port from its station after a fight: goes back out repaired. */
  station: z.boolean().optional(),
});
export type GwFleet = z.infer<typeof GwFleetSchema>;

/** A country's yards: progress points towards the next ship of each kind. */
export const GwYardSchema = z.object({
  tag: z.enum(GW_TAGS),
  cap: z.number().int(),
  subs: z.number().int(),
  /** Capital ships built so far (the programme's order). */
  built: z.number().int(),
});
export type GwYard = z.infer<typeof GwYardSchema>;

/** A fight between fleets (Fleets.seaBattle); kept a while for scenes. */
export const GwSeaFightSchema = z.object({
  chapter: z.number().int(),
  area: z.enum(GW_SEA_AREAS),
  /** Who put out (the striker) and who met it; leads of each side. */
  by: z.enum(GW_TAGS),
  foe: z.enum(GW_TAGS),
  /** big: battle fleets of both sides, 10+ capital ships in all. */
  size: z.enum(["small", "big"]),
  /** For `by`: won, lost or even. */
  result: z.enum(["won", "lost", "even"]),
  /** Only a part drawn out. */
  part: z.boolean(),
  /** The foe's chain told it in time. */
  warned: z.boolean(),
  /** Ships lost, [by, foe]. */
  lost: z.tuple([z.number().int(), z.number().int()]),
});
export type GwSeaFight = z.infer<typeof GwSeaFightSchema>;

/** What a fleet token's estimate rests on; text gw.fleet.seen.<seen>. */
export const GW_FLEET_SEEN = [
  "own", // ours: exact
  "ally", // an ally's word
  "programme", // the building programmes are public: battle fleets
  "contact", // our cruisers share its area
  "heard", // our direction-finding chain heard it lately
  "codes", // its signals read at sea
  "air", // zeppelins and seaplanes
  "last", // shown where it was last seen: in port (it may have left)
  "none", // nothing: "?"
] as const;
export type GwFleetSeen = (typeof GW_FLEET_SEEN)[number];

/** Where one of our fleets could be sent, and how long it takes. */
export interface GwFleetMove {
  to: GwSeaArea;
  /** Chapters on the way (0 in and out of port, 1 next door, 2 far). */
  eta: number;
  open: boolean;
  why: GwFleetBlock | null;
}

export interface GwFleetTokenView {
  id: string;
  tag: GwTag;
  rel: "own" | "ally" | "foe";
  kind: GwFleetKind;
  /** Where it is (or is believed to be: a foe that left unheard shows in port). */
  area: GwSeaArea;
  /** GW_PLACES `center` units: the area's anchor, the home port's coast in port, midway when moving. */
  at: readonly [number, number];
  port: boolean;
  /** The home port it lies in or belongs to, if it has one there. */
  homePort: GwPlace | null;
  /** Ships: exact for ours; believed for others; null at sure 0 ("?"). */
  ships: number | null;
  lo: number;
  hi: number;
  /** 0..3; ours 3, allies 2. */
  sure: number;
  seen: GwFleetSeen;
  /** 0..100 (1 - wear/8); null for foes (grey bar). */
  fill: number | null;
  /** Shown only when out; a foe's is null unless sure 3. */
  mission: GwFleetMission | null;
  /** It fought this chapter (battle badge). */
  fought: boolean;
  /** wear >= 4: repair badge (ours and allies only). */
  repair: boolean;
  to?: GwSeaArea;
  eta?: number;
  /** Ours only: the other areas, open or greyed (order move_fleet). */
  moves?: readonly GwFleetMove[];
  /** Ours, battle and cruisers: whether a sortie can be ordered now. */
  sortie?: { open: boolean; why: GwFleetBlock | null };
}
