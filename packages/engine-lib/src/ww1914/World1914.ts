import { GameMap } from "@openfront/engine-api/game/GameMap";
import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import owners1914 from "resources/maps/world1936/owners1914.json";
import { z } from "zod";
import { ScenarioIndex } from "../ww1936/ScenarioIndex";

const Tag = z.enum(GW_TAGS);
const Rule = z.union([
  Tag,
  z.object({
    to: Tag,
    except: z.partialRecord(Tag, z.array(z.number().int().min(1))),
  }),
]);
export const GwOwnersSchema = z.object({
  version: z.literal(1),
  /** A 1936 owner's regions in 1914. An owner not listed keeps its tag. */
  byOwner: z.record(z.string(), Rule),
});
export type GwOwners = z.infer<typeof GwOwnersSchema>;

const OWNERS = GwOwnersSchema.parse(owners1914);

/** A region's 1914 owner, from its 1936 owner; null if the table has no answer. */
export function gwOwnerOf(id: number, owner1936: string): GwTag | null {
  const rule = OWNERS.byOwner[owner1936];
  if (rule === undefined) {
    return (GW_TAGS as readonly string[]).includes(owner1936)
      ? (owner1936 as GwTag)
      : null;
  }
  if (typeof rule === "string") return rule;
  for (const t of GW_TAGS) {
    if (rule.except[t]?.includes(id) === true) return t;
  }
  return rule.to;
}

/** The world of June 1914 on the 1936 map's regions. */
export interface GwWorld {
  /** Countries with land, GW_TAGS order: smallID = index + 1. */
  readonly tags: readonly GwTag[];
  /** Region id -> owner's smallID (0: nobody). */
  readonly owners: Uint16Array;
}

/** Read-only and derived from the map files, so not part of a snapshot. */
export function gwWorldOf(index: ScenarioIndex): GwWorld {
  const regions = index.data.regions;
  const tagById = new Map<number, GwTag>();
  let maxId = 0;
  for (const r of regions) {
    const t = gwOwnerOf(r.id, r.owner);
    if (t === null) throw new Error(`no 1914 owner for region ${r.id}`);
    tagById.set(r.id, t);
    if (r.id > maxId) maxId = r.id;
  }
  const present = new Set(tagById.values());
  const tags = GW_TAGS.filter((t) => present.has(t));
  const owners = new Uint16Array(maxId + 1);
  for (const [id, t] of tagById) owners[id] = tags.indexOf(t) + 1;
  return { tags, owners };
}

/**
 * Gives every land tile its 1914 owner. The engine runs it once at the start
 * and the screens on their own copy of the map (as fillScenarioOwners does).
 */
export function fillGreatWarOwners(
  map: GameMap,
  index: ScenarioIndex,
  world: GwWorld,
): void {
  const ids = index.regionIds;
  for (let t = 0; t < ids.length; t++) {
    const id = ids[t];
    if (id === 0 || id >= SEA_ZONE_BASE || id >= world.owners.length) continue;
    if (!map.isLand(t) || map.isImpassable(t)) continue;
    const owner = world.owners[id];
    if (owner !== 0) map.setOwnerID(t, owner);
  }
}
