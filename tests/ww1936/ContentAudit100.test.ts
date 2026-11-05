// ww100 audit: rewards that look given but do nothing. A template the focus
// opens is refused without its techs, and a research bonus on a branch with
// no live tech sits in the country's five bonus places for good.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { TemplateDef } from "@openfront/engine-api/ww1936/LandTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { startTechs } from "@openfront/engine-lib/ww1936/EconomyStart";
import { landStartTechs } from "@openfront/engine-lib/ww1936/LandStart";
import { templateBlock } from "@openfront/engine-lib/ww1936/TemplateStats";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";

function walk(o: unknown, see: (x: Record<string, unknown>) => void): void {
  if (o === null || typeof o !== "object") return;
  see(o as Record<string, unknown>);
  for (const v of Object.values(o)) walk(v, see);
}

describe("ww100: rewards that do what they say", () => {
  test.each([
    ["chn_central_army", "CHN", false],
    ["chn_expeditionary", "CHN", false],
    ["jpn_amphibious_arm", "JPN", true],
  ] as [string, CountryTag, boolean][])(
    "%s opens its template from the start techs",
    (id, tag, major) => {
      const f = CONTENT.focuses.find((x) => x.id === id)!;
      const techs = new Set<WwTechId>([
        ...startTechs(tag, 0),
        ...landStartTechs(tag, major, 0),
      ]);
      const templates: string[] = [];
      walk(f.effects, (x) => {
        if (x.kind === "add_tech") techs.add(x.tech as WwTechId);
        if (x.kind === "unlock_template") templates.push(x.template as string);
      });
      expect(templates.length).toBeGreaterThan(0);
      for (const t of templates) {
        const c = CONTENT.templates.find((x) => x.id === t)!;
        const def = { ...c, name: "" } as unknown as TemplateDef;
        expect(templateBlock(def, techs, Infinity)).toBeNull();
      }
    },
  );

  test("every research bonus names a branch with a live tech", () => {
    const live = new Set(
      Object.values(WW_TECHS)
        .filter((t) => t.retired !== true)
        .map((t) => t.branch as string),
    );
    const dead: string[] = [];
    for (const list of [CONTENT.focuses, CONTENT.events, CONTENT.decisions]) {
      walk(list, (x) => {
        if (x.kind !== "research_bonus" || x.branch === undefined) return;
        if (!live.has(x.branch as string)) dead.push(x.branch as string);
      });
    }
    expect(dead).toEqual([]);
  });
});
