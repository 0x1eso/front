// P5 lane W (plan Task 2): capitulation (spec §5.1). The legal owner stays;
// control moves. Order (pre-flight §0-2): the exile decision, the war
// records' member states, the wars (none end for an exile), the forces
// (X: what escapes goes to the exile while the ships still live), then
// control, then politics, a takeover card for a human without a host, and
// the war-end check that opens conferences. A party of a civil war and a
// subject in its independence war wait for that war's end (lanes C and
// S) before their land goes to a foreign victor.
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { transferOnCapitulation } from "../land/Occupation";
import { transferRegionPeaceful } from "../land/PoliticsBridge";
import { settleSensitiveZones } from "./Conference";
import { capitulationForces, formExile, offerTakeover } from "./Exile";
import { checkWarEnds, countryParams } from "./Wars";
import type { WwEndgame } from "./WwEndgame";

export function capitulate(
  eg: WwEndgame,
  L: number,
  R: number,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const day = ww.inPrep(tick) ? 0 : ww.day(tick);
  // Owner ruling: a Korea or Taiwan zone it held passes on first, never
  // with its land to its victor or back to Japan.
  settleSensitiveZones(eg, tick);
  // Spec §5.1-3: a civil war's party and an independence war's subject
  // look for no host.
  const own = ownWar(eg, L);
  // Spec §5.1-2 (decided before the wars end): what L occupied goes back to
  // a legal owner still at war with it and playing.
  const back: [number, number][] = [];
  for (const r of ww.scenario.landRegions) {
    if (ww.land.controller[r.id] !== L) continue;
    const legal = pol.legalOwner[r.id] ?? 0;
    if (
      legal !== L &&
      legal !== 0 &&
      ww.isAtWar(legal, L) &&
      eg.isActor(legal)
    ) {
      back.push([r.id, legal]);
    }
  }
  // 3–4. Exile, or P0's way (member states first: onWarPairRemoved leaves a
  // non-active member be).
  const host = own ? 0 : formExile(eg, L, R, tick) ? eg.exileHost(L) : 0;
  for (const id of [...eg.warsOf(L)]) {
    const w = eg.war(id);
    if (w === null || w.ended !== null) continue;
    if (eg.member(w, L)?.state !== "active") continue;
    eg.setMemberState(id, L, host > 0 ? "exiled" : "capitulated");
  }
  const kept = host === 0 ? endWarsKeepingWinners(eg, L) : [];
  // 5. Forces, stock, ships, planes (spec §5.2 — X).
  capitulationForces(eg, L, R, host, tick);
  // 2. Control (the legal owner stays L's, spec §5.1-2).
  for (const [r, legal] of back)
    transferRegionPeaceful(ww.land, r, legal, tick);
  if (!own) handOver(eg, L, R);
  // 6. Politics (P3: pending events, faction leader succession).
  pol.onCapitulated(L, R, tick);
  // 7. Gone; a human without a host takes over a faction friend (spec §11).
  if (!own) leave(eg, L, host, tick);
  // 8. Wars that ended (spec §4.4) open their conferences.
  checkWarEnds(eg, day, tick);
  // A winner kept only for an end that did not come has left after all
  // (spec §4.3: no pair left in that war), so its side can still lose.
  if (releaseKept(eg, kept)) checkWarEnds(eg, day, tick);
  if (own && ownWar(eg, L)) {
    // Its own war goes on without it (another member still fights): the
    // capitulation's usual way after all.
    handOver(eg, L, R);
    leave(eg, L, 0, tick);
  }
  // 9. Messages (P0 announces the capitulation itself).
  if (host > 0) {
    const params = countryParams(eg, { tag: L, hostTag: host });
    eg.messageAll("ww1936_exiled", params);
    eg.news("news_exiled", params);
  }
  eg.adminDirty = true;
}

/**
 * Spec §5.1-3, §4.4: `L` is a party of an ongoing civil war (a side's first
 * member: lane C's endCivilWar hands its land to the winner), or a subject
 * fighting its overlord for independence (lane S takes it back as an
 * integrated puppet).
 */
function ownWar(eg: WwEndgame, L: number): boolean {
  return eg.warsOf(L).some((id) => {
    const w = eg.war(id);
    if (w === null || w.ended !== null) return false;
    const s = eg.sideIndex(w, L);
    if (s < 0) return false;
    if (w.kind === "civil") return w.sides[s as 0 | 1].members[0]?.id === L;
    if (w.kind !== "independence" || s !== 0) return false;
    const sub = eg.subjectOf(L);
    return sub !== null && eg.sideIndex(w, sub.overlord) === 1;
  });
}

/** Spec §5.1-2: what L still controls goes to its victor (land on its way to L too). */
function handOver(eg: WwEndgame, L: number, R: number): void {
  if (R === 0) return;
  const ww = eg.ww;
  for (const t of ww.transfers()) {
    if (t.to === L) t.to = R;
  }
  transferOnCapitulation(ww.land, L, R);
}

/** Spec §5.1-7: the country is gone; its human (no host) gets a takeover card. */
function leave(eg: WwEndgame, L: number, host: number, tick: number): void {
  eg.setCountryState(L, CS_GONE);
  const client = eg.humanClientOf(L);
  if (client !== null && host === 0) offerTakeover(eg, client, L, tick);
}

/**
 * P0 endWarsOf for a capitulation (spec §4.3): the loser's pairs go, but
 * the enemy it fought has not left the war because its enemy surrendered —
 * a member that only fought L stays active in the record (spec §6.6:
 * Slovakia is a participant of the Polish conference), and a side's
 * leader keeps its place.
 */
function endWarsKeepingWinners(eg: WwEndgame, L: number): [number, number][] {
  const kept: [number, number][] = [];
  const before = new Map<number, { leaders: number[]; active: number[] }>();
  for (const id of eg.warsOf(L)) {
    const w = eg.war(id);
    if (w === null || w.ended !== null) continue;
    before.set(id, {
      leaders: w.sides.map((s) => s.leader),
      active: w.sides.flatMap((s) =>
        s.members.filter((m) => m.state === "active").map((m) => m.id),
      ),
    });
  }
  eg.ww.endWarsOf(L);
  for (const [id, b] of before) {
    const w = eg.war(id);
    if (w === null) continue;
    let fixed = false;
    for (const s of w.sides) {
      for (const m of s.members) {
        if (m.state === "left" && b.active.includes(m.id)) {
          m.state = "active";
          kept.push([id, m.id]);
          fixed = true;
        }
      }
    }
    if (!fixed) continue;
    w.sides.forEach((s, i) => {
      const old = b.leaders[i];
      if (s.members.some((m) => m.id === old && m.state === "active")) {
        s.leader = old;
      }
    });
    eg.dirtyWars = true;
  }
  return kept;
}

/**
 * After the war-end check: each member endWarsKeepingWinners kept active
 * whose war goes on and that has no pair left in it leaves it (spec §4.3).
 * True when one did.
 */
function releaseKept(
  eg: WwEndgame,
  kept: readonly [number, number][],
): boolean {
  let changed = false;
  for (const [wid, id] of kept) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null) continue;
    if (eg.member(w, id)?.state !== "active") continue;
    let paired = false;
    for (const [k, v] of eg.pairWar) {
      if (v !== wid) continue;
      if (Math.floor(k / eg.size) === id || k % eg.size === id) paired = true;
    }
    if (paired) continue;
    eg.setMemberState(wid, id, "left");
    changed = true;
  }
  return changed;
}
