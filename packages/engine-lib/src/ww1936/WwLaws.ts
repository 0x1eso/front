import {
  ConscriptionLaw,
  CountryLaws,
  EconomyLaw,
  TradeLaw,
} from "@openfront/engine-api/ww1936/EconomyTypes";

// Spec §5.
const ECONOMY: Readonly<
  Record<EconomyLaw, { cg: number; milBuild: number; output: number }>
> = {
  civilian: { cg: 35, milBuild: -30, output: 0 },
  early_mobilization: { cg: 30, milBuild: -10, output: 0 },
  partial_mobilization: { cg: 25, milBuild: 10, output: 0 },
  war_economy: { cg: 20, milBuild: 20, output: 5 },
  total_mobilization: { cg: 10, milBuild: 30, output: 10 },
};
const TRADE: Readonly<
  Record<TradeLaw, { exportPct: number; build: number; research: number }>
> = {
  free_trade: { exportPct: 80, build: 10, research: 5 },
  export_focus: { exportPct: 50, build: 5, research: 0 },
  limited_exports: { exportPct: 25, build: 0, research: 0 },
  closed_economy: { exportPct: 0, build: 0, research: 0 },
};
const CONSCRIPTION: Readonly<
  Record<ConscriptionLaw, { permille: number; penalty: number }>
> = {
  disarmed: { permille: 10, penalty: 0 },
  volunteer: { permille: 15, penalty: 0 },
  limited: { permille: 25, penalty: 0 },
  extensive: { permille: 50, penalty: -5 },
  service: { permille: 100, penalty: -10 },
  all_adults: { permille: 200, penalty: -20 },
  scraping: { permille: 250, penalty: -30 },
};

export interface LawEffects {
  consumerGoodsPct: number;
  /** Military-factory construction only. */
  milConstructionPct: number;
  /** All construction (trade law plus the conscription penalty). */
  constructionPct: number;
  /** Factory output (economy law plus the conscription penalty). */
  outputPct: number;
  exportPct: number;
  researchPct: number;
  conscriptionPermille: number;
}

export function lawEffects(l: CountryLaws): LawEffects {
  const e = ECONOMY[l.economy];
  const t = TRADE[l.trade];
  const c = CONSCRIPTION[l.conscription];
  return {
    consumerGoodsPct: e.cg,
    milConstructionPct: e.milBuild,
    constructionPct: t.build + c.penalty,
    outputPct: e.output + c.penalty,
    exportPct: t.exportPct,
    researchPct: t.research,
    conscriptionPermille: c.permille,
  };
}

export function conscriptionPermille(l: ConscriptionLaw): number {
  return CONSCRIPTION[l].permille;
}
