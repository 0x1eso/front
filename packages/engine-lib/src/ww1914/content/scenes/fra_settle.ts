// Great War 1914 (ww199): FRA and a beaten country's fate. Owned by the W-FRA
// lane; ids and conditions in /home/eser/dev/ww199-format.md. Text in
// resources/ww1914/ko/FRA.settle.json.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwClient } from "@openfront/engine-api/ww1914/GwFate";
import {
  all,
  type GwCond,
  type GwEffect,
  type GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  fin,
  fm,
  gauge,
  home,
  men,
  o,
  opinion,
  pm,
  ranged,
  temp,
  trust,
  v,
  warMin,
} from "./fra_years";

/**
 * Poincaré at the treaty: the sign card (`fra_settle_sign`, before the common
 * `gw_settle_sign`); the head of the two states France would found itself
 * (the Rhineland, Bohemia: `fra_settle_crown_<client>`, before the common
 * crown papers); and the years after, each called by the state: the Rhenish
 * state's letter, the annexed land's people, France's own lost land
 * (revanche), a vassal's tribute. The President negotiates and ratifies
 * treaties (constitutional law of 16 July 1875, art. 8), so he signs.
 */

const settleOpen = (of: GwTag): GwCond => world({ is: "settle_open", of });
const sign = (how: "sign" | "press" | "reserve"): GwEffect =>
  doWorld({ do: "treaty_sign", how });
const crown = (client: GwClient, pick: string): GwEffect =>
  doWorld({ do: "crown", client, pick });

type Opt = [string, GwEffect[]];
const opts = (id: string, list: Opt[]): NonNullable<GwScene["options"]> =>
  list.map(([oid, fx]) => o(id, oid, fx));

// ---- The treaty ----

const SIGN: GwScene = {
  id: "fra_settle_sign",
  nation: ["FRA"],
  kind: "proposal",
  // Laid only by the engine (Table.signPaper), never drawn.
  scheduledOnly: true,
  cast: { pm, fm },
  salience: 9,
  tags: ["foreign", "tension_down"],
  variants: [
    v("deu", settleOpen("DEU")),
    v("ott", settleOpen("OTT")),
    v("auh", settleOpen("AUH")),
    v("bgr", settleOpen("BGR")),
    v("base"),
  ],
  options: opts("fra_settle_sign", [
    ["sign", [sign("sign")]],
    ["press", [sign("press")]],
    ["reserve", [sign("reserve")]],
  ]),
  fallback: "sign",
  noBack: true,
};

// ---- The head of a state France founds ----

const crownPaper = (
  client: GwClient,
  picks: string[],
  fallback: string,
): GwScene => ({
  id: `fra_settle_crown_${client}`,
  nation: ["FRA"],
  kind: "proposal",
  // Laid only by the engine (Fate's crown), never drawn.
  scheduledOnly: true,
  cast: { fm, pm },
  salience: 8,
  tags: ["foreign"],
  variants: [v("base")],
  options: opts(
    `fra_settle_crown_${client}`,
    picks.map((p): Opt => [p, [crown(client, p)]]),
  ),
  fallback,
});

// ---- The years after ----

const rhineState = (min?: number, max?: number): GwCond =>
  ranged({ is: "client_state", client: "rhineland" }, min, max);
const vassalOf = (min?: number, max?: number): GwCond =>
  ranged({ is: "vassal" }, min, max);

const YEARS: GwScene[] = [
  {
    id: "fra_settle_rhine",
    nation: ["FRA"],
    kind: "proposal",
    when: all(
      rhineState(),
      world({ is: "fate", fate: "state", client: "rhineland", min: 3 }),
    ),
    cast: { fm, fin },
    salience: 7,
    tags: ["foreign"],
    cooldown: 6,
    max: 3,
    variants: [
      v("dorten", {
        kind: "chose",
        scene: "fra_settle_crown_rhineland",
        pick: "dorten",
      }),
      v("wavering", rhineState(undefined, 1)),
      v("base"),
    ],
    options: opts("fra_settle_rhine", [
      ["loan", [gauge("money", -1), trust("RHN", 1)]],
      ["customs", [trust("RHN", 1), trust("GBR", -1), trust("DEU", -1)]],
      ["distance", [trust("GBR", 1), trust("RHN", -1)]],
    ]),
    fallback: "distance",
  },
  {
    id: "fra_settle_alsace",
    nation: ["FRA"],
    kind: "proposal",
    when: world({ is: "fate", fate: "annex", tag: "DEU", min: 2 }),
    cast: { home },
    salience: 7,
    tags: ["home"],
    once: true,
    variants: [
      v("alsace", world({ is: "held", place: "strasbourg", by: "us" })),
      v("base"),
    ],
    options: opts("fra_settle_alsace", [
      ["sort", [opinion("army", 1), gauge("order", 1), trust("DEU", -1)]],
      ["paris_law", [opinion("parliament", 1), gauge("order", -1)]],
      ["local_law", [gauge("order", 1), opinion("parliament", -1)]],
    ]),
    fallback: "local_law",
  },
  {
    id: "fra_settle_revanche",
    nation: ["FRA"],
    kind: "proposal",
    when: ranged({ is: "revanche" }, 1),
    cast: { pm },
    salience: 6,
    tags: ["home", "tension_up"],
    cooldown: 8,
    max: 3,
    variants: [
      v("vassal", world({ is: "vassal", self: true, by: "DEU" })),
      v("base"),
    ],
    options: opts("fra_settle_revanche", [
      [
        "speak",
        [opinion("press", 1), gauge("morale", 1), trust("DEU", -1), temp(1)],
      ],
      ["silence", [gauge("order", 1), opinion("press", -1)]],
      ["allies", [trust("GBR", 1), trust("USA", 1)]],
    ]),
    fallback: "silence",
  },
  {
    id: "fra_settle_vassal",
    nation: ["FRA"],
    kind: "proposal",
    when: vassalOf(),
    cast: { fin, fm, war: warMin },
    salience: 6,
    tags: ["foreign", "home"],
    cooldown: 6,
    max: 3,
    variants: [v("turning", vassalOf(undefined, 0)), v("base")],
    options: opts("fra_settle_vassal", [
      ["more", [gauge("money", 1), trust("USA", -1)]],
      ["own_hands", [gauge("money", -1), opinion("parliament", 1)]],
      ["garrison", [men(-1), opinion("army", 1)]],
    ]),
    fallback: "own_hands",
  },
];

export const FRA_SETTLE_SCENES: readonly GwScene[] = [
  SIGN,
  crownPaper("rhineland", ["dorten", "regency"], "regency"),
  crownPaper("bohemia", ["national_council", "regency"], "national_council"),
  ...YEARS,
];
