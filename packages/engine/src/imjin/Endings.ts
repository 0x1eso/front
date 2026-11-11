// ww177 P7a (Imjin design §10): the Imjin War's end, in place of 1936's
// score verdict. Once a day it reads the state (EndingRules.ImjinEndFacts),
// counts Ming's silver and the days Japan has been out of Korea, and on the
// calendar's last day or an end by state fixes the ending card. The win
// check (Victory.checkImjinWin) then ends the game with it.
import type { ImjinEndingCard } from "@openfront/engine-api/imjin/ImjinTypes";
import {
  type ImjinEndFacts,
  imjinEndCause,
  imjinEnding,
  imjinGoals,
  MING_SILVER_LIMIT,
  mingSilverDay,
} from "@openfront/engine-lib/imjin/EndingRules";
import {
  IMJIN_GFLAG,
  IMJIN_PEACE_GFLAG,
} from "@openfront/engine-lib/imjin/JapanContent";
import { dateOfDay, dayOfDateIn } from "@openfront/engine-lib/ww1936/Calendar";
import { imjinCalendarOf } from "@openfront/engine-lib/ww1936/scenario/Profile";
import { TRUCE_PHASE } from "./japan/ImjinJapan";
import type { WwImjin } from "./WwImjin";

/** The ending's own state (inside WwImjin's snapshot). */
export interface ImjinEndState {
  /** Ming's silver spent, thousands of taels. */
  silver: number;
  /** Days Japan has been out of Korea since it started the war. */
  outDays: number;
  ending: ImjinEndingCard | null;
}

export function emptyEndState(): ImjinEndState {
  return { silver: 0, outDays: 0, ending: null };
}

export class ImjinEndings {
  private korea: number[] | null = null;
  private ming: number[] | null = null;
  private endDayMemo: number | null = null;

  constructor(private readonly im: WwImjin) {}

  private get st(): ImjinEndState {
    return this.im.st.end;
  }

  /** The ending once it is fixed (null while the war goes on). */
  ending(): ImjinEndingCard | null {
    return this.st.ending;
  }

  /** The calendar's last day as a game day (-1: no end by date). */
  endDay(): number {
    if (this.endDayMemo === null) {
      const ww = this.im.ww;
      const iso = imjinCalendarOf(this.im.mg.config().gameConfig()).endIso;
      this.endDayMemo = iso === null ? -1 : dayOfDateIn(iso, ww.epoch);
    }
    return this.endDayMemo;
  }

  /** Joseon's regions at the start (Korea), and Ming's. */
  private startRegions(): { korea: number[]; ming: number[] } {
    if (this.korea === null || this.ming === null) {
      const sc = this.im.ww.scenario;
      const owners = sc.ownerByRegion();
      const jos = this.im.idOf("JOS");
      const min = this.im.idOf("MIN");
      this.korea = [];
      this.ming = [];
      for (const r of sc.landRegions) {
        if (owners[r.id] === jos) this.korea.push(r.id);
        else if (min !== 0 && owners[r.id] === min) this.ming.push(r.id);
      }
    }
    return { korea: this.korea, ming: this.ming };
  }

  /** The state as the rules read it. */
  facts(): ImjinEndFacts {
    const ww = this.im.ww;
    const jos = this.im.idOf("JOS");
    const jpn = this.im.idOf("JPN");
    const ctl = ww.land.controller;
    const { korea, ming } = this.startRegions();
    let jpnHeld = 0;
    let josHeld = 0;
    for (const r of korea) {
      if (ctl[r] === jpn) jpnHeld++;
      else if (ctl[r] === jos) josHeld++;
    }
    let liaodong = 0;
    for (const r of ming) if (ctl[r] === jpn) liaodong++;
    const js = ww.japan?.state();
    const gflags = ww.politics.gflags;
    return {
      warBegan: (js?.warDay ?? -1) >= 0,
      atWar: ww.isAtWar(jpn, jos),
      jpnHeldPm:
        korea.length === 0 ? 0 : Math.floor((jpnHeld * 1000) / korea.length),
      josHeld,
      seat: ww.imjinJm?.seat ?? 0,
      josCapitulated: ww.isCapitulated(jos),
      peace: gflags.has(IMJIN_PEACE_GFLAG),
      truce:
        js !== undefined &&
        (js.phase === TRUCE_PHASE.truce ||
          js.phase === TRUCE_PHASE.envoysAsked),
      truceBroken: gflags.has(IMJIN_GFLAG.truceBroken),
      liaodong,
      silver: this.st.silver,
    };
  }

  /** Ming's divisions on Joseon's soil (as JoseonMing counts them). */
  private mingAbroad(): number {
    const ww = this.im.ww;
    const min = this.im.idOf("MIN");
    const jos = this.im.idOf("JOS");
    const legal = ww.politics.legalOwner;
    const t = ww.land.divisions;
    let n = 0;
    for (let row = 0; row < t.rows; row++) {
      if (t.id[row] === 0 || t.owner[row] !== min) continue;
      if (legal[t.region[row]] === jos) n++;
    }
    return n;
  }

  /** Once a day (WwImjin.daily): the silver, the days out, the end. */
  day(day: number): void {
    const st = this.st;
    if (st.ending !== null) return;
    const ww = this.im.ww;
    const min = this.im.idOf("MIN");
    const jpn = this.im.idOf("JPN");
    if (min !== 0 && (ww.imjinJm?.mingStage ?? 0) > 0) {
      st.silver += mingSilverDay(ww.isAtWar(min, jpn), this.mingAbroad());
    }
    const f = { ...this.facts(), silver: st.silver };
    st.outDays = f.warBegan && f.jpnHeldPm === 0 ? st.outDays + 1 : 0;
    const cause = imjinEndCause(f, st.outDays, day, this.endDay());
    if (cause === null) return;
    const goals = imjinGoals(f);
    const date = dateOfDay(day, ww.epoch);
    st.ending = {
      ending: imjinEnding(f, cause),
      cause,
      day,
      year: date.year,
      month: date.month,
      jos: goals.jos,
      jpn: goals.jpn,
      min: goals.min,
      jpnHeldPm: f.jpnHeldPm,
      seat: f.seat,
      silver: f.silver,
      silverLimit: MING_SILVER_LIMIT,
      liaodong: f.liaodong,
    };
  }

  /** The seats whose aims were met, by tag (the win's humans). */
  winnerTags(): ("JOS" | "JPN" | "MIN")[] {
    const e = this.st.ending;
    if (e === null) return [];
    const out: ("JOS" | "JPN" | "MIN")[] = [];
    if (e.jos) out.push("JOS");
    if (e.jpn) out.push("JPN");
    if (e.min) out.push("MIN");
    return out;
  }

  hash(): number {
    const st = this.st;
    let h = (Math.imul(st.silver, 31) + st.outDays) | 0;
    const e = st.ending;
    if (e !== null) h = (Math.imul(h, 31) + e.day + 1) | 0;
    return h;
  }
}
