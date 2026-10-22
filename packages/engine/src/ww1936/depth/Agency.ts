// P6 lane I (plan Task 5): the intelligence agency, its upgrades, the
// orders and the day (spec §8.1–§8.2). Nobody has an agency in January
// 1936 (spec §8.2); founding costs 50 PP and works in the preparation
// minute too. An upgrade holds two civilian factories for 90 days
// (WwDepth.civsOut reads upId, plan decision 23).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  AGENCY_FOUND_PP,
  AGENCY_UPGRADE_DAYS,
  AGENCY_UPGRADES,
  AgencyUpgrade,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  upgradeBit,
  upgradeBlock,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { EffectCtx, resolveSelector } from "../politics/Dispatch";
import { payPp } from "../politics/PayPp";
import {
  activateCrypto,
  addDecryptMilli,
  dailyCrypto,
  setCryptoTarget,
} from "./Crypto";
import {
  cancelOperation,
  dailyOperations,
  rebuildResistBoost,
  startOperation,
} from "./Operations";
import {
  assignOperative,
  dailyOperatives,
  recallOperative,
  recruitOperative,
} from "./Operatives";
import type { WwDepth } from "./WwDepth";

/** Spec §8.2: a day of an upgrade, milli (90 days to the whole). */
export const UPGRADE_DAY_MILLI = Math.floor(1_000_000 / AGENCY_UPGRADE_DAYS);
const UPGRADE_DONE_MILLI = UPGRADE_DAY_MILLI * AGENCY_UPGRADE_DAYS;

/** intel_found (spec §8.2): 50 PP. */
export function foundAgency(d: WwDepth, id: number): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  if (c.intel.agency) return "bad_index";
  if (!payPp(d.ww.politics, id, AGENCY_FOUND_PP)) return "no_pp";
  c.intel.agency = true;
  d.ww.politics.markCountry(id);
  d.markCountry(id);
  d.markIntel(id);
  return null;
}

/** intel_upgrade (spec §8.2): one at a time, two civilian factories for 90 days. */
export function startUpgrade(
  d: WwDepth,
  id: number,
  u: AgencyUpgrade,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  const ce = d.ww.economy.country(id);
  const block = upgradeBlock({
    agency: c.intel.agency,
    upgrades: c.intel.upgrades,
    upgrade: u,
    inProgress: c.intel.upId >= 0,
    computing1: ce?.researched.has("computing_1") ?? false,
    freeCivs: Math.floor((ce?.totals.freeCivMilli ?? 0) / 1000),
  });
  if (block !== null) return block;
  c.intel.upId = AGENCY_UPGRADES.indexOf(u);
  c.intel.upMilli = 0;
  d.ww.economy.markCountryDirty(id);
  d.markCountry(id);
  return null;
}

/** intel_found … crypto_activate. */
export function issueIntel(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  const day = d.ww.day(tick);
  switch (o.kind) {
    case "intel_found":
      return foundAgency(d, id);
    case "intel_upgrade":
      return startUpgrade(d, id, o.id);
    case "operative_recruit":
      return recruitOperative(d, id, day);
    case "operative_assign":
      return assignOperative(d, id, o, day);
    case "operative_recall":
      return recallOperative(d, id, o.operative, day);
    case "operation_start":
      return startOperation(d, id, o.op, o.target, o.operatives, tick);
    case "operation_cancel":
      return cancelOperation(d, id, o.operation);
    case "crypto_target":
      return setCryptoTarget(d, id, o.target);
    case "crypto_activate":
      return activateCrypto(d, id, o.target, day);
    default:
      return "bad_index";
  }
}

/** The upgrade in progress moves a day; done, its bit is set and the factories come back. */
function dailyUpgrade(d: WwDepth, id: number): void {
  const c = d.country(id);
  if (c === null || c.intel.upId < 0) return;
  c.intel.upMilli += UPGRADE_DAY_MILLI;
  if (c.intel.upMilli >= UPGRADE_DONE_MILLI) {
    c.intel.upgrades |= upgradeBit(AGENCY_UPGRADES[c.intel.upId]);
    c.intel.upId = -1;
    c.intel.upMilli = 0;
    d.ww.economy.markCountryDirty(id);
    d.markIntel(id);
  }
  d.markCountry(id);
}

