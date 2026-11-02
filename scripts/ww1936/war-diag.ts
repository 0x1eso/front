/**
 * World War 1936 land-war diagnosis (w6-wardiag): why the majors fall
 * early. One real-map game per seed, historical AI on, until --until:
 *
 *   npx tsx scripts/ww1936/war-diag.ts --seed WWSIM002 [--until 1942-01-01]
 *       [--out .cache/war-diag]
 *
 * Records every battle (attacker, defender, divisions on each side at the
 * peak, rounds, the preview ratio when it opened, terrain, fort, entrench,
 * outcome), every region that changes hands (how: after a won battle or
 * walked into empty), daily front coverage of the watched countries
 * (border regions facing an enemy at war with no division of the side
 * standing in them, and why: on the way, in a zone nobody came to, a line
 * held behind, too few divisions, or nobody's), supply and pocket kills.
 * Writes <out>/<seed>.json and prints a compact summary. It only reports;
 * nothing in the game changes.
 */
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import { effectiveLevel } from "@openfront/engine/ww1936/economy/Buildings";
import { predictAttack } from "@openfront/engine/ww1936/land/Plans";
import type { Battle, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import fs from "fs";
import path from "path";
import { iso, runOne, SimContext } from "./endgame-sim";

const WATCH: readonly CountryTag[] = [
  "DEU",
  "FRA",
  "ITA",
  "POL",
  "GBR",
  "SUN",
  "BEL",
  "NLD",
  "JPN",
  "USA",
];

/** The majors the balance targets speak of (ww7 lane F). */
const MAJORS: readonly CountryTag[] = [
  "DEU",
  "FRA",
  "GBR",
  "ITA",
  "SUN",
  "JPN",
];

interface BattleRec {
  region: number;
  name: string;
  start: number;
  end: number;
  att: string;
  def: string;
  attMax: number;
  defMax: number;
  defStart: number;
  rounds: number;
  ratioPm: number;
  terrain: string;
  fort: number;
  entrench: number;
  river: number;
  outcome: "won" | "held" | "open";
}
interface CapRec {
  day: number;
  region: number;
  name: string;
  vp: number;
  tiles: number;
  from: string;
  to: string;
  legal: string;
  how: "battle" | "walk" | "capitulation";
}
interface CovRec {
  day: number;
  tag: string;
  border: number;
  empty: number;
  one: number;
  divs: number;
  inFront: number;
  supplyPm: number;
  enc: number;
  vpLostPct: number;
  surr: number;
  gauge: number;
  /** ww7 lane F: of `empty`: divisions of the side are on their way. */
  headed: number;
  /** Of `empty`, nobody on the way: an army of the country has it in its zone. */
  zoned: number;
  /** Of the rest: the country holds a shortened line behind the border. */
  ring: number;
  /** Of the rest: the country has fewer divisions than border regions. */
  few: number;
  /** Of the rest: enough divisions, no line behind, no zone: nobody's job. */
  orphan: number;
  /** Divisions of the countries at war with this one. */
  enemyDivs: number;
  /** ww7 lane F: the country's divisions on the move today, and those sent somewhere else than yesterday. */
  moving: number;
  redirected: number;
}

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

async function main() {
  const seed = arg("--seed", "WWSIM001");
  const until = arg("--until", "1942-01-01");
  const out = arg("--out", ".cache/war-diag");
  fs.mkdirSync(out, { recursive: true });
  const battles: BattleRec[] = [];
  const caps: CapRec[] = [];
  const cov: CovRec[] = [];
  const kills: { day: number; tag: string; enc: boolean }[] = [];
  const wars: { day: number; a: string; b: string; kind: string }[] = [];
  const orphans = new Map<string, number>();
  let ctx: SimContext | undefined;
  let land: WwLand;
  const open = new Map<number, BattleRec>();
  const lastWon = new Map<number, number>();
  const lastDest = new Map<number, number>();

  const ext = {
    start(c: SimContext) {
      ctx = c;
      land = (c.ww as unknown as { land: WwLand }).land;
      const sc = land.scenario;
      // ww7 lane F: who went to war with whom, and how (the politics' side).
      const setWar = c.ww.setWar.bind(c.ww);
      c.ww.setWar = ((a: number, b: number, tick: number, link?: unknown) => {
        const did = (
          setWar as (a: number, b: number, t: number, l?: unknown) => boolean
        )(a, b, tick, link);
        if (did) {
          wars.push({
            day: c.today(),
            a: c.tagOf(a),
            b: c.tagOf(b),
            kind: (link as { kind?: string } | undefined)?.kind ?? "-",
          });
        }
        return did;
      }) as typeof c.ww.setWar;
      const name = (r: number) => sc.region(r)?.name ?? `${r}`;
      const addBattle = land.addBattle.bind(land);
      land.addBattle = (b: Battle) => {
        addBattle(b);
        open.set(b.region, {
          region: b.region,
          name: name(b.region),
          start: c.today(),
          end: -1,
          att: c.tagOf(b.attLead),
          def: c.tagOf(land.controller[b.region]),
          attMax: 0,
          defMax: 0,
          defStart: -1,
          rounds: 0,
          ratioPm: -1,
          terrain: sc.landOf(b.region),
          fort: effectiveLevel(land.econ, b.region, "fort"),
          entrench: -1,
          river: 0,
          outcome: "open",
        });
      };
      const endBattle = land.endBattle.bind(land);
      land.endBattle = (region: number) => {
        const b = land.battles.get(region);
        const rec = open.get(region);
        if (b !== undefined && rec !== undefined) {
          rec.end = c.today();
          rec.rounds = b.round;
          rec.outcome = b.attackers.length === 0 ? "held" : "won";
          if (rec.outcome === "won") lastWon.set(region, c.today());
          battles.push(rec);
          open.delete(region);
        }
        endBattle(region);
      };
      const setController = land.setController.bind(land);
      land.setController = (
        region: number,
        by: number,
        tick: number,
        notify = true,
      ) => {
        const from = land.controller[region];
        if (from !== by && c.today() > 0) {
          const r = sc.region(region)!;
          const won = lastWon.get(region);
          const capd = c.ww.isCapitulated(from);
          caps.push({
            day: c.today(),
            region,
            name: r.name,
            vp: r.vp,
            tiles: (r as unknown as { tiles: number }).tiles ?? 0,
            from: c.tagOf(from),
            to: c.tagOf(by),
            legal: c.tagOf(c.ww.politics.legalOwner[region]),
            how: capd
              ? "capitulation"
              : won !== undefined && c.today() - won <= 20
                ? "battle"
                : "walk",
          });
        }
        setController(region, by, tick, notify);
      };
      const kill = land.killDivision.bind(land);
      land.killDivision = (row: number, destroyed: boolean) => {
        if (destroyed && c.today() > 0) {
          kills.push({
            day: c.today(),
            tag: c.tagOf(land.divisions.owner[row]),
            enc: land.divisions.encircled[row] !== 0,
          });
        }
        kill(row, destroyed);
      };
    },
    tick() {
      if (open.size === 0) return;
      const t = land.divisions;
      for (const [region, rec] of open) {
        const b = land.battles.get(region);
        if (b === undefined) continue;
        rec.attMax = Math.max(rec.attMax, b.attackers.length);
        rec.defMax = Math.max(rec.defMax, b.defenders.length);
        if (rec.ratioPm < 0 && b.round >= 1 && b.attackers.length > 0) {
          const rows = b.attackers
            .map((id) => t.rowOf(id))
            .filter((r) => r >= 0);
          rec.ratioPm = Math.min(
            99_999,
            predictAttack(land, rows, region).ratioPm,
          );
          rec.defStart = b.defenders.length;
          let e = 0;
          for (const id of b.defenders)
            e = Math.max(e, t.entrench[t.rowOf(id)] ?? 0);
          rec.entrench = e;
          const sc = land.scenario;
          for (const r of rows) {
            const eb = sc.edgeBetween(t.region[r], region);
            if (eb >= 0) rec.river = Math.max(rec.river, sc.edge(eb).river);
          }
        }
      }
    },
    day(done: number) {
      const c = ctx!;
      const ww = c.ww;
      const sc = land.scenario;
      const t = land.divisions;
      const owners = ww.politics.legalOwner;
      for (const tag of WATCH) {
        const id = c.idOf(tag);
        if (!ww.hasWar(id) || ww.isCapitulated(id)) continue;
        // Standing divisions of the side by region.
        const standing = new Map<number, number>();
        let divs = 0;
        let sup = 0;
        let enc = 0;
        for (let r = 0; r < t.rows; r++) {
          if (t.id[r] === 0) continue;
          if (t.owner[r] === id) {
            divs++;
            sup += t.supply[r];
            if (t.encircled[r] !== 0) enc++;
          }
          if (!land.sameSide(id, land.fightOwner(r))) continue;
          if (t.mode[r] !== MOVE_NONE && t.battle[r] === 0) continue;
          standing.set(t.region[r], (standing.get(t.region[r]) ?? 0) + 1);
        }
        let border = 0;
        let empty = 0;
        let one = 0;
        // ww7 lane F: why a border region stands empty.
        const onWay = new Set<number>();
        let enemyDivs = 0;
        for (let r = 0; r < t.rows; r++) {
          if (t.id[r] === 0) continue;
          if (ww.isAtWar(id, t.owner[r])) enemyDivs++;
          if (!land.sameSide(id, land.fightOwner(r))) continue;
          if (t.mode[r] !== MOVE_NONE) {
            onWay.add(t.dest[r]);
            onWay.add(t.next[r]);
          }
        }
        const zoned = new Set<number>();
        let behind = false;
        for (const a of land.armiesOf(id)) {
          if (a.order.kind !== "front" && a.order.kind !== "plan") continue;
          for (const r of a.front) zoned.add(r);
        }
        const isBorder = (r: number) => {
          for (const e of sc.edgesOf(r)) {
            if (sc.edge(e.edge).strait !== 0) continue;
            const c = land.controller[e.to];
            if (c > 0 && c !== id && ww.isAtWar(id, c)) return true;
          }
          return false;
        };
        for (const r of zoned) if (!isBorder(r)) behind = true;
        let nBorder = 0;
        for (const reg of sc.landRegions) {
          if (land.controller[reg.id] === id && isBorder(reg.id)) nBorder++;
        }
        const borderDivsShort = divs < nBorder;
        let moving = 0;
        let redirected = 0;
        for (let r = 0; r < t.rows; r++) {
          if (t.id[r] === 0 || t.owner[r] !== id) continue;
          if (t.mode[r] !== MOVE_NONE) moving++;
          const was = lastDest.get(t.id[r]);
          if (was !== undefined && was !== t.dest[r]) redirected++;
          lastDest.set(t.id[r], t.dest[r]);
        }
        let headed = 0;
        let inZone = 0;
        let ring = 0;
        let few = 0;
        let orphan = 0;
        for (const reg of sc.landRegions) {
          if (land.controller[reg.id] !== id) continue;
          let faces = false;
          for (const e of sc.edgesOf(reg.id)) {
            if (sc.edge(e.edge).strait !== 0) continue;
            const c = land.controller[e.to];
            if (c > 0 && c !== id && ww.isAtWar(id, c)) {
              faces = true;
              break;
            }
          }
          if (!faces) continue;
          border++;
          const n = standing.get(reg.id) ?? 0;
          if (n === 0) {
            empty++;
            if (onWay.has(reg.id)) headed++;
            else if (zoned.has(reg.id)) inZone++;
            else if (behind) ring++;
            else if (borderDivsShort) few++;
            else {
              orphan++;
              const key = `${tag} ${reg.name}`;
              orphans.set(key, (orphans.get(key) ?? 0) + 1);
            }
          } else if (n === 1) one++;
        }
        let inFront = 0;
        for (const a of land.armiesOf(id)) {
          if (a.order.kind === "front" || a.order.kind === "plan") {
            inFront += a.divisions.length;
          }
        }
        let start = 0;
        let held = 0;
        for (const reg of sc.landRegions) {
          if (owners[reg.id] !== id) continue;
          start += reg.vp;
          if (land.controller[reg.id] === id) held += reg.vp;
        }
        cov.push({
          day: done,
          tag,
          border,
          empty,
          one,
          divs,
          inFront,
          supplyPm: divs === 0 ? 0 : Math.floor(sup / divs),
          enc,
          vpLostPct:
            start === 0 ? 0 : Math.floor(((start - held) * 100) / start),
          surr: ww.politics.surrenderPct(id),
          gauge: ww.capitulationGauge(id),
          headed,
          zoned: inZone,
          ring,
          few,
          orphan,
          enemyDivs,
          moving,
          redirected,
        });
      }
    },
    end() {},
  };

  const csv = path.join(out, `${seed}.csv`);
  const res = await runOne(seed, true, until, csv, false, ext);
  for (const rec of open.values()) battles.push(rec);
  fs.writeFileSync(
    path.join(out, `${seed}.json`),
    JSON.stringify({
      seed,
      until,
      caps: res.caps,
      battles,
      captures: caps,
      cov,
      kills,
      wars,
    }),
  );
  console.log(
    `${seed}: ${res.seconds.toFixed(0)}s, caps ${res.caps.map((x) => `${x.tag}@${iso(x.day)}`).join(" ")}`,
  );
  summary(battles, caps, cov);
  const top = [...orphans].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`  orphans: ${top.map(([k, v]) => `${k} ${v}d`).join(", ")}`);
  // The seeded deviations from history (WwPolitics.branchDeviations), major by major.
  const dev = [...ctx!.ww.politics.branchDeviations]
    .filter(
      ([k, v]) => v !== null && MAJORS.includes(k.slice(0, 3) as CountryTag),
    )
    .map(([k, v]) => `${k}=${v}`);
  console.log(`  deviations: ${dev.join(" ") || "-"}`);
  const pairs = wars.filter(
    (w) =>
      MAJORS.includes(w.a as CountryTag) && MAJORS.includes(w.b as CountryTag),
  );
  console.log(
    `  major wars: ${pairs.map((w) => `${iso(w.day)} ${w.a}>${w.b}(${w.kind})`).join(" ")}`,
  );
}

