// Great War 1914 (ww172 phase 5): FRA's scenes of occupation and the
// bilateral tables: land taken or lost, a capital falling, a country knocked
// out, a table of two sitting or signed. Owned by the FRA writer lane;
// shapes and conditions in /home/eser/dev/ww172-format5.md, conditions from
// ./land_events. Text, and the memoir lines on the new endings, in
// resources/ww1914/ko/FRA.lands.json.
import type {
  GwGauge,
  GwInstitution,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlaceGroup } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  reason,
  type GwCond,
  type GwEffect,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  capitalFell,
  knockedOut,
  lostCapital,
  lostLand,
  tableSigned,
  tableSits,
  tookCapital,
  tookGroup,
  tookLand,
} from "./land_events";

/**
 * Poincaré's desk when land changes hands: German land under a French
 * flag, French land under a German one, a capital falling, a country out,
 * a table of two. The state calls every card; no option shows its result
 * before the pick, and each leaves a record line (`reasons` in the pack).
 * The table itself is the system's: no effect here gives or trades land.
 */

// ---- Conditions ----

const sideIs = (side: GwSide): GwCond => world({ is: "side", of: [side] });
const entered = (tag: GwTag, side: GwSide): GwCond =>
  world({ is: "entered", tag, side });
/** `tag` fights on France's side of the coalition war. */
const withUs = (tag: GwTag): GwCond =>
  any(
    all(sideIs("entente"), entered(tag, "entente")),
    all(sideIs("central"), entered(tag, "central")),
  );
/** `tag` fights on the other side of the coalition war. */
const againstUs = (tag: GwTag): GwCond =>
  any(
    all(sideIs("entente"), entered(tag, "central")),
    all(sideIs("central"), entered(tag, "entente")),
  );
/** French land has been in German hands at least `months`. */
const lostLong = (months: number): GwCond =>
  world({ is: "land_lost", to: "DEU", min: months });
/** Paris has been in enemy hands at least `months`. */
const parisHeld = (months: number): GwCond =>
  world({ is: "land_lost", capital: true, min: months });
/** Germany's own land in Europe, not its colonies (ww172 merge 5). */
const GERMAN_HOME: GwPlaceGroup[] = [
  "alsace_lorraine",
  "rhineland",
  "germany",
  "east_prussia",
  "west_prussia",
  "posen",
  "silesia",
  "schleswig",
];
const deuOut = knockedOut("DEU", 24);
/** France took German land in Germany itself within `months`. */
const tookGerman = (months = 0): GwCond =>
  tookGroup(GERMAN_HOME, months, "DEU");
/** France has held German land in Germany itself at least `months`. */
const heldGerman = (months: number): GwCond =>
  world({ is: "land_taken", from: "DEU", group: GERMAN_HOME, min: months });
/** France has held a place of Germany's `groups` at least `months`. */
const heldIn = (groups: GwPlaceGroup[], months: number): GwCond =>
  world({ is: "land_taken", from: "DEU", group: groups, min: months });
/** A table of two with someone other than Germany signed, as `result`. */
const otherTable = (result: "won" | "lost" | "even"): GwCond =>
  any(
    tableSigned(result, "AUH"),
    tableSigned(result, "ITA"),
    tableSigned(result, "OTT"),
    tableSigned(result, "BGR"),
  );

// ---- Effects ----

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});

// ---- Shapes ----

type Option = NonNullable<GwScene["options"]>[number];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

/** An option whose record line is `<scene>_<option>`. */
const o = (scene: string, id: string, effects: GwEffect[]): Option => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

const wire = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  cast: GwScene["cast"] = {},
  salience = 6,
): GwScene => ({
  id,
  nation: ["FRA"],
  kind: "wire",
  once: true,
  salience,
  tags: ["foreign", "war"],
  cast,
  when,
  variants,
});

/** A paper to sign; a timer takes the last option. */
const proposal = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  options: [string, GwEffect[]][],
  cast: GwScene["cast"] = {},
  salience = 7,
): GwScene => ({
  id,
  nation: ["FRA"],
  kind: "proposal",
  once: true,
  salience,
  tags: ["foreign", "war"],
  cast,
  when,
  variants,
  options: options.map(([oid, fx]) => o(id, oid, fx)),
  fallback: options[options.length - 1][0],
});

const pm = { office: "chancellor" } as const;
const fm = { office: "foreign" } as const;
const cos = { office: "chief_of_staff" } as const;
const war = { office: "war" } as const;
const interior = { office: "interior" } as const;
const finance = { office: "finance" } as const;

