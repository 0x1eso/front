import type { GwMoneyContent } from "../../MoneyRows";

// ww209 (W-RUS): Russia's money bills (design §2.3). The Duma, then the State
// Council; war credits by supreme command (Fundamental Laws, Arts. 114-117):
// nothing to vote, though the seat may put them to the Duma anyway
// (`budget_put` credits). A refused budget legally leaves last year's in
// force; Art. 87 in recess. W-RUS checks, adds earmarks (Galicia's relief),
// owners and the fleet's scenes. Text: RUS.house.json `money.mark.<id>`. See
// /home/eser/dev/ww209-format.md.
export const RUS_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "RUS",
      houses: ["duma", "council"],
      credits: [{ by: "command", every: 6 }],
      fail: "runs_on",
      round: { around: "art87" },
      owners: { army: { office: "supreme_commander" } },
    },
  ],
  earmarks: [],
};
