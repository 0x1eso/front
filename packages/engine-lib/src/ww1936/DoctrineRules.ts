// World War 1936 P6 (P6 spec §3): what is left of the doctrines. The
// mastery, picks and sub-doctrines went with the old doctrines (013e6b93c);
// the grand-doctrine stat table stays (tests grant its rows), and the
// battalions' stat percents.
import {
  GRAND_DOCTRINES,
  GrandDoctrine,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  BattalionId,
  SupportId,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { natUnitRow, type NatUnitRow } from "./NationalUnits";
import { retiredTechEffects } from "./WwTechs";

/**
 * Spec §3.2: base and completion stats of each grand doctrine — the old
 * doctrine techs' tier 1 / tier 2 effects on the very keys the P2–P4
 * readers read (pre-flight §0-5; review L1: built from the retired techs,
 * one source). `gd_<school>` carries `<school>_1` and `<school>_2`.
 */
export const GRAND_DOCTRINE_STATS: Readonly<
  Record<GrandDoctrine, readonly [Partial<WwStats>, Partial<WwStats>]>
> = Object.fromEntries(
  GRAND_DOCTRINES.map((g) => {
    const school = g.slice("gd_".length);
    return [
      g,
      [
        retiredTechEffects(`${school}_1` as WwTechId) as Partial<WwStats>,
        retiredTechEffects(`${school}_2` as WwTechId) as Partial<WwStats>,
      ],
    ];
  }),
) as unknown as Record<
  GrandDoctrine,
  readonly [Partial<WwStats>, Partial<WwStats>]
>;

/** Percent changes of one battalion's numbers from the country's stats (plan Task 1 Step 13). */
export interface BattalionStatPct {
  soft: number;
  hard: number;
  def: number;
  brk: number;
  armor: number;
  pierce: number;
  speed: number;
  /** Organisation added, whole points. */
  org: number;
  /** ww91: supply use, training time and hit points, percent (national units, supply spirits). */
  supply: number;
  train: number;
  hp: number;
}

const INFANTRY_LIKE: ReadonlySet<string> = new Set([
  "infantry",
  "cavalry",
  "mountain",
  "marine",
  "paratrooper",
  "motorized",
]);
const TANKS: ReadonlySet<string> = new Set([
  "light_armor",
  "medium_armor",
  "heavy_armor",
]);
const AT_LIKE: ReadonlySet<string> = new Set([
  "anti_tank",
  "support_anti_tank",
  "tank_destroyer",
]);
/** ww91: the gun battalions whose supply use artSupplyPct changes. */
const GUNS: ReadonlySet<string> = new Set([
  "artillery",
  "mot_artillery",
  "sp_artillery",
  "support_artillery",
]);
const ART_LIKE: ReadonlySet<string> = new Set([
  "artillery",
  "mot_artillery",
  "support_artillery",
  "sp_artillery",
  "anti_air",
  "support_anti_air",
  "sp_anti_air",
]);

const ZERO_PCT: BattalionStatPct = {
  soft: 0,
  hard: 0,
  def: 0,
  brk: 0,
  armor: 0,
  pierce: 0,
  speed: 0,
  org: 0,
  supply: 0,
  train: 0,
  hp: 0,
};

/**
 * Plan Task 1 Step 13: the P6 stat keys that change one battalion (or
 * support company) — infantry, armour, anti-tank and artillery families,
 * MIO stat traits. Keys P2 already reads (artillerySoftPct, infOrg,
 * mechBreakPct …) stay where P2 reads them. All zero without P6 stats.
 */
export function battalionStatPct(
  stats: Partial<Record<WwStatKey, number>>,
  bat: BattalionId | SupportId,
): BattalionStatPct {
  const s = (k: WwStatKey) => stats[k] ?? 0;
  // ww91: a national unit's row, only for its own base battalion, only once
  // the country holds the unit (natUnit); a foot battalion's national traits.
  const nat = natUnitRow(s("natUnit"), bat);
  if (INFANTRY_LIKE.has(bat)) {
    const mio = s("mioStatPct_infantry");
    const out: BattalionStatPct = {
      ...ZERO_PCT,
      soft: s("infAttackPct") + mio,
      hard: s("infAttackPct") + s("infHardPct") + mio,
      def: s("infDefensePct") + mio,
      brk: bat === "motorized" ? 0 : s("infBrkPct"),
      speed: bat === "motorized" ? s("motSpeedPct") : 0,
      org: bat === "motorized" ? s("motOrg") : 0,
      supply: s("infSupplyPct"),
    };
    if (nat !== null) addNatRow(out, nat);
    return out;
  }
  if (TANKS.has(bat)) {
    const mio = s("mioStatPct_armor");
    return {
      ...ZERO_PCT,
      soft: s("armorAttackPct") + mio,
      hard: s("armorAttackPct") + mio,
      brk: s("armorBrkPct") + mio,
      def: s("armorDefensePct"),
      armor: s("armorArmorPct"),
      pierce: s("armorPiercePct"),
      speed: s("armorSpeedPct"),
    };
  }
  if (AT_LIKE.has(bat)) {
    const mio = bat === "tank_destroyer" ? s("mioStatPct_armor") : 0;
    return {
      ...ZERO_PCT,
      hard: s("atHardPct") + mio,
      pierce: s("atPiercePct") + mio,
    };
  }
  if (ART_LIKE.has(bat)) {
    const mio = s("mioStatPct_artillery");
    return {
      ...ZERO_PCT,
      soft: mio,
      hard: mio,
      supply: GUNS.has(bat) ? s("artSupplyPct") : 0,
      speed:
        bat === "artillery" || bat === "mot_artillery" || bat === "sp_artillery"
          ? s("artSpeedPct")
          : 0,
    };
  }
  return ZERO_PCT;
}

function addNatRow(out: BattalionStatPct, r: NatUnitRow): void {
  out.soft += r.soft;
  out.hard += r.hard;
  out.brk += r.brk;
  out.org += r.org;
  out.hp += r.hp;
  out.supply += r.supply;
  out.train += r.train;
}

/** x × (100 + pct) / 100, rounded down; x itself at 0 (static divisions keep P2's numbers). */
export function pctOf(x: number, pct: number): number {
  return pct === 0 ? x : Math.floor((x * (100 + Math.max(-90, pct))) / 100);
}

// ---- Start doctrines (spec §3.5, §19.2; pre-flight §0-9; review E3) ----
