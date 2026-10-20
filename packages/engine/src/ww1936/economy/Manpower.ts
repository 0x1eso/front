// World War 1936 P1: manpower and the troop bridge (spec §6).
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  infEquipmentFor,
  manpowerRegrowth,
  recruitToday,
  troopCapOf,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { Player } from "../../game/Game";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/**
 * One day of manpower growth (spec §6.2): a tenth of the recruitable pool a
 * year, never past what the regions could still give. The whole army counts
 * against that, men away in attacks and on boats too (WwEconomy.armyMen), so
 * troops and manpower together never exceed the recruitable pool. Losing
 * regions shrinks manpower only through this ceiling.
 */
export function stepManpower(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const ceiling = Math.max(0, ce.totals.recruitable - econ.armyMen(p));
  ce.manpower = Math.min(
    ce.manpower + manpowerRegrowth(ce.totals.recruitable),
    ceiling,
  );
}

/**
 * The daily draft and the troop cap (spec §6.3, §6.4): the only way troops
 * grow in this mode. Each ten men take one infantry equipment from the
 * stock, newest generation first; it goes to the field (fieldInf*).
 */
export function stepRecruit(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  const t = ce.totals;
  const r = recruitToday(ce.manpower, ce.infStock(), t.trainCap);
  if (r > 0) {
    let need = infEquipmentFor(r);
    for (
      let gen = EQUIPMENT_GENS.infantry_equipment;
      gen >= 1 && need > 0;
      gen--
    ) {
      const k = equipKey("infantry_equipment", gen);
      const take = Math.min(need, ce.stock[k]);
      ce.stock[k] -= take;
      need -= take;
      ce.fieldInfUnits += take;
      ce.fieldInfGenSum += take * gen;
    }
    ce.manpower -= r;
    p.addTroops(r);
  }
  t.recruited = r;
  t.troopCap = troopCapOf(Math.floor(p.troops()), ce.manpower, ce.infStock());
}
