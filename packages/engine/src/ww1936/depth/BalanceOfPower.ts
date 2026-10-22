// World War 1936 P6 lane W3 (plan Task 9): the balance of power (spec
// §13.2). China, Japan and France each have one value, ‰ (−1000 left …
// +1000 right), in WwDepth.mech.bop as [BOP_DEFS index, value, band]. It
// drifts on the country's turn, decisions move it (the `bop` effect), and
// each of the five bands holds its BOP_DEFS spirit (none → no spirit).
// Switched off for good (Japan from 1945-08-01; France when its government
// changes or it capitulates), the entry goes with its spirits.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { BOP_DEFS, bopBand } from "@openfront/engine-lib/ww1936/MechRules";
import { addSpirit, removeSpirit, swapSpirit } from "../politics/Spirits";
import type { WwDepth } from "./WwDepth";

/** Spec §11.4: the warlords of the chw pack; each one China annexes moves it −150. */
const CHN_WARLORDS: readonly CountryTag[] = ["GXC", "SXI", "YUN", "XBM", "SIK"];
export const BOP_WARLORD_ANNEX_PM = -150;
/** Spec §13.2: Japan's mechanism ends in August 1945. */
const JPN_END_DATE = "1945-08-01";
/** Spec §13.2: France drifts +1 every second day before 1938, every day after. */
const FRA_FULL_DRIFT_DATE = "1938-01-01";

export function bopDefIndex(tag: string): number {
  return BOP_DEFS.findIndex((b) => b.tag === tag);
}

function entryOf(d: WwDepth, i: number): [number, number, number] | undefined {
  return d.mech.bop.find((b) => b[0] === i);
}

/** The country's balance, ‰ (−1000 left … +1000 right); 0 when switched off. */
export function bopValue(d: WwDepth, tag: string): number {
  const i = bopDefIndex(tag);
  if (i < 0) return 0;
  const e = entryOf(d, i);
  if (e !== undefined) return e[1];
  return d.countries.length === 0 ? BOP_DEFS[i].startPm : 0;
}

/** The tag's band (0..4), -1 when it has no mechanism or it is off. */
export function bopBandOf(d: WwDepth, tag: string): number {
  const i = bopDefIndex(tag);
  return i < 0 ? -1 : (entryOf(d, i)?.[2] ?? -1);
}

/** The country's turn: end, drift, band spirit. */
export function dailyBop(d: WwDepth, id: number, day: number): void {
  const tag = d.ww.tagOf(id);
  const i = bopDefIndex(tag);
  if (i < 0) return;
  const e = entryOf(d, i);
  if (e === undefined) return;
  if (bopEnds(d, id, tag, day)) {
    stopBop(d, id, i);
    return;
  }
  setBop(d, id, i, e[1] + bopDrift(d, id, tag, day), day);
}

/** A `bop` effect (or a decision): ± ‰ while the country's mechanism is on. */
export function addBop(
  d: WwDepth,
  id: number,
  amount: number,
  day: number,
): void {
  const i = bopDefIndex(d.ww.tagOf(id));
  if (i < 0) return;
  const e = entryOf(d, i);
  if (e === undefined) return;
  setBop(d, id, i, e[1] + amount, day);
}

function setBop(
  d: WwDepth,
  id: number,
  i: number,
  value: number,
  day: number,
): void {
  const e = entryOf(d, i)!;
  const v = Math.max(-1000, Math.min(1000, value));
  const band = bopBand(v);
  if (v !== e[1] || band !== e[2]) {
    e[1] = v;
    e[2] = band;
    d.markGlobal();
    d.markCountry(id);
  }
  syncBandSpirit(d, id, i, band, day);
}

/**
 * The band's spirit on, the other bands' off (idempotent, so the day-0
 * spirit comes on the first turn). A spirit the content lacks is never
 * added (K5's spirits; the test content brings its own).
 */
function syncBandSpirit(
  d: WwDepth,
  id: number,
  i: number,
  band: number,
  day: number,
): void {
  const pol = d.ww.politics;
  const c = pol.country(id);
  if (c === null) return;
  const spirits = BOP_DEFS[i].spirits;
  const want = spirits[band] ?? null;
  const wantOk = want !== null && pol.content.spiritIdx.has(want);
  for (const s of spirits) {
    if (s === null || s === want || !c.hasSpirit(s)) continue;
    if (wantOk && !c.hasSpirit(want)) swapSpirit(pol, id, s, want, day);
    else removeSpirit(pol, id, s);
  }
  if (wantOk && !c.hasSpirit(want)) addSpirit(pol, id, want, undefined, day);
}

/** Spec §13.2: Japan in August 1945; France with another government or capitulated. */
function bopEnds(d: WwDepth, id: number, tag: string, day: number): boolean {
  if (tag === "JPN") return day >= dayOfDate(JPN_END_DATE);
  if (tag === "FRA") {
    if (d.ww.isCapitulated(id)) return true;
    const pol = d.ww.politics;
    const start = IDEOLOGIES.indexOf(
      pol.content.countryIdx.get(tag)?.ruling ?? "neutral",
    );
    return pol.country(id)?.ruling !== start;
  }
  return false;
}

function stopBop(d: WwDepth, id: number, i: number): void {
  const pol = d.ww.politics;
  const c = pol.country(id);
  for (const s of BOP_DEFS[i].spirits) {
    if (s !== null && c?.hasSpirit(s) === true) removeSpirit(pol, id, s);
  }
  d.mech.bop = d.mech.bop.filter((b) => b[0] !== i);
  d.markGlobal();
  d.markCountry(id);
}

function bopDrift(d: WwDepth, id: number, tag: string, day: number): number {
  if (tag === "CHN") {
    return 1 + BOP_WARLORD_ANNEX_PM * warlordsAnnexedNow(d, id, day);
  }
  if (tag === "FRA") {
    return day >= dayOfDate(FRA_FULL_DRIFT_DATE) || day % 2 === 0 ? 1 : 0;
  }
  return 0;
}

/**
 * The warlords China has annexed since its last turn: gone (P5) with their
 * capital region China's (P3 legal owner), not counted yet. Each count is
 * kept as a P3 flag on China, `bop_annexed_<TAG>` (state, so a restore
 * counts the same).
 */
function warlordsAnnexedNow(d: WwDepth, chn: number, day: number): number {
  const pol = d.ww.politics;
  const c = pol.country(chn);
  if (c === null) return 0;
  let n = 0;
  for (const tag of CHN_WARLORDS) {
    const w = pol.idOfTag(tag);
    if (w <= 0 || d.ww.endgame.countryState(w) !== "gone") continue;
    const cap = d.ww.capitalRegion(w);
    if (cap <= 0 || pol.legalOwner[cap] !== chn) continue;
    const flag = `bop_annexed_${tag}`;
    if (c.flags.has(flag)) continue;
    c.flags.set(flag, [day, -1]);
    n++;
  }
  return n;
}
