// Great War 1914 (ww190 §5): Germany's home front. Owned by the DEU writer
// lane. Women at work, prisoners both ways, refugees, the wounded, the flu
// and hunger, each called by the state. Text in
// resources/ww1914/ko/DEU.homefront.json.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  act,
  atWar,
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

const interior = holder("interior");
const finance = holder("finance");
const war = holder("war");
const cos = holder("chief_of_staff");
const chancellor = holder("chancellor");
const foreign = holder("foreign");

const TAGS: GwScene["tags"] = ["home", "war"];
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const theirs = (tag: GwTag, min: number): GwCond =>
  w({ is: "prisoners", held: "theirs", tag, min });
/** Through Switzerland with whoever holds most of ours: France, then Russia, then Britain. */
const swap: GwEffect[] = [
  maybe(theirs("FRA", 20), act({ do: "exchange", tag: "FRA" })),
  maybe(
    { kind: "not", of: theirs("FRA", 20) },
    maybe(theirs("RUS", 20), act({ do: "exchange", tag: "RUS" })),
    maybe(
      { kind: "not", of: theirs("RUS", 20) },
      act({ do: "exchange", tag: "GBR" }),
    ),
  ),
];

export const DEU_HOMEFRONT_SCENES: readonly GwScene[] = [
  card({
    id: "deu_hf_women",
    when: w({ is: "women_work", min: 1 }),
    cast: { war, interior },
    salience: 6,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [v("first", w({ is: "women_work", max: 1 })), v("base")],
    options: (p) => [
      p("as_is", opinion("business", 1)),
      p("wages", gauge("money", -1), gauge("morale", 1)),
      p("nurseries", gauge("money", -1), gauge("order", 1)),
    ],
  }),
  card({
    id: "deu_hf_women_vote",
    when: w({ is: "women_work", min: 2 }),
    cast: { chancellor, war },
    salience: 7,
    tags: TAGS,
    cooldown: 4,
    max: 2,
    variants: [v("law", w({ is: "women_work", min: 3 })), v("base")],
    options: (p) => [
      p("nothing", opinion("workers", -1)),
      p("service", men(1), gauge("order", -1)),
      p("word", gauge("morale", 1), opinion("parliament", 1), inst("army", -1)),
    ],
  }),
  card({
    id: "deu_hf_pow_camps",
    when: w({ is: "prisoners", held: "ours", min: 100 }),
    cast: { war, foreign },
    salience: 6,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [
      v("many", w({ is: "prisoners", held: "ours", min: 500 })),
      v("base"),
    ],
    options: (p, q) => [
      p("farms", gauge("bread", 1), trust("USA", -1)),
      p("by_rules", gauge("money", -1), trust("USA", 1)),
      q(
        "reprisal",
        atWar("GBR"),
        act({ do: "reprisal", tag: "GBR" }),
        opinion("press", 1),
      ),
    ],
  }),
  card({
    id: "deu_hf_pow_ours",
    when: w({ is: "prisoners", held: "theirs", min: 50 }),
    cast: { foreign, interior },
    salience: 6,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [v("rus", theirs("RUS", 100)), v("base")],
    options: (p) => [
      p("silence", censor(1)),
      p("swiss", ...swap),
      p("parcels", gauge("money", -1), gauge("morale", 1)),
    ],
  }),
  card({
    id: "deu_hf_refugees",
    when: w({ is: "refugees", min: 1 }),
    cast: { interior, finance },
    salience: 6,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [
      v("east", w({ is: "land_lost", to: "RUS", group: ["east_prussia"] })),
      v("base"),
    ],
    options: (p) => [
      p("camps", gauge("order", -1)),
      p("housing", gauge("money", -1), gauge("order", 1)),
      p("farms", gauge("bread", 1), opinion("business", -1)),
    ],
  }),
  card({
    id: "deu_hf_wounded",
    when: w({ is: "war_months", own: true, min: 10 }),
    cast: { war, finance },
    salience: 6,
    tags: TAGS,
    cooldown: 4,
    max: 3,
    variants: [
      v("long", w({ is: "war_months", own: true, min: 30 })),
      v("base"),
    ],
    options: (p) => [
      p("work", gauge("order", 1), opinion("business", 1)),
      p("pensions", gauge("money", -1), gauge("morale", 1)),
      p("back", men(1), gauge("morale", -1)),
    ],
  }),
  card({
    id: "deu_hf_flu",
    when: w({ is: "flu", min: 1 }),
    cast: { interior, cos },
    salience: 7,
    tags: TAGS,
    cooldown: 4,
    variants: [
      v("third", w({ is: "flu", min: 3 })),
      v("second", w({ is: "flu", min: 2 })),
      v("base"),
    ],
    options: (p) => [
      p("quiet", censor(1), gauge("morale", -1)),
      p("close", gauge("shells", -1), gauge("order", 1)),
      p("work_on", men(-1), gauge("shells", 1)),
    ],
  }),
  card({
    id: "deu_hf_hunger",
    when: w({ is: "hunger", min: 1 }),
    cast: { interior, chancellor },
    salience: 7,
    tags: TAGS,
    cooldown: 4,
    variants: [
      v("worst", w({ is: "hunger", min: 3 })),
      v("turnip", w({ is: "hunger", min: 2 })),
      v("base"),
    ],
    options: (p) => [
      p("ration", gauge("bread", 1), gauge("morale", -1)),
      p("kitchens", gauge("money", -1), gauge("order", 1)),
      p("blame", gauge("morale", 1), opinion("press", 1), trust("GBR", -1)),
    ],
  }),
];
