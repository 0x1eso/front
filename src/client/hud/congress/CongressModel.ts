import {
  ActiveResolutionData,
  AgendaItemData,
  BallotData,
  BallotOption,
  CongressData,
  EmergencyData,
  EmergencyKind,
  PlayerCongressData,
  RESOLUTION_META,
  ResolutionId,
  ResultData,
  SessionKind,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  CONVENE_COST_MILLI,
  extraVoteCost,
  MAX_EXTRA_VOTES,
  SESSION_INTERVAL_TICKS,
  SESSION_NOTICE_TICKS,
  VOTING_TICKS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  ConveneBlock,
  conveneBlock,
  conveneWindowOpen,
} from "@openfront/engine-lib/congress/Voting";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import type { GameView, PlayerView } from "../../view";

// World congress screens (spec §12): pure models over CongressData and the
// viewer's PlayerCongressData. Nothing here knows who voted what: the data
// only has turnout, totals and the viewer's own ballots (spec §6.5).

export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** What the congress screens read of the viewer. */
export interface CongressViewer {
  smallID: number;
  alive: boolean;
  data: PlayerCongressData | null;
  /** Allied with (or a teammate of) the player with this smallID. */
  friendlyTo(smallID: number): boolean;
}

export function viewerOf(game: GameView | undefined): CongressViewer | null {
  const me = game?.myPlayer();
  if (!game || !me) return null;
  return {
    smallID: me.smallID(),
    alive: me.isAlive(),
    data: me.congressData(),
    friendlyTo: (id) => {
      const p = game.playerBySmallID(id);
      return p.isPlayer() && me.isFriendly(p as PlayerView);
    },
  };
}

export function nameOf(game: GameView, smallID: number): string {
  const p = game.playerBySmallID(smallID);
  return p.isPlayer() ? (p as PlayerView).displayName() : "";
}

/** Whole influence points convening costs. */
export const CONVENE_COST = CONVENE_COST_MILLI / MILLI;

export function ticksToSeconds(ticks: number): number {
  return Math.max(0, Math.ceil(ticks / 10));
}

