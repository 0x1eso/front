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
 * standing in them), supply and pocket kills. Writes <out>/<seed>.json and
 * prints a compact summary. It only reports; nothing in the game changes.
 */
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
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
  let ctx: SimContext;
  let land: WwLand;
  const open = new Map<number, BattleRec>();
  const lastWon = new Map<number, number>();

  const ext = {
    start(c: SimContext) {
      ctx = c;
      land = (c.ww as unknown as { land: WwLand }).land;
      const sc = land.scenario;
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
      const ww = ctx.ww;
      const sc = land.scenario;
      const t = land.divisions;
      const owners = ww.politics.legalOwner;
      for (const tag of WATCH) {
        const id = ctx.idOf(tag);
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
          if (n === 0) empty++;
          else if (n === 1) one++;
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
    }),
  );
  console.log(
    `${seed}: ${res.seconds.toFixed(0)}s, caps ${res.caps.map((x) => `${x.tag}@${iso(x.day)}`).join(" ")}`,
  );
  void dayOfDate;
}

void main();
