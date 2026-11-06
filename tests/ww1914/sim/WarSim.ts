// Great War 1914: what the war does when nobody decides (ww135 lane Y). Whole
// `full` games with a seat that signs whatever the chief brings first and takes
// each card's fallback: the shapes the rules make by themselves. Reads no scene.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import {
  GW_LINES,
  GW_THEATRES,
  GwCalendarId,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { wwRunnerCapture } from "../../ww1936/util";
import { HUMAN } from "../util";

export interface GwShape {
  id: string;
  tag: GwTag;
  warMonth: string | null;
  endMonth: string;
  ending: string;
  armistice: string | null;
  plan: string | null;
  /** Theatre -> line at each 1 January, then at the end. */
  lines: Partial<Record<GwTheatre, string[]>>;
  /** Tag -> month it came in. */
  entered: Record<string, string>;
  /** Tag -> month it went out. */
  out: Record<string, string>;
  /** Tag -> how it went out. */
  outWhy: Record<string, string>;
  /** Tag -> final form of government. */
  regimes: Record<string, string>;
  casualties: Record<string, number>;
  battles: Partial<Record<GwTheatre, number>>;
  moved: Partial<Record<GwTheatre, number>>;
  uboat: number;
  blockade: number;
  shipping: number;
  unrestMax: Record<string, number>;
  techs: Record<string, string[]>;
  gauges: Record<string, string>;
  bands: Record<string, string>;
  /** One line a chapter, for reading one game through. */
  trace: string[];
}

const ym = (gw: GreatWar) => {
  const d = civilFromDays(gw.s.day);
  return `${d.year}-${String(d.month).padStart(2, "0")}`;
};

const WATCH: GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "USA",
  "JPN",
  "SRB",
  "ROU",
  "BGR",
  "GRC",
];