/** ww7 lane F: what the balance targets read, per seed. */
function summary(
  battles: readonly BattleRec[],
  caps: readonly CapRec[],
  cov: readonly CovRec[],
): void {
  const sum = (xs: readonly CovRec[], k: keyof CovRec) =>
    xs.reduce((n, x) => n + (x[k] as number), 0);
  const pct = (a: number, b: number) =>
    b === 0 ? "-" : `${((100 * a) / b).toFixed(1)}%`;
  const tags = [...new Set(cov.map((c) => c.tag))];
  const row = (label: string, xs: readonly CovRec[]) => {
    const b = sum(xs, "border");
    const e = sum(xs, "empty");
    return (
      `  ${label.padEnd(4)} border-days ${String(b).padStart(6)} empty ${pct(e, b).padStart(6)}` +
      `  headed ${pct(sum(xs, "headed"), b).padStart(6)} zoned ${pct(sum(xs, "zoned"), b).padStart(6)}` +
      ` ring ${pct(sum(xs, "ring"), b).padStart(6)} few ${pct(sum(xs, "few"), b).padStart(6)} orphan ${pct(sum(xs, "orphan"), b).padStart(6)}`
    );
  };
  console.log(row("ALL", cov));
  for (const tag of tags) {
    console.log(
      row(
        tag,
        cov.filter((c) => c.tag === tag),
      ),
    );
  }
  const how = (h: CapRec["how"]) => caps.filter((c) => c.how === h).length;
  console.log(
    `  captures battle ${how("battle")} walk ${how("walk")} capitulation ${how("capitulation")}; ` +
      `battles ${battles.length} (won ${battles.filter((b) => b.outcome === "won").length}, held ${battles.filter((b) => b.outcome === "held").length})`,
  );
  // Target 3: a major's first 60 days of war, at under 2:1.
  for (const tag of MAJORS) {
    const xs = cov.filter((c) => c.tag === tag);
    if (xs.length === 0) continue;
    const first = xs[0];
    const at60 = xs.filter((c) => c.day <= first.day + 60);
    const last = at60[at60.length - 1];
    const ratio = at60.reduce(
      (m, c) => Math.max(m, c.enemyDivs / Math.max(1, c.divs)),
      0,
    );
    const end = xs[xs.length - 1];
    console.log(
      `  ${tag} war from ${iso(first.day)}: VP lost at +60 d ${last.vpLostPct}% at ${ratio.toFixed(1)}:1 (peak); ` +
        `at the end ${iso(end.day)}: VP lost ${end.vpLostPct}%, divs ${end.divs} v ${end.enemyDivs}, line ${end.surr}, gauge ${end.gauge}`,
    );
  }
}

void main();
