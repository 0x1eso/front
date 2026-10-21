import { EventBus } from "@openfront/shared/EventBus";
import { Controller } from "../Controller";
import { AmbienceController } from "../controllers/AmbienceController";
import { AttackingTroopsController } from "../controllers/AttackingTroopsController";
import { BuildPreviewController } from "../controllers/BuildPreviewController";
import { HoverHighlightController } from "../controllers/HoverHighlightController";
import { LiveStatsController } from "../controllers/LiveStatsController";
import { MapLayerController } from "../controllers/MapLayerController";
import { SoundEffectController } from "../controllers/SoundEffectController";
import { StructureHighlightController } from "../controllers/StructureHighlightController";
import { TouchHintController } from "../controllers/TouchHintController";
import { ViewModeController } from "../controllers/ViewModeController";
import { WarshipSelectionController } from "../controllers/WarshipSelectionController";
import { GameStartingModal } from "../GameStartingModal";
import { migrateLegacyGraphicsSettings } from "../GraphicsPresets";
import { MapRenderer } from "../render/gl";
import { TransformHandler } from "../TransformHandler";
import { UIState } from "../UIState";
// The homepage loads it on demand, but the in-game instance (#game-settings)
// is set up below, so it has to be defined by the time a game renders.
import "../UserSettingModal";
import type { UserSettingModal } from "../UserSettingModal";
import { UserSettings } from "../UserSettings";
import { GameView } from "../view";
import { CongressBand } from "./congress/CongressBand";
import { CongressCards } from "./congress/CongressCards";
import { DomesticDials } from "./domestic/DomesticDials";
import { DomesticPanel } from "./domestic/DomesticPanel";
import { FrameProfiler } from "./FrameProfiler";
import { ActionableEvents } from "./layers/ActionableEvents";
import { AlertFrame } from "./layers/AlertFrame";
import { AttacksDisplay } from "./layers/AttacksDisplay";
import { BuildMenu } from "./layers/BuildMenu";
import { ChatDisplay } from "./layers/ChatDisplay";
import { ChatModal } from "./layers/ChatModal";
import { ControlPanel } from "./layers/ControlPanel";
import { EmojiTable } from "./layers/EmojiTable";
import { EventsDisplay } from "./layers/EventsDisplay";
import { GameLeftSidebar } from "./layers/GameLeftSidebar";
import { GameRightSidebar } from "./layers/GameRightSidebar";
import { HeadsUpMessage } from "./layers/HeadsUpMessage";
import { ImmunityTimer } from "./layers/ImmunityTimer";
import { InGamePromo } from "./layers/InGamePromo";
import { MainRadialMenu } from "./layers/MainRadialMenu";
import { MapControls } from "./layers/MapControls";
import { MultiTabModal } from "./layers/MultiTabModal";
import { NewLobbyPrompt } from "./layers/NewLobbyPrompt";
import { PerformanceOverlay } from "./layers/PerformanceOverlay";
import { PlayerInfoOverlay } from "./layers/PlayerInfoOverlay";
import { PlayerPanel } from "./layers/PlayerPanel";
import { ReplayPanel } from "./layers/ReplayPanel";
import { SatelliteBand } from "./layers/SatelliteBand";
import { SatelliteTargetPicker } from "./layers/SatelliteTargetPicker";
import { SettingsModal } from "./layers/SettingsModal";
import { SpawnTimer } from "./layers/SpawnTimer";
import { TutorialPanel } from "./layers/TutorialPanel";
import { UnitDisplay } from "./layers/UnitDisplay";
import { WinModal } from "./layers/WinModal";
import { loadAllSprites } from "./SpriteLoader";
import { landSidesOf, landWarInputsOf, setLandSides } from "./ww1936/LandModel";
import { landSelectionOf } from "./ww1936/LandSelection";
import { WwArmyCard } from "./ww1936/WwArmyCard";
import { WwArmyPanel } from "./ww1936/WwArmyPanel";
import { WwBattleCard } from "./ww1936/WwBattleCard";
import { WwDials } from "./ww1936/WwDials";
import { WwDiplomacyPanel } from "./ww1936/WwDiplomacyPanel";
import { WwEventCards } from "./ww1936/WwEventCards";
import { WwFocusPanel } from "./ww1936/WwFocusPanel";
import { WwIndustryPanel } from "./ww1936/WwIndustryPanel";
import { LandTapBus, WwLandController } from "./ww1936/WwLandController";
import { WwNewsTicker } from "./ww1936/WwNewsTicker";
import { WwPoliticsPanel } from "./ww1936/WwPoliticsPanel";
import { WwResearchPanel } from "./ww1936/WwResearchPanel";
import { WwTopBand } from "./ww1936/WwTopBand";

