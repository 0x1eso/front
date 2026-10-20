// World War 1936 P1: the combat bridge (spec §6.5, §10). TEMPORARY until
// P2's divisions replace it: everything that turns equipment into vanilla
// attack scales, and men lost into equipment lost, is in this file.
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WW_EQUIPMENT_LOSS_SHARE_PCT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  coveragePermille,
  genBonusPct,
  wwCombatScales,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import type { DomesticCombat } from "../../domestic/DomesticEconomy";
import type { Player } from "../../game/Game";
import type { WorldWar } from "../WorldWar";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

const MAX_COMBAT_PCT = 200;

/**
 * Equipment lost with the men noted since the last day (spec §6.5): the
 * field infantry equipment by the share of the army lost (its generation
 * sum alike), the other ground equipment by half that share. The men do
 * not come back: they count in the casualties, which the recruitable pool
 * loses for good (WwEconomy.refreshTotals).
 */
export function applyCombatLosses(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const lost = Math.floor(ce.lossMilli / 1000);
  ce.lossMilli = 0;
  if (lost <= 0) return;
  ce.casualties += lost;
  // The losses already left the army: before them it had `lost` more.
  const before = econ.armyMen(p) + lost;
  const fLost = Math.floor((ce.fieldInfUnits * lost) / before);
  const gLost =
    ce.fieldInfUnits === 0
      ? 0
      : Math.floor((ce.fieldInfGenSum * fLost) / ce.fieldInfUnits);
  ce.fieldInfUnits -= fLost;
  ce.fieldInfGenSum -= gLost;
  EQUIP_KEYS.forEach(([type], k) => {
    if (EQUIPMENT[type].needPer100k === 0) return; // infantry, aircraft
    ce.stock[k] -= Math.floor(
      (ce.stock[k] * lost * WW_EQUIPMENT_LOSS_SHARE_PCT) / (before * 100),
    );
  });
}

/**
 * The country's attack, defense and speed percent (spec §10.1): the field
 * infantry's average generation, each ground equipment's coverage of the
 * army times its bonus, generation and doctrine multipliers, plus the
 * doctrines' flat bonuses; each 0–200.
 */
export function updateCombatStats(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const men = econ.armyMen(p);
  const avgInf =
    ce.fieldInfUnits === 0
      ? 100
      : Math.floor((ce.fieldInfGenSum * 100) / ce.fieldInfUnits);
  const inf = Math.floor(((avgInf - 100) * 10) / 100);
  let att = inf;
  let def = inf;
  let spd = 0;
  for (const type of EQUIPMENT_TYPES) {
    const d = EQUIPMENT[type];
    if (d.needPer100k === 0) continue;
    let units = 0;
    let genSum = 0;
    for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
      const n = ce.stock[equipKey(type, g)];
      units += n;
      genSum += n * g;
    }
    if (units <= 0) continue;
    const cov = coveragePermille(units, men, d.needPer100k);
    const gen = genBonusPct(Math.floor((genSum * 100) / units));
    const school =
      d.family === "vehicles"
        ? 100 + ce.tech.vehicleBonusPct
        : d.family === "guns" || type === "support_equipment"
          ? 100 + ce.tech.gunBonusPct
          : 100;
    // ‰ coverage × gen % × doctrine %: 1000 × 100 × 100.
    const part = (x: number) =>
      Math.floor((x * cov * gen * school) / 10_000_000);
    att += part(d.bonus[0]);
    def += part(d.bonus[1]);
    spd += part(d.bonus[2]);
  }
  const clamp = (v: number) => Math.max(0, Math.min(MAX_COMBAT_PCT, v));
  ce.totals.attackPct = clamp(att + ce.tech.attackPct);
  ce.totals.defensePct = clamp(def + ce.tech.defensePct);
  ce.totals.speedPct = clamp(spd + ce.tech.speedPct);
}

/**
 * The vanilla attack's scales in this mode (spec §10.2): both sides'
 * combat stats and the 60% loss scale on top of `base`. Outside the mode,
 * or against nobody, `base` itself.
 */
export function withWwCombat(
  base: Readonly<DomesticCombat>,
  ww: WorldWar | null,
  attacker: Player,
  defender: Player | null,
): Readonly<DomesticCombat> {
  if (ww === null || defender === null) return base;
  const s = wwCombatScales(
    ww.economy.combatStats(attacker.smallID()),
    ww.economy.combatStats(defender.smallID()),
  );
  return {
    ...base,
    attackerLoss: base.attackerLoss * s.attackerLoss,
    defenderLoss: base.defenderLoss * s.defenderLoss,
    attackerSpeed: base.attackerSpeed * s.attackerSpeed,
  };
}
