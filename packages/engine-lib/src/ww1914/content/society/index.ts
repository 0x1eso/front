import { joinSociety, type GwSocietyContent } from "../../SocietyRows";
import { AUH_SOCIETY } from "./auh";
import { COMMON_SOCIETY } from "./common";
import { DEU_SOCIETY } from "./deu";
import { FRA_SOCIETY } from "./fra";
import { GBR_SOCIETY } from "./gbr";
import { RUS_SOCIETY } from "./rus";

/** ww207: every seat's communities and births, and the generic parties. */
export const GW_SOCIETY: GwSocietyContent = joinSociety([
  COMMON_SOCIETY,
  DEU_SOCIETY,
  GBR_SOCIETY,
  FRA_SOCIETY,
  RUS_SOCIETY,
  AUH_SOCIETY,
]);
