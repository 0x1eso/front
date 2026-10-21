// World War 1936 P5 (plan decision 31): the facts of the test map
// ww1936end (scripts/ww1936/make-test-map.ts --variant end), read from its
// scenario.json. Every P5 test reads these, never its own numbers.
import {
  COUNTRY_TAGS,
  CountryTag,
  DORMANT_TAGS,
  isDormantTag,
} from "@openfront/engine-api/ww1936/Countries";
import fs from "fs";
import path from "path";

interface EndScenario {
  countries: { tag: CountryTag; capital: [number, number] }[];
  regions: {
    id: number;
    name: string;
    owner: CountryTag;
    vp: number;
    vpTile: [number, number];
    core: boolean;
  }[];
  edges: [number, number, number, number, number, number][];
  width: number;
}

const SCENARIO = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../testdata/maps/ww1936end/scenario.json"),
    "utf8",
  ),
) as EndScenario;

const present = new Set(SCENARIO.countries.map((c) => c.tag));
/** The players in smallID order (plan decision 3): the scenario's, then the dormant slots. */
const ORDER: CountryTag[] = [
  ...COUNTRY_TAGS.filter((t) => present.has(t) && !isDormantTag(t)),
  ...DORMANT_TAGS,
];
const regionOfTile = (tag: CountryTag): number => {
  const c = SCENARIO.countries.find((x) => x.tag === tag);
  if (c === undefined) return 0;
  const [x, y] = c.capital;
  const r = SCENARIO.regions.find(
    (q) => q.vpTile[0] === x && q.vpTile[1] === y,
  );
  return r?.id ?? 0;
};

export const END = {
  map: "ww1936end" as const,
  /** Region name (lower case, the scenario's) → id. */
  region: Object.fromEntries(
    SCENARIO.regions.map((r) => [r.name.toLowerCase(), r.id]),
  ) as Record<string, number>,
  /** Tag → smallID (0: not in this game). */
  tag: Object.fromEntries(ORDER.map((t, i) => [t, i + 1])) as Partial<
    Record<CountryTag, number>
  >,
  /** Region id → victory points. */
  vp: Object.fromEntries(SCENARIO.regions.map((r) => [r.id, r.vp])) as Record<
    number,
    number
  >,
  /** Region id → its 1936 owner. */
  owner: Object.fromEntries(
    SCENARIO.regions.map((r) => [r.id, r.owner]),
  ) as Record<number, CountryTag>,
  /** Region id → a core of its 1936 owner in the scenario. */
  core: Object.fromEntries(
    SCENARIO.regions.map((r) => [r.id, r.core]),
  ) as Record<number, boolean>,
  /** Tag → the region of its capital (0: none, a dormant slot). */
  capital: Object.fromEntries(
    ORDER.map((t) => [t, regionOfTile(t)]),
  ) as Partial<Record<CountryTag, number>>,
  /** Land edges [a, b, border, km, river, strait]. */
  edges: SCENARIO.edges,
  /** How many players (the scenario's countries and the 14 dormant slots). */
  players: ORDER.length,
  /** How many of them are the scenario's countries. */
  scenarioCount: ORDER.length - DORMANT_TAGS.length,
};

/** smallID of `tag` on the end map (throws when it is not there). */
export function endId(tag: CountryTag): number {
  const id = END.tag[tag];
  if (id === undefined) throw new Error(`${tag} is not on ${END.map}`);
  return id;
}
