/**
 * MapRenderer — public facade for the WebGL map renderer.
 *
 * Wraps GPURenderer as a private implementation detail and survives WebGL
 * context loss: when the context is lost the renderer is disposed, and on
 * restore a fresh GPURenderer is created and `onContextRestored` fires so
 * the owner can re-upload all simulation state.
 *
 * This is a pure data sink. Input handling lives in InputHandler/EventBus;
 * camera state is pushed in each frame via setCameraState. Consumers only
 * touch MapRenderer — they never import GPURenderer or Camera.
 */

import type { MapLayer } from "@openfront/engine-api/game/MapFiles";
import type { Config } from "@openfront/engine-lib/configuration/Config";
import type { WwLandSelection } from "../../hud/ww1936/LandSelection";
import type { SeaAirSelection } from "../../hud/ww1936/SeaAirSelection";
import type { LandWarInputs } from "../../view/LandFrontWorld";
import type { WwAirView } from "../../view/WwAirView";
import type { WwLandView } from "../../view/WwLandView";
import type { WwNavyView } from "../../view/WwNavyView";
import type { SpiralRibbon } from "../frame/SpiralTrails";
import type {
  AttackRingInput,
  BonusEvent,
  ConquestFx,
  DeadUnitFx,
  GhostPreviewData,
  NameEntry,
  NukeTelegraphData,
  NukeTrajectoryData,
  PlayerState,
  PlayerStatic,
  PlayerStatusData,
  RendererConfig,
  TerrainRect,
  UnitState,
} from "../types";
import type { SpawnCenter } from "./passes/SpawnOverlayPass";
import type { CountdownFx, PreparingFx } from "./passes/StrategicFxPass";
import type { Ring } from "./passes/WarfareRingPass";
import type { AttackTroopLabel } from "./passes/WorldTextPass";
import { GPURenderer } from "./Renderer";
import type { RenderSettings } from "./RenderSettings";

export class MapRenderer {
  private renderer: GPURenderer | null = null;
  private resizeObs: ResizeObserver | null = null;
  // Stored layer data for context-restore re-creation.
  private storedLayers: MapLayer[] = [];
  private storedLayerImages: Map<string, ImageBitmap> = new Map();
  /** World War 1936 region ids, re-applied after a context restore. */
  private storedRegions: Uint16Array | null = null;
  /** World War 1936 P2 land war inputs, re-applied after a context restore. */
  private storedWwLand: Parameters<GPURenderer["setWwLand"]> | null = null;
  /** World War 1936 P4 inputs, re-applied after a context restore. */
  private storedWwNavy: WwNavyView | null = null;
  private storedWwAir: WwAirView | null = null;
  private storedSeaAirSelection: SeaAirSelection | null = null;
  // Layer state that survives context loss (GPU textures do not).
  private layerVisibility = new Map<string, boolean>();
  private layerAlpha = new Map<string, number>();
  private layerDestroyedMasks = new Map<string, Uint8Array>();

