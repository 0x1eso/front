/**
 * GPURenderer v2 — normalized render pipeline.
 *
 * Draw order:
 *   DATA SYNC: tile flush → heat update → border compute
 *   BASE PASS (darkened by night): terrain → territory fill + stale-nuke ground
 *   NIGHT COMPOSITE (optional): lightmap → scene × (ambient + lightmap)
 *   FULL BRIGHTNESS (always): borders → railroads → ground units → structures →
 *     structure levels → bars → bloom → trails → missiles → fx → conquest → names
 *   WORLD WAR 1936 P2 (spec §15.2): region flags with the region lines in the
 *     base layer; battle markers → plan arrows → army tokens over the names
 */

import type { MapLayer } from "@openfront/engine-api/game/MapFiles";
import { ARMY_PARA } from "@openfront/engine-api/ww1936/LandTypes";
import type { Config } from "@openfront/engine-lib/configuration/Config";
import { PLANE_SPEED } from "@openfront/engine-lib/warfare/Warfare";
import { frontOf, frontSize } from "@openfront/engine-lib/ww1936/FrontRules";
import type { WwLandSelection } from "../../hud/ww1936/LandSelection";
import { translateText } from "../../Utils";
import { TokenLayoutCache, tokenLod } from "../../view/LandTokenLayout";
import type { WwLandView } from "../../view/WwLandView";
import { nextTickSpan } from "../frame/derive/PlaneTrack";
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
import { UT_SHELL, UT_TRANSPORT_PLANE } from "../types";
import { Camera } from "./Camera";
import { GLUnavailableError, initGL } from "./initGL";
import { LandAtlas } from "./LandAtlas";
import { AirFxPass } from "./passes/AirFxPass";
import { ArmyTokenPass } from "./passes/ArmyTokenPass";
import { BarPass } from "./passes/BarPass";
import { BattleMarkerPass } from "./passes/BattleMarkerPass";
import { BorderComputePass } from "./passes/BorderComputePass";
import { BorderStampPass } from "./passes/BorderStampPass";
import { CoordinateGridPass } from "./passes/CoordinateGridPass";
import { CrosshairPass } from "./passes/CrosshairPass";
import { DefenseCoveragePass } from "./passes/DefenseCoveragePass";
import { FalloutBloomPass } from "./passes/FalloutBloomPass";
import { FalloutLightPass } from "./passes/FalloutLightPass";
import { FxPass } from "./passes/fx-pass";
import { LightmapPass } from "./passes/LightmapPass";
import { MapLayerPass } from "./passes/MapLayerPass";
import { MoveIndicatorPass } from "./passes/MoveIndicatorPass";
import { NamePass } from "./passes/name-pass";
import { NightCompositePass } from "./passes/NightCompositePass";
import { NukeTelegraphPass } from "./passes/NukeTelegraphPass";
import { NukeTrajectoryPass } from "./passes/NukeTrajectoryPass";
import { OrbitalBeamPass } from "./passes/OrbitalBeamPass";
import { PlanArrowPass } from "./passes/PlanArrowPass";
import { PlanePass } from "./passes/PlanePass";
import { PointLightPass } from "./passes/PointLightPass";
import { RailroadPass } from "./passes/RailroadPass";
import { RangeCirclePass } from "./passes/RangeCirclePass";
import {
  FLAG_TEX_SIZE,
  RegionBorderPass,
  regionFlagBytes,
  sameLandSide,
} from "./passes/RegionBorderPass";
import { SAMRadiusPass } from "./passes/SamRadiusPass";
import { SelectionBoxPass } from "./passes/SelectionBoxPass";
import { SkinAtlasArray } from "./passes/SkinAtlasArray";
import { SmallPlayerGlowPass } from "./passes/SmallPlayerGlowPass";
import type { SpawnCenter } from "./passes/SpawnOverlayPass";
import { SpawnOverlayPass } from "./passes/SpawnOverlayPass";
import { SpiralRibbonPass } from "./passes/SpiralRibbonPass";
import {
  StrategicFxPass,
  type CountdownFx,
  type PreparingFx,
} from "./passes/StrategicFxPass";
import { StructureLevelPass } from "./passes/StructureLevelPass";
import { StructurePass } from "./passes/StructurePass";
import { TerrainPass } from "./passes/TerrainPass";
import { TerritoryPass } from "./passes/TerritoryPass";
import { TrailPass } from "./passes/TrailPass";
import { UnitPass } from "./passes/UnitPass";
import { VictoryProjectPass } from "./passes/VictoryProjectPass";
import { WarfareRingPass, type Ring } from "./passes/WarfareRingPass";
import { WorldTextPass } from "./passes/WorldTextPass";
import type { RenderSettings } from "./RenderSettings";
import { AffiliationPalette } from "./utils/Affiliation";
import {
  EFFECT_PALETTE_BLOCKS,
  getPaletteSize,
  hexToRgb,
  MAX_TRAIL_COLORS,
} from "./utils/ColorUtils";
import { renderDpr } from "./utils/Dpr";
import {
  createTexture2D,
  toScreen,
  toTarget,
  type RenderTarget,
} from "./utils/GlUtils";
import {
  createGPUResources,
  disposeGPUResources,
  type GPUResources,
} from "./utils/GpuResources";
import { HeatManager } from "./utils/HeatManager";

/** Ghost types that trigger SAM radius overlay (matches upstream SAMRadiusLayer). */
const SAM_RADIUS_GHOST_TYPES = new Set([
  "Missile Silo",
  "SAM Launcher",
  "City",
  "Bomber",
  "Transport Plane",
  "Atom Bomb",
  "Hydrogen Bomb",
]);

/** Subset for build-button hover — excludes City/Silo (SAM radii irrelevant). */
const SAM_RADIUS_HIGHLIGHT_TYPES = new Set([
  "SAM Launcher",
  "Bomber",
  "Transport Plane",
  "Atom Bomb",
  "Hydrogen Bomb",
]);

/** Ghost types that show coastal battery and airport rings (expanded warfare). */
const WARFARE_RING_GHOST_TYPES = new Set([
  "Coastal Battery",
  "Airport",
  "Coastal Barrage",
  "Bomber",
]);

/** Open build-bar cards that show them (highlightTypes in UnitDisplay). */
const WARFARE_RING_HIGHLIGHT_TYPES = new Set(["Coastal Battery", "Airport"]);

const GRID_VIEW_KEY = "renderer:grid_view_enabled";

/** World War 1936 P2: what setWwLand hands the renderer. */
interface WwLandInput {
  view: WwLandView;
  selection: WwLandSelection;
  me: () => number;
  isEnemy: ((smallID: number) => boolean) | null;
}

/** World War 1936 P2: the land war's passes, made by setWwLand. */
interface WwLandPasses {
  atlas: LandAtlas;
  tokens: ArmyTokenPass;
  battles: BattleMarkerPass;
  arrows: PlanArrowPass;
}

/**
 * A paradrop's plane (spec §7.6: the expanded-warfare plane reused): a
 * transport plane PlanePass flies from the jump-off region's center to the
 * target's; parachutes open when it gets there.
 */
interface ParaFlight {
  unit: UnitState;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  startTick: number;
  ticks: number;
}

/** Ids of the paradrop planes handed to PlanePass (no real unit has them). */
const PARA_FLIGHT_ID0 = -1_000_000;

export class GPURenderer {
  private gl: WebGL2RenderingContext;
  private camera: Camera;
  private res: GPUResources;

  /**
   * Set when the context is hardware-accelerated but its MAX_TEXTURE_SIZE is
   * below what the game needs (fingerprinting protection, #4357). The game
   * runs, but the map may render with black areas — the owner should warn.
   */
  readonly glLimited: { renderer: string; maxTextureSize: number } | null;

  // Passes
  private terrainPass: TerrainPass;
  private territoryPass: TerritoryPass;
  private trailPass: TrailPass;
  private spiralRibbonPass: SpiralRibbonPass;
  private borderStampPass: BorderStampPass;
  private borderPass: BorderComputePass;
  private defenseCoveragePass: DefenseCoveragePass;
  private bloomPass: FalloutBloomPass;
  private pointLightPass: PointLightPass;
  private falloutLightPass: FalloutLightPass;
  private lightmapPass: LightmapPass;
  private nightCompositePass: NightCompositePass;
  private structurePass: StructurePass;
  private structureLevelPass: StructureLevelPass;
  private unitPass: UnitPass;
  private planePass: PlanePass;
  private airFxPass: AirFxPass;
  /** Scratch for applyBombDrops (no per-drop allocation). */
  private readonly bomberFrom = { x: 0, y: 0 };
  private namePass: NamePass;
  private fxPass: FxPass;
  private rangeCirclePass: RangeCirclePass;
  private victoryProjectPass: VictoryProjectPass;
  private orbitalBeamPass: OrbitalBeamPass;
  private strategicFxPass: StrategicFxPass;
  private warfareRingPass: WarfareRingPass;
  private samRadiusPass: SAMRadiusPass;
  private crosshairPass: CrosshairPass;
  private railroadPass: RailroadPass;
  private barPass: BarPass;
  private worldTextPass: WorldTextPass;
  private selectionBoxPass: SelectionBoxPass;
  private moveIndicatorPass: MoveIndicatorPass;
  private nukeTrajectoryPass: NukeTrajectoryPass;
  private nukeTelegraphPass: NukeTelegraphPass;
  private heatManager: HeatManager;
  private affiliationPalette: AffiliationPalette;
  private coordinateGridPass: CoordinateGridPass;
  private spawnOverlayPass: SpawnOverlayPass;
  private smallPlayerGlowPass: SmallPlayerGlowPass;
  private inSpawnPhase = false;