// ---- Occupation, ours: German land under the French flag ----

const OURS: GwScene[] = [
  proposal(
    "fra_ld_ours_alsace",
    tookGroup(["alsace_lorraine"], 0, "DEU"),
    [v("out", deuOut), v("base")],
    [
      ["prefects", [inst("chamber", 1), opinion("army", -1)]],
      ["army", [inst("army", 1), opinion("parliament", -1)]],
      ["mayors", [gauge("order", 1), opinion("press", -1)]],
    ],
    { war, interior },
    8,
  ),
  proposal(
    "fra_ld_ours_school",
    heldIn(["alsace_lorraine"], 3),
    [v("out", deuOut), v("base")],
    [
      ["french", [opinion("press", 1), gauge("order", -1)]],
      ["both", [gauge("order", 1), opinion("press", -1)]],
    ],
    { interior },
  ),
  wire(
    "fra_ld_ours_return",
    tookGroup(["alsace_lorraine"], 2, "DEU"),
    [v("out", deuOut), v("base")],
    {
      war,
    },
  ),
  proposal(
    "fra_ld_ours_rhine",
    tookGroup(["rhineland"], 3, "DEU"),
    [v("britain", withUs("GBR")), v("base")],
    [
      ["buffer", [inst("army", 1), trust("GBR", -1)]],
      ["wait", [trust("GBR", 1), opinion("army", -1)]],
    ],
    { cos, fm },
  ),
  proposal(
    "fra_ld_ours_coal",
    world({ is: "land_taken", from: "DEU", place: ["saarbrucken"], min: 2 }),
    [v("out", deuOut), v("base")],
    [
      ["run", [gauge("shells", 1), gauge("order", -1)]],
      ["leave", [gauge("order", 1), opinion("business", -1)]],
    ],
    { war },
  ),
  wire(
    "fra_ld_ours_allies",
    tookGerman(1),
    [
      v("both", all(withUs("RUS"), withUs("GBR"))),
      v("britain", withUs("GBR")),
      v("base"),
    ],
    { fm },
  ),
  proposal(
    "fra_ld_ours_capital",
    tookCapital("DEU", 1),
    [v("out", knockedOut("DEU", 6)), v("base")],
    [
      ["parade", [gauge("morale", 1), trust("GBR", -1)]],
      ["quiet", [trust("GBR", 1), opinion("press", -1)]],
      ["commission", [inst("countersign", 1)]],
    ],
    { pm, cos },
    8,
  ),
  proposal(
    "fra_ld_ours_levy",
    heldGerman(4),
    [v("out", deuOut), v("base")],
    [
      ["levy", [gauge("money", 1), gauge("order", -1)]],
      ["pay", [gauge("money", -1), gauge("order", 1)]],
    ],
    { finance },
  ),
];

// ---- Occupation, theirs: French land under the German flag ----

const THEIRS: GwScene[] = [
  proposal(
    "fra_ld_theirs_north",
    lostLand("DEU"),
    [v("capital", lostCapital(6)), v("base")],
    [
      ["refugees", [gauge("money", -1), gauge("order", 1)]],
      ["departments", [gauge("money", 1), opinion("workers", -1)]],
    ],
    { interior },
    8,
  ),
  wire("fra_ld_theirs_hostages", lostLong(2), [
    v("capital", lostCapital(36)),
    v("base"),
  ]),
  proposal(
    "fra_ld_theirs_mines",
    lostLong(3),
    [v("britain", withUs("GBR")), v("base")],
    [
      ["import", [trust("GBR", 1), gauge("money", -1)]],
      ["dig", [gauge("shells", 1), opinion("workers", -1)]],
    ],
    { war },
  ),
  proposal(
    "fra_ld_theirs_bordeaux",
    lostCapital(),
    [v("britain", withUs("GBR")), v("russia", withUs("RUS")), v("base")],
    [
      ["bordeaux", [inst("chamber", 1), gauge("morale", -1)]],
      ["front", [gauge("morale", 1), inst("countersign", -1)]],
    ],
    { pm },
    8,
  ),
  wire("fra_ld_theirs_paris", parisHeld(1), [
    v("long", parisHeld(4)),
    v("base"),
  ]),
  wire("fra_ld_theirs_brussels", capitalFell("DEU", "BEL"), [
    v("with", withUs("BEL")),
    v("base"),
  ]),
  wire("fra_ld_theirs_hague", capitalFell("DEU", "NLD"), [
    v("with", withUs("NLD")),
    v("base"),
  ]),
  wire(
    "fra_ld_theirs_berlin",
    capitalFell("RUS", "DEU"),
    [v("ally", withUs("RUS")), v("base")],
    { cos },
  ),
];

