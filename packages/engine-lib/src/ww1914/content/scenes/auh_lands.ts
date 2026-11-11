// Great War 1914 (ww172 phase 5): AUH's scenes of occupation and the
// bilateral tables: land taken or lost, a capital falling, a country knocked
// out, a table of two sitting or signed. Owned by the AUH writer lane;
// shapes and conditions in /home/eser/dev/ww172-format5.md, conditions from
// ./land_events. Text, and the memoir lines on the new endings, in
// resources/ww1914/ko/AUH.lands.json.
import type {
  GwGauge,
  GwInstitution,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  capitalFell,
  knockedOut,
  knockedOutBy,
  lostCapital,
  lostLand,
  tableSigned,
  tableSits,
  tookCapital,
  tookLand,
} from "./land_events";

// ---- People, by office: whoever holds it in this game ----

const FM: GwCastRule = { office: "foreign" };
const COS: GwCastRule = { office: "chief_of_staff" };
const HUN: GwCastRule = { office: "hun_pm" };
const PM: GwCastRule = { office: "chancellor" };
const FIN: GwCastRule = { office: "finance" };
const WAR: GwCastRule = { office: "war" };

// ---- Conditions ----

/** Any time in this war: months far enough back to mean "ever". */
const EVER = 120;
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const sideIs = (side: GwSide): GwCond => world({ is: "side", of: [side] });
const entered = (tag: GwTag, side: GwSide): GwCond =>
  world({ is: "entered", tag, side });
/** `tag` stands on the seat's side. */
const withUs = (tag: GwTag): GwCond =>
  any(
    all(entered(tag, "central"), sideIs("central")),
    all(entered(tag, "entente"), sideIs("entente")),
  );
/** `tag` stands on the other side. */
const againstUs = (tag: GwTag): GwCond =>
  any(
    all(entered(tag, "central"), sideIs("entente")),
    all(entered(tag, "entente"), sideIs("central")),
  );
/**
 * `tag`, knocked out, was our enemy: on the other side, or beaten in a war
 * of the two of us that had no sides (ww172 merge 5).
 */
const foeOut = (tag: GwTag): GwCond =>
  any(againstUs(tag), knockedOutBy(tag, "AUH", EVER));
/** We hold some of `tag`'s land now. */
const holdOf = (tag: GwTag): GwCond => tookLand(tag, EVER);
/** `tag` holds some of ours now. */
const heldBy = (tag: GwTag): GwCond => lostLand(tag, EVER);
/** Germany holds land of `tag` too. */
const deuHolds = (tag: GwTag): GwCond =>
  world({ is: "land_taken", tag: "DEU", from: tag, max: EVER });
/** Our capital is held by `tag`. */
const capitalTo = (tag: GwTag): GwCond =>
  world({ is: "land_lost", to: tag, capital: true, max: EVER });

// ---- Effects ----

