/**
 * ww7 lane A: fits CombatRules.WIN_PCT_AT, the attacker's chance to win at a
 * predicted org-removal ratio (design ww6 §2.6).
 *
 *   npx tsx scripts/ww1936/duel-fit.ts [--duels 2000] [--seed 1] [--out .cache/duel-fit.json]
 *
 * It plays `--duels` duels (2,000 by default) through the engine's real
 * `fight` (tactics, initiative, daily luck, reserve rolls and all) on the test
 * map: Germany (human) attacks Poland (human) in Warsaw from Berlin, or from
 * Berlin and Munich, on 1936-06-01 (a clear day), supply pinned at 1000, no
 * generals. Each duel draws, from a PRNG seeded by `--seed` and the duel's
 * number, the two templates, the two sizes (log-uniform), the terrain, the
 * river on the attacking edges, the fort and the defenders' entrenchment, and
 * the battle's own roll key (its start tick and the game day it runs on), so
 * it is deterministic: the same arguments print the same table.
 *
 * For each duel the predicted ratio is `predictAttackRange(..).midPm` (what
 * the screen and the AI see before the attack) and the outcome is whether the
 * defence was broken. The duels are bucketed by the ratio's quarter-octave
 * (round(4 × log2(ratio))), the win rates are made monotone by pool adjacent
 * violators (weighted by the duels in a bucket) and printed as the
 * `WIN_PCT_AT` array of engine-lib CombatRules.ts, to paste there. Refit
 * after any change to the battle rules (tactics, luck, widths, damage).
 *
 *   npx tsx scripts/ww1936/duel-fit.ts --targets [--duels 300]
 *
 * instead plays the design's duel targets (design ww6 §5, lane F) with the
 * same harness: `--duels` battles for each row of TARGETS, and prints each
 * row's attacker win %, the table's win % at its predicted ratio, the mean
 * days of a won battle and the ratios.
 *
 *   npx tsx scripts/ww1936/duel-fit.ts --lines [--duels 40]
 *
 * instead plays the AI's line shapes (AI_LINE_SHAPES, ww105): the shape the
 * AI refits to, with its four companies, against the old six infantry, three
 * guns and an anti-tank battalion and eight and two, on a dug-in line: at equal
 * width, as the divisions a front can use, and at equal count, as an army that
 * was refitted has them.
 *
 *   npx tsx scripts/ww1936/duel-fit.ts --plan [--duels 300]
 *
 * instead plays the combat overhaul's targets (ww84 plan section 6), each row
 * with both sides on one country's gear of one generation, no research, laws
 * or spirits: attacker win %, the table's %, days, and the men each side lost.
 */
