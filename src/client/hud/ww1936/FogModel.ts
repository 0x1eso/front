// World War 1936 P6 lane U3 (plan Task 12, spec §8.9, §20.7, plan decision
// 19): the screen-level fog of war. The engine sends the screens the true
// numbers (the worker and the screen share a device); every P2–P5 card and
// the three token passes ask this model before they draw an enemy number or
// an enemy token. The model reads only views: the observer's intel row
// (`WwDepthView.intelOf`), the land, navy, air and politics views.
//
// Bands (intelBand): 0 unknown, 1 rough, 2 close, 3 exact. The bands change
// once a day, so every answer is cached on a stamp made of the views'
// versions (no allocation between two changes). Spectators, the game's end
// and the country-less see everything (`fogOff`), as do the observer's own
// side.
import {
  ID_AIR,
  ID_ARMY,
  ID_CIVIL,
  ID_NAVY,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { ARMY_BATTLE } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import {
  fogCountLabel,
  fogPreviewValue,
  intelBand,
} from "@openfront/engine-lib/ww1936/IntelRules";
import type { GameView } from "../../view/GameView";
import type { WwLandView } from "../../view/WwLandView";
import type { WwNavyView } from "../../view/WwNavyView";

export type FogBars = "gray" | "steps" | "exact";

export type FogArmyView =
  | { visible: false }
  | {
      visible: true;
      ghost: boolean;
      countLabel: string;
      /** The number a token's glyph shows: the count, a band's top, or -1 ("?"). */
      shown: number;
      /** `shown` is a band's top, not the count. */
      approx: boolean;
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
      shown: number;
      approx: boolean;
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

/** An enemy army last seen: drawn at its last place, faded, for 10 days. */
export interface FogGhost {
  id: number;
  owner: number;
  x: number;
  y: number;
  symbol: number;
  shown: number;
  approx: boolean;
  countLabel: string;
}

/** Spec §8.9: a ghost token lasts this many days. */
export const GHOST_DAYS = 10;
/** Spec §8.9 (2): own-side recon planes over the zone / own superiority that show it. */
export const RECON_SEEN = 20;
export const SUPERIORITY_SEEN_PM = 600;
/** Spec §8.9: the navy-intel level at which a docked enemy fleet shows. */
export const DOCKED_SEEN_LEVEL = 50;

const SIDE_BASE = 100_000;

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
const COUNTRY_BY_BAND: readonly FogCountryView[] = [
  {
    stability: "hidden",
    focus: false,
    advisors: false,
    all: false,
    atomic: "hidden",
  },
  {
    stability: "range",
    focus: false,
    advisors: false,
    all: false,
    atomic: "hidden",
  },
  {
    stability: "range",
    focus: true,
    advisors: true,
    all: false,
    atomic: "progress",
  },
  EXACT_COUNTRY,
];
const REGION_BY_BAND: readonly FogRegionView[] = [
  { buildings: "hidden", label: () => "?" },
  { buildings: "range", label: (n) => fogCountLabel(n, 1) },
  { buildings: "range", label: (n) => fogCountLabel(n, 2) },
  EXACT_REGION,
];
const HIDDEN_ARMY: FogArmyView = { visible: false };
const HIDDEN_FLEET: FogFleetView = { visible: false };

interface Seen {
  owner: number;
  x: number;
  y: number;
  symbol: number;
  shown: number;
  approx: boolean;
  countLabel: string;
}

/** The glyph a token shows for a count at a band: exact, the band's top, or -1. */
function shownAt(count: number, band: number): number {
  if (band >= 3) return count;
  if (band <= 0) return -1;
  const label = fogCountLabel(count, band);
  const tilde = label.indexOf("~");
  return tilde < 0 ? Number(label) : Number(label.slice(tilde + 1));
}

/** Smallest power of two ≥ n (at least 4): the preview's coarse value. */
function bucket(n: number): number {
  let b = 4;
  while (b < n) b *= 2;
  return b;
}

const LAND_FOG = new WeakMap<object, FogModel>();
const NAVY_FOG = new WeakMap<object, FogModel>();

/** The fog the army token pass filters by (undefined: nothing registered, draw all). */
export function fogOfLand(view: WwLandView): FogModel | undefined {
  return LAND_FOG.get(view);
}

/** The fog the fleet token and naval battle passes filter by. */
export function fogOfNavy(view: WwNavyView): FogModel | undefined {
  return NAVY_FOG.get(view);
}

export class FogModel {
  private observer = 0;
  private forcedOff = false;

  private key = Number.NaN;
  private armies = new Map<number, FogArmyView>();
  private fleets = new Map<number, FogFleetView>();
  private ghostList: FogGhost[] = [];
  private readonly seen = new Map<number, Seen>();
  private readonly ghostUntil = new Map<number, number>();
  private readonly ghostData = new Map<number, Seen>();
  private readonly spotted = new Set<number>();
  private readonly enemyMin = [3, 3, 3, 3];
  private stampValue = 0;

  constructor(readonly view: GameView) {
    const land = view.wwLand?.();
    if (land) LAND_FOG.set(land, this);
    const navy = view.wwNavy?.();
    if (navy) NAVY_FOG.set(navy, this);
  }

  /** The country whose intelligence the screens show (0: none). */
  setObserver(smallID: number): void {
    if (smallID === this.observer) return;
    this.observer = smallID;
    this.key = Number.NaN;
  }

  /** Tests and the HUD: show everything while true. */
  forceOff(off: boolean): void {
    this.forcedOff = off;
    this.key = Number.NaN;
  }

  me(): number {
    return this.observer !== 0
      ? this.observer
      : (this.view.myPlayer?.()?.smallID() ?? 0);
  }

  /** Spectators, the game's end and replays see everything. */
  fogOff(): boolean {
    if (this.forcedOff || this.me() === 0) return true;
    if (this.view.gameOver?.() === true) return true;
    return this.view.isSpectator?.() === true;
  }

  // ---- bands ----------------------------------------------------------

  private sideOf(id: number): number {
    const f = this.view.wwPolitics?.()?.factionIdx(id) ?? -1;
    return f < 0 ? id : SIDE_BASE + f;
  }

  private sameSide(a: number, b: number): boolean {
    return a === b || this.sideOf(a) === this.sideOf(b);
  }

  /** The intel level (0..100) the observer has on `owner` in `domain`; 100 for own and fog-off. */
  levelOf(owner: number, domain: number): number {
    if (this.fogOff()) return 100;
    const me = this.me();
    if (owner === 0 || this.sameSide(me, owner)) return 100;
    return this.view.wwDepth?.()?.intelOf(me, owner, domain) ?? 0;
  }

  /** The band (0..3) of the observer's intel on `owner` in `domain`. */
  bandOf(owner: number, domain: number): number {
    return intelBand(this.levelOf(owner, domain));
  }

  /** The lowest band over the countries at war with the observer (an unknown owner). */
  private lowestEnemyBand(domain: number): number {
    this.ensure();
    return this.enemyMin[domain];
  }

  // ---- the cache --------------------------------------------------------

  /** Changes whenever what a token or card shows may have changed. */
  stamp(): number {
    this.ensure();
    return this.stampValue;
  }

  private today(): number {
    const prep = this.view.worldWarData?.()?.prepEndTick ?? WW_PREP_TICKS;
    return dayIndex(this.view.ticks?.() ?? 0, prep);
  }

  private currentKey(): number {
    const v = this.view;
    return (
      (v.wwLand?.()?.version ?? 0) +
      (v.wwNavy?.()?.version ?? 0) +
      (v.wwAir?.()?.version ?? 0) +
      (v.wwDepth?.()?.version ?? 0) +
      (v.wwPolitics?.()?.version ?? 0) +
      this.me() * 7_919 +
      this.today() * 1_000_003 +
      (this.fogOff() ? 1 : 0)
    );
  }

  private ensure(): void {
    const k = this.currentKey();
    if (k === this.key) return;
    this.key = k;
    this.stampValue++;
    this.rebuild();
  }

  private rebuild(): void {
    const view = this.view;
    const land = view.wwLand?.() ?? null;
    const navy = view.wwNavy?.() ?? null;
    const off = this.fogOff();
    const me = this.me();
    const day = this.today();

    // The lowest band over the countries at war with me, by domain.
    this.enemyMin[0] = this.enemyMin[1] = this.enemyMin[2] = 3;
    this.enemyMin[3] = 3;
    if (!off) {
      for (const w of view.worldWarData?.()?.wars ?? []) {
        const e = w.a === me ? w.b : w.b === me ? w.a : 0;
        if (e === 0) continue;
        for (let d = 0; d < 4; d++) {
          const b = this.bandOf(e, d);
          if (b < this.enemyMin[d]) this.enemyMin[d] = b;
        }
      }
    }

    this.armies = new Map();
    if (land !== null) this.rebuildArmies(land, off, me, day);
    this.fleets = new Map();
    if (navy !== null) this.rebuildFleets(navy, off, me);
  }

  // ---- army tokens ------------------------------------------------------

  private armyVisible(
    land: WwLandView,
    a: { owner: number; region: number; state: number },
    mySide: number,
  ): boolean {
    const sc = land.scenario;
    const region = a.region;
    // (4) its divisions fight my side.
    if ((a.state & ARMY_BATTLE) !== 0) {
      const b = land.battles.get(region);
      if (b !== undefined) {
        if (
          this.sideKeyOfBattle(b.attacker) === mySide ||
          this.sideKeyOfBattle(b.defender) === mySide
        ) {
          return true;
        }
      }
    }
    // (3) my army intel on its country is exact.
    if (this.bandOf(a.owner, ID_ARMY) >= 3) return true;
    if (region === 0) return false;
    // (1) the province is held by my side or touches one that is.
    if (this.sideOf(land.controller[region]) === mySide) return true;
    for (const n of sc.regionNeighbours(region)) {
      if (this.sideOf(land.controller[n]) === mySide) return true;
    }
    // (2) my recon planes or my air superiority over its land zone.
    const air = this.view.wwAir?.();
    if (air !== null && air !== undefined) {
      const sr = sc.regionSr(region);
      if (sr > 0) {
        if (air.mySuperiority(sr) >= SUPERIORITY_SEEN_PM) return true;
        let recon = 0;
        for (const d of air.deployments.values()) {
          if (d.sr !== sr || d.mission !== "recon") continue;
          for (const c of d.counts) recon += c;
        }
        if (recon >= RECON_SEEN) return true;
      }
    }
    return false;
  }

  private sideKeyOfBattle(v: number): number {
    return v >= SIDE_BASE ? v : this.sideOf(v);
  }

  private rebuildArmies(
    land: WwLandView,
    off: boolean,
    me: number,
    day: number,
  ): void {
    const mySide = this.sideOf(me);
    const tick = this.view.ticks?.() ?? 0;
    for (const a of land.armies.values()) {
      const mine = off || a.owner === me || this.sameSide(me, a.owner);
      const band = mine ? 3 : this.bandOf(a.owner, ID_ARMY);
      if (!mine && !this.armyVisible(land, a, mySide)) {
        this.hideArmy(a.id, day);
        continue;
      }
      const shown = shownAt(a.divisions, band);
      const v: FogArmyView = {
        visible: true,
        ghost: false,
        countLabel: fogCountLabel(a.divisions, band),
        shown,
        approx: band > 0 && band < 3,
        bars: band >= 3 ? "exact" : band === 2 ? "steps" : "gray",
        general: band >= 1,
        generalSkills: band >= 2,
        template: band >= 2,
        composition: band >= 3,
      };
      this.armies.set(a.id, v);
      this.ghostUntil.delete(a.id);
      this.ghostData.delete(a.id);
      if (mine) {
        this.seen.delete(a.id);
        continue;
      }
      const xy = land.tokenXY(a, tick);
      if (xy !== null) {
        this.seen.set(a.id, {
          owner: a.owner,
          x: xy[0],
          y: xy[1],
          symbol: a.symbol,
          shown,
          approx: v.approx,
          countLabel: v.countLabel,
        });
      }
    }
    // Armies the screen no longer has are forgotten; old ghosts fade out.
    for (const id of [...this.seen.keys()]) {
      if (!land.armies.has(id)) this.seen.delete(id);
    }
    for (const id of [...this.ghostUntil.keys()]) {
      if (!land.armies.has(id) || (this.ghostUntil.get(id) ?? 0) <= day) {
        this.ghostUntil.delete(id);
        this.ghostData.delete(id);
      }
    }
    this.ghostList = [];
    for (const [id, s] of this.ghostData) this.ghostList.push({ id, ...s });
  }

  /** An army not visible now: if it was, it becomes a ghost for 10 days. */
  private hideArmy(id: number, day: number): void {
    const s = this.seen.get(id);
    if (s === undefined) return;
    this.seen.delete(id);
    this.ghostUntil.set(id, day + GHOST_DAYS);
    this.ghostData.set(id, s);
  }

  armyView(armyId: number): FogArmyView {
    this.ensure();
    return this.armies.get(armyId) ?? HIDDEN_ARMY;
  }

  /** The ghost tokens (stable between stamps). */
  ghosts(): readonly FogGhost[] {
    this.ensure();
    return this.ghostList;
  }

  // ---- fleets -----------------------------------------------------------

  private rebuildFleets(navy: WwNavyView, off: boolean, me: number): void {
    this.spotted.clear();
    const mySide = this.sideOf(me);
    for (const s of navy.seaRegions.values()) {
      for (const [k, ids] of s.spotted) {
        if (k === mySide || k === me)
          for (const id of ids) this.spotted.add(id);
      }
    }
    for (const f of navy.fleets.values()) {
      let ships = 0;
      for (const n of f.counts) ships += n;
      const mine = off || f.owner === me || this.sameSide(me, f.owner);
      const band = mine ? 3 : this.bandOf(f.owner, ID_NAVY);
      if (!mine) {
        const inBattle = navy.battles.has(f.zone);
        const dockedSeen =
          f.docked !== 0 && this.levelOf(f.owner, ID_NAVY) >= DOCKED_SEEN_LEVEL;
        if (!this.spotted.has(f.id) && !inBattle && !dockedSeen) continue;
      }
      const label = fogCountLabel(ships, band);
      this.fleets.set(f.id, {
        visible: true,
        ghost: false,
        countLabel: label,
        shipsLabel: label,
        shown: shownAt(ships, band),
        approx: band > 0 && band < 3,
        bars: band >= 3 ? "exact" : band === 2 ? "steps" : "gray",
        general: band >= 1,
        generalSkills: band >= 2,
        template: band >= 2,
        composition: band >= 3,
      });
    }
  }

  fleetView(fleetId: number): FogFleetView {
    this.ensure();
    return this.fleets.get(fleetId) ?? HIDDEN_FLEET;
  }

  /** A naval battle's marker shows when my side fights in it or a fleet there shows. */
  navalBattleVisible(
    attacker: number,
    defender: number,
    zone: number,
  ): boolean {
    this.ensure();
    if (this.fogOff()) return true;
    const me = this.me();
    if (this.sameSide(me, attacker) || this.sameSide(me, defender)) return true;
    const navy = this.view.wwNavy?.();
    if (navy === null || navy === undefined) return true;
    for (const f of navy.fleets.values()) {
      if (f.zone === zone && this.fleets.has(f.id)) return true;
    }
    return false;
  }

  // ---- cards ------------------------------------------------------------

  /** A side's sorties over a zone, as the screen may show them. */
  zoneSorties(srIdx: number, side: number): string {
    this.ensure();
    const z = this.view.wwAir?.()?.zones.get(srIdx);
    const s = z?.sides.find((x) => x.side === side);
    if (s === undefined) return "";
    let n = 0;
    for (const c of s.sorties) n += c;
    if (this.fogOff() || side === this.sideOf(this.me())) return String(n);
    return fogCountLabel(n, this.sideBand(side, ID_AIR));
  }

  /** The band for a side key (a lone country's smallID, or 100,000 + a faction). */
  private sideBand(side: number, domain: number): number {
    return side < SIDE_BASE
      ? this.bandOf(side, domain)
      : this.lowestEnemyBand(domain);
  }

  regionView(region: number): FogRegionView {
    this.ensure();
    if (this.fogOff()) return EXACT_REGION;
    const owner = this.view.wwLand?.()?.controller[region] ?? 0;
    return REGION_BY_BAND[owner === 0 ? 0 : this.bandOf(owner, ID_CIVIL)];
  }

  countryView(smallID: number): FogCountryView {
    this.ensure();
    if (this.fogOff()) return EXACT_COUNTRY;
    return COUNTRY_BY_BAND[this.bandOf(smallID, ID_CIVIL)];
  }

  /** The enemy side's division count label in a battle (side 0: the defender). */
  battleEnemyLabel(battleRegion: number, side: number): string {
    this.ensure();
    const b = this.view.wwLand?.()?.battles.get(battleRegion);
    if (b === undefined) return "";
    const n = side === 0 ? b.defLine + b.defReserve : b.attLine + b.attReserve;
    if (this.fogOff()) return String(n);
    const sk = this.sideKeyOfBattle(side === 0 ? b.defender : b.attacker);
    if (sk === this.sideOf(this.me())) return String(n);
    return fogCountLabel(n, this.sideBand(sk, ID_ARMY));
  }

  /** Spec §8.9: the attack preview's enemy number (owner 0: the lowest naval band of my enemies). */
  previewEnemyValue(count: number, owner: number): number {
    this.ensure();
    if (this.fogOff()) return count;
    const band =
      owner === 0 ? this.lowestEnemyBand(ID_NAVY) : this.bandOf(owner, ID_ARMY);
    const v = fogPreviewValue(count, band);
    return band <= 0 ? bucket(v) : v;
  }

  /**
   * Any other enemy number a card shows (spec §20.7): its label at the
   * observer's band. `owner` 0 is an unknown owner (the lowest band over my
   * enemies; the air zone card's planes by default).
   */
  countLabel(
    owner: number,
    count: number,
    domain: number = owner === 0 ? ID_AIR : ID_ARMY,
  ): string {
    this.ensure();
    if (this.fogOff()) return String(count);
    const band =
      owner === 0 ? this.lowestEnemyBand(domain) : this.bandOf(owner, domain);
    return fogCountLabel(count, band);
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
