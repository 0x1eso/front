import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import type { GwCtx } from "../../../src/client/hud/ww1914/GwCtx";
import { brokenLine, rulerCard } from "../../../src/client/hud/ww1914/GwRuler";
import { optionText } from "../../../src/client/hud/ww1914/GwText";

const band = (s: string): [string, string, string] => [
  `${s} low`,
  `${s} mid`,
  `${s} good`,
];
const pack = {
  version: 1,
  scenes: {
    a: {
      title: "t",
      text: { base: "b", conscience: "c" },
      opt: { sign: "**plain.** line" },
      optBy: { conscience: { sign: "**cold.**" } },
      nodes: { n1: { says: {}, replies: { go: "**Go.** now" } } },
    },
  },
  people: {},
  rulers: {
    wilhelm: {
      name: "빌헬름",
      health: band("h"),
      family: band("f"),
      conscience: band("c"),
      reputation: band("r"),
      broken: "broken line",
      after: ["one", "two", "three", "four", "five"],
    },
  },
} as unknown as GwPack;

const ctx = (ruler: GwSeatView["ruler"]): GwCtx =>
  ({ pack, seat: { ruler } }) as unknown as GwCtx;
const card = (over: Partial<GwCardView>): GwCardView =>
  ({
    uid: 6,
    scene: "a",
    variant: "base",
    node: null,
    options: [{ id: "sign", open: true, tell: [] }],
    ...over,
  }) as GwCardView;
const whole = {
  id: "wilhelm",
  age: 55,
  levels: [0, 1, 2, 1],
  broken: false,
  lines: [],
};

function text(c: GwCtx): string {
  const el = document.createElement("div");
  render(rulerCard(c), el);
  return el.textContent ?? "";
}

describe("the ruler card", () => {
  test("is words for each side, and no side's number", () => {
    const t = text(ctx(whole));
    expect(t).toContain("h low");
    expect(t).toContain("f mid");
    expect(t).toContain("c good");
    expect(t.replace("55", "")).not.toMatch(/\d/);
  });

  test("conscience that gave out has its own line", () => {
    const t = text(ctx({ ...whole, broken: true }));
    expect(t).toContain("broken line");
    expect(t).not.toContain("c good");
  });

  test("with no row there is no card", () => {
    expect(rulerCard(ctx(null))).toBe(rulerCard(ctx(undefined)));
    const el = document.createElement("div");
    render(rulerCard(ctx(null)), el);
    expect(el.textContent).toBe("");
  });
});

describe("how a broken conscience reads", () => {
  test("a body of its own has its own option wording", () => {
    expect(optionText(pack, card({ variant: "conscience" }), "sign")).toBe(
      "cold.",
    );
    expect(optionText(pack, card({}), "sign")).toBe("plain. line");
  });

  test("a talk's reply shows no bold marks either", () => {
    expect(optionText(pack, card({ node: "n1" }), "go")).toBe("Go. now");
  });

  test("any other decision ends on a line, the same one each draw", () => {
    const c = ctx({ ...whole, broken: true });
    expect(brokenLine(c, card({}))).toBe("two");
    expect(brokenLine(c, card({}))).toBe("two");
  });

  test("not before it broke, not on its own body, not on a paper to read", () => {
    expect(brokenLine(ctx(whole), card({}))).toBeNull();
    const c = ctx({ ...whole, broken: true });
    expect(brokenLine(c, card({ variant: "conscience" }))).toBeNull();
    expect(brokenLine(c, card({ options: [] }))).toBeNull();
  });
});
