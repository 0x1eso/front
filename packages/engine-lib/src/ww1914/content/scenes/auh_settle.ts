// Great War 1914 (ww199): a beaten country's fate, as the emperor sees it.
// The sign card in the ruler's voice (`auh_settle_sign`, used before the
// common `gw_settle_sign`), the seat's own crown papers for the thrones a
// Habsburg could take (Poland: Archduke Karl Stephan; Ukraine: Archduke
// Wilhelm), and the years after: a vassal's tribute, a vassal turning, the
// Ukrainian state asking for East Galicia, a founded Poland asking for its own
// army, and the monarchy's own revanche. Data only; the text is in
// resources/ww1914/ko/AUH.settle.json. See /home/eser/dev/ww199-format.md.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_VASSAL_SLOTS } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwClient, GwSignHow } from "@openfront/engine-api/ww1914/GwFate";
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import { ffThrone, karl } from "./auh_act";
import {
  arms,
  card,
  gauge,
  inst,
  maybe,
  office,
  opinion,
  pick,
  trust,
  w,
} from "./auh_years";

const COS = office("chief_of_staff");
const FM = office("foreign");
const PM = office("chancellor");
const FIN = office("finance");

/** A table sits with Austria in a chair and `of` beaten. */
const open = (of: GwTag): GwCond => w({ is: "settle_open", of });
const sign = (how: GwSignHow): GwEffect => doWorld({ do: "treaty_sign", how });
const crown = (client: GwClient, p: string): GwEffect =>
  doWorld({ do: "crown", client, pick: p });

/** The lands Austria may hold as vassals; each with the slot cut from it. */
const VASSAL_LANDS: readonly GwTag[] = ["SRB", "MNE", "ROU", "ALB", "ITA"];
const vassalOf = (of: GwTag, r: { max?: number } = {}): GwCond =>
  w({ is: "vassal", of, ...r });
/** Each vassal land's trust in us moves (the land itself and its slot). */
const eachVassal = (delta: number): GwEffect[] =>
  VASSAL_LANDS.map((t) => {
    const slot = GW_VASSAL_SLOTS[t];
    return maybe(
      vassalOf(t),
      trust(t, delta),
      ...(slot === undefined ? [] : [trust(slot, delta)]),
    );
  });

/** A Ukrainian state stands, ours or Berlin's. */
const ukraine = any(
  w({ is: "client_state", client: "ukraine" }),
  w({ is: "client_state", client: "ukraine", by: "DEU" }),
);

// ---- The table: the ruler signs ----

const signCard = card({
  id: "auh_settle_sign",
  when: w({ is: "settle_open" }),
  cast: { fm: FM },
  vs: [
    ["karl_rus", all(karl, open("RUS"))],
    ["karl_rou", all(karl, open("ROU"))],
    ["karl", karl],
    ["ff", ffThrone],
    ["fj_srb", open("SRB")],
    ["fj_mne", open("MNE")],
    ["base"],
  ],
  picks: [
    pick("sign", sign("sign")),
    pick("press", sign("press")),
    pick("reserve", sign("reserve")),
  ],
  salience: 9,
  tags: ["foreign"],
});
// Laid by Fate.ts when the seat's table opens; it may come at every table.
signCard.scheduledOnly = true;
signCard.essential = true;

// ---- The crowns a Habsburg could wear ----

const crownCard = (client: GwClient, picks: readonly string[]): GwScene => {
  const s = card({
    id: `auh_settle_crown_${client}`,
    when: w({ is: "client_state", client }),
    cast: { fm: FM },
    vs: [["base"]],
    picks: [...picks, "regency"].map((p) => pick(p, crown(client, p))),
    salience: 8,
    tags: ["foreign"],
  });
  // Laid by Fate.ts the chapter after the state is founded.
  s.scheduledOnly = true;
  s.essential = true;
  // Left to the department, the throne waits under a regency council.
  s.fallback = "regency";
  return s;
};

// ---- The years after ----

const AFTER: readonly GwScene[] = [
  card({
    id: "auh_st_tribute",
    when: any(...VASSAL_LANDS.map((t) => vassalOf(t))),
    cast: { fin: FIN, fm: FM },
    vs: [["serbia", vassalOf("SRB")], ["romania", vassalOf("ROU")], ["base"]],
    picks: [
      pick("full", gauge("bread", 1), gauge("money", 1), ...eachVassal(-1)),
      pick("ease", gauge("bread", -1), inst("hungary", -1), ...eachVassal(1)),
    ],
    tags: ["foreign", "home"],
    cooldown: 6,
  }),
  card({
    id: "auh_st_vassal_turning",
    when: any(...VASSAL_LANDS.map((t) => vassalOf(t, { max: 1 }))),
    cast: { cos: COS, fm: FM },
    vs: [
      ["serbia", vassalOf("SRB", { max: 1 })],
      ["montenegro", vassalOf("MNE", { max: 1 })],
      ["romania", vassalOf("ROU", { max: 1 })],
      ["base"],
    ],
    picks: [
      pick(
        "garrison",
        doWorld({ do: "manpower", delta: -1 }),
        opinion("army", 1),
        ...eachVassal(-1),
      ),
      pick("loosen", gauge("money", -1), opinion("army", -1), ...eachVassal(1)),
    ],
    salience: 7,
    tags: ["foreign", "tension_up"],
    cooldown: 6,
  }),
  card({
    id: "auh_st_galicia_ask",
    when: ukraine,
    cast: { pm: PM, fm: FM },
    vs: [["base"]],
    picks: [
      pick("promise", trust("UKR", 1), inst("nations", -1), gauge("bread", 1)),
      pick("refuse", trust("UKR", -1), inst("nations", 1), gauge("bread", -1)),
    ],
    salience: 7,
    tags: ["foreign", "home"],
    once: true,
  }),
  card({
    id: "auh_st_poland_army",
    when: w({ is: "client_state", client: "poland" }),
    cast: { cos: COS, fm: FM },
    vs: [["base"]],
    picks: [
      pick("allow", trust("POL", 1), inst("nations", 1), opinion("army", -1)),
      pick("refuse", trust("POL", -1), opinion("army", 1)),
    ],
    tags: ["foreign"],
    once: true,
  }),
  card({
    id: "auh_st_revanche",
    when: w({ is: "revanche", min: 1 }),
    cast: { cos: COS, pm: PM },
    vs: [
      [
        "bohemia",
        w({ is: "fate", fate: "state", as: "of", client: "bohemia" }),
      ],
      ["italy", w({ is: "fate", as: "of", tag: "ITA" })],
      ["base"],
    ],
    picks: [
      pick("rearm", arms("army", 1), gauge("money", -1), opinion("army", 1)),
      pick(
        "bear",
        opinion("army", -1),
        opinion("press", -1),
        gauge("order", 1),
      ),
    ],
    salience: 7,
    tags: ["home", "tension_up"],
    cooldown: 8,
  }),
];

export const AUH_SETTLE_SCENES: readonly GwScene[] = [
  signCard,
  crownCard("poland", ["karl_stephan"]),
  crownCard("ukraine", ["archduke_wilhelm", "skoropadsky"]),
  ...AFTER,
];
