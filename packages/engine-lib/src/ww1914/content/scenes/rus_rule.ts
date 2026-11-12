import type { GwRulePolicy } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, assuming } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";
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
 * RUS's scenes: ruling occupied land, as ruler and as ruled (ww190 §3,
 * `rus_oc_*`). As ruler: one governing card per likely land (Galicia, East
 * Prussia, Turkish Armenia), once, then requisition, hostages, the Uniate
 * metropolitan, a Polish client and relief by state. As ruled: Russian Poland
 * under German rule. Cooldown 4. Text: resources/ww1914/ko/RUS.rule.json.
 */

type RuleFx = Omit<Extract<GwWorldEffect, { do: "rule" }>, "do" | "of">;
const rule = (of: GwTag, fx: RuleFx) => dw({ do: "rule", of, ...fx });
const rules = (of: GwTag, min?: number): GwCond =>
  w(min === undefined ? { is: "rule", of } : { is: "rule", of, min });
const policy = (of: GwTag, p: GwRulePolicy): GwCond =>
  w({ is: "rule", of, policy: p });
/** Our men have held two or more of `of`'s places three months. */
const taken = (from: GwTag): GwCond =>
  all(w({ is: "land_taken", from, min: 3 }), rules(from));

const WAR = { war: held("war") };
const COS = { cos: held("chief_of_staff") };
const INTERIOR = { interior: held("interior") };
const FOREIGN = { foreign: held("foreign") };

const RULER: GwScene[] = [
  rusScene("rus_oc_galicia", {
    kind: "proposal",
    when: taken("AUH"),
    cast: { ...WAR, ...INTERIOR },
    salience: 7,
    tags: ["war", "home"],
    once: true,
    variants: [
      assuming(v("lemberg", w({ is: "held", place: "lemberg", by: "us" })), {
        held: { lemberg: "us" },
      }),
      v("base"),
    ],
    options: [
      o("russian", [
        rule("AUH", { policy: "army", hard: 2 }),
        inst("court", 1),
      ]),
      o("governor", [rule("AUH", { policy: "civil", hard: 1 })]),
      o("light", [
        rule("AUH", { policy: "civil", relief: true }),
        opinion("army", -1),
      ]),
    ],
  }),
  rusScene("rus_oc_prussia", {
    kind: "proposal",
    when: taken("DEU"),
    cast: { ...COS, ...INTERIOR },
    salience: 7,
    tags: ["war"],
    once: true,
    variants: [v("base")],
    options: [
      o("army", [rule("DEU", { policy: "army", hard: 2 }), inst("stavka", 1)]),
      o("civil", [rule("DEU", { policy: "civil", hard: 1 })]),
      o("correct", [
        rule("DEU", { policy: "civil", relief: true }),
        trust("USA", 1),
      ]),
    ],
  }),
  rusScene("rus_oc_armenia", {
    kind: "proposal",
    when: taken("OTT"),
    cast: { ...WAR, ...FOREIGN },
    salience: 6,
    tags: ["war", "foreign"],
    once: true,
    variants: [
      assuming(v("erzurum", w({ is: "held", place: "erzurum", by: "us" })), {
        held: { erzurum: "us" },
      }),
      v("base"),
    ],
    options: [
      o("army", [rule("OTT", { policy: "army", hard: 1 })]),
      o("armenians", [
        rule("OTT", { policy: "civil", relief: true }),
        trust("GBR", 1),
        opinion("army", -1),
      ]),
      o("settlers", [
        rule("OTT", { policy: "army", hard: 2 }),
        opinion("court", 1),
      ]),
    ],
  }),
  rusScene("rus_oc_requisition", {
    kind: "proposal",
    when: all(rules("AUH"), w({ is: "land_taken", from: "AUH", min: 5 })),
    cast: { ...WAR },
    salience: 5,
    tags: ["war", "home"],
    cooldown: 4,
    variants: [v("hard", rules("AUH", 2)), v("base")],
    options: [
      o("take", [rule("AUH", { hard: 1 }), gauge("bread", 1)]),
      o("receipts", [rule("AUH", { hard: -1 }), gauge("money", -1)]),
      o("as_now", [opinion("army", -1)]),
    ],
  }),
  rusScene("rus_oc_hostages", {
    kind: "proposal",
    when: all(rules("DEU"), w({ is: "resist", of: "DEU", min: 2 })),
    cast: { ...COS },
    salience: 6,
    tags: ["war"],
    cooldown: 4,
    variants: [v("base")],
    options: [
      o("hostages", [rule("DEU", { hard: 1 }), gauge("order", 1)]),
      o("garrison", [men(-1), inst("stavka", -1)]),
      o("bread", [rule("DEU", { relief: true }), gauge("bread", -1)]),
    ],
  }),
  rusScene("rus_oc_uniates", {
    kind: "proposal",
    when: all(rules("AUH"), w({ is: "land_taken", from: "AUH", min: 4 })),
    cast: { ...INTERIOR, court: held("court") },
    salience: 6,
    tags: ["war", "home"],
    once: true,
    variants: [v("army", policy("AUH", "army")), v("base")],
    options: [
      o("deport", [
        rule("AUH", { hard: 1 }),
        inst("court", 1),
        trust("USA", -1),
      ]),
      o("watch", [opinion("court", -1)]),
      o("free", [rule("AUH", { hard: -1 }), inst("court", -1)]),
    ],
  }),
  rusScene("rus_oc_client", {
    kind: "proposal",
    when: all(
      any(rules("AUH"), rules("DEU")),
      w({ is: "war_months", own: true, min: 6 }),
    ),
    cast: { ...FOREIGN },
    salience: 6,
    tags: ["war", "foreign"],
    once: true,
    variants: [v("base")],
    options: [
      o(
        "poland_from_vienna",
        [
          rule("AUH", { policy: "client", client: "poland" }),
          inst("court", -1),
        ],
        rules("AUH"),
      ),
      o(
        "poland_from_berlin",
        [
          rule("DEU", { policy: "client", client: "poland" }),
          inst("court", -1),
        ],
        rules("DEU"),
      ),
      o("no_kingdom", [inst("court", 1), trust("FRA", -1)]),
    ],
  }),
];

