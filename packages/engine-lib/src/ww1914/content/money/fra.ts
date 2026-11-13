import type { GwMoneyContent } from "../../MoneyRows";

// ww209 (W-FRA): France's money bills (design §2.3). The Chambre, then the
// Sénat, equal; the provisional twelfths voted quarterly (Sept 1916 passed
// 448:4 with the socialists); a cabinet falls on a lost money vote. No way
// round: the state of siege carries no money. W-FRA checks, adds earmarks
// and owners. Text: FRA.house.json `money.mark.<id>`. See
// /home/eser/dev/ww209-format.md.
export const FRA_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "FRA",
      houses: ["chambre", "senat"],
      credits: [{ by: "vote", every: 3 }],
      fail: "confidence",
    },
  ],
  earmarks: [],
};
