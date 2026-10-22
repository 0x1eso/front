// World War 1936 P5 lane A (plan Task 6; spec §17.4): the aid AI.
//
// Every 30 days (`day % 30 === id % 30`) an AI major looks at its
// lend-lease: who it helps (faction members, exiles, the enemies of its
// enemies — at peace, governments of its own ideology), what they lack
// (equipment coverage under 70%) and how much (by shortfall, all of an
// item's AI contracts together 30% of its month of output, each at most
// 15%). It ends a contract whose receiver is covered, or whose item it
// lacks itself (under 80%). Faction leaders and exile hosts help exiles
// with legitimacy ≥ 30% (5% of a month of infantry equipment and
// artillery). Every 180 days a peacetime aggressor, communist or fascist
// AI (historical AI off) sends half its volunteer cap to a government of
// its ideology at war with another ideology. Its idle volunteer armies take
// their host's front. The answer to gen_diplo_lend_lease (an AI's, and a
// human card's default) is llRequestScore ≥ 50.
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { LendLeaseItem } from "@openfront/engine-api/ww1936/EndgameTypes";
import { GROUND_EQUIPMENT } from "@openfront/engine-api/ww1936/LandTypes";
import { IDEO_COM, IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  llBlock,
  llLimitBlock,
  volunteerBlock,
  volunteerCap,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { equipByType } from "@openfront/engine-lib/ww1936/TemplateStats";
import { aiPersonality } from "../economy/AiEconomy";
import { nearestBorder } from "../land/Fronts";
import { isMajor } from "../politics/Factions";
import { opinionOf } from "../politics/Treaties";
import {
  addContract,
  contractsOf,
  EVENT_LL,
  LL_REQUESTED,
  llIn,
  markAid,
  pendingRequest,
  removeContract,
} from "./LendLease";
import { applyVolunteersEffect, hostFront, volunteerIn } from "./Volunteers";
import type { WwEndgame } from "./WwEndgame";

/** Spec §17.4: the lend-lease look, every 30 days. */
export const AI_AID_PERIOD_DAYS = 30;
/** Spec §17.4: the volunteers look, every 180 days. */
export const AI_VOLUNTEER_PERIOD_DAYS = 180;
/** Spec §17.4: a candidate needs an item covered under 70% (P5 balance, Task 18: 85%). */
export const AI_LL_NEED_PM = 850;
/** Spec §17.4: an AI sends nothing of an item it covers under 80% (P5 balance, Task 18: 65%). */
export const AI_LL_OWN_MIN_PM = 650;
/** Spec §17.4: a major sends 15% of its month of output (one contract's most). */
export const AI_LL_SHARE_PCT = 15;
/** Review fix round: every AI contract of an item together, % of its month of output. */
export const AI_LL_TOTAL_PCT = 30;
/** Spec §17.4: an exile gets 5% of its helper's month of output. */
export const AI_EXILE_SHARE_PCT = 5;
/** Spec §17.4: exiles with legitimacy ≥ 30% are helped. */
export const AI_EXILE_MIN_LEGIT_BP = 3000;
/** Spec §17.4: half the volunteer cap. */
export const AI_VOLUNTEER_SHARE_PCT = 50;
/** Spec §17.4: a request is answered yes from this score. */
export const AI_LL_ACCEPT_SCORE = 50;
const MONTH_DAYS = 30;
const EXILE_ITEMS: readonly EquipmentType[] = [
  "infantry_equipment",
  "artillery",
];

// ---- Coverage and output ----

/**
 * Spec §17.4 "장비 충족" (HOI4's fulfilment): per EQUIPMENT_TYPES index,
 * ‰ of what `id`'s divisions need (their templates) that its divisions
 * carry plus its stock holds, at most 1000; 1000 when nothing is needed.
 */
export function aidCoveragePm(eg: WwEndgame, id: number): number[] {
  const land = eg.ww.land;
  const t = land.divisions;
  const n = EQUIPMENT_TYPES.length;
  const need = new Array<number>(n).fill(0);
  const have = new Array<number>(n).fill(0);
  for (const r of land.rowsOf(id)) {
    const nd = land.baseStatsOf(r).need;
    const hv = equipByType(t.equipOf(r));
    for (let i = 0; i < n; i++) {
      need[i] += nd[i];
      have[i] += hv[i];
    }
  }
  const ce = eg.ww.economy.country(id);
  if (ce !== null) {
    for (let k = 0; k < EQUIP_KEYS.length; k++) {
      have[EQUIPMENT_TYPES.indexOf(EQUIP_KEYS[k][0])] += ce.stock[k];
    }
  }
  return need.map((nd, i) =>
    nd <= 0 ? 1000 : Math.min(1000, Math.floor((have[i] * 1000) / nd)),
  );
}

/** Units of `type` (every generation) `id`'s lines make in 30 days at the last day's rate. */
export function monthlyOutput(
  eg: WwEndgame,
  id: number,
  type: EquipmentType,
): number {
  const ce = eg.ww.economy.country(id);
  if (ce === null) return 0;
  let n = 0;
  for (const l of ce.lines) {
    const [t, gen] = EQUIP_KEYS[l.key];
    if (t !== type || l.lastOutput <= 0) continue;
    n += Math.floor((l.lastOutput * MONTH_DAYS) / unitCostMilli(t, gen));
  }
  return n;
}

function typeIdx(type: EquipmentType): number {
  return EQUIPMENT_TYPES.indexOf(type);
}

function isGround(item: string): boolean {
  return (GROUND_EQUIPMENT as readonly string[]).includes(item);
}

// ---- Requests (spec §13.4, §17.4) ----

/** `id` has `item` enough: ground equipment covered 100%, else a month of the request (or one unit) in stock. */
function hasEnough(
  eg: WwEndgame,
  id: number,
  to: number,
  item: LendLeaseItem,
): boolean {
  const ce = eg.ww.economy.country(id);
  if (ce === null) return false;
  if (isGround(item)) {
    return aidCoveragePm(eg, id)[typeIdx(item as EquipmentType)] >= 1000;
  }
  const want = Math.max(1, pendingRequest(eg, id, to)?.perMonth ?? 1);
  if (item === "fuel") return Math.floor(ce.fuelMilli / 1000) >= want;
  const type = item as EquipmentType;
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    n += ce.stock[equipKey(type, g)];
  }
  return n >= want;
}

