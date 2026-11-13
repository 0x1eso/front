// Great War 1914: a seat as it starts (GreatWar.start), and the stand-in a
// country nobody plays gets for reading its conditions (ww203 §9).
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwPressStart } from "@openfront/engine-api/ww1914/GwPress";
import { blankRuler } from "@openfront/engine-api/ww1914/GwRuler";
import { gwStoryStart } from "@openfront/engine-api/ww1914/GwStory";

export function blankSeat(smallID: number, tag: GwTag): GwSeatState {
  return {
    smallID,
    tag,
    ready: false,
    audiences: 0,
    privates: 0,
    desk: [],
    flags: [],
    memory: [],
    promises: [],
    seen: {},
    scheduled: [],
    alloc: {
      main: "west",
      posture: "hold",
      scale: "limited",
      allyShare: 0,
      research: "artillery",
    },
    log: [],
    tension: 0,
    shown: [],
    choices: [],
    mandates: [],
    known: [],
    subjects: {},
    big: -9,
    votes: [],
    signed: -1,
    lines: [],
    gov: [],
    memoir: null,
    ruler: blankRuler(),
    press: gwPressStart(),
    acts: 0,
    acted: [],
    aim: null,
    aimsDropped: [],
    claims: [],
    claimsSigned: -1,
    claimsChanged: 0,
    returns: [],
    terms: [],
    story: gwStoryStart(),
    ordered: false,
    idle: 0,
    regent: false,
    wired: 0,
    away: false,
  };
}
