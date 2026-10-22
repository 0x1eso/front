// P6 lane I (plan Task 5): cryptology (spec §8.7). WwDepth.decrypted holds
// one row per (breaker o, target t): progressMilli (1,000,000 = broken)
// and activeUntil — −1 never exploited; ≥ 0 exploiting while the day is
// below it; ≤ −2 an exploitation that ended on day −activeUntil − 2 (the
// target's "our codes were read" log; spec §8.7: it learns only then).
import {
  DECRYPT_EXPLOIT_DAYS,
  DECRYPT_RESET_PM,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  cipherStrength,
  COMPUTING_TECHS,
  CRYPTO_TECHS,
  decryptPerDayMilli,
  decryptPower,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { sharedIntel } from "./FactionRules";
import { hasUp, statOf, validTarget } from "./Operatives";
import type { WwDepth, WwDepthState } from "./WwDepth";

type DecryptRow = WwDepthState["decrypted"][number];

export const DECRYPT_FULL_MILLI = 1_000_000;
/** Spec §8.7: battles with an exploited enemy, attack and defence +5%. */
export const EXPLOIT_COMBAT_BP = 500;

export function decryptRow(
  d: WwDepth,
  o: number,
  t: number,
): DecryptRow | undefined {
  return d.decrypted.find((x) => x.o === o && x.t === t);
}

/**
 * Derived (no state): (o × 1024 + t) → activeUntil of the exploitations
 * started, so the land war's per-round read is one lookup with no
 * allocation (lane D reads cryptoModsVs per battle side and round). Built
 * from WwDepth.decrypted; rebuilt when that array is another one (a
 * restore) or after this file changes an activeUntil (markExploits).
 */
interface ExploitIndex {
  rows: WwDepthState["decrypted"];
  dirty: boolean;
  until: Map<number, number>;
}
const EXPLOITS = new WeakMap<WwDepth, ExploitIndex>();

function exploitIndex(d: WwDepth): ExploitIndex {
  let x = EXPLOITS.get(d);
  if (x === undefined || x.rows !== d.decrypted || x.dirty) {
    const until = new Map<number, number>();
    for (const r of d.decrypted) {
      if (r.activeUntil >= 0) until.set(r.o * 1024 + r.t, r.activeUntil);
    }
    x = { rows: d.decrypted, dirty: false, until };
    EXPLOITS.set(d, x);
  }
  return x;
}

function markExploits(d: WwDepth): void {
  const x = EXPLOITS.get(d);
  if (x !== undefined) x.dirty = true;
}

/** Spec §8.7: `o` exploits `t`'s broken codes today (fleet spotting and raiding read this after T1b). O(1). */
export function exploiting(d: WwDepth, o: number, t: number): boolean {
  const until = exploitIndex(d).until;
  if (until.size === 0) return false;
  const u = until.get(o * 1024 + t);
  return u !== undefined && d.lastCommonDay < u;
}

/** `o` broke `t`'s codes itself. */
export function decryptedOwn(d: WwDepth, o: number, t: number): boolean {
  return (decryptRow(d, o, t)?.progressMilli ?? 0) >= DECRYPT_FULL_MILLI;
}

/** The faction members `o` shares intelligence with (fr_shared_intel, spec §8.6), ascending. */
export function intelSharers(d: WwDepth, o: number): number[] {
  const pol = d.ww.politics;
  const f = pol.factionIdx(o);
  if (f < 0) return [];
  return pol
    .factionMembers(f)
    .filter((m) => m !== o && d.ww.isActor(m) && sharedIntel(d, o, m));
}

/** Spec §8.7: broken by `o` or by a member sharing intelligence with it. */
export function decryptedFor(d: WwDepth, o: number, t: number): boolean {
  if (decryptedOwn(d, o, t)) return true;
  return intelSharers(d, o).some((m) => decryptedOwn(d, m, t));
}

/** Spec §8.7: the decryption bp `att` fights `def` with (attack and defence). O(1), no allocation. */
export function cryptoModsVs(d: WwDepth, att: number, def: number): number {
  return exploiting(d, att, def) ? EXPLOIT_COMBAT_BP : 0;
}

function techCount(d: WwDepth, id: number, ids: readonly string[]): number {
  const r = d.ww.economy.country(id)?.researched;
  return r === undefined ? 0 : ids.filter((t) => r.has(t as never)).length;
}

/** Review E6, spec §8.7: the country's cipher strength (techs, ag_cipher, encryptPct). */
export function cipherOf(d: WwDepth, id: number): number {
  return cipherStrength(
    techCount(d, id, CRYPTO_TECHS),
    techCount(d, id, COMPUTING_TECHS),
    hasUp(d.country(id), "ag_cipher"),
    statOf(d, id, "encryptPct"),
  );
}

/** Review E6, spec §8.7: the country's decryption power (none without an agency). */
export function decryptOf(d: WwDepth, id: number): number {
  const c = d.country(id);
  return decryptPower(
    c?.intel.agency ?? false,
    hasUp(c, "ag_crypto_1"),
    hasUp(c, "ag_crypto_2"),
    techCount(d, id, CRYPTO_TECHS),
    techCount(d, id, COMPUTING_TECHS),
    statOf(d, id, "decryptPct"),
  );
}

/** Today's progress of `o` on `t`, milli‰. */
export function decryptDayMilli(d: WwDepth, o: number, t: number): number {
  return decryptPerDayMilli(decryptOf(d, o), cipherOf(d, t));
}

/** Days until `o` breaks its target at today's pace; −1 none or no pace. */
export function cryptoDaysLeft(d: WwDepth, o: number): number {
  const t = d.country(o)?.intel.cryptoTarget ?? 0;
  if (t <= 0) return -1;
  const per = decryptDayMilli(d, o, t);
  if (per <= 0) return -1;
  const have = decryptRow(d, o, t)?.progressMilli ?? 0;
  return Math.max(0, Math.ceil((DECRYPT_FULL_MILLI - have) / per));
}

/**
 * Adds decryption progress of `o` on `t` (op_capture_cipher, the decrypt
 * effect), 0..1,000,000; the breaker hears when it completes.
 */
export function addDecryptMilli(
  d: WwDepth,
  o: number,
  t: number,
  milli: number,
): void {
  if (milli === 0 || o === t || t <= 0 || t >= d.cap) return;
  let r = decryptRow(d, o, t);
  if (r === undefined) {
    if (milli < 0) return;
    r = { o, t, progressMilli: 0, activeUntil: -1 };
    d.decrypted.push(r);
  }
  const was = r.progressMilli;
  r.progressMilli = Math.max(0, Math.min(DECRYPT_FULL_MILLI, was + milli));
  if (was < DECRYPT_FULL_MILLI && r.progressMilli >= DECRYPT_FULL_MILLI) {
    d.message(o, "ww1936_decrypted", { countryTag: d.ww.tagOf(t) });
  }
  d.markCountry(o);
}

/** crypto_target (spec §8.7): one target at a time. */
export function setCryptoTarget(
  d: WwDepth,
  id: number,
  t: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  if (!validTarget(d, id, t)) return "bad_target";
  c.intel.cryptoTarget = t;
  d.markCountry(id);
  return null;
}

/** crypto_activate (spec §8.7): 90 days of exploitation of a broken code (shared ones too). */
export function activateCrypto(
  d: WwDepth,
  id: number,
  t: number,
  day: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  if (!validTarget(d, id, t)) return "bad_target";
  let r = decryptRow(d, id, t);
  if (r !== undefined && r.activeUntil >= 0 && day < r.activeUntil) {
    return "in_progress";
  }
  if (!decryptedFor(d, id, t)) return "not_decrypted";
  if (r === undefined) {
    r = { o: id, t, progressMilli: 0, activeUntil: -1 };
    d.decrypted.push(r);
  }
  r.activeUntil = day + DECRYPT_EXPLOIT_DAYS;
  markExploits(d);
  d.markCountry(id);
  d.markIntel(id);
  return null;
}

/**
 * Spec §8.7, on the breaker's turn: an exploitation whose 90 days are over
 * ends (the target changes its codes: the progress falls to 300‰, and only
 * now it learns of it); then a day of work on the current target.
 */
export function dailyCrypto(d: WwDepth, id: number, day: number): void {
  for (const r of d.decrypted) {
    if (r.o !== id || r.activeUntil < 0) continue;
    // Review 5: a sharer's break that is no longer shared (the faction
    // dissolved, fr_shared_intel off) ends the exploitation today.
    const over = day >= r.activeUntil || !decryptedFor(d, id, r.t);
    if (!over) continue;
    r.progressMilli = Math.min(r.progressMilli, DECRYPT_RESET_PM * 1000);
    r.activeUntil = -2 - Math.min(r.activeUntil, day);
    markExploits(d);
    d.message(r.t, "ww1936_codes_broken");
    d.markCountry(id);
    d.markCountry(r.t);
  }
  const c = d.country(id);
  if (c === null || !c.intel.agency) return;
  const t = c.intel.cryptoTarget;
  if (t <= 0 || t === id || !d.ww.isActor(t)) return;
  if (decryptedOwn(d, id, t)) return;
  const per = decryptDayMilli(d, id, t);
  if (per > 0) addDecryptMilli(d, id, t, per);
}
