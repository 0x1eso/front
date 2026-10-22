// World War 1936 P6 (P6 spec §8): intelligence levels, cryptology,
// networks, capture chances and operations. Every formula is the
// foundation's (plan Task 1 Step 7); lane I fills opStartBlock and
// upgradeBlock and writes the engine side (Task 5).
import {
  AGENCY_UPGRADES,
  AgencyUpgrade,
  ID_AIR,
  ID_ARMY,
  ID_CIVIL,
  INTEL_BAND_FLOORS,
  IntelOperation,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";

export interface IntelInput {
  domain: number;
  sameFaction: boolean;
  neighbour: boolean;
  atWar: boolean;
  /** max(own network, faction-shared network × 50%) on the target, milli‰ (0..1_000_000). */
  networkMilliPm: number;
  /** The observer has the domain's department upgrade (civil: ag_civil_dept …). */
  department: boolean;
  infiltrated: boolean;
  decrypted: boolean;
  exploiting: boolean;
  /** Army only: ≥ 20 own-side recon sorties today over a land zone holding a target region; a skirmisher in contact. */
  recon: boolean;
  skirmisher: boolean;
  /** Air only: own radar range reaches a target region. */
  radar: boolean;
  targetCounterMissions: number;
  intelPct: number;
}

/** Spec §8.8, the order of the lines fixed. */
export function intelLevel(i: IntelInput): number {
  let v = 5;
  if (i.neighbour) v += 10;
  if (i.sameFaction) v += 10;
  if (i.atWar) v += 15;
  v += Math.min(50, Math.floor(i.networkMilliPm / 20_000));
  if (i.department) v += 10;
  if (i.infiltrated && i.domain !== ID_CIVIL) v += 30;
  if (i.exploiting) v += i.domain === ID_CIVIL ? 15 : 30;
  else if (i.decrypted) v += 10;
  if (i.domain === ID_ARMY) {
    if (i.recon) v += 20;
    if (i.skirmisher) v += 20;
  }
  if (i.domain === ID_AIR && i.radar) v += 10;
  v -= Math.min(30, 10 * i.targetCounterMissions);
  v += Math.floor(i.intelPct / 10);
  v = Math.max(0, Math.min(100, v));
  return i.sameFaction ? Math.max(80, v) : v;
}

export function intelBand(level: number): 0 | 1 | 2 | 3 {
  return level >= INTEL_BAND_FLOORS[3]
    ? 3
    : level >= INTEL_BAND_FLOORS[2]
      ? 2
      : level >= INTEL_BAND_FLOORS[1]
        ? 1
        : 0;
}

/** Spec §8.7. `cryptoTechs` = cryptography techs held, `computingTechs` = computing techs held. */
export function cipherStrength(
  cryptoTechs: number,
  computingTechs: number,
  agCipher: boolean,
  encryptPct: number,
): number {
  return (
    100 +
    40 * cryptoTechs +
    25 * computingTechs +
    (agCipher ? 50 : 0) +
    encryptPct
  );
}

export function decryptPower(
  agency: boolean,
  crypto1: boolean,
  crypto2: boolean,
  cryptoTechs: number,
  computingTechs: number,
  decryptPct: number,
): number {
  if (!agency) return 0;
  return (
    10 +
    (crypto1 ? 20 : 0) +
    (crypto2 ? 30 : 0) +
    15 * cryptoTechs +
    10 * computingTechs +
    decryptPct
  );
}

/** Spec §8.7: milli‰ a day (Britain → Germany 1939: D 100, E 255 → 1633). */
export function decryptPerDayMilli(d: number, e: number): number {
  return d <= 0 || e <= 0 ? 0 : Math.floor((d * 1_000_000) / (e * 240));
}

export const CRYPTO_TECHS: readonly WwTechId[] = [
  "cryptography_1",
  "cryptography_2",
  "cryptography_3",
];
export const COMPUTING_TECHS: readonly WwTechId[] = [
  "computing_1",
  "computing_2",
];

/** Plan decision 18: the target's counter-intelligence in half units. */
export function counterHalf(
  counterMissions: number,
  agCounter: boolean,
): number {
  return counterMissions + (agCounter ? 2 : 0);
}

/** Plan decision 18: network growth of one build_network operative a day, milli‰. */
export function networkGainMilli(
  skill: number,
  intelPct: number,
  targetCounterMissions: number,
  targetAgCounter: boolean,
): number {
  const g = Math.floor((3000 * (1 + skill) * (100 + intelPct)) / 200);
  const cut = Math.min(
    90,
    Math.min(75, 25 * targetCounterMissions) + (targetAgCounter ? 30 : 0),
  );
  return Math.floor((g * (100 - cut)) / 100);
}
export const NETWORK_DECAY_MILLI = 1_000;

/** Spec §8.3: capture chance today, milli‰ (compare wwRoll % 1_000_000). */
export function capturePmMilli(
  onOperation: boolean,
  skill: number,
  counterHalfUnits: number,
  exileOwnCore: boolean,
): number {
  const base = onOperation ? 5 : 2;
  const p = Math.floor((base * 1000 * (2 + counterHalfUnits)) / 2);
  const q = Math.floor((p * (100 - 25 * (skill - 1))) / 100);
  return exileOwnCore ? Math.floor(q / 2) : q;
}

/** Spec §8.5 table. */
export interface OperationDef {
  networkPm: number;
  operatives: 1 | 2;
  days: number;
  pp: number;
  infEquipment: number;
  rolls: boolean;
}
export const OPERATION_DEFS: Readonly<Record<IntelOperation, OperationDef>> = {
  op_infiltrate_army: {
    networkPm: 300,
    operatives: 1,
    days: 60,
    pp: 25,
    infEquipment: 0,
    rolls: false,
  },
  op_infiltrate_navy: {
    networkPm: 300,
    operatives: 1,
    days: 60,
    pp: 25,
    infEquipment: 0,
    rolls: false,
  },
  op_infiltrate_air: {
    networkPm: 300,
    operatives: 1,
    days: 60,
    pp: 25,
    infEquipment: 0,
    rolls: false,
  },
  op_steal_blueprints: {
    networkPm: 400,
    operatives: 1,
    days: 90,
    pp: 25,
    infEquipment: 0,
    rolls: false,
  },
  op_capture_cipher: {
    networkPm: 500,
    operatives: 2,
    days: 90,
    pp: 50,
    infEquipment: 0,
    rolls: false,
  },
  op_sabotage: {
    networkPm: 300,
    operatives: 1,
    days: 45,
    pp: 25,
    infEquipment: 0,
    rolls: false,
  },
  op_collaboration: {
    networkPm: 600,
    operatives: 2,
    days: 120,
    pp: 50,
    infEquipment: 0,
    rolls: true,
  },
  op_coup: {
    networkPm: 800,
    operatives: 2,
    days: 150,
    pp: 100,
    infEquipment: 1_000,
    rolls: true,
  },
  op_rescue: {
    networkPm: 300,
    operatives: 1,
    days: 30,
    pp: 25,
    infEquipment: 0,
    rolls: false,
  },
  op_uprising: {
    networkPm: 400,
    operatives: 1,
    days: 60,
    pp: 25,
    infEquipment: 500,
    rolls: false,
  },
};

/** Spec §8.5: days after ag_army_dept (−25% for the army infiltration), ag_special_ops (−20%), opSpeedPct. */
export function operationDays(
  op: IntelOperation,
  armyDept: boolean,
  specialOps: boolean,
  opSpeedPct: number,
): number {
  let cut =
    (specialOps ? 20 : 0) +
    (armyDept && op === "op_infiltrate_army" ? 25 : 0) +
    opSpeedPct;
  cut = Math.min(80, Math.max(-100, cut));
  return Math.max(1, Math.floor((OPERATION_DEFS[op].days * (100 - cut)) / 100));
}

/**
 * Spec §8.5: success ‰ of op_collaboration / op_coup. Pre-flight §A13:
 * compare `wwRoll % 1_000_000 < pm * 1000` (milli‰ everywhere).
 */
export function opSuccessPm(
  networkPm: number,
  avgSkillMilli: number,
  civilDept: boolean,
  targetCounterHalf: number,
): number {
  const v =
    400 +
    Math.floor(networkPm / 2) +
    Math.floor((100 * (avgSkillMilli - 1000)) / 1000) +
    (civilDept ? 50 : 0) -
    50 * targetCounterHalf;
  return Math.max(0, Math.min(950, v));
}

/** Spec §8.5 op_coup: the needed share of my ideology in the target, bp. */
export function coupNeedBp(targetStabilityBp: number): number {
  return targetStabilityBp < 5_000 ? 3_000 : 4_000;
}

/** Spec §8.2: upgrade prerequisites (computing_1 for ag_crypto_2 is checked by the caller). */
export const UPGRADE_NEEDS: Readonly<
  Partial<Record<AgencyUpgrade, AgencyUpgrade>>
> = {
  ag_ops_2: "ag_ops_1",
  ag_ops_3: "ag_ops_2",
  ag_crypto_2: "ag_crypto_1",
  ag_special_ops: "ag_ops_1",
};
export const upgradeBit = (u: AgencyUpgrade) => 1 << AGENCY_UPGRADES.indexOf(u);

export function operativeSlots(upgrades: number): number {
  return (
    1 +
    (["ag_ops_1", "ag_ops_2", "ag_ops_3"] as const).filter(
      (u) => (upgrades & upgradeBit(u)) !== 0,
    ).length
  );
}

/** Spec §8.9: the division-count label of an enemy army token. band 0 "?", 1 ±50% (2-rounded), 2 ±20%, 3 exact. */
export function fogCountLabel(count: number, band: number): string {
  if (band <= 0) return "?";
  if (band >= 3) return String(count);
  const pct = band === 1 ? 50 : 20;
  const step = band === 1 ? 2 : 1;
  const lo = Math.max(0, Math.floor((count * (100 - pct)) / 100 / step) * step);
  const hi = Math.ceil((count * (100 + pct)) / 100 / step) * step;
  return lo === hi ? String(lo) : `${lo}~${hi}`;
}

/**
 * Spec §8.9 attack-preview row. The middle of a symmetric range is the true value and would leak it,
 * so below "exact" the preview uses the top of the band's range (never optimistic for the attacker).
 */
export function fogPreviewValue(count: number, band: number): number {
  if (band >= 3) return count;
  const pct = band <= 0 ? 100 : band === 1 ? 50 : 20;
  return Math.ceil((count * (100 + pct)) / 100);
}

export interface OpStartInput {
  agency: boolean;
  op: IntelOperation;
  networkPm: number;
  operativesFree: number;
  pp: number;
  infEquipment: number;
  atWar: boolean;
  targetHasCaptive: boolean;
  targetControlsMyCore: boolean;
  ideologyBp: number;
  targetStabilityBp: number;
  halfThreshold: boolean;
}

/** Refusal of operation_start (plan decision 40). I fills (spec §8.5 conditions). */
export function opStartBlock(
  i: OpStartInput,
):
  | "no_agency"
  | "network_low"
  | "no_operative"
  | "op_unavailable"
  | "no_pp"
  | null {
  return "op_unavailable";
}

export interface UpgradeInput {
  agency: boolean;
  /** AGENCY_UPGRADES bits held. */
  upgrades: number;
  upgrade: AgencyUpgrade;
  /** An upgrade already in progress. */
  inProgress: boolean;
  computing1: boolean;
  freeCivs: number;
}

/** Refusal of intel_upgrade (plan decision 40). I fills (spec §8.2). */
export function upgradeBlock(
  i: UpgradeInput,
): "no_agency" | "bad_index" | "no_civs" | null {
  return "no_agency";
}
