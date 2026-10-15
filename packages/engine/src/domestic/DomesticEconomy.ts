import {
  CONDITIONS,
  type Condition,
  type StatKey,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Gold,
  MessageType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  BASE_YIELD_PER_SEC,
  BUILDING_UPKEEP_PER_LEVEL,
  BUILDING_YIELD_PER_LEVEL,
  DEMOBILIZE_PCT_PER_SEC,
  DESERTION_PCT_PER_SEC,
  DOMESTIC_INTERVAL_TICKS,
  FEUDAL_POLITICAL_PER_CITY_LEVEL,
  INTEREST_CAP_PER_SEC,
  INTEREST_DIVISOR_PER_SEC,
  MILLI,
  NATION_YIELD_MULT,
  RECRUIT_COST_PER_1000_TROOPS,
  RESEARCH_SUBSIDY_GOLD_PER_SEC,
  RESEARCH_SUBSIDY_SCIENCE_PER_SEC,
  TERRITORY_YIELD_PER_SQRT_PCT,
  TITHE_GOLD_PER_SQRT_PCT,
  UPKEEP_FREE_BAND_PCT,
  UPKEEP_GOLD_PER_1000_EXCESS,
} from "@openfront/engine-lib/domestic/Balance";
import {
  applyPct,
  capCombinedPct,
} from "@openfront/engine-lib/domestic/Modifiers";
import { shortfallGold } from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import type { Game, Player } from "../game/Game";
import type { PlayerDomestic } from "./PlayerDomestic";

/** Sum of the levels of a player's finished units of `type`. */
export function finishedLevels(player: Player, type: UnitType): number {
  let levels = 0;
  for (const u of player.units(type)) {
    if (!u.isUnderConstruction()) levels += u.level();
  }
  return levels;
}

/** Pays `levels` worth of building upkeep; false when the player can't. */
function payBuildingUpkeep(player: Player, levels: number): boolean {
  if (levels === 0) return true;
  const due = BigInt(levels) * BUILDING_UPKEEP_PER_LEVEL;
  if (player.gold() < due) return false;
  player.removeGold(due);
  return true;
}

/** Owned land as a percent of the map's land. */
function landSharePct(mg: Game, player: Player): number {
  const land = mg.numLandTiles();
  return land <= 0 ? 0 : (player.numTilesOwned() * 100) / land;
}

function yieldMultiplier(mg: Game, player: Player): number {
  return player.type() === PlayerType.Nation
    ? NATION_YIELD_MULT[mg.config().gameConfig().difficulty]
    : 1;
}

function hasInterest(d: PlayerDomestic): boolean {
  for (const t of d.researchedTechs()) {
    if (TECHS[t].interest) return true;
  }
  return false;
}

/**
 * The conditions conditional modifiers test this second (spec §7.1). An
 * attack counts while it targets another player and isn't retreating; a
 * boat at sea has no attack yet (AttackExecution starts on landing).
 */
export function activeConditions(
  player: Player,
  maxTroops: number,
): Set<Condition> {
  const attacking = player
    .outgoingAttacks()
    .some((a) => a.target().isPlayer() && !a.retreating());
  const holds: Record<Condition, boolean> = {
    attacking,
    notAttacking: !attacking,
    troopsAtMostHalf: player.troops() * 2 <= maxTroops,
  };
  // Built in the fixed CONDITIONS order: toData() and snapshots keep it.
  const out = new Set<Condition>();
  for (const c of CONDITIONS) {
    if (holds[c]) out.add(c);
  }
  return out;
}

/** Research subsidies take all 300 gold or nothing. */
function payResearchSubsidy(player: Player): boolean {
  if (player.gold() < RESEARCH_SUBSIDY_GOLD_PER_SEC) return false;
  player.removeGold(RESEARCH_SUBSIDY_GOLD_PER_SEC);
  return true;
}

/**
 * Theocracy's tithe (spec §6.2): 100 × sqrt(land share %) gold a second.
 * It is part of goldIncome (spec §7.2), so goldIncome and allGold apply, and
 * the lobby's gold multiplier like the rest of the base income.
 */
function payTithe(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  sharePct: number,
): void {
  const pct = capCombinedPct(d.pct("goldIncome") + d.pct("allGold"));
  const gold = Math.floor(
    applyPct(TITHE_GOLD_PER_SQRT_PCT * Math.sqrt(sharePct), pct) *
      mg.config().goldMultiplier(),
  );
  if (gold > 0) player.addGold(BigInt(gold));
}

/**
 * One second of a player's domestic economy (spec §3, §5, §6): this
 * second's conditions, building upkeep and output (with research subsidies
 * and feudalism), the government tier, the tithe, troop upkeep and
 * desertion, demobilization down to the recruit target, banking interest,
 * then research progress. The order is fixed so every client runs it
 * identically.
 */
