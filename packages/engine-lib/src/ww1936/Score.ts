import { FACTION_IDS, FactionId } from "@openfront/engine-api/ww1936/Countries";

/** One country's numbers for the verdict (spec §7.6). */
export interface CountryScoreInput {
  smallID: number;
  faction: FactionId | null;
  major: boolean;
  /** Alive and not capitulated. */
  alive: boolean;
  /** Victory points it controls now (its VP tiles). */
  vp: number;
  tiles: number;
}

/** A faction, or one unaligned country (camp = its smallID). */
export interface CampScore {
  camp: FactionId | number;
  members: number[];
  vp: number;
  tiles: number;
  /** 0..10000 (plan decision 12). */
  scoreBp: number;
  livingMajors: number;
}

/** 70% victory points + 30% land, in basis points. */
export function scoreBp(
  vp: number,
  tiles: number,
  totalVp: number,
  totalTiles: number,
): number {
  const v = totalVp > 0 ? Math.floor((7000 * vp) / totalVp) : 0;
  const t = totalTiles > 0 ? Math.floor((3000 * tiles) / totalTiles) : 0;
  return v + t;
}

function campRank(c: CampScore): number {
  return typeof c.camp === "number"
    ? FACTION_IDS.length + c.camp
    : FACTION_IDS.indexOf(c.camp);
}

/**
 * Camps with a living member, best first: score, then victory points, then
 * the fixed camp order (factions, then countries by smallID).
 */
export function campScores(
  inputs: readonly CountryScoreInput[],
  totalVp: number,
  totalTiles: number,
): CampScore[] {
  const camps = new Map<FactionId | number, CampScore & { alive: boolean }>();
  const sorted = [...inputs].sort((a, b) => a.smallID - b.smallID);
  for (const c of sorted) {
    const key = c.faction ?? c.smallID;
    let camp = camps.get(key);
    if (camp === undefined) {
      camp = {
        camp: key,
        members: [],
        vp: 0,
        tiles: 0,
        scoreBp: 0,
        livingMajors: 0,
        alive: false,
      };
      camps.set(key, camp);
    }
    camp.members.push(c.smallID);
    camp.vp += c.vp;
    camp.tiles += c.tiles;
    if (c.alive) {
      camp.alive = true;
      if (c.major) camp.livingMajors++;
    }
  }
  const out: CampScore[] = [];
  for (const camp of camps.values()) {
    if (!camp.alive) continue;
    out.push({
      camp: camp.camp,
      members: camp.members,
      vp: camp.vp,
      tiles: camp.tiles,
      scoreBp: scoreBp(camp.vp, camp.tiles, totalVp, totalTiles),
      livingMajors: camp.livingMajors,
    });
  }
  return out.sort(
    (a, b) => b.scoreBp - a.scoreBp || b.vp - a.vp || campRank(a) - campRank(b),
  );
}

/** The one camp that still has a living major, or null (spec §7.6). */
export function lastCampStanding(
  camps: readonly CampScore[],
): CampScore | null {
  const withMajor = camps.filter((c) => c.livingMajors > 0);
  return withMajor.length === 1 ? withMajor[0] : null;
}

/** MVP order inside a camp: own score, then smallID. */
export function rankMembers(
  inputs: readonly CountryScoreInput[],
  members: readonly number[],
  totalVp: number,
  totalTiles: number,
): { smallID: number; scoreBp: number }[] {
  return inputs
    .filter((c) => members.includes(c.smallID))
    .map((c) => ({
      smallID: c.smallID,
      scoreBp: scoreBp(c.vp, c.tiles, totalVp, totalTiles),
    }))
    .sort((a, b) => b.scoreBp - a.scoreBp || a.smallID - b.smallID);
}
