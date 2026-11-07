import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import { GwTablePackSchema } from "@openfront/engine-api/ww1914/GwPack";
import {
  GW_TABLE_LINES,
  type GwTableView,
} from "@openfront/engine-api/ww1914/GwTable";
import { GW_TABLE_AIMS } from "@openfront/engine-lib/ww1914/TableRows";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import {
  aideMoment,
  envoyName,
  landsOf,
  lineText,
  paintCells,
  placeOfRegion,
  tableCells,
  toggleLand,
  togglePlace,
} from "../../../src/client/hud/ww1914/GwTableModel";

const res = (f: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../../resources", f), "utf8"),
  );
const common = res("ww1914/ko/common.table.json");
const NATIONS = ["DEU", "GBR", "AUH", "RUS"];
const MOMENTS = [
  "open",
  "turn",
  "asked",
  "pressed",
  "their_offer",
  "refused",
  "countered",
  "over",
];

const view = (over: Partial<GwTableView> = {}): GwTableView => ({
  session: 0,
  sessions: 3,
  closed: false,
  done: false,
  role: "lost",
  order: ["FRA", "DEU"],
  losers: ["DEU"],
  speaker: "FRA",
  claims: [],
  lines: [],
  bill: {},
  over: 0,
  held: 0,
  due: null,
  ...over,
});

const claim = {
  id: 0,
  place: "metz" as const,
  by: "FRA" as const,
  against: "DEU" as const,
  session: 0,
  state: "open" as const,
  step: "asked" as const,
  offer: null,
  offerBy: null,
};

describe("painting", () => {
  test("a tap toggles a place, a land goes on and off whole", () => {
    expect(togglePlace([], "metz")).toEqual(["metz"]);
    expect(togglePlace(["metz"], "metz")).toEqual([]);
    const on = toggleLand(["metz"], "alsace_lorraine", "FRA");
    expect(on).toHaveLength(3);
    expect(toggleLand(on, "alsace_lorraine", "FRA")).toEqual([]);
  });

  test("the seat's own land isn't paintable, and regions come back as places", () => {
    const cells = paintCells("FRA", ["metz"]);
    expect(cells.some((c) => c.region === GW_PLACES.verdun.id)).toBe(false);
    const metz = cells.find((c) => c.region === GW_PLACES.metz.id)!;
    const free = cells.find((c) => c.region === GW_PLACES.berlin.id)!;
    expect(metz.level).toBeGreaterThan(free.level);
    expect(placeOfRegion(GW_PLACES.metz.id)).toBe("metz");
    expect(placeOfRegion(1)).toBeNull();
    expect(landsOf("FRA")).not.toContain("france");
  });

  test("the table paints what is on it over what was wanted", () => {
    const t = view({ claims: [claim] });
    const cells = tableCells(t, ["metz", "riga"], null);
    expect(cells).toHaveLength(2);
    const metz = cells.find((c) => c.region === GW_PLACES.metz.id)!;
    expect(metz.flags).not.toBe(0);
  });
});

describe("what is said", () => {
  const pack = { table: { envoys: common.table.envoys, on: common.table.on } };

  test("a man's line about a known land wins over his plain one", () => {
    const t = view({ claims: [claim] });
    const line = { n: 0, word: "claim", who: "FRA", claim: 0 } as const;
    const text = lineText(pack as never, t, line);
    expect(text).toContain("메스");
    expect(text).toContain("1871");
  });

  test("a month's opening is that month's, and the last close is the last", () => {
    const open = { n: 7, word: "open", who: "FRA", claim: -1 } as const;
    const second = lineText(pack as never, view({ session: 1 }), open);
    expect(second).toContain("둘째 달");
    const close = { n: 9, word: "close", who: "FRA", claim: -1 } as const;
    const ends = lineText(pack as never, view({ session: 2 }), close);
    expect(ends).toBe(common.table.envoys.FRA.lines.close_last[0]);
  });

  test("a small country uses the common row, with its own name", () => {
    const t = view({ claims: [{ ...claim, by: "ROU", place: "temesvar" }] });
    const line = { n: 0, word: "claim", who: "ROU", claim: 0 } as const;
    expect(lineText(pack as never, t, line)).toMatch(/테메슈바르/);
  });

  test("a beaten country sends another man, whoever is watching", () => {
    const seat = { tag: "GBR", people: [] } as never;
    const beaten = view({ role: "won", losers: ["DEU"] });
    expect(envoyName(pack as never, "DEU", beaten, seat)).toBe(
      "브로크도르프란차우",
    );
    const won = view({ role: "lost", losers: ["FRA"] });
    expect(envoyName(pack as never, "DEU", won, seat)).toBe("퀼만");
  });

  test("the seat's own words come from its foreign minister", () => {
    const seat = {
      tag: "GBR",
      people: [{ id: "grey", office: "foreign" }],
    } as never;
    const named = { ...pack, people: { grey: { name: "그레이" } } };
    expect(envoyName(named as never, "GBR", view(), seat)).toBe("그레이");
  });

  test("every line kind has words, and none leaves a hole unfilled", () => {
    const kinds = GW_TABLE_LINES.filter((k) => k !== "open");
    const holes = /\{(?!place|by|against|trade|country)[^}]*\}/;
    for (const [who, row] of Object.entries(common.table.envoys) as [
      string,
      { lines: Record<string, string[]> },
    ][]) {
      for (const k of kinds) {
        expect(row.lines[k]?.length, `${who}.${k}`).toBeGreaterThan(0);
      }
      for (const list of Object.values(row.lines)) {
        for (const l of list) expect(holes.test(l), l).toBe(false);
      }
    }
    GwTablePackSchema.parse(common.table);
  });

  test("each of the four nations has its people, its opening and its end", () => {
    for (const tag of NATIONS) {
      const t = res(`ww1914/ko/${tag}.table.json`).table;
      GwTablePackSchema.parse(t);
      for (const m of MOMENTS) {
        expect(Object.keys(t.aides[m] ?? {}).length, `${tag}.${m}`).toBeGreaterThan(0);
      }
      for (const role of ["won", "lost", "even", "watch"]) {
        expect(t.open[role], `${tag}.${role}`).toBeDefined();
        expect(t.close[role], `${tag}.${role}`).toBeDefined();
        expect(t.memoir[role], `${tag}.${role}`).toBeDefined();
      }
      expect(t.memoir.over).toBeDefined();
      expect(t.memoir.held).toBeDefined();
    }
  });

  test("the moment beside the seat follows what is due", () => {
    const asked = view({
      claims: [claim],
      due: { kind: "word", claim: 0, words: ["yes", "no"], trades: [] },
    });
    expect(aideMoment(asked)).toBe("asked");
    const turn = view({ due: { kind: "turn", left: 2, places: ["metz"] } });
    expect(aideMoment(turn)).toBe("turn");
    expect(aideMoment(view())).toBeNull();
  });
});

describe("what countries came for", () => {
  test("every land on the map has a name to paint it by", () => {
    const names = res("lang/ko.json").gw.land;
    for (const p of Object.values(GW_PLACES)) {
      expect(names[p.group], p.group).toBeDefined();
    }
  });

  test("nobody asks for its own land", () => {
    for (const [tag, list] of Object.entries(GW_TABLE_AIMS)) {
      for (const p of list) expect(GW_PLACES[p].owner, p).not.toBe(tag);
    }
  });
});
