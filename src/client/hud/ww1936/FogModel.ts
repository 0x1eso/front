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
import { renderTroops } from "@openfront/engine-lib/Format";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import {
  fogCountLabel,
  fogPreviewValue,
  intelBand,
} from "@openfront/engine-lib/ww1936/IntelRules";
import type { GameView } from "../../view/GameView";
import type { WwAirView } from "../../view/WwAirView";
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

/** What `wwOutOfGame` reads (the game view, or a fake in tests). */
export type OutOfGameView = Pick<GameView, "myPlayer"> &
  Partial<Pick<GameView, "myClientID" | "wwEndgame">>;

/**
 * The P0 spectate screen's question in World War 1936 P5 (spec §11): is
 * my client out of the game — spectating (no candidate), or its country
 * gone with no exile, no takeover card and no new country? An exile and a
 * human picking a country play on. (P5 lane U3's rule; it lives here so
 * the fog can ask it without the takeover card's element.)
 */
export function wwOutOfGame(game: OutOfGameView): boolean {
  const client = game.myClientID?.();
  const eg = game.wwEndgame?.() ?? null;
  if (!client || eg === null) return false;
  if (eg.controlledBy(client) === 0) return true;
  if (eg.takeoverFor(client) !== null) return false;
  const me = game.myPlayer();
  return (
    me !== null && me.hasSpawned() && !me.isAlive() && !eg.isExile(me.smallID())
  );
}

const LAND_FOG = new WeakMap<object, FogModel>();
const NAVY_FOG = new WeakMap<object, FogModel>();
const AIR_FOG = new WeakMap<object, FogModel>();

/** The fog the army token pass filters by (undefined: nothing registered, draw all). */
export function fogOfLand(view: WwLandView): FogModel | undefined {
  return LAND_FOG.get(view);
}

/** The fog the air sortie pass filters by. */
export function fogOfAir(view: WwAirView): FogModel | undefined {
  return AIR_FOG.get(view);
}

/** The fog the fleet token and naval battle passes filter by. */
export function fogOfNavy(view: WwNavyView): FogModel | undefined {
  return NAVY_FOG.get(view);
}

