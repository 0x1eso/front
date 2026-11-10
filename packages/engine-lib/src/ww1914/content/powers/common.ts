// Great War 1914: what every seat's 통치 tab shares (ww169). The talk a signer
// is sounded out in, and the person's own end (phase 2): abdication for the
// three crowns, resignation for the Prime Minister and the President. Text in
// resources/ww1914/ko/common.powers.json (names, notes, the memoirs).
import type { GwEnding } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_POWER_SOUND, GwPowerRow } from "../../PowerRows";

const regime = (...of: string[]): GwCond => ({
  kind: "world",
  of: { is: "regime", of },
});

/** The person lays it down himself: lawful, his own, the game ends. */
const ownEnd = (
  tag: GwTag,
  name: string,
  ends: GwEnding,
  shows: GwCond,
): GwPowerRow => ({
  id: `${tag.toLowerCase()}_pw_${name}`,
  tag,
  group: "home",
  kind: "lawful",
  shows,
  once: true,
  tags: [],
  effects: [],
  ends,
});

/** Abdication and resignation (design B2: the player's own ending). */
export const COMMON_POWERS: readonly GwPowerRow[] = [
  ownEnd("DEU", "abdicate", "deu_end_abdicated", regime("empire")),
  ownEnd(
    "GBR",
    "resign",
    "gbr_end_resigned",
    regime("liberal", "coalition", "war_cabinet", "national"),
  ),
  ownEnd(
    "AUH",
    "abdicate",
    "auh_e_abdicated",
    regime("dual_monarchy", "karl", "ff_throne"),
  ),
  ownEnd("RUS", "abdicate", "rus_abdicated", regime("tsar")),
  ownEnd(
    "FRA",
    "resign",
    "fra_end_stood_down",
    regime("fra_republic", "fra_union", "fra_tiger"),
  ),
];

/** He said he would sign (Powers.ts writes the memory before laying it). */
const saidYes = {
  kind: "memory",
  key: "k_pw_said_yes",
  who: { role: "signer" },
  within: 0,
} as const;

export const COMMON_POWER_SCENES: readonly GwScene[] = [
  {
    id: GW_POWER_SOUND,
    nation: ["DEU", "GBR", "AUH", "RUS", "FRA"],
    kind: "talk",
    scheduledOnly: true,
    cast: { signer: { called: true } },
    who: "signer",
    start: "open",
    salience: 5,
    tags: ["people"],
    variants: [{ id: "base" }],
    nodes: {
      open: {
        says: [{ id: "yes", when: saidYes }, { id: "base" }],
        replies: [
          {
            id: "thank",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
];