/**
 * Spec §17.4: how much AI giver `from` wants to answer `to`'s request for
 * `item` — same ideology 30, same faction 40, a common enemy 40, `from`
 * has enough of it 20, `to` fights a country `from` dislikes (opinion < 0)
 * and is not at war with 10, plus half their opinion.
 */
export function llRequestScore(
  eg: WwEndgame,
  from: number,
  to: number,
  item: LendLeaseItem,
): number {
  const ww = eg.ww;
  const pol = ww.politics;
  const a = pol.country(from);
  const b = pol.country(to);
  if (a === null || b === null || from === to) return 0;
  let s = 0;
  if (a.ruling === b.ruling) s += 30;
  if (pol.sameFaction(from, to)) s += 40;
  const mine = ww.enemiesOf(from);
  const theirs = ww.enemiesOf(to);
  if (theirs.some((e) => mine.includes(e))) s += 40;
  if (hasEnough(eg, from, to, item)) s += 20;
  if (theirs.some((e) => !ww.isAtWar(from, e) && opinionOf(pol, from, e) < 0)) {
    s += 10;
  }
  s += Math.trunc(opinionOf(pol, from, to) / 2);
  return s;
}

/**
 * P3 aiChooseOption's first question (pre-flight §A A): gen_diplo_lend_lease
 * is "a" (give) when the giver's llRequestScore for the request is ≥ 50,
 * else "b"; null for every other event (P3 chooses).
 */
export function aiAidEventChoice(
  eg: WwEndgame,
  eventId: string,
  self: number,
  from: number,
): string | null {
  if (eventId !== EVENT_LL) return null;
  const item = pendingRequest(eg, self, from)?.item ?? "infantry_equipment";
  const score = llRequestScore(eg, self, from, item as LendLeaseItem);
  return score >= AI_LL_ACCEPT_SCORE ? "a" : "b";
}

// ---- The AI's day ----

export function aiAidDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (!eg.isActor(id)) return;
  if (day % AI_AID_PERIOD_DAYS === id % AI_AID_PERIOD_DAYS) {
    aiLendLease(eg, id, day);
  }
  if (day % AI_VOLUNTEER_PERIOD_DAYS === id % AI_VOLUNTEER_PERIOD_DAYS) {
    aiVolunteers(eg, id, tick);
  }
  aiVolunteerFronts(eg, id);
}

/**
 * Spec §17.4's receivers of `id`, ascending: faction members, the exiles
 * it hosts or whose faction it leads, the enemies of its enemies (at
 * peace: governments of its ideology at war).
 */
