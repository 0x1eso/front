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
 */
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  type LandTerrain,
  MOVE_RETREAT,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  WIN_PCT_AT,
  WIN_RATIO_AT_PM,
  winPctOf,
} from "@openfront/engine-lib/ww1936/CombatRules";
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
}

function parseArgs(argv: string[]): Options {
  const o: Options = { duels: 2000, seed: 1, out: "" };
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

/** Templates as battalion lists (the land-sim duels': spec §9.10, §4.5). */
const TEMPLATES = {
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
} as const;
type TemplateKey = keyof typeof TEMPLATES;

const ATT_TEMPLATES: TemplateKey[] = [
  "inf72",
  "inf72",
  "inf92",
  "panzer",
  "guns",
];
const DEF_TEMPLATES: TemplateKey[] = ["inf9", "inf9", "inf93", "inf72", "cav"];
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
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const runner = await wwRunner({}, [
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
  // The terrain of Warsaw per duel (the scenario's landOf, once patched).
  const sc = l.scenario as unknown as { landOf(r: number): LandTerrain };
  const landOf = sc.landOf.bind(sc);
  let terrain: LandTerrain | null = null;
  sc.landOf = (r: number) =>
    r === WARSAW && terrain !== null ? terrain : landOf(r);

  const t0 = Date.now();
  const out: Outcome[] = [];
  for (let i = 0; i < o.duels; i++) {
    const d = drawDuel(i, o.seed);
    const tA = Date.now();
    clearLand(g);
    for (const id of [deu, pol]) {
      const ce = l.econ.country(id)!;
      for (let k = 0; k < ce.stock.length; k++) {
        if (EQUIP_KEYS[k][1] === 1) ce.stock[k] = 2_000_000_000;
      }
      ce.manpower = 2_000_000_000;
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
    const tB = Date.now();
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
    if (process.env.DUEL_FIT_TIMES) {
      console.error(
        `duel ${i}: ${d.nAtt} v ${d.nDef} ${d.land}: place ${tB - tA} ms, fight ${Date.now() - tB} ms, ${rounds} rounds`,
      );
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
    out.push({
      mid: range.midPm,
      low: range.lowPm,
      high: range.highPm,
      win: won,
      rounds,
    });
    if ((i + 1) % 250 === 0) {
      console.error(
        `${i + 1}/${o.duels} duels, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
      );
    }
  }
  report(out, o);
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
