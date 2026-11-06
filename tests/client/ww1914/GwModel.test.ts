import type { GwSeatView } from "@openfront/engine-api/ww1914/GwView";
import { describe, expect, test } from "vitest";
import {
  appointable,
  clock,
  emptyShelf,
  endingsOf,
  gaugeLevel,
  groupReplies,
  instBand,
  loadShelf,
  logByChapter,
  saveShelf,
  secondsLeft,
  shelve,
  shelveEnding,
  tempBand,
  theatreSpot,
  trustIndex,
  vacantOffices,
} from "../../../src/client/hud/ww1914/GwModel";

const person = (id: string, office: string | null, fit: string[]) =>
  ({ id, office, trust: 0, topics: [], fit, rivals: [] }) as never;

describe("GwModel", () => {
  test("words clamp to their ranges", () => {
    expect(gaugeLevel("shells", 9)).toBe(3);
    expect(gaugeLevel("morale", -2)).toBe(0);
    expect(tempBand(0)).toBe(0);
    expect(tempBand(5)).toBe(1);
    expect(tempBand(8)).toBe(2);
    expect(tempBand(10)).toBe(3);
    expect(trustIndex(-9)).toBe(0);
    expect(trustIndex(3)).toBe(6);
    expect([-5, -3, 0, 3, 5].map(instBand)).toEqual([0, 1, 2, 3, 4]);
  });

  test("replies group in the order ask, push, deal, leave", () => {
    const r = (id: string, kind: string) =>
      ({ id, kind, open: true, tell: [], stance: "frank" }) as never;
    const g = groupReplies([r("a", "leave"), r("b", "ask"), r("c", "ask")]);
    expect(g.map((x) => [x.kind, x.replies.map((y) => y.id)])).toEqual([
      ["ask", ["b", "c"]],
      ["leave", ["a"]],
    ]);
  });

  test("an office is open to those who fit it and have none", () => {
    const seat = {
      people: [
        person("a", "chancellor", ["chancellor"]),
        person("b", null, ["chancellor", "war"]),
        person("c", null, ["war"]),
      ],
    } as unknown as GwSeatView;
    expect(vacantOffices(seat)).toEqual(["war"]);
    expect(appointable(seat, seat.people[1])).toEqual(["war"]);
    expect(appointable(seat, seat.people[0])).toEqual([]);
  });

  test("the clock reads the deadline in seconds; none solo", () => {
    expect(secondsLeft({ deadlineTick: null } as never, 5)).toBeNull();
    expect(secondsLeft({ deadlineTick: 1300 } as never, 100)).toBe(120);
    expect(clock(125)).toBe("2:05");
  });

  test("a front's mark sits between its lines", () => {
    const a = theatreSpot("west", 0, 0);
    const b = theatreSpot("west", 1, 2);
    expect(a.at).toBe(0);
    expect(b.at).toBeGreaterThan(1 / 6);
    expect(theatreSpot("west", 99, 0).line).toBe(5);
  });

  test("the why-log groups by chapter, newest first", () => {
    const out = logByChapter([
      { key: "a", chapter: 0 },
      { key: "b", chapter: 0 },
      { key: "c", chapter: 2 },
    ]);
    expect(out).toEqual([
      { chapter: 2, keys: ["c"] },
      { chapter: 0, keys: ["a", "b"] },
    ]);
  });

  test("the shelf keeps each thing once and survives broken storage", () => {
    let s = emptyShelf();
    s = shelve(s, "people", "x");
    s = shelve(s, "people", "x");
    s = shelveEnding(s, "DEU", "long_peace", "1914-12-01");
    s = shelveEnding(s, "DEU", "long_peace", "1914-12-02");
    expect(s.people).toEqual(["x"]);
    expect(endingsOf(s, "DEU")).toBe(1);
    expect(s.runs.length).toBe(2);
    const mem: Record<string, string> = {};
    saveShelf(s, { setItem: (k, v) => void (mem[k] = v) });
    expect(loadShelf({ getItem: (k) => mem[k] ?? null })).toEqual(s);
    expect(loadShelf({ getItem: () => "{broken" })).toEqual(emptyShelf());
    expect(() =>
      saveShelf(s, {
        setItem: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
