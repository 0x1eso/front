// ww194 (Imjin leftovers): what the Imjin screens name their own way: each
// court's factions and heads (Japan's daimyo council, not Joseon's
// factions), the seats, the era's laws, and the investiture order in the
// diplomacy drawer. The tests' translateText gives the key back, so every
// key is checked against en.json and ko.json too.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import {
  blockText,
  lawKindName,
  lawName,
} from "../../src/client/hud/ww1936/EconomyModel";
import { imjinOrderRows } from "../../src/client/hud/ww1936/ImjinOrderModel";
import {
  ideologyName,
  lawLines,
  personName,
  slotName,
} from "../../src/client/hud/ww1936/PoliticsModel";
import {
  setImjinViewer,
  useWwCalendar,
} from "../../src/client/hud/ww1936/WwClientCalendar";

const lang = (l: string) =>
  JSON.parse(readFileSync(`resources/lang/${l}.json`, "utf8")) as Record<
    string,
    unknown
  >;
const EN = lang("en");
const KO = lang("ko");
const has = (key: string) =>
  [EN, KO].every(
    (o) =>
      typeof key
        .split(".")
        .reduce<unknown>(
          (v, k) => (v as Record<string, unknown> | undefined)?.[k],
          o,
        ) === "string",
  );

const imjin = (viewer: CountryTag | null) => {
  useWwCalendar({ ww1936Scenario: "imjin1590" });
  setImjinViewer(viewer);
};

afterEach(() => {
  useWwCalendar({});
  setImjinViewer(null);
});

describe("the Imjin courts' names", () => {
  test("Japan reads its daimyo council, Joseon its factions, each by tag", () => {
    imjin("JPN");
    expect(ideologyName(0)).toBe("imjin.court_of.JPN.democratic");
    expect(ideologyName(2, "JOS")).toBe("imjin.court.fascist");
    expect(ideologyName(3, "MIN")).toBe("imjin.court_of.MIN.neutral");
    expect(personName("title:leader_fascist")).toBe(
      "imjin.court_head_of.JPN.fascist",
    );
    expect(personName("title:leader_neutral", "JOS")).toBe(
      "imjin.court_head.neutral",
    );
    for (const t of ["JPN", "MIN", "JUR"] as const) {
      for (const n of [0, 1, 2, 3]) {
        expect(has(ideologyName(n, t))).toBe(true);
        const id = ["democratic", "communist", "fascist", "neutral"][n];
        expect(has(personName(`title:leader_${id}`, t))).toBe(true);
      }
    }
  });

  test("the seats: the era's chiefs; staff keeps its name; 1936 untouched", () => {
    imjin("JOS");
    expect(slotName("army_chief")).toBe("imjin.slot.JOS.army_chief");
    expect(slotName("navy_chief")).toBe("imjin.slot.JOS.navy_chief");
    expect(slotName("staff")).toBe("ww1936.advisor_slot.staff");
    for (const t of ["JOS", "JPN", "MIN"] as const) {
      setImjinViewer(t);
      for (const s of ["political", "army_chief", "navy_chief"] as const) {
        expect(has(slotName(s))).toBe(true);
      }
    }
    useWwCalendar({});
    expect(slotName("army_chief")).toBe("ww1936.advisor_slot.army_chief");
    expect(ideologyName(0)).toBe("ww1936.ideology.democratic");
  });

  test("the laws read as 공물, 교역 and 군역, with no tension or government line", () => {
    imjin("JOS");
    expect(lawKindName("conscription")).toBe("imjin.law_kind.conscription");
    expect(lawName("closed_economy")).toBe("imjin.law.trade.closed_economy");
    for (const v of [
      "civilian",
      "early_mobilization",
      "partial_mobilization",
      "war_economy",
      "total_mobilization",
      "free_trade",
      "export_focus",
      "limited_exports",
      "closed_economy",
      "disarmed",
      "volunteer",
      "limited",
      "extensive",
      "service",
      "all_adults",
      "scraping",
    ] as const) {
      expect(has(lawName(v))).toBe(true);
    }
    for (const k of ["economy", "trade", "conscription"] as const) {
      expect(has(lawKindName(k))).toBe(true);
      expect(has(`imjin.law_summary.${k}`)).toBe(true);
    }
    const ctx = { wsBp: 6000, wtBp: 0, ruling: 0, atWar: false };
    const keys = (v: "extensive" | "closed_economy") =>
      lawLines(v, ctx).map((l) => l.text);
    expect(keys("extensive")).toEqual(["ww1936.pol.law.need_ws"]);
    expect(keys("closed_economy")).toEqual([]);
    useWwCalendar({});
    expect(keys("extensive")).toContain("ww1936.pol.law.need_tension");
    expect(lawName("volunteer")).toBe("ww1936.law.conscription.volunteer");
  });
});

