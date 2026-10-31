// World War 1936: white peace on the screens (owner-approved plan,
// 2026-10-30) — the offer button of each of my wars in the diplomacy
// drawer, and the card a human target answers.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
  WwPeaceOfferView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { translateText } from "../../Utils";
import { type EndgameGame, warName } from "./EndgameModel";
import { countryFlagUrl, countryText } from "./EndgameNames";
import { lineCardSummary, type LinePeaceSummary } from "./LinePeaceModel";
import { negPeaceTermsLines } from "./NegPeaceModel";
import {
  today,
  type WwPaceGame,
  wwSeconds,
  wwWindowTicks,
} from "./WorldWarModel";

export type WhitePeaceGame = EndgameGame & WwPaceGame;

/** Why my offer is greyed (the engine's peaceOfferBlock, as the brief words it). */
export type WhitePeaceBlock =
  | "war_kind"
  | "puppet"
  | "too_early"
  | "cooldown"
  | "no_pp";

export interface WhitePeaceButton {
  war: number;
  target: number;
  /** True: the whole war (I lead my side); false: a separate peace (I leave my faction). */
  whole: boolean;
  /** "Whole war" / "Separate peace (leaves the faction)". */
  scope: string;
  blockId: WhitePeaceBlock | null;
  /** The reason, as text; null when I may offer. */
  block: string | null;
  /** My offer in this war waits for the answer. */
  pending: boolean;
  order: WwOrder;
}

const fights = (state: string) => state === "active" || state === "exiled";

/**
 * The offer button of war `w` for me (null: not my ongoing war, or I no
 * longer fight in it). The target is the other side's leader.
 */
export function whitePeaceButton(
  game: WhitePeaceGame,
  me: number,
  w: WwWarSummary,
): WhitePeaceButton | null {
  if (w.ended || me <= 0) return null;
  const s = w.sides.findIndex((x) => x.members.some((m) => m.id === me));
  if (s < 0) return null;
  const mine = w.sides[s].members.find((m) => m.id === me);
  if (mine === undefined || !fights(mine.state)) return null;
  const target = w.sides[1 - s]?.leader ?? 0;
  if (target <= 0) return null;
  const eg = game.wwEndgame?.() ?? null;
  const whole = w.sides[s].leader === me;
  const day = today(game);
  const sub = eg?.subjectOf(me) ?? null;
  const cool = eg?.cooldownUntil(me, target) ?? 0;
  const pp = game.wwPolitics?.()?.summary(me)?.ppMilli ?? 0;
  let blockId: WhitePeaceBlock | null = null;
  let days = 0;
  if (w.kind !== "normal") blockId = "war_kind";
  else if (
    sub !== null &&
    (sub.level === "integrated" || sub.level === "puppet")
  )
    blockId = "puppet";
  else if (day - w.startDay < WW_WHITE_PEACE_MIN_DAYS) {
    blockId = "too_early";
    days = WW_WHITE_PEACE_MIN_DAYS - (day - w.startDay);
  } else if (cool > day) {
    blockId = "cooldown";
    days = cool - day;
  } else if (pp < WW_WHITE_PEACE_PP * 1000) blockId = "no_pp";
  return {
    war: w.id,
    target,
    whole,
    scope: translateText(
      whole ? "ww1936.wpeace.scope_whole" : "ww1936.wpeace.scope_separate",
    ),
    blockId,
    block:
      blockId === null
        ? null
        : translateText(`ww1936.wpeace.block.${blockId}`, {
            days,
            pp: WW_WHITE_PEACE_PP,
          }),
    pending: eg?.offerFrom(me, w.id) !== null && eg !== null,
    order: { kind: "peace_offer", war: w.id, target },
  };
}

export interface WhitePeaceSideLine {
  flagUrl: string;
  name: string;
  /** "Capitulation 45% · war score 62%". */
  line: string;
}

export interface WhitePeaceCardView {
  /** The offer id (the card's identity). */
  id: number;
  deadlineTick: number;
  /** "Germany offers a white peace" (with terms: "…offers peace with terms"). */
  title: string;
  /** "German–Polish War (1939)". */
  war: string;
  /** "The whole war ends" / "Germany alone leaves the war and its faction". */
  scope: string;
  sides: WhitePeaceSideLine[];
  /** "Germany holds 35% of Poland" (at most four). */
  held: string[];
  /** Negotiated peace: the terms ("Poland cedes: Krakow", "…pays 20%…"); none: a white peace. */
  terms: string[];
  /** Peace on the current line: what changes hands, from my side (null: another kind of offer). */
  line: LinePeaceSummary | null;
  secondsLeft: number;
  /** Time left, 1 → 0. */
  fraction: number;
  /** Other offers waiting behind this one. */
  more: number;
}

/** My white peace card: the oldest offer made to my country; null without one. */
export function whitePeaceCardModel(
  game: WhitePeaceGame,
): WhitePeaceCardView | null {
  const me = game.myPlayer()?.smallID() ?? 0;
  const eg = game.wwEndgame?.() ?? null;
  if (me <= 0 || eg === null) return null;
  const offers = eg.offersTo(me);
  if (offers.length === 0) return null;
  const o = offers[0];
  const w = eg.wars.find((x) => x.id === o.war) ?? null;
  const from = countryText(game, o.from);
  const left = Math.max(0, o.deadlineTick - game.ticks());
  const total = wwWindowTicks(game, WW_WHITE_PEACE_CARD_TICKS);
  return {
    id: o.id,
    deadlineTick: o.deadlineTick,
    title: translateText(
      o.line !== undefined
        ? "ww1936.lpeace.card_title"
        : o.terms === null || o.terms === undefined
          ? "ww1936.wpeace.card_title"
          : "ww1936.wpeace.card_title_terms",
      { country: from },
    ),
    war: w === null ? "" : warName(game, w),
    scope: translateText(
      o.whole ? "ww1936.wpeace.card_whole" : "ww1936.wpeace.card_separate",
      { country: from },
    ),
    sides: o.sides.map((s) => sideLine(game, s)),
    held: heldLines(game, o),
    terms: negPeaceTermsLines(game, o),
    line: lineCardSummary(game, o),
    secondsLeft: wwSeconds(game, left),
    fraction: Math.min(1, left / Math.max(1, total)),
    more: offers.length - 1,
  };
}

function sideLine(
  game: WhitePeaceGame,
  s: WwPeaceOfferView["sides"][number],
): WhitePeaceSideLine {
  const name = countryText(game, s.id);
  return {
    flagUrl: countryFlagUrl(game, s.id),
    name,
    line: translateText("ww1936.wpeace.card_side", {
      country: name,
      cap: Math.floor(s.capPm / 10),
      score: Math.floor(s.scorePm / 10),
    }),
  };
}

function heldLines(game: WhitePeaceGame, o: WwPeaceOfferView): string[] {
  return o.held.map(([holder, owner, pm]) =>
    translateText("ww1936.wpeace.card_held", {
      holder: countryText(game, holder),
      owner: countryText(game, owner),
      pct: Math.floor(pm / 10),
    }),
  );
}
