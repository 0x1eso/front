import { BallotOption } from "@openfront/engine-api/congress/CongressTypes";
import {
  Modifier,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  PATENT_SECONDS,
  TECH_PACT_DISCOUNT_PCT,
  TECH_PACT_MIN_HOLDERS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  resolutionBans,
  resolutionBuildCostPct,
  resolutionBuildTimePct,
  resolutionModifiers,
  resolutionNukeTimePct,
} from "@openfront/engine-lib/congress/ResolutionEffects";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { capCombinedPct } from "@openfront/engine-lib/domestic/Modifiers";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";

/** Once a second: every player's congress modifiers into its domestic totals; the tech-pact list. */
export function refreshCongressEffects(mg: Game, c: Congress): void {
  for (const p of mg.players()) {
    p.domestic()?.setCongressModifiers(congressModifiers(mg, c, p));
  }
  c.setDiscountedTechs(techPact(c, "A") ? widelyKnownTechs(mg) : []);
}

/** The modifiers the resolutions in force give `player` now. */
export function congressModifiers(
  _mg: Game,
  c: Congress,
  player: Player,
): Modifier[] {
  const d = player.domestic();
  if (d === null) return [];
  const facts = {
    smallID: player.smallID(),
    government: d.currentGovernment(),
    laws: d.proclaimedLaws(),
  };
  return c.active().flatMap((r) => resolutionModifiers(r, facts));
}

/** S1 A: a sanctioned side trades with nobody. */
export function tradeBlocked(c: Congress, a: Player, b: Player): boolean {
  return c.isSanctioned(a.smallID()) || c.isSanctioned(b.smallID());
}

/** S1 A: a sanctioned player receives no gold or troops. */
export function donationBlocked(c: Congress, recipient: Player): boolean {
  return c.isSanctioned(recipient.smallID());
}

/** E2 B, S6 A, S7 A and the nuclear-emergency ban (PlayerImpl lets stock launches through first). */
export function congressBans(
  c: Congress,
  player: Player,
  type: UnitType,
): boolean {
  return resolutionBans(c.active(), player.smallID(), type);
}

export function buildCostPct(c: Congress, type: UnitType): number {
  return resolutionBuildCostPct(c.active(), type);
}

export function buildTimePct(c: Congress, type: UnitType): number {
  return resolutionBuildTimePct(c.active(), type);
}

export function nukeProductionTimePct(c: Congress, player: Player): number {
  return resolutionNukeTimePct(c.active(), player.smallID());
}

/** `baseTicks` under `pct` (capped like other combined cuts, at least one tick). */
export function withTimePct(baseTicks: number, pct: number): number {
  if (pct === 0) return baseTicks;
  return Math.max(
    1,
    Math.round((baseTicks * (100 + capCombinedPct(pct))) / 100),
  );
}

function techPact(c: Congress, option: BallotOption): boolean {
  return c
    .active()
    .some((r) => r.resolution === "tech_pact" && r.option === option);
}

/** Techs at least TECH_PACT_MIN_HOLDERS alive players have, in tech order. */
function widelyKnownTechs(mg: Game): TechId[] {
  const counts = new Map<TechId, number>();
  for (const p of mg.players()) {
    for (const t of p.domestic()?.researchedTechs() ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return TECH_IDS.filter((t) => (counts.get(t) ?? 0) >= TECH_PACT_MIN_HOLDERS);
}

/** E4 A: what `tech` costs now, in milli-points. */
export function researchCostMilli(
  c: Congress | null,
  tech: TechId,
  baseMilli: number,
): number {
  if (c === null || !c.discountedTechs().includes(tech)) return baseMilli;
  return Math.round((baseMilli * (100 + TECH_PACT_DISCOUNT_PCT)) / 100);
}

/** E4 A: research time percent for `tech` now. */
export function researchTimePct(c: Congress | null, tech: TechId): number {
  return c !== null && c.discountedTechs().includes(tech)
    ? TECH_PACT_DISCOUNT_PCT
    : 0;
}

/** E4 B: the first player to complete a tech nobody else has gets 60 s of its science. */
export function onResearchComplete(
  mg: Game,
  player: Player,
  tech: TechId,
): void {
  const c = mg.congress();
  if (c === null || !techPact(c, "B")) return;
  for (const p of mg.allPlayers()) {
    if (p !== player && p.domestic()?.hasTech(tech)) return;
  }
  const d = player.domestic();
  if (d === null) return;
  const science = d.scienceMilliPerSecond() * PATENT_SECONDS;
  d.grantPoints(science, 0);
  mg.displayMessage(
    "events_display.congress_patent",
    MessageType.CONGRESS,
    player.id(),
    undefined,
    { points: Math.floor(science / MILLI) },
  );
}
