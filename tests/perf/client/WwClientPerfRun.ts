/**
 * WwClientPerf.test.ts's body (imported only when the run is on, so the
 * skipped test costs the suite nothing).
 *
 * World War 1936 client per-tick costs, headless (no browser): replays a
 * game recorded by WwRecord.ts into a real GameView and, after each tick,
 * runs what the renderer and the HUD redo on a new tick, each timed on its
 * own — the fog model, the army and fleet token layouts and passes (a
 * no-op WebGL), the battle markers, the land flags, the occupation and
 * peace map passes, the strike effects, and the top band's tick and render.
 *
 * Skipped unless WW_PERF_FIXTURE names a recording:
 *
 *   npx tsx tests/perf/client/WwRecord.ts --out /tmp/ww.bin.gz
 *   WW_PERF_FIXTURE=/tmp/ww.bin.gz [WW_PERF_HUMAN=DEU (the recording's)]
 *     [WW_PERF_FROM=1939-09-01] [WW_PERF_PROFILE=out.cpuprofile]
 *     [WW_PERF_OUT=report.txt] [WW_PERF_CHECK=1]
 *     node --max-semi-space-size=256 node_modules/vitest/vitest.mjs run \
 *       tests/perf/client/WwClientPerf.test.ts
 *
 * The client is the recording's human (its country's screens and fog).
 * WW_PERF_CHECK=1 also asks the old full-rebuild fog (FogModelReference)
 * every question after each tick, untimed, and fails on a difference.
 *
 * Times are wall ms per tick over the window from WW_PERF_FROM; "alloc"
 * is the young-generation bytes a part allocated per tick (heap growth
 * across the call, intervals with a collection in them left out — run
 * with a large semi-space for few of those).
 */
import "./Shims";

import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { EventBus } from "@openfront/shared/EventBus";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import { Session } from "node:inspector";
import v8 from "v8";
import { expect } from "vitest";
import zlib from "zlib";
import {
  occupationMapSource,
  occupationModeOf,
} from "../../../src/client/hud/ww1936/EndgameModel";
import { fogModelOf } from "../../../src/client/hud/ww1936/FogModel";
import { landWarInputsOf } from "../../../src/client/hud/ww1936/LandModel";
import { landSelectionOf } from "../../../src/client/hud/ww1936/LandSelection";
import {
  peaceMapSource,
  peaceUiOf,
} from "../../../src/client/hud/ww1936/PeaceModel";
import { SeaAirSelection } from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwTopBand";
import type { WwTopBand } from "../../../src/client/hud/ww1936/WwTopBand";
import { ArmyTokenPass } from "../../../src/client/render/gl/passes/ArmyTokenPass";
import { BattleMarkerPass } from "../../../src/client/render/gl/passes/BattleMarkerPass";
import {
  FleetTokenPass,
  ShipSpriteProgram,
} from "../../../src/client/render/gl/passes/FleetTokenPass";
import { NavalBattleMarkerPass } from "../../../src/client/render/gl/passes/NavalBattleMarkerPass";
import { OccupationPass } from "../../../src/client/render/gl/passes/OccupationPass";
import { PeaceMapPass } from "../../../src/client/render/gl/passes/PeaceMapPass";
import { PlanArrowPass } from "../../../src/client/render/gl/passes/PlanArrowPass";
import {
  FLAG_TEX_SIZE,
  regionFlagBytes,
} from "../../../src/client/render/gl/passes/RegionBorderPass";
import {
  FleetLayoutCache,
  fleetLod,
} from "../../../src/client/view/FleetTokenLayout";
import { GameView } from "../../../src/client/view/GameView";
import { LandFrontWorld } from "../../../src/client/view/LandFrontWorld";
import {
  TokenLayoutCache,
  tokenLod,
} from "../../../src/client/view/LandTokenLayout";
import type { WorkerClient } from "../../../src/client/WorkerClient";
import { compareFog, newCoverage } from "../../client/ww1936/FogCompare";
import { FogModelReference } from "../../client/ww1936/FogModelReference";
import { CpuProfiler, summarizeCpuProfile } from "../fullgame/Profiler";
import { PERF_HUMAN, wwMapLoader, wwPerfStart } from "./WwRecord";