import type { KeyStatsTable } from "@openfront/engine-api/ww1936/DepthTypes";
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type BattalionId,
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
  idleOrder,
  type LandTerrain,
  MOVE_RETREAT,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  AI_LINE_SHAPES,
  type ShapeRows,
} from "@openfront/engine-lib/ww1936/AiPlans";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  WIN_PCT_AT,
  WIN_RATIO_AT_PM,
  winPctOf,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { tankStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import type { TankEntry } from "@openfront/engine-lib/ww1936/hist/Types";
import {
  rowScore,
  STATIC_KEY_STATS,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { clearBands } from "@openfront/engine/ww1936/land/Bands";
import {
  closeBattle,
  joinBattle,
  stepBattles,
} from "@openfront/engine/ww1936/land/Battles";
import { predictAttackRange } from "@openfront/engine/ww1936/land/Plans";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import fs from "fs";
import {
  byTag,
  clearLand,
  dropPact,
  placeArmy,
  stamped,
  step,
  stepTo,
  wwRunner,
} from "../../tests/ww1936/util";

// ---------------------------------------------------------------------------
// Options

interface Options {
  duels: number;
  seed: number;
  out: string;
  targets: boolean;
  plan: boolean;
  lines: boolean;
  only: string;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    duels: 2000,
    seed: 1,
    out: "",
    targets: false,
    plan: false,
    lines: false,
    only: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    if (arg === "--duels") o.duels = parseInt(next(), 10);
    else if (arg === "--seed") o.seed = parseInt(next(), 10);
    else if (arg === "--out") o.out = next();
    else if (arg === "--targets") o.targets = true;
    else if (arg === "--plan") o.plan = true;
    else if (arg === "--lines") o.lines = true;
    else if (arg === "--only") o.only = next();
    else throw new Error(`unknown argument: ${arg}`);
  }
  return o;
}

/** mulberry32: a small seeded PRNG (this script only; the engine rolls with wwRoll). */
function prng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The duels

const BERLIN = 3;
const MUNICH = 4;
const WARSAW = 6;

const INF72 = [
  ...Array<"infantry">(7).fill("infantry"),
  "artillery",
  "artillery",
] as const;

/** The AI's four companies on a line (AiDay.refitCompanies with everything researched). */
const LINE_COMPANIES = [
  "support_artillery",
  "engineer",
  "support_anti_tank",
  "recon",
] as const;
const flatRows = (rows: ShapeRows) =>
  rows.flatMap(([b, n]) => new Array<BattalionId>(n).fill(b));

/** Templates as battalion lists (the land-sim duels': spec §9.10, §4.5). */
const TEMPLATES = {
  /** ww105: the line of SUN, USA, GBR and FRA, as the table has it now. */
  lineNew: {
    battalions: flatRows(AI_LINE_SHAPES.SUN!.line),
    support: LINE_COMPANIES,
  },
  /** ww105: the line that replaced: three gun battalions and an anti-tank one. */
  lineOld: {
    battalions: flatRows([
      ["artillery", 3],
      ["anti_tank", 1],
      ["infantry", 6],
    ]),
    support: ["engineer", "recon", "support_artillery"],
  },
  /** ww105: Germany's line. */
  line82: {
    battalions: flatRows(AI_LINE_SHAPES.DEU!.line),
    support: LINE_COMPANIES,
  },
  /** ww105: a dug-in eight and two with its engineers: what the lines attack. */
  line82eng: {
    battalions: flatRows(AI_LINE_SHAPES.DEU!.line),
    support: ["engineer"],
  },
  inf72: {
    battalions: [
      ...Array<"infantry">(7).fill("infantry"),
      "artillery",
      "artillery",
    ],
    support: [],
  },
  inf92: {
    battalions: [
      ...Array<"infantry">(9).fill("infantry"),
      "artillery",
      "artillery",
    ],
    support: ["engineer", "recon"],
  },
  panzer: {
    battalions: [
      "light_armor",
      "light_armor",
      "light_armor",
      "light_armor",
      "motorized",
      "motorized",
      "mot_artillery",
    ],
    support: ["recon"],
  },
  guns: {
    battalions: [
      ...Array<"infantry">(5).fill("infantry"),
      "artillery",
      "artillery",
      "artillery",
      "artillery",
    ],
    support: ["support_artillery"],
  },
  inf9: { battalions: Array<"infantry">(9).fill("infantry"), support: [] },
  inf93: {
    battalions: [
      ...Array<"infantry">(9).fill("infantry"),
      "artillery",
      "artillery",
      "artillery",
    ],
    support: ["engineer"],
  },
  cav: { battalions: Array<"cavalry">(6).fill("cavalry"), support: [] },
  // The combat overhaul's divisions (plan section 6).
  tank45: {
    battalions: [
      ...Array<"medium_armor">(4).fill("medium_armor"),
      ...Array<"motorized">(5).fill("motorized"),
    ],
    support: [],
  },
  tank54: {
    battalions: [
      ...Array<"medium_armor">(5).fill("medium_armor"),
      ...Array<"motorized">(4).fill("motorized"),
    ],
    support: [],
  },
  heavy45: {
    battalions: [
      ...Array<"heavy_armor">(4).fill("heavy_armor"),
      ...Array<"motorized">(5).fill("motorized"),
    ],
    support: [],
  },
  light45: {
    battalions: [
      ...Array<"light_armor">(4).fill("light_armor"),
      ...Array<"motorized">(5).fill("motorized"),
    ],
    support: [],
  },
  bare9: {
    battalions: Array<"medium_armor">(9).fill("medium_armor"),
    support: [],
  },
  bare6: {
    battalions: [
      ...Array<"medium_armor">(6).fill("medium_armor"),
      "motorized",
      "motorized",
    ],
    support: [],
  },
  inf6at2: {
    battalions: [
      ...Array<"infantry">(6).fill("infantry"),
      "anti_tank",
      "anti_tank",
    ],
    support: [],
  },
  // Infantry and guns with the companies that go at a deep line (ww98).
  inf72eng: { battalions: INF72, support: ["engineer"] },
  inf72recon: { battalions: INF72, support: ["recon"] },
  inf72sup: { battalions: INF72, support: ["support_artillery"] },
  inf72noeng: {
    battalions: INF72,
    support: ["recon", "support_artillery"],
  },
  inf72all: {
    battalions: INF72,
    support: ["engineer", "recon", "support_artillery"],
  },
  inf9eng: {
    battalions: Array<"infantry">(9).fill("infantry"),
    support: ["engineer"],
  },
} as const;
type TemplateKey = keyof typeof TEMPLATES;

const ATT_TEMPLATES: TemplateKey[] = [
  "inf72",
  "inf72",
  "inf92",
  "panzer",
  "tank45",
  "guns",
];
const DEF_TEMPLATES: TemplateKey[] = [
  "inf9",
  "inf9",
  "inf93",
  "inf72",
  "inf6at2",
  "cav",
];
const TERRAINS: LandTerrain[] = [
  "plains",
  "plains",
  "plains",
  "forest",
  "hills",
  "marsh",
  "urban",
  "mountain",
];

interface Duel {
  att: TemplateKey;
  def: TemplateKey;
  nAtt: number;
  nDef: number;
  ways: 1 | 2;
  land: LandTerrain;
  river: 0 | 1 | 2;
  fort: number;
  entrench: number;
  /** The battle's roll key and the game tick its rounds run from. */
  since: number;
  tick0: number;
  /** --plan: both sides' gear generation, and the tank catalogue entry (the attacker's) in place of static tanks. */
  gen?: number;
  tank?: string;
  /** --plan: the defender's tank entry. */
  defTank?: string;
  /** --plan: a second attacking template (an army's mix), and how many of it. */
  att2?: TemplateKey;
  nAtt2?: number;
}

/** Log-uniform integer in [lo, hi]. */
function logUniform(rnd: () => number, lo: number, hi: number): number {
  return Math.min(
    hi,
    Math.max(
      lo,
      Math.round(
        Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))),
      ),
    ),
  );
}

