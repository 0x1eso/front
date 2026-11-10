// Great War 1914: what every seat's 통치 tab shares (ww169). The talk a signer
// is sounded out in; text in resources/ww1914/ko/common.powers.json.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_POWER_SOUND } from "../../PowerRows";

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
