// ww229 (design ww227 §5-§6): every minor's core tables, NATION_TAGS order.
// Read by Generals.ts, MechRules.ts and hist/index.ts, so it imports nothing
// but data (types only).
import { CORE_POL } from "./pol/core";
import { CORE_HUN } from "./hun/core";
import { CORE_ROU } from "./rou/core";
import { CORE_YUG } from "./yug/core";
import { CORE_CSK } from "./csk/core";
import { CORE_GRC } from "./grc/core";
import { CORE_BGR } from "./bgr/core";
import { CORE_FIN } from "./fin/core";
import { CORE_SWE } from "./swe/core";
import { CORE_NOR } from "./nor/core";
import { CORE_NLD } from "./nld/core";
import { CORE_BEL } from "./bel/core";
import { CORE_PRT } from "./prt/core";
import { CORE_ESR } from "./esr/core";
import { CORE_ESN } from "./esn/core";
import { CORE_TUR } from "./tur/core";
import { CORE_BRA } from "./bra/core";
import { CORE_ARG } from "./arg/core";
import { CORE_MEX } from "./mex/core";
import { CORE_CHN } from "./chn/core";
import { CORE_CCP } from "./ccp/core";
import { CORE_MCK } from "./mck/core";
import { CORE_CAN } from "./can/core";
import { CORE_AUS } from "./aus/core";
import { CORE_ZAF } from "./zaf/core";
import { CORE_AUT } from "./aut/core";
import { CORE_CHE } from "./che/core";
import { CORE_IRL } from "./irl/core";
import { CORE_DNK } from "./dnk/core";
import { CORE_EST } from "./est/core";
import { CORE_LVA } from "./lva/core";
import { CORE_LTU } from "./ltu/core";
import { CORE_ALB } from "./alb/core";
import { CORE_IRN } from "./irn/core";
import { CORE_IRQ } from "./irq/core";
import { CORE_SAU } from "./sau/core";
import { CORE_AFG } from "./afg/core";
import { CORE_THA } from "./tha/core";
import { CORE_MNG } from "./mng/core";
import { CORE_ETH } from "./eth/core";
import { CORE_RAJ } from "./raj/core";
import { CORE_NZL } from "./nzl/core";
import { CORE_CHL } from "./chl/core";
import { CORE_COL } from "./col/core";
import { CORE_VEN } from "./ven/core";
import { CORE_PER } from "./per/core";
import { CORE_CUB } from "./cub/core";
import { CORE_URY } from "./ury/core";
import { CORE_GXC } from "./gxc/core";
import { CORE_YUN } from "./yun/core";
import { CORE_SXI } from "./sxi/core";
import { CORE_XBM } from "./xbm/core";
import { CORE_SIK } from "./sik/core";
import { CORE_LUX } from "./lux/core";
import { CORE_ISL } from "./isl/core";
import { CORE_DZG } from "./dzg/core";
import { CORE_YEM } from "./yem/core";
import { CORE_TIB } from "./tib/core";
import { CORE_TTU } from "./ttu/core";
import { CORE_NPL } from "./npl/core";
import { CORE_LBR } from "./lbr/core";
import { CORE_GTM } from "./gtm/core";
import { CORE_HND } from "./hnd/core";
import { CORE_SLV } from "./slv/core";
import { CORE_NIC } from "./nic/core";
import { CORE_CRI } from "./cri/core";
import { CORE_PAN } from "./pan/core";
import { CORE_HTI } from "./hti/core";
import { CORE_DOM } from "./dom/core";
import { CORE_ECU } from "./ecu/core";
import { CORE_BOL } from "./bol/core";
import { CORE_PRY } from "./pry/core";
import { CORE_SVK } from "./svk/core";
import { CORE_HRV } from "./hrv/core";
import { CORE_VIC } from "./vic/core";
import { CORE_RSI } from "./rsi/core";
import { CORE_RNG } from "./rng/core";
import { CORE_MEN } from "./men/core";
import { CORE_BRM } from "./brm/core";
import { CORE_PHL } from "./phl/core";
import type { NationCore } from "./types";

export const NATION_CORES: readonly NationCore[] = [
  CORE_POL,
  CORE_HUN,
  CORE_ROU,
  CORE_YUG,
  CORE_CSK,
  CORE_GRC,
  CORE_BGR,
  CORE_FIN,
  CORE_SWE,
  CORE_NOR,
  CORE_NLD,
  CORE_BEL,
  CORE_PRT,
  CORE_ESR,
  CORE_ESN,
  CORE_TUR,
  CORE_BRA,
  CORE_ARG,
  CORE_MEX,
  CORE_CHN,
  CORE_CCP,
  CORE_MCK,
  CORE_CAN,
  CORE_AUS,
  CORE_ZAF,
  CORE_AUT,
  CORE_CHE,
  CORE_IRL,
  CORE_DNK,
  CORE_EST,
  CORE_LVA,
  CORE_LTU,
  CORE_ALB,
  CORE_IRN,
  CORE_IRQ,
  CORE_SAU,
  CORE_AFG,
  CORE_THA,
  CORE_MNG,
  CORE_ETH,
  CORE_RAJ,
  CORE_NZL,
  CORE_CHL,
  CORE_COL,
  CORE_VEN,
  CORE_PER,
  CORE_CUB,
  CORE_URY,
  CORE_GXC,
  CORE_YUN,
  CORE_SXI,
  CORE_XBM,
  CORE_SIK,
  CORE_LUX,
  CORE_ISL,
  CORE_DZG,
  CORE_YEM,
  CORE_TIB,
  CORE_TTU,
  CORE_NPL,
  CORE_LBR,
  CORE_GTM,
  CORE_HND,
  CORE_SLV,
  CORE_NIC,
  CORE_CRI,
  CORE_PAN,
  CORE_HTI,
  CORE_DOM,
  CORE_ECU,
  CORE_BOL,
  CORE_PRY,
  CORE_SVK,
  CORE_HRV,
  CORE_VIC,
  CORE_RSI,
  CORE_RNG,
  CORE_MEN,
  CORE_BRM,
  CORE_PHL,
];