function drawDuel(i: number, seed: number): Duel {
  const rnd = prng(Math.imul(seed, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const ways = rnd() < 0.5 ? 1 : 2;
  const nDef = logUniform(rnd, 1, 14);
  // Three in five duels size the attack against the defence (0.3 … 5 times
  // as many divisions) so the contested ratios are well covered; the rest are
  // sized freely.
  const nAtt =
    rnd() < 0.6
      ? Math.min(
          40,
          Math.max(ways, Math.round(nDef * Math.exp(-1.2 + 2.8 * rnd()))),
        )
      : logUniform(rnd, ways, 28);
  return {
    att: pick(ATT_TEMPLATES),
    def: pick(DEF_TEMPLATES),
    nAtt,
    nDef,
    ways,
    land: pick(TERRAINS),
    river: pick([0, 0, 0, 1, 1, 2] as const),
    fort: rnd() < 0.15 ? 1 + Math.floor(rnd() * 3) : 0,
    entrench: Math.floor(rnd() * 6),
    since: 1 + Math.floor(rnd() * 1_000_000),
    tick0: 1000 + Math.floor(rnd() * 3000),
  };
}

function addTemplate(l: WwLand, smallID: number, key: TemplateKey): number {
  const def = TEMPLATES[key];
  const cl = l.country(smallID)!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: {
      name: key,
      battalions: [...def.battalions],
      support: [...def.support],
    },
  });
  return id;
}

interface Outcome {
  mid: number;
  low: number;
  high: number;
  win: boolean;
  rounds: number;
  /** Share of the men lost, ‰. */
  attLostPm: number;
  defLostPm: number;
}

/** A duel of the design's target table, played `--duels` times with new rolls. */
interface Target {
  name: string;
  att: TemplateKey;
  def: TemplateKey;
  nAtt: number;
  nDef: number;
  ways: 1 | 2;
  land: LandTerrain;
  fort: number;
  entrench: number;
  pos: number;
}

const row = (
  name: string,
  att: TemplateKey,
  nAtt: number,
  nDef: number,
  ways: 1 | 2,
  fort: number,
  entrench: number,
  pos: number,
  def: TemplateKey = "inf72",
): Target => ({
  name,
  att,
  def,
  nAtt,
  nDef,
  ways,
  land: "plains",
  fort,
  entrench,
  pos,
});

/** ww105: the AI's line shapes on a dug-in line, at 3:1 by width and at equal count. */
const LINES: readonly Target[] = [
  row("new line x36 (width 540)", "lineNew", 36, 8, 1, 0, 5, 0, "line82eng"),
  row("old line x24 (width 528)", "lineOld", 24, 8, 1, 0, 5, 0, "line82eng"),
  row("8 and 2 x24 (width 528)", "line82", 24, 8, 1, 0, 5, 0, "line82eng"),
  row("new line x24, equal count", "lineNew", 24, 8, 1, 0, 5, 0, "line82eng"),
  row("new line x16", "lineNew", 16, 8, 1, 0, 5, 0, "line82eng"),
  row("old line x16", "lineOld", 16, 8, 1, 0, 5, 0, "line82eng"),
  row(
    "new holds x12 against 8 and 2 x16",
    "line82",
    16,
    12,
    1,
    0,
    5,
    0,
    "lineNew",
  ),
  row(
    "old holds x8 against 8 and 2 x16",
    "line82",
    16,
    8,
    1,
    0,
    5,
    0,
    "lineOld",
  ),
  row("new holds x8, equal count", "line82", 16, 8, 1, 0, 5, 0, "lineNew"),
];

/** Design §5: 1:1 < 20 %; 2:1 ~50 % in 4-7 days; 3:1 ≥ 80 %; the Maginot's 50 % only at 5:1 with guns and engineers. */
const TARGETS: readonly Target[] = [
  row("1:1 plains entrench 5 (want <20)", "inf72", 3, 3, 1, 0, 5, 0),
  row("1:1 plains entrench 5, 2 ways (want <20)", "inf72", 4, 4, 2, 0, 5, 0),
  row("1:1 plains no entrench", "inf72", 3, 3, 1, 0, 0, 0),
  row("2:1 entrench 5 pos 3 (want ~50, 4-7 d)", "inf72", 4, 2, 1, 0, 5, 3),
  row("2:1 entrench 5 pos 3, 2 ways (~50)", "inf72", 6, 3, 2, 0, 5, 3),
  row("2:1 entrench 3 pos 1 (~50)", "inf72", 4, 2, 1, 0, 3, 1),
  row("3:1 plains no entrench (want ≥80)", "inf72", 6, 2, 1, 0, 0, 0),
  row("3:1 plains entrench 5 pos 3 (want ≥80)", "inf72", 6, 2, 2, 0, 5, 3),
  row("3:1 plains, 2 ways, entrench 5 (want ≥80)", "inf72", 9, 3, 2, 0, 5, 0),
  row("fort 5 entrench 5, 5:1 guns+eng 3v15 (~50)", "inf93", 15, 3, 2, 5, 5, 0),
  row("fort 5 entrench 5, 5:1 guns+eng 2v10 (~50)", "inf93", 10, 2, 2, 5, 5, 0),
  row("fort 5 entrench 5, 5:1 guns+eng 4v20 (~50)", "inf93", 20, 4, 2, 5, 5, 0),
  row("fort 5 entrench 5, 4:1 guns+eng 3v12 (<50)", "inf93", 12, 3, 2, 5, 5, 0),
  row("fort 5 entrench 5, 3:1 guns+eng 3v9 (<50)", "inf93", 9, 3, 2, 5, 5, 0),
  row("fort 5 entrench 5, 5:1 infantry 3v15 (<50)", "inf9", 15, 3, 2, 5, 5, 0),
  row(
    "fort 5 entrench 5, 5:1 guns no eng 3v15 (<50)",
    "guns",
    15,
    3,
    2,
    5,
    5,
    0,
  ),
];

