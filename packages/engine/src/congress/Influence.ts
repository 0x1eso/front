import { InfluenceStatus } from "@openfront/engine-api/congress/CongressTypes";
import {
  GOVERNMENT_CONDEMN_INFLUENCE_PCT,
  GOVERNMENT_SUPPORT_INFLUENCE_PCT,
  INFLUENCE_BASE_MILLI,
  INFLUENCE_MAX_ALLIES,
  INFLUENCE_PER_ALLY_MILLI,
  INFLUENCE_PER_TIER_MILLI,
  INFLUENCE_POLITICAL_SHARE_PCT,
} from "@openfront/engine-lib/congress/CongressBalance";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";
import { isAggressing } from "./Ledger";

/** Once a second, after the domestic economy (spec §5.1): every alive player's accrual. */
export function accrueInfluence(mg: Game, c: Congress): void {
  for (const p of mg.players()) {
    const pc = p.congress();
    if (pc === null) continue;
    const status = influenceStatus(mg, c, p);
    pc.accrue(status === "peaceful" ? influenceRateMilli(c, p) : 0, status);
  }
}

/** Spec §5.1: sanctioned, emergency target, aggressing, or peaceful (PlayerCongress.accrue turns a full one into "capped"). */
export function influenceStatus(
  mg: Game,
  c: Congress,
  p: Player,
): InfluenceStatus {
  if (c.isSanctioned(p.smallID())) return "sanctioned";
  if (c.isEmergencyTarget(p.smallID())) return "target";
  if (isAggressing(mg, p)) return "aggressing";
  return "peaceful";
}

/** A peaceful second, in milli-points: 0.1 + 0.05 per tier + 5% of political output + 0.05 per ally (up to 3), times E5. */
export function influenceRateMilli(c: Congress, p: Player): number {
  const d = p.domestic();
  const tier = d?.governmentTier() ?? 0;
  const political = d?.politicalMilliPerSecond() ?? 0;
  const allies = Math.min(INFLUENCE_MAX_ALLIES, p.alliances().length);
  const base =
    INFLUENCE_BASE_MILLI +
    INFLUENCE_PER_TIER_MILLI * tier +
    Math.round((political * INFLUENCE_POLITICAL_SHARE_PCT) / 100) +
    INFLUENCE_PER_ALLY_MILLI * allies;
  return Math.round((base * governmentInfluencePct(c, p)) / 100);
}

/** E5 (spec §8.2): support ×1.25, condemnation ×0 for players of that government; 100 otherwise. */
export function governmentInfluencePct(c: Congress, p: Player): number {
  const government = p.domestic()?.currentGovernment();
  for (const r of c.active()) {
    if (r.resolution === "government_resolution" && r.param === government) {
      return r.option === "A"
        ? GOVERNMENT_SUPPORT_INFLUENCE_PCT
        : GOVERNMENT_CONDEMN_INFLUENCE_PCT;
    }
  }
  return 100;
}
