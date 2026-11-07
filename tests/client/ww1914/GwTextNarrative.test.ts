import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRecentBodies, noteGwRun } from "../../../src/client/GwRecentRuns";
import {
  bodyParts,
  bodyPlain,
  fillGw,
  foldedLines,
  promiseText,
  reasonText,
  shortDate,
  voices,
} from "../../../src/client/hud/ww1914/GwText";

const pack: GwPack = {
  version: 1,
  scenes: {
    s: {
      title: "제목",
      text: { base: "본문" },
      voice: { cos: { deu_moltke: "기본 문단", deu_falkenhayn: "그의 문단" } },
      voiceBy: { cos: { deu_moltke: { scared: "떨리는 문단" } } },
    },
    note: { title: "작은 전보", text: { base: "본문" } },
  },
  people: {
    deu_moltke: { name: "몰트케", lean: "" },
    deu_jagow: { name: "야고", lean: "" },
  },
  reasons: { talk_fit_warm: "{who}은(는) 마음을 열었다." },
  promises: { budget: "{who}에게 예산을 주기로 했다." },
};

const card = (over: Partial<GwCardView> = {}): GwCardView => ({
  uid: 1,
  scene: "s",
  kind: "wire",
  variant: "base",
  cast: { cos: "deu_moltke" },
  stamp: null,
  options: [],
  who: null,
  node: null,
  says: null,
  replies: [],
  ...over,
});

const seat = {
  people: [],
  memory: [
    { key: "snub", who: null, date: "1914-03-02" },
    { key: "snub", who: null, date: "1914-07-05" },
  ],
  choices: [
    { scene: "budget_bill", pick: "no", date: "1914-08-09", proxy: false },
  ],
} as unknown as GwSeatView;

describe("text filling", () => {
  test("a paper quoted in a scene loses its mark and stays apart", () => {
    const text = "서류가 왔다.\n\n> 궁정은 평온합니다.\n\n끝이다.";
    expect(bodyParts(text)).toEqual([
      { quote: false, text: "서류가 왔다." },
      { quote: true, text: "궁정은 평온합니다." },
      { quote: false, text: "끝이다." },
    ]);
    expect(bodyPlain(text)).not.toContain(">");
  });

  test("a callback is the date of the latest memory or decision", () => {
    expect(shortDate("1914-07-05")).toBe("7월 5일");
    const fill = (t: string) => fillGw(t, pack, card(), seat, "1914-09-01");
    expect(fill("{mem.snub}에 폐하께서 반려하신 안입니다.")).toBe(
      "7월 5일에 폐하께서 반려하신 안입니다.",
    );
    expect(fill("{chose.budget_bill}의 일입니다.")).toBe("8월 9일의 일입니다.");
    expect(fill("{cos}이(가) {date}에 왔다.")).toBe("몰트케가 9월 1일에 왔다.");
  });

  test("the voice variant picks the paragraph, the plain one is the fallback", () => {
    expect(voices(pack, card({ voice: { cos: "scared" } }))).toEqual([
      "떨리는 문단",
    ]);
    expect(voices(pack, card())).toEqual(["기본 문단"]);
    expect(
      voices(
        pack,
        card({ cast: { cos: "deu_falkenhayn" }, voice: { cos: "scared" } }),
      ),
    ).toEqual(["그의 문단"]);
  });

  test("a why-line and a promise name the person, with the right josa", () => {
    expect(
      reasonText(pack, { key: "talk_fit_warm", chapter: 1, who: "deu_jagow" }),
    ).toBe("야고는 마음을 열었다.");
    expect(
      promiseText(pack, {
        key: "budget",
        who: "deu_moltke",
        due: "1914-08-09",
        kept: false,
        broken: false,
      }),
    ).toBe("몰트케에게 예산을 주기로 했다.");
  });

  test("a quiet card lists what it folded by title", () => {
    expect(foldedLines(pack, card({ folded: ["note"] }))).toEqual([
      "작은 전보",
    ]);
    expect(foldedLines(pack, card())).toEqual([]);
  });
});

describe("the last two games, between games", () => {
  beforeEach(() => localStorage.clear());

  test("nothing yet: the lobby field stays out", () => {
    expect(gwRecentBodies()).toBeUndefined();
  });

  test("keeps two games; the same game overwrites itself", () => {
    noteGwRun("g1", ["a.base"]);
    noteGwRun("g1", ["a.base", "b.base"]);
    noteGwRun("g2", ["b.base", "c.base"]);
    expect(gwRecentBodies()?.sort()).toEqual(["a.base", "b.base", "c.base"]);
    noteGwRun("g3", ["d.base"]);
    expect(gwRecentBodies()?.sort()).toEqual(["b.base", "c.base", "d.base"]);
  });

  test("an empty update changes nothing; a broken store is no list", () => {
    noteGwRun("g1", ["a.base"]);
    noteGwRun("g2", []);
    expect(gwRecentBodies()).toEqual(["a.base"]);
    localStorage.setItem("gw1914.recentRuns", "not json");
    expect(gwRecentBodies()).toBeUndefined();
  });
});