function pctStr(a: number, b: number): string {
  return b === 0 ? "-" : ((100 * a) / b).toFixed(0);
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  // (The plan's rows run on the catalogue: the designer's fixture has generic gear.)
  const runner = await wwRunner(o.plan ? { ww1936Designer: false } : {}, [
    { clientID: "HUMAN001", country: "DEU" },
    { clientID: "HUMAN002", country: "POL" },
  ]);
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(dayOfDate("1936-06-01"), WW_PREP_TICKS));
  step(runner, 2, [
    stamped("HUMAN001", {
      type: "declare_war",
      target: byTag(g, "POL").id(),
    }),
  ]);
  const l = g.worldWar()!.land;
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  const t = l.divisions;
  // --plan: both sides read one key table, with no research, laws or spirits.
  let planKs: KeyStatsTable | null = null;
  const hooks = l.depthHooks as unknown as {
    keyStats(id: number): KeyStatsTable;
    keyStatsSeq: number;
  };
  const useKeys = (ks: KeyStatsTable | null) => {
    planKs = ks;
    hooks.keyStatsSeq++;
  };
  const realKeys = hooks.keyStats.bind(hooks);
  hooks.keyStats = (id) => planKs ?? realKeys(id);
  const deuKeys = realKeys(deu);
  // The terrain of Warsaw per duel (the scenario's landOf, once patched).
  const sc = l.scenario as unknown as { landOf(r: number): LandTerrain };
  const landOf = sc.landOf.bind(sc);
  let terrain: LandTerrain | null = null;
  sc.landOf = (r: number) =>
    r === WARSAW && terrain !== null ? terrain : landOf(r);

  const t0 = Date.now();
  const out: Outcome[] = [];
  const play = (d: Duel, pos: number): Outcome => {
    clearLand(g);
    clearBands(l, WARSAW);
    l.posLevel[WARSAW] = pos;
    for (const id of [deu, pol]) {
      const ce = l.econ.country(id)!;
      for (let k = 0; k < ce.stock.length; k++) {
        if (EQUIP_KEYS[k][1] === 1) ce.stock[k] = 2_000_000_000;
      }
      ce.manpower = 2_000_000_000;
      if (d.gen !== undefined) {
        const name = id === deu ? d.tank : d.defTank;
        const slot = name === undefined ? 0 : tankSlot(name);
        for (let k = 0; k < ce.stock.length; k++) {
          const [type, gen] = EQUIP_KEYS[k];
          ce.stock[k] =
            type === "tank_design"
              ? gen === slot
                ? 2_000_000_000
                : 0
              : gen === Math.min(d.gen, EQUIPMENT_GENS[type]) &&
                  (slot === 0 || !type.endsWith("_tank"))
                ? 2_000_000_000
                : 0;
        }
      }
    }
    terrain = d.land;
    const from = d.ways === 2 ? [BERLIN, MUNICH] : [BERLIN];
    for (const e of l.scenario.edgesOf(WARSAW)) {
      if (from.includes(e.to)) {
        (l.scenario.edge(e.edge) as { river: number }).river = d.river;
      }
    }
    l.econ.fort[WARSAW] = d.fort;
    const attTpl = addTemplate(l, deu, d.att);
    const defTpl = addTemplate(l, pol, d.def);
    const attArmies: Army[] = [];
    for (let w = 0; w < d.ways; w++) {
      // Two directions: the attackers split evenly between Berlin and Munich.
      const n =
        d.ways === 1
          ? d.nAtt
          : w === 0
            ? Math.ceil(d.nAtt / 2)
            : Math.floor(d.nAtt / 2);
      if (n > 0) attArmies.push(placeArmy(g, "DEU", from[w], n, attTpl));
    }
    if (d.att2 !== undefined && (d.nAtt2 ?? 0) > 0) {
      const tpl = addTemplate(l, deu, d.att2);
      attArmies.push(placeArmy(g, "DEU", from[0], d.nAtt2!, tpl));
    }
    const defArmy = placeArmy(g, "POL", WARSAW, d.nDef, defTpl);
    const attIds = attArmies.flatMap((a) => [...a.divisions]);
    const defIds = [...defArmy.divisions];
    for (const a of [...attArmies, defArmy]) {
      a.order = idleOrder();
      a.general = 0;
      a.planBp = 0;
    }
    for (const id of defIds) t.entrench[t.rowOf(id)] = d.entrench;
    const pin = () => {
      for (const id of [...attIds, ...defIds]) {
        const r = t.rowOf(id);
        if (r >= 0) t.supply[r] = 1000;
      }
    };
    pin();
    const menOf = (ids: readonly number[]) =>
      ids.reduce((sum, id) => {
        const r = t.rowOf(id);
        return sum + (r >= 0 ? t.men[r] : 0);
      }, 0);
    const attMen = menOf(attIds);
    const defMen = menOf(defIds);
    const range = predictAttackRange(
      l,
      attIds.map((id) => t.rowOf(id)),
      WARSAW,
    );
    for (const id of attIds) joinBattle(l, id, WARSAW);
    const b = l.battles.get(WARSAW)!;
    b.sinceTick = d.since;
    let rounds = 0;
    while (l.battles.has(WARSAW) && rounds < 800) {
      pin();
      stepBattles(l, d.tick0 + rounds);
      rounds++;
    }
    const standing = (ids: readonly number[], at: (r: number) => boolean) =>
      ids.filter((id) => {
        const r = t.rowOf(id);
        return r >= 0 && t.org[r] > 0 && t.mode[r] !== MOVE_RETREAT && at(r);
      }).length;
    const attLeft = standing(attIds, () => true);
    const defLeft = standing(defIds, (r) => t.region[r] === WARSAW);
    const won = !l.battles.has(WARSAW) && defLeft === 0 && attLeft > 0;
    if (l.battles.has(WARSAW)) closeBattle(l, WARSAW);
    return {
      mid: range.midPm,
      low: range.lowPm,
      high: range.highPm,
      win: won,
      rounds,
      attLostPm: Math.round((1000 * (attMen - menOf(attIds))) / attMen),
      defLostPm: Math.round((1000 * (defMen - menOf(defIds))) / defMen),
    };
  };
  if (o.plan) {
    planReport(o, play, useKeys, deuKeys, l);
    return;
  }
  if (o.targets || o.lines) {
    const n = o.duels === 2000 ? (o.lines ? 40 : 300) : o.duels;
    for (const target of o.lines ? LINES : TARGETS) {
      const rs: Outcome[] = [];
      for (let i = 0; i < n; i++) {
        const rnd = prng(
          Math.imul(o.seed, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b),
        );
        rs.push(
          play(
            {
              ...target,
              river: 0,
              since: 1 + Math.floor(rnd() * 1_000_000),
              tick0: 1000 + Math.floor(rnd() * 3000),
            },
            target.pos,
          ),
        );
      }
      const wins = rs.filter((r) => r.win);
      const mean = (xs: number[]) =>
        xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
      console.log(
        `${target.name.padEnd(50)} win ${pctStr(wins.length, n).padStart(3)}%  ` +
          `table ${String(winPctOf(rs[0].mid)).padStart(3)}%  ` +
          `won in ${(mean(wins.map((r) => r.rounds)) / 7.5).toFixed(1)} d  ` +
          `all ${(mean(rs.map((r) => r.rounds)) / 7.5).toFixed(1)} d  ` +
          `ratio ${rs[0].low} / ${rs[0].mid} / ${rs[0].high}`,
      );
    }
    return;
  }
  for (let i = 0; i < o.duels; i++) {
    out.push(play(drawDuel(i, o.seed), 0));
    if ((i + 1) % 250 === 0) {
      console.error(
        `${i + 1}/${o.duels} duels, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
      );
    }
  }
  report(out, o);
}

// ---------------------------------------------------------------------------
// The combat overhaul's targets (plan section 6)

/** The DEU slot of a tank entry (1-based). */
function tankSlot(id: string): number {
  const i = histOwn("DEU", "tank").findIndex((e) => e.id === id);
  if (i < 0) throw new Error(`no tank ${id}`);
  return i + 1;
}

/** `ks` with every German catalogue tank in its slot, whatever is researched, and its generation-2 gun at `pierceCenti` (0: as it is). */
function planTable(ks: KeyStatsTable, pierceCenti: number): KeyStatsTable {
  const t: KeyStatsTable = {
    group: ks.group.slice(),
    year: ks.year.slice(),
    score: ks.score.slice(),
    stats: ks.stats.slice(),
  };
  if (pierceCenti > 0) {
    t.stats[slotOf("anti_tank", 2) * KS_FIELDS + KS.pierce] = pierceCenti;
  }
  histOwn("DEU", "tank").forEach((e, i) => {
    const s = tankStatsOfEntry(e as TankEntry);
    const j = GROUND_STATIC_SLOTS + i;
    const o = j * KS_FIELDS;
    t.group[j] = s.group;
    t.year[j] = s.year;
    t.stats[o + KS.soft] = s.soft;
    t.stats[o + KS.hard] = s.hard;
    t.stats[o + KS.def] = s.def;
    t.stats[o + KS.brk] = s.brk;
    t.stats[o + KS.pierce] = s.pierce;
    t.stats[o + KS.armor] = s.armor;
    t.stats[o + KS.hardnessPm] = s.hardnessPm;
    t.stats[o + KS.speedCenti] = s.speedCenti;
    t.stats[o + KS.relPm] = s.relPm;
    t.score[j] = rowScore(t.stats, j, s.group, s.year);
  });
  return t;
}

function slotOf(type: EquipmentType, gen: number): number {
  const j = GROUND_EQUIP_KEYS.indexOf(equipKey(type, gen));
  if (j < 0) throw new Error(`no slot ${type} ${gen}`);
  return j;
}

interface PlanRow extends Target {
  gen: number;
  keys: "generic" | "deu" | "pak43" | "17pdr";
  tank?: string;
  defTank?: string;
  att2?: TemplateKey;
  nAtt2?: number;
}

const plan = (
  name: string,
  att: TemplateKey,
  def: TemplateKey,
  n: [number, number],
  entrench: number,
  fort: number,
  gen: number,
  keys: PlanRow["keys"],
  tank?: string,
): PlanRow => ({
  name,
  att,
  def,
  nAtt: n[0],
  nDef: n[1],
  ways: 1,
  land: "plains",
  fort,
  entrench,
  pos: 0,
  gen,
  keys,
  tank,
});

/** A full line and more on both sides: 1:1 is ten against ten (five fit the width), 3:1 thirty against ten. */
const EVEN: [number, number] = [10, 10];
const THREE: [number, number] = [30, 10];
const FIVE: [number, number] = [50, 10];

/** ww98: a deep line, entrench 10 and positions 3, against what is meant to break it. */
const deep = (
  name: string,
  att: TemplateKey,
  n: [number, number],
  gen: number,
  keys: PlanRow["keys"],
): PlanRow => ({
  ...plan(`deep ${keys} g${gen} ${name}`, att, "inf9", n, 10, 0, gen, keys),
  pos: 3,
});

const DEEP_ROWS: readonly PlanRow[] = (["generic", "deu"] as const).flatMap(
  (k) =>
    [1, 2].flatMap((gen) => [
      deep("infantry 3:1", "inf9", THREE, gen, k),
      deep("infantry 5:1", "inf9", FIVE, gen, k),
      deep("infantry + engineers 3:1", "inf9eng", THREE, gen, k),
      deep("guns 3:1", "inf72", THREE, gen, k),
      deep("guns 5:1", "inf72", FIVE, gen, k),
      deep("guns + engineers 3:1", "inf72eng", THREE, gen, k),
      deep("guns + recon 3:1", "inf72recon", THREE, gen, k),
      deep("guns + support guns 3:1", "inf72sup", THREE, gen, k),
      deep("guns + recon + support guns 3:1", "inf72noeng", THREE, gen, k),
      deep("guns + all three 3:1", "inf72all", THREE, gen, k),
      deep("guns + all three 5:1", "inf72all", FIVE, gen, k),
      deep("armour 3:1", "tank45", THREE, gen, k),
      deep("armour 5:1", "tank45", FIVE, gen, k),
    ]),
);

const PLAN_ROWS: readonly PlanRow[] = [
  ...DEEP_ROWS,
  ...(["generic", "deu"] as const).flatMap((k) =>
    [1, 2].flatMap((gen) => {
      const tag = `${k} g${gen}`;
      return [
        plan(`${tag} tank on inf9 (95)`, "tank45", "inf9", EVEN, 0, 0, gen, k),
        plan(
          `${tag} tank on AT e5 (40-55)`,
          "tank45",
          "inf6at2",
          EVEN,
          5,
          0,
          gen,
          k,
        ),
        plan(
          `${tag} inf72 3:1 e5 (60-70)`,
          "inf72",
          "inf9",
          THREE,
          5,
          0,
          gen,
          k,
        ),
        plan(`${tag} inf9 on bare9 (60)`, "inf9", "bare9", EVEN, 0, 0, gen, k),
        plan(`${tag} inf9 on bare6 (60)`, "inf9", "bare6", EVEN, 0, 0, gen, k),
        plan(`${tag} inf9 on inf9 (<15)`, "inf9", "inf9", EVEN, 0, 0, gen, k),
        plan(
          `${tag} inf72 on inf72 (<15)`,
          "inf72",
          "inf72",
          EVEN,
          0,
          0,
          gen,
          k,
        ),
        plan(`${tag} tank on fort 3`, "tank45", "inf9", EVEN, 0, 3, gen, k),
      ];
    }),
  ),
  plan(
    "deu 1942 Pz IV F2 on fort 3",
    "tank45",
    "inf9",
    EVEN,
    0,
    3,
    2,
    "deu",
    "deu_pz4_f2",
  ),
  plan(
    "deu 1942 Tiger I on fort 3",
    "heavy45",
    "inf9",
    EVEN,
    0,
    3,
    2,
    "deu",
    "deu_tiger1_e",
  ),
  plan(
    "deu 1942 Pz IV F2 on e5 fort 3",
    "tank45",
    "inf9",
    EVEN,
    5,
    3,
    2,
    "deu",
    "deu_pz4_f2",
  ),
  plan(
    "deu 1942 Tiger I on e5 fort 3",
    "heavy45",
    "inf9",
    EVEN,
    5,
    3,
    2,
    "deu",
    "deu_tiger1_e",
  ),
  plan(
    "deu 1942 Pz IV F2 on inf9 (95)",
    "tank45",
    "inf9",
    EVEN,
    0,
    0,
    2,
    "deu",
    "deu_pz4_f2",
  ),
  plan(
    "deu 1942 Pz IV F2 on AT e5",
    "tank45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "deu",
    "deu_pz4_f2",
  ),
  plan(
    "Pak 43: Pz IV F2 on AT e5",
    "tank45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "pak43",
    "deu_pz4_f2",
  ),
  plan(
    "Pak 43: Panther on AT e5",
    "tank45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "pak43",
    "deu_panther_a",
  ),
  plan(
    "17-pdr: Pz IV F2 on AT e5",
    "tank45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "17pdr",
    "deu_pz4_f2",
  ),
  plan(
    "17-pdr: Panther on AT e5",
    "tank45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "17pdr",
    "deu_panther_a",
  ),
  plan(
    "Pak 43: Panther 2:1 on AT e5",
    "tank45",
    "inf6at2",
    [20, 10],
    5,
    0,
    2,
    "pak43",
    "deu_panther_a",
  ),
  ...(
    [
      [8, 8],
      [5, 11],
      [3, 13],
      [11, 5],
      [16, 0],
      [0, 16],
    ] as const
  ).map(
    ([tanks, line]): PlanRow => ({
      ...plan(
        `mix ${tanks}:${line} on AT e5`,
        "tank45",
        "inf6at2",
        [tanks, 10],
        5,
        0,
        2,
        "deu",
        "deu_pz4_f2",
      ),
      att2: "inf72",
      nAtt2: line,
    }),
  ),
  {
    ...plan(
      "deu 1942 inf9 on bare9 Pz IV F2 (60)",
      "inf9",
      "bare9",
      EVEN,
      0,
      0,
      2,
      "deu",
    ),
    defTank: "deu_pz4_f2",
  },
  {
    ...plan(
      "deu 1943 inf9 on bare9 Panther (60)",
      "inf9",
      "bare9",
      EVEN,
      0,
      0,
      2,
      "deu",
    ),
    defTank: "deu_panther_a",
  },
  {
    ...plan(
      "deu 1942 inf9 on tank45 Pz IV F2",
      "inf9",
      "tank45",
      EVEN,
      0,
      0,
      2,
      "deu",
    ),
    defTank: "deu_pz4_f2",
  },
  plan("deep inf72 3:1 e10", "inf72", "inf9", THREE, 10, 0, 1, "generic"),
  plan("deep inf72 5:1 e10", "inf72", "inf9", [50, 10], 10, 0, 1, "generic"),
  {
    ...plan(
      "deep inf72 3:1 e5 pos 3",
      "inf72",
      "inf9",
      THREE,
      5,
      0,
      1,
      "generic",
    ),
    pos: 3,
  },
  {
    ...plan(
      "deep inf72 5:1 e5 pos 3",
      "inf72",
      "inf9",
      [50, 10],
      5,
      0,
      1,
      "generic",
    ),
    pos: 3,
  },
  {
    ...plan(
      "deep inf72 5:1 e10 pos 3",
      "inf72",
      "inf9",
      [50, 10],
      10,
      0,
      1,
      "generic",
    ),
    pos: 3,
  },
  plan("deep tank 2:1 e10", "tank45", "inf9", [20, 10], 10, 0, 1, "generic"),
  {
    ...plan(
      "deep tank 3:1 e10 pos 3",
      "tank45",
      "inf9",
      THREE,
      10,
      0,
      1,
      "generic",
    ),
    pos: 3,
  },
  plan("open inf72 2:1", "inf72", "inf9", [20, 10], 0, 0, 1, "generic"),
  plan("open inf72 3:1", "inf72", "inf9", THREE, 0, 0, 1, "generic"),
  plan("e5 inf72 2:1", "inf72", "inf9", [20, 10], 5, 0, 1, "generic"),
  plan("e5 inf72 1:1", "inf72", "inf9", EVEN, 5, 0, 1, "generic"),
  plan(
    "deu 1942 Pz IV F2 on open AT",
    "tank45",
    "inf6at2",
    EVEN,
    0,
    0,
    2,
    "deu",
    "deu_pz4_f2",
  ),
  plan(
    "deu 1943 Panther on AT e5",
    "tank45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "deu",
    "deu_panther_a",
  ),
  plan(
    "Pak 43: Tiger II on AT e5",
    "heavy45",
    "inf6at2",
    EVEN,
    5,
    0,
    2,
    "pak43",
    "deu_tiger2_b",
  ),
  plan(
    "deu 1939 Pz III E 2:1 on AT e5",
    "tank45",
    "inf6at2",
    [20, 10],
    5,
    0,
    2,
    "deu",
    "deu_pz3_e",
  ),
  plan("Pz I (light45) on inf9", "light45", "inf9", EVEN, 0, 0, 1, "deu"),
  plan("inf9 on Pz I (light45)", "inf9", "light45", EVEN, 0, 0, 1, "deu"),
];

function planReport(
  o: Options,
  play: (d: Duel, pos: number) => Outcome,
  useKeys: (ks: KeyStatsTable | null) => void,
  deuKeys: KeyStatsTable,
  l: WwLand,
): void {
  const n = o.duels === 2000 ? 300 : o.duels;
  // No research, laws or spirits on either side.
  for (const cl of l.countries()) {
    const c = l.econ.country(cl.smallID)!;
    const st = c.stats as unknown as Record<string, unknown>;
    for (const k of Object.keys(st)) if (typeof st[k] === "number") st[k] = 0;
    c.statsVer++;
  }
  const tables: Record<PlanRow["keys"], KeyStatsTable> = {
    generic: STATIC_KEY_STATS,
    deu: planTable(deuKeys, 0),
    pak43: planTable(deuKeys, 18_500),
    "17pdr": planTable(deuKeys, 14_000),
  };
  const mean = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const r of PLAN_ROWS) {
    if (o.only !== "" && !o.only.split("|").some((x) => r.name.includes(x))) {
      continue;
    }
    useKeys(tables[r.keys]);
    const rs: Outcome[] = [];
    for (let i = 0; i < n; i++) {
      const rnd = prng(
        Math.imul(o.seed, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b),
      );
      rs.push(
        play(
          {
            ...r,
            river: 0,
            since: 1 + Math.floor(rnd() * 1_000_000),
            tick0: 1000 + Math.floor(rnd() * 3000),
          },
          r.pos,
        ),
      );
    }
    const wins = rs.filter((x) => x.win);
    console.log(
      `${r.name.padEnd(44)} win ${pctStr(wins.length, n).padStart(3)}% ` +
        `table ${String(winPctOf(rs[0].mid)).padStart(3)}% ` +
        `ratio ${String(rs[0].mid).padStart(5)} ` +
        `won in ${(mean(wins.map((x) => x.rounds)) / 7.5).toFixed(1).padStart(4)} d ` +
        `all ${(mean(rs.map((x) => x.rounds)) / 7.5).toFixed(1).padStart(4)} d ` +
        `att lost ${(mean(rs.map((x) => x.attLostPm)) / 10).toFixed(1).padStart(4)}% ` +
        `(won ${(mean(wins.map((x) => x.attLostPm)) / 10).toFixed(1)}%) ` +
        `def lost ${(mean(rs.map((x) => x.defLostPm)) / 10).toFixed(1).padStart(4)}%`,
    );
  }
}

// ---------------------------------------------------------------------------
// The fit

/** Quarter-octave bucket of a ratio ‰, -16…16 (ratio 1/16 … 16). */
function bucketOf(ratioPm: number): number {
  if (ratioPm <= 0) return -16;
  return Math.max(-16, Math.min(16, Math.round(4 * Math.log2(ratioPm / 1000))));
}

/** Pool adjacent violators: the non-decreasing fit of `y` with weights `w`. */
function pav(y: readonly number[], w: readonly number[]): number[] {
  const blocks: { sum: number; w: number; n: number }[] = [];
  y.forEach((v, i) => {
    blocks.push({ sum: v * w[i], w: w[i], n: 1 });
    while (
      blocks.length > 1 &&
      blocks[blocks.length - 2].sum / blocks[blocks.length - 2].w >
        blocks[blocks.length - 1].sum / blocks[blocks.length - 1].w
    ) {
      const b = blocks.pop()!;
      const a = blocks[blocks.length - 1];
      a.sum += b.sum;
      a.w += b.w;
      a.n += b.n;
    }
  });
  return blocks.flatMap((b) => new Array<number>(b.n).fill(b.sum / b.w));
}

function report(out: Outcome[], o: Options): void {
  const n = new Array<number>(33).fill(0);
  const wins = new Array<number>(33).fill(0);
  for (const r of out) {
    const k = bucketOf(r.mid) + 16;
    n[k]++;
    if (r.win) wins[k]++;
  }
  // Fit the buckets that have duels, then fill the others by interpolation
  // between their neighbours (flat past the ends).
  const have = n.map((c, k) => (c > 0 ? k : -1)).filter((k) => k >= 0);
  const fit = pav(
    have.map((k) => wins[k] / n[k]),
    have.map((k) => n[k]),
  );
  const rate = new Array<number>(33).fill(0);
  for (let k = 0; k < 33; k++) {
    const j = have.indexOf(k);
    if (j >= 0) {
      rate[k] = fit[j];
      continue;
    }
    const lo = [...have].reverse().find((h) => h < k);
    const hi = have.find((h) => h > k);
    if (lo === undefined) rate[k] = fit[0];
    else if (hi === undefined) rate[k] = fit[fit.length - 1];
    else {
      const a = fit[have.indexOf(lo)];
      const b = fit[have.indexOf(hi)];
      rate[k] = a + ((b - a) * (k - lo)) / (hi - lo);
    }
  }
  // Whole percent, monotone; a tail within half a percent of 0 or 100 is 0 or 100.
  let prev = 0;
  const table = rate.map((r) => {
    let v = Math.round(r * 100);
    if (v <= 0) v = 0;
    if (v >= 100) v = 100;
    v = Math.max(prev, v);
    prev = v;
    return v;
  });
  const rows = n.map((c, k) => {
    const edge = WIN_RATIO_AT_PM[k];
    return (
      `${String(k - 16).padStart(4)}  ${String(edge).padStart(6)}‰  ` +
      `n=${String(c).padStart(4)}  seen ${c === 0 ? "   -" : String(Math.round((100 * wins[k]) / c)).padStart(4)}%  ` +
      `fit ${String(table[k]).padStart(3)}%  now ${String(WIN_PCT_AT[k]).padStart(3)}%`
    );
  });
  console.log(rows.join("\n"));
  // How well does each table do on these duels (mean squared error)?
  const mse = (win: (ratioPm: number) => number) =>
    out.reduce((s, r) => s + (win(r.mid) / 100 - (r.win ? 1 : 0)) ** 2, 0) /
    out.length;
  const interp = (ratioPm: number) => {
    // The new table through winPctOf's own interpolation.
    const e = WIN_RATIO_AT_PM;
    if (ratioPm <= 0) return 0;
    if (ratioPm >= e[32]) return table[32];
    if (ratioPm <= e[0]) return table[0];
    let k = 1;
    while (ratioPm > e[k]) k++;
    return (
      table[k - 1] +
      Math.floor(
        ((table[k] - table[k - 1]) * (ratioPm - e[k - 1])) / (e[k] - e[k - 1]),
      )
    );
  };
  const winRate = out.filter((r) => r.win).length / out.length;
  console.log(
    `\n${out.length} duels (seed ${o.seed}), attackers won ${(100 * winRate).toFixed(1)}%, ` +
      `mean squared error: current table ${mse(winPctOf).toFixed(4)}, fitted ${mse(interp).toFixed(4)}`,
  );
  // Where the range brackets the outcome: how often did the attacker win when low ≥ 1000, lose when high < 1000.
  const sure = out.filter((r) => r.low >= 1000);
  const doomed = out.filter((r) => r.high < 1000);
  console.log(
    `low ≥ 1000 (${sure.length} duels): attacker won ${pct(sure.filter((r) => r.win).length, sure.length)}%; ` +
      `high < 1000 (${doomed.length} duels): attacker won ${pct(doomed.filter((r) => r.win).length, doomed.length)}%`,
  );
  const fmt = (xs: readonly number[]) => {
    const lines: string[] = [];
    for (let i = 0; i < xs.length; i += 8) {
      lines.push("  " + xs.slice(i, i + 8).join(", ") + ",");
    }
    return lines.join("\n");
  };
  console.log(
    `\nexport const WIN_PCT_AT: readonly number[] = [\n${fmt(table)}\n];`,
  );
  if (o.out !== "")
    fs.writeFileSync(o.out, JSON.stringify({ n, wins, table }, null, 1));
}

const pct = (a: number, b: number) =>
  b === 0 ? "-" : String(Math.round((100 * a) / b));

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
