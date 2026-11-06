import {
  GW_AI_KINDS,
  GW_FIELDS,
  GW_OPENINGS,
  GW_SOURCES,
  GW_TOPICS,
  GwOpening,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { openChapter } from "./Chapters";
import type { GreatWar } from "./GreatWar";

const P_OPENING = idHash("gw_opening");
const P_TEMPERAMENT = idHash("gw_temperament");
const P_COMPETENCE = idHash("gw_competence");
const P_HEALTH = idHash("gw_health");
const P_SOURCE = idHash("gw_source");
const P_AI = idHash("gw_ai");

/** Design §15 no. 7: Sarajevo 70, its variants 20, none 10. */
function openingOf(roll: number): GwOpening {
  const r = roll % 100;
  if (r < 70) return "sarajevo";
  if (r < 90) return GW_OPENINGS[1 + (r % 3)];
  return "no_sarajevo";
}

/**
 * The game's own world (design §4.4), once, from the seed, then the first
 * chapter. The world lane adds strength bands, secrets and hot topics here.
 */
export function rollWorld(gw: GreatWar, seed: number, ticks: number): void {
  const s = gw.s;
  s.seed = seed;
  s.rolled = true;
  s.opening = openingOf(wwRoll(seed, P_OPENING, 0));
  if (s.opening !== "no_sarajevo") {
    s.crisis = GW_TOPICS[0];
    s.temp = 3;
  }
  const defs = gwContent().people;
  s.people.forEach((p, i) => {
    const t = defs[i].temperaments;
    p.temperament = t[wwRoll(seed, P_TEMPERAMENT, i) % t.length];
    p.competence = GW_FIELDS.map(
      (_, f) => 1 + (wwRoll(seed, P_COMPETENCE, i, f) % 3),
    );
    p.health = 1 + (wwRoll(seed, P_HEALTH, i) % 3);
  });
  s.sources = GW_SOURCES.map((id, i) => ({
    id,
    band: 1 + (wwRoll(seed, P_SOURCE, i) % 3),
    right: 0,
    wrong: 0,
  }));
  s.nations.forEach((n, i) => {
    n.ai = GW_AI_KINDS[wwRoll(seed, P_AI, i) % GW_AI_KINDS.length];
  });
  openChapter(gw, ticks);
}