/** One hands-off game with the seat on `tag`. */
export async function warShape(
  id: string,
  tag: GwTag,
  calendar: GwCalendarId = "full",
  forceWar = true,
): Promise<GwShape> {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Singleplayer,
      greatWar1914Calendar: calendar,
    },
    [{ clientID: HUMAN, gwCountry: tag }],
    undefined,
    id,
  );
  for (let i = 0; i < 2; i++) {
    runner.addTurn({ turnNumber: runner.game.ticks(), intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  const shape: GwShape = {
    id,
    tag,
    warMonth: null,
    endMonth: "",
    ending: "",
    armistice: null,
    plan: null,
    lines: {},
    entered: {},
    out: {},
    outWhy: {},
    regimes: {},
    casualties: {},
    battles: {},
    moved: {},
    uboat: 0,
    blockade: 0,
    shipping: 0,
    unrestMax: {},
    techs: {},
    gauges: {},
    bands: {},
    trace: [],
  };
  const stamp = () => {
    for (const t of GW_THEATRES) {
      const th = gw.s.theatres.find((x) => x.id === t)!;
      if (th.since === null) continue;
      (shape.lines[t] ??= []).push(GW_LINES[t][th.line]);
    }
  };
  let month = -1;
  for (let guard = 0; guard < 80 && gw.s.ended === null; guard++) {
    if (forceWar && gw.s.chapter === 5 && gw.s.warChapter === null) {
      gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
      gw.s.temp = 9;
    }
    const seat = gw.s.seats[0];
    seat.ready = true;
    advanceChapter(gw, runner.game.ticks(), false);
    const d = civilFromDays(gw.s.day);
    if (d.month === 1 && d.month !== month) stamp();
    month = d.month;
    if (gw.s.warChapter !== null) shape.warMonth ??= ym(gw);
    const g = (t: GwTag) => {
      const n = gw.nation(t)!;
      const x = n.gauges;
      const a = n.alloc ?? (t === tag ? gw.s.seats[0].alloc : null);
      return `${t} s${x.shells}b${x.bread}$${x.money}m${x.morale}o${x.order} u${n.unrest}L${n.lowOrder} men${n.manpower} w${n.strength.west ?? "-"}e${n.strength.east ?? "-"} ${a?.main ?? "-"}/${a?.posture[0] ?? "-"}${a?.scale[0] ?? "-"}`;
    };
    const last = gw.s.battles.filter(
      (b) => b.chapter === gw.s.chapter - 1 && b.by !== null,
    );
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    const east = gw.s.theatres.find((t) => t.id === "east")!;
    shape.trace.push(
      `${ym(gw)} W${west.line}.${west.progress}t${west.trench} E${east.line}.${east.progress}t${east.trench} blk${gw.s.blockade} ${g("DEU")} | ${g("FRA")} | ${g("RUS")} | ${g("AUH")} | ${g("OTT")} | ${last.map((b) => `${b.theatre[0]}${b.theatre[1]}:${b.by![0]}:${b.result}:${b.lost}`).join(" ")}`,
    );
    for (const n of gw.s.nations) {
      if (n.side !== null) shape.entered[n.tag] ??= ym(gw);
      if (n.out) shape.out[n.tag] ??= ym(gw);
      shape.unrestMax[n.tag] = Math.max(shape.unrestMax[n.tag] ?? 0, n.unrest);
    }
  }
  stamp();
  for (const x of gw.s.news) {
    if (x.a !== null && /^(nation_|sued)/.test(x.key)) {
      shape.outWhy[x.a] ??= x.key;
    }
  }
  shape.endMonth = ym(gw);
  shape.ending = gw.s.seats[0].memoir?.ending ?? String(gw.s.ended);
  shape.armistice = gw.s.armistice?.kind ?? null;
  shape.plan = gw.s.plan;
  shape.uboat = gw.s.uboat;
  shape.blockade = gw.s.blockade;
  shape.shipping = gw.s.shipping;
  for (const tagN of WATCH) {
    const n = gw.nation(tagN);
    if (n === null) continue;
    if (n.regime !== "") shape.regimes[tagN] = n.regime;
    shape.casualties[tagN] = n.casualties;
    shape.techs[tagN] = n.techs;
    const g = n.gauges;
    shape.gauges[tagN] =
      `s${g.shells} b${g.bread} $${g.money} m${g.morale} o${g.order} men${n.manpower}`;
    shape.bands[tagN] = JSON.stringify(n.strength);
  }
  for (const b of gw.s.battles) {
    if (b.by === null) continue;
    shape.battles[b.theatre] = (shape.battles[b.theatre] ?? 0) + 1;
    if (b.result === "advance" || b.result === "break") {
      shape.moved[b.theatre] = (shape.moved[b.theatre] ?? 0) + 1;
    }
  }
  return shape;
}

const count = <T extends string>(list: T[]): Record<string, number> => {
  const o: Record<string, number> = {};
  for (const x of list) o[x] = (o[x] ?? 0) + 1;
  return o;
};

const sorted = (o: Record<string, number>) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[s.length >> 1];
};

/** The report: how the games came out, country by country, front by front. */
export function warReport(shapes: readonly GwShape[]): string {
  const lines: string[] = [];
  const n = shapes.length;
  lines.push(`${n} games`);
  lines.push(`endings: ${sorted(count(shapes.map((s) => s.ending)))}`);
  lines.push(
    `armistice: ${sorted(count(shapes.map((s) => s.armistice ?? "none")))}`,
  );
  lines.push(
    `end year: ${sorted(count(shapes.map((s) => s.endMonth.slice(0, 4))))}`,
  );
  lines.push(`plan: ${sorted(count(shapes.map((s) => s.plan ?? "none")))}`);
  for (const t of GW_THEATRES) {
    const last = shapes.flatMap((s) => {
      const l = s.lines[t];
      return l === undefined ? [] : [l[l.length - 1]];
    });
    const fights = shapes.map((s) => s.battles[t] ?? 0);
    const moved = shapes.map((s) => s.moved[t] ?? 0);
    lines.push(
      `${t}: end ${sorted(count(last))} | battles ${median(fights)} moved ${median(moved)}`,
    );
  }
  const west = shapes.map((s) => (s.lines.west ?? []).join(">"));
  lines.push(`west paths: ${sorted(count(west)).slice(0, 400)}`);
  for (const tag of WATCH) {
    const inn = shapes.flatMap((s) => s.entered[tag] ?? []);
    const out = shapes.flatMap((s) => s.out[tag] ?? []);
    const cas = shapes.map((s) => s.casualties[tag] ?? 0);
    const reg = shapes.flatMap((s) => s.regimes[tag] ?? []);
    const why = shapes.flatMap((s) => s.outWhy[tag] ?? []);
    const year = (x: string[]) => sorted(count(x.map((y) => y.slice(0, 4))));
    lines.push(
      `${tag}: in ${inn.length} (${year(inn)}) out ${out.length} (${year(out)}; ${sorted(count(why))}) dead+wounded med ${median(cas)}k${reg.length > 0 ? ` | ${sorted(count(reg))}` : ""} | unrest top ${median(shapes.map((s) => s.unrestMax[tag] ?? 0))}`,
    );
  }
  lines.push(
    `uboat: ${sorted(count(shapes.map((s) => String(s.uboat))))} | blockade med ${median(shapes.map((s) => s.blockade))} shipping med ${median(shapes.map((s) => s.shipping))}`,
  );
  const tech = shapes.flatMap((s) => Object.values(s.techs).flat());
  lines.push(`techs: ${sorted(count(tech))}`);
  return lines.join("\n");
}
