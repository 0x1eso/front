// World War 1936 P2 Task 10: the generals roster (spec §6.2) and the 1936
// order of battle of the majors (spec §6.4), checked against the shipped
// world1936 scenario and both translation files.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import {
  COUNTRIES,
  CountryTag,
  MAJOR_TAGS,
} from "@openfront/engine-api/ww1936/Countries";
import {
  GENERAL_TRAITS,
  WW_MAX_ARMY_DIVISIONS,
  WW_TITLED_GENERAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { ScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  GENERALS,
  rosterOf,
  titledGeneralId,
} from "@openfront/engine-lib/ww1936/Generals";
import {
  START_OOB,
  startTemplates,
} from "@openfront/engine-lib/ww1936/LandStart";
import { NO_STRIKE_REGION_IDS } from "@openfront/engine-lib/ww1936/NoStrike";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { appointGeneral } from "@openfront/engine/ww1936/land/GeneralsRun";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { byTag, land, wwGameStart } from "./util";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as Record<
    string,
    unknown
  >;
const scenario = readJson(
  "resources/maps/world1936/scenario.json",
) as unknown as ScenarioData;
const en = readJson("resources/lang/en.json") as {
  ww1936: { general: Record<string, string> };
};
const ko = readJson("resources/lang/ko.json") as {
  ww1936: { general: Record<string, string> };
};

/** Spec §6.2: the minors that get a short roster (2–5 each). */
const MINOR_ROSTERS: readonly CountryTag[] = [
  "POL",
  "FIN",
  "CHN",
  "CCP",
  "ESN",
  "ESR",
  "ROU",
  "YUG",
  "GRC",
  "TUR",
  "HUN",
];

/**
 * People this task left out by the roster principle (spec §6.2 and the
 * mode's sensitivity rulings); the Task 10 report gives each reason. Some
 * are in the spec's own table (Manstein, Leeb, Badoglio, Graziani and all
 * five Japanese): the principle wins.
 */
const EXCLUDED: readonly string[] = [
  // Germany: IMT, the later Nuremberg trials, other war-crimes courts.
  "Erich von Manstein",
  "Wilhelm Ritter von Leeb",
  "Ewald von Kleist",
  "Wilhelm List",
  "Georg von Küchler",
  "Hermann Hoth",
  "Georg-Hans Reinhardt",
  "Hans von Salmuth",
  "Karl-Adolf Hollidt",
  "Hubert Lanz",
  "Lothar Rendulic",
  "Wilhelm Keitel",
  "Alfred Jodl",
  "Albert Kesselring",
  "Ferdinand Schörner",
  "Kurt Student",
  "Nikolaus von Falkenhorst",
  "Eberhard von Mackensen",
  "Hasso von Manteuffel",
  "Hermann Balck",
  // Germany, in doubt (died or severed before a verdict; crimes investigated).
  "Johannes Blaskowitz",
  "Maximilian von Weichs",
  "Eduard Dietl",
  // Japan: Korea or Taiwan, or convicted at any war-crimes trial.
  "Minami Jirō",
  "Koiso Kuniaki",
  "Ugaki Kazushige",
  "Ueda Kenkichi",
  "Nakamura Kōtarō",
  "Itagaki Seishirō",
  "Andō Rikichi",
  "Terauchi Hisaichi",
  "Tōjō Hideki",
  "Umezu Yoshijirō",
  "Hata Shunroku",
  "Matsui Iwane",
  "Kimura Heitarō",
  "Mutō Akira",
  "Doihara Kenji",
  "Araki Sadao",
  "Yamashita Tomoyuki",
  "Homma Masaharu",
  "Imamura Hitoshi",
  "Adachi Hatazō",
  "Sakai Takashi",
  "Yamada Otozō",
  // Japan, in doubt: the Kempeitai's commandant, an acquittal, Korea and
  // Nanjing commands.
  "Tanaka Shizuichi",
  "Okamura Yasuji",
  "Hyakutake Harukichi",
  "Satō Kōtoku",
  "Ushijima Mitsuru",
  // Japan shows titles only (controller ruling from P5): the five who
  // passed the Korea/Taiwan/trial test are out as well.
  "Kuribayashi Tadamichi",
  "Anami Korechika",
  "Nishio Toshizō",
  "Kawabe Masakazu",
  "Higuchi Kiichirō",
  // Italy: poison gas and massacres in Ethiopia and Libya, never tried.
  "Pietro Badoglio",
  "Rodolfo Graziani",
  // Italy, in doubt (occupation and colonial crimes alleged, never tried).
  "Mario Roatta",
  "Alessandro Pirzio Biroli",
  "Vittorio Ambrosio",
  "Mario Robotti",
  "Gastone Gambara",
  // Others: war-crimes or collaboration convictions.
  "Ion Antonescu",
  "Nicolae Macici",
  "Nicolae Ciupercă",
  "Gusztáv Jány",
  "Ferenc Szombathelyi",
  "Jenő Rátz",
  "Károly Beregfy",
  "Georgios Tsolakoglou",
  "Charalambos Katsimitros",
  "Milan Nedić",
  "Draža Mihailović",
  "Henri Dentz",
  "Philippe Pétain",
  // Spain: the 1936 terror (Mola's orders), the Badajoz and Seville
  // killings. China: the Chinese commander in the Korean War (the friends
  // are Korean, spec mode §1.4).
  "Emilio Mola",
  "Juan Yagüe",
  "Gonzalo Queipo de Llano",
  "Peng Dehuai",
];

/** Spec §6.4: divisions per template key. */
const OOB_TOTALS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  DEU: { infantry: 36, armored: 3, mountain: 3, cavalry: 1 },
  ITA: { binary: 60, alpini: 6, celere: 2, colonial: 12 },
  JPN: { square: 17, cavalry_brigade: 4, garrison: 4 },
  GBR: { infantry: 12, mobile: 1, colonial_garrison: 8 },
  FRA: { infantry: 40, dlm: 2, colonial: 25, cavalry: 4 },
  USA: { square: 9, cavalry: 2, garrison: 6 },
  SUN: { rifle: 100, cavalry: 20, tank_brigade: 10, mountain_rifle: 4 },
};
/** Spec §6.4: armies per major. */
const OOB_ARMIES: Readonly<Record<string, number>> = {
  DEU: 3,
  ITA: 5,
  JPN: 4,
  GBR: 4,
  FRA: 6,
  USA: 3,
  SUN: 7,
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
const isIso = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const sumOf = (tag: string) => {
  const out: Record<string, number> = {};
  for (const a of START_OOB[tag as CountryTag] ?? []) {
    for (const [key, n] of a.divisions) out[key] = (out[key] ?? 0) + n;
  }
  return out;
};
const generalId = (key: string) => GENERALS.findIndex((g) => g.id === key) + 1;

describe("the generals roster (spec §6.2)", () => {
  test("ids, countries, skills, traits and dates are well formed", () => {
    const ids = GENERALS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tags = new Set(scenario.countries.map((c) => c.tag));
    for (const g of GENERALS) {
      expect(g.id, g.id).toMatch(/^[a-z][a-z_]*$/);
      expect(tags.has(g.tag), `${g.id}: ${g.tag}`).toBe(true);
      for (const v of [g.att, g.def, g.plan, g.log]) {
        expect(Number.isInteger(v) && v >= 0 && v <= 5, g.id).toBe(true);
      }
      expect(g.traits.length, g.id).toBeLessThanOrEqual(3);
      expect(new Set(g.traits).size, g.id).toBe(g.traits.length);
      for (const t of g.traits) expect(GENERAL_TRAITS).toContain(t);
      expect(g.source.length, g.id).toBeGreaterThan(10);
      const dates = [
        ...(g.from === undefined ? [] : [g.from]),
        ...(g.until === undefined ? [] : [g.until]),
        ...(g.gaps ?? []).flat(),
      ];
      for (const d of dates) expect(isIso(d), `${g.id}: ${d}`).toBe(true);
      if (g.from !== undefined) expect(g.from > "1936-01-01", g.id).toBe(true);
      if (g.from !== undefined && g.until !== undefined) {
        expect(g.from < g.until, g.id).toBe(true);
      }
      for (const [a, b] of g.gaps ?? []) expect(a < b, g.id).toBe(true);
    }
  });

  test("the seed rows stay first: their index is their id", () => {
    expect(GENERALS[0]).toMatchObject({
      id: "rundstedt",
      tag: "DEU",
      att: 4,
      def: 4,
      plan: 3,
      log: 3,
      traits: [],
    });
    expect(GENERALS[1]).toMatchObject({
      id: "bock",
      tag: "DEU",
      att: 4,
      def: 3,
      plan: 3,
      log: 3,
      traits: [],
    });
  });

  test("Japan has no named general; other majors at most 15, the listed minors 2–5, nobody else any", () => {
    const counts = new Map<CountryTag, number>();
    for (const g of GENERALS) counts.set(g.tag, (counts.get(g.tag) ?? 0) + 1);
    // Titles only for Japan (controller ruling); titled generals fill any
    // other major's shortfall, so there is no floor (Italy has 10).
    expect(counts.get("JPN") ?? 0).toBe(0);
    for (const tag of MAJOR_TAGS) {
      if (tag === "JPN") continue;
      const n = counts.get(tag) ?? 0;
      expect(n >= 1 && n <= 15, `${tag}: ${n}`).toBe(true);
    }
    for (const tag of MINOR_ROSTERS) {
      const n = counts.get(tag) ?? 0;
      expect(n >= 2 && n <= 5, `${tag}: ${n}`).toBe(true);
    }
    for (const tag of counts.keys()) {
      expect(MAJOR_TAGS.includes(tag) || MINOR_ROSTERS.includes(tag), tag).toBe(
        true,
      );
    }
  });

  test("the spec's dated people keep their dates, checked against the sources", () => {
    const def = (id: string) => GENERALS.find((g) => g.id === id)!;
    // The purged generals carry no dates (P3 decision 19, pre-flight R20):
    // the Soviet purge events remove them, and give Rokossovsky back on
    // 1940-03-22.
    for (const id of [
      "tukhachevsky",
      "yakir",
      "uborevich",
      "blyukher",
      "rokossovsky",
    ]) {
      expect([def(id).until, def(id).gaps], id).toEqual([undefined, undefined]);
    }
    // Spec "1939-"/"1940-"/"1941-", as the sources date them.
    expect(def("rommel").from).toBe("1939-08-01");
    expect(def("model").from).toBe("1938-03-01");
    expect(def("patton").from).toBe("1940-10-02");
    expect(def("de_gaulle").from).toBe("1940-06-01");
    expect(def("bradley").from).toBe("1941-02-20");
    expect(def("eisenhower").from).toBe("1941-09-29");
  });

  test("nobody the principle left out is in the roster", () => {
    const names = new Set(
      GENERALS.map((g) => norm(en.ww1936.general[g.id] ?? "")),
    );
    const ids = new Set(GENERALS.map((g) => g.id));
    for (const name of EXCLUDED) {
      expect(names.has(norm(name)), name).toBe(false);
    }
    // The spec table's people who fail the principle, by id too.
    for (const id of [
      "manstein",
      "leeb",
      "badoglio",
      "graziani",
      "kuribayashi",
      "anami",
      "tanaka",
      "nishio",
      "kawabe",
      "higuchi",
      "mola",
    ]) {
      expect(ids.has(id), id).toBe(false);
    }
  });

  test("every general has an English and a Korean name, different, and nothing else is there", () => {
    for (const g of GENERALS) {
      const e = en.ww1936.general[g.id];
      const k = ko.ww1936.general[g.id];
      expect(e, g.id).toBeTruthy();
      expect(k, g.id).toBeTruthy();
      expect(e, g.id).not.toBe(k);
    }
    const ids = GENERALS.map((g) => g.id).sort();
    expect(Object.keys(en.ww1936.general).sort()).toEqual(ids);
    expect(Object.keys(ko.ww1936.general).sort()).toEqual(ids);
  });

  test("the people P3 and P5 already name carry the same ids and names", () => {
    const names: [string, string, string][] = [
      // P3 persons' alsoGeneral (branches w3-k2..k4).
      ["guderian", "Heinz Guderian", "하인츠 구데리안"],
      ["gort", "Lord Gort", "고트 경"],
      ["brooke", "Alan Brooke", "앨런 브룩"],
      ["tukhachevsky", "Mikhail Tukhachevsky", "미하일 투하쳅스키"],
      ["timoshenko", "Semyon Timoshenko", "세묜 티모셴코"],
      ["meretskov", "Kirill Meretskov", "키릴 메레츠코프"],
      // P5 France's alsoGeneral and add_general (branch w5-k3).
      ["gamelin", "Maurice Gamelin", "모리스 가믈랭"],
      ["de_gaulle", "Charles de Gaulle", "샤를 드골"],
      // The brief's examples.
      ["rundstedt", "Gerd von Rundstedt", "게르트 폰 룬트슈테트"],
      ["zhukov", "Georgy Zhukov", "게오르기 주코프"],
    ];
    for (const [id, e, k] of names) {
      expect(en.ww1936.general[id], id).toBe(e);
      expect(ko.ww1936.general[id], id).toBe(k);
    }
    // P3's Soviet purge events remove these by id (branch w3-k4).
    for (const id of [
      "tukhachevsky",
      "yakir",
      "uborevich",
      "rokossovsky",
      "blyukher",
    ]) {
      expect(generalId(id), id).toBeGreaterThan(0);
    }
  });
});

describe("the 1936 order of battle (spec §6.4)", () => {
  const index = new Map(scenario.regions.map((r) => [r.id, r]));
  const faction = (tag: CountryTag) => COUNTRIES[tag].faction;

  test("only the seven majors, each with the spec's armies and divisions", () => {
    expect(Object.keys(START_OOB).sort()).toEqual([...MAJOR_TAGS].sort());
    for (const tag of MAJOR_TAGS) {
      expect(sumOf(tag), tag).toEqual(OOB_TOTALS[tag]);
      expect(START_OOB[tag]!.length, tag).toBe(OOB_ARMIES[tag]);
      const keys = startTemplates(tag, 3).map((t) => t.key);
      for (const a of START_OOB[tag]!) {
        const n = a.divisions.reduce((m, [, k]) => m + k, 0);
        expect(n >= 1 && n <= WW_MAX_ARMY_DIVISIONS, `${tag}: ${n}`).toBe(true);
        for (const [key, k] of a.divisions) {
          expect(keys, tag).toContain(key);
          expect(k, tag).toBeGreaterThan(0);
        }
      }
    }
  });

  test("each army's first region is the country's own in 1936 (or a camp mate's), all ids are today's", () => {
    for (const tag of MAJOR_TAGS) {
      for (const a of START_OOB[tag]!) {
        expect(a.regions.length, tag).toBeGreaterThan(0);
        for (const id of [...a.regions, ...(a.planTargets ?? [])]) {
          // Task 2 keeps 1..1342; new regions come after.
          expect(id >= 1 && id <= 1342 && index.has(id), `${tag}: ${id}`).toBe(
            true,
          );
        }
        const owner = index.get(a.regions[0])!.owner;
        expect(
          owner === tag ||
            (faction(tag) !== null && faction(owner) === faction(tag)),
          `${tag}: ${a.regions[0]} is ${owner}'s`,
        ).toBe(true);
        // LandStartRun stands an army in the first region its country holds.
        expect(
          a.regions.some((r) => index.get(r)!.owner === tag),
          `${tag}: ${a.regions.join(",")}`,
        ).toBe(true);
      }
    }
  });

  test("no army of any country starts in Korea or Taiwan (controller ruling on review B M5)", () => {
    for (const tag of MAJOR_TAGS) {
      for (const a of START_OOB[tag]!) {
        for (const r of a.regions) {
          expect(NO_STRIKE_REGION_IDS, `${tag}: ${r}`).not.toContain(r);
        }
      }
    }
  });

  test("only Japan's Kwantung and home armies start under titled generals", () => {
    for (const tag of MAJOR_TAGS) {
      const marked = START_OOB[tag]!.map((a) => a.titledGeneral === true);
      expect(marked, tag).toEqual(
        tag === "JPN"
          ? [true, true, false, false]
          : START_OOB[tag]!.map(() => false),
      );
    }
    expect(START_OOB.JPN!.map((a) => index.get(a.regions[0])!.name)).toEqual([
      "Kwantung",
      "Tokyo",
      "Kwantung",
      "Kumamoto",
    ]);
  });

  test("only Italy starts with an operation: two armies on Addis Ababa", () => {
    const addis = scenario.regions.find((r) => r.name === "Addis Ababa")!;
    expect(addis.owner).toBe("ETH");
    for (const tag of MAJOR_TAGS) {
      const planned = START_OOB[tag]!.filter(
        (a) => a.planTargets !== undefined,
      );
      if (tag !== "ITA") {
        expect(planned, tag).toEqual([]);
        continue;
      }
      expect(planned.map((a) => a.planTargets)).toEqual([
        [addis.id],
        [addis.id],
      ]);
      // Eritrea and Italian Somaliland, Ethiopia's neighbours.
      expect(planned.map((a) => index.get(a.regions[0])!.name)).toEqual([
        "Eritrea",
        "Italian Somaliland",
      ]);
    }
  });
});

let worldFilesMemo: Promise<MapFiles> | null = null;
function worldFiles(): Promise<MapFiles> {
  return (worldFilesMemo ??= loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  ));
}

