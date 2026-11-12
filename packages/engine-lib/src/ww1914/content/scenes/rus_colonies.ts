import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, chose, not } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  atWar,
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
 * RUS's scenes: the sea and the empire's edges (ww190 §9, `rus_cs_*`): the
 * Black Sea (the Goeben hunt, Trebizond, Kolchak, the Imperatritsa Mariya),
 * the Baltic twice (the mine barrier, the Gulf of Riga) and Central Asia 1916
 * twice (the labour decree, the revolt). Cooldown 4, most once. Text:
 * resources/ww1914/ko/RUS.colonies.json.
 */

const own = (min: number): GwCond => w({ is: "war_months", own: true, min });
const blackSea = (by: "us" | "foe" | "none"): GwCond =>
  w({ is: "sea_hold", sea: "black", by });
const force = (delta: number) =>
  dw({ do: "force", tag: "RUS", theatre: "caucasus", delta });
const eastForce = (delta: number) =>
  dw({ do: "force", tag: "RUS", theatre: "east", delta });

const NAVY = { navy: held("navy") };
const COS = { cos: held("chief_of_staff") };
const WAR = { war: held("war") };
const INTERIOR = { interior: held("interior") };

export const RUS_COLONIES_SCENES: readonly GwScene[] = [
  rusScene("rus_cs_goeben_hunt", {
    kind: "proposal",
    when: all(atWar("OTT"), w({ is: "pair_war", with: "OTT", min: 1 })),
    cast: { ...NAVY },
    salience: 6,
    tags: ["war"],
    cooldown: 4,
    max: 3,
    variants: [v("ours", blackSea("us")), v("base")],
    options: [
      o("hunt", [gauge("shells", -1), opinion("press", 1)]),
      o("convoys", [gauge("bread", 1)]),
      o("mines", [inst("stavka", 1)]),
    ],
  }),
  rusScene("rus_cs_trebizond", {
    kind: "proposal",
    when: all(
      atWar("OTT"),
      w({ is: "front", theatre: "caucasus", from: "erzurum", to: "trabzon" }),
      not(blackSea("foe")),
    ),
    cast: { ...NAVY, ...COS },
    salience: 7,
    tags: ["war"],
    once: true,
    variants: [v("base")],
    options: [
      o("landing", [force(1), gauge("shells", -1)]),
      o("guns_only", [force(1), men(-1)]),
      o("army_alone", [inst("stavka", 1)]),
    ],
  }),
  rusScene("rus_cs_kolchak", {
    kind: "proposal",
    when: all(atWar("OTT"), own(18), {
      kind: "person_active",
      person: "rus_kolchak",
    }),
    cast: { ...NAVY, kolchak: { person: "rus_kolchak" } },
    salience: 6,
    tags: ["war", "people"],
    once: true,
    variants: [v("base")],
    options: [
      o("kolchak", [
        { kind: "person_trust", who: { role: "kolchak" }, delta: 1 },
        inst("stavka", 1),
      ]),
      o("keep_old", [
        { kind: "person_trust", who: { role: "kolchak" }, delta: -1 },
      ]),
    ],
  }),
  rusScene("rus_cs_mariya", {
    kind: "proposal",
    when: all(any(atWar("OTT"), atWar("DEU")), blackSea("us"), own(24)),
    cast: { ...NAVY },
    salience: 7,
    tags: ["war", "home"],
    once: true,
    variants: [v("base")],
    options: [
      o("sabotage", [gauge("order", -1), opinion("press", 1)]),
      o("accident", [gauge("morale", -1)]),
      o("hush", [{ kind: "censor", delta: 1 }, opinion("press", -1)]),
    ],
  }),
  rusScene("rus_cs_baltic_mines", {
    kind: "proposal",
    when: all(atWar("DEU"), w({ is: "war_months", own: true, max: 3 })),
    cast: { ...NAVY },
    salience: 5,
    tags: ["war"],
    once: true,
    variants: [v("base")],
    options: [
      o("barrier", [inst("stavka", 1)]),
      o("sorties", [gauge("shells", -1), opinion("press", 1)]),
      o("both", [gauge("money", -1)]),
    ],
  }),
  rusScene("rus_cs_baltic_riga", {
    kind: "proposal",
    when: all(
      atWar("DEU"),
      w({ is: "front", theatre: "east", from: "riga", to: "dvina" }),
    ),
    assumes: { line: { east: ["riga", "dvina"] } },
    cast: { ...NAVY, ...COS },
    salience: 6,
    tags: ["war"],
    once: true,
    variants: [v("base")],
    options: [
      o("hold_gulf", [eastForce(1), gauge("shells", -1)]),
      o("ships_back", [gauge("morale", -1)]),
    ],
  }),
  rusScene("rus_cs_asia_decree", {
    kind: "proposal",
    // The power `rus_pw_labour_draft` is the same decree, taken by hand.
    when: all(
      own(18),
      w({ is: "manpower", max: 60 }),
      not({ kind: "seen", scene: "rus_pw_labour_draft_r" }),
      not({ kind: "seen", scene: "rus_pw_labour_draft_bad" }),
    ),
    cast: { ...WAR, ...INTERIOR },
    salience: 6,
    tags: ["home", "war"],
    once: true,
    variants: [v("base")],
    options: [
      o("call_now", [men(2), gauge("order", -1)]),
      o("after_harvest", [men(1)]),
      o("exempt", [opinion("army", -1)]),
    ],
  }),
  rusScene("rus_cs_asia_revolt", {
    kind: "proposal",
    when: any(
      chose("rus_cs_asia_decree", "call_now"),
      chose("rus_cs_asia_decree", "after_harvest"),
    ),
    cast: { ...WAR, ...INTERIOR },
    salience: 7,
    tags: ["home", "war"],
    once: true,
    variants: [v("now", chose("rus_cs_asia_decree", "call_now")), v("base")],
    options: [
      o("troops", [gauge("order", 1), men(-1), trust("USA", -1)]),
      o("postpone", [men(-1), gauge("order", 1), inst("stavka", -1)]),
      o("let_burn", [gauge("order", -1)]),
    ],
  }),
];
