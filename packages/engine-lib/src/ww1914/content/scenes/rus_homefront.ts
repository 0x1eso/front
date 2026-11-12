import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
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
 * RUS's scenes: the home front (ww190 §5, `rus_hf_*`): women at work twice,
 * prisoners held and prisoners lost, refugees, the wounded, the flu, hunger.
 * Cooldown 4. Text: resources/ww1914/ko/RUS.homefront.json.
 */

const own = (min: number): GwCond => w({ is: "war_months", own: true, min });
const theirs = (tag: GwTag, min: number): GwCond =>
  w({ is: "prisoners", held: "theirs", tag, min });
const ours = (tag: GwTag, min: number): GwCond =>
  w({ is: "prisoners", held: "ours", tag, min });
const crowned = w({ is: "regime", of: ["tsar", "crown", "regency"] });

const WAR = { war: held("war") };
const INTERIOR = { interior: held("interior") };
const AGRI = { agri: held("agriculture") };

export const RUS_HOMEFRONT_SCENES: readonly GwScene[] = [
  rusScene("rus_hf_women_factories", {
    kind: "proposal",
    when: w({ is: "women_work", min: 1 }),
    cast: { ...WAR },
    salience: 5,
    tags: ["home"],
    cooldown: 4,
    variants: [v("many", w({ is: "women_work", min: 3 })), v("base")],
    options: [
      o("open_shops", [gauge("shells", 1), opinion("business", 1)]),
      o("same_pay", [opinion("workers", 1), gauge("money", -1)]),
      o("as_it_is", [opinion("workers", -1)]),
    ],
  }),
  rusScene("rus_hf_women_front", {
    kind: "proposal",
    when: all(w({ is: "women_work", min: 2 }), own(12)),
    cast: { ...WAR },
    salience: 5,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("battalion", [men(1), gauge("morale", 1), opinion("army", -1)]),
      o("nurses", [gauge("morale", 1)]),
      o("home", [opinion("press", -1)]),
    ],
  }),
  rusScene("rus_hf_pows_ours", {
    kind: "proposal",
    when: ours("AUH", 50),
    cast: { ...WAR, ...INTERIOR },
    salience: 5,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [v("many", ours("AUH", 500)), v("base")],
    options: [
      o("railway", [gauge("shells", 1), trust("AUH", -1)]),
      o("farms", [gauge("bread", 1)]),
      o("exchange", [dw({ do: "exchange", tag: "AUH" })]),
    ],
  }),
  rusScene("rus_hf_pows_theirs", {
    kind: "proposal",
    when: theirs("DEU", 50),
    cast: { foreign: held("foreign") },
    salience: 5,
    tags: ["home", "foreign"],
    cooldown: 4,
    variants: [v("many", theirs("DEU", 500)), v("base")],
    options: [
      o("exchange", [dw({ do: "exchange", tag: "DEU" })]),
      o("parcels", [gauge("money", -1), gauge("morale", 1)]),
      o("reprisal", [dw({ do: "reprisal", tag: "DEU" })]),
    ],
  }),
  rusScene("rus_hf_refugees", {
    kind: "proposal",
    when: w({ is: "refugees", min: 1 }),
    cast: { ...INTERIOR },
    salience: 6,
    tags: ["home"],
    cooldown: 4,
    variants: [
      v("flood", w({ is: "refugees", min: 2 })),
      v("committee", crowned),
      v("base"),
    ],
    options: [
      o("committee", [
        gauge("money", -1),
        gauge("morale", 1),
        inst("court", 1),
      ]),
      o("zemstvos", [inst("duma", 1), inst("court", -1)]),
      o("east", [gauge("order", -1), gauge("bread", 1)]),
    ],
  }),
  rusScene("rus_hf_wounded", {
    kind: "proposal",
    when: own(3),
    cast: { ...WAR },
    salience: 5,
    tags: ["home", "war"],
    cooldown: 4,
    variants: [v("palace", crowned), v("base")],
    options: [
      o("unions", [inst("duma", 1), gauge("morale", 1), inst("court", -1)]),
      o("army", [inst("stavka", 1), gauge("money", -1)]),
      o("towns", [gauge("money", -1), gauge("morale", 1)]),
    ],
  }),
  rusScene("rus_hf_flu", {
    kind: "proposal",
    when: w({ is: "flu", min: 1 }),
    cast: { ...INTERIOR },
    salience: 6,
    tags: ["home"],
    cooldown: 4,
    variants: [v("second", w({ is: "flu", min: 2 })), v("base")],
    options: [
      o("close", [gauge("order", 1), gauge("morale", -1)]),
      o("doctors", [men(-1), gauge("morale", 1)]),
      o("carry_on", [gauge("shells", 1), gauge("morale", -1)]),
    ],
  }),
  rusScene("rus_hf_hunger", {
    kind: "proposal",
    when: w({ is: "hunger", min: 1 }),
    cast: { ...AGRI, ...INTERIOR },
    salience: 7,
    tags: ["home"],
    cooldown: 4,
    variants: [v("worse", w({ is: "hunger", min: 2 })), v("base")],
    options: [
      o("fixed_prices", [gauge("order", 1), opinion("business", -1)]),
      o("quota", [gauge("bread", 1), gauge("order", -1)]),
      o("import", [gauge("bread", 1), gauge("money", -1)]),
    ],
  }),
];