/** An all-AI World War game on world1936 with `files` (no turn run). */
async function worldRunner(files: MapFiles) {
  return createGameRunner(wwGameStart(), undefined, files, (gu) => {
    if ("errMsg" in gu) throw new Error(gu.errMsg);
  });
}

/** Spec §6.4 on a fielded board: the counts, places, plans and generals. */
function expectHistoricalOob(runner: Awaited<ReturnType<typeof worldRunner>>) {
  const g = runner.game;
  const l = land(g);
  const sc = g.worldWar()!.scenario;
  const of = (tag: CountryTag) => {
    const id = byTag(g, tag).smallID();
    return {
      id,
      divisions: l.countrySummary(l.country(id)!).divisions,
      armies: l.armiesOf(id),
    };
  };
  const deu = of("DEU");
  expect(deu.divisions).toBe(43);
  expect(deu.armies).toHaveLength(3);
  const ita = of("ITA");
  expect(ita.divisions).toBe(80);
  expect(ita.armies).toHaveLength(5);
  for (const tag of MAJOR_TAGS) {
    const c = of(tag);
    const want = Object.values(OOB_TOTALS[tag]).reduce((a, b) => a + b, 0);
    expect(c.divisions, tag).toBe(want);
    expect(c.armies.length, tag).toBe(OOB_ARMIES[tag]);
    // Each army stands in the first of its regions the country holds.
    START_OOB[tag]!.forEach((o, i) => {
      const at = o.regions.find((r) => sc.ownerByRegion()[r] === c.id)!;
      expect(l.armyRegion(c.armies[i]), `${tag} army ${i + 1}`).toBe(at);
    });
  }
  // Italy's two Ethiopian armies run their operation on Addis Ababa.
  const addis = sc.landRegions.find((r) => r.name === "Addis Ababa")!.id;
  expect(
    ita.armies.map((a) => (a.order.kind === "plan" ? a.order.targets : null)),
  ).toEqual([[addis], [addis], null, null, null]);
  // The roster by skill to the armies in order (spec §6.4), serving ones only.
  expect(deu.armies.map((a) => a.general)).toEqual([
    generalId("rundstedt"),
    generalId("bock"),
    generalId("kluge"),
  ]);
  // Japan (titles only): the Kwantung Army and the home islands start under
  // titled generals No. 1 and 2, the two garrisons moved out of Korea and
  // Taiwan under none.
  const jpn = of("JPN");
  expect(jpn.armies.map((a) => a.general)).toEqual([
    titledGeneralId(jpn.id, 1),
    titledGeneralId(jpn.id, 2),
    0,
    0,
  ]);
  const jgen = l.country(jpn.id)!.generals;
  expect(jgen.every((x) => x.roster === -1)).toBe(true);
  expect(
    jgen.map((x) => [x.titleNo, x.att, x.dfn, x.plan, x.log, x.traits, x.army]),
  ).toEqual([
    [1, 1, 1, 1, 1, 0, jpn.armies[0].id],
    [2, 1, 1, 1, 1, 0, jpn.armies[1].id],
  ]);
  expect(l.country(jpn.id)!.nextTitleNo).toBe(3);
  // A titled general appointed later (spec §6.2) takes the next number
  // from the same counter: no id collides with the two from the start.
  const jcl = l.country(jpn.id)!;
  jcl.armyXpMilli = WW_TITLED_GENERAL_XP_MILLI;
  expect(appointGeneral(l, jcl)).toBeNull();
  expect(jgen.map((x) => [x.id, x.titleNo])).toEqual([
    [titledGeneralId(jpn.id, 1), 1],
    [titledGeneralId(jpn.id, 2), 2],
    [titledGeneralId(jpn.id, 3), 3],
  ]);
  expect(jgen[2]).toMatchObject({ roster: -1, att: 1, traits: 0, army: 0 });
  expect(rosterOf("SUN")[0]).toBe(generalId("zhukov"));
}

