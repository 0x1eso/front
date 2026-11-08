// World War 1936 diplomacy D1 (ww161 Design B §1; lane L1): separate peace
// with any enemy member. The target rule itself lives in WhitePeace.ts
// (peaceOfferBlock, offerStands, makePeace) over SeparatePeaceRules; this
// file holds what is new around it: "come home as my subject" to an exile,
// what follows a member's leaving (its leader told, the exile home or
// gone), and the AI side leader's offers to minors. Integers only; wars,
// countries and offers in ascending id order.
import {
  DIPLO_NOTICES,
  noticeId,
  WW_SEP_AI_DAYS,
  WW_SEP_AI_TARGET_PM,
  WW_SEP_HOME_LEGIT_BP,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_WHITE_PEACE_PP,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { homeTargetBlock } from "@openfront/engine-lib/ww1936/SeparatePeaceRules";
import { isMajor } from "../politics/Factions";
import { diploCooldownUntil, setDiploCooldown } from "./DiploState";
import { endExile } from "./Exile";
import { offerLinePeace } from "./LinePeace";
import { makeSubject } from "./Subjects";
import { countryParams } from "./Wars";
import {
  fighting,
  isPuppet,
  offerPeace,
  peaceOfferBlock,
  surrenderPm,
} from "./WhitePeace";
import type { PeaceOffer, WwEndgame } from "./WwEndgame";

// ---- Come home as my subject ----

/**
 * peace_offer with home: `from`, its side's leader, offers exile `target`
 * (an enemy member, no puppet, not the other side's leader) to come home
 * as its neutral collaborator. The white peace's gate and price; there
 * must be something to come home to (`from`'s side holds some of the
 * exile's land). Accepted, the exile leaves the war and its faction, the
 * land the proposer's side holds comes back to it (end_war), its exile
 * ends and it is `from`'s neutral puppet (targetLeft).
 */
export function offerHome(
  eg: WwEndgame,
  from: number,
  war: number,
  target: number,
  tick: number,
): WwOrderBlock | null {
  const w = eg.war(war);
  if (w === null || w.ended !== null) return "not_at_war";
  if (!eg.isExile(target)) return "home_not_exile";
  const hb = homeTargetBlock(w, from, target, (x) => isPuppet(eg, x));
  if (hb !== null) return hb;
  const block = peaceOfferBlock(eg, from, war, target, eg.ww.day(tick));
  if (block !== null) return block;
  if (!sideHoldsLandOf(eg, w, from, target)) return "bad_target";
  return offerPeace(eg, from, war, target, tick, undefined, true);
}

/** Some region `target` legally owns is controlled by a fighting member of `from`'s side. */
function sideHoldsLandOf(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  target: number,
): boolean {
  const s = eg.sideIndex(w, from);
  if (s === -1) return false;
  const side = new Set(
    w.sides[s].members.filter((m) => fighting(m)).map((m) => m.id),
  );
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  return eg.ww.scenario.landRegions.some(
    (r) => legal[r.id] === target && side.has(ctrl[r.id] ?? 0),
  );
}

// ---- After the peace ----

/**
 * WhitePeace.makePeace, once a side leader's separate peace took `o.to` out
 * (pairs ended, truces set, out of its faction): `leader` (the one it
 * answered to, from before it left) hears of it and has no veto. "Come
 * home": the exile ends and wakes as the proposer's neutral puppet. An
 * exile that held nothing and took the line (`collapse`) ends as gone; its
 * land stays where it is until the conference.
 */
export function targetLeft(
  eg: WwEndgame,
  o: PeaceOffer,
  leader: number,
  collapse: boolean,
  tick: number,
): void {
  if (leader > 0) {
    eg.message(
      leader,
      noticeId(DIPLO_NOTICES.separatePeace),
      countryParams(eg, { country: o.from, target: o.to }),
    );
  }
  if (collapse) {
    endExile(eg, o.to, tick, "collapsed");
    return;
  }
  if (o.home !== true) return;
  if (eg.isExile(o.to)) endExile(eg, o.to, tick, "returned");
  makeSubject(eg, o.to, o.from, "puppet", true, tick);
  eg.message(
    o.from,
    noticeId(DIPLO_NOTICES.homeReturned),
    countryParams(eg, { country: o.to }),
  );
}

// ---- The AI ----

/**
 * Side `s` of `w` is winning (ww161 Design B §1, "war score ahead"): its
 * fighting members hold more victory points of the other side's legal land
 * than the other side's fighting members hold of its own. Not the members'
 * summed war score (casualties): that grows with a coalition's size, so the
 * bigger side was always "ahead" and no leader of a smaller one ever offered.
 */
export function scoreAhead(eg: WwEndgame, w: WwWar, s: 0 | 1): boolean {
  const side = (x: 0 | 1) =>
    new Set(w.sides[x].members.filter((m) => fighting(m)).map((m) => m.id));
  const ours = side(s);
  const theirs = side(s === 0 ? 1 : 0);
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  let won = 0;
  let lost = 0;
  for (const r of eg.ww.scenario.landRegions) {
    const owner = legal[r.id] ?? 0;
    const holder = ctrl[r.id] ?? 0;
    if (theirs.has(owner) && ours.has(holder)) won += r.vp;
    else if (ours.has(owner) && theirs.has(holder)) lost += r.vp;
  }
  return won > lost;
}

/**
 * The regions `id`'s own goals aim at: its war goals still waiting (a
 * claim's group; conquer or topple: the target's legal land) and, when it
 * leads the attackers of `w`, that war's goal group.
 */
function goalRegions(eg: WwEndgame, id: number, w: WwWar): Set<number> {
  const pol = eg.ww.politics;
  const out = new Set<number>();
  const group = (g: string) => {
    for (const r of pol.content.groupIdx.get(g)?.regions ?? []) out.add(r);
  };
  const on = new Set<number>();
  for (const g of pol.country(id)?.warGoals ?? []) {
    if (g.group !== "") group(g.group);
    else on.add(g.on);
  }
  if (w.goal !== null && w.goal.group !== "" && w.sides[0].leader === id) {
    group(w.goal.group);
  }
  if (on.size > 0) {
    const legal = pol.legalOwner;
    for (const r of eg.ww.scenario.landRegions) {
      if (on.has(legal[r.id] ?? 0)) out.add(r.id);
    }
  }
  return out;
}

/** `x`'s legal land is in or next to one of `goals`' regions. */
function bordersGoals(
  eg: WwEndgame,
  x: number,
  goals: ReadonlySet<number>,
): boolean {
  if (goals.size === 0) return false;
  const sc = eg.ww.scenario;
  const legal = eg.ww.politics.legalOwner;
  for (const r of sc.landRegions) {
    if ((legal[r.id] ?? 0) !== x) continue;
    if (goals.has(r.id)) return true;
    if (sc.edgesOf(r.id).some((e) => goals.has(e.to))) return true;
  }
  return false;
}

/**
 * Daily for an AI country (staggered by smallID): a side leader ahead on
 * war score looks at each enemy minor or exile (fighting, no puppet, not
 * the other side's leader) once per WW_SEP_AI_DAYS. An exile under
 * WW_SEP_HOME_LEGIT_BP legitimacy is offered to come home as its subject;
 * any other minor WW_SEP_AI_TARGET_PM of its way to its surrender line
 * whose land neither holds nor borders one of the leader's own goals is
 * offered a line peace. At most one offer a day, none while one of its own
 * waits.
 */
export function aiSeparatePeaceDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (eg.peaceOffers.some((o) => o.from === id)) return;
  const pol = eg.ww.politics;
  const c = pol.country(id);
  if (c === null || c.ppMilli < WW_WHITE_PEACE_PP * 1000) return;
  for (const wid of [...eg.warsOf(id)].sort((a, b) => a - b)) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null || w.kind !== "normal") continue;
    const s = eg.sideIndex(w, id);
    if (s === -1 || w.sides[s].leader !== id || !scoreAhead(eg, w, s)) continue;
    const other = w.sides[s === 0 ? 1 : 0];
    let goals: Set<number> | null = null;
    const minors = other.members
      .filter(
        (m) =>
          fighting(m) &&
          m.id !== other.leader &&
          eg.isActor(m.id) &&
          // An exile, major or minor, may be called home.
          (eg.isExile(m.id) || !isMajor(pol, m.id)) &&
          !isPuppet(eg, m.id),
      )
      .map((m) => m.id)
      .sort((a, b) => a - b);
    for (const x of minors) {
      if (diploCooldownUntil(eg, id, x, "ai_separate") > day) continue;
      setDiploCooldown(eg, id, x, "ai_separate", day + WW_SEP_AI_DAYS);
      if (eg.isExile(x)) {
        const ex = eg.exiles[eg.exileIdx.get(x) ?? -1];
        if (
          ex !== undefined &&
          ex.legitBp < WW_SEP_HOME_LEGIT_BP &&
          offerHome(eg, id, wid, x, tick) === null
        ) {
          return;
        }
        continue;
      }
      if (surrenderPm(eg, x) < WW_SEP_AI_TARGET_PM) continue;
      goals ??= goalRegions(eg, id, w);
      if (bordersGoals(eg, x, goals)) continue;
      if (offerLinePeace(eg, id, wid, x, tick) === null) return;
    }
  }
}
