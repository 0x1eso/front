// World War 1936 P5 Phase B (integration): the data fixes the content lanes
// left for after the merge — situation beats, the Nagasaki core, France's AI
// path, Italy's titled leaders and Axis course, the Pan-American pact.
import {
  COUNTRY_POLITICS,
  FACTION_NAMES,
} from "@openfront/engine-lib/ww1936/content/countries";
import { BEATS_P5 } from "@openfront/engine-lib/ww1936/content/endgame/beats";
import { REGION_GROUPS_P5 } from "@openfront/engine-lib/ww1936/content/endgame/groups";
import { WORLD_EVENTS } from "@openfront/engine-lib/ww1936/content/events/world";
import {
  FRA_FOCUSES,
  FRA_PATH,
} from "@openfront/engine-lib/ww1936/content/focus/fra";

/** Pre-flight §0-7: the beat-fired events that depend on a situation. */
const SITUATION_EVENTS = [
  "ita_grand_council",
  "ita_armistice",
  "jpn_nanjing_government",
  "jpn_burma_state",
  "jpn_philippine_republic",
  "jpn_surrender_decision",
  "gbr_mers_el_kebir",
  "fra_free_french_africa",
  "vic_torch",
  "deu_case_anton",
  "fra_paris_uprising",
];

describe("World War 1936 P5 Phase B data", () => {
  it("every situation event's beat waits for its situation", () => {
    for (const e of SITUATION_EVENTS) {
      const beats = BEATS_P5.filter(
        (b) => b.act.kind === "event" && b.act.id === e,
      );
      expect(beats.length, e).toBe(1);
      expect(beats[0].when, e).toBeDefined();
    }
  });

  it("Nagasaki (map v5) is part of Japan's home islands", () => {
    const home = REGION_GROUPS_P5.find((g) => g.id === "japan_home")!;
    expect(home.regions).toContain(1369);
  });

  it("France's AI path starts with a focus open in 1936", () => {
    const first = FRA_FOCUSES.find((f) => f.id === FRA_PATH[0])!;
    expect(first.available?.kind === "is_exile").toBe(false);
    // The government in exile's chain stays on the path, at its end.
    const exile = FRA_PATH.indexOf("fra_june_appeal");
    expect(exile).toBe(FRA_PATH.length - 5);
  });

  it("Italy's non-fascist leaders are the P5 titles", () => {
    const ita = COUNTRY_POLITICS.find((c) => c.tag === "ITA")!;
    expect(ita.leaders.democratic).toBe("title:ita_council_president");
    expect(ita.leaders.neutral).toBe("title:ita_military_premier");
  });

  it("Italy on the Axis course accepts the Rome-Berlin axis twice as readily", () => {
    const ev = WORLD_EVENTS.find((e) => e.id === "ita_rome_berlin_axis")!;
    const a = ev.options.find((o) => o.id === "a")!;
    expect(a.ai?.mods).toEqual([
      { if: { kind: "flag", flag: "ita_axis_course" }, factor: 200 },
    ]);
  });

  it("the Pan-American pact takes members of any ideology", () => {
    const pa = FACTION_NAMES.find((f) => f.id === "pan_american")!;
    expect(pa.anyIdeology).toBe(true);
  });
});