export function processDomesticSecond(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const maxTroops = mg.config().maxTroops(player);
  d.setConditions(activeConditions(player, maxTroops));

  const instituteLevels = finishedLevels(player, UnitType.ResearchInstitute);
  const officeLevels = finishedLevels(player, UnitType.AdminOffice);
  // Communism: institutes and offices run without upkeep.
  const freeUpkeep = d.hasFlag("noProductionUpkeep");
  const institutesRun =
    freeUpkeep || payBuildingUpkeep(player, instituteLevels);
  const officesRun = freeUpkeep || payBuildingUpkeep(player, officeLevels);

  const sharePct = landSharePct(mg, player);
  // Flat base output plus territory, before the science/political modifiers.
  const landYield =
    BASE_YIELD_PER_SEC + TERRITORY_YIELD_PER_SQRT_PCT * Math.sqrt(sharePct);
  const mult = yieldMultiplier(mg, player);
  const instituteOutput = institutesRun
    ? applyPct(
        instituteLevels * BUILDING_YIELD_PER_LEVEL,
        d.pct("instituteOutput"),
      )
    : 0;
  const officeOutput = officesRun
    ? applyPct(officeLevels * BUILDING_YIELD_PER_LEVEL, d.pct("adminOutput"))
    : 0;
  const subsidy =
    d.hasFlag("researchSubsidy") && payResearchSubsidy(player)
      ? RESEARCH_SUBSIDY_SCIENCE_PER_SEC
      : 0;
  const feudal = d.hasFlag("feudal")
    ? finishedLevels(player, UnitType.City) * FEUDAL_POLITICAL_PER_CITY_LEVEL
    : 0;
  const science =
    applyPct(landYield + instituteOutput + subsidy, d.pct("science")) * mult;
  const political =
    applyPct(landYield + officeOutput + feudal, d.pct("political")) * mult;
  d.addYield(Math.round(science * MILLI), Math.round(political * MILLI));

  const tier = d.refreshGovernmentTier();
  if (tier !== null) {
    mg.displayMessage(
      "events_display.government_tier_reached",
      MessageType.GOVERNMENT_TIER_REACHED,
      player.id(),
      undefined,
      { tier },
    );
  }
  if (d.hasFlag("tithe")) {
    payTithe(mg, player, d, sharePct);
  }

  const band =
    (maxTroops * (UPKEEP_FREE_BAND_PCT + d.pct("upkeepFreeBand"))) / 100;
  const excess = player.troops() - band;
  if (excess > 0) {
    const due = BigInt(
      Math.ceil(
        applyPct(
          (excess / 1000) * UPKEEP_GOLD_PER_1000_EXCESS,
          d.pct("troopUpkeep"),
        ),
      ),
    );
    if (player.gold() >= due) {
      player.removeGold(due);
    } else {
      player.removeGold(player.gold());
      player.removeTroops(Math.ceil((excess * DESERTION_PCT_PER_SEC) / 100));
    }
  }

  const target = (maxTroops * d.recruitTargetPct()) / 100;
  const overTarget = player.troops() - target;
  if (overTarget > 0) {
    const drop = Math.min(
      Math.floor(overTarget),
      Math.ceil((overTarget * DEMOBILIZE_PCT_PER_SEC) / 100),
    );
    if (drop > 0) player.removeTroops(drop);
  }

  if (hasInterest(d)) {
    const interest = player.gold() / INTEREST_DIVISOR_PER_SEC;
    const paid =
      interest < INTEREST_CAP_PER_SEC ? interest : INTEREST_CAP_PER_SEC;
    if (paid > 0n) player.addGold(paid);
  }

  const finished = d.advanceResearch(DOMESTIC_INTERVAL_TICKS);
  if (finished !== null) {
    mg.displayMessage(
      "events_display.research_complete",
      MessageType.RESEARCH_COMPLETE,
      player.id(),
      undefined,
      { tech: finished },
    );
  }
}

/**
 * Charges the recruitment cost (spec §3.4) for `troops` new troops and
 * returns how many the player could pay for. Without enough gold it spends
 * what it has on as many troops as that buys.
 */
export function payRecruitment(player: Player, troops: number): number {
  const d = player.domestic();
  if (d === null || troops <= 0) return troops;
  const costPer1000 = applyPct(
    RECRUIT_COST_PER_1000_TROOPS,
    d.pct("recruitCost"),
  );
  if (costPer1000 <= 0) return troops;
  const due = BigInt(Math.ceil((troops * costPer1000) / 1000));
  const gold = player.gold();
  if (gold >= due) {
    player.removeGold(due);
    return troops;
  }
  const affordable = Math.floor((Number(gold) * 1000) / costPer1000);
  player.removeGold(gold);
  return Math.min(troops, affordable);
}

