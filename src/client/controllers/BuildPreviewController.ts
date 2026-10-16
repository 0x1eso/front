/**
 * BuildPreviewController — build-ghost state machine + click-to-build flow.
 *
 * All rendering for the build ghost (outline, range circle, rail snap,
 * crosshair) lives in the WebGL renderer. This controller owns the state:
 * it queries buildables for the cursor tile, tracks whether the placement
 * is valid, and pushes preview data straight to the WebGL view.
 *
 * A mouse builds on click: the ghost already hovered there. A finger has no
 * hover, so touch build mode takes two taps (BuildTapEvent): the first aims
 * the ghost and checks that tile at once (placement, upgrade target, nuke
 * blast radius, trajectory, SAM threats, ally warning); a second tap on the
 * aimed ghost's icon builds, once the check for that very tile says it can
 * and the player has had GHOST_SEEN_MS to see it. Any other tap aims again.
 */

import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  BuildableUnit,
  bulkCost,
  Cell,
  PlayerBuildableUnitType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  listNukeBreakAlliance,
  wouldNukeBreakAlliance,
} from "@openfront/engine-lib/execution/NukeAlliance";
import { isStockpiledNuke } from "@openfront/engine-lib/strategic/Strategic";
import { carpetBombPoints } from "@openfront/engine-lib/warfare/Warfare";
import { EventBus } from "@openfront/shared/EventBus";
import { Controller } from "../Controller";
import {
  BuildTapEvent,
  ConfirmGhostStructureEvent,
  MouseMoveEvent,
  MouseUpEvent,
} from "../InputHandler";
import { buildNukeTrajectory, MapRenderer } from "../render/gl";
import type { Ring } from "../render/gl/passes/WarfareRingPass";
import type { RenderSettings } from "../render/gl/RenderSettings";
import { renderDpr } from "../render/gl/utils/Dpr";
import { buildFlightTrajectory } from "../render/gl/utils/FlightTrajectory";
import type { SAMInfo } from "../render/gl/utils/NukeTrajectory";
import type { GhostPreviewData } from "../render/types";
import { TransformHandler } from "../TransformHandler";
import {
  BuildUnitIntentEvent,
  SendParadropIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../Transport";
import { UIState } from "../UIState";
import { UserSettings } from "../UserSettings";
import { GameView } from "../view";
import {
  missileTargetPreview,
  satelliteSiloPreview,
  TARGET_RING_RADIUS,
} from "./StrategicPreview";
import {
  airportAimRings,
  carpetAimRings,
  carpetBetrayed,
  carpetTiles,
  carpetWouldBreakAlliance,
  flightSource,
  warfareGhostRadius,
} from "./WarfarePreview";

/** True for nuke types (AtomBomb, HydrogenBomb): ghost is preserved after placement so user can place multiple or keep selection (Enter/key confirm). */
export function shouldPreserveGhostAfterBuild(unitType: UnitType): boolean {
  return unitType === UnitType.AtomBomb || unitType === UnitType.HydrogenBomb;
}

/**
 * A tap on the aimed ghost's icon, or within this many CSS px of where it is
 * drawn (a 44px target, and a bomb's crosshair), is a tap on the ghost.
 */
const GHOST_TAP_MIN_RADIUS_PX = 22;

/** A tapped ghost builds only once its checked preview showed this long. */
const GHOST_SEEN_MS = 350;

/**
 * A mousemove this close to the aiming tap is the compat event a browser
 * sends after a tap; one further away is a mouse taking the ghost back.
 */
const COMPAT_MOUSEMOVE_SLOP_PX = 32;

/**
 * Half the size, in CSS px, of a structure icon as StructurePass draws it
 * (structure.vert.glsl) at `cssPxPerTile`; 0 for a type with no icon.
 */
export function structureIconRadiusPx(
  ss: RenderSettings["structure"],
  type: UnitType,
  cssPxPerTile: number,
  dpr: number,
): number {
  const shape = ss.shapes[type];
  if (shape === undefined) return 0;
  const zoom = cssPxPerTile * dpr;
  let iconScale: number;
  if (zoom <= ss.dotsZoomThreshold) iconScale = ss.dotScale;
  else if (zoom >= ss.iconGrowZoom) iconScale = zoom / ss.iconGrowZoom;
  else iconScale = Math.min(1, zoom / ss.iconScaleFactorZoomedOut);
  return (ss.iconSize * iconScale * 0.5 * shape.scale) / dpr;
}

/** Where a touch tap aimed the ghost (see the class comment). */
interface TouchAim {
  /** The tap on screen, to tell a follow-up compat mousemove from a mouse. */
  screenX: number;
  screenY: number;
  /** The tapped world point: the ghost stays there while the map pans. */
  worldX: number;
  worldY: number;
  cellX: number;
  cellY: number;
  /** The tile the ghost is checked for; undefined off the map or impassable. */
  tile: TileRef | undefined;
}

// tSamIntercept value used to flag an untargetable (impassable) destination:
// draws the red X marker essentially at the destination while leaving the
// visible line unchanged (1.0 would mean "no marker").
const T_BLOCKED_DST = 0.9999;

/**
 * Whether a SAM belongs in the nuke trajectory preview's threat set.
 * Mirrors SAMLauncherExecution: a SAM ignores a nuke whose owner it's
 * friendly with (same team OR allied).
 * Teammates are excluded unconditionally — a strike can break an alliance
 * but never a team relationship, so a teammate's SAM never engages.
 * Allied SAMs are excluded unless the strike would betray that ally — the
 * alliance breaks at launch, so their SAMs will engage the nuke.
 * (Own SAMs never threaten; the caller filters those out first.)
 */
export function samThreatensNukePreview(
  samOwnerSmallId: number,
  teammateSmallIds: ReadonlySet<number>,
  allySmallIds: ReadonlySet<number>,
  betrayedSmallIds: ReadonlySet<number>,
): boolean {
  if (teammateSmallIds.has(samOwnerSmallId)) return false;
  return (
    !allySmallIds.has(samOwnerSmallId) || betrayedSmallIds.has(samOwnerSmallId)
  );
}

export class BuildPreviewController implements Controller {
  /** Current ghost (null when no build type is active). */
  private ghostUnit: { buildableUnit: BuildableUnit } | null = null;
  private readonly connectedAllySmallIds: Set<number> = new Set();
  private readonly usedSafetyAllies: Set<number> = new Set();
  private readonly mousePos = { x: 0, y: 0 };
  private lastGhostQueryAt: number = 0;
  private pendingConfirm: MouseUpEvent | null = null;
  /** Touch: the aimed ghost, or null until the first tap (mouse: always null). */
  private aim: TouchAim | null = null;
  /** The tile the ghost's buildableUnit was last checked for (null: none yet). */
  private checked: { tile: TileRef | undefined } | null = null;
  /** Touch: when the check for the aimed tile came back (null: not yet). */
  private aimShownAt: number | null = null;

  // Buildable validation runs on the snapped tile under the cursor, but the
  // rendered icon follows the cursor at sub-tile precision so motion is
  // continuous instead of stepping tile-to-tile. cursorLoop re-emits each
  // frame with the current cursor world position.
  private lastGhostData: GhostPreviewData | null = null;
  /** The target ring is drawn on a building: it must not follow the cursor. */
  private ringAnchored = false;

  // Static inputs for the nuke trajectory preview (source silo + threatening
  // SAMs). Recomputed in the throttled renderGhost path; cursorLoop rebuilds
  // the Bezier each frame with the live cursor position as the destination so
  // the arc tracks the cursor smoothly instead of snapping tile-to-tile.
  private nukeTrajectoryStatic: {
    srcX: number;
    srcY: number;
    directionUp: boolean;
    sams: SAMInfo[];
    /** A bomber or barrage: a straight line instead of the nuke's arc. */
    straight: boolean;
    /** A missile flies to its target building (tile centre), not the cursor. */
    dest: { x: number; y: number } | null;
    /** A bomber: the line runs on through the aim to the carpet's last blast. */
    carpet: boolean;
  } | null = null;

  /**
   * Paradrop / bomber aim preview: the rings of airports that still have a
   * sortie plus the one that flies, and (bomber) where the carpet starts.
   * cursorLoop adds the 8 blast circles for the live aim tile.
   */
  private aimStatic: {
    rings: Ring[];
    carpetFrom: { x: number; y: number } | null;
    breaksAlliance: boolean;
  } | null = null;
  private aimRingsShown = false;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    public uiState: UIState,
    private transformHandler: TransformHandler,
    private view: MapRenderer,
    private userSettings: UserSettings,
  ) {}

  init() {
    this.eventBus.on(MouseMoveEvent, (e) => this.moveGhost(e));
    this.eventBus.on(MouseUpEvent, (e) => this.requestConfirmStructure(e));
    this.eventBus.on(BuildTapEvent, (e) => this.onBuildTap(e));
    this.eventBus.on(ConfirmGhostStructureEvent, () => {
      if (this.aim !== null) {
        this.confirmAim();
        return;
      }
      this.requestConfirmStructure(
        new MouseUpEvent(this.mousePos.x, this.mousePos.y),
      );
    });

    // Re-emit the ghost each render frame at the cursor's current world
    // position (sub-tile). Buildable validation still runs on the snapped
    // tile in renderGhost(); this loop just keeps the icon under the cursor
    // so motion is continuous instead of stepping tile-to-tile.
    // The shader treats (tileX + 0.5, tileY + 0.5) as the icon center (so an
    // integer tile coord centers on that tile), so we subtract 0.5 here to
    // place the icon exactly under the cursor.
    const cursorLoop = () => {
      const ghost = this.lastGhostData;
      const traj = this.nukeTrajectoryStatic;
      const aimStatic = this.aimStatic;
      if (ghost !== null || traj !== null || aimStatic !== null) {
        const w = this.ghostWorldPos();
        if (aimStatic !== null) {
          this.view.updateAimRings(
            aimStatic.carpetFrom === null
              ? aimStatic.rings
              : [
                  ...aimStatic.rings,
                  ...carpetAimRings(
                    aimStatic.carpetFrom,
                    { x: Math.floor(w.x), y: Math.floor(w.y) },
                    aimStatic.breaksAlliance,
                  ),
                ],
          );
          this.aimRingsShown = true;
        }
        if (ghost !== null) {
          // The range circle (defense post / SAM / nuke radius) normally
          // follows the cursor, so smooth it the same way as the icon. When
          // upgrading, the circle is anchored to the existing structure's tile
          // (stationary, correctly snapped) — leave it alone in that case.
          const radiusFollowsCursor =
            !ghost.snapToPlacement &&
            !(ghost.canUpgrade && ghost.upgradeTargetTile !== null) &&
            // A target ring sits on its building (missile target, silo).
            !this.ringAnchored;
          this.view.updateGhostPreview({
            ...ghost,
            tileX: ghost.snapToPlacement ? ghost.tileX : w.x - 0.5,
            tileY: ghost.snapToPlacement ? ghost.tileY : w.y - 0.5,
            ...(radiusFollowsCursor
              ? { radiusTileX: w.x - 0.5, radiusTileY: w.y - 0.5 }
              : {}),
          });
        }
        if (traj !== null) {
          // Rebuild the arc with the live cursor as the destination (same
          // tile-center convention as the icon: shader adds +0.5).
          let dx = traj.dest !== null ? traj.dest.x : w.x - 0.5;
          let dy = traj.dest !== null ? traj.dest.y : w.y - 0.5;
          if (traj.carpet) {
            // On through the aim to the last of the 8 blasts.
            const pts = carpetBombPoints(
              traj.srcX,
              traj.srcY,
              Math.floor(w.x),
              Math.floor(w.y),
            );
            dx = pts[pts.length - 1].x;
            dy = pts[pts.length - 1].y;
          }
          const data = traj.straight
            ? buildFlightTrajectory(traj.srcX, traj.srcY, dx, dy, traj.sams)
            : buildNukeTrajectory(
                traj.srcX,
                traj.srcY,
                dx,
                dy,
                this.game.height(),
                traj.directionUp,
                traj.sams,
              );
          // Impassable terrain can't be targeted (nukeSpawn rejects it)
          // even though nukes fly over it — mark the destination with the
          // blocked X. Checked per frame so the X tracks the live cursor.
          const tx =
            traj.dest !== null && !traj.carpet
              ? Math.round(dx)
              : Math.floor(w.x);
          const ty =
            traj.dest !== null && !traj.carpet
              ? Math.round(dy)
              : Math.floor(w.y);
          if (
            this.game.isValidCoord(tx, ty) &&
            this.game.isImpassable(this.game.ref(tx, ty))
          ) {
            data.tSamIntercept = Math.min(data.tSamIntercept, T_BLOCKED_DST);
          }
          this.view.updateNukeTrajectory(data);
        }
      }
      requestAnimationFrame(cursorLoop);
    };
    requestAnimationFrame(cursorLoop);
  }

  tick() {
    // Re-query buildables periodically (world state can change — tiles may
    // become buildable as troops/territory move).
    this.syncGhostState();
    this.renderGhost();
  }

  /**
   * Reconcile our internal ghost state with uiState.ghostStructure. Other
   * UI bits (build menu, key bindings) toggle uiState; we mirror it here.
   */
  private syncGhostState(): void {
    const target = this.uiState.ghostStructure;
    if (this.ghostUnit) {
      if (target === null) {
        this.removeGhostStructure();
      } else if (target !== this.ghostUnit.buildableUnit.type) {
        this.clearGhostStructure();
        this.createGhostStructure(target);
      }
    } else if (target !== null) {
      this.createGhostStructure(target);
    }
  }

  renderGhost() {
    if (!this.ghostUnit) return;

    const now = performance.now();
    if (now - this.lastGhostQueryAt < 50) return;
    this.queryGhost();
  }

  /** Where the ghost is drawn: the aimed point on touch, else the cursor. */
  private ghostWorldPos(): { x: number; y: number } {
    if (this.aim !== null) return { x: this.aim.worldX, y: this.aim.worldY };
    return this.transformHandler.screenToWorldCoordinatesFloat(
      this.mousePos.x,
      this.mousePos.y,
    );
  }

  /** Check the ghost's tile now (the hover throttle aside) and preview it. */
  private queryGhost(): void {
    if (!this.ghostUnit) return;
    this.lastGhostQueryAt = performance.now();
    const ghostAtQuery = this.ghostUnit;
    let tileRef: TileRef | undefined;
    let trajectoryTileRef: TileRef | undefined;
    const tile =
      this.aim !== null
        ? { x: this.aim.cellX, y: this.aim.cellY }
        : this.transformHandler.screenToWorldCoordinates(
            this.mousePos.x,
            this.mousePos.y,
          );
    if (this.game.isValidCoord(tile.x, tile.y)) {
      tileRef = this.game.ref(tile.x, tile.y);
      trajectoryTileRef = tileRef;
      // Impassable terrain is a void — treat hovering over it the same as
      // hovering outside the map (no ghost, no blast circle). The nuke
      // trajectory preview is the exception: nukes fly over impassable
      // terrain, so the arc still renders (with a blocked X at the
      // untargetable destination — see cursorLoop).
      if (this.game.isImpassable(tileRef)) {
        tileRef = undefined;
      }
    }

    // Check if targeting an ally (for nuke warning visual)
    let targetingAlly = false;
    const myPlayer = this.game.myPlayer();
    const nukeType = this.ghostUnit.buildableUnit.type;
    if (
      tileRef &&
      myPlayer &&
      (nukeType === UnitType.AtomBomb ||
        nukeType === UnitType.HydrogenBomb ||
        nukeType === UnitType.Bomber)
    ) {
      this.connectedAllySmallIds.clear();
      const allies = myPlayer.allies();
      for (let i = 0; i < allies.length; i++) {
        const ally = allies[i];
        if (!ally.isDisconnected()) {
          this.connectedAllySmallIds.add(ally.smallID());
        }
      }

      if (this.connectedAllySmallIds.size > 0) {
        targetingAlly =
          nukeType === UnitType.Bomber
            ? this.carpetBreaksAlliance(tileRef, this.connectedAllySmallIds)
            : wouldNukeBreakAlliance({
                game: this.game,
                targetTile: tileRef,
                magnitude: this.game.config().nukeMagnitudes(nukeType),
                allySmallIds: this.connectedAllySmallIds,
                threshold: this.game.config().nukeAllianceBreakThreshold(),
              });
      }
    }

    this.game
      ?.myPlayer()
      ?.buildables(tileRef, [this.ghostUnit?.buildableUnit.type])
      .then((buildables) => {
        if (!this.ghostUnit) {
          this.pendingConfirm = null;
          this.emitGhostPreview(tileRef, targetingAlly, trajectoryTileRef);
          return;
        }

        const unit = buildables.find(
          (u) => u.type === this.ghostUnit!.buildableUnit.type,
        );
        if (!unit) {
          Object.assign(this.ghostUnit.buildableUnit, {
            canBuild: false,
            canUpgrade: false,
          });
          this.pendingConfirm = null;
          this.recordCheck(ghostAtQuery, tileRef);
          this.emitGhostPreview(tileRef, targetingAlly, trajectoryTileRef);
          return;
        }

        this.ghostUnit.buildableUnit = unit;
        this.recordCheck(ghostAtQuery, tileRef);

        if (this.pendingConfirm !== null) {
          const ev = this.pendingConfirm;
          this.pendingConfirm = null;
          if (this.isGhostReadyForConfirm()) {
            this.createStructure(ev);
          }
        }

        this.emitGhostPreview(tileRef, targetingAlly, trajectoryTileRef);
      });
  }

  /**
   * Push a GhostPreviewData snapshot to the WebGL view (StructurePass /
   * RangeCirclePass / RailroadPass / CrosshairPass all read it). null when
   * the ghost can't be placed. smoothLoop interpolates displayed position
   * toward the target tile each frame.
   */
  private emitGhostPreview(
    tileRef: TileRef | undefined,
    targetingAlly: boolean,
    trajectoryTileRef: TileRef | undefined,
  ): void {
    const data = this.buildGhostPreviewData(tileRef, targetingAlly);
    if (data === null) {
      this.lastGhostData = null;
      this.view.updateGhostPreview(null);
    } else {
      this.lastGhostData = data;
    }
    // The trajectory target is tracked separately from the ghost tile:
    // impassable terrain voids the ghost but still gets a trajectory arc.
    this.updateNukeTrajectoryPreview(trajectoryTileRef);
  }

  /**
   * For AtomBomb / HydrogenBomb ghosts, push the Bezier trajectory preview
   * (closest player-owned silo → target, accounting for non-allied SAMs).
   * Cleared whenever the ghost isn't a nuke, has no target, or the player
   * has no silos. Unlike the ghost icon, the trajectory also renders when
   * hovering impassable terrain (cursorLoop adds the blocked X there).
   */
  private updateNukeTrajectoryPreview(tileRef: TileRef | undefined): void {
    if (!this.ghostUnit || tileRef === undefined) {
      this.clearNukeTrajectory();
      return;
    }
    const type = this.ghostUnit.buildableUnit.type;
    if (
      type === UnitType.Bomber ||
      type === UnitType.CoastalBarrage ||
      type === UnitType.TransportPlane
    ) {
      this.updateFlightPreview(type, tileRef);
      return;
    }
    if (
      type !== UnitType.AtomBomb &&
      type !== UnitType.HydrogenBomb &&
      type !== UnitType.ConventionalMissile
    ) {
      this.clearNukeTrajectory();
      return;
    }
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) {
      this.clearNukeTrajectory();
      return;
    }

    // Mirror PlayerImpl.nukeSpawn (the source NukeExecution actually fires
    // from): only silos that are active, not reloading, and not under
    // construction are eligible, and the nearest (Manhattan distance) is
    // chosen. Keeping these in sync prevents the preview arc from
    // originating from a silo the game wouldn't use.
    const silos = myPlayer
      .units(UnitType.MissileSilo)
      .filter(
        (u) => u.isActive() && !u.isInCooldown() && !u.isUnderConstruction(),
      );
    if (silos.length === 0) {
      this.clearNukeTrajectory();
      return;
    }

    const dstX = this.game.x(tileRef);
    const dstY = this.game.y(tileRef);
    silos.sort(
      (a, b) =>
        Math.abs(this.game.x(a.tile()) - dstX) +
        Math.abs(this.game.y(a.tile()) - dstY) -
        (Math.abs(this.game.x(b.tile()) - dstX) +
          Math.abs(this.game.y(b.tile()) - dstY)),
    );

    const bestSilo = silos[0];
    const directionUp =
      type === UnitType.ConventionalMissile
        ? true
        : this.uiState.rocketDirectionUp;
    const srcX = this.game.x(bestSilo.tile());
    const srcY = this.game.y(bestSilo.tile());

    // Non-friendly SAMs threaten the trajectory; own + teammate + allied SAMs
    // don't — except allies this strike would betray: the alliance breaks at
    // launch (NukeExecution.maybeBreakAlliances), so their SAMs will intercept.
    // Teammates have no such exception (a strike never breaks a team).
    // listNukeBreakAlliance is the same function the sim uses there.
    const teammateIds = new Set<number>();
    for (const p of this.game.players()) {
      if (myPlayer.isOnSameTeam(p)) teammateIds.add(p.smallID());
    }
    const allyIds = new Set<number>();
    for (const a of myPlayer.allies()) allyIds.add(a.smallID());
    const betrayedIds: ReadonlySet<number> =
      allyIds.size > 0 && type !== UnitType.ConventionalMissile
        ? listNukeBreakAlliance({
            game: this.game,
            targetTile: tileRef,
            magnitude: this.game.config().nukeMagnitudes(type),
            threshold: this.game.config().nukeAllianceBreakThreshold(),
          })
        : new Set();
    const sams: SAMInfo[] = [];
    for (const s of this.game.units(UnitType.SAMLauncher)) {
      if (!s.isActive()) continue;
      const owner = s.owner();
      if (owner === myPlayer) continue;
      if (
        !samThreatensNukePreview(
          owner.smallID(),
          teammateIds,
          allyIds,
          betrayedIds,
        )
      ) {
        continue;
      }
      const config = this.game.config();
      const r = config.samRangeOf(owner, config.samRange(s.level()));
      sams.push({
        x: this.game.x(s.tile()),
        y: this.game.y(s.tile()),
        r,
      });
    }

    // Stash the static inputs; cursorLoop rebuilds the Bezier each frame with
    // the live cursor as the destination so the arc tracks smoothly.
    this.nukeTrajectoryStatic = {
      srcX,
      srcY,
      directionUp,
      sams,
      straight: false,
      carpet: false,
      dest:
        type === UnitType.ConventionalMissile
          ? (() => {
              const t = missileTargetPreview(this.game, myPlayer, tileRef);
              return t === null
                ? null
                : { x: this.game.x(t.tile()), y: this.game.y(t.tile()) };
            })()
          : null,
    };
  }

  private clearNukeTrajectory(): void {
    this.nukeTrajectoryStatic = null;
    this.view.updateNukeTrajectory(null);
    this.clearAimRings();
  }

  private clearAimRings(): void {
    this.aimStatic = null;
    if (this.aimRingsShown) {
      this.aimRingsShown = false;
      this.view.updateAimRings([]);
    }
  }

  private distSquared = (a: TileRef, b: TileRef): number =>
    this.game.euclideanDistSquared(a, b);

  /** The airport a bomber or paradrop aimed at `tile` would fly from. */
  private airportFor(tile: TileRef): TileRef | null {
    const me = this.game.myPlayer();
    if (!me) return null;
    return flightSource(
      me.units(UnitType.Airport),
      UnitType.Bomber,
      tile,
      this.distSquared,
    );
  }

  /** The tiles of the carpet a bomber aimed at `tile` would lay (none: no airport). */
  private carpetFor(tile: TileRef): TileRef[] {
    const from = this.airportFor(tile);
    if (from === null) return [];
    return carpetTiles(
      { x: this.game.x(from), y: this.game.y(from) },
      { x: this.game.x(tile), y: this.game.y(tile) },
      this.game,
    );
  }

  private carpetBreaksAlliance(
    tile: TileRef,
    allySmallIds: Set<number>,
  ): boolean {
    return carpetWouldBreakAlliance({
      game: this.game,
      tiles: this.carpetFor(tile),
      config: this.game.config(),
      allySmallIds,
    });
  }

  /**
   * Expanded warfare: a bomber flies straight from the airport the engine
   * would use, on through the aim, and non-friendly SAMs threaten it; a
   * barrage flies straight from the nearest loaded silo (any distance) and
   * nothing intercepts it; a paradrop flies from its airport. Plane aims
   * also ring the airports that still have a sortie and mark the one that
   * flies.
   */
  private updateFlightPreview(
    type: UnitType.Bomber | UnitType.CoastalBarrage | UnitType.TransportPlane,
    tileRef: TileRef,
  ): void {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) {
      this.clearNukeTrajectory();
      return;
    }
    const plane = type !== UnitType.CoastalBarrage;
    const src = plane
      ? this.airportFor(tileRef)
      : flightSource(
          myPlayer.units(UnitType.MissileSilo),
          UnitType.CoastalBarrage,
          tileRef,
          this.distSquared,
        );
    const xy = (t: TileRef) => ({ x: this.game.x(t), y: this.game.y(t) });
    const tiles = type === UnitType.Bomber ? this.carpetFor(tileRef) : [];
    let breaksAlliance = false;
    if (type === UnitType.Bomber && tiles.length > 0) {
      const allyIds = new Set<number>();
      for (const a of myPlayer.allies()) allyIds.add(a.smallID());
      breaksAlliance =
        allyIds.size > 0 &&
        carpetWouldBreakAlliance({
          game: this.game,
          tiles,
          config: this.game.config(),
          allySmallIds: allyIds,
        });
    }
    this.nukeTrajectoryStatic = null;
    this.view.updateNukeTrajectory(null);
    this.aimStatic = plane
      ? {
          rings: airportAimRings(myPlayer.units(UnitType.Airport), src, xy),
          carpetFrom: type === UnitType.Bomber && src !== null ? xy(src) : null,
          breaksAlliance,
        }
      : null;
    if (!plane) this.clearAimRings();
    if (src === null) return;
    const sams: SAMInfo[] = [];
    if (type === UnitType.Bomber) {
      const config = this.game.config();
      // Same threat set as a nuke: a bombing breaks alliances at launch, so
      // the SAMs of allies it would betray engage; teammates' never do. The
      // betrayed set covers the whole carpet.
      const teammateIds = new Set<number>();
      for (const p of this.game.players()) {
        if (myPlayer.isOnSameTeam(p)) teammateIds.add(p.smallID());
      }
      const allyIds = new Set<number>();
      for (const a of myPlayer.allies()) allyIds.add(a.smallID());
      const betrayedIds: ReadonlySet<number> =
        allyIds.size > 0
          ? carpetBetrayed({ game: this.game, tiles, config })
          : new Set();
      for (const s of this.game.units(UnitType.SAMLauncher)) {
        if (!s.isActive()) continue;
        const owner = s.owner();
        if (owner === myPlayer) continue;
        if (
          !samThreatensNukePreview(
            owner.smallID(),
            teammateIds,
            allyIds,
            betrayedIds,
          )
        ) {
          continue;
        }
        sams.push({
          x: this.game.x(s.tile()),
          y: this.game.y(s.tile()),
          r: config.samRangeOf(owner, config.samRange(s.level())),
        });
      }
    }
    this.nukeTrajectoryStatic = {
      srcX: this.game.x(src),
      srcY: this.game.y(src),
      directionUp: false,
      sams,
      straight: true,
      carpet: type === UnitType.Bomber,
      dest: null,
    };
  }

  /**
   * The bulk x2/x5 multiplier; strategic weapons fire stockpiled bombs one
   * at a time (plan decision 13), so the keyboard toggle is ignored there.
   */
  private multiplierFor(type: UnitType, upgrading: boolean): number {
    if (
      !upgrading &&
      isStockpiledNuke(type) &&
      this.game.config().strategicWeapons()
    ) {
      return 1;
    }
    return this.uiState.upgradeMultiplier || 1;
  }

  private buildGhostPreviewData(
    tileRef: TileRef | undefined,
    targetingAlly: boolean,
  ): GhostPreviewData | null {
    if (!this.ghostUnit) return null;
    if (tileRef === undefined) return null;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return null;

    const u = this.ghostUnit.buildableUnit;
    const placementTile =
      u.canUpgrade === false && Structures.has(u.type) && u.canBuild !== false
        ? u.canBuild
        : tileRef;

    // Upgrade-target tile — only when upgrading an existing unit.
    let upgradeTargetTile: number | null = null;
    if (u.canUpgrade !== false) {
      upgradeTargetTile = this.game.unit(u.canUpgrade)?.tile() ?? null;
    }

    // Range circle: SAM placement preview shows targetable radius; nuke
    // previews show the outer blast radius at the target tile.
    let rangeRadius = 0;
    let ringTile: TileRef | null = null;
    switch (u.type) {
      case UnitType.SAMLauncher: {
        const level = this.resolveGhostRangeLevel(u) ?? 1;
        const config = this.game.config();
        rangeRadius = config.samRangeOf(myPlayer, config.samRange(level));
        break;
      }
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
        rangeRadius = this.game.config().nukeMagnitudes(u.type).outer;
        break;
      case UnitType.Factory:
        rangeRadius = this.game.config().trainStationMaxRange();
        break;
      case UnitType.DefensePost:
        rangeRadius = this.game.config().defensePostRange();
        break;
      case UnitType.CoastalBattery:
      case UnitType.Airport:
      case UnitType.CoastalBarrage:
      case UnitType.Bomber:
        rangeRadius = warfareGhostRadius(
          u.type,
          u.canUpgrade !== false
            ? (this.game.unit(u.canUpgrade)?.level() ?? 0) + 1
            : 1,
        );
        break;
      case UnitType.ConventionalMissile:
      case UnitType.Satellite: {
        // Strategic weapons: ring the building the missile would hit, or
        // the silo the satellite would use.
        const ringed =
          u.type === UnitType.ConventionalMissile
            ? missileTargetPreview(this.game, myPlayer, tileRef)
            : satelliteSiloPreview(this.game, myPlayer, tileRef);
        if (ringed !== null) {
          rangeRadius = TARGET_RING_RADIUS;
          ringTile = ringed.tile();
        }
        break;
      }
    }
    this.ringAnchored = ringTile !== null;
    let radiusTileX = this.game.x(placementTile);
    let radiusTileY = this.game.y(placementTile);
    if (
      rangeRadius > 0 &&
      u.canUpgrade !== false &&
      upgradeTargetTile !== null
    ) {
      radiusTileX = this.game.x(upgradeTargetTile);
      radiusTileY = this.game.y(upgradeTargetTile);
    }
    if (ringTile !== null) {
      radiusTileX = this.game.x(ringTile);
      radiusTileY = this.game.y(ringTile);
    }

    const isNuke = u.type === UnitType.AtomBomb;
    const multiplier =
      u.canUpgrade !== false || isNuke
        ? this.multiplierFor(u.type, u.canUpgrade !== false)
        : 1;
    // Strategic weapons: a bomb comes from the stockpile; no gold is spent.
    const stock = isStockpiledNuke(u.type)
      ? (myPlayer.strategicData()?.stock[u.type] ?? null)
      : null;
    const cost = stock !== null ? 0n : bulkCost(u, multiplier);
    // Drives the red cost label: gold short of the bulk total, or (for
    // bombs) fewer loaded silo tubes than the selected amount.
    let canAfford =
      stock !== null ? stock >= multiplier : myPlayer.gold() >= cost;
    if (isNuke) {
      canAfford &&= myPlayer.readyMissileCount() >= multiplier;
    }
    return {
      ghostType: u.type,
      tileX: this.game.x(placementTile),
      tileY: this.game.y(placementTile),
      snapToPlacement: placementTile !== tileRef,
      radiusTileX,
      radiusTileY,
      canBuild: u.canBuild !== false,
      canUpgrade: u.canUpgrade !== false,
      cost: Number(cost),
      multiplier: multiplier,
      showCost: stock === null && this.userSettings.cursorCostLabel(),
      canAfford,
      ghostRailPaths: u.ghostRailPaths,
      overlappingRailroads: u.overlappingRailroads,
      ownerID: myPlayer.smallID(),
      upgradeTargetTile,
      rangeRadius,
      rangeWarning: targetingAlly,
    };
  }

  /**
   * Note which tile the ghost's buildableUnit now describes, and when the
   * aimed tile's preview first showed. Nothing is built from here: a tap
   * made before the check came back is not kept to fire later.
   */
  private recordCheck(
    ghostAtQuery: { buildableUnit: BuildableUnit },
    tileRef: TileRef | undefined,
  ): void {
    if (this.ghostUnit !== ghostAtQuery) return;
    this.checked = { tile: tileRef };
    if (
      this.aim !== null &&
      this.aim.tile === tileRef &&
      this.aimShownAt === null
    ) {
      this.aimShownAt = performance.now();
    }
  }

  /**
   * Touch: a tap on the aimed ghost's icon builds it when the check for its
   * tile is back, says it can, and has been on screen GHOST_SEEN_MS. A tap on
   * the icon before then does nothing: the aim and its clock stay, and the
   * tap is not kept to fire later. Any other tap aims the ghost there
   * instead: one off the icon, and one on a red ghost.
   */
  private onBuildTap(e: BuildTapEvent): void {
    this.syncGhostState();
    if (!this.ghostUnit) return;
    const aim = this.aim;
    if (aim !== null && this.isOnAimedGhost(e.x, e.y)) {
      const shownAt = this.aimShownAt;
      const checked = this.checked?.tile === aim.tile && shownAt !== null;
      // Still waiting for this tile's check: keep waiting.
      if (!checked) return;
      const buildable = aim.tile !== undefined && this.isGhostReadyForConfirm();
      if (buildable) {
        if (performance.now() - shownAt >= GHOST_SEEN_MS) {
          this.confirmAim();
        }
        // Too soon: keep the aim and its clock.
        return;
      } else {
        // Red there: say no when the tap is on that very tile.
        const tapped = this.transformHandler.screenToWorldCoordinates(e.x, e.y);
        if (tapped.x === aim.cellX && tapped.y === aim.cellY) {
          this.view.triggerBlockedFlash(aim.cellX + 0.5, aim.cellY + 0.5);
        }
      }
    }
    this.aimAt(e.x, e.y);
  }

  private aimAt(x: number, y: number): void {
    const w = this.transformHandler.screenToWorldCoordinatesFloat(x, y);
    const cellX = Math.floor(w.x);
    const cellY = Math.floor(w.y);
    let tile: TileRef | undefined;
    if (this.game.isValidCoord(cellX, cellY)) {
      tile = this.game.ref(cellX, cellY);
      if (this.game.isImpassable(tile)) tile = undefined;
    }
    this.aim = {
      screenX: x,
      screenY: y,
      worldX: w.x,
      worldY: w.y,
      cellX,
      cellY,
      tile,
    };
    this.mousePos.x = x;
    this.mousePos.y = y;
    // Whatever was checked before was for another tile.
    this.checked = null;
    this.aimShownAt = null;
    this.queryGhost();
  }

  /** On the aimed ghost's icon as drawn (at least GHOST_TAP_MIN_RADIUS_PX). */
  private isOnAimedGhost(x: number, y: number): boolean {
    const aim = this.aim;
    if (aim === null || !this.ghostUnit) return false;
    const center = this.transformHandler.worldToScreenCoordinates(
      new Cell(aim.worldX, aim.worldY),
    );
    const east = this.transformHandler.worldToScreenCoordinates(
      new Cell(aim.worldX + 1, aim.worldY),
    );
    // MapRenderer.getSettings is {} while there is no renderer.
    const ss = this.view.getSettings().structure as
      | RenderSettings["structure"]
      | undefined;
    const radius = Math.max(
      GHOST_TAP_MIN_RADIUS_PX,
      ss === undefined
        ? 0
        : structureIconRadiusPx(
            ss,
            this.ghostUnit.buildableUnit.type,
            Math.hypot(east.x - center.x, east.y - center.y),
            renderDpr(),
          ),
    );
    // A snapped ghost (a port on the coast...) is drawn on its placement
    // tile, any other at the aimed point (see cursorLoop).
    const ghost = this.lastGhostData;
    const drawnAt =
      ghost !== null && ghost.snapToPlacement
        ? new Cell(ghost.tileX + 0.5, ghost.tileY + 0.5)
        : new Cell(aim.worldX, aim.worldY);
    const s = this.transformHandler.worldToScreenCoordinates(drawnAt);
    if (Math.hypot(s.x - x, s.y - y) <= radius) return true;
    // A target ring sits on its building: a tap there is a tap on the
    // aimed ghost, so firing stays aim, check, tap.
    if (ghost !== null && this.ringAnchored) {
      const b = this.transformHandler.worldToScreenCoordinates(
        new Cell(ghost.radiusTileX + 0.5, ghost.radiusTileY + 0.5),
      );
      return Math.hypot(b.x - x, b.y - y) <= GHOST_TAP_MIN_RADIUS_PX;
    }
    return false;
  }

  /**
   * Build the aimed ghost. Only the check made for the aimed tile can
   * confirm it; before that is back nothing happens (and nothing waits).
   */
  private confirmAim(): void {
    const aim = this.aim;
    if (!this.ghostUnit || aim === null || aim.tile === undefined) return;
    if (this.checked === null || this.checked.tile !== aim.tile) return;
    const bu = this.ghostUnit.buildableUnit;
    if (bu.canUpgrade !== false) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          bu.canUpgrade,
          bu.type,
          this.uiState.upgradeMultiplier || 1,
        ),
      );
      this.removeGhostStructure();
      return;
    }
    if (bu.canBuild === false) {
      // The ghost shows why (red, ally warning...): say no, stay in build mode.
      this.view.triggerBlockedFlash(aim.cellX + 0.5, aim.cellY + 0.5);
      return;
    }
    if (this.shouldBlockRecentAllyNuke(aim.tile, bu.type)) return;
    this.emitBuildIntent(bu.type, aim.tile);
    // A finger can't hover to aim the next bomb, so none stays armed.
    this.removeGhostStructure();
  }

  private emitBuildIntent(unitType: UnitType, targetTile: TileRef): void {
    if (unitType === UnitType.TransportPlane) {
      // A paradrop is no build: the radial menu's intent, with the same
      // attack ratio of my troops.
      const troops = this.game.myPlayer()?.troops() ?? 0;
      this.eventBus.emit(
        new SendParadropIntentEvent(
          targetTile,
          this.uiState.attackRatio * troops,
        ),
      );
      return;
    }
    const isNuke = unitType === UnitType.AtomBomb;
    const rocketDirectionUp =
      unitType === UnitType.AtomBomb || unitType === UnitType.HydrogenBomb
        ? this.uiState.rocketDirectionUp
        : undefined;
    this.eventBus.emit(
      new BuildUnitIntentEvent(
        unitType,
        targetTile,
        rocketDirectionUp,
        isNuke ? this.multiplierFor(unitType, false) : undefined,
      ),
    );
  }

  private isGhostReadyForConfirm(): boolean {
    if (!this.ghostUnit) return false;
    const bu = this.ghostUnit.buildableUnit;
    return bu.canBuild !== false || bu.canUpgrade !== false;
  }

  private requestConfirmStructure(e: MouseUpEvent): void {
    if (!this.ghostUnit && !this.uiState.ghostStructure) return;
    if (this.isGhostReadyForConfirm()) {
      this.createStructure(e);
    } else {
      this.pendingConfirm = e;
    }
  }

  private createStructure(e: MouseUpEvent) {
    if (!this.ghostUnit) return;
    if (
      this.ghostUnit.buildableUnit.canBuild === false &&
      this.ghostUnit.buildableUnit.canUpgrade === false
    ) {
      this.removeGhostStructure();
      return;
    }
    const tile = this.transformHandler.screenToWorldCoordinates(e.x, e.y);
    if (this.ghostUnit.buildableUnit.canUpgrade !== false) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          this.ghostUnit.buildableUnit.canUpgrade,
          this.ghostUnit.buildableUnit.type,
          this.uiState.upgradeMultiplier || 1,
        ),
      );
      this.removeGhostStructure();
    } else if (this.ghostUnit.buildableUnit.canBuild) {
      // The pointer can be released just off the map edge before the
      // throttled hover refresh marks the ghost unbuildable; there is no
      // tile to build on, so keep the ghost and wait for a click on the map.
      if (!this.game.isValidCoord(tile.x, tile.y)) return;
      const unitType = this.ghostUnit.buildableUnit.type;
      const targetTile = this.game.ref(tile.x, tile.y);

      if (this.shouldBlockRecentAllyNuke(targetTile, unitType)) {
        return;
      }

      this.emitBuildIntent(unitType, targetTile);
      if (!shouldPreserveGhostAfterBuild(unitType)) {
        this.removeGhostStructure();
      }
    } else {
      this.removeGhostStructure();
    }
  }

  private shouldBlockRecentAllyNuke(
    tile: TileRef,
    unitType: UnitType,
  ): boolean {
    const duration = this.userSettings.nukeAllianceSafetyDuration();
    if (
      duration <= 0 ||
      (unitType !== UnitType.AtomBomb &&
        unitType !== UnitType.HydrogenBomb &&
        unitType !== UnitType.Bomber &&
        unitType !== UnitType.MIRV)
    ) {
      return false;
    }

    const alliances = this.game.myPlayer()?.alliances();
    if (!alliances?.length) return false;

    const currentTick = this.game.ticks();
    const freshAllies = new Map<number, number>();
    for (const a of alliances) {
      if (
        !this.usedSafetyAllies.has(a.id) &&
        currentTick - a.createdAt <= duration
      ) {
        freshAllies.set(this.game.player(a.other).smallID(), a.id);
      }
    }
    if (freshAllies.size === 0) return false;

    const broken =
      unitType === UnitType.MIRV
        ? [this.game.ownerID(tile)]
        : unitType === UnitType.Bomber
          ? carpetBetrayed({
              game: this.game,
              tiles: this.carpetFor(tile),
              config: this.game.config(),
            })
          : listNukeBreakAlliance({
              game: this.game,
              targetTile: tile,
              magnitude: this.game.config().nukeMagnitudes(unitType),
              threshold: this.game.config().nukeAllianceBreakThreshold(),
            });

    let blocked = false;
    for (const smallId of broken) {
      const allianceId = freshAllies.get(smallId);
      if (allianceId !== undefined) {
        this.usedSafetyAllies.add(allianceId);
        blocked = true;
      }
    }

    if (blocked) {
      this.view.triggerBlockedFlash(
        this.game.x(tile) + 0.5,
        this.game.y(tile) + 0.5,
      );
    }
    return blocked;
  }

  private moveGhost(e: MouseMoveEvent) {
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;
    // A mouse moving off takes the ghost back; the compat mousemove a
    // browser sends after a tap, at the tap, keeps the aim.
    if (
      this.aim !== null &&
      Math.hypot(e.x - this.aim.screenX, e.y - this.aim.screenY) >
        COMPAT_MOUSEMOVE_SLOP_PX
    ) {
      this.aim = null;
      this.aimShownAt = null;
    }
  }

  private createGhostStructure(type: PlayerBuildableUnitType | null) {
    if (type === null) return;
    if (this.game.myPlayer() === null) return;
    this.ghostUnit = {
      buildableUnit: {
        type,
        canBuild: false,
        canUpgrade: false,
        cost: 0n,
        overlappingRailroads: [],
        ghostRailPaths: [],
      },
    };
  }

  private clearGhostStructure() {
    this.pendingConfirm = null;
    this.aim = null;
    this.checked = null;
    this.aimShownAt = null;
    this.ghostUnit = null;
    this.lastGhostData = null;
    this.view.updateGhostPreview(null);
    this.clearNukeTrajectory();
  }

  private removeGhostStructure() {
    this.clearGhostStructure();
    this.uiState.ghostStructure = null;
  }

  private resolveGhostRangeLevel(
    buildableUnit: BuildableUnit,
  ): number | undefined {
    if (buildableUnit.type !== UnitType.SAMLauncher) return undefined;
    if (buildableUnit.canUpgrade !== false) {
      const existing = this.game.unit(buildableUnit.canUpgrade);
      if (existing) {
        return existing.level() + 1;
      } else {
        console.warn("Failed to find existing SAMLauncher for upgrade");
      }
    }
    return 1;
  }
}
