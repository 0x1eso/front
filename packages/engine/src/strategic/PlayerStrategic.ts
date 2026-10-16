import {
  INTERCEPTOR_NUKES,
  InterceptorData,
  NukeJobData,
  SatelliteData,
  STOCKPILED_NUKES,
  StockpiledNuke,
  StrategicData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";

const SatelliteStateSchema = z.object({
  phase: z.enum(["none", "preparing", "orbit", "targeted", "spent"]),
  siloId: zInt().optional(),
  startTick: zInt().optional(),
  readyTick: zInt().optional(),
  target: zInt().optional(),
  strikeTick: zInt().optional(),
  interceptors: z
    .array(
      z.object({
        by: zInt(),
        type: z.enum(INTERCEPTOR_NUKES),
        resolveTick: zInt(),
        from: zInt().optional(),
      }),
    )
    .optional(),
});
type SatelliteState = z.infer<typeof SatelliteStateSchema>;

/** An orbital strike still landing (spec §6.6); held by the attacker. */
const StrikeStateSchema = z.object({
  target: zInt(),
  startTick: zInt(),
  /** Next wave to land. */
  nextWave: zInt(),
  craterRadius: zInt(),
  sites: z.array(zInt()),
  craters: z.array(zInt()),
  /** Buildings destroyed and troops killed so far (for the result message). */
  buildings: zInt(),
  troops: zInt(),
});
export type StrikeState = z.infer<typeof StrikeStateSchema>;

export const StrategicStateSchema = z.object({
  /** In STOCKPILED_NUKES order: atom, hydrogen, MIRV. */
  stock: z.array(zInt()),
  jobs: z.array(
    z.object({
      factoryId: zInt(),
      type: z.enum(STOCKPILED_NUKES),
      startTick: zInt(),
      endTick: zInt(),
    }),
  ),
  satellite: SatelliteStateSchema,
  /** Present only while a strike is landing. */
  strike: StrikeStateSchema.optional(),
});
export type StrategicState = z.infer<typeof StrategicStateSchema>;

const slot = (type: StockpiledNuke): number => STOCKPILED_NUKES.indexOf(type);

/**
 * A player's strategic weapons (spec §4, §6): the stockpile, the nukes on
 * factory lines and the one satellite. Exists only with the option on.
 * Nothing here ticks: StrategicExecution and the orders drive it.
 */
export class PlayerStrategic {
  private stockCounts: number[] = STOCKPILED_NUKES.map(() => 0);
  private _jobs: NukeJobData[] = [];
  private _satellite: SatelliteData = { phase: "none" };
  private _strike: StrikeState | null = null;
  /** toData() result until the next change. */
  private strategicDataCache: StrategicData | null = null;

  stock(type: StockpiledNuke): number {
    return this.stockCounts[slot(type)];
  }

  addStock(type: StockpiledNuke): void {
    this.stockCounts[slot(type)]++;
    this.changed();
  }

  /** Takes one from the stockpile; false (and nothing taken) when there is none. */
  takeStock(type: StockpiledNuke): boolean {
    const i = slot(type);
    if (this.stockCounts[i] === 0) return false;
    this.stockCounts[i]--;
    this.changed();
    return true;
  }

  jobs(): readonly NukeJobData[] {
    return this._jobs;
  }

  startJob(job: NukeJobData): void {
    this._jobs.push({ ...job });
    this.changed();
  }

  /** Removes the jobs `lost` picks; returns how many went. */
  dropJobs(lost: (job: NukeJobData) => boolean): number {
    const before = this._jobs.length;
    this._jobs = this._jobs.filter((j) => !lost(j));
    if (this._jobs.length !== before) this.changed();
    return before - this._jobs.length;
  }

  /** Removes every job on `factoryId`; returns how many went. */
  cancelJobsAt(factoryId: number): number {
    return this.dropJobs((j) => j.factoryId === factoryId);
  }

  /** Moves every job done by `now` into the stockpile; returns them in start order. */
  finishJobs(now: number): NukeJobData[] {
    const done = this._jobs.filter((j) => j.endTick <= now);
    if (done.length === 0) return done;
    this._jobs = this._jobs.filter((j) => j.endTick > now);
    for (const j of done) this.stockCounts[slot(j.type)]++;
    this.changed();
    return done;
  }

  satellite(): SatelliteData {
    return this._satellite;
  }

  setSatellite(s: SatelliteData): void {
    this._satellite = s;
    this.changed();
  }

  /** The strike still landing, if any. Not sent to the client. */
  strike(): StrikeState | null {
    return this._strike;
  }

  setStrike(s: StrikeState | null): void {
    this._strike = s;
  }

  /** A targeted satellite gains an interceptor in flight; ignored otherwise. */
  addInterceptor(i: InterceptorData): void {
    const s = this._satellite;
    if (s.phase !== "targeted") return;
    this._satellite = { ...s, interceptors: [...s.interceptors, { ...i }] };
    this.changed();
  }

  /** A satellite being prepared holds one slot of its silo (spec §6.1). */
  holdsSiloSlot(siloId: number): boolean {
    const s = this._satellite;
    return s.phase === "preparing" && s.siloId === siloId;
  }

  toData(): StrategicData {
    this.strategicDataCache ??= {
      stock: Object.fromEntries(
        STOCKPILED_NUKES.map((t, i) => [t, this.stockCounts[i]]),
      ) as Record<StockpiledNuke, number>,
      jobs: this._jobs.map((j) => ({ ...j })),
      satellite: satelliteData(satelliteState(this._satellite)),
    };
    return this.strategicDataCache;
  }

  snapshot(): StrategicState {
    const strike = this._strike;
    return {
      stock: [...this.stockCounts],
      jobs: this._jobs.map((j) => ({
        factoryId: j.factoryId,
        type: j.type,
        startTick: j.startTick,
        endTick: j.endTick,
      })),
      satellite: satelliteState(this._satellite),
      ...(strike === null
        ? {}
        : {
            strike: {
              target: strike.target,
              startTick: strike.startTick,
              nextWave: strike.nextWave,
              craterRadius: strike.craterRadius,
              sites: [...strike.sites],
              craters: [...strike.craters],
              buildings: strike.buildings,
              troops: strike.troops,
            },
          }),
    };
  }

  static restore(s: StrategicState): PlayerStrategic {
    const p = new PlayerStrategic();
    p.stockCounts = [...s.stock];
    p._jobs = s.jobs.map((j) => ({ ...j }));
    p._satellite = satelliteData(s.satellite);
    p._strike =
      s.strike === undefined
        ? null
        : {
            ...s.strike,
            sites: [...s.strike.sites],
            craters: [...s.strike.craters],
          };
    return p;
  }

  private changed(): void {
    this.strategicDataCache = null;
  }
}

/** Field by field, in schema order: key order is part of the snapshot bytes. */
function satelliteState(s: SatelliteData): SatelliteState {
  switch (s.phase) {
    case "none":
    case "orbit":
    case "spent":
      return { phase: s.phase };
    case "preparing":
      return {
        phase: s.phase,
        siloId: s.siloId,
        startTick: s.startTick,
        readyTick: s.readyTick,
      };
    case "targeted":
      return {
        phase: s.phase,
        target: s.target,
        strikeTick: s.strikeTick,
        interceptors: s.interceptors.map((i) => ({
          by: i.by,
          type: i.type,
          resolveTick: i.resolveTick,
          ...(i.from === undefined ? {} : { from: i.from }),
        })),
      };
  }
}

function satelliteData(s: SatelliteState): SatelliteData {
  switch (s.phase) {
    case "none":
    case "orbit":
    case "spent":
      return { phase: s.phase };
    case "preparing":
      return {
        phase: s.phase,
        siloId: s.siloId!,
        startTick: s.startTick!,
        readyTick: s.readyTick!,
      };
    case "targeted":
      return {
        phase: s.phase,
        target: s.target!,
        strikeTick: s.strikeTick!,
        interceptors: (s.interceptors ?? []).map((i) => ({ ...i })),
      };
  }
}