describe("no world tension and no democracy in the Imjin words", () => {
  test("the tension and government blocks read as the region's and the court's", () => {
    imjin("JOS");
    for (const b of ["tension_gate", "law_tension", "ultimatum_gov"] as const) {
      expect(blockText(b)).toBe(`imjin.block.${b}`);
      expect(has(blockText(b))).toBe(true);
    }
    expect(blockText("no_pp")).toBe("ww1936.econ.block.no_pp");
    for (const k of [
      "imjin.block.declare_no_goal",
      "imjin.declare_no_goal",
      "imjin.line.ws_tension",
      "imjin.line.stab_offensive",
    ]) {
      expect(has(k)).toBe(true);
    }
    useWwCalendar({});
    expect(blockText("tension_gate")).toBe("ww1936.econ.block.tension_gate");
  });
});

describe("the investiture order", () => {
  const TAGS: CountryTag[] = ["JOS", "JPN", "MIN", "JUR"];
  const game = (wars: [number, number][], factions: Record<number, number>) =>
    ({
      ticks: () => 0,
      worldWarScenario: () => ({
        smallIdOf: (t: CountryTag) => TAGS.indexOf(t) + 1,
        tagOfSmallId: (id: number) => TAGS[id - 1],
      }),
      worldWarData: () => ({
        wars: wars.map(([a, b]) => ({ a, b })),
        capitulated: [],
      }),
      wwPolitics: () => ({
        summary: (id: number) => ({ faction: factions[id] ?? -1 }),
      }),
      playerBySmallID: () => ({ isPlayer: () => true, isAlive: () => true }),
    }) as never;

  test("Ming first; Joseon's line follows Ming's army", () => {
    imjin("JOS");
    const peace = imjinOrderRows(game([], {}), 1);
    expect(peace.map((r) => r.tag)).toEqual(["MIN", "JOS", "JPN", "JUR"]);
    expect(peace.every((r) => r.now === null)).toBe(true);
    expect(peace.find((r) => r.mine)?.tag).toBe("JOS");
    for (const r of peace) expect(has(r.standing)).toBe(true);
    const war = imjinOrderRows(game([[2, 1]], {}), 1);
    expect(war.find((r) => r.tag === "JOS")?.now).toBe(
      "imjin.order.now.ming_wait",
    );
    const help = imjinOrderRows(
      game(
        [
          [2, 1],
          [2, 3],
        ],
        { 1: 0, 3: 0 },
      ),
      1,
    );
    expect(help.find((r) => r.tag === "JOS")?.now).toBe(
      "imjin.order.now.ming_help",
    );
    expect(help.find((r) => r.tag === "MIN")?.now).toBe(
      "imjin.order.now.ming_war",
    );
    for (const k of ["ming_help", "ming_wait", "ming_war"]) {
      expect(has(`imjin.order.now.${k}`)).toBe(true);
    }
    for (const k of ["tab", "title", "intro"]) {
      expect(has(`imjin.order.${k}`)).toBe(true);
    }
  });
});