/** "m:ss". */
export function formatClock(ticks: number): string {
  const s = ticksToSeconds(ticks);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function myBallot(
  viewer: CongressViewer,
  sessionId: number,
  index: number,
): BallotData | null {
  return (
    viewer.data?.ballots.find(
      (b) => b.sessionId === sessionId && b.item === index,
    ) ?? null
  );
}

function canVote(
  data: CongressData,
  item: AgendaItemData,
  id: number,
): boolean {
  return data.seats.includes(id) || item.targets.includes(id);
}

export function isSanctioned(data: CongressData, smallID: number): boolean {
  return data.active.some(
    (r) =>
      r.resolution === "sanction" &&
      r.option === "A" &&
      r.targets.includes(smallID),
  );
}

/** A harmful resolution names me, or I am the emergency's target. */
export function isTargeted(data: CongressData, smallID: number): boolean {
  if (data.emergency?.target === smallID) return true;
  return data.active.some((r) => {
    const good = RESOLUTION_META[r.resolution].favorable;
    return r.targets.includes(smallID) && good !== null && r.option !== good;
  });
}

/** Why the viewer can't convene (kind, target) now, or null when one tap would (as Emergencies.conveneEmergency checks). */
export function conveneState(
  data: CongressData,
  viewer: CongressViewer,
  kind: EmergencyKind,
  target: number,
  now: number,
): ConveneBlock | null {
  return conveneBlock({
    available: data.available.some(
      (a) => a.kind === kind && a.target === target,
    ),
    windowOpen: conveneWindowOpen(
      now,
      data.session !== null,
      data.emergency !== null,
      data.nextSessionTick,
    ),
    seated: viewer.alive && data.seats.includes(viewer.smallID),
    isTarget: viewer.smallID === target,
    friendlyToTarget: viewer.friendlyTo(target),
    sanctioned: isSanctioned(data, viewer.smallID),
    influenceMilli: (viewer.data?.influence ?? 0) * MILLI,
  });
}

export type CongressDialState = "idle" | "soon" | "voting";

export interface CongressDialModel {
  state: CongressDialState;
  /** idle: toward the next session; voting: the time left (0..1). */
  progress: number;
  secondsLeft: number;
  /** Items of the open session I may vote on and haven't. */
  unvoted: number;
  targeted: boolean;
  canConvene: boolean;
  influence: number;
  /** Influence grows (peaceful or at the cap's edge); grey caption otherwise. */
  earning: boolean;
}

export function congressDial(
  data: CongressData,
  viewer: CongressViewer,
  now: number,
): CongressDialModel {
  const s = data.session;
  let state: CongressDialState;
  let progress: number;
  let secondsLeft: number;
  if (s !== null) {
    state = "voting";
    const span = Math.max(1, s.closeTick - s.openTick);
    progress = Math.min(1, Math.max(0, (s.closeTick - now) / span));
    secondsLeft = ticksToSeconds(s.closeTick - now);
  } else if (data.nextSessionTick <= 0) {
    // The clock hasn't scheduled the first session yet (Congress.toData sends 0).
    state = "idle";
    progress = 0;
    secondsLeft = 0;
  } else {
    const left = data.nextSessionTick - now;
    state = left <= SESSION_NOTICE_TICKS ? "soon" : "idle";
    progress =
      state === "soon"
        ? 1
        : Math.min(1, Math.max(0, 1 - left / SESSION_INTERVAL_TICKS));
    secondsLeft = ticksToSeconds(left);
  }
  const unvoted =
    s === null
      ? 0
      : s.items.filter(
          (item, i) =>
            viewer.alive &&
            canVote(data, item, viewer.smallID) &&
            myBallot(viewer, s.id, i) === null,
        ).length;
  return {
    state,
    progress,
    secondsLeft,
    unvoted,
    targeted: isTargeted(data, viewer.smallID),
    canConvene: data.available.some(
      (a) => conveneState(data, viewer, a.kind, a.target, now) === null,
    ),
    influence: viewer.data?.influence ?? 0,
    earning:
      viewer.data === null ||
      viewer.data.status === "peaceful" ||
      viewer.data.status === "capped",
  };
}

/** Ticks a resolution has left; null until its victory project ends. */
export function remainingTicks(
  r: ActiveResolutionData,
  data: CongressData,
  now: number,
): number | null {
  if (typeof r.expires === "number") return Math.max(0, r.expires - now);
  if (r.expires === "project_end") return null;
  const s = data.session;
  const tally =
    s !== null && s.kind === "regular"
      ? s.closeTick
      : data.nextSessionTick + VOTING_TICKS;
  return Math.max(0, tally - now);
}

export interface ChipModel {
  resolution: ResolutionId;
  option: BallotOption;
  targets: number[];
  param: string | null;
  remaining: number | null;
  mine: boolean;
}

/** Up to `max` chips: resolutions naming me first, then world rules, then the rest. */
export function resolutionChips(
  data: CongressData,
  smallID: number,
  now: number,
  max = 3,
): ChipModel[] {
  const rank = (c: ChipModel) => (c.mine ? 0 : c.targets.length === 0 ? 1 : 2);
  return data.active
    .map((r) => ({
      resolution: r.resolution,
      option: r.option,
      targets: r.targets,
      param: r.param,
      remaining: remainingTicks(r, data, now),
      mine: r.targets.includes(smallID),
    }))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, max);
}

export interface CardModel {
  sessionId: number;
  index: number;
  kind: SessionKind;
  item: AgendaItemData;
  closeTick: number;
  eligible: boolean;
  bOnly: boolean;
  myVote: BallotData | null;
  /** When I am named: the side good for me. */
  favorable: BallotOption | null;
  /** Seats that voted / seats (plus targets) that may: the only live count (secret ballot). */
  turnout: { voted: number; total: number };
}

export function cardModels(
  data: CongressData,
  viewer: CongressViewer,
): CardModel[] {
  const s = data.session;
  if (s === null) return [];
  return s.items.map((item, index) => {
    const named = item.targets.includes(viewer.smallID);
    return {
      sessionId: s.id,
      index,
      kind: s.kind,
      item,
      closeTick: s.closeTick,
      eligible: viewer.alive && canVote(data, item, viewer.smallID),
      bOnly:
        item.resolution === "emergency" &&
        (named || viewer.friendlyTo(item.targets[0])),
      myVote: myBallot(viewer, s.id, index),
      favorable: named ? RESOLUTION_META[item.resolution].favorable : null,
      turnout: {
        voted: item.voters,
        total: new Set([...data.seats, ...item.targets]).size,
      },
    };
  });
}

export interface ExtraChip {
  extra: number;
  /** What this tap costs (the raise from the current extra votes). */
  cost: number;
  affordable: boolean;
}

