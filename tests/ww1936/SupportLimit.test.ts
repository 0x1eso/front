// Owner, 2026-11-05: every template in the game keeps to the support limit:
// the presets, the focus unlocks and the 1936 templates of every country.
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { wwMaxSupport } from "@openfront/engine-api/ww1936/LandTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  presetDef,
  TEMPLATE_PRESETS,
} from "@openfront/engine-lib/ww1936/TemplatePresets";

describe("support limit in the game's own templates", () => {
  test("presets and focus unlocks", () => {
    for (const x of TEMPLATE_PRESETS) {
      const d = presetDef(x);
      expect(d.support.length).toBeLessThanOrEqual(
        wwMaxSupport(d.battalions.length),
      );
    }
    for (const t of CONTENT.templates) {
      expect(t.support.length).toBeLessThanOrEqual(
        wwMaxSupport(t.battalions.length),
      );
    }
  });

  test("the 1936 templates of every country, at every development level", () => {
    for (const tag of COUNTRY_TAGS) {
      for (let dev = 1; dev <= 5; dev++) {
        for (const t of startTemplates(tag, dev)) {
          expect(t.def.support.length).toBeLessThanOrEqual(
            wwMaxSupport(t.def.battalions.length),
          );
        }
      }
    }
  });
});
