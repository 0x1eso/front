// Great War 1914 (ww150): the tables under the story. The rules that read them
// are engine/ww1914/Story and Desk. A later country adds a row here.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";

/**
 * Who can quietly become the seat's rival, one by the seed. A person gone
 * before the game begins (Franz Ferdinand, most games) isn't in the draw.
 */
export const GW_RIVAL_ROWS: Readonly<
  Partial<Record<GwTag, readonly string[]>>
> = {
  DEU: ["deu_tirpitz", "deu_falkenhayn", "deu_heir", "deu_bethmann"],
  GBR: ["gbr_lloyd_george", "gbr_churchill", "gbr_kitchener", "gbr_bonar_law"],
  AUH: ["auh_conrad", "auh_tisza", "auh_berchtold", "auh_ff", "auh_czernin"],
  RUS: ["rus_nikolasha", "rus_rodzianko", "rus_sukhomlinov", "rus_krivoshein"],
  FRA: [
    "fra_clemenceau",
    "fra_joffre",
    "fra_caillaux",
    "fra_briand",
    "fra_malvy",
  ],
};

/** Share of the game, percent, at which heat reaches each stage past signs. */
export const GW_RIVAL_BARS = { gathering: 30, clash: 60 } as const;

/** A foreign ruler: `regimes` limits the row; `from` is when it starts. */
export interface GwHeadRow {
  readonly person: string;
  readonly regimes?: readonly string[];
  readonly from?: string;
}

/**
 * Who writes for a country: the latest row that fits. A country with no row,
 * or none that fits, sends no letters (cast rule `ruler_of`).
 */
export const GW_HEADS: Readonly<Partial<Record<GwTag, readonly GwHeadRow[]>>> =
  {
    DEU: [{ person: "deu_wilhelm", regimes: ["empire"] }],
    AUH: [
      { person: "auh_franz_joseph", regimes: ["dual_monarchy"] },
      { person: "auh_karl", regimes: ["dual_monarchy"], from: "1916-11-21" },
      { person: "auh_karl", regimes: ["karl"] },
      { person: "auh_ff", regimes: ["ff_throne"] },
    ],
    RUS: [{ person: "rus_nicholas", regimes: ["tsar"] }],
    GBR: [{ person: "gbr_george_v" }],
    FRA: [{ person: "fra_poincare" }],
    ITA: [{ person: "ita_salandra" }],
    OTT: [{ person: "ott_enver" }],
    USA: [{ person: "usa_wilson" }],
    JPN: [{ person: "jpn_kato" }],
    SRB: [{ person: "srb_alexander" }],
    BGR: [{ person: "bgr_ferdinand" }],
    ROU: [{ person: "rou_bratianu" }],
    GRC: [{ person: "grc_constantine" }],
    ESP: [{ person: "esp_alfonso" }],
  };

/** A first game of a nation: the people the first chapters are about. */
export const GW_OPENING_CIRCLE: Readonly<
  Partial<Record<GwTag, readonly string[]>>
> = {
  DEU: ["deu_bethmann", "deu_jagow", "deu_moltke"],
  GBR: ["gbr_grey", "gbr_lloyd_george", "gbr_churchill"],
  AUH: ["auh_berchtold", "auh_conrad", "auh_tisza"],
  RUS: ["rus_sazonov", "rus_sukhomlinov", "rus_goremykin"],
  FRA: ["fra_viviani", "fra_messimy", "fra_joffre"],
};

/** Chapters a first game holds the desk down for. */
export const GW_OPENING_CHAPTERS = 3;
/** Cards on the desk in those chapters. */
export const GW_OPENING_DESK = 2;
