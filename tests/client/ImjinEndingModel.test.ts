// ww177 P7a (Imjin design §10): the Imjin end card's words, per seat. The
// tests' translateText gives the key back, so the card's keys are checked
// against en.json and ko.json.
import {
  IMJIN_END_CAUSES,
  IMJIN_ENDINGS,
  type ImjinEndingCard,
} from "@openfront/engine-api/imjin/ImjinTypes";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  type ImjinEndView,
  imjinEndView,
  imjinShareBand,
} from "../../src/client/hud/ww1936/ImjinEndingModel";

const CARD: ImjinEndingCard = {
  ending: "partition",
  cause: "calendar",
  day: 3560,
  year: 1599,
  month: 12,
  jos: false,
  jpn: true,
  min: false,
  jpnHeldPm: 420,
  seat: 1,
  silver: 12_345,
  silverLimit: 10_000,
  liaodong: 0,
};

const lang = (l: string) =>
  JSON.parse(readFileSync(`resources/lang/${l}.json`, "utf8")) as Record<
    string,
    unknown
  >;
const EN = lang("en");
const KO = lang("ko");
const at = (o: Record<string, unknown>, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (v, k) => (v as Record<string, unknown> | undefined)?.[k],
      o,
    );
const texts = (v: ImjinEndView) => [
  v.title,
  v.cause,
  v.summary,
  v.verdict,
  v.share,
  ...v.goals,
  ...v.memoirs.flatMap((m) => [m.heading, m.text]),
];

describe("the Imjin end card", () => {
  test("each seat reads its own verdict and memoir; a spectator reads both", () => {
    const jpn = imjinEndView(CARD, "JPN");
    expect(jpn.isWin).toBe(true);
    expect(jpn.verdict).toBe("ww1936.imjin.end.you_met");
    expect(jpn.memoirs.map((m) => m.text)).toEqual([
      "ww1936.imjin.end.partition.memoir_jpn",
    ]);
    const jos = imjinEndView(CARD, "JOS");
    expect(jos.isWin).toBe(false);
    expect(jos.verdict).toBe("ww1936.imjin.end.you_failed");
    expect(jos.memoirs.map((m) => m.text)).toEqual([
      "ww1936.imjin.end.partition.memoir_jos",
    ]);
    const watcher = imjinEndView(CARD, null);
    expect(watcher.isWin).toBe(false);
    expect(watcher.verdict).toBe("");
    expect(watcher.memoirs).toHaveLength(2);
    expect(jpn.share).toBe("ww1936.imjin.end.share.half");
    expect(jpn.goals).toEqual([
      "ww1936.imjin.end.goal.jos_failed",
      "ww1936.imjin.end.goal.jpn_met",
      "ww1936.imjin.end.goal.min_failed",
    ]);
    // The expulsion says it itself: no share line.
    expect(imjinEndView({ ...CARD, ending: "expulsion" }, null).share).toBe("");
  });

  test("every ending, cause and seat has its words in en and ko", () => {
    for (const ending of IMJIN_ENDINGS) {
      for (const cause of IMJIN_END_CAUSES) {
        for (const tag of ["JOS", "JPN", null] as const) {
          for (const met of [true, false]) {
            const card = {
              ...CARD,
              ending,
              cause,
              jos: met,
              jpn: met,
              min: met,
            };
            for (const key of texts(imjinEndView(card, tag))) {
              if (key === "") continue;
              expect(typeof at(EN, key), key).toBe("string");
              expect(typeof at(KO, key), key).toBe("string");
            }
          }
        }
      }
    }
    for (const band of ["none", "few", "south", "half", "most"]) {
      expect(typeof at(KO, `ww1936.imjin.end.share.${band}`)).toBe("string");
    }
    expect(imjinShareBand(0)).toBe("none");
    expect(imjinShareBand(100)).toBe("few");
    expect(imjinShareBand(800)).toBe("most");
  });
});
