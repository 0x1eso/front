// ww199: a beaten country's fate on the screens: the chips, the inks, the names.
import { gwCountry } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwSeatView } from "@openfront/engine-api/ww1914/GwView";
import fs from "fs";
import path from "path";
import { describe, expect, test, vi } from "vitest";

const EN = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../resources/lang/en.json"),
    "utf8",
  ),
);
const flat = (d: Record<string, unknown>, pre = "", out = new Map()) => {
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "string") out.set(pre + k, v);
    else flat(v as Record<string, unknown>, `${pre}${k}.`, out);
  }
  return out as Map<string, string>;
};
const TEXT = flat(EN);

vi.mock("../../../src/client/Utils", () => ({
  translateText: (key: string, p: Record<string, string> = {}) => {
    const s = TEXT.get(key);
    return s === undefined ? key : s.replace(/\{(\w+)\}/g, (m, k) => p[k] ?? m);
  },
}));

const { choicesFor, gwName, markWord, nextDetail, nextFate, setGwRealms } =
  await import("../../../src/client/hud/ww1914/GwFateModel");
const { paintCells } =
  await import("../../../src/client/hud/ww1914/GwTableModel");

const seat = {
  tag: "DEU",
  world: {
    side: "central",
    countries: [
      { tag: "DEU", side: "central", out: false, mob: 2 },
      { tag: "AUH", side: "central", out: false, mob: 2 },
      { tag: "RUS", side: "entente", out: false, mob: 2 },
    ],
  },
} as unknown as GwSeatView;

describe("fate chips", () => {
  test("a state only where one can be made; the chip cycles round to nothing", () => {
    const warsaw = choicesFor(seat, ["warsaw"]);
    expect(warsaw.fates).toContain("state");
    expect(warsaw.states).toEqual(["poland"]);
    expect(warsaw.allies).toEqual(["AUH"]);
    expect(choicesFor(seat, ["paris"]).fates).not.toContain("state");

    let m = nextFate(null, warsaw);
    const seen: string[] = [];
    while (m !== null) {
      seen.push(m.fate);
      m = nextFate(m, warsaw);
    }
    expect(seen).toEqual([
      "annex",
      "occupy",
      "state",
      "ally",
      "return",
      "vassal",
    ]);
    const occ = nextFate({ fate: "annex" }, warsaw)!;
    expect(occ).toEqual({ fate: "occupy", term: "short" });
    expect(nextDetail(occ, warsaw)).toEqual({ fate: "occupy", term: "long" });
    expect(markWord({ fate: "occupy", term: "long" })).toBe("Occupy (long)");
  });

  test("a painted fate inks the map: a state in its own colour", () => {
    const cells = paintCells("DEU", ["warsaw"], {
      warsaw: { fate: "state", client: "poland" },
    });
    const at = cells.find((c) => c.region === GW_PLACES.warsaw.id)!;
    expect(at.rgb).toEqual(gwCountry("POL").color);
  });
});

describe("names by fate", () => {
  test("a vassal is named as its overlord's, a state by its form", () => {
    expect(gwName("FRA")).toBe(EN.gw.country.FRA);
    expect(
      setGwRealms([{ tag: "FRA", vassal: { by: "DEU", of: "FRA" } }]),
    ).toBe(true);
    const own = TEXT.get("gw.vassal.DEU_FRA");
    expect(gwName("FRA")).toBe(
      own ?? `${EN.gw.country.DEU}'s ${EN.gw.country.FRA}`,
    );
    setGwRealms([
      { tag: "POL", client: { id: "poland", form: "kingdom", by: "DEU" } },
    ]);
    expect(gwName("FRA")).toBe(EN.gw.country.FRA);
    expect(gwName("POL")).toBe(
      TEXT.get("gw.client.poland.kingdom") ?? EN.gw.country.POL,
    );
    setGwRealms(undefined);
  });
});
