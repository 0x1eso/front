// World War 1936: template presets that join a country's templates when it
// unlocks them (the tech, or its first saved tank design of a role). Game
// state, so deterministic: library order, one bit per preset in presetSeen.
import {
  GROUND_STATIC_SLOTS,
  NG_HEAVY,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  newlyUsable,
  presetDef,
  sigUsed,
  TEMPLATE_PRESETS,
} from "@openfront/engine-lib/ww1936/TemplatePresets";
import type { CountryLand, WwLand } from "./WwLand";

/** The NEED_GROUPS indexes of the design-only groups the country has a saved tank design for. */
function designGroups(land: WwLand, owner: number): Set<number> {
  const out = new Set<number>();
  const g = land.keyStatsOf(owner).group;
  for (let j = GROUND_STATIC_SLOTS; j < g.length; j++) {
    if (g[j] >= NG_HEAVY) out.add(g[j]);
  }
  return out;
}

/** Marks every preset usable now as seen (the start; nothing is added). */
export function markPresetsSeen(land: WwLand, cl: CountryLand): void {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return;
  for (const x of newlyUsable(
    ce.researched,
    designGroups(land, cl.smallID),
    cl.presetSeen,
  )) {
    cl.presetSeen |= 1 << TEMPLATE_PRESETS.indexOf(x);
  }
}

/** The day's check: each preset newly usable is added as a template unless a template already uses its battalion type or the cap is full. */
export function autoAddPresets(land: WwLand, cl: CountryLand): void {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return;
  for (const x of newlyUsable(
    ce.researched,
    designGroups(land, cl.smallID),
    cl.presetSeen,
  )) {
    cl.presetSeen |= 1 << TEMPLATE_PRESETS.indexOf(x);
    if (cl.templates.length >= WW_MAX_TEMPLATES || sigUsed(x, cl.templates)) {
      continue;
    }
    if (cl.templates.some((t) => t.key === x.id)) continue;
    cl.templates.push({
      id: cl.nextTemplateId++,
      key: x.id,
      def: presetDef(x),
    });
    land.markCountry(cl.smallID);
    land.message(cl.smallID, "events_display.ww1936_template_added", {
      template: x.id,
    });
  }
}
