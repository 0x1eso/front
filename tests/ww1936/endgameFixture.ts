// World War 1936 P5 (plan decision 31, the "test map ww1936end" table): the
// test content of the endgame game tests, over the P3 politicsFixture. Its
// keys are test-only (not in en.json; the content key checks skip it).
// Lanes add their own data: usePoliticsContent(endgameFixture({ events })).
import type {
  ContentParts,
  ContentRegistry,
} from "@openfront/engine-lib/ww1936/content/registry";
import type {
  CoreDef,
  EventDef,
  PeaceDefaultDef,
  RegionGroupDef,
} from "@openfront/engine-lib/ww1936/content/types";
import { politicsFixture } from "./politicsFixture";

/** The end map's groups (P3's test groups, Slovakia now with Kosice). */
export const END_GROUPS: RegionGroupDef[] = [
  { id: "slovakia", regions: [15, 20], owner1936: "CSK" },
  { id: "prague", regions: [14], owner1936: "CSK" },
  { id: "sudetenland", regions: [13], owner1936: "CSK" },
  { id: "bohemia_moravia", regions: [14], owner1936: "CSK" },
  { id: "memel", regions: [16], owner1936: "LTU" },
  { id: "rhineland", regions: [4], owner1936: "DEU" },
  { id: "french_border_de", regions: [3, 4], owner1936: "DEU" },
  { id: "warsaw", regions: [6], owner1936: "POL" },
  { id: "west_poland", regions: [6], owner1936: "POL" },
  { id: "east_poland", regions: [7], owner1936: "POL" },
  { id: "munich_test", regions: [4], owner1936: "DEU" },
];
export const END_CORES: CoreDef[] = [{ tag: "SVK", groups: ["slovakia"] }];
export const END_PEACE: PeaceDefaultDef[] = [
  {
    loser: "CSK",
    lines: [
      {
        by: { tag: "DEU" },
        demands: [
          { kind: "take_group", group: "prague" },
          { kind: "release", tag: "SVK" },
        ],
      },
    ],
  },
];
export const END_EVENTS: EventDef[] = [
  {
    id: "test_make_slovakia",
    kind: "country",
    receivers: ["DEU"],
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          {
            kind: "create_state",
            tag: "SVK",
            regions: ["slovakia"],
            from: { tag: "CSK" },
            overlord: "self",
            level: "puppet",
            ideology: "neutral",
          },
        ],
      },
    ],
  },
  {
    id: "test_civil_war",
    kind: "country",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [{ kind: "civil_war", ideology: "communist" }],
      },
    ],
  },
];

/** P3's fixture with the end map's groups, cores, peace row and events (plus `extra`). */
export function endgameFixture(
  extra: Partial<ContentParts> = {},
): ContentRegistry {
  const base = politicsFixture();
  return politicsFixture({
    groups: END_GROUPS,
    cores: END_CORES,
    peace: END_PEACE,
    events: [...base.events, ...END_EVENTS],
    ...extra,
  });
}