export function createRenderer(
  inputEl: HTMLElement,
  game: GameView,
  eventBus: EventBus,
  playerRole: string | null,
  view: MapRenderer,
  mapLayerController?: MapLayerController,
): GameRenderer {
  const transformHandler = new TransformHandler(game, eventBus, inputEl);
  const userSettings = new UserSettings();

  const uiState: UIState = {
    attackRatio: 20,
    ghostStructure: null,
    rocketDirectionUp: true,
    upgradeMultiplier: 1,
  };

  //hide when the game renders
  const startingModal = document.querySelector(
    "game-starting-modal",
  ) as GameStartingModal;
  startingModal.hide();

  // TODO maybe append this to document instead of querying for them?
  const emojiTable = document.querySelector("emoji-table") as EmojiTable;
  if (!emojiTable || !(emojiTable instanceof EmojiTable)) {
    console.error("EmojiTable element not found in the DOM");
  }
  emojiTable.transformHandler = transformHandler;
  emojiTable.game = game;
  emojiTable.initEventBus(eventBus);

  const buildMenu = document.querySelector("build-menu") as BuildMenu;
  if (!buildMenu || !(buildMenu instanceof BuildMenu)) {
    console.error("BuildMenu element not found in the DOM");
  }
  buildMenu.game = game;
  buildMenu.eventBus = eventBus;
  buildMenu.uiState = uiState;
  buildMenu.transformHandler = transformHandler;

  const gameLeftSidebar = document.querySelector(
    "game-left-sidebar",
  ) as GameLeftSidebar;
  if (!gameLeftSidebar || !(gameLeftSidebar instanceof GameLeftSidebar)) {
    console.error("GameLeftSidebar element not found in the DOM");
  }
  gameLeftSidebar.game = game;
  gameLeftSidebar.eventBus = eventBus;

  const controlPanel = document.querySelector("control-panel") as ControlPanel;
  if (!(controlPanel instanceof ControlPanel)) {
    console.error("ControlPanel element not found in the DOM");
  }
  controlPanel.eventBus = eventBus;
  controlPanel.uiState = uiState;
  controlPanel.game = game;

  const eventsDisplay = document.querySelector(
    "events-display",
  ) as EventsDisplay;
  if (!(eventsDisplay instanceof EventsDisplay)) {
    console.error("events display not found");
  }
  eventsDisplay.eventBus = eventBus;
  eventsDisplay.game = game;
  eventsDisplay.uiState = uiState;

  const actionableEvents = document.querySelector(
    "actionable-events",
  ) as ActionableEvents;
  if (!(actionableEvents instanceof ActionableEvents)) {
    console.error("actionable events not found");
  }
  actionableEvents.eventBus = eventBus;
  actionableEvents.game = game;
  actionableEvents.uiState = uiState;

  const attacksDisplay = document.querySelector(
    "attacks-display",
  ) as AttacksDisplay;
  if (!(attacksDisplay instanceof AttacksDisplay)) {
    console.error("attacks display not found");
  }
  attacksDisplay.eventBus = eventBus;
  attacksDisplay.game = game;
  attacksDisplay.uiState = uiState;

  const chatDisplay = document.querySelector("chat-display") as ChatDisplay;
  if (!(chatDisplay instanceof ChatDisplay)) {
    console.error("chat display not found");
  }
  chatDisplay.eventBus = eventBus;
  chatDisplay.game = game;

  const playerInfo = document.querySelector(
    "player-info-overlay",
  ) as PlayerInfoOverlay;
  if (!(playerInfo instanceof PlayerInfoOverlay)) {
    console.error("player info overlay not found");
  }
  playerInfo.eventBus = eventBus;
  playerInfo.transform = transformHandler;
  playerInfo.game = game;

  const winModal = document.querySelector("win-modal") as WinModal;
  if (!(winModal instanceof WinModal)) {
    console.error("win modal not found");
  }
  winModal.eventBus = eventBus;
  winModal.game = game;

  const newLobbyPrompt = document.querySelector(
    "new-lobby-prompt",
  ) as NewLobbyPrompt;
  if (!(newLobbyPrompt instanceof NewLobbyPrompt)) {
    console.error("new lobby prompt not found");
  }
  newLobbyPrompt.eventBus = eventBus;
  newLobbyPrompt.game = game;

  const replayPanel = document.querySelector("replay-panel") as ReplayPanel;
  if (!(replayPanel instanceof ReplayPanel)) {
    console.error("replay panel not found");
  }
  replayPanel.eventBus = eventBus;
  replayPanel.game = game;

  const gameRightSidebar = document.querySelector(
    "game-right-sidebar",
  ) as GameRightSidebar;
  if (!(gameRightSidebar instanceof GameRightSidebar)) {
    console.error("Game Right bar not found");
  }
  gameRightSidebar.game = game;
  gameRightSidebar.eventBus = eventBus;

  const mapControls = document.querySelector("map-controls") as MapControls;
  if (!(mapControls instanceof MapControls)) {
    console.error("map controls not found");
  }
  mapControls.eventBus = eventBus;

  const settingsModal = document.querySelector(
    "settings-modal",
  ) as SettingsModal;
  if (!(settingsModal instanceof SettingsModal)) {
    console.error("settings modal not found");
  }
  settingsModal.eventBus = eventBus;

  // The in-game settings instance needs the bus so the Audio sliders reach
  // SoundManager, which caches its volumes at construction, and UIState so the
  // attack ratio slider shows the session value the HUD slider may have set.
  // It also owns the advanced graphics options now, so it takes this game's
  // map layers and the two renderer callbacks they apply through — the rest of
  // those options reach the renderer through the settings-changed event
  // ClientGameRunner listens for.
  const gameSettingsModal = document.getElementById(
    "game-settings",
  ) as UserSettingModal | null;
  if (gameSettingsModal === null) {
    console.warn("In-game settings modal (#game-settings) not found");
  } else {
    gameSettingsModal.uiState = uiState;
    gameSettingsModal.mapLayers = game.layers();
    gameSettingsModal.onLayerVisibilityChange = (layerId, visible) => {
      view.setLayerVisible(layerId, visible);
    };
    gameSettingsModal.onLayerAlphaChange = (layerId, alpha) => {
      view.setLayerAlpha(layerId, alpha);
    };
  }

  // Ran from the graphics modal's init() before that modal was folded into the
  // settings modal's Graphics tab. Still game start, so a player who tuned
  // their graphics before presets existed keeps that snapshot whether or not
  // they ever open settings.
  migrateLegacyGraphicsSettings(userSettings);

  const unitDisplay = document.querySelector("unit-display") as UnitDisplay;
  if (!(unitDisplay instanceof UnitDisplay)) {
    console.error("unit display not found");
  }
  unitDisplay.game = game;
  unitDisplay.eventBus = eventBus;
  unitDisplay.uiState = uiState;

  // The domestic dials (spec §14d) at the left of the bottom HUD rows.
  const domesticDials = document.querySelector("domestic-dials");
  if (domesticDials instanceof DomesticDials) {
    domesticDials.game = game;
    domesticDials.eventBus = eventBus;
  } else {
    console.error("domestic dials not found");
  }

  const domesticPanel = document.querySelector(
    "domestic-panel",
  ) as DomesticPanel;
  if (!(domesticPanel instanceof DomesticPanel)) {
    console.error("domestic panel not found");
  }
  domesticPanel.game = game;
  domesticPanel.eventBus = eventBus;

  const playerPanel = document.querySelector("player-panel") as PlayerPanel;
  if (!(playerPanel instanceof PlayerPanel)) {
    console.error("player panel not found");
  }
  playerPanel.g = game;
  playerPanel.initEventBus(eventBus);
  playerPanel.emojiTable = emojiTable;
  playerPanel.uiState = uiState;

  playerPanel.setRole(playerRole);

  const chatModal = document.querySelector("chat-modal") as ChatModal;
  if (!(chatModal instanceof ChatModal)) {
    console.error("chat modal not found");
  }
  chatModal.g = game;
  chatModal.transformHandler = transformHandler;
  chatModal.initEventBus(eventBus);

  const multiTabModal = document.querySelector(
    "multi-tab-modal",
  ) as MultiTabModal;
  if (!(multiTabModal instanceof MultiTabModal)) {
    console.error("multi-tab modal not found");
  }
  multiTabModal.game = game;

  const headsUpMessage = document.querySelector(
    "heads-up-message",
  ) as HeadsUpMessage;
  if (!(headsUpMessage instanceof HeadsUpMessage)) {
    console.error("heads-up message not found");
  }
  headsUpMessage.game = game;

  const performanceOverlay = document.querySelector(
    "performance-overlay",
  ) as PerformanceOverlay;
  if (!(performanceOverlay instanceof PerformanceOverlay)) {
    console.error("performance overlay not found");
  }
  performanceOverlay.eventBus = eventBus;
  performanceOverlay.userSettings = userSettings;

  const alertFrame = document.querySelector("alert-frame") as AlertFrame;
  if (!(alertFrame instanceof AlertFrame)) {
    console.error("alert frame not found");
  }
  alertFrame.game = game;

  const spawnTimer = document.querySelector("spawn-timer") as SpawnTimer;
  if (!(spawnTimer instanceof SpawnTimer)) {
    console.error("spawn timer not found");
  }
  spawnTimer.game = game;
  spawnTimer.eventBus = eventBus;
  spawnTimer.transformHandler = transformHandler;

  const immunityTimer = document.querySelector(
    "immunity-timer",
  ) as ImmunityTimer;
  if (!(immunityTimer instanceof ImmunityTimer)) {
    console.error("immunity timer not found");
  }
  immunityTimer.game = game;
  immunityTimer.eventBus = eventBus;

  const satelliteBand = document.querySelector(
    "satellite-band",
  ) as SatelliteBand;
  if (!(satelliteBand instanceof SatelliteBand)) {
    console.error("satellite band not found");
  }
  satelliteBand.game = game;
  satelliteBand.eventBus = eventBus;

  // World War 1936 (spec §8.2): the date band and the diplomacy drawer.
  const wwTopBand = document.querySelector("ww-top-band") as WwTopBand;
  if (!(wwTopBand instanceof WwTopBand)) {
    console.error("ww top band not found");
  }
  wwTopBand.game = game;
  wwTopBand.eventBus = eventBus;

  const wwDiplomacyPanel = document.querySelector(
    "ww-diplomacy-panel",
  ) as WwDiplomacyPanel;
  if (!(wwDiplomacyPanel instanceof WwDiplomacyPanel)) {
    console.error("ww diplomacy panel not found");
  }
  wwDiplomacyPanel.game = game;
  wwDiplomacyPanel.eventBus = eventBus;

  // World War 1936 P1 (spec §13): the dials beside the domestic ones, and
  // the industry and research drawers.
  const wwDials = document.querySelector("ww-dials");
  if (wwDials instanceof WwDials) {
    wwDials.game = game;
    wwDials.eventBus = eventBus;
  } else {
    console.error("ww dials not found");
  }
  const wwIndustryPanel = document.querySelector("ww-industry-panel");
  if (wwIndustryPanel instanceof WwIndustryPanel) {
    wwIndustryPanel.game = game;
    wwIndustryPanel.eventBus = eventBus;
  } else {
    console.error("ww industry panel not found");
  }
  const wwResearchPanel = document.querySelector("ww-research-panel");
  if (wwResearchPanel instanceof WwResearchPanel) {
    wwResearchPanel.game = game;
    wwResearchPanel.eventBus = eventBus;
  } else {
    console.error("ww research panel not found");
  }
  // P2 (spec §15): the army drawer, the chosen army's card, a battle's card.
  const wwArmyPanel = document.querySelector("ww-army-panel");
  if (wwArmyPanel instanceof WwArmyPanel) {
    wwArmyPanel.game = game;
    wwArmyPanel.eventBus = eventBus;
  } else {
    console.error("ww army panel not found");
  }
  const wwArmyCard = document.querySelector("ww-army-card");
  if (wwArmyCard instanceof WwArmyCard) {
    wwArmyCard.game = game;
    wwArmyCard.eventBus = eventBus;
  } else {
    console.error("ww army card not found");
  }
  const wwBattleCard = document.querySelector("ww-battle-card");
  if (wwBattleCard instanceof WwBattleCard) {
    wwBattleCard.game = game;
    wwBattleCard.eventBus = eventBus;
  } else {
    console.error("ww battle card not found");
  }

  // P3 (spec §21): the politics drawer, the event cards above the dials,
  // the world news under the band.
  const wwPoliticsPanel = document.querySelector("ww-politics-panel");
  if (wwPoliticsPanel instanceof WwPoliticsPanel) {
    wwPoliticsPanel.game = game;
    wwPoliticsPanel.eventBus = eventBus;
  } else {
    console.error("ww politics panel not found");
  }
  const wwEventCards = document.querySelector("ww-event-cards");
  if (wwEventCards instanceof WwEventCards) {
    wwEventCards.game = game;
    wwEventCards.eventBus = eventBus;
  } else {
    console.error("ww event cards not found");
  }
  const wwNewsTicker = document.querySelector("ww-news-ticker");
  if (wwNewsTicker instanceof WwNewsTicker) {
    wwNewsTicker.game = game;
    wwNewsTicker.eventBus = eventBus;
  } else {
    console.error("ww news ticker not found");
  }
  // P3 Task 7's focus drawer (lane U1, controller ruling R15).
  const wwFocusPanel = document.querySelector("ww-focus-panel");
  if (wwFocusPanel instanceof WwFocusPanel) {
    wwFocusPanel.game = game;
    wwFocusPanel.eventBus = eventBus;
  } else {
    console.error("ww focus panel not found");
  }

  // World congress (spec §12): vote cards above the dials, the band under the satellite band.
  const congressCards = document.querySelector("congress-cards");
  if (congressCards instanceof CongressCards) {
    congressCards.game = game;
    congressCards.eventBus = eventBus;
  } else {
    console.error("congress cards not found");
  }
  const congressBand = document.querySelector("congress-band");
  if (congressBand instanceof CongressBand) {
    congressBand.game = game;
    congressBand.eventBus = eventBus;
  } else {
    console.error("congress band not found");
  }

  const satelliteTargetPicker = document.querySelector(
    "satellite-target-picker",
  ) as SatelliteTargetPicker;
  if (!(satelliteTargetPicker instanceof SatelliteTargetPicker)) {
    console.error("satellite target picker not found");
  }
  satelliteTargetPicker.game = game;
  satelliteTargetPicker.eventBus = eventBus;

  const inGamePromo = document.querySelector("in-game-promo") as InGamePromo;
  if (!(inGamePromo instanceof InGamePromo)) {
    console.error("in-game promo not found");
  }
  inGamePromo.game = game;

  const tutorialPanel = document.querySelector(
    "tutorial-panel",
  ) as TutorialPanel;
  if (!(tutorialPanel instanceof TutorialPanel)) {
    console.error("tutorial panel not found");
  }
  tutorialPanel.game = game;
  tutorialPanel.eventBus = eventBus;
  tutorialPanel.userSettings = userSettings;
  tutorialPanel.uiState = uiState;

  // World War 1936: the lines between regions and sea zones (spec §8.2).
  const wwScenario = game.worldWarScenario();
  // P2 (plan decision 25): the land war's map taps.
  let landController: WwLandController | null = null;
  if (wwScenario !== null) {
    view.setRegions(wwScenario.regionIds);
    // P2: the land war's tokens, battle markers and plan arrows (Task 7).
    const wwLand = game.wwLand();
    if (wwLand !== null) {
      // The engine's enemies (P0 wars past the preparation minute) for the
      // map's flags and previews; the cards read the same rule through
      // LandSides over the same LandFrontWorld adapter.
      view.setWwLand(
        wwLand,
        landSelectionOf(game),
        () => game.myPlayer()?.smallID() ?? 0,
        landWarInputsOf(game),
      );
      setLandSides(wwLand, landSidesOf(game));
      landController = new WwLandController(game, eventBus, transformHandler);
    }
    // P4 (plan Task 1 Step 22): the navy's and the air war's views (lane R draws them).
    const wwNavy = game.wwNavy();
    if (wwNavy !== null) view.setWwNavy(wwNavy);
    const wwAir = game.wwAir();
    if (wwAir !== null) view.setWwAir(wwAir);
  }

  const layers: Controller[] = [
    // First, so it hears a map tap before the warship controller, whose
    // touch fallback (the radial menu) skips a tap the land flow took.
    ...(landController === null ? [] : [landController]),
    new WarshipSelectionController(
      game,
      landController === null ? eventBus : new LandTapBus(eventBus, game),
      transformHandler,
      view,
    ),
    new BuildPreviewController(
      game,
      eventBus,
      uiState,
      transformHandler,
      view,
      userSettings,
    ),
    new HoverHighlightController(game, eventBus, transformHandler, view),
    new LiveStatsController(game, eventBus),
    new StructureHighlightController(eventBus, view),
    new ViewModeController(eventBus, view),
    new AttackingTroopsController(game, eventBus, userSettings, view),
    new SoundEffectController(game, eventBus),
    new AmbienceController(game, eventBus, transformHandler),
    new TouchHintController(game, userSettings),
    ...(mapLayerController ? [mapLayerController] : []),
    eventsDisplay,
    actionableEvents,
    attacksDisplay,
    chatDisplay,
    buildMenu,
    new MainRadialMenu(
      eventBus,
      game,
      transformHandler,
      emojiTable as EmojiTable,
      buildMenu,
      uiState,
      playerPanel,
    ),
    spawnTimer,
    immunityTimer,
    satelliteBand,
    satelliteTargetPicker,
    wwTopBand,
    wwDiplomacyPanel,
    ...(wwDials instanceof WwDials ? [wwDials] : []),
    ...(wwIndustryPanel instanceof WwIndustryPanel ? [wwIndustryPanel] : []),
    ...(wwResearchPanel instanceof WwResearchPanel ? [wwResearchPanel] : []),
    ...(wwArmyPanel instanceof WwArmyPanel ? [wwArmyPanel] : []),
    ...(wwArmyCard instanceof WwArmyCard ? [wwArmyCard] : []),
    ...(wwBattleCard instanceof WwBattleCard ? [wwBattleCard] : []),
    ...(wwPoliticsPanel instanceof WwPoliticsPanel ? [wwPoliticsPanel] : []),
    ...(wwEventCards instanceof WwEventCards ? [wwEventCards] : []),
    ...(wwNewsTicker instanceof WwNewsTicker ? [wwNewsTicker] : []),
    ...(wwFocusPanel instanceof WwFocusPanel ? [wwFocusPanel] : []),
    ...(congressCards instanceof CongressCards ? [congressCards] : []),
    ...(congressBand instanceof CongressBand ? [congressBand] : []),
    gameLeftSidebar,
    unitDisplay,
    gameRightSidebar,
    mapControls,
    controlPanel,
    ...(domesticDials instanceof DomesticDials ? [domesticDials] : []),
    domesticPanel,
    playerInfo,
    winModal,
    newLobbyPrompt,
    replayPanel,
    settingsModal,
    playerPanel,
    headsUpMessage,
    multiTabModal,
    inGamePromo,
    tutorialPanel,
    alertFrame,
    performanceOverlay,
  ];

  return new GameRenderer(
    transformHandler,
    uiState,
    layers,
    performanceOverlay,
  );
}

