import type { GwMoneyContent } from "../../MoneyRows";

// ww209 (W-GBR): Britain's money bills (design §2.3). The Commons only: the
// Lords can't touch a money bill (Parliament Act 1911). Votes of credit about
// every 4 chapters (the first £100 m, Aug 1914, F). Supply is confidence: a
// lost budget or vote of credit is a fall step at once. Prorogued: supply by
// Order in Council. W-GBR checks (F), adds earmarks and owners. Text:
// GBR.house.json `money.mark.<id>`. See /home/eser/dev/ww209-format.md.
export const GBR_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "GBR",
      houses: ["commons"],
      credits: [{ by: "vote", every: 4 }],
      fail: "confidence",
      round: { flag: "f_gbr_prorogued" },
    },
  ],
  earmarks: [],
};
