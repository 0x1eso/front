// ww229 (design ww227 §6, owner D4): what a minor bought or built under
// licence before 1936 (content/nations/<tag>/core.ts startArms). Each row's
// catalogue entry goes into the minor's design slots as a copy of its
// designer's (licensed: may be produced, already paid, so no licence record,
// no rent, no end and not counted in WW_MAX_LICENCES; received: used only),
// and its count into stock. Tanks and planes only.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { NATION_CORES } from "@openfront/engine-lib/ww1936/content/nations/cores";
import type { StartArmsRow } from "@openfront/engine-lib/ww1936/content/nations/types";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import {
  histKindOf,
  histSlotOf,
} from "@openfront/engine-lib/ww1936/hist/Slots";
import { saveDesign } from "./Designs";
import { histDef } from "./Hist";
import type { WwDepth } from "./WwDepth";

/** depth.start(): every minor's start arms (none in the Imjin War). */
export function startArms(d: WwDepth): void {
  if (d.ww.imjin) return;
  for (const core of NATION_CORES) {
    if (core.startArms.length === 0) continue;
    const id = d.ww.politics.idOfTag(core.tag);
    if (id > 0) applyStartArms(d, id, core.startArms);
  }
}

/** The rows for one country; the slot each got (0: skipped). */
export function applyStartArms(
  d: WwDepth,
  id: number,
  rows: readonly StartArmsRow[],
): number[] {
  const ce = d.ww.economy.country(id);
  return rows.map((r) => {
    const e = histEntry(r.entry);
    if (e === undefined) return 0;
    const kind = histKindOf(e);
    if (kind !== "tank" && kind !== "plane") return 0;
    const def = histDef(e);
    if (def === null) return 0;
    const from = d.ww.politics.idOfTag(e.country);
    const slot = saveDesign(
      d,
      id,
      def,
      0,
      r.origin,
      from,
      histSlotOf(e.country, e.id),
      0,
    );
    if (typeof slot !== "number") return 0;
    if (ce !== null && r.count > 0) {
      const key = equipKey(kind === "tank" ? "tank_design" : "plane_design", slot);
      ce.stock[key] += r.count;
      d.ww.economy.markCountryDirty(id);
    }
    return slot;
  });
}
