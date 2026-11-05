// World War 1936: template presets that join a country's templates when it
// unlocks them (the tech, or its first saved tank design of a role). Game
// state, so deterministic: library order, one bit per preset in presetSeen.
import {
  GROUND_STATIC_SLOTS,
  NG_HEAVY,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ASSAULT_LINE_KEY } from "@openfront/engine-lib/ww1936/AutoCompanies";
import { isMajor } from "@openfront/engine-lib/ww1936/EconomyStart";
import {
  ASSAULT_LINE_PRESET,
  GUIDE_PRESET_IDS,
  guidePresetsFor,
  newlyUsable,
  presetDef,
  sameBattalions,
  sigUsed,
  TEMPLATE_PRESETS,
  type TemplatePreset,
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

/** Marks every preset usable now as seen (the start; nothing is added). A guide template isn't: a human is given it on the first day. */
export function markPresetsSeen(land: WwLand, cl: CountryLand): void {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return;
  for (const x of newlyUsable(
    ce.researched,
    designGroups(land, cl.smallID),
    cl.presetSeen,
  )) {
    if (GUIDE_PRESET_IDS.has(x.id)) continue;
    cl.presetSeen |= 1 << TEMPLATE_PRESETS.indexOf(x);
  }
}

/**
 * ww107: a guide template joins a human's list when its techs open, its
 * automatic companies on. It comes once: one the human deletes stays gone,
 * and a full list gets the notice and no second try.
 */
function addGuidePreset(
  land: WwLand,
  cl: CountryLand,
  x: TemplatePreset,
): void {
  cl.presetSeen |= 1 << TEMPLATE_PRESETS.indexOf(x);
  if (cl.templates.some((t) => t.key === x.id)) return;
  if (sameBattalions(x, cl.templates)) return;
  if (cl.templates.length >= WW_MAX_TEMPLATES) {
    land.message(cl.smallID, "ww1936.econ.block.too_many_templates");
    return;
  }
  cl.templates.push({
    id: cl.nextTemplateId++,
    key: x.id,
    def: presetDef(x),
    auto: true,
  });
  land.markCountry(cl.smallID);
  land.message(cl.smallID, "events_display.ww1936_template_added", {
    template: x.id,
  });
}

/**
 * Lane M: a major keeps the narrow assault line only until it has assault
 * infantry. It goes unless the human edited it (its switch is off), divisions
 * stand on it (the delete refuses) or the assault line found no room.
 */
function retireNarrowLine(
  land: WwLand,
  cl: CountryLand,
  assault: TemplatePreset,
): void {
  const narrow = cl.templates.find((t) => t.key === ASSAULT_LINE_KEY);
  if (narrow?.auto !== true || !sameBattalions(assault, cl.templates)) return;
  land.issue(
    cl.smallID,
    { kind: "template_delete", template: narrow.id },
    "ai",
  );
}

/** The day's check: each preset newly usable is added as a template unless a template already uses its battalion type or the cap is full. */
export function autoAddPresets(land: WwLand, cl: CountryLand): void {
  const ce = land.econ.country(cl.smallID);
  if (ce === null) return;
  const fresh = newlyUsable(
    ce.researched,
    designGroups(land, cl.smallID),
    cl.presetSeen,
  );
  if (fresh.length === 0) return;
  const human = land.ww.isHumanControlled(cl.smallID);
  // The guide's come first: the older library's skip a type already in use.
  if (human) {
    const major = isMajor(cl.tag);
    for (const x of guidePresetsFor(cl.tag, major, ce.researched, fresh)) {
      addGuidePreset(land, cl, x);
      if (major && x.id === ASSAULT_LINE_PRESET) retireNarrowLine(land, cl, x);
    }
  }
  for (const x of fresh) {
    if (GUIDE_PRESET_IDS.has(x.id)) continue;
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
