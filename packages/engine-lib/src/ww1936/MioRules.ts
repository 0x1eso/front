// World War 1936 P6 (P6 spec §6): military industrial organisations. The
// tables are final (plan Task 1 Step 8); lane M polishes (Task 4).
import {
  MIO_FREE_TRAIT,
  MIO_MAX_SIZE,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

export function mioSize(fundsMilli: number): number {
  let n = 0;
  while (n < MIO_MAX_SIZE && 300_000 * (n + 1) * (n + 2) <= fundsMilli) n++;
  return n;
}

export function mioNextMilli(size: number): number {
  return size >= MIO_MAX_SIZE ? 0 : 300_000 * (size + 1) * (size + 2);
}

const popcount = (m: number) => {
  let c = 0;
  for (let x = m; x !== 0; x &= x - 1) c++;
  return c;
};

/** Spec §6.2: points left = size − traits bought (the archetype's free trait is not bought). */
export function mioPoints(
  size: number,
  traits: number,
  archetype: number,
): number {
  return (
    size -
    (popcount(traits) -
      ((traits & (1 << MIO_FREE_TRAIT[archetype])) !== 0 ? 1 : 0))
  );
}

/** Spec §6.3: row 2 needs row 1 of its column, row 3 needs row 2; p3 and q3 exclude each other. */
export function mioTraitBlock(
  traits: number,
  trait: number,
  points: number,
): "bad_index" | "prereq" | "no_slot" | null {
  if ((traits & (1 << trait)) !== 0) return "bad_index";
  const col = Math.floor(trait / 3);
  const row = trait % 3;
  if (row > 0 && (traits & (1 << (col * 3 + row - 1))) === 0) return "prereq";
  if (
    (trait === 2 && (traits & (1 << 5)) !== 0) ||
    (trait === 5 && (traits & (1 << 2)) !== 0)
  ) {
    return "prereq";
  }
  return points <= 0 ? "no_slot" : null;
}

/** Families whose equipment has reliability (armour, aircraft): q1 is +5pp there, cost −3% elsewhere. */
export const MIO_HAS_REL: readonly boolean[] = [
  false,
  false,
  true,
  true,
  true,
  false,
];
const F = [
  "infantry",
  "artillery",
  "armor",
  "air_light",
  "air_heavy",
  "naval",
] as const;

/** Spec §6.3 tables as stats of the active archetype's traits. */
export function mioStats(family: number, traits: number): Partial<WwStats> {
  const f = F[family];
  const o: Record<string, number> = {};
  const add = (k: string, v: number) => {
    o[k] = (o[k] ?? 0) + v;
  };
  const on = (i: number) => (traits & (1 << i)) !== 0;
  if (on(0)) add(`mioCostPct_${f}`, -5);
  if (on(1)) add(`mioEffCapBp_${f}`, 500);
  if (on(2)) {
    add(`mioCostPct_${f}`, -10);
    add(`mioRelPp_${f}`, -5);
  }
  if (on(3)) {
    if (MIO_HAS_REL[family]) add(`mioRelPp_${f}`, 5);
    else add(`mioCostPct_${f}`, -3);
  }
  if (on(4)) add(`mioStatPct_${f}`, 5);
  if (on(5)) {
    add(`mioStatPct_${f}`, 8);
    add(`mioCostPct_${f}`, 5);
  }
  const S: readonly (readonly (readonly [string, number])[])[][] = [
    [
      [["infAttackPct", 3]],
      [["supplyUsePct", -5]],
      [
        ["motSpeedPct", 5],
        ["fuelUsePct", -2],
      ],
    ],
    [[["artillerySoftPct", 5]], [["artSpeedPct", 10]], [["atPiercePct", 10]]],
    [[["armorBrkPct", 5]], [["armorArmorPct", 5]], [["armorPiercePct", 8]]],
    [
      [
        ["fighterAgilityPct", 5],
        ["airAttackPct", 0],
      ],
      [["fighterAttackPct", 5]],
      [
        ["airRangePct", 10],
        ["carrierDeckPct", 5],
      ],
    ],
    [
      [["airRangePct", 15]],
      [
        ["stratBombPct", 8],
        ["casPct", 8],
      ],
      [["bomberDefensePct", 8]],
    ],
    [
      [["navyDefensePct", 5]],
      [["navyAttackPct", 5]],
      [
        ["subAttackPct", 10],
        ["subVisibilityPct", -5],
      ],
    ],
  ];
  for (let r = 0; r < 3; r++) {
    if (on(6 + r)) for (const [k, v] of S[family][r]) add(k, v);
  }
  return o as Partial<WwStats>;
}

/** The MIO family of an equipment type (spec §6.1 table), -1 none. Ship classes and convoys → naval. M fills. */
export function mioFamilyOf(type: string, planeDesignType?: string): number {
  return -1;
}
