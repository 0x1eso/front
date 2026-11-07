import type { GwLandMove } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwFrontView } from "@openfront/engine-api/ww1914/GwWorldView";
import { describe, expect, test } from "vitest";
import {
  deskPins,
  placeInText,
  placeOfCard,
  replayBeats,
  replayClock,
  theatreOfPlace,
} from "../../../src/client/hud/ww1914/GwPlaceModel";

const line = () => 3;
const card = (o: Partial<GwCardView>): GwCardView =>
  ({
    uid: 1,
    scene: "s",
    kind: "report",
    variant: "base",
    cast: {},
    stamp: null,
    options: [],
    who: null,
    node: null,
    says: null,
    replies: [],
    ...o,
  }) as GwCardView;
const seat = (desk: GwCardView[]) =>
  ({ tag: "DEU", desk, theatres: [] }) as unknown as GwSeatView;
const pack = (brief: string) =>
  ({ scenes: { s: { title: "제목", brief, text: { base: "" } } } }) as never;

describe("a paper's place from its words", () => {
  test("a town wins, and the seat's capital only if nothing else is named", () => {
    expect(
      placeInText("베를린에서 온 전보, 이프르가 불탄다", "DEU", line),
    ).toBe("ypres");
    expect(placeInText("베를린의 신문들", "DEU", line)).toBe("berlin");
  });

  test("a name inside a word, or an everyday word, is no name", () => {
    expect(placeInText("그럴 리가 없다", "DEU", line)).toBeNull();
    expect(placeInText("빈 의자에 앉아 파리채를 든다", "DEU", line)).toBeNull();
  });

  test("Vienna, one syllable, counts only as a name is used", () => {
    expect(placeInText("빈 주재 대사의 보고", "DEU", line)).toBe("vienna");
    expect(placeInText("빈이 쓰는 초안", "DEU", line)).toBe("vienna");
  });

  test("a front is where its line stands", () => {
    expect(placeInText("서부전선 앞쪽 참호", "DEU", line)).toBe("ypres");
  });

  test("a country named in passing gives way to the rules", () => {
    expect(placeInText("독일 잠수함의 숫자", "GBR", line, "scapa_flow")).toBe(
      "scapa_flow",
    );
    expect(placeInText("러시아의 소식", "DEU", line, "berlin")).toBe(
      "petrograd",
    );
    expect(placeInText("독일의 소식", "DEU", line, "berlin")).toBe("berlin");
  });
});

describe("cards on the map", () => {
  test("a hand-named place beats the words, a letter comes from its country", () => {
    const s = seat([]);
    const d = "1914-08-01";
    expect(placeOfCard(card({ place: "verdun" }), pack("파리"), s, d)).toBe(
      "verdun",
    );
    expect(placeOfCard(card({ letterFrom: "RUS" }), pack("파리"), s, d)).toBe(
      "petrograd",
    );
    expect(placeOfCard(card({ near: "gaza" }), pack(""), s, d)).toBe("gaza");
  });

  test("papers of one place share a pin; silent cards and the years have none", () => {
    const pins = deskPins(
      seat([
        card({ uid: 1, place: "verdun" }),
        card({ uid: 2, place: "verdun", options: [{} as never] }),
        card({ uid: 3, place: "ypres" }),
        card({ uid: 4, place: "paris", silent: true }),
        card({ uid: 5, place: "paris", past: 1 }),
      ]),
      null,
      "1914-08-01",
    );
    expect(pins.map((p) => [p.place, p.cards.length, p.waits])).toEqual([
      ["verdun", 2, true],
      ["ypres", 1, false],
    ]);
  });

  test("a place knows its front", () => {
    expect(theatreOfPlace("verdun")).toBe("west");
    expect(theatreOfPlace("berlin")).toBeNull();
  });
});

describe("the month's replay", () => {
  const mv = (place: GwLandMove["place"], theatre: GwLandMove["theatre"]) =>
    ({ place, theatre, from: "BEL", to: "DEU" }) as GwLandMove;
  const front = (id: GwFrontView["id"], lineIndex: number) =>
    ({ id, lineIndex }) as GwFrontView;

  test("nothing moved, nothing plays", () => {
    const f = [front("west", 2)];
    expect(replayBeats([], f, f, 900)).toEqual([]);
  });

  test("the front that took most land comes first, a line alone is a beat", () => {
    const beats = replayBeats(
      [mv("gaza", "palestine"), mv("liege", "west"), mv("namur", "west")],
      [front("west", 1), front("east", 2), front("palestine", 0)],
      [front("west", 2), front("east", 3), front("palestine", 0)],
      900,
    );
    expect(beats.map((b) => b.theatre)).toEqual(["west", "palestine", "east"]);
    expect(beats[0].line).toEqual({ from: 1, to: 2 });
    expect(beats[2].moves).toEqual([]);
  });

  test("a month takes seconds however much fell, and moves are in order", () => {
    const many = Array.from({ length: 17 }, () => mv("liege", "west"));
    const clock = replayClock(replayBeats(many, [], [front("west", 1)], 900));
    expect(clock.end).toBeLessThan(5000);
    const at = clock.beats[0].moves;
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at.length).toBe(17);
  });

  test("only three fronts are shown", () => {
    const moves = (["west", "east", "balkan", "italy"] as const).map((t) =>
      mv("liege", t),
    );
    const clock = replayClock(replayBeats(moves, [], [], 900));
    expect(clock.beats.length).toBe(3);
    expect(clock.end).toBeLessThan(10000);
  });
});