export const FIXTURE = process.env.WW_PERF_FIXTURE ?? "";
const HUMAN = process.env.WW_PERF_HUMAN ?? "DEU";
const FROM = process.env.WW_PERF_FROM ?? "1939-09-01";
const PROFILE = process.env.WW_PERF_PROFILE ?? "";
const CHECK = process.env.WW_PERF_CHECK === "1";
/** Sample allocations over the window (the heap profiler) and print the top sites. */
const HEAP = process.env.WW_PERF_HEAP === "1";

interface HeapNode {
  callFrame: { functionName: string; url: string; lineNumber: number };
  selfSize: number;
  children: HeapNode[];
}

class HeapSampler {
  private session = new Session();
  private post(method: string, params?: object): Promise<unknown> {
    return new Promise((resolve, reject) =>
      this.session.post(method, params, (err, res) =>
        err ? reject(err) : resolve(res),
      ),
    );
  }
  async start(): Promise<void> {
    this.session.connect();
    await this.post("HeapProfiler.enable");
    await this.post("HeapProfiler.startSampling", {
      samplingInterval: 512,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
  }
  async stop(): Promise<string> {
    const { profile } = (await this.post("HeapProfiler.stopSampling")) as {
      profile: { head: HeapNode };
    };
    this.session.disconnect();
    const by = new Map<string, number>();
    const walk = (n: HeapNode) => {
      const f = n.callFrame;
      const k = `${f.functionName || "(anonymous)"} ${f.url.replace(/^.*\/(src|packages|tests|node_modules)\//, "$1/")}:${f.lineNumber + 1}`;
      by.set(k, (by.get(k) ?? 0) + n.selfSize);
      for (const c of n.children) walk(c);
    };
    walk(profile.head);
    return [...by.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([k, v]) => `${(v / 1024 / 1024).toFixed(1).padStart(7)} MB  ${k}`)
      .join("\n");
  }
}
/** The report also goes to this file (vitest may hold the console back). */
const OUT = process.env.WW_PERF_OUT ?? "";
/** Screen px per tile: a phone's country-sized view (number chips). */
const ZOOM = 2;

/** resources/lang/<lang>.json flattened, as LangSelector keeps it. */
function flatLang(lang: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (o: Record<string, unknown>, at: string) => {
    for (const [k, v] of Object.entries(o)) {
      const key = at === "" ? k : `${at}.${k}`;
      if (typeof v === "string") out[key] = v;
      else if (v !== null && typeof v === "object") {
        walk(v as Record<string, unknown>, key);
      }
    }
  };
  walk(JSON.parse(fs.readFileSync(`resources/lang/${lang}.json`, "utf8")), "");
  return out;
}

/**
 * The page around the HUD: a lang-selector with this fork's Korean (the
 * band's labels go through the real ICU formatting) and the top-right
 * stack the band measures itself against.
 */
function hudPage(): void {
  const lang = Object.assign(document.createElement("lang-selector"), {
    currentLang: "ko",
    translations: flatLang("ko"),
    defaultTranslations: flatLang("en"),
  });
  document.body.appendChild(lang);
  const stack = document.createElement("div");
  stack.setAttribute("data-hud-top-right", "");
  document.body.appendChild(stack);
}

/** A WebGL2 stand-in: enums read 0, every call returns a truthy object. */
function fakeGL(): WebGL2RenderingContext {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "getParameter") return () => 256;
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        if (/^[A-Z0-9_]+$/.test(prop)) return 0;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
}

function* frames(file: string): Generator<GameUpdateViewData> {
  const raw = zlib.gunzipSync(fs.readFileSync(file));
  let o = 0;
  while (o < raw.length) {
    const n = raw.readUInt32LE(o);
    o += 4;
    yield v8.deserialize(raw.subarray(o, o + n)) as GameUpdateViewData;
    o += n;
  }
}

function report(text: string): void {
  process.stdout.write(`${text}\n`);
  if (OUT !== "") fs.appendFileSync(OUT, `${text}\n`);
}

class Part {
  ms: number[] = [];
  bytes = 0;
  clean = 0;
  private t = 0;
  private h = 0;
  constructor(readonly name: string) {}
  begin(): void {
    this.h = v8.getHeapStatistics().used_heap_size;
    this.t = performance.now();
  }
  end(record: boolean): void {
    const dt = performance.now() - this.t;
    const dh = v8.getHeapStatistics().used_heap_size - this.h;
    if (!record) return;
    this.ms.push(dt);
    if (dh >= 0) {
      this.bytes += dh;
      this.clean++;
    }
  }
  row(): string {
    const s = [...this.ms].sort((a, b) => a - b);
    const n = s.length;
    const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const at = (p: number) => s[Math.min(n - 1, Math.floor(n * p))] ?? 0;
    const kb = this.clean === 0 ? 0 : this.bytes / this.clean / 1024;
    return `${this.name.padEnd(16)} mean ${mean.toFixed(3).padStart(7)}  p50 ${at(0.5).toFixed(3).padStart(7)}  p95 ${at(0.95).toFixed(3).padStart(7)}  max ${at(1).toFixed(2).padStart(7)}  alloc ${kb.toFixed(1).padStart(7)} KB/tick`;
  }
}

/** Replays the recording WW_PERF_FIXTURE names and prints the report. */
export async function runWwClientPerf(): Promise<void> {
  const start = wwPerfStart("WWPERF01", HUMAN);
  const terrain = await loadTerrainMap(
    await loadMapFiles(
      wwMapLoader(),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
  );
  const view = new GameView(
    {} as WorkerClient,
    new Config(start.config, false),
    terrain,
    PERF_HUMAN,
    "perf",
    null,
    start.gameID,
    start.players as never,
  );
  const sc = view.worldWarScenario()!;
  const obs = sc.countries.indexOf(HUMAN as never) + 1;
  expect(obs).toBeGreaterThan(0);
  const land = view.wwLand()!;
  const navy = view.wwNavy()!;
  const air = view.wwAir()!;
  const fog = fogModelOf(view);
  const ref = CHECK ? new FogModelReference(view) : null;
  const cov = newCoverage();
  const gl = fakeGL();
  const tex = {} as WebGLTexture;
  const sel = landSelectionOf(view);
  const world = new LandFrontWorld(land, landWarInputsOf(view));
  const tokenLayout = new TokenLayoutCache();
  const armyTokens = new ArmyTokenPass(gl, tex, tex);
  const battles = new BattleMarkerPass(gl, tex, tex);
  const arrows = new PlanArrowPass(gl);
  const sprites = new ShipSpriteProgram(gl, {}, {});
  const fleetLayout = new FleetLayoutCache();
  const fleetTokens = new FleetTokenPass(gl, sprites);
  const navalBattles = new NavalBattleMarkerPass(gl, {}, {});
  const seaSel = new SeaAirSelection();
  const flags = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE);
  const occSource = occupationMapSource(view);
  const occPass = new OccupationPass(
    gl,
    sc.regionIds,
    sc.width,
    sc.height,
    occSource,
  );
  const peaceSource = peaceMapSource(view);
  const peacePass = new PeaceMapPass(gl, sc.regionIds, sc.width, sc.height);
  hudPage();
  const band = document.createElement("ww-top-band") as WwTopBand;
  band.game = view;
  band.eventBus = new EventBus();
  document.body.appendChild(band);

  const parts = {
    view: new Part("GameView.update"),
    fog: new Part("fog"),
    tokenLayout: new Part("tokenLayout"),
    armyTokens: new Part("armyTokenPass"),
    battles: new Part("battleMarkers"),
    arrows: new Part("planArrows"),
    fleets: new Part("fleetLayout+pass"),
    navalBattles: new Part("navalBattles"),
    landFlags: new Part("landFlags"),
    occupation: new Part("occupationPass"),
    peace: new Part("peacePass"),
    band: new Part("topBand"),
    troops: new Part("troopLabels"),
  };
  const total = new Part("total (no view)");
  const fromTick = dayStartTick(dayOfDate(FROM), WW_PREP_TICKS);
  const profiler = PROFILE === "" ? null : new CpuProfiler();
  let profiling = false;
  const heap = HEAP ? new HeapSampler() : null;
  let sampling = false;
  let ticks = 0;
  let lastBand = -Infinity;
  let armies = 0;
  let fleets = 0;
  let landBattles = 0;
  let ghosts = 0;
  let shown = 0;
  let measured = 0;
  for (const gu of frames(FIXTURE)) {
    const rec = gu.tick >= fromTick;
    if (rec && profiler !== null && !profiling) {
      await profiler.start(200);
      profiling = true;
    }
    if (rec && heap !== null && !sampling) {
      await heap.start();
      sampling = true;
    }
    parts.view.begin();
    view.update(gu);
    parts.view.end(rec);
    const tick = gu.tick;
    const me = view.myPlayer()?.smallID() ?? 0;
    total.begin();
    parts.fog.begin();
    fog.stamp();
    parts.fog.end(rec);

    parts.tokenLayout.begin();
    const changed = tokenLayout.update(land, tick, ZOOM);
    parts.tokenLayout.end(rec);

    parts.armyTokens.begin();
    armyTokens.update(land, tokenLayout, changed, sel, me);
    parts.armyTokens.end(rec);

    parts.battles.begin();
    battles.update(land, tokenLod(ZOOM));
    parts.battles.end(rec);

    parts.arrows.begin();
    arrows.update(land, sel, me, 1 / ZOOM, world);
    parts.arrows.end(rec);

    parts.fleets.begin();
    const moved = fleetLayout.update(navy, tick, 0, ZOOM);
    fleetTokens.update(navy, fleetLayout, moved, seaSel);
    parts.fleets.end(rec);

    parts.navalBattles.begin();
    navalBattles.update(navy, fleetLod(ZOOM));
    parts.navalBattles.end(rec);

    parts.landFlags.begin();
    regionFlagBytes(land, sel, me, [], world, flags);
    parts.landFlags.end(rec);

    // The occupation map mode on while I administer regions, the
    // peace map while a conference is open (the modes a player turns on).
    parts.occupation.begin();
    const mode = occupationModeOf(view);
    if (!mode.on) mode.set(true);
    occPass.sync();
    parts.occupation.end(rec);

    parts.peace.begin();
    const ui = peaceUiOf(view);
    const conf = view.wwEndgame?.()?.conference() ?? null;
    if (ui.map !== (conf !== null)) ui.map = conf !== null;
    peacePass.update(peaceSource);
    parts.peace.end(rec);

    // The band ticks every 250 ms: 2.5 ticks of 100 ms.
    const at = tick * 100;
    if (at - lastBand >= 250) {
      lastBand = at;
      parts.band.begin();
      band.tick();
      await band.updateComplete;
      parts.band.end(rec);
    }

    // The name plates' troop rows: each country twice a second.
    parts.troops.begin();
    if (tick % 5 === 0) {
      for (let id = 1; id <= sc.countries.length; id++) {
        fog.troopsLabel(id, 123_456);
      }
    }
    parts.troops.end(rec);
    total.end(rec);

    if (ref !== null) {
      const d = compareFog(view, fog, ref, cov);
      if (d !== null) throw new Error(d);
    }
    if (rec) {
      measured++;
      armies += land.armies.size;
      fleets += navy.fleets.size;
      landBattles += land.battles.size;
      ghosts += fog.ghosts().length;
      for (const a of land.armies.values()) {
        if (fog.armyView(a.id).visible) shown++;
      }
    }
    ticks++;
    void air;
  }
  if (heap !== null) report(await heap.stop());
  if (profiler !== null) {
    const profile = await profiler.stop();
    fs.writeFileSync(PROFILE, JSON.stringify(profile));
    const top = summarizeCpuProfile(profile, process.cwd()).slice(0, 40);
    report(
      top
        .map(
          (r) =>
            `${r.selfMs.toFixed(0).padStart(7)} ms ${r.selfPct.toFixed(1).padStart(5)}%  ${r.functionName} ${r.location}`,
        )
        .join("\n"),
    );
  }
  report(
    [
      `${ticks} ticks replayed, ${measured} measured from ${FROM} (me ${HUMAN}, fog ${fog.fogOff() ? "off" : "on"} at the end); per tick: ${(armies / measured).toFixed(0)} armies, ${(fleets / measured).toFixed(0)} fleets, ${(landBattles / measured).toFixed(0)} land battles, ${(shown / measured).toFixed(0)} armies shown, ${(ghosts / measured).toFixed(1)} ghosts`,
      ...Object.values(parts).map((p) => p.row()),
      total.row(),
      ...(ref === null
        ? []
        : [
            `fog check: the old full rebuild agreed every tick: ${JSON.stringify(cov)}`,
          ]),
    ].join("\n"),
  );
}
