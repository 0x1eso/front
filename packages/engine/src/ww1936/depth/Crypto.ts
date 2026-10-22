// P6 lane I fills this file (plan Task 5): cryptology (spec §8.7).
// The foundation's stub: final signatures, neutral answers.
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  cipherStrength,
  decryptPower,
} from "@openfront/engine-lib/ww1936/IntelRules";
import type { WwDepth } from "./WwDepth";

export function dailyCrypto(d: WwDepth, id: number, day: number): void {}

/** Spec §8.7: the decryption bp `att` fights `def` with (attack and defence). */
export function cryptoModsVs(d: WwDepth, att: number, def: number): number {
  return 0;
}

const CRYPTO_TECHS = [
  "cryptography_1",
  "cryptography_2",
  "cryptography_3",
] as const;
const COMPUTING_TECHS = ["computing_1", "computing_2"] as const;

function techCount(d: WwDepth, id: number, ids: readonly string[]): number {
  const r = d.ww.economy.country(id)?.researched;
  return r === undefined ? 0 : ids.filter((t) => r.has(t as never)).length;
}

function statOf(d: WwDepth, id: number, k: WwStatKey): number {
  const s = d.ww.economy.country(id)?.stats as
    | Partial<Record<WwStatKey, number>>
    | undefined;
  return s?.[k] ?? 0;
}

/**
 * Review E6: the country's cipher strength (spec §8.7 cipherStrength) from
 * its cryptography and computing techs and encryptPct; lane I adds the
 * agency's cipher department.
 */
export function cipherOf(d: WwDepth, id: number): number {
  return cipherStrength(
    techCount(d, id, CRYPTO_TECHS),
    techCount(d, id, COMPUTING_TECHS),
    false,
    statOf(d, id, "encryptPct"),
  );
}

/**
 * Review E6: the country's decryption power (spec §8.7 decryptPower):
 * none without an agency; lane I adds its crypto departments.
 */
export function decryptOf(d: WwDepth, id: number): number {
  return decryptPower(
    d.country(id)?.intel.agency ?? false,
    false,
    false,
    techCount(d, id, CRYPTO_TECHS),
    techCount(d, id, COMPUTING_TECHS),
    statOf(d, id, "decryptPct"),
  );
}