export function extraChips(
  myVote: BallotData | null,
  influence: number,
): ExtraChip[] {
  if (myVote === null) return [];
  const out: ExtraChip[] = [];
  for (let k = myVote.extra + 1; k <= MAX_EXTRA_VOTES; k++) {
    const cost = extraVoteCost(k) - extraVoteCost(myVote.extra);
    out.push({ extra: k, cost, affordable: cost <= influence });
  }
  return out;
}

export function resultKey(r: ResultData): string {
  return `${r.sessionId}:${r.resolution}:${r.targets.join(",")}:${r.param ?? ""}`;
}

/** Results in `next` that `prev` didn't have; none when there is no `prev` yet. */
export function newResults(
  prev: readonly ResultData[] | null,
  next: readonly ResultData[],
): ResultData[] {
  if (prev === null) return [];
  const seen = new Set(prev.map(resultKey));
  return next.filter((r) => !seen.has(resultKey(r)));
}

export function optionLabel(
  resolution: ResolutionId,
  option: BallotOption,
  t: Translate,
): string {
  return t(`congress.resolution.${resolution}.${option.toLowerCase()}`);
}

type Named = Pick<AgendaItemData, "resolution" | "targets" | "param">;

/** Who or what an item names: players (a pair joined by ↔) or its parameter. */
export function subjectText(
  item: Named,
  name: (smallID: number) => string,
  t: Translate,
): string {
  if (item.targets.length > 0) return item.targets.map(name).join(" ↔ ");
  if (item.param === null) return "";
  switch (item.resolution) {
    case "trade_pact":
      return t(`congress.param.${item.param}`);
    case "building_pact":
      return t(`unit_type.${item.param}`);
    case "government_resolution":
      return t(`domestic.gov.${item.param}.name`);
    case "law_review": {
      const [law, option] = item.param.split(":");
      return t(`domestic.law.${law}.${option}.name`);
    }
    default:
      return "";
  }
}

export function titleText(
  item: Named,
  name: (smallID: number) => string,
  t: Translate,
): string {
  const head =
    item.resolution === "emergency" && item.param !== null
      ? t(`congress.emergency.${item.param}`)
      : t(`congress.resolution.${item.resolution}.name`);
  const subject = subjectText(item, name, t);
  return subject === "" ? head : `${head} · ${subject}`;
}

export function reasonText(
  item: AgendaItemData,
  name: (smallID: number) => string,
  t: Translate,
): string {
  const params: Record<string, string | number> = {
    pct: item.reasonValue,
    ratio: item.reasonValue,
    count: item.reasonValue,
  };
  const [first, second] = item.targets;
  if (
    item.reason === "aggressor_government" ||
    item.reason === "aggressor_law" ||
    item.reason === "convened"
  ) {
    params.name = name(item.reasonValue);
  } else if (first !== undefined) {
    params.name = name(first);
  }
  if (second !== undefined) params.target = name(second);
  return t(`congress.reason.${item.reason}`, params);
}

export function goalText(e: EmergencyData, t: Translate): string {
  return t(`congress.goal.${e.goalKind}`, {
    progress: e.progress,
    goal: e.goal,
  });
}

/** Leaderboard status icons (spec §12), as bits of one number. */
export const FLAG_ICONS: readonly (readonly [number, string])[] = [
  [1, "⛔"],
  [2, "🚫"],
  [4, "🛡"],
  [8, "🕊"],
  [16, "🚨"],
  [32, "⚔"],
  [64, "🏛"],
];

export function congressFlags(
  data: CongressData | null,
  smallID: number,
): number {
  if (data === null) return 0;
  let mask = 0;
  for (const r of data.active) {
    if (r.option !== "A" || !r.targets.includes(smallID)) continue;
    if (r.resolution === "sanction") mask |= 1;
    if (r.resolution === "arms_embargo") mask |= 2;
    if (r.resolution === "protectorate") mask |= 4;
    if (r.resolution === "truce") mask |= 8;
    if (r.resolution === "world_heritage") mask |= 64;
  }
  if (data.emergency?.target === smallID) mask |= 16;
  // Members with a contribution (the data lists no one else): never from votes.
  if (data.emergency?.members.includes(smallID)) mask |= 32;
  return mask;
}

export function flagIcons(mask: number): string {
  return FLAG_ICONS.filter(([bit]) => (mask & bit) !== 0)
    .map(([, icon]) => icon)
    .join("");
}
