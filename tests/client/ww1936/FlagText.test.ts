// ww235: flag conditions read as Korean phrases, not raw ids.
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

const ko = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../resources/lang/ko.json"),
    "utf8",
  ),
);
const lookup = (key: string): string | undefined => {
  let o: unknown = ko;
  for (const part of key.split(".")) {
    o = (o as Record<string, unknown> | undefined)?.[part];
  }
  return typeof o === "string" ? o : undefined;
};

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  // ko.json with plain {param} substitution; a missing key comes back as is.
  translateText: (key: string, params?: Record<string, string | number>) =>
    (lookup(key) ?? key).replace(/\{(\w+)\}/g, (m, k: string) =>
      params?.[k] !== undefined ? String(params[k]) : m,
    ),
}));

import { lineText } from "../../../src/client/hud/ww1936/PoliticsModel";

const line = (kind: string, params: Record<string, string | number>) =>
  lineText({ key: `ww1936.cond.${kind}`, params, depth: 0, leaf: 0 });

describe("flag conditions (ww235)", () => {
  it("a world flag reads as its phrase", () => {
    expect(line("gflag", { flag: "danubian_federation_formed" })).toBe(
      "도나우 연방이 세워졌다",
    );
  });

  it("a country flag keeps the who prefix and the days", () => {
    expect(
      line("days_since_flag_ge", {
        flag: "gbr_aus_annexed",
        days: 90,
        who: "@self",
      }),
    ).toBe("오스트레일리아를 병합했다 (90일 이상 지남)");
    expect(line("flag", { flag: "csk_will_fight", who: "CSK" })).toMatch(
      /^.+: 홀로라도 싸우기로 했다$/,
    );
  });

  it("a flag without a text yet reads from its id, not snake_case", () => {
    expect(line("flag", { flag: "some_new_flag" })).toBe(
      "표식 「some new flag」",
    );
  });
});