  /**
   * Called after a lost WebGL context is restored and the renderer has been
   * recreated. The owner must re-upload all simulation state (textures and
   * geometry are gone).
   */
  onContextRestored: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private header: RendererConfig,
    // Called (not stored) whenever terrain bytes are needed — initial bake
    // and every context restore. Regenerating on demand avoids retaining a
    // map-sized buffer for the rare restore path.
    private terrainSource: () => Uint8Array,
    private paletteData: Float32Array,
    private config: Config,
    // Resolved render settings (defaults + overrides). Held so the same object
    // is re-used when a GPURenderer is recreated after a context restore,
    // preserving any user overrides that were applied to it.
    private settings: RenderSettings,
    private raf?: typeof requestAnimationFrame,
    private caf?: typeof cancelAnimationFrame,
  ) {
    this.initRenderer();

    this.resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) this.renderer?.resize(width, height);
      }
    });
    this.resizeObs.observe(canvas);

    canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
    canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
      false,
    );
  }

  private initRenderer = () => {
    this.renderer = new GPURenderer(
      this.canvas,
      this.header,
      this.terrainSource,
      this.paletteData,
      this.config,
      this.settings,
      this.raf,
      this.caf,
    );

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0) this.renderer.resize(rect.width, rect.height);
  };

  private handleContextLost = (e: Event) => {
    // preventDefault is what asks the browser to restore the context. Disposal
    // must then leave the context alone: calling loseContext() re-loses it
    // *manually*, which switches Chromium to manual recovery, so
    // webglcontextrestored never arrives and the map stays blank for the rest
    // of the session under a HUD that carries on updating.
    e.preventDefault();
    console.warn("[Renderer] WebGL context lost — awaiting restore");
    if (this.renderer) {
      this.renderer.dispose({ releaseContext: false });
      this.renderer = null;
    }
  };

  private handleContextRestored = () => {
    console.warn("[Renderer] WebGL context restored");
    try {
      this.initRenderer();
    } catch (err) {
      // Chromium turns hardware acceleration off after repeated GPU-process
      // crashes, so the re-acquired context can come back software-only and
      // initGL rejects it. Nothing left to do but leave the map blank —
      // without this the throw escapes the event handler unlogged.
      this.renderer = null;
      console.error("[Renderer] context restore failed", err);
      return;
    }
    // Re-apply stored layers to the new renderer.
    if (this.storedLayers.length > 0 && this.storedLayerImages.size > 0) {
      this.renderer?.setMapLayers(this.storedLayers, this.storedLayerImages);
      // Re-apply visibility overrides.
      for (const [id, vis] of this.layerVisibility) {
        this.renderer?.setLayerVisible(id, vis);
      }
      // Re-apply alpha overrides.
      for (const [id, alpha] of this.layerAlpha) {
        this.renderer?.setLayerAlpha(id, alpha);
      }
      // Re-apply destroyed masks.
      for (const [id, mask] of this.layerDestroyedMasks) {
        this.renderer?.setLayerDestroyedMask(id, mask);
      }
    }
    if (this.storedRegions !== null) {
      this.renderer?.setRegions(this.storedRegions);
    }
    if (this.storedWwLand !== null) {
      this.renderer?.setWwLand(...this.storedWwLand);
    }
    if (this.storedWwNavy !== null) this.renderer?.setWwNavy(this.storedWwNavy);
    if (this.storedWwAir !== null) this.renderer?.setWwAir(this.storedWwAir);
    if (this.storedSeaAirSelection !== null) {
      this.renderer?.setSeaAirSelection(this.storedSeaAirSelection);
    }
    this.onContextRestored?.();
  };

  /**
   * Set when the context is hardware-accelerated but its MAX_TEXTURE_SIZE is
   * below what the game needs (fingerprinting protection, #4357). The game
   * runs, but the map may render with black areas — the owner should warn.
   */
  get glLimited(): { renderer: string; maxTextureSize: number } | null {
    return this.renderer?.glLimited ?? null;
  }

  // ---- Camera ----

  setCameraState(x: number, y: number, z: number): void {
    this.renderer?.setCameraState(x, y, z);
  }

  // ---- Data upload ----

  uploadLiveDelta(
    tileState: Uint16Array,
    changedTiles: readonly number[],
  ): void {
    this.renderer?.uploadLiveDelta(tileState, changedTiles);
  }
  uploadLiveTrailDelta(
    trailState: Uint16Array,
    dirtyRowMin: number,
    dirtyRowMax: number,
  ): void {
    this.renderer?.uploadLiveTrailDelta(trailState, dirtyRowMin, dirtyRowMax);
  }
  /** Upload full tile + trail state without resetting bloom (for live play). */
  uploadTileAndTrailState(
    tileState: Uint16Array,
    trailState: Uint16Array,
  ): void {
    this.renderer?.uploadTileAndTrailState(tileState, trailState);
  }
  updateSpiralRibbons(ribbons: readonly SpiralRibbon[]): void {
    this.renderer?.updateSpiralRibbons(ribbons);
  }
  updatePalette(paletteData: Float32Array): void {
    this.renderer?.updatePalette(paletteData);
  }
  updateEffectPalette(effectData: Float32Array): void {
    this.renderer?.updateEffectPalette(effectData);
  }
  addPlayers(
    players: PlayerStatic[],
    paletteData: Float32Array,
    patternMeta: Float32Array,
    patternData: Uint8Array,
  ): void {
    this.renderer?.addPlayers(players, paletteData, patternMeta, patternData);
  }
  updatePlayerCosmetics(
    players: PlayerStatic[],
    paletteData: Float32Array,
    patternMeta: Float32Array,
    patternData: Uint8Array,
  ): void {
    this.renderer?.updatePlayerCosmetics(
      players,
      paletteData,
      patternMeta,
      patternData,
    );
  }
  setPlayerSkin(smallID: number, url: string | null): void {
    this.renderer?.setPlayerSkin(smallID, url);
  }
  initSkinAtlas(urls: readonly string[]): void {
    this.renderer?.initSkinAtlas(urls);
  }
  setPlayerSpawn(smallID: number, x: number, y: number): void {
    this.renderer?.setPlayerSpawn(smallID, x, y);
  }
  uploadRailroadState(data: Uint8Array): void {
    this.renderer?.uploadRailroadState(data);
  }
  updateUnits(units: Map<number, UnitState>, gameTick: number): void {
    this.renderer?.updateUnits(units, gameTick);
  }
  updateNames(
    names: Map<string, NameEntry>,
    players: Map<number, PlayerState>,
    snap: boolean,
    statusData?: Map<number, PlayerStatusData>,
  ): void {
    this.renderer?.updateNames(names, players, snap, statusData);
  }
  refreshNames(displayNames: Map<string, string>): void {
    this.renderer?.refreshNames(displayNames);
  }
  updateRelations(data: Uint8Array, size: number): void {
    this.renderer?.updateRelations(data, size);
  }
  updateStructures(units: Map<number, UnitState>): void {
    this.renderer?.updateStructures(units);
  }
  applyDeadUnits(deadUnits: DeadUnitFx[]): void {
    this.renderer?.applyDeadUnits(deadUnits);
  }
  applyBombDrops(
    drops: readonly { attackerID: number; x: number; y: number }[],
  ): void {
    this.renderer?.applyBombDrops(drops);
  }
  applyConquestEvents(events: ConquestFx[]): void {
    this.renderer?.applyConquestEvents(events);
  }
  setAttackTroopLabels(labels: AttackTroopLabel[]): void {
    this.renderer?.setAttackTroopLabels(labels);
  }
  applyBonusEvents(events: BonusEvent[]): void {
    this.renderer?.applyBonusEvents(events);
  }
  triggerBlockedFlash(tileX: number, tileY: number): void {
    this.renderer?.triggerBlockedFlash(tileX, tileY);
  }
  applyRailroadDust(tileRefs: number[]): void {
    this.renderer?.applyRailroadDust(tileRefs);
  }
  /**
   * Refresh terrain texels whose underlying terrain byte changed (water
   * nukes). Each rect's bytes are stored row-major, concatenated in `bytes`
   * in rect order.
   */
  applyTerrainRects(rects: readonly TerrainRect[], bytes: Uint8Array): void {
    this.renderer?.applyTerrainRects(rects, bytes);
  }

  /** Rebuild the terrain texture from current settings (e.g. ocean color). */
  rebuildTerrain(): void {
    this.renderer?.rebuildTerrain();
  }
  updateAttackRings(rings: AttackRingInput[]): void {
    this.renderer?.updateAttackRings(rings);
  }

  /** Update ghost structure preview (build-mode visualization). null = clear. */
  updateGhostPreview(data: GhostPreviewData | null): void {
    this.renderer?.updateGhostPreview(data);
  }

  // ---- Nuke UI ----

  /** Update nuke trajectory preview arc. null = hide. */
  updateNukeTrajectory(data: NukeTrajectoryData | null): void {
    this.renderer?.updateNukeTrajectory(data);
  }

  /** Paradrop / bomber aim preview rings (airport ranges, carpet); [] clears. */
  updateAimRings(rings: readonly Ring[]): void {
    this.renderer?.updateAimRings(rings);
  }

  /** Update in-flight nuke target telegraph circles. */
  updateNukeTelegraphs(data: NukeTelegraphData[]): void {
    this.renderer?.updateNukeTelegraphs(data);
  }

  /** Update spawn phase overlay (tile highlights + breathing rings). */
  updateSpawnOverlay(inSpawnPhase: boolean, centers: SpawnCenter[]): void {
    this.renderer?.updateSpawnOverlay(inSpawnPhase, centers);
  }

  /** Set the small-player glow set (1 byte per owner smallID), or null = off. */
  updateSmallPlayerGlow(set: Uint8Array | null): void {
    this.renderer?.updateSmallPlayerGlow(set);
  }

  /** Strategic weapons: factory/silo unit id -> bar fill (0..1). */
  setStrategicProgress(progress: ReadonlyMap<number, number>): void {
    this.renderer?.setStrategicProgress(progress);
  }

  /** Strategic weapons: beams and blasts at orbital strike impacts. */
  applyOrbitalStrikes(points: readonly { x: number; y: number }[]): void {
    this.renderer?.applyOrbitalStrikes(points);
  }

  /** Strategic weapons: silos preparing a satellite, strikes counting down. */
  setStrategicFx(
    preparing: readonly PreparingFx[],
    countdowns: readonly CountdownFx[],
    satelliteSilos: ReadonlySet<number>,
  ): void {
    this.renderer?.setStrategicFx(preparing, countdowns, satelliteSilos);
  }

  /** World congress: emergency targets' borders pulse. */
  setCongressPulse(ownerIDs: readonly number[]): void {
    this.renderer?.setCongressPulse(ownerIDs);
  }

  /** Strategic weapons: streaks rising from silos (a satellite launch, an interceptor). */
  spawnStrategicStreaks(
    launches: readonly { x: number; y: number }[],
    intercepts: readonly { x: number; y: number }[],
  ): void {
    this.renderer?.spawnStrategicStreaks(launches, intercepts);
  }

  /** Domestic mode: host unit id -> victory-project progress (0..1). */
  setVictoryProjects(progress: ReadonlyMap<number, number>): void {
    this.renderer?.setVictoryProjects(progress);
  }

  // ---- Map layers ----

  /** World War 1936 (spec §8.2): the lines between regions and sea zones. */
  setRegions(regionIds: Uint16Array): void {
    this.storedRegions = regionIds;
    this.renderer?.setRegions(regionIds);
  }

  /**
   * World War 1936 P2 (spec §15.2): draw the land war from `view` — army
   * tokens, battle markers, the chosen army's plan arrows and front, the
   * encircled regions. `me` gives the viewer's smallID. `war` (optional)
   * gives the World War data and the game tick — GameRenderer passes
   * `{ war: () => game.worldWarData(), ticks: () => game.ticks() }` — for
   * the engine's enemies (FrontRules) and the tick tokens glide from;
   * without it every country outside the viewer's side counts as an enemy.
   */
  setWwLand(
    view: WwLandView,
    selection: WwLandSelection,
    me: () => number,
    war: LandWarInputs | null = null,
  ): void {
    this.storedWwLand = [view, selection, me, war];
    this.renderer?.setWwLand(view, selection, me, war);
  }

  /**
   * World War 1936 P4 (spec §18.2): draw the navy from `view` — fleet
   * tokens, naval battle markers, the viewer's convoys and invasions, and
   * the sea layer when the selection shows it.
   */
  setWwNavy(view: WwNavyView): void {
    this.storedWwNavy = view;
    this.renderer?.setWwNavy(view);
  }

  /** World War 1936 P4: draw the air war from `view` — sorties, wrecks, carpets, the air layer. */
  setWwAir(view: WwAirView): void {
    this.storedWwAir = view;
    this.renderer?.setWwAir(view);
  }

  /**
   * World War 1936 P4: the navy and air HUD's shared choice (SeaAirSelection:
   * the layer shown, the chosen fleet and zone). Without it no layer shows
   * and no fleet is chosen.
   */
  setSeaAirSelection(selection: SeaAirSelection): void {
    this.storedSeaAirSelection = selection;
    this.renderer?.setSeaAirSelection(selection);
  }

  /** Set up map-layer passes from the loaded layer data. */
  setMapLayers(layers: MapLayer[], images: Map<string, ImageBitmap>): void {
    this.storedLayers = layers;
    this.storedLayerImages = images;
    this.renderer?.setMapLayers(layers, images);
    // The images can arrive after nukes have hit (a replay seeks ahead
    // while they load), and the new layer passes start undamaged.
    for (const [id, mask] of this.layerDestroyedMasks) {
      this.renderer?.setLayerDestroyedMask(id, mask);
    }
  }

  /** Toggle visibility of a single map layer. */
  setLayerVisible(layerId: string, visible: boolean): void {
    this.layerVisibility.set(layerId, visible);
    this.renderer?.setLayerVisible(layerId, visible);
  }

  /** Set the alpha multiplier for a single map layer (0–1). */
  setLayerAlpha(layerId: string, alpha: number): void {
    this.layerAlpha.set(layerId, alpha);
    this.renderer?.setLayerAlpha(layerId, alpha);
  }

  /** Batch-mark tiles as destroyed for a nukeable layer. */
  markLayerTilesDestroyed(layerId: string, tileIndices: number[]): void {
    // Accumulate into the CPU-side mask for context-restore.
    let mask = this.layerDestroyedMasks.get(layerId);
    if (!mask) {
      mask = new Uint8Array(this.header.mapWidth * this.header.mapHeight);
      this.layerDestroyedMasks.set(layerId, mask);
    }
    for (const t of tileIndices) {
      if (t >= 0 && t < mask.length) mask[t] = 1;
    }
    this.renderer?.markLayerTilesDestroyed(layerId, tileIndices);
  }

  /** Bulk-update the destroyed mask for a nukeable layer. */
  setLayerDestroyedMask(layerId: string, mask: Uint8Array): void {
    // Copied into the mask kept for context restore, which a replay's
    // seeks reuse rather than allocating a map-sized array each time.
    const kept = this.layerDestroyedMasks.get(layerId);
    if (kept?.length === mask.length) kept.set(mask);
    else this.layerDestroyedMasks.set(layerId, new Uint8Array(mask));
    this.renderer?.setLayerDestroyedMask(layerId, mask);
  }

  // ---- Selection box ----

  /** Set multiple selected units (multi-select). Pass [] to clear. */
  setSelectedUnits(unitIds: readonly number[]): void {
    this.renderer?.setSelectedUnits(unitIds);
  }

  /** Flash converging-chevron animation at a warship move target. */
  showMoveIndicator(tileX: number, tileY: number, ownerID: number): void {
    this.renderer?.showMoveIndicator(tileX, tileY, ownerID);
  }

  // ---- SAM radius ----

  setSAMAllianceClusters(clusters: Map<number, number>): void {
    this.renderer?.setSAMAllianceClusters(clusters);
  }
  /** SAM rings at each owner's modified range (Config.samRangeOf). */
  setSamRangeOf(fn: (ownerID: number, baseRange: number) => number): void {
    this.renderer?.setSamRangeOf(fn);
  }

  // ---- Other ----

  setLocalPlayerID(id: number): void {
    this.renderer?.setLocalPlayerID(id);
  }
  /** Rail color for the local player (0–1 RGB). */
  setLocalRailColor(r: number, g: number, b: number): void {
    this.renderer?.setLocalRailColor(r, g, b);
  }
  setAltView(active: boolean): void {
    this.renderer?.setAltView(active);
  }
  setGridView(active: boolean): void {
    this.renderer?.setGridView(active);
  }
  setHighlightOwner(ownerID: number): void {
    this.renderer?.setHighlightOwner(ownerID);
  }
  setMouseWorldPos(x: number, y: number): void {
    this.renderer?.setMouseWorldPos(x, y);
  }
  setHighlightStructureTypes(unitTypes: string[] | null): void {
    this.renderer?.setHighlightStructureTypes(unitTypes);
  }
  getSettings(): RenderSettings {
    return this.renderer?.getSettings() ?? ({} as RenderSettings);
  }

  // ---- Lifecycle ----

  dispose(): void {
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.onContextRestored = null;
    this.renderer?.dispose();
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
  }
}
