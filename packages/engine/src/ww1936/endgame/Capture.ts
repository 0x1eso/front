// World War 1936 P5 lane A (plan Task 6; spec §14): captured equipment.
// Same equipment, same generation (GROUND_EQUIP_KEYS slot by slot); the
// captor's capturePct adds whole percent to the share.
import { EQUIP_KEY_COUNT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_CAPITULATION_STOCK_TO_VICTOR_PCT,
  WW_CAPTURE_BASE_BP,
  WW_CAPTURE_ENCIRCLE_BP,
  WW_DISBANDED_EQUIP_TO_VICTOR_PCT,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { captureMilli } from "@openfront/engine-lib/ww1936/EndgameRules";
import { returnEquip } from "../economy/Stock";
import type { Battle } from "../land/WwLand";
import { NOTE_CAPTURE, type WwEndgame } from "./WwEndgame";

/** Spec §14: the captor's share, bp (base + capturePct × 100). */
export function captureBpOf(eg: WwEndgame, id: number, baseBp: number): number {
  const pct = eg.ww.economy.country(id)?.stats.capturePct ?? 0;
  return Math.max(0, baseBp + pct * 100);
}

function give(
  eg: WwEndgame,
  to: number,
  j: number,
  n: number,
  region: number,
): void {
  if (n <= 0) return;
  const ce = eg.ww.economy.country(to);
  if (ce === null) return;
  returnEquip(ce, GROUND_EQUIP_KEYS[j], n);
  eg.ww.economy.markCountryDirty(to);
  eg.note(to, NOTE_CAPTURE, j, region, n);
}

/**
 * P2: a battle ended; side `winnerSide` (0 attackers, 1 defenders) took
 * the field. The winners share the loser's lost equipment (capEq) by the
 * casualties each dealt in it (dmgBy; floor, the remainder to the one
 * that dealt most), each at its own share (5% + capturePct).
 */
export function captureOnBattleEnd(
  eg: WwEndgame,
  battle: Battle,
  winnerSide: 0 | 1,
): void {
  const cap = battle.capEq;
  if (cap === undefined) return;
  const land = eg.ww.land;
  const lead = winnerSide === 0 ? battle.attLead : battle.defLead;
  if (lead <= 0) return;
  // The winners: the dealers of the winning side (by the side of its lead).
  const winners = (battle.dmgBy ?? []).filter(
    ([c, men]) => men > 0 && eg.isActor(c) && land.sameSide(c, lead),
  );
  if (winners.length === 0 && eg.isActor(lead)) winners.push([lead, 1]);
  if (winners.length === 0) return;
  let total = 0;
  let top = 0;
  for (let i = 0; i < winners.length; i++) {
    total += winners[i][1];
    if (winners[i][1] > winners[top][1]) top = i;
  }
  const lostAt = (1 - winnerSide) * GROUND_SLOTS;
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const lost = cap[lostAt + j];
    if (lost <= 0) continue;
    const parts = winners.map(([, men]) => Math.floor((lost * men) / total));
    let rest = lost;
    for (const p of parts) rest -= p;
    parts[top] += rest;
    winners.forEach(([c], i) => {
      const milli = captureMilli(
        parts[i],
        captureBpOf(eg, c, WW_CAPTURE_BASE_BP),
      );
      give(eg, c, j, Math.floor(milli / 1000), battle.region);
    });
  }
}

/** P2: division `row` was destroyed encircled by `by`'s side: 20% (+ capturePct) of all it carried. */
export function captureOnEncircled(
  eg: WwEndgame,
  row: number,
  by: number,
): void {
  if (!eg.isActor(by)) return;
  const t = eg.ww.land.divisions;
  if (t.id[row] === 0) return;
  const region = t.battle[row] !== 0 ? t.battle[row] : t.region[row];
  const bp = captureBpOf(eg, by, WW_CAPTURE_ENCIRCLE_BP);
  const eq = t.equipOf(row);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const milli = captureMilli(eq[j] * 1000, bp);
    give(eg, by, j, Math.floor(milli / 1000), region);
  }
}

/**
 * Spec §5.2, §14: a capitulation's share for the victor — 25% of every
 * stock line of the loser and 50% of the equipment of its disbanded
 * divisions. Call it after the survivors moved and before the loser's
 * forces go: every division the loser still has outside its side's land
 * counts as disbanded (for an exile, its host's side; with no exile all of
 * them). It only adds to the victor: the loser's stock and divisions are
 * the caller's (spec §5.2's table).
 */
export function captureOnCapitulation(
  eg: WwEndgame,
  loser: number,
  victor: number,
): void {
  if (victor === loser || !eg.isActor(victor)) return;
  const econ = eg.ww.economy;
  const from = econ.country(loser);
  const to = econ.country(victor);
  if (from === null || to === null) return;
  for (let k = 0; k < EQUIP_KEY_COUNT; k++) {
    const n = Math.floor(
      (from.stock[k] * WW_CAPITULATION_STOCK_TO_VICTOR_PCT) / 100,
    );
    returnEquip(to, k, n);
  }
  const land = eg.ww.land;
  const t = land.divisions;
  const host = eg.isExile(loser) ? eg.sideOwner(loser) : 0;
  const slots = new Array<number>(GROUND_SLOTS).fill(0);
  for (const r of land.rowsOf(loser)) {
    const c = land.controller[t.region[r]] ?? 0;
    if (host > 0 && c !== 0 && c !== loser && land.sameSide(host, c)) {
      continue;
    }
    const eq = t.equipOf(r);
    for (let j = 0; j < GROUND_SLOTS; j++) slots[j] += eq[j];
  }
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const n = Math.floor((slots[j] * WW_DISBANDED_EQUIP_TO_VICTOR_PCT) / 100);
    returnEquip(to, GROUND_EQUIP_KEYS[j], n);
  }
  econ.markCountryDirty(victor);
}
