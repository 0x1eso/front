import { joinUtopia, type GwUtopiaContent } from "../../UtopiaRows";
import { AUH_UTOPIA } from "./auh";
import { DEU_UTOPIA } from "./deu";
import { FRA_UTOPIA } from "./fra";
import { GBR_UTOPIA } from "./gbr";
import { RUS_UTOPIA } from "./rus";
import { UTOPIA_TEMPLATES } from "./templates";

/** ww207: the templates and every seat's trees. */
export const GW_UTOPIA: GwUtopiaContent = joinUtopia([
  UTOPIA_TEMPLATES,
  DEU_UTOPIA,
  GBR_UTOPIA,
  FRA_UTOPIA,
  RUS_UTOPIA,
  AUH_UTOPIA,
]);
