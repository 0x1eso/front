// Great War 1914 (ww190 §9): Austria-Hungary's sea: the fleet at Pola, the
// Otranto barrage, Cattaro, Tsingtao, the Danube and Albania. Data only; the
// text is in resources/ww1914/ko/AUH.colonies.json. `sea_hold` is S2's (Seas.ts).
import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  atWar,
  card,
  gauge,
  inst,
  low,
  office,
  opinion,
  pick,
  trust,
  w,
} from "./auh_years";

const NAVY = office("navy");
const COS = office("chief_of_staff");
const WAR = office("war");

const adriatic = (by: "us" | "foe" | "none"): GwCond =>
  w({ is: "sea_hold", sea: "adriatic", by });
const months = (min: number, max?: number): GwCond =>
  w(
    max === undefined
      ? { is: "war_months", own: true, min }
      : { is: "war_months", own: true, min, max },
  );
const roll = (
  key: string,
  pct: number,
  then: GwEffect[],
  otherwise: GwEffect[],
): GwEffect => ({ kind: "roll", key, pct, then, otherwise });
const atSea = any(atWar("ITA"), atWar("FRA"), atWar("GBR"));

export const AUH_COLONIES_SCENES: readonly GwScene[] = [
  card({
    id: "auh_cs_fleet_harbour",
    when: all(atSea, months(2)),
    cast: { navy: NAVY },
    vs: [["foe_sea", adriatic("foe")], ["ours", adriatic("us")], ["base"]],
    picks: [
      pick("harbour", opinion("army", -1), gauge("shells", 1)),
      pick(
        "sortie",
        roll(
          "auh_cs_sortie",
          45,
          [gauge("morale", 1)],
          [gauge("morale", -1), gauge("money", -1)],
        ),
      ),
    ],
    tags: ["war"],
    cooldown: 4,
  }),
  card({
    id: "auh_cs_fleet_idle",
    when: all(atSea, months(18)),
    cast: { navy: NAVY, war: WAR },
    vs: [["hungry", low("bread", 1)], ["base"]],
    picks: [
      pick("crews", doWorld({ do: "manpower", delta: 1 }), gauge("morale", -1)),
      pick("leave", gauge("order", -1), gauge("morale", 1)),
    ],
    tags: ["war", "home"],
    cooldown: 4,
  }),
  card({
    id: "auh_cs_otranto",
    when: all(atWar("ITA"), atWar("GBR"), months(18)),
    cast: { navy: NAVY },
    vs: [["foe_sea", adriatic("foe")], ["base"]],
    picks: [
      pick(
        "raid",
        roll(
          "auh_cs_otranto",
          55,
          [gauge("morale", 1), opinion("press", 1)],
          [gauge("morale", -1)],
        ),
      ),
      pick("keep", opinion("army", -1)),
    ],
    tags: ["war"],
    once: true,
  }),
  card({
    id: "auh_cs_cattaro",
    when: all(
      atSea,
      months(30),
      any(w({ is: "hunger", min: 1 }), low("morale", 2)),
    ),
    cast: { navy: NAVY },
    vs: [["red", w({ is: "unrest", min: 2 })], ["base"]],
    picks: [
      pick(
        "courts",
        gauge("order", 1),
        gauge("morale", -1),
        opinion("workers", -1),
      ),
      pick("bread", gauge("order", -1), gauge("morale", 1), gauge("bread", -1)),
    ],
    salience: 7,
    tags: ["war", "home", "tension_up"],
    once: true,
  }),
  card({
    id: "auh_cs_tsingtao",
    when: all(atWar("JPN"), months(0, 4)),
    cast: { navy: NAVY },
    vs: [["base"]],
    tags: ["war", "foreign"],
    salience: 5,
    once: true,
  }),
  card({
    id: "auh_cs_barrage",
    when: all(atWar("ITA"), months(36), adriatic("foe")),
    cast: { navy: NAVY },
    vs: [["again", { kind: "seen", scene: "auh_cs_otranto" }], ["base"]],
    picks: [
      pick(
        "battleships",
        roll(
          "auh_cs_barrage",
          45,
          [gauge("morale", 1)],
          [gauge("morale", -2), opinion("press", -1)],
        ),
      ),
      pick("stay", opinion("army", -1)),
    ],
    tags: ["war"],
    once: true,
  }),
  card({
    id: "auh_cs_danube",
    when: any(atWar("SRB"), atWar("ROU")),
    cast: { cos: COS },
    vs: [["romania", atWar("ROU")], ["base"]],
    picks: [
      pick("forward", gauge("shells", -1), opinion("army", 1)),
      pick("crossings", inst("army", 1)),
    ],
    tags: ["war"],
    cooldown: 6,
    max: 2,
  }),
  card({
    id: "auh_cs_albania",
    when: all(
      atWar("ITA"),
      any(w({ is: "land_taken", group: ["albania"] }), adriatic("us")),
    ),
    cast: { cos: COS },
    vs: [["held", w({ is: "land_taken", group: ["albania"] })], ["base"]],
    picks: [
      pick("road", gauge("money", -1), gauge("shells", 1)),
      pick("bands", doWorld({ do: "manpower", delta: 1 }), trust("ITA", -1)),
    ],
    tags: ["war", "foreign"],
    cooldown: 6,
    max: 2,
  }),
];
