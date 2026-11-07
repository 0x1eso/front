import {
  GwPack,
  GwPackSchema,
  gwBrief,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { describe, expect, test } from "vitest";
import {
  dictIndex,
  leanTitle,
  newPass,
  splitTerms,
} from "../../../src/client/hud/ww1914/GwDictModel";

const pack = GwPackSchema.parse({
  version: 1,
  scenes: {
    a: {
      title: "가",
      text: { base: "나" },
      brief: { base: "기본 메모", war: "전시 메모" },
    },
    b: { title: "나", text: { base: "다" }, brief: "한 줄" },
    c: { title: "다", text: { base: "라" } },
  },
  people: {
    deu_bethmann: { name: "베트만홀베크", lean: "문민, 온건" },
    deu_moltke: { name: "몰트케", lean: "군부, 서부 우선" },
    auh_conrad: { name: "콘라트", lean: "오스트리아-헝가리 참모총장." },
    gbr_grey: { name: "그레이", lean: "영국 외무대신. 약속하지 않는다." },
  },
  dict: {},
}) as GwPack;

const titleOf = (id: string) =>
  id === "deu_bethmann" ? "수상" : leanTitle(pack.people[id]?.lean ?? "");
const index = dictIndex(pack, "DEU", []);
const run = (text: string, p = newPass()) =>
  splitTerms(text, index, p, titleOf)
    .map((x) => x.text)
    .join("");

describe("brief", () => {
  test("a string, a map by variant with base, and none", () => {
    expect(gwBrief(pack.scenes.a.brief, "war")).toBe("전시 메모");
    expect(gwBrief(pack.scenes.a.brief, "other")).toBe("기본 메모");
    expect(gwBrief(pack.scenes.b.brief, "x")).toBe("한 줄");
    expect(gwBrief(pack.scenes.c.brief, "base")).toBeNull();
  });

  test("a pack merge lays a later brief over the earlier one", () => {
    const over: GwPack = {
      ...pack,
      scenes: {
        a: { title: "가", text: { base: "나" }, brief: { war: "새 메모" } },
      },
    };
    const m = mergeGwPacks([pack, over]);
    expect(gwBrief(m.scenes.a.brief, "war")).toBe("새 메모");
  });
});

describe("names with titles", () => {
  test("the first mention gets a title, the second does not", () => {
    expect(run("베트만홀베크가 왔다. 베트만홀베크는 말했다.")).toBe(
      "수상 베트만홀베크가 왔다. 베트만홀베크는 말했다.",
    );
  });

  test("a lean that is a post is used; a camp is not", () => {
    expect(run("콘라트가 왔다.")).toBe(
      "오스트리아-헝가리 참모총장 콘라트가 왔다.",
    );
    expect(run("몰트케가 왔다.")).toBe("몰트케가 왔다.");
  });

  test("a title the text already has is not doubled", () => {
    expect(run("외무대신 그레이가 왔다.")).toBe("외무대신 그레이가 왔다.");
    expect(run("그레이 외무대신이 왔다.")).toBe("그레이 외무대신이 왔다.");
  });

  test("one pass spans calls, and the introduced person is skipped", () => {
    const p = newPass(["deu_bethmann"]);
    expect(run("베트만홀베크와 콘라트", p)).toBe(
      "베트만홀베크와 오스트리아-헝가리 참모총장 콘라트",
    );
    expect(run("콘라트가 다시 왔다.", p)).toBe("콘라트가 다시 왔다.");
  });
});