/**
 * A trade ship or train payout as `recipient` receives it (spec §7.2):
 * trade, the kind's own stat and allGold always apply; foreignTrade when
 * the partner is someone else; alliedTrade when the partner is an ally.
 * Ships and trains pay the same base amount to both sides, so each side
 * calls this separately.
 */
export function domesticTradeGold(
  base: Gold,
  recipient: Player,
  partner: Player,
  kind: "tradeShip" | "train",
): Gold {
  const d = recipient.domestic();
  if (d === null) return base;
  let pct = d.pct("trade") + d.pct(kind) + d.pct("allGold");
  if (partner !== recipient) {
    pct += d.pct("foreignTrade");
    if (recipient.isAlliedWith(partner)) pct += d.pct("alliedTrade");
  }
  pct = capCombinedPct(pct);
  return pct === 0 ? base : BigInt(Math.round(applyPct(Number(base), pct)));
}

/** tradeShipSpawnRate is "1 in N"; tradeShipSpawn +50% divides N by 1.5. */
export function domesticTradeShipSpawnRate(
  rate: number,
  portOwner: Player,
): number {
  const d = portOwner.domestic();
  if (d === null) return rate;
  const pct = d.pct("tradeShipSpawn");
  return pct === 0 ? rate : Math.max(1, Math.floor(rate / (1 + pct / 100)));
}

/** How strongly the defender's defense posts apply (1 = vanilla). */
export function domesticDefensePostScale(defender: Player): number {
  const d = defender.domestic();
  return d === null ? 1 : 1 + d.pct("defensePost") / 100;
}

/**
 * Spends `costMilli` of science or political power. A shortfall is paid in
 * gold (spec §3.1) only when `payWithGold` is set and the player has it.
 * Returns false, spending nothing, when the player can't pay.
 */
export function payPoints(
  player: Player,
  d: PlayerDomestic,
  resource: "science" | "political",
  costMilli: number,
  payWithGold: boolean,
): boolean {
  const available =
    resource === "science"
      ? d.scienceMilliAvailable()
      : d.politicalMilliAvailable();
  const spend = (amount: number): void => {
    if (resource === "science") {
      d.spendScienceMilli(amount);
    } else {
      d.spendPoliticalMilli(amount);
    }
  };
  if (available >= costMilli) {
    spend(costMilli);
    return true;
  }
  if (!payWithGold) return false;
  const gold = shortfallGold(costMilli - available, d.pct("goldPaymentCost"));
  if (player.gold() < gold) return false;
  player.removeGold(gold);
  spend(available);
  return true;
}

/** Combat scales from domestic modifiers (spec §7.2); 1 = vanilla. */
export interface DomesticCombat {
  /** Multiplies the attacker's troop loss per tile. */
  attackerLoss: number;
  /** Divides the tick share each tile costs (1.3 = 30% faster). */
  attackerSpeed: number;
  /** Multiplies the defender's troop loss per tile. */
  defenderLoss: number;
}

const NO_COMBAT_MODIFIERS: Readonly<DomesticCombat> = {
  attackerLoss: 1,
  attackerSpeed: 1,
  defenderLoss: 1,
};

function statScale(d: PlayerDomestic | null, stat: StatKey): number {
  return d === null ? 1 : 1 + d.pct(stat) / 100;
}

/**
 * attackLoss and attackSpeed come from the attacker, defenseLoss from the
 * defender. Expanding into unclaimed land (no defender) only uses
 * expansionSpeed.
 */
export function domesticCombat(
  attacker: Player,
  defender: Player | null,
): Readonly<DomesticCombat> {
  const a = attacker.domestic();
  const d = defender === null ? null : defender.domestic();
  if (a === null && d === null) return NO_COMBAT_MODIFIERS;
  if (defender === null) {
    return {
      attackerLoss: 1,
      attackerSpeed: statScale(a, "expansionSpeed"),
      defenderLoss: 1,
    };
  }
  return {
    attackerLoss: statScale(a, "attackLoss"),
    attackerSpeed: statScale(a, "attackSpeed"),
    defenderLoss: statScale(d, "defenseLoss"),
  };
}

/**
 * A structure's build time under buildTime (and cityBuildTime for cities),
 * capped at -60% together and never below one tick. Instant builds (0)
 * stay instant.
 */
export function domesticConstructionTicks(
  base: number,
  player: Player,
  type: UnitType,
): number {
  const d = player.domestic();
  if (d === null || base <= 0) return base;
  let pct = d.pct("buildTime");
  if (type === UnitType.City) pct += d.pct("cityBuildTime");
  pct = capCombinedPct(pct);
  return pct === 0 ? base : Math.max(1, Math.round((base * (100 + pct)) / 100));
}