export function aidCandidates(eg: WwEndgame, id: number): number[] {
  const ww = eg.ww;
  const pol = ww.politics;
  const me = pol.country(id);
  if (me === null) return [];
  const mine = ww.enemiesOf(id);
  const out: number[] = [];
  for (let x = 1; x < eg.size; x++) {
    if (x === id || !eg.isActor(x) || ww.isAtWar(id, x)) continue;
    const c = pol.country(x);
    if (c === null) continue;
    const ok =
      pol.sameFaction(id, x) ||
      (eg.isExile(x) && exileHelper(eg, x, id)) ||
      (mine.length > 0
        ? ww.enemiesOf(x).some((e) => mine.includes(e))
        : c.ruling === me.ruling && ww.hasWar(x));
    if (ok) out.push(x);
  }
  return out;
}

/** `helper` hosts exile `x`, or leads the faction `x` is in (or was in when it went into exile). */
function exileHelper(eg: WwEndgame, x: number, helper: number): boolean {
  if (eg.exileHost(x) === helper) return true;
  const pol = eg.ww.politics;
  let idx = pol.factionIdx(x);
  if (idx < 0) {
    const i = eg.exileIdx.get(x);
    idx = i === undefined ? -1 : eg.exiles[i].faction;
  }
  return idx >= 0 && pol.faction(idx)?.leader === helper;
}

function exileHelpable(eg: WwEndgame, x: number): boolean {
  const i = eg.exileIdx.get(x);
  return i !== undefined && eg.exiles[i].legitBp >= AI_EXILE_MIN_LEGIT_BP;
}

function isHumanExile(eg: WwEndgame, x: number): boolean {
  return eg.isExile(x) && eg.isHumanControlled(x);
}

/** One AI contract's plan: its receiver, how much it lacks (‰ to full), the exile help reserved, the amount given. */
interface LlShare {
  to: number;
  w: number;
  reserve: number;
  per: number;
}

/**
 * Spec §17.4 lend-lease (review fix round: one budget per item). Every
 * running ground contract ends once its receiver is covered (an exile's
 * never) or the giver itself is short of the item (under 80%). Then, item
 * by item, the AI's own contracts (`ai`) share one budget — 30% of its
 * month of output less what its content and request contracts of the item
 * send — each at most 15%: first an exile's help (5% of infantry
 * equipment and artillery from its host or faction leader, human exiles
 * first), then a major's split by shortfall (1000 − coverage ‰; a
 * receiver comes in under 70% and stays until covered), the rounding
 * remainder one each by shortfall then smallID. Its own contracts are set
 * to their share (raised or lowered) or end; new ones open while there is
 * room (10). A bigger war means more, smaller contracts, not a bigger total.
 */
export function aiLendLease(eg: WwEndgame, id: number, day: number): void {
  const pol = eg.ww.politics;
  const own = aidCoveragePm(eg, id);
  const covOf = new Map<number, number[]>();
  const cov = (x: number): number[] => {
    let v = covOf.get(x);
    if (v === undefined) {
      v = aidCoveragePm(eg, x);
      covOf.set(x, v);
    }
    return v;
  };
  // Endings first (they free room).
  for (const c of [...contractsOf(eg, id)]) {
    if (c.blocked === LL_REQUESTED || !isGround(c.item)) continue;
    const i = typeIdx(c.item as EquipmentType);
    const covered = !eg.isExile(c.to) && cov(c.to)[i] >= 1000;
    if (own[i] < AI_LL_OWN_MIN_PM || covered) removeContract(eg, c.id);
  }
  const major = isMajor(pol, id);
  const cands = aidCandidates(eg, id).filter(
    (to) => llBlock(llIn(eg, id, to, day)) === null,
  );
  const plans: { item: EquipmentType; shares: LlShare[] }[] = [];
  for (const item of GROUND_EQUIPMENT) {
    const i = typeIdx(item);
    const mine = contractsOf(eg, id).filter((c) => c.item === item);
    const out = monthlyOutput(eg, id, item);
    let fixed = 0;
    for (const c of mine) {
      if (c.ai !== true && c.blocked !== LL_REQUESTED) fixed += c.perMonth;
    }
    const cap = Math.floor((out * AI_LL_SHARE_PCT) / 100);
    const shares: LlShare[] = [];
    for (const to of cands) {
      // A content or request contract there already: that is its aid.
      if (mine.some((c) => c.to === to && c.ai !== true)) continue;
      const cv = cov(to)[i];
      const had = mine.some((c) => c.to === to && c.ai === true);
      const w =
        major && (cv < AI_LL_NEED_PM || (had && cv < 1000)) ? 1000 - cv : 0;
      const help =
        EXILE_ITEMS.includes(item) &&
        eg.isExile(to) &&
        exileHelpable(eg, to) &&
        exileHelper(eg, to, id);
      const reserve = help ? Math.floor((out * AI_EXILE_SHARE_PCT) / 100) : 0;
      if (w > 0 || reserve > 0) shares.push({ to, w, reserve, per: 0 });
    }
    let budget =
      own[i] < AI_LL_OWN_MIN_PM
        ? 0
        : Math.max(0, Math.floor((out * AI_LL_TOTAL_PCT) / 100) - fixed);
    // Exile help first, human exiles first.
    const helpOrder = shares
      .filter((x) => x.reserve > 0)
      .sort(
        (a, b) =>
          Number(isHumanExile(eg, b.to)) - Number(isHumanExile(eg, a.to)) ||
          a.to - b.to,
      );
    for (const x of helpOrder) {
      const n = Math.min(x.reserve, budget, cap);
      x.per = n;
      budget -= n;
    }
    // The rest by shortfall (ties: smallID).
    const needy = shares
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w || a.to - b.to);
    let total = 0;
    for (const x of needy) total += x.w;
    let given = 0;
    for (const x of needy) {
      const n = Math.min(
        Math.floor((budget * x.w) / total),
        Math.max(0, cap - x.per),
      );
      x.per += n;
      given += n;
    }
    for (const x of needy) {
      if (given >= budget) break;
      if (x.per >= cap) continue;
      x.per++;
      given++;
    }
    plans.push({ item, shares });
  }
  // The AI's own contracts follow their shares; then the new ones.
  for (const { item, shares } of plans) {
    for (const c of contractsOf(eg, id)) {
      if (c.ai !== true || c.item !== item) continue;
      const x = shares.find((y) => y.to === c.to);
      if (x === undefined || x.per <= 0) {
        removeContract(eg, c.id);
      } else if (c.perMonth !== x.per) {
        c.perMonth = x.per;
        markAid(eg, c.from, c.to);
      }
    }
  }
  for (const { item, shares } of plans) {
    const order = [...shares].sort(
      (a, b) =>
        Number(isHumanExile(eg, b.to)) - Number(isHumanExile(eg, a.to)) ||
        b.w - a.w ||
        a.to - b.to,
    );
    for (const x of order) {
      if (x.per <= 0) continue;
      if (contractsOf(eg, id).some((c) => c.to === x.to && c.item === item)) {
        continue;
      }
      if (llLimitBlock(contractsOf(eg, id).length) !== null) return;
      addContract(eg, id, x.to, item, 0, x.per, day, null).ai = true;
    }
  }
}

