// Great War 1914 (ww199): a beaten country's fate, as Wilhelm II meets it.
// Owned by the W-DEU lane. The engine calls the sign card (`deu_settle_sign`,
// before the common `gw_settle_sign`) when a table with Germany as a winner
// opens, and a crown paper (`deu_settle_crown_<client>`, before the common
// one) the chapter after Germany founds that state. The years after are
// drawn by state: the Poles and the border strip, the Ukrainian countryside,
// a vassal that drags its feet, and Germany's own lost land. Text, with each
// pick's line after it (`<scene>_<pick>`), in resources/ww1914/ko/DEU.settle.json.
import type { GwClient } from "@openfront/engine-api/ww1914/GwFate";
import { all, not, type GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  act,
  bondBy,
  card,
  gauge,
  holder,
  inst,
  men,
  opinion,
  trust,
  v,
  w,
} from "./deu_years";

const chancellor = holder("chancellor");
const foreign = holder("foreign");
const cos = holder("chief_of_staff");
const war = holder("war");
const finance = holder("finance");
const interior = holder("interior");

const TAGS: GwScene["tags"] = ["foreign", "war"];

/** America still out of the war: what it reads in a treaty counts. */
const usaOut = not(w({ is: "entered", tag: "USA" }));

// ---- The treaty card: the Kaiser signs ----

const SIGN: GwScene = {
  ...card({
    id: "deu_settle_sign",
    when: w({ is: "settle_open" }),
    cast: { foreign, cos },
    salience: 9,
    tags: TAGS,
    variants: [
      v("rus", w({ is: "settle_open", of: "RUS" })),
      v("rou", w({ is: "settle_open", of: "ROU" })),
      v("bel", w({ is: "settle_open", of: "BEL" })),
      v("fra", w({ is: "settle_open", of: "FRA" })),
      v("base"),
    ],
    options: (p) => [
      p("sign", act({ do: "treaty_sign", how: "sign" })),
      p("press", act({ do: "treaty_sign", how: "press" })),
      p("reserve", act({ do: "treaty_sign", how: "reserve" })),
    ],
  }),
  scheduledOnly: true,
};

// ---- The crowns: who sits on the thrones Germany set up ----

/** A crown paper of a state Germany founded: one option per pick. */
function crown(
  client: GwClient,
  picks: readonly string[],
  cast: GwScene["cast"],
): GwScene {
  return {
    ...card({
      id: `deu_settle_crown_${client}`,
      when: w({ is: "client_state", client }),
      cast,
      salience: 8,
      tags: TAGS,
      variants: [v("usa", usaOut), v("base")],
      options: (p) =>
        picks.map((pick) => p(pick, act({ do: "crown", client, pick }))),
    }),
    scheduledOnly: true,
  };
}

const CROWNS: GwScene[] = [
  crown("poland", ["regency", "karl_stephan"], { chancellor, foreign }),
  crown("lithuania", ["urach", "prussia", "regency"], { chancellor, cos }),
  crown("baltic_duchy", ["adolf_friedrich", "prussia", "regency"], {
    cos,
    chancellor,
  }),
  crown("ukraine", ["skoropadsky", "archduke_wilhelm", "regency"], {
    cos,
    foreign,
  }),
];

// ---- The years after ----

const AFTER: GwScene[] = [
  // The Poles were given a state and lost a strip of it to us.
  card({
    id: "deu_settle_poles",
    when: all(
      w({ is: "client_state", client: "poland" }),
      w({ is: "fate", fate: "annex", tag: "RUS", min: 3 }),
    ),
    cast: { chancellor, cos },
    salience: 7,
    tags: TAGS,
    once: true,
    variants: [
      v("wavering", w({ is: "client_state", client: "poland", max: 1 })),
      v("base"),
    ],
    options: (p) => [
      p("hold", opinion("army", 1), trust("AUH", -1)),
      p("later", opinion("army", -1), opinion("parliament", 1)),
      p("army", men(1), opinion("army", -1), bondBy("AUH", -1)),
    ],
  }),
  // The Ukrainian countryside against the requisitions and the landlords.
  card({
    id: "deu_settle_ukraine",
    when: all(
      w({ is: "client_state", client: "ukraine", max: 1 }),
      w({ is: "fate", fate: "state", client: "ukraine", min: 4 }),
    ),
    cast: { cos, war },
    salience: 7,
    tags: TAGS,
    once: true,
    variants: [v("war", w({ is: "war" })), v("base")],
    options: (p) => [
      p("troops", inst("army", 1), gauge("bread", 1), opinion("workers", -1)),
      p("less", gauge("bread", -1), opinion("parliament", 1)),
      p("hetman", gauge("bread", 1), opinion("press", -1)),
    ],
  }),
  // A vassal of ours drags its feet: the tribute is late, the streets stir.
  card({
    id: "deu_settle_vassal",
    when: w({ is: "vassal", max: 1 }),
    cast: { finance, interior },
    salience: 7,
    tags: TAGS,
    cooldown: 12,
    max: 2,
    variants: [
      v("fra", w({ is: "vassal", of: "FRA", max: 1 })),
      v("bel", w({ is: "vassal", of: "BEL", max: 1 })),
      v("rou", w({ is: "vassal", of: "ROU", max: 1 })),
      v("base"),
    ],
    options: (p) => [
      p("garrison", inst("army", 1), opinion("army", 1), opinion("press", -1)),
      p("ease", gauge("money", -1), opinion("business", -1)),
      p(
        "ministers",
        opinion("court", 1),
        act({ do: "readiness", tag: "USA", delta: 1 }),
      ),
    ],
  }),
  // Germany's own land was cut away: the press and the veterans remember.
  card({
    id: "deu_settle_revanche",
    when: w({ is: "revanche", min: 1 }),
    cast: { chancellor, interior },
    salience: 6,
    tags: ["home", "foreign"],
    once: true,
    variants: [
      v(
        "rhine",
        w({ is: "fate", fate: "state", as: "of", client: "rhineland" }),
      ),
      v("base"),
    ],
    options: (p) => [
      p("let", opinion("press", 1), opinion("army", 1), trust("FRA", -1)),
      p("quiet", opinion("press", -1), opinion("parliament", 1)),
      p("word", opinion("court", 1), trust("FRA", -1), trust("GBR", -1)),
    ],
  }),
];

export const DEU_SETTLE_SCENES: readonly GwScene[] = [
  SIGN,
  ...CROWNS,
  ...AFTER,
];