  // Map-layer passes keyed by layer id, drawn between terrain and territory.
  private mapLayerPasses: Map<string, MapLayerPass> = new Map();
  /** World War 1936: region and sea-zone lines; null otherwise. */
  private regionBorderPass: RegionBorderPass | null = null;
  /** World War 1936 P2: the land war; null without it. */
  private wwLand: WwLandInput | null = null;
  private wwPasses: WwLandPasses | null = null;
  private readonly tokenLayout = new TokenLayoutCache();
  /** Region flags this frame's inputs give, and those the pass last got. */
  private readonly landFlags = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE);
  private readonly landFlagsSent = new Uint8Array(
    FLAG_TEX_SIZE * FLAG_TEX_SIZE,
  );
  private landFlagsStale = true;
  private landFlagsVersion = -1;
  private landFlagsSelection = -1;
  private landFlagsMe = -1;
  /** The last game tick, when it came and the smoothed time between ticks. */
  private landTick = 0;
  private landTickMs = 0;
  private landTickSpanMs = 100;
  private msPerTick = 100;
  /** Paradrops: each army's last region × 2 + its ARMY_PARA bit. */
  private readonly paraSeen = new Map<number, number>();
  private paraVersion = -1;
  private paraFlights: ParaFlight[] = [];
  private nextParaId = PARA_FLIGHT_ID0;
  /** The units PlanePass gets while a paradrop plane flies (reused). */
  private readonly unitsWithPara = new Map<number, UnitState>();
  /** R8UI terrain-bytes texture shared by all layer passes. */
  private terrainBytesTex: WebGLTexture | null = null;
  /** Stored layer definitions for context-restore re-creation. */
  private storedLayers: MapLayer[] = [];
  /** Stored layer images for context-restore re-creation. */
  private storedLayerImages: Map<string, ImageBitmap> = new Map();

  private paletteTex: WebGLTexture;
  private paletteData: Float32Array;
  // Per-player trail-effect palette, keyed by smallID (RGBA32F,
  // 4096×(MAX_TRAIL_COLORS·TRAIL_EFFECT_BLOCKS)): one MAX_TRAIL_COLORS-row block
  // per trail effectType (block 0 = transportShipTrail, block 1 = nukeTrail).
  // Sampled by TrailPass; the shader picks the block from the trail tile's nuke
  // bit.
  private effectTex: WebGLTexture;
  private patternMetaTex: WebGLTexture;
  private patternDataTex: WebGLTexture;
  private skinAtlas: SkinAtlasArray;
  private skinLayerTex: WebGLTexture;
  /** CPU-side mirror of skinLayerTex (0 = no skin, otherwise layer + 1). */
  private skinLayerCpu: Uint8Array;
  /** Per-player anchor (x,y) for skin sampling. (0,0) = world-origin anchor. */
  private skinAnchorTex: WebGLTexture;
  private skinAnchorCpu: Uint16Array;
  private canvas: HTMLCanvasElement;
  private settings: RenderSettings;
  private sceneTarget: RenderTarget;
  private raf: typeof requestAnimationFrame;
  private caf: typeof cancelAnimationFrame;

  private animId: number | null = null;
  private frameTick = 0;
  private mapW = 0;
  private mapH = 0;

  // Last-uploaded unit/structure maps (selection box + bar pass inputs)
  private lastUnits: Map<number, UnitState> = new Map();
  private lastStructures: Map<number, UnitState> = new Map();

  // Local player relationship data (for SAM radius coloring)
  private localPlayerID = 0;
  private playerTeams = new Map<number, string>(); // smallID → team

  // Alt-view: affiliation recoloring (space hold)
  private altView = false;
  // Grid-view: coordinate grid overlay (M toggle)
  private gridView = false;

  // SAM radius visibility tracking (show if either source is true)
  private samGhostVisible = false;
  private samHighlightVisible = false;
  private warfareGhostVisible = false;
  private warfareHighlightVisible = false;

  // Warship selection — supports any number of selections.
  private selectedUnitIds: number[] = [];
  /** Reusable scratch buffer of {x,y,r,g,b} for the selection-box pass. */
  private readonly selectionBoxEntries: import("./passes/SelectionBoxPass").SelectionEntry[] =
    [];

  constructor(
    canvas: HTMLCanvasElement,
    header: RendererConfig,
    terrainSource: () => Uint8Array,
    paletteData: Float32Array,
    config: Config,
    settings: RenderSettings,
    raf: typeof requestAnimationFrame = requestAnimationFrame.bind(window),
    caf: typeof cancelAnimationFrame = cancelAnimationFrame.bind(window),
  ) {
    this.canvas = canvas;
    // Settings are resolved (defaults + user overrides) by the caller and
    // passed in, so every pass — including texture-baking ones like terrain —
    // is built with the final values. Live changes mutate this object in place.
    this.settings = settings;
    this.raf = raf;
    this.caf = caf;
    this.msPerTick = config.msPerTick();
    this.landTickSpanMs = this.msPerTick;

    // Demand a GPU-accelerated context. A software (SwiftShader) or missing
    // WebGL2 context throws GLUnavailableError, which the game-start path
    // turns into an actionable gate instead of letting the game crawl at
    // ~1fps. A fingerprint-capped context ("limited" — MAX_TEXTURE_SIZE below
    // the palette width, #4357) proceeds anyway; glLimited lets the owner
    // warn the player that the map may render with black areas.
    const res = initGL(canvas, {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (res.gl === null) {
      throw new GLUnavailableError(res.status, res.renderer);
    }
    this.glLimited =
      res.status === "limited"
        ? { renderer: res.renderer, maxTextureSize: res.maxTextureSize }
        : null;
    const gl = res.gl;
    this.gl = gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const floatExt = gl.getExtension("EXT_color_buffer_float");
    if (!floatExt)
      console.warn("EXT_color_buffer_float not available — palette may fail");

    const mapW = header.mapWidth;
    const mapH = header.mapHeight;
    this.mapW = mapW;
    this.mapH = mapH;

    this.camera = new Camera(mapW, mapH);

    // --- Terrain (static) ---
    // Bake once and let the array go — nothing below retains map-sized
    // terrain bytes; re-bakes call terrainSource again.
    const terrainBytes = terrainSource();
    this.terrainPass = new TerrainPass(
      gl,
      terrainSource,
      terrainBytes,
      mapW,
      mapH,
      {
        backgroundColor:
          hexToRgb(this.settings.terrain.backgroundColor) ?? undefined,
        oceanColor: hexToRgb(this.settings.terrain.oceanColor) ?? undefined,
        sandColor: hexToRgb(this.settings.terrain.sandColor) ?? undefined,
        plainsColor: hexToRgb(this.settings.terrain.plainsColor) ?? undefined,
        highlandColor:
          hexToRgb(this.settings.terrain.highlandColor) ?? undefined,
        mountainColor:
          hexToRgb(this.settings.terrain.mountainColor) ?? undefined,
      },
    );

    // --- Terrain bytes R8UI texture (shared by map-layer passes) ---
    this.terrainBytesTex = createTexture2D(gl, {
      width: mapW,
      height: mapH,
      internalFormat: gl.R8UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_BYTE,
      data: terrainBytes,
      filter: gl.NEAREST,
    });

    // --- Shared palette texture (RGBA32F, 4096×2) ---
    this.paletteData = paletteData;
    const palW = getPaletteSize();
    this.paletteTex = createTexture2D(gl, {
      width: palW,
      height: 2,
      internalFormat: gl.RGBA32F,
      format: gl.RGBA,
      type: gl.FLOAT,
      data: paletteData,
      filter: gl.NEAREST,
    });

    // Per-player effect texture: EFFECT_PALETTE_BLOCKS stacked blocks of
    // MAX_TRAIL_COLORS rows (block 0 = transportShipTrail, block 1 = nukeTrail,
    // block 2 = structures, block 3 = warship, block 4 = train, block 5 =
    // railroad). Starts zeroed (color count 0 everywhere = no effect →
    // territory/player color).
    const effectRows = MAX_TRAIL_COLORS * EFFECT_PALETTE_BLOCKS;
    this.effectTex = createTexture2D(gl, {
      width: palW,
      height: effectRows,
      internalFormat: gl.RGBA32F,
      format: gl.RGBA,
      type: gl.FLOAT,
      data: new Float32Array(palW * effectRows * 4),
      filter: gl.NEAREST,
    });

    this.patternMetaTex = createTexture2D(gl, {
      width: palW,
      height: 1,
      internalFormat: gl.RGBA32F,
      format: gl.RGBA,
      type: gl.FLOAT,
      data: new Float32Array(palW * 4),
      filter: gl.NEAREST,
    });

    this.patternDataTex = createTexture2D(gl, {
      width: 1024,
      height: palW,
      internalFormat: gl.R8UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_BYTE,
      data: new Uint8Array(palW * 1024),
      filter: gl.NEAREST,
    });

    // --- Skin atlas (TEXTURE_2D_ARRAY of PNG layers) + per-player layer map ---
    this.skinLayerCpu = new Uint8Array(palW);
    this.skinLayerTex = createTexture2D(gl, {
      width: palW,
      height: 1,
      internalFormat: gl.R8UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_BYTE,
      data: this.skinLayerCpu,
      filter: gl.NEAREST,
    });
    // Per-player skin anchor: RG16UI, 2× uint16 per player → 4 bytes each.
    // (0,0) sentinel means "no anchor" — shader uses world origin.
    this.skinAnchorCpu = new Uint16Array(palW * 2);
    this.skinAnchorTex = createTexture2D(gl, {
      width: palW,
      height: 1,
      internalFormat: gl.RG16UI,
      format: gl.RG_INTEGER,
      type: gl.UNSIGNED_SHORT,
      data: this.skinAnchorCpu,
      filter: gl.NEAREST,
    });
    // Construct with no URLs — the real atlas is built once initSkinAtlas() is
    // called with the locked-in player skin URLs at game start.
    this.skinAtlas = new SkinAtlasArray(gl, [], () => {});

    // --- Border compute (creates its own borderTex) ---
    // Need a temporary tileTex reference for border compute — we'll create
    // GPUResources first, then wire everything.
    // But borderPass creates its own borderTex internally, so we need to
    // create GPUResources with it. Let's sequence carefully:

    // 1. Create GPUResources (creates tileTex, trailTex, heatTexA/B)
    //    borderTex placeholder — we'll get it from borderPass
    //    First create a dummy, then replace after borderPass is created.

    // Actually: borderPass creates its own internal borderTex (RGBA8).
    // We need tileTex to exist before borderPass. So:
    //   a) Create shared resources (tileTex, trailTex, heatA/B)
    //   b) Create borderPass with tileTex → gives us borderTex
    //   c) Store borderTex in res

    // Create shared textures except borderTex
    this.res = createGPUResources(gl, mapW, mapH, this.paletteTex, null!);

    // --- Border compute (needs tileTex) ---
    this.borderPass = new BorderComputePass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.settings,
    );
    this.res.borderTex = this.borderPass.getBorderTex();

    // --- Defense coverage (needs tileTex) — per-tile "defended by same-owner
    // post" flag, stamped one instanced circle per post. Replaces the old
    // 64-cap uniform loop; consumed by BorderStampPass. ---
    this.defenseCoveragePass = new DefenseCoveragePass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.settings,
    );

    // --- Heat manager (needs tileTex, heatTexA/B) ---
    this.heatManager = new HeatManager(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.res.heatTexA,
      this.res.heatTexB,
      this.settings,
    );

    // --- Territory (needs tileTex, paletteTex, patternTexs, skinTexs) ---
    this.territoryPass = new TerritoryPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.paletteTex,
      this.patternMetaTex,
      this.patternDataTex,
      this.skinAtlas.texture,
      this.skinLayerTex,
      this.skinAnchorTex,
      this.settings,
    );
    // Route per-tile changes to the border pass so it can scatter-recompute
    // just the affected tiles instead of rebuilding the whole map. A tile
    // changing owner can also flip its defense-coverage flag (same-owner test),
    // so mark the coverage stale too — one coalesced re-stamp happens per frame.
    this.territoryPass.setBorderPatchConsumer((x, y, prevOwner, newOwner) => {
      this.borderPass.patchTile(x, y, prevOwner, newOwner);
      this.defenseCoveragePass.markTileDirty(x, y);
    });
    // Territory fill darkens on interior tiles defended by a same-owner post;
    // borderTex lets the fill skip border tiles (those get the checkerboard).
    this.territoryPass.setDefenseCoverageTex(
      this.defenseCoveragePass.getCoverageTex(),
    );
    this.territoryPass.setBorderTex(this.res.borderTex);

    // --- Spawn overlay (needs tileTex) ---
    this.spawnOverlayPass = new SpawnOverlayPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.settings.spawnOverlay,
    );

    this.smallPlayerGlowPass = new SmallPlayerGlowPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.settings.smallPlayerGlow,
    );

    // --- Trail (needs trailTex, paletteTex, effectTex) ---
    this.trailPass = new TrailPass(
      gl,
      mapW,
      mapH,
      this.res.trailTex,
      this.paletteTex,
      this.effectTex,
      this.settings,
    );

    // --- Spiral nukeTrail ribbons (drawn above trails, below missiles) ---
    this.spiralRibbonPass = new SpiralRibbonPass(gl, this.settings);

    // --- Border stamp (needs tileTex, paletteTex, borderTex) ---
    this.borderStampPass = new BorderStampPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.paletteTex,
      this.res.borderTex,
      this.settings,
    );
    this.borderStampPass.setDefenseCoverageTex(
      this.defenseCoveragePass.getCoverageTex(),
    );

    // --- Fallout bloom (needs tileTex, heatManager) ---
    this.bloomPass = new FalloutBloomPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.heatManager,
      this.settings,
    );

    // --- Point lights ---
    this.pointLightPass = new PointLightPass(
      gl,
      header,
      paletteData,
      this.settings,
      config,
    );

    // --- Fallout light (needs tileTex + heatManager; particle flicker is
    //     computed inline using the falloutBloom particle settings) ---
    this.falloutLightPass = new FalloutLightPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.heatManager,
      this.settings,
    );

    // --- Lightmap orchestrator ---
    this.lightmapPass = new LightmapPass(
      gl,
      mapW,
      mapH,
      this.pointLightPass,
      this.falloutLightPass,
      this.settings,
    );

    // --- Night composite ---
    this.nightCompositePass = new NightCompositePass(gl, this.settings);

    // --- Railroad (needs tileTex, paletteTex, effectTex) ---
    this.railroadPass = new RailroadPass(
      gl,
      mapW,
      mapH,
      this.res.tileTex,
      this.paletteTex,
      this.effectTex,
      terrainBytes,
      this.settings,
    );

    // --- Range circle (ghost preview radius) ---
    this.rangeCirclePass = new RangeCirclePass(gl);
    this.victoryProjectPass = new VictoryProjectPass(gl);
    this.orbitalBeamPass = new OrbitalBeamPass(gl);
    this.strategicFxPass = new StrategicFxPass(gl);
    this.warfareRingPass = new WarfareRingPass(
      gl,
      mapW,
      config.warfareExpansion(),
    );

    // --- SAM radius overlay (dashed green circles during build mode) ---
    this.samRadiusPass = new SAMRadiusPass(gl, mapW, this.settings);
    this.samRadiusPass.setPaletteData(paletteData);

    // --- Crosshair (warship placement) ---
    this.crosshairPass = new CrosshairPass(gl);

    // --- Remaining passes (unchanged from v1) ---
    this.structurePass = new StructurePass(
      gl,
      header,
      this.paletteTex,
      this.effectTex,
      this.settings,
    );
    this.structureLevelPass = new StructureLevelPass(gl, header, this.settings);
    this.unitPass = new UnitPass(
      gl,
      header,
      this.paletteTex,
      this.effectTex,
      this.settings,
      config,
    );
    this.planePass = new PlanePass(gl, header, this.paletteTex, config);
    this.airFxPass = new AirFxPass(gl, this.paletteTex);
    this.airFxPass.setBombLandHandler((x, y) =>
      this.fxPass.spawnBombBlast(x, y),
    );
    this.planePass.setEvadeHandler((x, y) => this.airFxPass.spawnFlare(x, y));
    this.namePass = new NamePass(
      gl,
      header,
      paletteData,
      this.settings,
      config,
    );
    this.fxPass = new FxPass(gl, header, this.settings, config);
    this.barPass = new BarPass(gl, header, this.settings, config);
    this.worldTextPass = new WorldTextPass(gl, this.settings, config);
    this.worldTextPass.setMapWidth(this.mapW);
    this.worldTextPass.setStrategicLabels(this.strategicFxPass.labels);
    this.selectionBoxPass = new SelectionBoxPass(gl);
    this.moveIndicatorPass = new MoveIndicatorPass(gl, this.settings);
    this.nukeTrajectoryPass = new NukeTrajectoryPass(gl, this.settings);
    this.nukeTelegraphPass = new NukeTelegraphPass(gl, this.settings);

    // --- Scene capture target (for night composite) ---
    const sceneTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const sceneFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      sceneTex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.sceneTarget = { fbo: sceneFbo, tex: sceneTex, w: 1, h: 1 };

    // --- Alt-view passes ---
    this.affiliationPalette = new AffiliationPalette(gl, this.settings);
    const affTex = this.affiliationPalette.getTexture();
    this.borderStampPass.setAffiliationTex(affTex);
    this.territoryPass.setAffiliationTex(affTex);
    this.unitPass.setAffiliationTex(affTex);
    this.planePass.setAffiliationTex(affTex);
    this.structurePass.setAffiliationTex(affTex);
    this.trailPass.setAffiliationTex(affTex);
    this.coordinateGridPass = new CoordinateGridPass(
      gl,
      mapW,
      mapH,
      this.settings,
    );
    try {
      this.gridView = window.localStorage.getItem(GRID_VIEW_KEY) === "true";
    } catch {
      this.setGridView(false);
    }

    for (const p of header.players) {
      if (p.team !== null) this.playerTeams.set(p.smallID, p.team);
    }
    // Team mode = any player has a team. Drives skin tint behavior:
    // FFA shows raw skin colors; teams multiply skin by team primary color.
    this.territoryPass.setTeamMode(this.playerTeams.size > 0);

    this.startLoop();
  }

  private renderLoop = (): void => {
    this.draw();
    this.animId = this.raf(this.renderLoop);
  };

  private startLoop(): void {
    this.animId ??= this.raf(this.renderLoop);
  }

  private stopLoop(): void {
    if (this.animId !== null) {
      this.caf(this.animId);
      this.animId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Canvas / Camera
  // ---------------------------------------------------------------------------

  resize(cssWidth: number, cssHeight: number): void {
    const dpr = renderDpr();
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.camera.resize(cssWidth, cssHeight);
  }

  setCameraState(x: number, y: number, z: number): void {
    this.camera.setCameraState(x, y, z);
  }

  // ---------------------------------------------------------------------------
  // Data upload
  // ---------------------------------------------------------------------------

  uploadTileAndTrailState(
    tileState: Uint16Array,
    trailState: Uint16Array,
  ): void {
    this.territoryPass.setLiveRef(tileState);
    this.trailPass.setLiveRef(trailState);
  }

  uploadLiveDelta(
    tileState: Uint16Array,
    changedTiles: readonly number[],
  ): void {
    this.territoryPass.applyLiveDelta(tileState, changedTiles);
  }

  uploadLiveTrailDelta(
    trailState: Uint16Array,
    dirtyRowMin: number,
    dirtyRowMax: number,
  ): void {
    this.trailPass.applyLiveDelta(trailState, dirtyRowMin, dirtyRowMax);
  }

  /** Adopt this tick's spiral nukeTrail ribbons (live refs from SpiralTrails). */
  updateSpiralRibbons(ribbons: readonly SpiralRibbon[]): void {
    this.spiralRibbonPass.updateRibbons(ribbons);
  }

  /** Re-upload palette data to the GPU texture (e.g. when players appear after initial startup). */
  updatePalette(paletteData: Float32Array): void {
    const gl = this.gl;
    // Mutate the stored array in-place so all passes sharing the reference see the update.
    this.paletteData.set(paletteData);
    // Re-upload to the GPU texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      getPaletteSize(),
      2,
      gl.RGBA,
      gl.FLOAT,
      this.paletteData,
    );
    // SAM radius pass stores its own copy
    this.samRadiusPass.setPaletteData(this.paletteData);
    // Name pass caches per-player colors and bakes them into slot rows
    this.namePass.refreshPlayerColors(this.paletteData);
  }

  /** Re-upload the per-player effect texture (style + colors by smallID). */
  updateEffectPalette(effectData: Float32Array): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.effectTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      getPaletteSize(),
      MAX_TRAIL_COLORS * EFFECT_PALETTE_BLOCKS,
      gl.RGBA,
      gl.FLOAT,
      effectData,
    );
  }

  /** Register late-arriving players (updates palette + NamePass lookup maps). */
  addPlayers(
    players: PlayerStatic[],
    paletteData: Float32Array,
    patternMeta: Float32Array,
    patternData: Uint8Array,
  ): void {
    this.updatePalette(paletteData);
    this.uploadPatterns(patternMeta, patternData);

    this.namePass.addPlayers(players, this.paletteData);
    for (const p of players) {
      if (p.team !== null) this.playerTeams.set(p.smallID, p.team);
    }
    // Renderer was constructed with players: [] (real list arrives via this
    // method), so team mode must be re-evaluated whenever new players arrive
    // — otherwise team games never enable the skin-tint branch.
    this.territoryPass.setTeamMode(this.playerTeams.size > 0);
  }

  /**
   * Re-upload already-registered players' palette, patterns, flags and crowns
   * after the cosmetics visibility settings change.
   */
  updatePlayerCosmetics(
    players: PlayerStatic[],
    paletteData: Float32Array,
    patternMeta: Float32Array,
    patternData: Uint8Array,
  ): void {
    this.updatePalette(paletteData);
    this.uploadPatterns(patternMeta, patternData);
    this.namePass.updatePlayerCosmetics(players);
  }

  private uploadPatterns(
    patternMeta: Float32Array,
    patternData: Uint8Array,
  ): void {
    const gl = this.gl;
    const palW = getPaletteSize();

    gl.bindTexture(gl.TEXTURE_2D, this.patternMetaTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      palW,
      1,
      gl.RGBA,
      gl.FLOAT,
      patternMeta,
    );

    gl.bindTexture(gl.TEXTURE_2D, this.patternDataTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      1024,
      palW,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      patternData,
    );
  }

  /**
   * Anchor a player's skin sampling at world coords (x, y). The center of the
   * skin image lines up with this tile. Default (0,0) anchors at world origin.
   */
  setPlayerSpawn(smallID: number, x: number, y: number): void {
    const off = smallID * 2;
    this.skinAnchorCpu[off] = x;
    this.skinAnchorCpu[off + 1] = y;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.skinAnchorTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      getPaletteSize(),
      1,
      gl.RG_INTEGER,
      gl.UNSIGNED_SHORT,
      this.skinAnchorCpu,
    );
  }

  /**
   * Allocate the skin atlas to exactly `urls.length` layers. The player set is
   * locked at game start so this is called once with the complete URL list;
   * URLs not in this set will be ignored by `setPlayerSkin`.
   *
   * Layers are zero-initialized (browsers do this for security regardless of
   * the GL spec's "undefined" wording), so players whose images haven't
   * decoded yet render with alpha=0 → falls through to base player color.
   */
  initSkinAtlas(urls: readonly string[]): void {
    this.skinAtlas.dispose();
    this.skinAtlas = new SkinAtlasArray(this.gl, urls, () => {});
    this.territoryPass.setSkinAtlas(this.skinAtlas.texture);
  }

  /**
   * Map a player to a pre-registered skin layer, or clear it with null. URLs
   * not registered via `initSkinAtlas` are silently dropped. If the image is
   * still decoding the layer renders transparent (zero-init) until decode
   * completes.
   */
  setPlayerSkin(smallID: number, url: string | null): void {
    let layer = -1;
    if (url !== null) {
      layer = this.skinAtlas.getLayer(url);
      if (layer < 0) return;
    }
    this.skinLayerCpu[smallID] = layer + 1;
    this.uploadSkinLayerTex();
  }

  private uploadSkinLayerTex(): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.skinLayerTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      getPaletteSize(),
      1,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      this.skinLayerCpu,
    );
  }

  uploadRailroadState(data: Uint8Array): void {
    this.railroadPass.uploadRailroadState(data);
  }

  updateUnits(units: Map<number, UnitState>, gameTick: number): void {
    this.lastUnits = units;
    this.frameTick++;
    this.unitPass.setFrameTick(this.frameTick);
    this.unitPass.updateUnits(units, gameTick);
    this.noteLandTick(gameTick);
    this.planePass.updateUnits(
      this.withParaFlights(units, gameTick),
      gameTick,
      this.lastStructures,
    );
    this.samRadiusPass.setTick(gameTick);
    this.warfareRingPass.updateUnits(units);
    this.barPass.updateBars(units, this.lastStructures, gameTick);
    this.pointLightPass.updateLights(units);
    this.heatManager.decayHeat();
  }

  updateNames(
    names: Map<string, NameEntry>,
    players: Map<number, PlayerState>,
    snap: boolean,
    statusData?: Map<number, PlayerStatusData>,
  ): void {
    this.namePass.updateNames(names, players, snap, statusData);

    // Extract local player's allies + teammates for SAM radius coloring
    if (this.localPlayerID > 0) {
      const localPS = players.get(this.localPlayerID);
      const friendly = new Set(localPS?.allies ?? []);
      const myTeam = this.playerTeams.get(this.localPlayerID);
      if (myTeam !== undefined) {
        for (const [sid, team] of this.playerTeams) {
          if (team === myTeam && sid !== this.localPlayerID) friendly.add(sid);
        }
      }
      this.samRadiusPass.setAllies(friendly);
      this.warfareRingPass.setAllies(friendly);
      this.unitPass.setAllies(friendly);
    }
  }

  /** Re-resolve player name strings live (e.g. anonymous-names toggle). */
  refreshNames(displayNames: Map<string, string>): void {
    this.namePass.refreshNames(displayNames);
  }

  updateRelations(data: Uint8Array, size: number): void {
    this.borderPass.updateRelations(data, size);
    this.affiliationPalette.updateRelations(data, size);
  }

  updateStructures(units: Map<number, UnitState>): void {
    this.lastStructures = units;
    this.structurePass.updateStructures(units);
    this.structureLevelPass.updateStructures(units);
    this.samRadiusPass.updateStructures(units);
    this.warfareRingPass.updateStructures(units);
    this.unitPass.setStructures(units);
    const posts: { x: number; y: number; ownerID: number }[] = [];
    const w = this.mapW;
    for (const u of units.values()) {
      if (u.unitType === "Defense Post" && !u.underConstruction) {
        posts.push({
          x: u.pos % w,
          y: (u.pos - (u.pos % w)) / w,
          ownerID: u.ownerID,
        });
      }
    }
    this.defenseCoveragePass.updateDefensePosts(posts);
  }

  applyDeadUnits(deadUnits: DeadUnitFx[]): void {
    if (deadUnits.length === 0) return;
    this.fxPass.applyDeadUnits(deadUnits);
    for (const du of deadUnits) {
      if (!du.reachedTarget) {
        this.applyPlaneShotDown(du);
        continue;
      }
      const x = du.pos % this.mapW;
      const y = (du.pos - x) / this.mapW;
      // A transport plane that reached its drop point: parachutes.
      if (du.unitType === UT_TRANSPORT_PLANE) {
        this.airFxPass.spawnParadrop(x, y, du.ownerSmallID);
      } else if (du.unitType === UT_SHELL) {
        // Coastal barrage shell impact flash.
        this.airFxPass.spawnFlash(x, y);
      }
    }
  }

  /**
   * A transport plane or bomber that vanished unfinished while a SAM missile
   * chased it: a mid-air blast, smoke, and its wreck falling away. Planes
   * that arrive (reachedTarget) or are lost another way never get here.
   */
  private applyPlaneShotDown(du: DeadUnitFx): void {
    if ((du.tickAge ?? 0) > 0) return; // seeked past it
    const hit = this.planePass.takeShotDown(
      du.unitType,
      du.ownerSmallID,
      du.pos,
      du.reachedTarget,
    );
    if (hit === null) return;
    this.planePass.spawnWreck(
      hit.x,
      hit.y,
      hit.heading,
      hit.col,
      du.ownerSmallID,
      du.unitType,
    );
    this.fxPass.spawnBombBlast(hit.x, hit.y);
    this.airFxPass.spawnFlash(hit.x, hit.y);
    this.airFxPass.spawnSmoke(hit.x, hit.y);
  }

  /** Expanded warfare: one carpet bomb per update falls from the bomber to its tile. */
  applyBombDrops(
    drops: readonly { attackerID: number; x: number; y: number }[],
  ): void {
    const from = this.bomberFrom;
    for (const d of drops) {
      // No bomber in view (a replay, or it was just shot down): drop from above the tile.
      if (!this.planePass.bomberPosition(d.attackerID, d.x, d.y, from)) {
        from.x = d.x;
        from.y = d.y - 12;
      }
      this.airFxPass.spawnBomb(from.x, from.y, d.x, d.y);
    }
  }

  applyRailroadDust(tileRefs: number[]): void {
    if (tileRefs.length > 0) this.fxPass.applyRailroadDust(tileRefs);
  }

  /**
   * Update terrain texels for regions whose terrain bytes changed (e.g. water
   * nukes converting land → water). Each rect's bytes are stored row-major,
   * concatenated in `bytes` in rect order. Forwards to both TerrainPass (RGBA
   * color) and RailroadPass (R8UI water-detection for bridges). One
   * texSubImage2D per rect — per-tile uploads cost hundreds of ms for a
   * massive bomb.
   */
  applyTerrainRects(rects: readonly TerrainRect[], bytes: Uint8Array): void {
    if (rects.length === 0) return;
    this.terrainPass.applyTerrainRects(rects, bytes);
    this.railroadPass.applyTerrainRects(rects, bytes);
    // Update the shared R8UI terrain-bytes texture used by map-layer passes.
    if (!this.terrainBytesTex) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.terrainBytesTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    let offset = 0;
    for (const r of rects) {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        r.x,
        r.y,
        r.w,
        r.h,
        gl.RED_INTEGER,
        gl.UNSIGNED_BYTE,
        bytes,
        offset,
      );
      offset += r.w * r.h;
    }
  }

  /**
   * Rebuild the terrain texture from the current `settings.terrain` colors.
   * Terrain is baked into a GPU texture rather than read per-frame, so a
   * settings change needs this explicit rebuild.
   */
  rebuildTerrain(): void {
    this.terrainPass.setTerrainColors({
      backgroundColor:
        hexToRgb(this.settings.terrain.backgroundColor) ?? undefined,
      oceanColor: hexToRgb(this.settings.terrain.oceanColor) ?? undefined,
      sandColor: hexToRgb(this.settings.terrain.sandColor) ?? undefined,
      plainsColor: hexToRgb(this.settings.terrain.plainsColor) ?? undefined,
      highlandColor: hexToRgb(this.settings.terrain.highlandColor) ?? undefined,
      mountainColor: hexToRgb(this.settings.terrain.mountainColor) ?? undefined,
    });
  }

  applyConquestEvents(events: ConquestFx[]): void {
    if (events.length > 0) {
      this.fxPass.applyConquestEvents(events);
      this.worldTextPass.applyConquestEvents(events);
    }
  }

  setAttackTroopLabels(
    labels: import("./passes/WorldTextPass").AttackTroopLabel[],
  ): void {
    this.worldTextPass.setAttackTroopLabels(labels);
  }

  applyBonusEvents(events: BonusEvent[]): void {
    if (events.length === 0) return;
    // In live game, filter to local player only. In replay (localPlayerID=0), show all.
    const filtered =
      this.localPlayerID > 0
        ? events.filter((e) => e.smallID === this.localPlayerID)
        : events;
    if (filtered.length > 0) this.worldTextPass.applyBonusEvents(filtered);
  }

  triggerBlockedFlash(tileX: number, tileY: number): void {
    this.crosshairPass.triggerBlockedFlash(tileX, tileY);
  }

  updateAttackRings(rings: AttackRingInput[]): void {
    this.fxPass.updateAttackRings(rings);
  }

  updateGhostPreview(data: GhostPreviewData | null): void {
    this.structurePass.updateGhostPreview(data);
    this.railroadPass.updateGhostPreview(data);
    this.rangeCirclePass.updateGhostPreview(data);
    this.crosshairPass.updateGhostPreview(data);
    // The multiplier badge (x5) rides on the cost label but must show even
    // when there is no cost line — e.g. infinite gold (cost 0) or the
    // cursor-cost-label setting turned off.
    const topText =
      data?.multiplier && data.multiplier > 1
        ? translateText("build_menu.upgrade_amount", {
            amount: data.multiplier.toString(),
          })
        : undefined;
    const showCost = data !== null && data.showCost && data.cost > 0;
    this.worldTextPass.setGhostCostLabel(
      data && (showCost || topText !== undefined)
        ? {
            tileX: data.tileX,
            tileY: data.tileY,
            cost: showCost ? data.cost : 0,
            canAfford: data.canAfford,
            canPlace: data.canBuild || data.canUpgrade,
            topText,
          }
        : null,
    );
    this.samGhostVisible =
      data !== null && SAM_RADIUS_GHOST_TYPES.has(data.ghostType);
    this.samRadiusPass.setVisible(
      this.samGhostVisible || this.samHighlightVisible,
    );
    this.warfareGhostVisible =
      data !== null && WARFARE_RING_GHOST_TYPES.has(data.ghostType);
    this.warfareRingPass.setVisible(
      this.warfareGhostVisible || this.warfareHighlightVisible,
    );
  }

  updateNukeTrajectory(data: NukeTrajectoryData | null): void {
    this.nukeTrajectoryPass.update(data);
  }

  updateAimRings(rings: readonly Ring[]): void {
    this.warfareRingPass.setAimRings(rings);
  }

  updateNukeTelegraphs(data: NukeTelegraphData[]): void {
    this.nukeTelegraphPass.update(data);
  }

  updateSpawnOverlay(inSpawnPhase: boolean, centers: SpawnCenter[]): void {
    this.inSpawnPhase = inSpawnPhase;
    this.spawnOverlayPass.update(centers);
  }

  updateSmallPlayerGlow(set: Uint8Array | null): void {
    this.smallPlayerGlowPass.update(set);
  }

  /** Strategic weapons: production and preparation bars. */
  setStrategicProgress(progress: ReadonlyMap<number, number>): void {
    this.barPass.setStrategicProgress(progress);
  }

  /** Strategic weapons: beams and blasts at this tick's orbital strike impacts. */
  applyOrbitalStrikes(points: readonly { x: number; y: number }[]): void {
    if (points.length === 0) return;
    this.orbitalBeamPass.spawn(points);
    this.fxPass.spawnOrbitalImpacts(points);
    this.strategicFxPass.spawnRipples(points);
  }

  /** Strategic weapons: silos preparing a satellite, strikes counting down. */
  setStrategicFx(
    preparing: readonly PreparingFx[],
    countdowns: readonly CountdownFx[],
    satelliteSilos: ReadonlySet<number>,
  ): void {
    this.strategicFxPass.setPreparing(preparing);
    this.strategicFxPass.setCountdowns(countdowns);
    this.barPass.setSatelliteSilos(satelliteSilos);
  }

  /** World congress: emergency targets' borders pulse. */
  setCongressPulse(ownerIDs: readonly number[]): void {
    this.strategicFxPass.setCongressTargets(ownerIDs);
  }

  /** Strategic weapons: streaks rising from silos (a satellite launch, an interceptor). */
  spawnStrategicStreaks(
    launches: readonly { x: number; y: number }[],
    intercepts: readonly { x: number; y: number }[],
  ): void {
    if (launches.length > 0) this.strategicFxPass.spawnLaunch(launches);
    if (intercepts.length > 0) this.strategicFxPass.spawnIntercept(intercepts);
  }

  /** Domestic mode: progress bars and gold rings on victory-project hosts. */
  setVictoryProjects(progress: ReadonlyMap<number, number>): void {
    this.barPass.setVictoryProjects(progress);
    const hosts: { x: number; y: number }[] = [];
    for (const id of progress.keys()) {
      const unit = this.lastStructures.get(id);
      if (unit === undefined) continue;
      const x = unit.pos % this.mapW;
      hosts.push({ x, y: (unit.pos - x) / this.mapW });
    }
    this.victoryProjectPass.setHosts(hosts);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  setHighlightOwner(ownerID: number): void {
    this.borderPass.setHighlightOwner(ownerID);
    this.territoryPass.setHighlightOwner(ownerID);
    this.namePass.setHighlightOwner(ownerID);
    this.structurePass.setHighlightOwner(ownerID);
    this.railroadPass.setHighlightOwner(ownerID);
  }
  setMouseWorldPos(x: number, y: number): void {
    this.namePass.setMouseWorldPos(x, y);
  }
  setHighlightStructureTypes(unitTypes: string[] | null): void {
    this.structurePass.setHighlightTypes(unitTypes);
    this.structureLevelPass.setHighlightTypes(unitTypes);
    this.samHighlightVisible =
      unitTypes !== null &&
      unitTypes.some((t) => SAM_RADIUS_HIGHLIGHT_TYPES.has(t));
    this.samRadiusPass.setVisible(
      this.samGhostVisible || this.samHighlightVisible,
    );
    this.warfareHighlightVisible =
      unitTypes !== null &&
      unitTypes.some((t) => WARFARE_RING_HIGHLIGHT_TYPES.has(t));
    this.warfareRingPass.setVisible(
      this.warfareGhostVisible || this.warfareHighlightVisible,
    );
  }

  /** SAM rings at each owner's modified range (Config.samRangeOf). */
  setSamRangeOf(fn: (ownerID: number, baseRange: number) => number): void {
    this.samRadiusPass.setSamRangeOf(fn);
  }

  setLocalPlayerID(id: number): void {
    if (id === this.localPlayerID) return;
    this.localPlayerID = id;
    this.samRadiusPass.setLocalPlayer(id);
    this.warfareRingPass.setLocalPlayer(id);
    this.structurePass.setLocalPlayer(id);
    this.affiliationPalette.setLocalPlayer(id);
    this.unitPass.setLocalPlayer(id);
    this.railroadPass.setLocalPlayer(id);
  }

  setLocalRailColor(r: number, g: number, b: number): void {
    this.railroadPass.setLocalRailColor(r, g, b);
  }

  setSAMAllianceClusters(clusters: Map<number, number>): void {
    this.samRadiusPass.setAllianceClusters(clusters);
  }

  setAltView(active: boolean): void {
    this.altView = active;
    this.territoryPass.setAltView(active);
    this.borderStampPass.setAltView(active);
    this.unitPass.setAltView(active);
    this.planePass.setAltView(active);
    this.structurePass.setAltView(active);
    this.trailPass.setAltView(active);
  }

  setGridView(active: boolean): void {
    this.gridView = active;
    try {
      window.localStorage.setItem(GRID_VIEW_KEY, active ? "true" : "false");
    } catch {
      // Ignore if we are unable to use localstorage.
    }
  }

  getSettings(): RenderSettings {
    return this.settings;
  }

  // ---------------------------------------------------------------------------
  // Selection box (warship selection)
  // ---------------------------------------------------------------------------

  setSelectedUnits(unitIds: readonly number[]): void {
    // Copy in (callers may mutate their array).
    this.selectedUnitIds.length = 0;
    for (let i = 0; i < unitIds.length; i++) {
      this.selectedUnitIds.push(unitIds[i]);
    }
    if (this.selectedUnitIds.length === 0) {
      this.selectionBoxPass.hide();
    }
    // Position + color are rebuilt each frame in updateSelectionBox() from
    // lastUnits — dead units get dropped automatically.
  }

  private updateSelectionBox(): void {
    if (this.selectedUnitIds.length === 0) return;

    // Build the entries for this frame and prune dead unit IDs in place.
    const entries = this.selectionBoxEntries;
    entries.length = 0;
    let writeIdx = 0;
    for (let i = 0; i < this.selectedUnitIds.length; i++) {
      const id = this.selectedUnitIds[i];
      const unit = this.lastUnits.get(id);
      if (!unit || !unit.isActive) continue; // dead — drop
      this.selectedUnitIds[writeIdx++] = id;

      const centerX = unit.pos % this.mapW;
      const centerY = Math.floor(unit.pos / this.mapW);
      // Lighten the owner's territory color by ~20% (mix toward white).
      const off = unit.ownerID * 4;
      const r = Math.min(
        1,
        this.paletteData[off] + (1 - this.paletteData[off]) * 0.3,
      );
      const g = Math.min(
        1,
        this.paletteData[off + 1] + (1 - this.paletteData[off + 1]) * 0.3,
      );
      const b = Math.min(
        1,
        this.paletteData[off + 2] + (1 - this.paletteData[off + 2]) * 0.3,
      );
      entries.push({ centerX, centerY, r, g, b });
    }
    this.selectedUnitIds.length = writeIdx;

    this.selectionBoxPass.setSelections(entries);
  }

  // ---------------------------------------------------------------------------
  // Move indicator (warship move-target chevrons)
  // ---------------------------------------------------------------------------

  showMoveIndicator(tileX: number, tileY: number, ownerID: number): void {
    const off = ownerID * 4;
    const r = Math.min(
      1,
      this.paletteData[off] + (1 - this.paletteData[off]) * 0.3,
    );
    const g = Math.min(
      1,
      this.paletteData[off + 1] + (1 - this.paletteData[off + 1]) * 0.3,
    );
    const b = Math.min(
      1,
      this.paletteData[off + 2] + (1 - this.paletteData[off + 2]) * 0.3,
    );
    this.moveIndicatorPass.show(tileX, tileY, r, g, b);
  }

  // ---------------------------------------------------------------------------
  // Render — normalized draw order
  // ---------------------------------------------------------------------------

  draw(): void {
    this.uploadTextures();
    this.computeTextures();
    this.renderFrame();
  }

  private uploadTextures(): void {
    if (this.altView) this.affiliationPalette.flush();
    if (this.inSpawnPhase) {
      this.territoryPass.flushAllDripBuckets();
    } else {
      this.territoryPass.drainDripBucket();
    }
    // Full uploads need a full border recompute; scatter uploads already
    // pushed per-tile border patches via the wired `borderPatchConsumer`.
    if (this.territoryPass.flushTileTexture() === "full") {
      this.borderPass.markGlobalDirty();
      this.defenseCoveragePass.markDirty();
    }
    // Heat decay only runs while fallout is in play — (re)activate whenever a
    // fallout bit flipped in the tile state that just reached the GPU.
    if (this.territoryPass.consumeFalloutTouched()) {
      this.heatManager.activate();
    }
    this.trailPass.flushTexture();
    this.heatManager.updateHeat();
  }

  private computeTextures(): void {
    if (this.settings.passEnabled.borderCompute) this.borderPass.draw();
    // Re-stamp defense coverage if posts/territory changed (dirty-gated).
    // Leaves the default framebuffer bound; renderFrame resets the viewport.
    this.defenseCoveragePass.draw();
  }

  private renderFrame(): void {
    const cam = this.camera.getMatrix();
    const zoom = this.camera.zoom;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const compositingActive = this.isLightCompositingActive();

    if (compositingActive) {
      this.resizeSceneTargetIfNeeded(cw, ch);
      const sceneTex = toTarget(this.gl, this.sceneTarget, () =>
        this.drawBaseLayer(cam),
      );
      const lightTex = this.lightmapPass.draw(cam, cw, ch, this.frameTick);
      toScreen(this.gl, cw, ch, () =>
        this.nightCompositePass.draw(sceneTex, lightTex),
      );
    } else {
      toScreen(this.gl, cw, ch, () => this.drawBaseLayer(cam));
    }

    this.renderOverlays(cam, zoom);
  }

  private isLightCompositingActive(): boolean {
    return this.settings.lighting.enabled;
  }

  private resizeSceneTargetIfNeeded(cw: number, ch: number): void {
    if (this.sceneTarget.w === cw && this.sceneTarget.h === ch) return;
    this.sceneTarget.w = cw;
    this.sceneTarget.h = ch;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      cw,
      ch,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  private drawBaseLayer(cam: Float32Array): void {
    const gl = this.gl;
    const pe = this.settings.passEnabled;
    const [bgR, bgG, bgB] = hexToRgb(this.settings.terrain.backgroundColor) ?? [
      60, 60, 60,
    ];
    gl.clearColor(bgR / 255, bgG / 255, bgB / 255, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    if (pe.terrain) this.terrainPass.draw(cam);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Map layers sit between terrain and territory.
    for (const layerPass of this.mapLayerPasses.values()) {
      layerPass.draw(cam);
    }
    if (pe.territory) this.territoryPass.draw(cam);
    // World War 1936: region lines over the fill, under the country borders
    // (borderStampPass draws in renderOverlays).
    this.regionBorderPass?.draw(cam, this.camera.zoom);
    // P2: the chosen army's front, encircled and pickable regions.
    if (this.wwLand !== null && this.regionBorderPass !== null) {
      this.syncLandFlags();
      this.regionBorderPass.drawFlags(
        cam,
        renderDpr() / Math.max(this.camera.zoom, 1e-6),
        performance.now() / 1000,
        this.paletteTex,
        this.wwLand.me(),
      );
    }
  }

  private renderOverlays(cam: Float32Array, zoom: number): void {
    const gl = this.gl;
    const pe = this.settings.passEnabled;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.strategicFxPass.updatePulses();
    this.borderStampPass.setPulses(
      this.strategicFxPass.pulseOwners,
      this.strategicFxPass.pulseValues,
      this.strategicFxPass.pulseCount,
    );
    this.spawnOverlayPass.draw(cam);
    if (pe.borderStamp) this.borderStampPass.draw(cam);
    if (pe.railroad) this.railroadPass.draw(cam, zoom);
    if (pe.unit) this.unitPass.drawGround(cam);
    if (pe.unit) this.planePass.drawShadows(cam);
    if (pe.falloutBloom) this.bloomPass.draw(cam, this.frameTick);
    this.samRadiusPass.draw(cam);
    this.rangeCirclePass.draw(cam);
    this.victoryProjectPass.draw(cam);
    this.warfareRingPass.draw(cam);
    this.nukeTrajectoryPass.draw(cam);
    this.crosshairPass.draw(cam);
    if (pe.structure) this.structurePass.draw(cam, zoom);
    if (pe.structure) this.structureLevelPass.draw(cam, zoom);
    // Small-player glow draws after structures so buildings can't hide it.
    this.smallPlayerGlowPass.draw(cam);
    if (pe.bar) this.barPass.draw(cam);
    this.updateSelectionBox();
    this.selectionBoxPass.draw(cam, this.frameTick);
    this.moveIndicatorPass.draw(cam, zoom);
    this.nukeTelegraphPass.draw(cam);
    if (pe.trail) this.trailPass.draw(cam);
    // Spiral vortexes sit above the plain trails, below the missiles that
    // trail them. Skipped in alt view — the strategic overlay stays effects-free.
    if (!this.altView) this.spiralRibbonPass.draw(cam);
    if (pe.unit) this.unitPass.drawMissiles(cam);
    if (pe.unit) this.planePass.drawAir(cam);

    // Orbital-strike beams fall under the blast sprites.
    this.orbitalBeamPass.draw(cam);
    if (pe.fx) {
      this.fxPass.tick();
      this.fxPass.draw(cam, zoom);
    }
    this.strategicFxPass.draw(cam, zoom);
    if (pe.fx) this.airFxPass.draw(cam, zoom);

    // Grid shows on either trigger; names hide only under alt-view (space
    // hold), not under the persistent M-key gridView toggle.
    if (this.gridView || this.altView) this.coordinateGridPass.draw(cam, zoom);
    if (pe.name && !this.altView)
      this.namePass.draw(cam, this.nightCompositePass.getAmbient());

    // World War 1936 P2: battles, plan arrows and army tokens over the names.
    if (this.wwLand !== null) this.drawWwLand(cam, performance.now());

    // World text (attack-troop labels, popups, ghost cost) draws on top of
    // player names so attack callouts aren't hidden behind a centered name.
    this.strategicFxPass.updateLabels(zoom);
    this.worldTextPass.tick(zoom);
    this.worldTextPass.draw(cam, zoom);

    gl.disable(gl.BLEND);
  }

  // ---------------------------------------------------------------------------
  // Map-layer management
  // ---------------------------------------------------------------------------

  /**
   * Create map-layer passes from the loaded layer data.  Called once at game
   * start (and again after context restore).  Layers are drawn in array order
   * between the terrain and territory passes.
   */
  setMapLayers(layers: MapLayer[], images: Map<string, ImageBitmap>): void {
    // Dispose any previous layer passes.
    for (const p of this.mapLayerPasses.values()) p.dispose();
    this.mapLayerPasses.clear();
    this.storedLayers = layers;
    this.storedLayerImages = images;

    if (!this.terrainBytesTex) return;
    const gl = this.gl;

    for (const layer of layers) {
      const image = images.get(layer.id);
      if (!image) {
        console.warn(`[Renderer] Layer image "${layer.id}" not found`);
        continue;
      }
      const placement: 0 | 1 = layer.placement === "water" ? 1 : 0;
      const pass = new MapLayerPass(
        gl,
        this.terrainBytesTex,
        image,
        this.mapW,
        this.mapH,
        placement,
        layer.nukeable ?? false,
      );
      this.mapLayerPasses.set(layer.id, pass);
    }
  }

  /** World War 1936 (spec §8.2): draw the lines between these region ids. */
  setRegions(regionIds: Uint16Array): void {
    this.regionBorderPass?.dispose();
    this.regionBorderPass = new RegionBorderPass(
      this.gl,
      regionIds,
      this.mapW,
      this.mapH,
    );
    this.landFlagsStale = true;
  }

  // ---------------------------------------------------------------------------
  // World War 1936 P2: the land war (spec §15.2)
  // ---------------------------------------------------------------------------

  /**
   * Draw the land war from `view`: army tokens, battle markers, the chosen
   * army's plan arrows and the region flags. `me` is the viewer's smallID;
   * `isEnemy(smallID)` says who the viewer is at war with (without it every
   * country outside the viewer's side counts).
   */
  setWwLand(
    view: WwLandView,
    selection: WwLandSelection,
    me: () => number,
    isEnemy: ((smallID: number) => boolean) | null = null,
  ): void {
    this.disposeWwLand();
    this.wwLand = { view, selection, me, isEnemy };
    const atlas = new LandAtlas(this.gl);
    this.wwPasses = {
      atlas,
      tokens: new ArmyTokenPass(this.gl, this.paletteTex, atlas.texture),
      battles: new BattleMarkerPass(this.gl, this.paletteTex, atlas.texture),
      arrows: new PlanArrowPass(this.gl),
    };
    this.landFlagsStale = true;
  }

  private disposeWwLand(): void {
    if (this.wwPasses !== null) {
      this.wwPasses.tokens.dispose();
      this.wwPasses.battles.dispose();
      this.wwPasses.arrows.dispose();
      this.wwPasses.atlas.dispose();
    }
    this.wwPasses = null;
    this.wwLand = null;
    this.paraSeen.clear();
    this.paraVersion = -1;
    this.paraFlights = [];
  }

  /** A game tick arrived: tokens glide from it over the smoothed tick span. */
  private noteLandTick(gameTick: number): void {
    if (this.wwLand === null || gameTick === this.landTick) return;
    const now = performance.now();
    const step = gameTick - this.landTick;
    if (step === 1 && this.landTickMs > 0) {
      this.landTickSpanMs = nextTickSpan(
        this.landTickSpanMs,
        now - this.landTickMs,
        this.msPerTick,
      );
    }
    this.landTick = gameTick;
    this.landTickMs = now;
  }

  /** The game tick this frame shows, with the share of the next one gone by. */
  private landTickNow(now: number): number {
    const frac = (now - this.landTickMs) / Math.max(1, this.landTickSpanMs);
    return this.landTick + Math.min(1, Math.max(0, frac));
  }

  private enemyTest(me: number): (smallID: number) => boolean {
    const land = this.wwLand!;
    if (land.isEnemy !== null) return land.isEnemy;
    const sc = land.view.scenario;
    return (id) => id !== 0 && !sameLandSide(sc, id, me);
  }

  /**
   * Region flags (spec §15.2): worked out again when the view, the choice
   * or the viewer changed, sent to the pass only when a byte differs.
   */
  private syncLandFlags(): void {
    const land = this.wwLand;
    const pass = this.regionBorderPass;
    if (land === null || pass === null) return;
    const me = land.me();
    const sel = land.selection;
    if (
      !this.landFlagsStale &&
      land.view.version === this.landFlagsVersion &&
      sel.version === this.landFlagsSelection &&
      me === this.landFlagsMe
    ) {
      return;
    }
    this.landFlagsVersion = land.view.version;
    this.landFlagsSelection = sel.version;
    this.landFlagsMe = me;
    const isEnemy = this.enemyTest(me);
    regionFlagBytes(
      land.view,
      sel,
      me,
      this.frontPreview(me, isEnemy),
      isEnemy,
      this.landFlags,
    );
    const limit = land.view.controller.length;
    let same = !this.landFlagsStale;
    for (let i = 0; same && i < limit && i < this.landFlags.length; i++) {
      if (this.landFlags[i] !== this.landFlagsSent[i]) same = false;
    }
    this.landFlagsStale = false;
    if (same) return;
    this.landFlagsSent.set(this.landFlags);
    pass.setRegionFlags(this.landFlags);
  }

  /** Front mode's first tap (spec §15.3-4): the front it would give. */
  private frontPreview(
    me: number,
    isEnemy: (smallID: number) => boolean,
  ): readonly number[] {
    const land = this.wwLand!;
    const sel = land.selection;
    if (sel.mode !== "front" || sel.pending === null || sel.army === null) {
      return [];
    }
    const army = land.view.armies.get(sel.army);
    if (army === undefined || army.owner !== me) return [];
    const sc = land.view.scenario;
    const mine = (id: number) => sameLandSide(sc, id, me);
    return frontOf(
      {
        scenario: sc,
        controller: land.view.controller,
        sameSide: (a, b) => sameLandSide(sc, a, b),
        isEnemy: (a, b) => (mine(a) && isEnemy(b)) || (mine(b) && isEnemy(a)),
      },
      me,
      0,
      sel.pending,
      frontSize(army.divisions),
    );
  }

  /** Battle markers, then plan arrows, then the tokens on top (spec §15.2). */
  private drawWwLand(cam: Float32Array, now: number): void {
    const land = this.wwLand;
    const passes = this.wwPasses;
    if (land === null || passes === null) return;
    const zoom = this.camera.zoom / renderDpr();
    const tilesPerPx = 1 / Math.max(zoom, 1e-6);
    const timeSec = now / 1000;
    const me = land.me();
    const view = land.view;
    const changed = this.tokenLayout.update(view, this.landTickNow(now), zoom);
    passes.battles.update(view, tokenLod(zoom));
    passes.arrows.update(view, land.selection, me, tilesPerPx);
    passes.tokens.update(view, this.tokenLayout, changed, land.selection, me);

    passes.battles.draw(cam, tilesPerPx);
    if (passes.arrows.instanceCount > 0) {
      let sx: number;
      let sy: number;
      const i =
        land.selection.army === null
          ? -1
          : this.tokenLayout.indexOf(land.selection.army);
      if (i >= 0) {
        sx = this.tokenLayout.placements[i].x;
        sy = this.tokenLayout.placements[i].y;
      } else {
        const a = view.armies.get(land.selection.army ?? 0);
        const t = a === undefined ? 0 : view.scenario.centerTile(a.region);
        sx = t % view.scenario.width;
        sy = Math.floor(t / view.scenario.width);
      }
      passes.arrows.draw(cam, tilesPerPx, timeSec, sx, sy);
    }
    passes.tokens.draw(cam, tilesPerPx, timeSec);
  }

  /**
   * Paradrops (spec §7.6, pre-flight R2): an army whose ARMY_PARA bit
   * cleared as its token jumped regions dropped this tick. A transport
   * plane is flown from the old region to the new one by adding it to the
   * units PlanePass gets; its parachutes open on arrival. Returns `units`
   * itself while no such plane flies.
   */
  private withParaFlights(
    units: Map<number, UnitState>,
    gameTick: number,
  ): ReadonlyMap<number, UnitState> {
    const land = this.wwLand;
    if (land === null) return units;
    if (land.view.version !== this.paraVersion) {
      this.paraVersion = land.view.version;
      this.findParadrops(land.view, gameTick);
    }
    if (this.paraFlights.length === 0) return units;
    const out = this.unitsWithPara;
    out.clear();
    for (const [id, u] of units) out.set(id, u);
    const w = this.mapW;
    const tile = (x: number, y: number) => Math.round(y) * w + Math.round(x);
    let kept = 0;
    for (const f of this.paraFlights) {
      const k = gameTick - f.startTick;
      if (k > f.ticks || k < 0) {
        this.airFxPass.spawnParadrop(f.x1, f.y1, f.unit.ownerID);
        continue;
      }
      const at = (j: number) => {
        const t = Math.max(0, j) / f.ticks;
        return tile(f.x0 + (f.x1 - f.x0) * t, f.y0 + (f.y1 - f.y0) * t);
      };
      f.unit.pos = at(k);
      f.unit.lastPos = at(k - 1);
      out.set(f.unit.id, f.unit);
      this.paraFlights[kept++] = f;
    }
    this.paraFlights.length = kept;
    return out;
  }

  private findParadrops(view: WwLandView, gameTick: number): void {
    const sc = view.scenario;
    const w = sc.width;
    for (const a of view.armies.values()) {
      const now = a.region * 2 + ((a.state & ARMY_PARA) !== 0 ? 1 : 0);
      const before = this.paraSeen.get(a.id);
      this.paraSeen.set(a.id, now);
      if (before === undefined || before % 2 === 0 || now % 2 === 1) continue;
      const from = Math.floor(before / 2);
      if (from === a.region || from === 0 || a.region === 0) continue;
      const t0 = sc.centerTile(from);
      const t1 = sc.centerTile(a.region);
      const x0 = t0 % w;
      const y0 = Math.floor(t0 / w);
      const x1 = t1 % w;
      const y1 = Math.floor(t1 / w);
      const dist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      this.paraFlights.push({
        unit: paraPlane(this.nextParaId--, a.owner, t0, t1),
        x0,
        y0,
        x1,
        y1,
        startTick: gameTick,
        ticks: Math.min(40, Math.max(6, Math.ceil(dist / PLANE_SPEED))),
      });
    }
    if (this.paraSeen.size > view.armies.size) {
      for (const id of [...this.paraSeen.keys()]) {
        if (!view.armies.has(id)) this.paraSeen.delete(id);
      }
    }
  }

  /** Toggle visibility of a single layer (driven by graphics settings). */
  setLayerVisible(layerId: string, visible: boolean): void {
    this.mapLayerPasses.get(layerId)?.setVisible(visible);
  }

  /** Set the alpha multiplier for a single layer (0–1). */
  setLayerAlpha(layerId: string, alpha: number): void {
    this.mapLayerPasses.get(layerId)?.setAlpha(alpha);
  }

  /**
   * Mark tiles as destroyed for a nukeable layer.  Called when a nuke
   * detonates; batches all tile updates into a single GPU upload.
   */
  markLayerTilesDestroyed(layerId: string, tileIndices: number[]): void {
    this.mapLayerPasses.get(layerId)?.markTilesDestroyed(tileIndices);
  }

  /**
   * Bulk-destroy tiles for a nukeable layer (used when replaying or restoring
   * state).
   */
  setLayerDestroyedMask(layerId: string, mask: Uint8Array): void {
    this.mapLayerPasses.get(layerId)?.updateDestroyedMask(mask);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * @param releaseContext Also drop the WebGL context itself. Must be false
   *   when disposing *because* the context was lost — see the call in
   *   MapRenderer.handleContextLost.
   */
  dispose({ releaseContext = true }: { releaseContext?: boolean } = {}): void {
    this.stopLoop();
    for (const p of this.mapLayerPasses.values()) p.dispose();
    this.mapLayerPasses.clear();
    this.regionBorderPass?.dispose();
    this.regionBorderPass = null;
    this.disposeWwLand();
    if (this.terrainBytesTex) {
      this.gl.deleteTexture(this.terrainBytesTex);
      this.terrainBytesTex = null;
    }
    this.terrainPass.dispose();
    this.territoryPass.dispose();
    this.trailPass.dispose();
    this.spiralRibbonPass.dispose();
    this.borderStampPass.dispose();
    this.borderPass.dispose();
    this.defenseCoveragePass.dispose();
    this.bloomPass.dispose();
    this.pointLightPass.dispose();
    this.falloutLightPass.dispose();
    this.lightmapPass.dispose();
    this.nightCompositePass.dispose();
    this.heatManager.dispose();
    this.affiliationPalette.dispose();
    this.coordinateGridPass.dispose();
    this.spawnOverlayPass.dispose();
    this.smallPlayerGlowPass.dispose();
    this.railroadPass.dispose();
    this.rangeCirclePass.dispose();
    this.victoryProjectPass.dispose();
    this.orbitalBeamPass.dispose();
    this.strategicFxPass.dispose();
    this.warfareRingPass.dispose();
    this.samRadiusPass.dispose();
    this.crosshairPass.dispose();
    this.structurePass.dispose();
    this.structureLevelPass.dispose();
    this.unitPass.dispose();
    this.planePass.dispose();
    this.airFxPass.dispose();
    this.namePass.dispose();
    this.fxPass.dispose();
    this.worldTextPass.dispose();
    this.selectionBoxPass.dispose();
    this.moveIndicatorPass.dispose();
    this.nukeTrajectoryPass.dispose();
    this.nukeTelegraphPass.dispose();
    this.barPass.dispose();
    disposeGPUResources(this.gl, this.res);
    this.gl.deleteTexture(this.paletteTex);
    this.gl.deleteTexture(this.effectTex);
    this.gl.deleteTexture(this.patternMetaTex);
    this.gl.deleteTexture(this.patternDataTex);
    this.gl.deleteTexture(this.skinLayerTex);
    this.gl.deleteTexture(this.skinAnchorTex);
    this.skinAtlas.dispose();
    this.gl.deleteFramebuffer(this.sceneTarget.fbo);
    this.gl.deleteTexture(this.sceneTarget.tex);
    this.lastUnits = new Map();
    this.lastStructures = new Map();
    // Deleting GL resources isn't enough — the context itself counts against
    // the browser's WebGL context limit until it's GC'd, which is unreliable
    // on mobile. Explicitly drop it so repeated game starts don't overflow.
    if (releaseContext) {
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }
}

/** The paradrop plane PlanePass draws (a transport plane flying to `target`). */
function paraPlane(
  id: number,
  owner: number,
  from: number,
  target: number,
): UnitState {
  return {
    id,
    unitType: UT_TRANSPORT_PLANE,
    ownerID: owner,
    lastOwnerID: null,
    pos: from,
    lastPos: from,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: false,
    waitTicks: 0,
    markedForDeletion: false,
    health: null,
    underConstruction: false,
    targetUnitId: null,
    targetTile: target,
    troops: 0,
    missileTimerQueue: [],
    level: 1,
    veterancy: 0,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    constructionStartTick: null,
    samUpgradeStartTick: null,
    samUpgradeStartRange: null,
    samUpgradeTargetLevel: null,
    samUpgradeDuration: null,
  };
}
