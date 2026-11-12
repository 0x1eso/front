import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwClient, GwSignHow } from "@openfront/engine-api/ww1914/GwFate";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, assuming } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import {
  dw,
  gauge,
  held,
  inst,
  men,
  o,
  opinion,
  rusScene,
  trust,
  v,
  w,
} from "./rus_years";

/**
 * RUS: a beaten country's fate (ww199). The sign card in Nicholas's voice
 * (`rus_settle_sign`, before the common `gw_settle_sign`), the Bohemian crown
 * where Russia's own differs (`rus_settle_crown_bohemia`), the Czech state's
 * letter, and the years after: Hagia Sophia, annexed Galicia, a vassal that
 * balks, and the revanche at home when Russia is the one cut. Text in
 * resources/ww1914/ko/RUS.settle.json. See /home/eser/dev/ww199-format.md.
 */

const sign = (how: GwSignHow) => dw({ do: "treaty_sign", how });
/** ww199 merge: our state's or our vassals' loyalty (and resistance). */
const loyal = (by: number, client?: GwClient, resist?: number) =>
  dw({
    do: "loyalty",
    by,
    ...(client === undefined ? {} : { client }),
    ...(resist === undefined ? {} : { resist }),
  });
const crown = (pick: string) => dw({ do: "crown", client: "bohemia", pick });
const open = (of: GwTag): GwCond => w({ is: "settle_open", of });
const fate = (c: Omit<Extract<GwWorldCond, { is: "fate" }>, "is">): GwCond =>
  w({ is: "fate", ...c });
const ours = (place: "constantinople" | "lemberg"): GwCond =>
  w({ is: "held", place, by: "us" });
type RuleFx = Omit<Extract<GwWorldEffect, { do: "rule" }>, "do" | "of">;
const rule = (of: GwTag, fx: RuleFx) => dw({ do: "rule", of, ...fx });

const FOREIGN = { foreign: held("foreign") };
const COS = { cos: held("chief_of_staff") };
const COURT = { court: held("court") };
const INTERIOR = { interior: held("interior") };

/** We are the one cut: a pair table lost, or the general peace lost. */
const beaten = any(
  w({ is: "pair_table", open: true, result: ["lost"] }),
  w({ is: "peace_side", of: ["lost"] }),
);

/** Only the engine lays it, when our table opens: no `when` of its own. */
function scheduled(s: GwScene): GwScene {
  const out: GwScene = { ...s, scheduledOnly: true, noBack: true };
  delete out.when;
  return out;
}

const SIGN = scheduled(
  rusScene("rus_settle_sign", {
    kind: "proposal",
    when: any(w({ is: "settle_open" }), beaten),
    cast: { ...FOREIGN, ...COS },
    salience: 8,
    tags: ["foreign", "war"],
    variants: [
      v("lost", beaten),
      v("general", all(open("DEU"), open("AUH"))),
      assuming(v("tsargrad", all(open("OTT"), ours("constantinople"))), {
        held: { constantinople: "us" },
      }),
      v("ott", open("OTT")),
      v("auh", open("AUH")),
      v("deu", open("DEU")),
      v("bgr", open("BGR")),
      v("base"),
    ],
    options: [
      o("sign", [sign("sign")]),
      o("press", [sign("press")]),
      o("reserve", [sign("reserve")]),
    ],
    fallback: "sign",
  }),
);

const CROWN = scheduled(
  rusScene("rus_settle_crown_bohemia", {
    kind: "proposal",
    when: w({ is: "client_state", client: "bohemia" }),
    cast: { ...FOREIGN, ...COURT },
    salience: 7,
    tags: ["foreign"],
    variants: [v("base")],
    options: [
      o("national_council", [crown("national_council"), trust("FRA", 1)]),
      o("regency", [crown("regency"), inst("court", 1)]),
    ],
    fallback: "national_council",
  }),
);

