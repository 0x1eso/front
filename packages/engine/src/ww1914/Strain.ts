// Great War 1914 (ww173 phase A, design ww173 §3): a front end's strain,
// 0..100, the hidden clock of a stalled front. Owned by S7a; the other ww173
// lanes read and move it only through strainOf, addStrain and
// collapsedThisChapter (/home/eser/dev/ww173-interfaces.md). The step that
// feeds it, the small moves and the collapse are in Stalemate.ts.
import {
  GW_SIDES,
  GwSide,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GreatWar } from "./GreatWar";
import { membersOf, sideIn } from "./Wars";
import { clampTo } from "./World";

export const STRAIN_MAX = 100;
/** Words for our end: 버틸 만하다 / 지쳐 있다 / 금이 갔다 / 무너지기 직전. */
const STRAIN_BANDS = [40, 60, 80] as const;
/** An AI with its own end this worn holds, asks its friends and talks sooner. */
export const STRAIN_WORN = 60;
/** New armies reaching a front, or America in the west. */
export const NEW_ARMIES_EASE = 10;
/** A new regime's hope. */
const REGIME_EASE = 15;
/** A partner on the same end leaves the war. */
const PARTNER_OUT = 15;

export const endIdx = (side: GwSide) => GW_SIDES.indexOf(side);

/** An end's strain, 0..100. */
export function endStrain(t: GwTheatreState, side: GwSide): number {
  return t.strain?.[endIdx(side)] ?? 0;
}

export function setEndStrain(t: GwTheatreState, side: GwSide, v: number): void {
  const next: [number, number] = [...(t.strain ?? [0, 0])] as [number, number];
  next[endIdx(side)] = clampTo(v, 0, STRAIN_MAX);
  t.strain = next;
}

/** Strain's word, 0 holding .. 3 near breaking: never a number on screen. */
export function strainWord(v: number): number {
  return STRAIN_BANDS.filter((b) => v >= b).length;
}

/** What strain leaves of a defence, percent (design §3). */
export function strainHold(t: GwTheatreState, side: GwSide): number {
  return 100 - Math.floor(Math.max(0, endStrain(t, side) - 40) / 2);
}

/** What strain leaves of an attack, percent. */
export function strainPush(t: GwTheatreState, side: GwSide): number {
  return 100 - Math.floor(Math.max(0, endStrain(t, side) - 50) / 2);
}

/** A one-off move on an open front's end: + feeds it, - eases it. */
export function easeStrain(
  gw: GreatWar,
  theatre: GwTheatre,
  side: GwSide,
  delta: number,
): void {
  const t = gw.s.theatres.find((x) => x.id === theatre);
  if (t === undefined || !t.open) return;
  setEndStrain(t, side, endStrain(t, side) + delta);
}

/** The worst strain on any open front `tag` fights on. */
export function worstStrain(gw: GreatWar, tag: GwTag): number {
  let worst = 0;
  for (const t of gw.s.theatres) {
    if (!t.open) continue;
    const end = sideIn(gw, t.id, tag);
    if (end === null || !membersOf(gw, t.id, end).includes(tag)) continue;
    worst = Math.max(worst, endStrain(t, end));
  }
  return worst;
}

/** A new form of government: its first months are hope (Kerensky's). */
export function regimeHope(gw: GreatWar, tag: GwTag): void {
  for (const t of gw.s.theatres) {
    const end = t.open ? sideIn(gw, t.id, tag) : null;
    if (end !== null) setEndStrain(t, end, endStrain(t, end) - REGIME_EASE);
  }
}

/** `tag` is leaving the war: the friends it leaves on its fronts feel it. */
export function partnerOut(gw: GreatWar, tag: GwTag): void {
  for (const t of gw.s.theatres) {
    const end = t.open ? sideIn(gw, t.id, tag) : null;
    if (end === null) continue;
    if (!membersOf(gw, t.id, end).some((x) => x !== tag)) continue;
    setEndStrain(t, end, endStrain(t, end) + PARTNER_OUT);
  }
}

/** The end `tag` fights at on `theatre`, if it is one of its members. */
function endOf(gw: GreatWar, theatre: GwTheatre, tag: GwTag): GwSide | null {
  const t = gw.s.theatres.find((x) => x.id === theatre);
  if (t === undefined || !t.open) return null;
  const end = sideIn(gw, theatre, tag);
  return end !== null && membersOf(gw, theatre, end).includes(tag) ? end : null;
}

/** 0..100 at the end where `tag` fights on `theatre`; 0 if it doesn't. */
export function strainOf(gw: GreatWar, theatre: GwTheatre, tag: GwTag): number {
  const end = endOf(gw, theatre, tag);
  if (end === null) return 0;
  return endStrain(gw.s.theatres.find((x) => x.id === theatre)!, end);
}

/** Moves the strain where `tag` fights on `theatre`, clamped; else nothing. */
export function addStrain(
  gw: GreatWar,
  theatre: GwTheatre,
  tag: GwTag,
  delta: number,
): void {
  const end = endOf(gw, theatre, tag);
  if (end === null) return;
  const t = gw.s.theatres.find((x) => x.id === theatre)!;
  setEndStrain(t, end, endStrain(t, end) + delta);
}

/** The lead of the end that broke on `theatre` this chapter, or null. */
export function collapsedThisChapter(
  gw: GreatWar,
  theatre: GwTheatre,
): GwTag | null {
  const c = (gw.s.collapses ?? []).find(
    (x) => x.theatre === theatre && x.chapter === gw.s.chapter,
  );
  return c?.tag ?? null;
}
