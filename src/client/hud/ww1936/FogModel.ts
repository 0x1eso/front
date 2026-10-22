// P6 lane U3 fills this file (plan Task 12): the screen-level fog of war
// (spec §8.1, §20.7, plan decision 19). Every P2–P5 screen asks it before
// it draws an enemy number. The foundation's stub: everything visible and
// exact (P5's screens unchanged).
import type { GameView } from "../../view/GameView";

export type FogBars = "gray" | "steps" | "exact";

export type FogArmyView =
  | { visible: false }
  | {
      visible: true;
      ghost: boolean;
      countLabel: string;
      bars: FogBars;
      general: boolean;
      generalSkills: boolean;
      template: boolean;
      composition: boolean;
    };

export type FogFleetView =
  | { visible: false }
  | {
      visible: true;
      ghost: boolean;
      countLabel: string;
      shipsLabel: string;
      bars: FogBars;
      general: boolean;
      generalSkills: boolean;
      template: boolean;
      composition: boolean;
    };

export interface FogRegionView {
  buildings: "hidden" | "range" | "exact";
  label(n: number): string;
}

export interface FogCountryView {
  stability: "hidden" | "range" | "exact";
  focus: boolean;
  advisors: boolean;
  all: boolean;
  atomic: "hidden" | "progress" | "exact";
}

const EXACT_REGION: FogRegionView = {
  buildings: "exact",
  label: (n) => String(n),
};
const EXACT_COUNTRY: FogCountryView = {
  stability: "exact",
  focus: true,
  advisors: true,
  all: true,
  atomic: "exact",
};

export class FogModel {
  private observer = 0;

  constructor(readonly view: GameView) {}

  /** The country whose intelligence the screens show (0: none). */
  setObserver(smallID: number): void {
    this.observer = smallID;
  }

  /** Spectators, the game's end and replays see everything. */
  fogOff(): boolean {
    return true;
  }

  armyView(armyId: number): FogArmyView {
    const a = this.view.wwLand()?.armies.get(armyId);
    return {
      // An army the view no longer knows draws nothing (no "0" token).
      visible: a !== undefined,
      ghost: false,
      countLabel: String(a?.divisions ?? 0),
      bars: "exact",
      general: true,
      generalSkills: true,
      template: true,
      composition: true,
    };
  }

  fleetView(fleetId: number): FogFleetView {
    const f = this.view.wwNavy()?.fleets.get(fleetId);
    let ships = 0;
    for (const n of f?.counts ?? []) ships += n;
    return {
      visible: f !== undefined,
      ghost: false,
      countLabel: String(ships),
      shipsLabel: String(ships),
      bars: "exact",
      general: true,
      generalSkills: true,
      template: true,
      composition: true,
    };
  }

  /** A side's sorties over a zone, as the screen may show them. */
  zoneSorties(srIdx: number, side: number): string {
    return "";
  }

  regionView(region: number): FogRegionView {
    return EXACT_REGION;
  }

  countryView(smallID: number): FogCountryView {
    return EXACT_COUNTRY;
  }

  /** The enemy side's division count label in a battle. */
  battleEnemyLabel(battleRegion: number, side: number): string {
    const b = this.view.wwLand()?.battles.get(battleRegion);
    if (b === undefined) return "";
    const n = side === 0 ? b.defLine + b.defReserve : b.attLine + b.attReserve;
    return String(n);
  }

  /** Spec §8.9: the attack preview's enemy number (exact here). */
  previewEnemyValue(count: number, owner: number): number {
    return count;
  }

  /** Any other enemy number a card shows (spec §20.7): its label at the observer's band. */
  countLabel(owner: number, count: number): string {
    return String(count);
  }
}

const FOG_MODELS = new WeakMap<GameView, FogModel>();

/** The game's one FogModel (the cards and passes share it). */
export function fogModelOf(view: GameView): FogModel {
  let f = FOG_MODELS.get(view);
  if (f === undefined) {
    f = new FogModel(view);
    FOG_MODELS.set(view, f);
  }
  return f;
}