export class GameRenderer {
  private layerTickState = new Map<Controller, { lastTickAtMs: number }>();

  constructor(
    public transformHandler: TransformHandler,
    public uiState: UIState,
    private layers: Controller[],
    private performanceOverlay: PerformanceOverlay,
  ) {}

  initialize() {
    loadAllSprites().catch((err) =>
      console.warn("Failed to preload sprites:", err),
    );

    this.layers.forEach((l) => l.init?.());

    window.addEventListener("resize", () =>
      this.transformHandler.updateCanvasBoundingRect(),
    );

    //show whole map on startup
    this.transformHandler.centerAll(0.9);
  }

  tick() {
    const nowMs = performance.now();
    const shouldProfileTick = FrameProfiler.isEnabled();

    const tickLayerDurations: Record<string, number> = {};

    for (const layer of this.layers) {
      if (!layer.tick) {
        continue;
      }

      const state = this.layerTickState.get(layer) ?? {
        lastTickAtMs: -Infinity,
      };

      const intervalMs = layer.getTickIntervalMs?.() ?? 0;
      if (intervalMs > 0 && nowMs - state.lastTickAtMs < intervalMs) {
        this.layerTickState.set(layer, state);
        continue;
      }

      state.lastTickAtMs = nowMs;
      this.layerTickState.set(layer, state);

      const tickStart = shouldProfileTick ? performance.now() : 0;
      layer.tick();
      if (shouldProfileTick && tickStart !== 0) {
        const duration = performance.now() - tickStart;
        const label = layer.constructor?.name ?? "UnknownLayer";
        tickLayerDurations[label] = (tickLayerDurations[label] ?? 0) + duration;
      }
    }

    if (shouldProfileTick) {
      this.performanceOverlay.updateTickLayerMetrics(tickLayerDurations);
    }
  }
}
