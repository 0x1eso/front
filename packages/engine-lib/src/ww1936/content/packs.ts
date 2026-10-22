// World War 1936 P6 (spec §11.1, plan decision 28): the regional focus
// packs. A pack country plays the generic tree less the pack's `replaces`
// (a replaced focus counts as bypassed for prerequisites) plus the pack's
// own focuses (columns 20..35); a pack focus with `countries` is for those
// tags only. Data only (ContentPurity).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  FocusPack,
  FocusPackDef,
} from "@openfront/engine-api/ww1936/DepthTypes";

/** Spec §11.1 table, FOCUS_PACKS order. */
export const PACKS: readonly FocusPackDef[] = [
  { id: "chn", replaces: ["gen_pol_claims"] },
  {
    id: "ccp",
    replaces: ["gen_pol_dem", "gen_pol_fas", "gen_pol_neu", "gen_pol_claims"],
  },
  { id: "chw", replaces: ["gen_pol_claims"] },
  {
    id: "spa",
    replaces: [
      "gen_pol_dem",
      "gen_pol_com",
      "gen_pol_fas",
      "gen_pol_neu",
      "gen_pol_dem_ally",
      "gen_pol_com_ally",
      "gen_pol_fas_ally",
      "gen_pol_neu_league",
    ],
  },
  { id: "pol", replaces: ["gen_pol_claims"] },
  { id: "tur", replaces: ["gen_pol_claims"] },
  { id: "bal", replaces: ["gen_pol_claims"] },
  { id: "nor", replaces: [] },
  { id: "lat", replaces: [] },
  { id: "dom", replaces: [] },
  { id: "new", replaces: [] },
];

/**
 * Spec §11.1 table: the countries of each pack (K5 sets their
 * CountryPoliticsDef.tree to the pack; the foundation only lists them).
 */
export const PACK_COUNTRIES: Readonly<
  Record<FocusPack, readonly CountryTag[]>
> = {
  chn: ["CHN"],
  ccp: ["CCP"],
  chw: ["GXC", "SXI", "YUN", "XBM", "SIK"],
  spa: ["ESR", "ESN"],
  pol: ["POL"],
  tur: ["TUR"],
  bal: ["ROU", "HUN", "YUG", "BGR", "GRC", "ALB"],
  nor: ["SWE", "NOR", "DNK", "FIN", "ISL"],
  lat: [
    "MEX",
    "GTM",
    "HND",
    "SLV",
    "NIC",
    "CRI",
    "PAN",
    "CUB",
    "HTI",
    "DOM",
    "COL",
    "VEN",
    "ECU",
    "PER",
    "BOL",
    "BRA",
    "PRY",
    "URY",
    "ARG",
    "CHL",
  ],
  dom: ["CAN", "AUS", "NZL", "ZAF"],
  new: [
    "SVK",
    "HRV",
    "VIC",
    "RSI",
    "RNG",
    "MEN",
    "BRM",
    "PHL",
    "CW1",
    "CW2",
    "CW3",
    "CW4",
    "CW5",
    "CW6",
  ],
};
