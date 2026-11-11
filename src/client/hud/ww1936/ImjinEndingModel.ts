// ww177 P7a (Imjin design §10): the end card of an Imjin game, from the
// ending the engine fixed (ImjinData.ending). Each side is judged by its
// own aims, so the card says whose were met; the memoir paragraph is the
// seat's own (a spectator reads both). Pure: the tests drive it alone.
import type { ImjinEndingCard } from "@openfront/engine-api/imjin/ImjinTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { IMJIN_EXPELLED_DAYS } from "@openfront/engine-lib/imjin/EndingRules";
import { translateText } from "../../Utils";

export interface ImjinEndView {
  title: string;
  /** My seat's aims were met (false for a spectator). */
  isWin: boolean;
  /** The verdict for my seat ("" for a spectator). */
  verdict: string;
  /** Why it ended, with the date. */
  cause: string;
  summary: string;
  /** What Japan holds in Korea ("" for the expulsion, which says it). */
  share: string;
  /** Each side's aims, met or not. */
  goals: string[];
  memoirs: { heading: string; text: string }[];
}

/** Japan's share of Korea in words (no numbers on the card). */
export function imjinShareBand(pm: number): string {
  if (pm <= 0) return "none";
  if (pm < 150) return "few";
  if (pm < 400) return "south";
  if (pm < 700) return "half";
  return "most";
}

export function imjinEndView(
  card: ImjinEndingCard,
  myTag: CountryTag | null,
): ImjinEndView {
  const when = { year: card.year, month: card.month };
  const mine =
    myTag === "JOS" ? card.jos : myTag === "JPN" ? card.jpn : undefined;
  const silver = {
    silver: Math.floor(card.silver / 10),
    limit: Math.floor(card.silverLimit / 10),
  };
  const goal = (side: "jos" | "jpn" | "min", met: boolean) =>
    translateText(
      `ww1936.imjin.end.goal.${side}_${met ? "met" : "failed"}`,
      side === "min" ? silver : {},
    );
  const memoir = (side: "jos" | "jpn") => ({
    heading: translateText(`ww1936.imjin.end.memoir_${side}`),
    text: translateText(`ww1936.imjin.end.${card.ending}.memoir_${side}`, {
      year: card.year,
    }),
  });
  const memoirs =
    myTag === "JOS"
      ? [memoir("jos")]
      : myTag === "JPN"
        ? [memoir("jpn")]
        : [memoir("jos"), memoir("jpn")];
  return {
    title: translateText(`ww1936.imjin.end.${card.ending}.title`),
    isWin: mine === true,
    verdict:
      mine === undefined
        ? ""
        : translateText(
            mine ? "ww1936.imjin.end.you_met" : "ww1936.imjin.end.you_failed",
          ),
    cause: translateText(`ww1936.imjin.end.cause.${card.cause}`, {
      ...when,
      days: IMJIN_EXPELLED_DAYS,
    }),
    summary: translateText(`ww1936.imjin.end.${card.ending}.summary`),
    share:
      card.ending === "expulsion"
        ? ""
        : translateText(
            `ww1936.imjin.end.share.${imjinShareBand(card.jpnHeldPm)}`,
          ),
    goals: [
      goal("jos", card.jos),
      goal("jpn", card.jpn),
      goal("min", card.min),
    ],
    memoirs,
  };
}
