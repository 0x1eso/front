import { joinMoney, type GwMoneyContent } from "../../MoneyRows";
import { AUH_MONEY } from "./auh";
import { DEU_MONEY } from "./deu";
import { FRA_MONEY } from "./fra";
import { GBR_MONEY } from "./gbr";
import { RUS_MONEY } from "./rus";

/** ww209: every seat's money bills and earmarks. */
export const GW_MONEY: GwMoneyContent = joinMoney([
  DEU_MONEY,
  GBR_MONEY,
  FRA_MONEY,
  RUS_MONEY,
  AUH_MONEY,
]);
