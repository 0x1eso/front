import {
  Gold,
  MessageType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  BUILDING_UPKEEP_PER_LEVEL,
  BUILDING_YIELD_PER_LEVEL,
  DEMOBILIZE_PCT_PER_SEC,
  DESERTION_PCT_PER_SEC,
  DOMESTIC_INTERVAL_TICKS,
  INTEREST_CAP_PER_SEC,
  INTEREST_DIVISOR_PER_SEC,
  MILLI,
  NATION_YIELD_MULT,
  RECRUIT_COST_PER_1000_TROOPS,
  TERRITORY_YIELD_PER_SQRT_PCT,
  UPKEEP_FREE_BAND_PCT,
  UPKEEP_GOLD_PER_1000_EXCESS,
} from "@openfront/engine-lib/domestic/Balance";
import {
  applyPct,
  capCombinedPct,
} from "@openfront/engine-lib/domestic/Modifiers";
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

function territoryYield(mg: Game, player: Player): number {
  const land = mg.numLandTiles();
  if (land <= 0) return 0;
  return (
    TERRITORY_YIELD_PER_SQRT_PCT *
    Math.sqrt((player.numTilesOwned() * 100) / land)
  );
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
 * One second of a player's domestic economy (spec §3): building upkeep and
 * output, troop upkeep and desertion, demobilization down to the recruit
 * target, banking interest, then research progress. The order is fixed so
 * every client runs it identically.
 */
export function processDomesticSecond(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const instituteLevels = finishedLevels(player, UnitType.ResearchInstitute);
  const officeLevels = finishedLevels(player, UnitType.AdminOffice);
  const institutesRun = payBuildingUpkeep(player, instituteLevels);
  const officesRun = payBuildingUpkeep(player, officeLevels);

  const territory = territoryYield(mg, player);
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
  const science =
    applyPct(territory + instituteOutput, d.pct("science")) * mult;
  const political =
    applyPct(territory + officeOutput, d.pct("political")) * mult;
  d.addYield(Math.round(science * MILLI), Math.round(political * MILLI));

  const maxTroops = mg.config().maxTroops(player);
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
