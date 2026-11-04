// A design's name as the player reads it. The engine stores an unnamed
// design as "@" (or "@" + a preset id) so the digest does not depend on the
// language; every screen resolves it here, in the client.

import type {
  DesignDef,
  PlaneDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  designStats,
  resolvedModules,
  shipBase,
  tankDefault,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import { translateText } from "../../Utils";

/**
 * ww63: a catalogue entry's name in the viewer's language, or null when `id`
 * is not a catalogue id. The engine stores `def.name` of a catalogue slot as
 * the id (so digests do not depend on the language); every screen resolves it
 * here: text key ww1936.hist.<id>.
 */
export function histNameOf(id: string): string | null {
  return histEntry(id) === undefined
    ? null
    : translateText(`ww1936.hist.${id}`);
}

/** True for the engine's marker of an automatic name. */
export function isAutoDesignName(name: string): boolean {
  return name.startsWith("@");
}

/** The automatic name of a design (spec §5.1). */
export function autoNameOf(def: DesignDef): string {
  if (def.kind === "tank") {
    const role = tankRole(def);
    const base = translateText(`ww1936.base.tank.${def.base}`);
    const gun = resolvedModules(def)[0];
    if (role === "tank" && gun !== tankDefault(def.base, 0) && gun !== "") {
      return translateText("ww1936.design.auto_gun", {
        base,
        gun: translateText(`ww1936.module.${gun}`),
      });
    }
    return translateText("ww1936.design.auto", {
      base,
      role: translateText(`ww1936.role.${role}`),
    });
  }
  if (def.kind === "ship") {
    const sb = shipBase(def.base);
    return translateText("ww1936.design.auto", {
      base: translateText(`ww1936.ship_gen.${sb?.gen ?? 1}`),
      role: translateText(`ww1936.ship_class.${sb?.cls ?? "dd"}`),
    });
  }
  const plane = designStats(def, {
    techs: new Set(),
    projects: 0,
    relPp: 0,
    costPct: 0,
  }) as PlaneDesignStats;
  return translateText("ww1936.design.auto", {
    base: translateText(`ww1936.base.plane.${def.base}`),
    role: translateText(`ww1936.equip.${plane.type}`),
  });
}

/** The name to show for a design: its own, or the automatic one for "@". */
export function designDisplayName(def: DesignDef): string {
  if (def.hist !== undefined) {
    const h = histNameOf(def.hist);
    if (h !== null) return h;
  }
  const byName = histNameOf(def.name);
  if (byName !== null) return byName;
  if (!isAutoDesignName(def.name)) return def.name;
  try {
    return autoNameOf(def);
  } catch {
    return def.base;
  }
}

/**
 * A stored name from a notice or a listing, where the full design may not be
 * at hand: a real name stays; "@" falls back to `fallback` (the equipment's
 * own name) so the marker never reaches the screen.
 */
export function designNameOr(name: string, fallback: string): string {
  const h = histNameOf(name);
  if (h !== null) return h;
  return isAutoDesignName(name) ? fallback : name;
}
