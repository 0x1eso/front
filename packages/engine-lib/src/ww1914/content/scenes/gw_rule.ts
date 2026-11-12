import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlaceGroup } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  any,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  reason,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Common scenes: ruling occupied land (ww190 §3). Data only; the text is in
 * resources/ww1914/ko/common.rule.json.
 *
 * The `gw_oc_` wires tell a seat how the others rule what they took: each
 * comes once, to the seats that are not the ruler, when that land has been
 * held long enough for the thing to happen. The two seat cards are the
 * fallbacks for any pair the seat's own writing doesn't cover: a rising in
 * land the seat rules, and the seat's own land under a foreign hand.
 */

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const except = (...tags: GwTag[]): GwTag[] =>
  SEATS.filter((t) => !tags.includes(t));

/** `tag` has held land of `from` (in `group`, or its capital) `min` months. */
const holds = (
  tag: GwTag,
  from: GwTag,
  min: number,
  where: { group?: GwPlaceGroup[]; capital?: boolean } = {},
): GwCond => world({ is: "land_taken", tag, from, min, ...where });
const ENTENTE: GwVariant = {
  id: "entente",
  when: world({ is: "side", of: ["entente"] }),
};

/** A wire told once to the seats that are not the ruler. */
function wire(
  id: string,
  nation: GwTag[],
  when: GwCond,
  variants: GwVariant[] = [{ id: "base" }],
): GwScene {
  return {
    id,
    nation,
    kind: "wire",
    stage: ["war"],
    when,
    cast: {},
    salience: 3,
    tags: ["war"],
    once: true,
    variants,
  };
}

const opt = (scene: string, id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

export const GW_RULE_SCENES: readonly GwScene[] = [
  // ---- Belgium under the German governor ----
  wire(
    "gw_oc_belgium_relief",
    except("DEU"),
    holds("DEU", "BEL", 3, { group: ["belgium"] }),
    [
      {
        id: "us_out",
        when: { kind: "not", of: world({ is: "entered", tag: "USA" }) },
      },
      { id: "base" },
    ],
  ),
  wire(
    "gw_oc_cavell",
    except("DEU"),
    holds("DEU", "BEL", 12, { group: ["belgium"] }),
    [ENTENTE, { id: "base" }],
  ),
  wire(
    "gw_oc_belgium_deport",
    except("DEU"),
    holds("DEU", "BEL", 24, { group: ["belgium"] }),
  ),
  // ---- the East ----
  wire(
    "gw_oc_east_prussia",
    except("RUS"),
    holds("RUS", "DEU", 1, { group: ["east_prussia"] }),
  ),
  wire(
    "gw_oc_poland",
    except("DEU", "AUH"),
    any(
      holds("DEU", "RUS", 12, { group: ["russian_poland"] }),
      holds("AUH", "RUS", 12, { group: ["russian_poland"] }),
    ),
  ),
  wire(
    "gw_oc_lithuania",
    except("DEU"),
    holds("DEU", "RUS", 18, { group: ["baltic"] }),
  ),
  wire(
    "gw_oc_ukraine",
    except("DEU", "AUH"),
    any(
      holds("DEU", "RUS", 3, { group: ["ukraine"] }),
      holds("AUH", "RUS", 3, { group: ["ukraine"] }),
    ),
  ),
  // ---- the Balkans ----
  wire(
    "gw_oc_serbia",
    except("AUH"),
    holds("AUH", "SRB", 3, { capital: true }),
  ),
  wire(
    "gw_oc_romania",
    except("DEU", "AUH"),
    any(
      holds("DEU", "ROU", 2, { capital: true }),
      holds("AUH", "ROU", 2, { capital: true }),
    ),
  ),
  // ---- the fallbacks: a rising in land the seat rules ----
  {
    id: "gw_oc_rising",
    nation: [...SEATS],
    kind: "proposal",
    when: world({ is: "resist", min: 2 }),
    cast: {},
    salience: 5,
    tags: ["war", "home"],
    cooldown: 4,
    max: 3,
    variants: [
      { id: "worst", when: world({ is: "resist", min: 3 }) },
      { id: "base" },
    ],
    fallback: "garrison",
    options: [
      opt("gw_oc_rising", "garrison", [
        doWorld({ do: "manpower", delta: -1 }),
        { kind: "opinion", bloc: "army", delta: 1 },
      ]),
      opt("gw_oc_rising", "notables", [
        { kind: "opinion", bloc: "army", delta: -1 },
        { kind: "gauge", gauge: "money", delta: -1 },
      ]),
    ],
  },
  // ---- the seat's own land under a foreign hand ----
  {
    id: "gw_oc_exiles",
    nation: [...SEATS],
    kind: "proposal",
    when: world({ is: "ruled" }),
    cast: {},
    salience: 4,
    tags: ["war", "home"],
    cooldown: 4,
    max: 3,
    variants: [
      { id: "hard", when: world({ is: "ruled", min: 2 }) },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      opt("gw_oc_exiles", "help", [
        { kind: "gauge", gauge: "money", delta: -1 },
        { kind: "gauge", gauge: "morale", delta: 1 },
      ]),
      opt("gw_oc_exiles", "wait", [
        { kind: "opinion", bloc: "press", delta: -1 },
      ]),
    ],
  },
];
