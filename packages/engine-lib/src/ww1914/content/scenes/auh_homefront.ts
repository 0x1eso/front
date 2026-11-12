// Great War 1914 (ww190 §5): Austria-Hungary's home front: women at work,
// prisoners, refugees, the wounded, the flu, hunger. Data only; the text is in
// resources/ww1914/ko/AUH.homefront.json (with the quota's new bodies, laid
// over gw_auh_quota there). Conditions and effects are S2's (HomeFront.ts).
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  atWar,
  card,
  gauge,
  inst,
  office,
  opinion,
  pick,
  w,
} from "./auh_years";

const PM = office("chancellor");
const HUN = office("hun_pm");
const WAR = office("war");

const atWarNow = w({ is: "war" });

export const AUH_HOMEFRONT_SCENES: readonly GwScene[] = [
  card({
    id: "auh_hf_women_1",
    when: all(atWarNow, w({ is: "women_work", min: 1 })),
    cast: { pm: PM },
    vs: [["more", w({ is: "women_work", min: 2 })], ["base"]],
    picks: [
      pick("wages", gauge("money", -1), gauge("morale", 1)),
      pick("as_is", gauge("shells", 1), opinion("workers", -1)),
    ],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_women_2",
    when: all(atWarNow, w({ is: "women_work", min: 2 })),
    cast: { war: WAR },
    vs: [["all", w({ is: "women_work", min: 3 })], ["base"]],
    picks: [
      pick("creches", gauge("money", -1), opinion("workers", 1)),
      pick("shifts", gauge("shells", 1), gauge("order", -1)),
    ],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_pows_ours",
    when: all(atWarNow, w({ is: "prisoners", held: "ours", min: 50 })),
    cast: { hun: HUN },
    vs: [["many", w({ is: "prisoners", held: "ours", min: 500 })], ["base"]],
    picks: [
      pick("farms", gauge("bread", 1), inst("hungary", 1)),
      pick("camps", gauge("order", 1), gauge("bread", -1)),
    ],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_pows_theirs",
    when: all(
      atWar("RUS"),
      w({ is: "prisoners", held: "theirs", tag: "RUS", min: 50 }),
    ),
    cast: { pm: PM },
    vs: [
      ["many", w({ is: "prisoners", held: "theirs", tag: "RUS", min: 300 })],
      ["base"],
    ],
    picks: [
      pick(
        "exchange",
        doWorld({ do: "exchange", tag: "RUS" }),
        gauge("morale", 1),
      ),
      pick(
        "reprisal",
        doWorld({ do: "reprisal", tag: "RUS" }),
        opinion("army", 1),
      ),
    ],
    tags: ["home", "foreign"],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_refugees",
    when: all(atWarNow, w({ is: "refugees", min: 1 })),
    cast: { pm: PM },
    vs: [["many", w({ is: "refugees", min: 2 })], ["base"]],
    picks: [
      pick("camps", gauge("money", -1), gauge("order", 1)),
      pick("cities", gauge("order", -1), inst("nations", 1)),
    ],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_wounded",
    when: all(atWarNow, w({ is: "war_months", own: true, min: 6 })),
    cast: { war: WAR },
    vs: [["long", w({ is: "war_months", own: true, min: 24 })], ["base"]],
    picks: [
      pick("schools", gauge("money", -1), gauge("morale", 1)),
      pick("back", doWorld({ do: "manpower", delta: 1 }), gauge("morale", -1)),
    ],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_flu",
    when: w({ is: "flu", min: 1 }),
    cast: { pm: PM },
    vs: [["later", w({ is: "flu", min: 2 })], ["base"]],
    picks: [
      pick("close", gauge("shells", -1), gauge("morale", 1)),
      pick("open", gauge("order", -1), gauge("shells", 1)),
    ],
    cooldown: 4,
  }),
  card({
    id: "auh_hf_hunger",
    when: all(atWarNow, w({ is: "hunger", min: 1 })),
    cast: { pm: PM, hun: HUN },
    vs: [["worse", w({ is: "hunger", min: 2 })], ["base"]],
    picks: [
      pick("ration", gauge("bread", 1), gauge("morale", -1)),
      pick(
        "budapest",
        inst("hungary", -1),
        gauge("bread", 1),
        inst("council", 1),
      ),
    ],
    cooldown: 4,
  }),
];
