import {
  BallotOption,
  BUILDING_PACT_UNITS,
  ResolutionId,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { LAWS } from "../domestic/Laws";
import { HEGEMONY_FAIL_GOLD_PCT } from "./CongressBalance";

/** What the effect rules read of a resolution in force (ActiveResolution and ActiveResolutionData both fit). */
export interface ResolutionLike {
  resolution: ResolutionId;
  option: BallotOption;
  targets: readonly number[];
  param: string | null;
}

/** What the modifier rules read of a player. */
export interface ModifierFacts {
  smallID: number;
  government: GovernmentId;
  laws: ReadonlyMap<LawId, LawOption>;
}

/** The unit a building_pact parameter names, or null. */
export function buildingPactType(param: string | null): UnitType | null {
  return BUILDING_PACT_UNITS.find((u) => u.key === param)?.type ?? null;
}

// Spec §8 numbers, in percent.
const SANCTION_GOLD_PCT = -20;
const ACQUIESCE_TRADE_PCT = 30;
const WAR_TAX_GOLD_PCT = -30;
const WAR_TAX_UPKEEP_PCT = 50;
const WAR_BOOM_GOLD_PCT = 20;
const DISARM_TROOPS_PCT = -15;
const DISARM_GOLD_PCT = 15;
const ARMS_RACE_TROOPS_PCT = 15;
const ARMS_RACE_GOLD_PCT = -10;
const MILITARY_AID_SILO_SAM_PCT = -30;
const DEVELOPMENT_RACE_NUKE_PCT = -25;
const HEGEMONY_CHECK_OUTPUT_PCT = -20;
const LEADER_GOLD_PCT = 15;
const TRADE_PACT_PCT = 50;
const FUND_BOOST_PCT = 20;
const FUND_CUT_PCT = -10;
const GOVERNMENT_POLITICAL_PCT = 25;
const LAW_RECOMMEND_SCALE = 0.5;
const LAW_SUSPEND_SCALE = -1;
const PROMOTION_COST_PCT = -40;
const PROMOTION_TIME_PCT = -50;
const NUKE_TIME_PCT = -50;

const NUKES: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
]);
/** S6 A: everything strategic the target may not buy, build or produce. */
const EMBARGOED: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.ConventionalMissile,
  UnitType.Satellite,
  UnitType.Bomber,
  UnitType.CoastalBarrage,
  UnitType.MissileSilo,
]);