describe("the order of battle on the real map", () => {
  test("the shipped world1936 scenario fields Germany's 43 divisions in 3 armies and Italy's 80", async () => {
    // Task 2's v3 map ships the flag (pre-flight G-a).
    expect(scenario.historicalOob).toBe(true);
    const runner = await worldRunner(await worldFiles());
    expectHistoricalOob(runner);
    // Controller ruling on review B M5: no country's start division stands
    // in Korea or Taiwan.
    const l = land(runner.game);
    const sc = runner.game.worldWar()!.scenario;
    let rows = 0;
    for (const tag of sc.scenarioTags()) {
      const id = sc.smallIdOf(tag);
      for (const r of l.rowsOf(id)) {
        rows++;
        expect(NO_STRIKE_REGION_IDS, `${tag}`).not.toContain(
          l.divisions.region[r],
        );
      }
    }
    expect(rows).toBeGreaterThan(500);
  }, 120_000);

  test("the shipped ids still name the regions the table means", () => {
    // Fails if a map rebuild renumbers a region START_OOB uses.
    const sc = new Map(scenario.regions.map((r) => [r.id, r.name]));
    expect(
      [335, 356, 306, 980, 1039, 809, 494, 576, 666, 758, 800].map((id) =>
        sc.get(id),
      ),
    ).toEqual([
      "Lower Silesia",
      "Rheinland-Pfalz",
      "Berlin",
      "Eritrea",
      "Italian Somaliland",
      "Tripolitania",
      "Turin",
      "Roma",
      "Kwantung",
      "Tokyo",
      "Kumamoto",
    ]);
    expect(
      [329, 767, 1087, 1104, 390, 353, 497, 733, 729, 918].map((id) =>
        sc.get(id),
      ),
    ).toEqual([
      "London",
      "Cairo",
      "Malaya",
      "Nairobi",
      "Moselle",
      "Pas-de-Calais",
      "Savoie",
      "Alger",
      "Aleppo",
      "Ha Noi",
    ]);
    expect(
      [749, 945, 930, 163, 277, 344, 429, 601, 570, 251].map((id) =>
        sc.get(id),
      ),
    ).toEqual([
      "Texas",
      "Philippines",
      "Hawaii",
      "Leningrad",
      "City of Minsk",
      "Kiev City",
      "Odessa",
      "Tbilisi",
      "Tashkent",
      "Khabarovsk (S)",
    ]);
  });
});