/**
 * Spec §8.2–§8.7: upgrades → operatives → operations → cryptology. A
 * country without an agency has none of them (review 7: nothing to do).
 */
export function dailyIntel(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return;
  dailyUpgrade(d, id);
  dailyOperatives(d, id, day);
  dailyOperations(d, id, day);
  dailyCrypto(d, id, day);
}

/**
 * Pre-flight §0-8 (review 6): the day's resistance table, rebuilt from
 * state once a day on the day's common step (a fixed point of the day, so
 * a game restored within the day keeps the table it read).
 */
export function dayCommonIntel(d: WwDepth, day: number): void {
  void day;
  rebuildResistBoost(d);
}

/**
 * Review 10 (spec §21.6): lane I's state folded into WwDepth.hash in a
 * fixed order — each country's agency, upgrades, codename counter, code
 * target, propaganda and collaboration rows and operatives (by uid), then
 * the operations (by uid), infiltrations, decryptions (by breaker and
 * target) and the intel rows (4 bytes a word, endian-free). The networks
 * and the resistance table are WwDepth.hash's own lines.
 */
export function mixIntel(d: WwDepth, mix: (v: number) => void): void {
  for (let id = 1; id < d.countries.length; id++) {
    const c = d.countries[id];
    if (c === null || c === undefined) continue;
    const i = c.intel;
    mix(id);
    mix(i.agency ? 1 : 0);
    mix(i.upgrades);
    mix(i.upId);
    mix(i.upMilli);
    mix(i.nextCodename);
    mix(i.cryptoTarget);
    for (const [t, bp] of i.propagandaBp) {
      mix(t);
      mix(bp);
    }
    for (const [t, pp] of i.collabPp) {
      mix(t);
      mix(pp);
    }
    for (const o of [...i.operatives].sort((a, b) => a.uid - b.uid)) {
      mix(o.uid);
      mix(o.codename);
      mix(o.skill);
      mix(o.abroadDays);
      mix(o.state);
      mix(o.target);
      mix(o.mission);
      mix(o.op);
      mix(o.sinceDay);
      mix(o.travelLeft);
      mix(o.releaseDay);
      mix(o.recruitLeft);
    }
  }
  for (const r of [...d.ops].sort((a, b) => a.uid - b.uid)) {
    mix(r.uid);
    mix(r.kind);
    mix(r.owner);
    mix(r.target);
    for (const u of r.operatives) mix(u);
    mix(r.startDay);
    mix(r.endDay);
  }
  for (const [o, t, dom] of [...d.infiltrations].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2],
  )) {
    mix(o * 1024 + t);
    mix(dom);
  }
  for (const r of [...d.decrypted].sort((a, b) => a.o - b.o || a.t - b.t)) {
    mix(r.o * 1024 + r.t);
    mix(r.progressMilli);
    mix(r.activeUntil);
  }
  const lv = d.intelLevels;
  for (let k = 0; k + 3 < lv.length; k += 4) {
    mix(lv[k] | (lv[k + 1] << 8) | (lv[k + 2] << 16) | (lv[k + 3] << 24));
  }
}

/** The intel_network, decrypt and agency effects (spec §18.3). */
export function applyIntelEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "intel_network" | "decrypt" | "agency" }>,
  actor: number,
): void {
  const d = ctx.pol.ww.depth;
  const c = d.country(actor);
  if (c === null) return;
  switch (e.kind) {
    case "intel_network": {
      const on = resolveSelector(ctx, e.on);
      if (on <= 0 || on === actor || on >= d.cap) return;
      d.setNetMilli(actor, on, d.netMilli(actor, on) + e.pm * 1000);
      d.markCountry(actor);
      return;
    }
    case "decrypt": {
      const on = resolveSelector(ctx, e.on);
      if (on <= 0 || on === actor || on >= d.cap) return;
      addDecryptMilli(d, actor, on, e.pm * 1000);
      return;
    }
    case "agency": {
      c.intel.agency = true;
      if (e.upgrade !== undefined) {
        const i = AGENCY_UPGRADES.indexOf(e.upgrade);
        c.intel.upgrades |= upgradeBit(e.upgrade);
        if (c.intel.upId === i) {
          c.intel.upId = -1;
          c.intel.upMilli = 0;
          d.ww.economy.markCountryDirty(actor);
        }
      }
      d.markCountry(actor);
      d.markIntel(actor);
      return;
    }
  }
}