export class FogModel {
  private observer = 0;
  private forcedOff = false;

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
    const air = view.wwAir?.();
    if (air) AIR_FOG.set(air, this);
  }

  /** The country whose intelligence the screens show (0: none). */
  setObserver(smallID: number): void {
    if (smallID === this.observer) return;
    this.observer = smallID;
    this.dirty = true;
  }

  /** Tests and the HUD: show everything while true. */
  forceOff(off: boolean): void {
    this.forcedOff = off;
    this.dirty = true;
  }

  me(): number {
    return this.observer !== 0
      ? this.observer
      : (this.view.myPlayer?.()?.smallID() ?? 0);
  }

  /**
   * Spectators, the game's end and replays see everything. Final review
   * C (I3): with the endgame view, a client is a spectator only when it is
   * out of the game (`wwOutOfGame`) — a government in exile holds no land
   * (the engine's isAlive is tiles > 0) yet still commands forces, and a
   * human picking a takeover country still plays: both keep the fog.
   */
  fogOff(): boolean {
    if (this.forcedOff || this.me() === 0) return true;
    // No depth view (the mode's depth systems are off): nothing to hide by.
    if (!this.view.wwDepth?.()) return true;
    if (this.view.gameOver?.() === true) return true;
    if (this.view.config?.()?.isReplay?.() === true) return true;
    if ((this.view.wwEndgame?.() ?? null) !== null) {
      return wwOutOfGame(this.view);
    }
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

  /** The inputs of the cache, compared one by one (no sum: a reset version still shows). */
  private readonly keyNow = [0, 0, 0, 0, 0, 0, 0, 0];
  private keyThen: number[] | null = null;

  private ensure(): void {
    const v = this.view;
    const k = this.keyNow;
    k[0] = v.wwLand?.()?.version ?? 0;
    k[1] = v.wwNavy?.()?.version ?? 0;
    k[2] = v.wwAir?.()?.version ?? 0;
    k[3] = v.wwDepth?.()?.version ?? 0;
    k[4] = v.wwPolitics?.()?.version ?? 0;
    k[5] = this.me();
    k[6] = this.today();
    k[7] = this.fogOff() ? 1 : 0;
    const then = this.keyThen;
    if (then !== null && !this.dirty) {
      let same = true;
      for (let i = 0; i < k.length; i++) {
        if (then[i] !== k[i]) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    this.dirty = false;
    this.keyThen = k.slice();
    this.stampValue++;
    this.rebuild();
  }
  private dirty = true;

  /** The observer the sightings below belong to. */
  private seenBy = -1;

  private rebuild(): void {
    const view = this.view;
    const land = view.wwLand?.() ?? null;
    const navy = view.wwNavy?.() ?? null;
    const off = this.fogOff();
    const me = this.me();
    const day = this.today();
    // Final review C (I3 Minor): a takeover (or any observer change) does
    // not inherit the old country's sightings as ghosts.
    if (me !== this.seenBy) {
      this.seenBy = me;
      this.seen.clear();
      this.ghostUntil.clear();
      this.ghostData.clear();
      this.ghostList = [];
    }

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
        // Lane I's reconSorties: my side's sorties over the zone yesterday
        // (W2's reconBySide); without them, my own recon wings stand in.
        const sorties = this.view.wwDepth?.()?.detail(this.me())
          ?.intel.reconSorties;
        if (sorties !== undefined) {
          if (sorties.some((x) => x[0] === sr && x[2] >= RECON_SEEN)) {
            return true;
          }
        } else {
          let recon = 0;
          for (const d of air.deployments.values()) {
            if (d.sr !== sr || d.mission !== "recon") continue;
            for (const c of d.counts) recon += c;
          }
          if (recon >= RECON_SEEN) return true;
        }
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
      // The ally rule (same faction, or me) — and, T1b, a volunteer army
      // by whom it fights for: my side's volunteers are my side's, as in
      // their battles and the aid tab; my own sent abroad stay mine.
      const mine =
        off ||
        a.owner === me ||
        this.sameSide(me, a.owner) ||
        (a.volunteerFor !== undefined && this.sameSide(me, a.volunteerFor));
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

  /** The air view's plane count for another owner's deployment: 0 at band 0, a band's top below exact. */
  planesSeen(owner: number, planes: number): number {
    this.ensure();
    if (this.fogOff()) return planes;
    const band = this.bandOf(owner, ID_AIR);
    if (band >= 3) return planes;
    if (band <= 0) return 0;
    return Math.max(1, shownAt(planes, band));
  }

  /** A land battle's marker shows when my side fights in it or one of its armies shows. */
  landBattleVisible(
    region: number,
    attacker: number,
    defender: number,
  ): boolean {
    this.ensure();
    if (this.fogOff()) return true;
    const me = this.me();
    if (this.sameSide(me, attacker) || this.sameSide(me, defender)) return true;
    for (const a of this.view.wwLand?.()?.armies.values() ?? []) {
      if (a.region === region && this.armies.has(a.id)) return true;
    }
    return false;
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
    // Spec §8.8 (lane I's radarSr): my radar over the zone, one band up.
    const radar = this.view.wwDepth?.()?.detail(this.me())?.intel.radarSr;
    const band = this.sideBand(side, ID_AIR);
    return fogCountLabel(
      n,
      radar?.includes(srIdx) === true ? Math.min(3, band + 1) : band,
    );
  }

  /**
   * P6 (U5's mine pass, merge glue): the mines of a P4 side key (a lone
   * country's smallID, or 100,000 + a faction) as the observer sees them:
   * 0 my side's, 1 an enemy's it knows of (naval intel close or better on
   * the country, or on the best-known member of a faction), -1 hidden.
   * With the fog off (spectators, the game's end) every other side shows.
   */
  mineSideView(side: number): 0 | 1 | -1 {
    const me = this.me();
    if (me !== 0 && side === this.sideOf(me)) return 0;
    if (this.fogOff()) return 1;
    let best = 0;
    if (side < SIDE_BASE) {
      best = this.bandOf(side, ID_NAVY);
    } else {
      const f = this.view
        .wwPolitics?.()
        ?.global?.factions.find((x) => x.idx === side - SIDE_BASE);
      for (const m of f?.members ?? []) {
        best = Math.max(best, this.bandOf(m, ID_NAVY));
      }
    }
    return best >= 2 ? 1 : -1;
  }

  /** The band for a side key (a lone country's smallID, or 100,000 + a faction). */
  private sideBand(side: number, domain: number): number {
    return side < SIDE_BASE
      ? this.bandOf(side, domain)
      : this.lowestEnemyBand(domain);
  }

  /**
   * Final review C (M5): a strike's launch site (a rocket's stream, a
   * nuke's flight) shows for my side's strikes, strikes on my side's land,
   * and an owner known at the rough civil band or better.
   */
  launchSiteShown(owner: number, target: number): boolean {
    this.ensure();
    if (this.fogOff()) return true;
    const me = this.me();
    if (this.sameSide(me, owner)) return true;
    const holder = this.view.wwLand?.()?.controller[target] ?? 0;
    if (holder !== 0 && this.sameSide(me, holder)) return true;
    return this.bandOf(owner, ID_CIVIL) >= 1;
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
   * Final review C (I1, I2): another country's men (its `troops`, the men
   * in its field divisions) as a screen shows them — null when the
   * observer sees them exactly (its own side, the fog off, an exact army
   * band), else "?" or a range of `renderTroops` parts ("240K~720K").
   * The hover card's troop bar, the map's name plates and the player
   * panel share it.
   */
  troopsLabel(owner: number, men: number): string | null {
    if (this.bandOf(owner, ID_ARMY) >= 3) return null;
    return this.countLabel(owner, men, ID_ARMY)
      .split("~")
      .map((x) => (x === "?" ? x : renderTroops(Number(x))))
      .join("~");
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