/** The domestic modifiers `r` gives a player with `facts` (spec §8.1, §8.2, plan decision 3). */
export function resolutionModifiers(
  r: ResolutionLike,
  facts: ModifierFacts,
): Modifier[] {
  const mine = r.targets.includes(facts.smallID);
  const a = r.option === "A";
  switch (r.resolution) {
    case "sanction":
      if (!mine) return [];
      return a
        ? [{ stat: "allGold", pct: SANCTION_GOLD_PCT }]
        : [{ stat: "trade", pct: ACQUIESCE_TRADE_PCT }];
    case "war_tax":
      return a
        ? [
            { stat: "allGold", pct: WAR_TAX_GOLD_PCT, when: "aggressing" },
            {
              stat: "troopUpkeep",
              pct: WAR_TAX_UPKEEP_PCT,
              when: "aggressing",
            },
          ]
        : [{ stat: "allGold", pct: WAR_BOOM_GOLD_PCT, when: "aggressing" }];
    case "arms_treaty":
      return a
        ? [
            { stat: "maxTroops", pct: DISARM_TROOPS_PCT },
            { stat: "goldIncome", pct: DISARM_GOLD_PCT },
          ]
        : [
            { stat: "maxTroops", pct: ARMS_RACE_TROOPS_PCT },
            { stat: "goldIncome", pct: ARMS_RACE_GOLD_PCT },
          ];
    case "arms_embargo":
      return mine && !a
        ? [{ stat: "siloSamCost", pct: MILITARY_AID_SILO_SAM_PCT }]
        : [];
    case "non_proliferation":
      return a ? [] : [{ stat: "nukeCost", pct: DEVELOPMENT_RACE_NUKE_PCT }];
    case "hegemony_check":
      if (!mine) return [];
      return a
        ? [
            { stat: "science", pct: HEGEMONY_CHECK_OUTPUT_PCT },
            { stat: "political", pct: HEGEMONY_CHECK_OUTPUT_PCT },
          ]
        : [{ stat: "goldIncome", pct: LEADER_GOLD_PCT }];
    case "trade_pact": {
      const stat =
        r.param === "train"
          ? "train"
          : r.param === "tradeShip"
            ? "tradeShip"
            : null;
      if (stat === null) return [];
      return [{ stat, pct: a ? TRADE_PACT_PCT : -TRADE_PACT_PCT }];
    }
    case "research_fund":
      return a
        ? [
            { stat: "science", pct: FUND_BOOST_PCT },
            { stat: "political", pct: FUND_CUT_PCT },
          ]
        : [
            { stat: "political", pct: FUND_BOOST_PCT },
            { stat: "science", pct: FUND_CUT_PCT },
          ];
    case "government_resolution":
      if (r.param !== facts.government) return [];
      return [
        {
          stat: "political",
          pct: a ? GOVERNMENT_POLITICAL_PCT : -GOVERNMENT_POLITICAL_PCT,
        },
      ];
    case "law_review": {
      const [law, option] = (r.param ?? "").split(":") as [LawId, LawOption];
      if (facts.laws.get(law) !== option) return [];
      const def = LAWS[law]?.[option];
      if (def === undefined) return [];
      const scale = a ? LAW_RECOMMEND_SCALE : LAW_SUSPEND_SCALE;
      return def.modifiers.map((m) => ({ ...m, pct: m.pct * scale }));
    }
    case "emergency":
      return mine && !a && r.param === "hegemony"
        ? [{ stat: "goldIncome", pct: HEGEMONY_FAIL_GOLD_PCT }]
        : [];
    default:
      return [];
  }
}

/** E2 B, S6 A, S7 A: whether `type` may not be bought, built, upgraded or produced by `smallID`. */
export function resolutionBans(
  active: readonly ResolutionLike[],
  smallID: number,
  type: UnitType,
): boolean {
  for (const r of active) {
    if (r.option !== "A" && r.resolution !== "building_pact") continue;
    switch (r.resolution) {
      case "building_pact":
        if (r.option === "B" && buildingPactType(r.param) === type) return true;
        break;
      case "arms_embargo":
        if (r.targets.includes(smallID) && EMBARGOED.has(type)) return true;
        break;
      case "non_proliferation":
        if (NUKES.has(type)) return true;
        break;
    }
  }
  return false;
}

/** E2 A: build-cost percent for `type`. */
export function resolutionBuildCostPct(
  active: readonly ResolutionLike[],
  type: UnitType,
): number {
  return active.some(
    (r) =>
      r.resolution === "building_pact" &&
      r.option === "A" &&
      buildingPactType(r.param) === type,
  )
    ? PROMOTION_COST_PCT
    : 0;
}

/** E2 A: build-time percent for `type`. */
export function resolutionBuildTimePct(
  active: readonly ResolutionLike[],
  type: UnitType,
): number {
  return active.some(
    (r) =>
      r.resolution === "building_pact" &&
      r.option === "A" &&
      buildingPactType(r.param) === type,
  )
    ? PROMOTION_TIME_PCT
    : 0;
}

/** S6 B (its target) and S7 B (everyone): -50% each, added. */
export function resolutionNukeTimePct(
  active: readonly ResolutionLike[],
  smallID: number,
): number {
  let pct = 0;
  for (const r of active) {
    if (r.option !== "B") continue;
    if (r.resolution === "arms_embargo" && r.targets.includes(smallID)) {
      pct += NUKE_TIME_PCT;
    }
    if (r.resolution === "non_proliferation") pct += NUKE_TIME_PCT;
  }
  return pct;
}