const AFTER: GwScene[] = [
  // The Czech state Russia founded asks for its men in Russian camps.
  rusScene("rus_settle_czech_men", {
    kind: "proposal",
    when: fate({ fate: "state", client: "bohemia", min: 3 }),
    cast: { ...FOREIGN, war: held("war") },
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o("let_go", [men(-1), trust("CZE", 1), loyal(1, "bohemia")]),
      o("volunteers", [trust("CZE", 1), opinion("army", -1)]),
      o("keep", [gauge("bread", 1), trust("CZE", -1), loyal(-1, "bohemia")]),
    ],
  }),
  // Tsargrad is ours: the cross on Hagia Sophia.
  rusScene("rus_settle_tsargrad", {
    kind: "proposal",
    when: all(
      fate({ fate: "annex", tag: "OTT", min: 2 }),
      ours("constantinople"),
    ),
    assumes: { held: { constantinople: "us" } },
    cast: { ...COURT, ...FOREIGN },
    salience: 7,
    tags: ["foreign", "home"],
    once: true,
    variants: [v("base")],
    options: [
      o("cross", [inst("court", 1), opinion("court", 1), trust("GBR", -1)]),
      o("patriarch", [trust("GRC", 1), inst("court", -1)]),
      o("mosque", [trust("GBR", 1), opinion("press", -1)]),
    ],
  }),
  // Red Rus annexed: the schools, the church, the land.
  rusScene("rus_settle_galicia", {
    kind: "proposal",
    when: fate({ fate: "annex", tag: "AUH", min: 6 }),
    cast: { ...INTERIOR, ...COURT },
    salience: 6,
    tags: ["home"],
    once: true,
    variants: [
      assuming(v("lemberg", ours("lemberg")), { held: { lemberg: "us" } }),
      v("base"),
    ],
    options: [
      o("russian", [rule("AUH", { hard: 1 }), inst("court", 1)]),
      o("own_tongue", [rule("AUH", { hard: -1 }), opinion("press", -1)]),
      o("land", [rule("AUH", { relief: true }), opinion("court", -1)]),
    ],
  }),
  // A vassal of ours wavers: the tribute is late, its papers grumble.
  rusScene("rus_settle_vassal", {
    kind: "proposal",
    when: w({ is: "vassal", max: 1 }),
    cast: { ...FOREIGN, ...COS },
    salience: 6,
    tags: ["foreign", "war"],
    cooldown: 6,
    max: 2,
    variants: [
      v("bgr", w({ is: "vassal", of: "BGR", max: 1 })),
      v("ott", w({ is: "vassal", of: "OTT", max: 1 })),
      v("base"),
    ],
    options: [
      o("press", [gauge("money", 1), opinion("army", 1), loyal(-1)]),
      o("garrison", [men(-1), inst("stavka", 1), loyal(0, undefined, -1)]),
      o("ease", [gauge("money", -1), opinion("press", 1), loyal(1)]),
    ],
  }),
  // Russia was cut: the press asks for the lost provinces back.
  rusScene("rus_settle_revanche", {
    kind: "proposal",
    when: w({ is: "revanche", min: 1 }),
    cast: { ...FOREIGN, ...COS },
    salience: 6,
    tags: ["foreign", "home"],
    cooldown: 8,
    max: 2,
    variants: [
      v("poland", fate({ fate: "state", as: "of", client: "poland" })),
      v("ukraine", fate({ fate: "state", as: "of", client: "ukraine" })),
      v("base"),
    ],
    options: [
      o("vow", [opinion("press", 1), inst("stavka", 1), gauge("money", -1)]),
      o("patience", [inst("ministers", 1), opinion("press", -1)]),
      o("let_be", [gauge("morale", -1), trust("USA", 1)]),
    ],
  }),
];

export const RUS_SETTLE_SCENES: readonly GwScene[] = [SIGN, CROWN, ...AFTER];
