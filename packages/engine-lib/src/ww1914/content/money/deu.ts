import type { GwMoneyContent } from "../../MoneyRows";

// ww209 (W-DEU): Germany's money bills (design §2.3). The Reichstag, then the
// Bundesrat; war credits half-yearly; a refused budget leaves last year's
// running and the chancellor may dissolve over it (1906 → the 1907
// "Hottentot" election); the Prussian conflict's way round, once. S0's values
// are marked F: W-DEU checks them, adds earmarks, the lines' owners, and the
// SPD's purse and wing in content/house/deu.ts. Text: DEU.house.json
// `money.mark.<id>`. See /home/eser/dev/ww209-format.md.
export const DEU_MONEY: GwMoneyContent = {
  rows: [
    {
      tag: "DEU",
      houses: ["reichstag", "bundesrat"],
      // F: credits of Aug 1914, Dec 1914, Mar 1915 ... about half-yearly.
      credits: [{ by: "vote", every: 6 }],
      fail: "runs_on",
      round: { flag: "f_deu_no_budget" },
      dissolve: true,
      owners: { army: { office: "chief_of_staff" } },
    },
  ],
  earmarks: [],
};
