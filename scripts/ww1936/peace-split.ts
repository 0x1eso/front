/**
 * World War 1936 (ww88): the peace conference's assignment for a given
 * occupation, on the real map, without a game. It runs the engine's own
 * PeaceAssign rules and prints who gets what, the compensation and the
 * loser's fate, to look at a split before playing it.
 *
 *   npx tsx scripts/ww1936/peace-split.ts --loser FRA \
 *       --winner DEU:1000 --winner ITA:400 \
 *       --hold DEU:sr53,sr55,sr59 --hold ITA:sr74,446 --rest DEU
 *
 *   --loser TAG           the loser (repeatable)
 *   --winner TAG:SCORE    a winner and its war score (repeatable)
 *   --dem TAG             that winner is an AI democracy (repeatable)
 *   --hold TAG:LIST       what TAG conquered: region ids and srNN strategic
 *                         regions, comma separated (repeatable; a later one
 *                         wins a region)
 *   --rest TAG            everything else came by hand-over to TAG, as after
 *                         a capitulation; without it the loser still holds it
 *   --home                only the loser's regions on its home continent
 *                         group: colonies (strategic regions it has no
 *                         hold in) are left out of the print, not the rules
 */
import { regionBaseValue } from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  AssignRegion,
  peaceAssignment,
  WW_PEACE_BIG_CITY_VP,
} from "@openfront/engine-lib/ww1936/PeaceAssign";
import fs from "fs";
import path from "path";

interface RawRegion {
  id: number;
  name: string;
  owner: string;
  vp: number;
  tiles: number;
  civ: number;
  mil: number;
  dock: number;
  sr: number;
  port?: boolean;
  vpTile?: [number, number];
}
interface RawScenario {
  regions: RawRegion[];
  countries: { tag: string; capital: [number, number] }[];
  edges: number[][];
  strategic: { id: number; name: string }[];
}

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}`) out.push(process.argv[i + 1]);
  });
  return out;
}

const file = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../resources/maps/world1936/scenario.json",
);
const data = JSON.parse(fs.readFileSync(file, "utf8")) as RawScenario;
const tags = data.countries.map((c) => c.tag);
const idOf = (tag: string): number => {
  const i = tags.indexOf(tag);
  if (i < 0) throw new Error(`no country ${tag}`);
  return i + 1;
};
const tagOf = (id: number) => tags[id - 1] ?? "?";

const losers = new Set(args("loser").map(idOf));
if (losers.size === 0) throw new Error("--loser is required");
const dems = new Set(args("dem").map(idOf));
const winners = args("winner").map((w) => {
  const [tag, ws] = w.split(":");
  const id = idOf(tag);
  return { id, wsMilli: Number(ws ?? 0), keeps: !dems.has(id) };
});
const near = new Map<number, number[]>();
for (const [a, b] of data.edges) {
  near.set(a, [...(near.get(a) ?? []), b]);
  near.set(b, [...(near.get(b) ?? []), a]);
}
const stake = data.regions.filter((r) => losers.has(idOf(r.owner)));
const holder = new Map<number, number>();
for (const h of args("hold")) {
  const [tag, list] = h.split(":");
  for (const item of list.split(",")) {
    const hits = item.startsWith("sr")
      ? stake.filter((r) => r.sr === Number(item.slice(2))).map((r) => r.id)
      : [Number(item)];
    for (const r of hits) holder.set(r, idOf(tag));
  }
}
const rest = args("rest")[0];
const capitalOf = (L: number): number => {
  const xy = data.countries[L - 1].capital;
  const dist = (r: RawRegion) =>
    r.vpTile === undefined
      ? Infinity
      : Math.abs(r.vpTile[0] - xy[0]) + Math.abs(r.vpTile[1] - xy[1]);
  const mine = stake.filter((r) => idOf(r.owner) === L);
  return [...mine].sort((a, b) => dist(a) - dist(b))[0]?.id ?? 0;
};
const caps = new Map([...losers].map((L) => [L, capitalOf(L)]));
const value = (r: RawRegion) =>
  regionBaseValue(r.vp, r.civ + r.mil + r.dock, r.tiles);
const regions: AssignRegion[] = [...stake]
  .sort((a, b) => a.id - b.id)
  .map((r) => ({
    region: r.id,
    loser: idOf(r.owner),
    value: value(r),
    group: r.sr,
    holder: holder.get(r.id) ?? 0,
    handedTo: rest !== undefined && !holder.has(r.id) ? idOf(rest) : 0,
    port: r.port === true,
    keyCity: caps.get(idOf(r.owner)) === r.id || r.vp >= WW_PEACE_BIG_CITY_VP,
  }));
const owner = new Map(data.regions.map((r) => [r.id, idOf(r.owner)]));
const out = peaceAssignment({
  regions,
  winners,
  neighbours: (r) => near.get(r) ?? [],
  legal: (r) => owner.get(r) ?? 0,
  capitalOf: (L) => caps.get(L) ?? 0,
});

const assigned = new Map(out.assign);
const name = new Map(data.regions.map((r) => [r.id, r]));
const srName = new Map(data.strategic.map((s) => [s.id, s.name]));
const groups = new Map<number, AssignRegion[]>();
for (const r of regions) {
  groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
}
const homeOnly = process.argv.includes("--home");
for (const [g, list] of [...groups].sort((a, b) => a[0] - b[0])) {
  if (homeOnly && !list.some((r) => r.holder !== 0)) continue;
  let total = 0;
  for (const r of list) total += r.value;
  console.log(`\nsr${g} ${srName.get(g) ?? ""} (value ${total})`);
  for (const r of list) {
    const from =
      r.holder !== 0
        ? `conquered by ${tagOf(r.holder)}`
        : r.handedTo !== 0
          ? `handed to ${tagOf(r.handedTo)}`
          : `held by the loser`;
    const to = assigned.get(r.region);
    console.log(
      `  ${String(r.region).padStart(5)} ${name.get(r.region)!.name.padEnd(26)} ` +
        `${String(r.value).padStart(4)}  ${from.padEnd(22)} -> ${
          to === undefined ? "the loser" : tagOf(to)
        }`,
    );
  }
}
const sum = new Map<number, [number, number]>();
for (const r of regions) {
  const to = assigned.get(r.region) ?? 0;
  const s = sum.get(to) ?? [0, 0];
  sum.set(to, [s[0] + 1, s[1] + r.value]);
}
console.log("\nWho gets what");
for (const [id, [n, v]] of [...sum].sort((a, b) => b[1][1] - a[1][1])) {
  console.log(
    `  ${id === 0 ? "the loser" : tagOf(id)}: ${n} regions, value ${v}`,
  );
}
for (const [L, d] of out.puppets) {
  console.log(`${tagOf(L)} goes on as a puppet of ${tagOf(d)}.`);
}
const master = new Map(out.puppets);
const zoned = out.dem.filter(
  (r) => master.get(owner.get(r) ?? 0) !== assigned.get(r),
);
if (zoned.length > 0) console.log(`Occupation zones: ${zoned.join(", ")}`);
console.log("Compensation");
for (const [id, pts] of out.comp) console.log(`  ${tagOf(id)}: +${pts} points`);
if (out.comp.length === 0) console.log("  none");
console.log(
  out.gone.length === 0
    ? "Every loser lives on."
    : `Gone: ${out.gone.map(tagOf).join(", ")}`,
);
