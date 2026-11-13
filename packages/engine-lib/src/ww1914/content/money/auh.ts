import type { GwMoneyContent } from "../../MoneyRows";
import { REICHSRAT_OPEN } from "../house/houses";

// ww209 (W-AUH): Austria-Hungary's money bills (design §2.3). The Reichsrat
// (shut Mar 1914 - May 1917) and Budapest's own indemnity; while Vienna is
// shut the credits go by §14, half-yearly (F), voted once it sits. Budapest
// refusing: Hungary's share unpaid, its grain held back. W-AUH checks, adds
// earmarks, owners and the fleet's scenes (Cattaro). Text: AUH.house.json
// `money.mark.<id>`. See /home/eser/dev/ww209-format.md.
export const AUH_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "AUH",
      houses: ["reichsrat", "budapest"],
      credits: [
        { by: "vote", every: 6, when: REICHSRAT_OPEN },
        { by: "decree", every: 6 },
      ],
      fail: "runs_on",
      failBy: { budapest: "unpaid" },
      round: { around: "par14" },
      owners: { national: { inst: "hungary" } },
    },
  ],
  earmarks: [],
};