const reason = (key: string): GwEffect => ({ kind: "reason", key });
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
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
const opt = (id: string, ...effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

// ---- Shapes ----

type Variants = readonly (readonly [string, GwCond?])[];

const variantsOf = (vs: Variants): GwScene["variants"] =>
  vs.map(([id, when]) => (when === undefined ? { id } : { id, when }));

/** Read and laid aside. */
const wire = (
  id: string,
  salience: number,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  vs: Variants,
): GwScene => ({
  id,
  nation: ["AUH"],
  kind: "wire",
  once: true,
  salience,
  tags: ["foreign", "war"],
  cast,
  when,
  variants: variantsOf(vs),
});

/** A paper with two or three answers; the first is what a timer takes. */
const proposal = (
  id: string,
  salience: number,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  vs: Variants,
  options: GwOption[],
): GwScene => ({
  ...wire(id, salience, when, cast, vs),
  kind: "proposal",
  fallback: options[0].id,
  options,
});

// ---- Occupation, ours ----

const OURS: readonly GwScene[] = [
  proposal(
    "auh_ld_occ_belgrade",
    8,
    tookCapital("SRB", 1),
    { fm: FM, hun: HUN },
    [["out", knockedOut("SRB", EVER)], ["base"]],
    [
      opt(
        "army_rule",
        opinion("army", 1),
        inst("hungary", -1),
        reason("auhld_belgrade_army"),
      ),
      opt(
        "commissar",
        inst("hungary", 1),
        opinion("army", -1),
        reason("auhld_belgrade_commissar"),
      ),
    ],
  ),
  wire(
    "auh_ld_occ_serbia_land",
    7,
    all(tookLand("SRB", 1), not(tookCapital("SRB", EVER))),
    { cos: COS },
    [["rus", atWar("RUS")], ["base"]],
  ),
  proposal(
    "auh_ld_occ_cetinje",
    7,
    tookCapital("MNE", 1),
    { fm: FM },
    [["out", knockedOut("MNE", EVER)], ["base"]],
    [
      opt(
        "disarm",
        gauge("order", 1),
        inst("nations", -1),
        reason("auhld_cetinje_disarm"),
      ),
      opt(
        "elders",
        inst("nations", 1),
        opinion("army", -1),
        reason("auhld_cetinje_elders"),
      ),
    ],
  ),
  proposal(
    "auh_ld_occ_bucharest",
    8,
    tookCapital("ROU", 1),
    { fm: FM, fin: FIN },
    [["deu", deuHolds("ROU")], ["out", knockedOut("ROU", EVER)], ["base"]],
    [
      opt(
        "grain_home",
        gauge("bread", 1),
        trust("DEU", -1),
        reason("auhld_bucharest_home"),
      ),
      opt(
        "share",
        trust("DEU", 1),
        inst("berlin", 1),
        reason("auhld_bucharest_share"),
      ),
    ],
  ),
  wire(
    "auh_ld_occ_wallachia",
    7,
    all(tookLand("ROU", 1), not(tookCapital("ROU", EVER))),
    { hun: HUN },
    [["both", heldBy("ROU")], ["base"]],
  ),
  proposal(
    "auh_ld_occ_ukraine",
    8,
    tookLand("RUS", 1),
    { fm: FM, fin: FIN },
    [["out", knockedOut("RUS", EVER)], ["deu", deuHolds("RUS")], ["base"]],
    [
      opt(
        "requisition",
        gauge("bread", 1),
        opinion("press", -1),
        reason("auhld_ukraine_take"),
      ),
      opt(
        "buy",
        gauge("money", -1),
        inst("nations", 1),
        reason("auhld_ukraine_buy"),
      ),
    ],
  ),
  proposal(
    "auh_ld_occ_friuli",
    8,
    tookLand("ITA", 1),
    { cos: COS, war: WAR },
    [["out", knockedOut("ITA", EVER)], ["base"]],
    [
      opt(
        "requisition",
        gauge("bread", 1),
        trust("ITA", -1),
        reason("auhld_friuli_take"),
      ),
      opt(
        "leave_harvest",
        gauge("bread", -1),
        trust("ITA", 1),
        reason("auhld_friuli_leave"),
      ),
    ],
  ),
  proposal(
    "auh_ld_occ_berlin_asks",
    7,
    all(tookLand(undefined, 1), sideIs("central")),
    { fm: FM },
    [["deu", world({ is: "land_taken", tag: "DEU", max: EVER })], ["base"]],
    [
      opt(
        "joint",
        trust("DEU", 1),
        inst("berlin", 1),
        reason("auhld_berlin_joint"),
      ),
      opt(
        "our_own",
        trust("DEU", -1),
        opinion("army", 1),
        reason("auhld_berlin_own"),
      ),
    ],
  ),
];

// ---- Occupation, theirs ----

const THEIRS: readonly GwScene[] = [
  proposal(
    "auh_ld_lost_galicia",
    8,
    lostLand("RUS", 1),
    { pm: PM, cos: COS },
    [["base"]],
    [
      opt(
        "camps",
        gauge("money", -1),
        gauge("order", 1),
        reason("auhld_galicia_camps"),
      ),
      opt(
        "suspects",
        gauge("order", 1),
        inst("nations", -1),
        reason("auhld_galicia_suspects"),
      ),
      opt(
        "counter",
        opinion("army", 1),
        gauge("morale", -1),
        reason("auhld_galicia_counter"),
      ),
    ],
  ),
  proposal(
    "auh_ld_lost_isonzo",
    7,
    lostLand("ITA", 1),
    { cos: COS, pm: PM },
    [["base"]],
    [
      opt(
        "evacuate",
        gauge("money", -1),
        gauge("morale", 1),
        reason("auhld_isonzo_evacuate"),
      ),
      opt(
        "hold",
        opinion("army", 1),
        gauge("shells", -1),
        reason("auhld_isonzo_hold"),
      ),
    ],
  ),
  wire("auh_ld_lost_srb", 7, lostLand("SRB", 1), { hun: HUN }, [
    ["rus", atWar("RUS")],
    ["base"],
  ]),
  proposal(
    "auh_ld_lost_transylvania",
    8,
    lostLand("ROU", 1),
    { hun: HUN, cos: COS },
    [["base"]],
    [
      opt(
        "from_east",
        inst("hungary", 1),
        opinion("army", -1),
        reason("auhld_trans_east"),
      ),
      opt(
        "ask_berlin",
        trust("DEU", 1),
        inst("berlin", 1),
        reason("auhld_trans_berlin"),
      ),
    ],
  ),
  proposal(
    "auh_ld_lost_vienna",
    8,
    lostCapital(1),
    { pm: PM, hun: HUN },
    [["rus", capitalTo("RUS")], ["ita", capitalTo("ITA")], ["base"]],
    [
      opt(
        "budapest",
        inst("hungary", 1),
        inst("nations", -1),
        reason("auhld_vienna_budapest"),
      ),
      opt(
        "olmutz",
        opinion("court", 1),
        inst("hungary", -1),
        reason("auhld_vienna_olmutz"),
      ),
    ],
  ),
  wire("auh_ld_fell_bucharest", 7, capitalFell("DEU", "ROU", 1), { fm: FM }, [
    ["ours_too", holdOf("ROU")],
    ["base"],
  ]),
  wire("auh_ld_fell_belgrade", 7, capitalFell("DEU", "SRB", 1), { fm: FM }, [
    ["ours_too", holdOf("SRB")],
    ["base"],
  ]),
  proposal(
    "auh_ld_fell_constantinople",
    7,
    capitalFell("RUS", "OTT", 1),
    { fm: FM, hun: HUN },
    [["ally", withUs("OTT")], ["base"]],
    [
      opt(
        "bulgaria",
        trust("BGR", 1),
        gauge("money", -1),
        reason("auhld_const_bulgaria"),
      ),
      opt(
        "danube",
        inst("hungary", 1),
        trust("BGR", -1),
        reason("auhld_const_danube"),
      ),
    ],
  ),
];

// ---- Knocked out ----

const OUT: readonly GwScene[] = [
  proposal(
    "auh_ld_out_srb",
    7,
    knockedOut("SRB", 1),
    { fm: FM, hun: HUN },
    [["foe", foeOut("SRB")], ["base"]],
    [
      opt(
        "small_serbia",
        inst("hungary", 1),
        opinion("army", -1),
        reason("auhld_srb_small"),
      ),
      opt(
        "heights",
        opinion("army", 1),
        inst("hungary", -1),
        reason("auhld_srb_heights"),
      ),
    ],
  ),
  wire("auh_ld_out_rou", 7, knockedOut("ROU", 1), { hun: HUN }, [
    ["foe", foeOut("ROU")],
    ["friend", withUs("ROU")],
    ["base"],
  ]),
  proposal(
    "auh_ld_out_rus",
    8,
    knockedOut("RUS", 1),
    { cos: COS, pm: PM },
    [["foe", foeOut("RUS")], ["base"]],
    [
      opt(
        "to_italy",
        opinion("army", 1),
        gauge("morale", -1),
        reason("auhld_rus_italy"),
      ),
      opt(
        "harvest",
        gauge("bread", 1),
        opinion("army", -1),
        reason("auhld_rus_harvest"),
      ),
    ],
  ),
  wire("auh_ld_out_ita", 7, knockedOut("ITA", 1), { cos: COS }, [
    ["foe", foeOut("ITA")],
    ["base"],
  ]),
  proposal(
    "auh_ld_out_deu",
    8,
    knockedOut("DEU", 1),
    { fm: FM, hun: HUN },
    [["friend", withUs("DEU")], ["base"]],
    [
      opt(
        "stand",
        opinion("army", 1),
        gauge("morale", -1),
        reason("auhld_deu_stand"),
      ),
      opt(
        "sound_out",
        inst("council", 1),
        opinion("army", -1),
        reason("auhld_deu_sound"),
      ),
    ],
  ),
  wire("auh_ld_out_bgr", 7, knockedOut("BGR", 1), { fm: FM }, [
    ["friend", withUs("BGR")],
    ["base"],
  ]),
];

// ---- The bilateral table ----

const TABLE: readonly GwScene[] = [
  proposal(
    "auh_ld_table_sits_rus",
    8,
    tableSits("RUS"),
    { fm: FM, hun: HUN },
    [["ahead", holdOf("RUS")], ["behind", heldBy("RUS")], ["base"]],
    [
      opt(
        "firm",
        opinion("army", 1),
        trust("RUS", -1),
        reason("auhld_table_rus_firm"),
      ),
      opt(
        "quick",
        opinion("workers", 1),
        opinion("army", -1),
        reason("auhld_table_rus_quick"),
      ),
    ],
  ),
  proposal(
    "auh_ld_table_sits_srb",
    8,
    tableSits("SRB"),
    { fm: FM, hun: HUN },
    [["ahead", holdOf("SRB")], ["behind", heldBy("SRB")], ["base"]],
    [
      opt(
        "tisza_line",
        inst("hungary", 1),
        opinion("army", -1),
        reason("auhld_table_srb_hun"),
      ),
      opt(
        "army_line",
        opinion("army", 1),
        inst("hungary", -1),
        reason("auhld_table_srb_army"),
      ),
    ],
  ),
  proposal(
    "auh_ld_table_sits_ita",
    7,
    tableSits("ITA"),
    { fm: FM, cos: COS },
    [["ahead", holdOf("ITA")], ["behind", heldBy("ITA")], ["base"]],
    [
      opt(
        "firm",
        opinion("army", 1),
        trust("ITA", -1),
        reason("auhld_table_ita_firm"),
      ),
      opt(
        "berlin",
        trust("DEU", 1),
        inst("berlin", 1),
        reason("auhld_table_ita_berlin"),
      ),
    ],
  ),
  proposal(
    "auh_ld_table_sits_rou",
    7,
    tableSits("ROU"),
    { fm: FM, hun: HUN },
    [["ahead", holdOf("ROU")], ["behind", heldBy("ROU")], ["base"]],
    [
      opt(
        "passes",
        inst("hungary", 1),
        trust("ROU", -1),
        reason("auhld_table_rou_passes"),
      ),
      opt(
        "king",
        trust("ROU", 1),
        inst("hungary", -1),
        reason("auhld_table_rou_king"),
      ),
    ],
  ),
  wire(
    "auh_ld_table_won",
    7,
    all(tableSigned("won"), not(tableSigned("won", "SRB"))),
    { fm: FM },
    [
      ["rus", tableSigned("won", "RUS")],
      ["ita", tableSigned("won", "ITA")],
      ["rou", tableSigned("won", "ROU")],
      ["base"],
    ],
  ),
  proposal(
    "auh_ld_table_won_srb",
    8,
    tableSigned("won", "SRB"),
    { hun: HUN, fin: FIN },
    [["base"]],
    [
      opt(
        "common",
        inst("council", 1),
        inst("hungary", -1),
        reason("auhld_won_srb_common"),
      ),
      opt(
        "hungary",
        inst("hungary", 1),
        inst("nations", -1),
        reason("auhld_won_srb_hungary"),
      ),
    ],
  ),
  proposal(
    "auh_ld_table_lost",
    8,
    tableSigned("lost"),
    { pm: PM, hun: HUN },
    [
      ["rus", tableSigned("lost", "RUS")],
      ["ita", tableSigned("lost", "ITA")],
      ["base"],
    ],
    [
      opt(
        "carry",
        opinion("court", -1),
        gauge("morale", 1),
        reason("auhld_lost_carry"),
      ),
      opt(
        "blame",
        opinion("press", 1),
        inst("council", -1),
        reason("auhld_lost_blame"),
      ),
    ],
  ),
  wire("auh_ld_table_even", 7, tableSigned("even"), { fm: FM }, [
    ["rus", tableSigned("even", "RUS")],
    ["srb", tableSigned("even", "SRB")],
    ["base"],
  ]),
];

export const AUH_LAND_EVENTS: readonly GwScene[] = [
  ...OURS,
  ...THEIRS,
  ...OUT,
  ...TABLE,
];
