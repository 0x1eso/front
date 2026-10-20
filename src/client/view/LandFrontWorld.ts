// World War 1936 P2: the screens' FrontWorld (engine-lib FrontRules) over
// the land view and the World War data, so the map's front flags, the
// front preview and the arrow previews use the engine's own sides and
// enemies: WwLand.sameSide (sideOfId: a faction, or the country alone,
// spec §7.1) and WwLand.isEnemy (P0 canFight: at war and past the
// preparation minute).
import {
  COUNTRIES,
  FACTION_IDS,
  type FactionId,
} from "@openfront/engine-api/ww1936/Countries";
import type { WorldWarData } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  facesFront,
  type FrontWorld,
} from "@openfront/engine-lib/ww1936/FrontRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { WwLandView } from "./WwLandView";

/** The war data the screens read: GameView.worldWarData and GameView.ticks. */
export interface LandWarInputs {
  war: () => WorldWarData | null;
  ticks: () => number;
}

export class LandFrontWorld implements FrontWorld {
  readonly scenario: ScenarioIndex;
  readonly controller: Uint16Array;
  /** smallIDs run 1..size-1. */
  private readonly size: number;
  /** WwLand.sideOfId: 100_000 + the faction's index, or the smallID alone. */
  private readonly sideKey: Int32Array;
  /** At war, by smallID pair (WorldWar's war matrix, from its wars list). */
  private readonly atWar: Uint8Array;
  private warSeen: WorldWarData | null | undefined = undefined;
  private prepEnd = 0;

  /**
   * `inputs` null (tests, tools): every country outside our side counts as
   * an enemy, there being no war data.
   */
  constructor(
    view: WwLandView,
    private readonly inputs: LandWarInputs | null = null,
  ) {
    this.scenario = view.scenario;
    this.controller = view.controller;
    this.size = view.scenario.countries.length + 1;
    this.sideKey = new Int32Array(this.size);
    this.atWar = new Uint8Array(this.size * this.size);
    this.refreshSides();
  }

  /**
   * Sides as WwLand.rebuildDerived builds them. `factionOf` is the engine's
   * WorldWar.factionOf (the starting factions in P2); P3 passes the live one
   * when factions change.
   */
  refreshSides(
    factionOf: (smallID: number) => FactionId | null = (id) => {
      const tag = this.scenario.tagOfSmallId(id);
      return tag === undefined ? null : COUNTRIES[tag].faction;
    },
  ): void {
    for (let id = 1; id < this.size; id++) {
      const f = factionOf(id);
      this.sideKey[id] = f === null ? id : 100_000 + FACTION_IDS.indexOf(f);
    }
  }

  sameSide(a: number, b: number): boolean {
    if (a <= 0 || b <= 0) return false;
    if (a === b) return true;
    return (
      a < this.size && b < this.size && this.sideKey[a] === this.sideKey[b]
    );
  }

  isEnemy(a: number, b: number): boolean {
    if (a <= 0 || b <= 0 || a >= this.size || b >= this.size) return false;
    if (this.inputs === null) return !this.sameSide(a, b);
    this.syncWars();
    if (this.inputs.ticks() < this.prepEnd) return false;
    return this.atWar[a * this.size + b] === 1;
  }

  /** FrontRules.facesFront for this world. */
  facesFront(me: number, enemy: number, c: number): boolean {
    return facesFront(this, me, enemy, c);
  }

  /** Rebuilds the war matrix when the World War data object changed. */
  private syncWars(): void {
    const data = this.inputs!.war();
    if (data === this.warSeen) return;
    this.warSeen = data;
    this.atWar.fill(0);
    this.prepEnd = data?.prepEndTick ?? 0;
    for (const w of data?.wars ?? []) {
      if (w.a <= 0 || w.b <= 0 || w.a >= this.size || w.b >= this.size) {
        continue;
      }
      this.atWar[w.a * this.size + w.b] = 1;
      this.atWar[w.b * this.size + w.a] = 1;
    }
  }
}