// ---- Knocked out ----

const OUT: GwScene[] = [
  proposal(
    "fra_ld_out_rus",
    knockedOut("RUS", 1),
    [v("ally", withUs("RUS")), v("foe", againstUs("RUS")), v("base")],
    [
      ["chamber", [inst("chamber", 1), gauge("morale", -1)]],
      ["london", [trust("GBR", 1), inst("army", -1)]],
      ["bonds", [opinion("business", 1), gauge("money", -1)]],
    ],
    { pm, finance },
    8,
  ),
  wire("fra_ld_out_bel", knockedOut("BEL", 1), [
    v("ally", withUs("BEL")),
    v("base"),
  ]),
  wire(
    "fra_ld_out_srb",
    knockedOut("SRB", 1),
    [v("ally", withUs("SRB")), v("base")],
    { cos },
  ),
  proposal(
    "fra_ld_out_deu",
    knockedOut("DEU", 1),
    [v("held", tookGerman(36)), v("base")],
    [
      ["alsace", [opinion("parliament", 1), inst("army", -1)]],
      ["rhine", [inst("army", 1), trust("GBR", -1)]],
      ["quiet", [inst("countersign", 1)]],
    ],
    { fm, cos },
    8,
  ),
  wire(
    "fra_ld_out_auh",
    knockedOut("AUH", 1),
    [v("foe", againstUs("AUH")), v("base")],
    { fm },
  ),
  wire(
    "fra_ld_out_ita",
    knockedOut("ITA", 1),
    [v("ally", withUs("ITA")), v("foe", againstUs("ITA")), v("base")],
    { cos },
  ),
];

// ---- The bilateral table ----

const TABLE: GwScene[] = [
  proposal(
    "fra_ld_table_deu",
    tableSits("DEU"),
    [v("ahead", tookGerman(36)), v("behind", lostLand("DEU", 36)), v("base")],
    [
      ["minister", [inst("countersign", 1)]],
      ["soldier", [inst("army", 1), opinion("parliament", -1)]],
      ["deputies", [inst("chamber", 1), opinion("army", -1)]],
    ],
    { fm, cos },
    8,
  ),
  proposal(
    "fra_ld_table_ita",
    tableSits("ITA"),
    [v("ahead", tookLand("ITA", 36)), v("base")],
    [
      ["firm", [opinion("press", 1), trust("ITA", -1)]],
      ["soft", [trust("ITA", 1), opinion("press", -1)]],
    ],
    { fm },
  ),
  wire("fra_ld_table_auh", tableSits("AUH"), [v("base")], { fm }),
  proposal(
    "fra_ld_table_ott",
    tableSits("OTT"),
    [v("base")],
    [
      ["debt", [opinion("business", 1), trust("OTT", -1)]],
      ["schools", [trust("OTT", 1), opinion("business", -1)]],
    ],
    { fm },
  ),
  proposal(
    "fra_ld_table_won",
    tableSigned("won", "DEU"),
    [v("held", tookGerman(36)), v("base")],
    [
      ["vote", [inst("chamber", 1), inst("senate", 1)]],
      ["bells", [gauge("morale", 1), gauge("money", -1)]],
    ],
    { pm },
    8,
  ),
  proposal(
    "fra_ld_table_lost",
    tableSigned("lost", "DEU"),
    [v("capital", lostCapital(36)), v("base")],
    [
      ["own", [inst("chamber", 1), gauge("morale", -1)]],
      ["army", [inst("countersign", 1), inst("army", -1)]],
      ["silent", [gauge("order", 1), opinion("press", -1)]],
    ],
    { pm, cos },
    8,
  ),
  wire("fra_ld_table_even", tableSigned("even", "DEU"), [v("base")], { pm }),
  wire(
    "fra_ld_table_other",
    any(otherTable("won"), otherTable("lost"), otherTable("even")),
    [v("won", otherTable("won")), v("lost", otherTable("lost")), v("even")],
    { fm },
  ),
];

export const FRA_LAND_EVENTS: readonly GwScene[] = [
  ...OURS,
  ...THEIRS,
  ...OUT,
  ...TABLE,
];
