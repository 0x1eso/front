// World War 1936 P5 (lane U3): the exile band leaves out "retake the
// capital" when there is no capital, in English and Korean.
import { describe, expect, it, vi } from "vitest";

const LINES: Record<string, string> = {
  en: "Government in exile — {host} · legitimacy {pct}% · virtual factories {n} · retake the capital: {capital}",
  ko: "망명 정부 — {host} · 정통성 {pct}% · 가상 공장 {n} · 수도 되찾기: {capital}",
};
let lang = "en";
vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, p: Record<string, string | number> = {}) =>
    key === "ww1936.exile.band"
      ? LINES[lang].replace(/\{(\w+)\}/g, (_, k) => String(p[k]))
      : key,
}));

import { exileBandModel } from "../../../src/client/hud/ww1936/WwExileBand";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";

function game(capital: number) {
  const eg = new WwEndgameView();
  eg.apply({
    news: [],
    exiles: [
      {
        smallID: 5,
        host: 3,
        legitBp: 5400,
        deltaBp: 12,
        virtualMil: 5,
        capital,
      },
    ],
  } as never);
  return {
    myPlayer: () => ({ smallID: () => 5 }),
    wwEndgame: () => eg,
    worldWarScenario: () => ({
      tagOfSmallId: () => "GBR",
      capitalTileOrNull: () => null,
      regionAt: () => 0,
      regions: [],
    }),
  } as never;
}

describe("exile band without a capital", () => {
  it("drops the retake segment in both languages", () => {
    for (const l of ["en", "ko"]) {
      lang = l;
      const t = exileBandModel(game(0))!.text;
      expect(t).not.toMatch(/—$|: *$|undefined/);
      expect(t.includes("\u0000")).toBe(false);
      expect(t).toMatch(/54%/);
      expect(t).not.toMatch(/retake|되찾기/);
    }
  });
});