const ruledBy = (by: GwTag, min?: number): GwCond =>
  w(min === undefined ? { is: "ruled", by } : { is: "ruled", by, min });

const RULED: GwScene[] = [
  rusScene("rus_oc_ruled_poland", {
    kind: "proposal",
    when: ruledBy("DEU"),
    cast: { ...FOREIGN },
    salience: 6,
    tags: ["war", "foreign"],
    cooldown: 4,
    variants: [
      assuming(v("warsaw", w({ is: "held", place: "warsaw", by: "foe" })), {
        held: { warsaw: "foe" },
      }),
      v("base"),
    ],
    options: [
      o("autonomy", [inst("court", -1), gauge("morale", 1), trust("FRA", 1)]),
      o("neutrals", [trust("USA", 1), gauge("money", -1)]),
      o("silence", [opinion("press", -1)]),
    ],
  }),
  rusScene("rus_oc_ruled_deport", {
    kind: "proposal",
    when: w({ is: "ruled", min: 2 }),
    cast: { ...FOREIGN, ...INTERIOR },
    salience: 6,
    tags: ["war", "home"],
    cooldown: 4,
    variants: [
      assuming(v("deu", ruledBy("DEU", 2)), { held: { lodz: "foe" } }),
      v("base"),
    ],
    options: [
      o("red_cross", [gauge("money", -1), gauge("morale", 1)]),
      o("tell_world", [trust("USA", 1), opinion("press", 1)]),
      o("silence", [gauge("morale", -1)]),
    ],
  }),
];

export const RUS_RULE_SCENES: readonly GwScene[] = [...RULER, ...RULED];