/**
 * Spec §17.4 volunteers: a peacetime aggressor, communist or fascist AI
 * (historical AI off: the history beats send theirs) sends half its cap
 * to the first government of its ideology (ascending) at war with a
 * government of another ideology.
 */
export function aiVolunteers(eg: WwEndgame, id: number, tick: number): void {
  const ww = eg.ww;
  const pol = ww.politics;
  if (pol.mg.config().historicalAi() || ww.hasWar(id)) return;
  const me = pol.country(id);
  if (me === null) return;
  if (
    aiPersonality(me.tag) !== "aggressor" &&
    me.ruling !== IDEO_COM &&
    me.ruling !== IDEO_FAS
  ) {
    return;
  }
  const land = ww.land;
  for (let to = 1; to < eg.size; to++) {
    if (to === id || !eg.isActor(to)) continue;
    const c = pol.country(to);
    if (c === null || c.ruling !== me.ruling) continue;
    const other = ww
      .enemiesOf(to)
      .some((e) => (pol.country(e)?.ruling ?? me.ruling) !== me.ruling);
    if (!other) continue;
    const cap = volunteerCap(land.rowsOf(id).length, land.rowsOf(to).length);
    const n = Math.max(1, Math.floor((cap * AI_VOLUNTEER_SHARE_PCT) / 100));
    if (volunteerBlock(volunteerIn(eg, id, to, n)) !== null) continue;
    applyVolunteersEffect(eg, id, to, n, 0, tick);
    return;
  }
}

/** An AI's idle volunteer army takes its host's front (AiLand leaves volunteers alone). */
export function aiVolunteerFronts(eg: WwEndgame, id: number): void {
  const land = eg.ww.land;
  for (const v of eg.volunteers) {
    if (v.from !== id || v.recall) continue;
    const a = land.armies.get(v.army);
    if (a === undefined || a.volunteerFor !== v.to) continue;
    if (a.order.kind !== "idle" || a.divisions.length === 0) continue;
    const front = new Set(hostFront(eg, v.to));
    if (front.size === 0) continue;
    const anchor = nearestBorder(land, front, [land.armyRegion(a)], (r) =>
      land.sameSide(v.to, land.controller[r] ?? 0),
    );
    if (anchor === 0) continue;
    land.issue(id, { kind: "army_front", army: a.id, anchor, enemy: 0 }, "ai");
  }
}
