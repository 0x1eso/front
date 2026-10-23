import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  PlayerProfile,
  PlayerType,
  Relation,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AllianceView } from "@openfront/engine-api/game/GameUpdates";
import { UnitLike } from "@openfront/engine-api/game/ReadViews";
import { ID_ARMY } from "@openfront/engine-api/ww1936/DepthTypes";
import { renderNumber, renderTroops } from "@openfront/engine-lib/Format";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import {
  ContextMenuEvent,
  DoBoatAttackEvent,
  DoBreakAllianceEvent,
  DoRequestAllianceEvent,
  DoTargetPlayerEvent,
  MouseMoveEvent,
  TouchEvent,
} from "../../InputHandler";
import { Platform } from "../../Platform";
import { themeProvider } from "../../theme/ThemeProvider";
import { TransformHandler } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { UserSettings } from "../../UserSettings";
import {
  formatKeyForDisplay,
  getTranslatedPlayerTeamLabel,
  renderDuration,
  translateText,
} from "../../Utils";
import { GameView, PlayerView, UnitView } from "../../view";
import {
  EMOJI_ICON_KIND,
  getFirstPlacePlayer,
  getPlayerIcons,
  IMAGE_ICON_KIND,
} from "../PlayerIcons";
import { WwStrikeFlowEvent } from "../ww1936/DepthEvents";
import { DepthMiscModel } from "../ww1936/DepthMiscModel";
import {
  buildingName,
  infraDots,
  populationText,
  regionCard,
  regionCatName,
  RESOURCE_ICONS,
  resourceName,
} from "../ww1936/EconomyModel";
import { occRegionLine, zoneLine } from "../ww1936/EndgameModel";
import { fogModelOf } from "../ww1936/FogModel";
import {
  landSidesOf,
  levelBoxes,
  levelDots,
  regionLandLines,
} from "../ww1936/LandModel";
import { fleetName, regionSeaAirLines } from "../ww1936/NavyModel";
import {
  countryName,
  isKoreanUi,
  regionInfo,
  shownName,
  today,
  TWO_TAP_MS,
  WW_BAND_PX,
} from "../ww1936/WorldWarModel";
import {
  OpenWwIndustryEvent,
  WwDrawerEvent,
  WwDrawerId,
} from "../ww1936/WwDrawer";
import { landTookTap } from "../ww1936/WwLandController";
import { ShowPlayerChatEvent } from "./ChatModal";
import { ShowPlayerEmojiMenuEvent } from "./EmojiTable";
import { ImmunityBarVisibleEvent } from "./ImmunityTimer";
import { CloseRadialMenuEvent } from "./RadialMenu";
import "./RelationSmiley";
import { SpawnBarVisibleEvent } from "./SpawnTimer";
const soldierIconAquarius = assetUrl("images/SoldierIconAquarius.svg");
const allianceIcon = assetUrl("images/AllianceIcon.svg");
const traitorIcon = assetUrl("images/TraitorIcon.svg");
const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const emojiIcon = assetUrl("images/EmojiIconWhite.svg");
const chatIcon = assetUrl("images/ChatIconWhite.svg");
const requestAllianceIcon = assetUrl("images/AllianceIconWhite.svg");
const breakAllianceIcon = assetUrl("images/TraitorIconWhite.svg");
const targetIcon = assetUrl("images/TargetIconWhite.svg");
const boatIcon = assetUrl("images/BoatIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samLauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const soldierIcon = assetUrl("images/SoldierIcon.svg");

function euclideanDistWorld(
  coord: { x: number; y: number },
  tileRef: TileRef,
  game: GameView,
): number {
  const x = game.x(tileRef);
  const y = game.y(tileRef);
  const dx = coord.x - x;
  const dy = coord.y - y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distSortUnitWorld(coord: { x: number; y: number }, game: GameView) {
  return (a: UnitLike, b: UnitLike) => {
    const distA = euclideanDistWorld(coord, a.tile(), game);
    const distB = euclideanDistWorld(coord, b.tile(), game);
    return distA - distB;
  };
}

@customElement("player-info-overlay")
export class PlayerInfoOverlay extends LitElement implements Controller {
  @property({ type: Object })
  public game!: GameView;

  @property({ type: Object })
  public eventBus!: EventBus;

  @property({ type: Object })
  public transform!: TransformHandler;

  @state()
  private player: PlayerView | null = null;
  /** The tile the panel was shown for; the action buttons act on it. */
  private tile: TileRef | null = null;
  /** What I can do to the hovered player, for its action buttons. */
  @state() private playerActions: {
    player: PlayerView;
    requestAlliance: boolean;
    breakAlliance: boolean;
    target: boolean;
    boat: boolean;
  } | null = null;
  private playerActionsFor: PlayerView | null = null;
  private playerActionsFetchedAt = 0;
  /** Bumped per fetch and per action I take; older answers are dropped. */
  private playerActionsVersion = 0;

  @state()
  private playerProfile: PlayerProfile | null = null;

  @state()
  private unit: UnitView | null = null;

  @state()
  private _isInfoVisible: boolean = false;

  @state()
  private spawnBarVisible = false;
  /** World War 1936 P6: the region whose [Scorch] was tapped once. */
  @state() private wwScorchArmed: number | null = null;
  /** World War 1936: the drawers open on the right. */
  @state() private wwDrawers: ReadonlySet<WwDrawerId> = new Set();
  @state()
  private immunityBarVisible = false;

  private _isActive = false;

  private userSettings = new UserSettings();

  // The shortcut buttons (chat and emoji on the left, player actions on the
  // right, and the panel width they need) only show on wide screens with a
  // mouse: narrower, the wider panel covers other HUD like the leaderboard,
  // and touch devices have no keyboard shortcut to show.
  private showShortcutButtons(): boolean {
    return window.innerWidth >= 1200 && !Platform.isTouch;
  }

  private get barOffset(): number {
    return (
      (this.spawnBarVisible ? 7 : 0) +
      (this.immunityBarVisible ? 7 : 0) +
      // World War 1936: below the top band.
      (this.game?.worldWarScenario() ? WW_BAND_PX : 0)
    );
  }

  private lastMouseUpdate = 0;

  init() {
    this.eventBus.on(MouseMoveEvent, (e: MouseMoveEvent) =>
      this.onMouseEvent(e),
    );
    this.eventBus.on(ContextMenuEvent, (e: ContextMenuEvent) =>
      this.maybeShow(e.x, e.y),
    );
    this.eventBus.on(TouchEvent, (e: TouchEvent) => {
      // World War 1936 P2: a tap the land flow took (an army's order, its
      // token) is the army card's, not this card's.
      if (landTookTap(this.game, e.x, e.y)) {
        this.hide();
        return;
      }
      this.maybeShow(e.x, e.y);
    });
    this.eventBus.on(CloseRadialMenuEvent, () => this.hide());
    this.eventBus.on(SpawnBarVisibleEvent, (e) => {
      this.spawnBarVisible = e.visible;
    });
    this.eventBus.on(ImmunityBarVisibleEvent, (e) => {
      this.immunityBarVisible = e.visible;
    });
    this.eventBus.on(DoRequestAllianceEvent, (e) =>
      this.markActionTaken(e.tile, "requestAlliance"),
    );
    this.eventBus.on(DoBreakAllianceEvent, (e) =>
      this.markActionTaken(e.tile, "breakAlliance"),
    );
    this.eventBus.on(DoTargetPlayerEvent, (e) =>
      this.markActionTaken(e.tile, "target"),
    );
    // World War 1936: with a drawer open on the right, the card keeps to
    // the left half so none of it (nor "Build here") hides under it.
    this.eventBus.on(WwDrawerEvent, (e) => {
      const next = new Set(this.wwDrawers);
      if (e.open) next.add(e.drawer);
      else next.delete(e.drawer);
      this.wwDrawers = next;
    });
    this._isActive = true;
  }

  // Once I act on the shown player (button or keybind), drop that button
  // right away: the game only sees the intent a turn later, so asking now
  // would still offer it. The next refresh, a second later, shows the real
  // state. A keybind (no tile) acts under the cursor, which is the shown
  // player unless the pointer is on the panel.
  private markActionTaken(
    tile: TileRef | undefined,
    action: "requestAlliance" | "breakAlliance" | "target",
  ) {
    const actions = this.playerActions;
    if (!actions || actions.player !== this.player) return;
    const onShownPlayer =
      tile === undefined
        ? this._isInfoVisible && !this.pointerOnPanel
        : tile === this.tile;
    if (!onShownPlayer) return;
    this.playerActionsVersion++;
    this.playerActionsFetchedAt = Date.now();
    this.playerActions = { ...actions, [action]: false };
  }

  // While the pointer is on the panel (moving to its emoji button), keep the
  // target: mouse moves still arrive from the window, and the tile under the
  // panel would otherwise retarget or hide it.
  private pointerOnPanel = false;
  private onPanelEnter = () => (this.pointerOnPanel = true);
  private onPanelLeave = () => (this.pointerOnPanel = false);

  private onMouseEvent(event: MouseMoveEvent) {
    if (this.pointerOnPanel) {
      return;
    }
    const now = Date.now();
    if (now - this.lastMouseUpdate < 100) {
      return;
    }
    this.lastMouseUpdate = now;
    // World War 1936: the pointer on an open drawer reads the drawer, not
    // the map under it (mouse moves come from the whole window).
    if (this.overWorldWarDrawer(event.x, event.y)) {
      if (this._isInfoVisible) this.hide();
      return;
    }
    this.maybeShow(event.x, event.y);
  }

  private overWorldWarDrawer(x: number, y: number): boolean {
    if (this.game.worldWarScenario() === null) return false;
    const el = document.elementFromPoint?.(x, y) ?? null;
    return (
      (el?.closest("[data-ww-drawer], [data-ww-diplomacy]") ?? null) !== null
    );
  }

  public hide() {
    this.pointerOnPanel = false;
    this.setVisible(false);
    this.unit = null;
    this.player = null;
  }

  public maybeShow(x: number, y: number) {
    this.hide();
    const worldCoord = this.transform.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(worldCoord.x, worldCoord.y)) {
      return;
    }

    const tile = this.game.ref(worldCoord.x, worldCoord.y);
    if (!tile) return;

    const owner = this.game.owner(tile);

    if (owner && owner.isPlayer()) {
      this.player = owner as PlayerView;
      this.tile = tile;
      this.player.profile().then((p) => {
        this.playerProfile = p;
      });
      this.refreshPlayerActions(this.player, tile);
      this.setVisible(true);
    } else if (!this.game.isLand(tile)) {
      const units = this.game
        .units(UnitType.Warship, UnitType.TradeShip, UnitType.TransportShip)
        .filter((u) => euclideanDistWorld(worldCoord, u.tile(), this.game) < 50)
        .sort(distSortUnitWorld(worldCoord, this.game));

      if (units.length > 0) {
        this.unit = units[0];
        this.setVisible(true);
      }
    }
  }

  // Asks what I can do to the hovered player when it changes, and at most
  // once a second while it stays (alliances and boat reach change in play).
  private refreshPlayerActions(player: PlayerView, tile: TileRef) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || player === myPlayer || !this.showShortcutButtons()) {
      return;
    }
    // No buttons while players spawn (the game would drop the actions), or
    // once the shown tile has changed hands (the answer would be about its
    // new owner).
    if (this.game.inSpawnPhase() || this.game.owner(tile) !== player) {
      this.playerActionsVersion++;
      this.playerActionsFor = null;
      this.playerActions = null;
      return;
    }
    const now = Date.now();
    if (
      this.playerActionsFor === player &&
      now - this.playerActionsFetchedAt < 1000
    ) {
      return;
    }
    this.playerActionsFor = player;
    this.playerActionsFetchedAt = now;
    const version = ++this.playerActionsVersion;
    myPlayer
      .actions(tile, [UnitType.TransportShip])
      .then((actions) => {
        if (version !== this.playerActionsVersion) return;
        const can = actions.interaction;
        this.playerActions = {
          player,
          requestAlliance: can?.canSendAllianceRequest ?? false,
          breakAlliance: can?.canBreakAlliance ?? false,
          target: can?.canTarget ?? false,
          boat: actions.buildableUnits.some(
            (u) => u.type === UnitType.TransportShip && u.canBuild !== false,
          ),
        };
      })
      .catch((error) => {
        console.warn("Failed to check player actions:", error);
      });
  }

  tick() {
    // Keep the action buttons current while the mouse rests on a player.
    if (this._isInfoVisible && this.player && this.tile !== null) {
      this.refreshPlayerActions(this.player, this.tile);
    }
    this.requestUpdate();
  }

  setVisible(visible: boolean) {
    this._isInfoVisible = visible;
    this.requestUpdate();
  }

  private getPlayerNameColor(isFriendly: boolean): string {
    if (isFriendly) return "text-green-500";
    return "text-white";
  }

  private getRelationSmiley(
    player: PlayerView,
    myPlayer: PlayerView | null | undefined,
  ): TemplateResult | string {
    if (!myPlayer || myPlayer === player || player.type() !== PlayerType.Nation)
      return "";
    const relation =
      this.playerProfile?.relations[myPlayer.smallID()] ?? Relation.Neutral;
    if (relation === Relation.Neutral) return "";
    return html`<relation-smiley .relation=${relation}></relation-smiley>`;
  }

  private getRelationName(relation: Relation): string {
    switch (relation) {
      case Relation.Hostile:
        return translateText("relation.hostile");
      case Relation.Distrustful:
        return translateText("relation.distrustful");
      case Relation.Neutral:
        return translateText("relation.neutral");
      case Relation.Friendly:
        return translateText("relation.friendly");
      default:
        return translateText("relation.default");
    }
  }

  private displayUnitCount(player: PlayerView, type: UnitType, icon: string) {
    return !this.game.config().isUnitDisabled(type)
      ? html`<div
          class="flex items-center justify-center gap-0.5 lg:gap-1 p-0.5 lg:p-1 border rounded-md border-gray-500 text-[10px] lg:text-xs w-9 lg:w-12 h-6 lg:h-7"
          translate="no"
        >
          <img
            src=${icon}
            class="w-3 h-3 lg:w-4 lg:h-4 object-contain shrink-0"
          />
          <span>${player.totalUnitLevels(type)}</span>
        </div>`
      : "";
  }

  private allianceExpirationText(alliance: AllianceView) {
    const { expiresAt } = alliance;
    const remainingTicks = expiresAt - this.game.ticks();
    let remainingSeconds = 0;
    if (remainingTicks > 0) {
      remainingSeconds = Math.max(0, Math.floor(remainingTicks / 10)); // 10 ticks per second
    }
    return renderDuration(remainingSeconds);
  }

  private renderPlayerNameIcons(icons: ReturnType<typeof getPlayerIcons>) {
    if (icons.length === 0) {
      return html``;
    }

    return html`<span class="flex items-center gap-1 shrink-0">
      ${icons.map((icon) =>
        icon.kind === EMOJI_ICON_KIND && icon.text
          ? html`<span class="h-4 w-4 font-mono text-sm shrink-0" translate="no"
              >${icon.text}</span
            >`
          : icon.kind === IMAGE_ICON_KIND && icon.src
            ? html`<img src=${icon.src} alt="" class="w-4 h-4 shrink-0" />`
            : html``,
      )}
    </span>`;
  }

  /**
   * Returns a CSS font-size value for the player name that scales down when
   * icon pressure + name length would overflow the available row width.
   * Uses calc(var(--text-lg) * scale) so the result always respects the
   * CSS variable; min is var(--text-lg)/2, max is var(--text-lg).
   */
  private getNameFontSize(params: {
    nameLength: number;
    iconCount: number;
    hasFlag: boolean;
    hasBetrayal: boolean;
    hasAlliance: boolean;
    typeAndTeamLen: number;
  }): { fontSize: string; isAllianceWrapped: boolean } {
    const {
      nameLength,
      iconCount,
      hasFlag,
      hasBetrayal,
      hasAlliance,
      typeAndTeamLen,
    } = params;

    // Approximate char-widths each element occupies at --text-lg.
    const DESKTOP_PRESSURE = {
      perIcon: 2.0,
      icon: 0.5,
      flag: 3.5,
      betrayal: 4.2,
      alliance: 6.7,
      allianceWrapped: 3.9,
    } as const;

    const MOBILE_PRESSURE = {
      perIcon: 2.2,
      icon: 0.5,
      flag: 4.2,
      betrayal: 4.6,
      alliance: 8.6,
      allianceWrapped: 4.8,
    } as const;

    const width = window.innerWidth;
    const isDesktop = width >= 1024;

    const PRESSURE = isDesktop ? DESKTOP_PRESSURE : MOBILE_PRESSURE;

    // Convert text-xs (12px) mono chars to name font mono chars:
    // Desktop (text-lg = 18px): ratio is 12/18 = 0.666 + gap(8px/10.8px = 0.74)
    // Mobile (text-sm = 14px): ratio is 12/14 = 0.857 + gap(4px/8.4px = 0.47)
    const typeAndTeamPressure = isDesktop
      ? typeAndTeamLen * (12 / 18) + 8 / 10.8
      : typeAndTeamLen * (12 / 14) + 4 / 8.4;

    const basePressure =
      typeAndTeamPressure +
      iconCount * PRESSURE.perIcon +
      (iconCount ? PRESSURE.icon : 0) +
      (hasFlag ? PRESSURE.flag : 0) +
      (hasBetrayal ? PRESSURE.betrayal : 0);

    let capacity: number;

    if (width < 640) {
      // Below 640px, overlay 100% viewport width.
      // space grows dynamically with width
      capacity = 28.1 + (Math.max(360, width) - 360) * 0.119;
    } else if (width < 768) {
      // 640px - 767px: sm:w-[500px], troop col w-28
      // space = 376px / 8.4px = 44.8 chars.
      capacity = 44.8;
    } else if (width < 1024) {
      // 768px - 1023px: sm:w-[500px],  troop col md:w-36
      // space = 344px / 8.4px = 41.0 chars.
      capacity = 41.0;
    } else {
      // >= 1024px: sm:w-[500px], font-size text-lg (18px, 10.8px/char).
      // space = 336px / 10.8px = 31.1 chars. The shortcut buttons, when
      // shown, bring their own panel width (34px left, 64px right), so they
      // don't change this.
      capacity = 31.1;
    }

    let isAllianceWrapped = false;
    let alliancePressure = hasAlliance ? PRESSURE.alliance : 0;
    let scale = (capacity - (basePressure + alliancePressure)) / nameLength;

    // If alliance active and font scale < 0.85
    // word-wrap alliance (icon & duration) to reduce width.
    if (hasAlliance && scale < 0.85) {
      isAllianceWrapped = true;
      alliancePressure = PRESSURE.allianceWrapped;
      scale = (capacity - (basePressure + alliancePressure)) / nameLength;
    }

    const textSize = isDesktop ? "lg" : "sm";
    const fontSize = `clamp(var(--text-${textSize}) * .65, var(--text-${textSize}) * ${scale.toFixed(3)}, var(--text-${textSize}))`;

    return { fontSize, isAllianceWrapped };
  }

  private renderShortcutButton(
    icon: string,
    title: string,
    keybind: string | undefined,
    onClick: () => void,
  ) {
    const key = keybind ? formatKeyForDisplay(keybind) : "";
    // Icon only, with the key as a corner badge, to keep the panel narrow.
    return html`<button
      class="relative flex items-center justify-center size-6.5 border rounded-md border-gray-500 hover:bg-white/10 cursor-pointer"
      title=${title}
      @click=${(e: MouseEvent) => {
        e.stopPropagation();
        onClick();
        this.hide();
      }}
    >
      <img src=${icon} alt="" class="size-5 object-contain" />
      ${key
        ? html`<span
            class="pointer-events-none absolute -bottom-1 -right-1 px-0.5 rounded-sm bg-gray-800 text-[9px] leading-tight font-mono text-gray-300"
            translate="no"
            >${key}</span
          >`
        : ""}
    </button>`;
  }

  private renderPlayerInfo(player: PlayerView) {
    const myPlayer = this.game.myPlayer();
    const isFriendly = myPlayer?.isFriendly(player);
    const isAllied = myPlayer?.isAlliedWith(player);
    const traitorTicks = player.getTraitorRemainingTicks();
    let allianceHtml: TemplateResult | null = null;
    let betrayalHtml: TemplateResult | null = null;
    const firstPlace = getFirstPlacePlayer(this.game);
    const playerIcons = getPlayerIcons({ game: this.game, player, firstPlace });
    const maxTroops = this.game.config().maxTroops(player);
    const attackingTroops = player
      .outgoingAttacks()
      .map((a) => a.troops)
      .reduce((a, b) => a + b, 0);
    const totalTroops = player.troops();
    const name = shownName(this.game, player);

    let playerType = "";
    switch (player.type()) {
      case PlayerType.Bot:
        playerType = translateText("player_type.bot");
        break;
      case PlayerType.Nation:
        playerType = translateText("player_type.nation");
        break;
      case PlayerType.Human:
        playerType = translateText("player_type.player");
        break;
    }
    const clanTag = this.game.teamClanTag(player.team());
    const playerTeam = getTranslatedPlayerTeamLabel(player.team(), clanTag);

    const typeLen = playerType.length;
    const hasTeam = playerTeam !== "" && player.type() !== PlayerType.Bot;
    const teamStr = clanTag ?? playerTeam;
    const teamLen = hasTeam ? teamStr.length + 2 : 0; // +2 for brackets

    // The column width is determined by the longest string in the flex-col
    const typeAndTeamLen = Math.max(typeLen, teamLen);

    const { fontSize, isAllianceWrapped } = this.getNameFontSize({
      nameLength: name.length,
      iconCount: playerIcons.length,
      hasFlag: !!player.cosmetics.flag,
      hasBetrayal: traitorTicks > 0,
      hasAlliance: isAllied ?? false,
      typeAndTeamLen,
    });

    if (isAllied) {
      const alliance = myPlayer
        ?.alliances()
        .find((alliance) => alliance.other === player.id());
      if (alliance !== undefined) {
        allianceHtml = isAllianceWrapped
          ? html`<div
              class="${traitorTicks === 0
                ? "ml-auto"
                : ""} flex flex-col items-center gap-0 text-xs font-bold leading-none shrink-0"
            >
              <img
                src=${allianceIcon}
                width="14"
                height="14"
                class="shrink-0"
              />
              <span class="text-[10px] leading-tight"
                >${this.allianceExpirationText(alliance)}</span
              >
            </div>`
          : html`<div
              class="${traitorTicks === 0
                ? "ml-auto"
                : ""} flex items-center mr-0 gap-1 text-xs font-bold leading-tight shrink-0"
            >
              <img
                src=${allianceIcon}
                width="18"
                height="18"
                class="shrink-0"
              />
              <span>${this.allianceExpirationText(alliance)}</span>
            </div>`;
      }
    }

    if (traitorTicks > 0) {
      betrayalHtml = html`<span class="flex ml-auto items-center shrink-0 "
        ><img src=${traitorIcon} alt="" class="w-4 h-4 shrink-0" />
        <span
          class="text-sm text-red-900 
          drop-shadow-[-.2px_-.2px_.8px_rgba(0,0,0,.7),.2px_.2px_.8px_rgba(0,0,0,.7)]"
        >
          ${renderDuration(Math.floor(traitorTicks / 10))} </span
        ><span></span
      ></span>`;
    }

    const keybinds = this.userSettings.keybinds(Platform.isMac);

    return html`
      <div class="flex items-start gap-1 lg:gap-2 p-1 lg:p-1.5">
        ${myPlayer && this.showShortcutButtons()
          ? html`<div class="flex flex-col gap-1 self-center shrink-0">
              ${player !== myPlayer
                ? this.renderShortcutButton(
                    chatIcon,
                    translateText("player_panel.chat"),
                    keybinds.quickChat,
                    () => this.eventBus.emit(new ShowPlayerChatEvent(player)),
                  )
                : ""}
              ${this.renderShortcutButton(
                emojiIcon,
                translateText("player_panel.emotes"),
                keybinds.emojiMenu,
                () => this.eventBus.emit(new ShowPlayerEmojiMenuEvent(player)),
              )}
            </div>`
          : ""}
        <!-- Left: Gold & Troop bar -->
        <div class="flex flex-col gap-1 shrink-0 w-28 md:w-36">
          <div class="flex items-center gap-1">
            ${
              // World War 1936 P4 (plan decision 30): no vanilla gold here.
              this.game.worldWarScenario() !== null
                ? ""
                : html`<div
                    class="flex items-center justify-center px-1 py-0.5 border rounded-md border-yellow-400 font-bold text-yellow-400 text-sm lg:gap-1"
                    translate="no"
                  >
                    <img src=${goldCoinIcon} width="13" height="13" />
                    <span class="px-0.5">${renderNumber(player.gold())}</span>
                  </div>`
            }
            <div
              class="flex flex-1 flex-col items-center justify-center text-xs font-bold ${attackingTroops >
              0
                ? "text-aquarius"
                : "text-white/40"} drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
              translate="no"
            >
              <span class="flex items-center gap-px leading-none text-xs"
                ><img
                  class="w-2.5 h-2.5 inline-block ${attackingTroops > 0
                    ? ""
                    : "brightness-0 invert opacity-40"}"
                  src=${attackingTroops > 0 ? soldierIconAquarius : soldierIcon}
                  alt=""
                  aria-hidden="true"
                />↑</span
              >
              <span class="tabular-nums leading-none text-sm mt-0.5"
                >${renderTroops(attackingTroops)}</span
              >
            </div>
          </div>
          <div class="w-28 md:w-36" translate="no">
            ${this.renderTroopBar(
              totalTroops,
              attackingTroops,
              maxTroops,
              this.wwTroopLabels(player, totalTroops, maxTroops),
            )}
          </div>
        </div>
        <!-- Right: Player identity + Units below -->
        <div
          class="flex flex-col justify-between self-stretch w-[100%] flex-grow-1"
        >
          <div
            class="flex items-center gap-1 lg:gap-2 font-bold text-sm lg:text-lg ${this.getPlayerNameColor(
              isFriendly ?? false,
            )}"
          >
            ${player.cosmetics.flag
              ? html`<img
                  class="h-6 object-contain shrink-0"
                  src=${assetUrl(player.cosmetics.flag!)}
                />`
              : html``}
            <div class="shrink min-w-0">
              <span
                class="font-mono inline-block leading-[1.2] wrap-anywhere"
                style="font-size: ${fontSize}"
                >${name}</span
              >
            </div>
            ${this.getRelationSmiley(player, myPlayer)}
            ${playerTeam !== "" && player.type() !== PlayerType.Bot
              ? html`<div
                  class="flex flex-col items-center leading-tight shrink-0"
                >
                  <span
                    class="text-gray-400 text-xs font-mono font-normal whitespace-nowrap"
                    >${playerType}</span
                  >
                  <span
                    class="text-xs font-mono font-normal text-gray-400 whitespace-nowrap"
                    >[<span
                      style="color: ${themeProvider
                        .current()
                        .teamColor(player.team()!)
                        .toHex()}"
                      >${clanTag ?? playerTeam}</span
                    >]</span
                  >
                </div>`
              : html`<span
                  class="text-gray-400 text-xs font-mono font-normal shrink-0 whitespace-nowrap"
                  >${playerType}</span
                >`}
            ${this.renderPlayerNameIcons(playerIcons)} ${betrayalHtml ?? ""}
            ${allianceHtml ?? ""}
          </div>
          <div class="flex gap-0.5 lg:gap-1 items-center mt-0.5">
            ${this.displayUnitCount(player, UnitType.City, cityIcon)}
            ${this.displayUnitCount(player, UnitType.Factory, factoryIcon)}
            ${this.displayUnitCount(player, UnitType.Port, portIcon)}
            ${this.displayUnitCount(
              player,
              UnitType.MissileSilo,
              missileSiloIcon,
            )}
            ${this.displayUnitCount(
              player,
              UnitType.SAMLauncher,
              samLauncherIcon,
            )}
            ${this.displayUnitCount(player, UnitType.Warship, warshipIcon)}
          </div>
        </div>
        ${myPlayer && this.showShortcutButtons()
          ? this.renderActionButtons(player, myPlayer, keybinds)
          : ""}
      </div>
    `;
  }

  // Right side: what I can do to the player, each with its keybind. Request
  // and break alliance share a slot, as only one applies at a time. The
  // column keeps its width when empty, so the panel doesn't shift.
  private renderActionButtons(
    player: PlayerView,
    myPlayer: PlayerView,
    keybinds: Record<string, string>,
  ) {
    const can =
      player !== myPlayer && this.playerActions?.player === player
        ? this.playerActions
        : null;
    const tile = this.tile ?? undefined;
    const buttons: TemplateResult[] = [];
    if (can?.requestAlliance) {
      buttons.push(
        this.renderShortcutButton(
          requestAllianceIcon,
          translateText("player_panel.send_alliance"),
          keybinds.requestAlliance,
          () =>
            this.eventBus.emit(new DoRequestAllianceEvent(tile, player.id())),
        ),
      );
    } else if (can?.breakAlliance) {
      buttons.push(
        this.renderShortcutButton(
          breakAllianceIcon,
          translateText("player_panel.break_alliance"),
          keybinds.breakAlliance,
          () => this.eventBus.emit(new DoBreakAllianceEvent(tile, player.id())),
        ),
      );
    }
    if (can?.target) {
      buttons.push(
        this.renderShortcutButton(
          targetIcon,
          translateText("player_panel.target"),
          keybinds.targetPlayer,
          () => this.eventBus.emit(new DoTargetPlayerEvent(tile, player.id())),
        ),
      );
    }
    if (can?.boat) {
      buttons.push(
        this.renderShortcutButton(
          boatIcon,
          translateText("user_setting.boat_attack"),
          keybinds.boatAttack,
          () => this.eventBus.emit(new DoBoatAttackEvent(tile)),
        ),
      );
    }
    return html`<div
      class="grid grid-rows-2 grid-flow-col auto-cols-max justify-end gap-1 self-center shrink-0 w-14"
    >
      ${buttons}
    </div>`;
  }

  /**
   * World War 1936 P6 (spec §8.9, pre-flight A18): another country's men
   * and their cap are army numbers — through the fog's army band ("?", a
   * range, or exact); null when the observer sees them exactly (its own
   * side, spectators, the game's end, other modes).
   */
  private wwTroopLabels(
    player: PlayerView,
    total: number,
    max: number,
  ): [string, string] | null {
    if (this.game.worldWarScenario() === null) return null;
    const fog = fogModelOf(this.game);
    const id = player.smallID();
    const men = fog.troopsLabel(id, total);
    const cap = fog.troopsLabel(id, max);
    return men === null || cap === null ? null : [men, cap];
  }

  private renderTroopBar(
    totalTroops: number,
    attackingTroops: number,
    maxTroops: number,
    fogged: [string, string] | null = null,
  ) {
    const base = Math.max(maxTroops, 1);
    // A fogged bar stays empty: its fill would show the ratio.
    const greenPercentRaw = fogged !== null ? 0 : (totalTroops / base) * 100;
    const orangePercentRaw =
      fogged !== null ? 0 : (attackingTroops / base) * 100;

    const greenPercent = Math.max(0, Math.min(100, greenPercentRaw));
    const orangePercent = Math.max(
      0,
      Math.min(100 - greenPercent, orangePercentRaw),
    );

    return html`
      <div
        class="w-full h-5 lg:h-6 border border-gray-600 rounded-md bg-gray-900/60 overflow-hidden relative"
      >
        <div class="relative h-full">
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-sky-700 transition-transform duration-200 ease-out"
            style="transform: scaleX(${greenPercent / 100});"
          ></div>
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-malibu-blue transition-transform duration-200 ease-out"
            style="transform: translateX(${greenPercent}%) scaleX(${orangePercent /
            100});"
          ></div>
        </div>
        <div
          class="absolute inset-0 flex items-center justify-between px-1.5 text-sm font-bold leading-none pointer-events-none"
          translate="no"
        >
          <span
            data-troops-total
            class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >${fogged?.[0] ?? renderTroops(totalTroops)}</span
          >
          <span
            data-troops-max
            class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >${fogged?.[1] ?? renderTroops(maxTroops)}</span
          >
        </div>
        <img
          src=${soldierIcon}
          alt=""
          aria-hidden="true"
          width="14"
          height="14"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none"
        />
      </div>
    `;
  }

  private renderUnitInfo(unit: UnitView) {
    const isAlly =
      (unit.owner() === this.game.myPlayer() ||
        this.game.myPlayer()?.isFriendly(unit.owner())) ??
      false;

    return html`
      <div class="p-2">
        <div class="font-bold mb-1 ${isAlly ? "text-green-500" : "text-white"}">
          ${unit.owner().displayName()}
        </div>
        <div class="mt-1">
          <div class="text-sm opacity-80">${unit.type()}</div>
          ${unit.hasHealth()
            ? html` <div class="text-sm">Health: ${unit.health()}</div> `
            : ""}
          ${unit.type() === UnitType.TransportShip
            ? html`
                <div class="text-sm">
                  Troops: ${renderTroops(unit.troops())}
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  /**
   * World War 1936 (spec §8.2): the region's name, points and owner — P3
   * (controller ruling R16): its legal owner when someone else holds it.
   */
  private renderRegionLine(tile: TileRef) {
    // The mode first: other games skip the language lookup (a DOM query).
    if (this.game.worldWarScenario() === null) return "";
    const info = regionInfo(this.game, tile, isKoreanUi());
    if (info === null) return "";
    return html`<div
        data-ww-region
        class="flex flex-wrap items-center gap-x-2 border-t border-white/10 px-3 py-1.5 text-sm"
      >
        <span class="font-semibold">${info.name}</span>
        <span class="text-amber-300"
          >${translateText("ww1936.region.vp", { vp: info.vp })}</span
        >
        ${info.legalOwner === null
          ? ""
          : html`<span class="text-white/60"
              >${translateText("ww1936.region.legal_owner", {
                country: countryName(info.legalOwner),
              })}</span
            >`}
      </div>
      ${this.renderRegionOccupation(tile)} ${this.renderRegionEconomy(tile)}
      ${this.renderRegionLand(tile)} ${this.renderRegionSeaAir(tile)}
      ${this.renderRegionDepth(tile)}`;
  }

  /**
   * World War 1936 P5 (spec §20.3): an administered region's resistance
   * (and its target), compliance, garrison, factory share and law; an
   * occupation zone's neutral line (the 38th parallel in Korea).
   */
  private renderRegionOccupation(tile: TileRef) {
    const s = this.game.worldWarScenario();
    if (s === null || (this.game.wwEndgame?.() ?? null) === null) return "";
    const region = s.regionAt(tile);
    // P6 (pre-flight A18): another side's garrison through the fog.
    const occ = occRegionLine(this.game, region, fogModelOf(this.game));
    const zone = occ === null ? zoneLine(this.game, region) : null;
    if (occ === null && zone === null) return "";
    return html`<div
      data-ww-region-occupation
      class="border-t border-white/10 px-3 py-1 text-xs text-white/80"
    >
      ${occ ?? zone}
    </div>`;
  }

  /**
   * World War 1936 P6 (spec §20.10): landmark, dam, facility, plant,
   * deposits and the status days; on my own region [Scorch] (two taps),
   * and [Launch rockets] from my rocket site.
   */
  private renderRegionDepth(tile: TileRef) {
    const s = this.game.worldWarScenario();
    if (s === null || (this.game.wwDepth?.() ?? null) === null) return "";
    const region = s.regionAt(tile);
    if (s.region(region) === undefined) return "";
    const m = new DepthMiscModel(this.game);
    const lines = m.regionLines(region);
    const act = m.regionActions(region);
    if (lines.length === 0 && !act.scorch) return "";
    const armed = this.wwScorchArmed === region;
    return html`<div
      data-ww-region-depth
      class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pb-1.5 text-xs text-white/80"
    >
      ${lines.map(
        (l) =>
          html`<span
            data-ww-region-line=${l.id}
            class=${l.tone === "warn" ? "text-red-300" : ""}
            >${l.text}</span
          >`,
      )}
      ${act.scorch && !Platform.isTouch
        ? html`<button
            type="button"
            data-ww-scorch
            ?disabled=${act.scorchBlock !== null}
            class="h-9 rounded-md bg-red-800 px-3 text-xs font-semibold text-white hover:bg-red-700"
            @click=${(e: Event) => {
              e.stopPropagation();
              if (!armed) {
                this.wwScorchArmed = region;
                setTimeout(() => {
                  if (this.wwScorchArmed === region) {
                    this.wwScorchArmed = null;
                  }
                }, TWO_TAP_MS);
                return;
              }
              this.wwScorchArmed = null;
              this.eventBus.emit(
                new SendWwOrderIntentEvent({ kind: "scorch", region }),
              );
            }}
          >
            ${translateText(
              armed
                ? "ww1936.region_status.scorch_confirm"
                : "ww1936.region_status.scorch",
            )}
          </button>`
        : ""}
      ${act.rocket && !Platform.isTouch
        ? html`<button
            type="button"
            data-ww-rocket
            ?disabled=${act.rocketBlock !== null}
            class="h-9 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-600"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.eventBus.emit(new WwStrikeFlowEvent("rocket", region));
            }}
          >
            ${translateText("ww1936.region_status.rocket_launch")}
          </button>`
        : ""}
    </div>`;
  }

  /**
   * World War 1936 P4 (spec §18.9): the region's naval base, air base,
   * anti-air, radar and coastal fort levels, its bomb damage, the fleets in
   * its port, its harbor zone and sea region, its land air zone.
   */
  private renderRegionSeaAir(tile: TileRef) {
    const s = this.game.worldWarScenario();
    const economy = this.game.wwEconomy?.() ?? null;
    if (s === null || economy === null) return "";
    const region = s.regionAt(tile);
    if (s.region(region) === undefined) return "";
    const navy = this.game.wwNavy?.() ?? null;
    const l = regionSeaAirLines(s, economy, navy, region);
    // P6 (spec §8.9, pre-flight A18): the holder's buildings and damage at
    // the observer's civil band (none at all when unknown), the fleets in
    // port only when the fog shows them, their ships at the naval band.
    const fog = fogModelOf(this.game);
    const seen = fog.regionView(region);
    const docked = [...(navy?.fleets.values() ?? [])]
      .filter((f) => f.docked === region)
      .sort((a, b) => a.id - b.id)
      .flatMap((f) => {
        const v = fog.fleetView(f.id);
        return v.visible ? [{ name: fleetName(f), ships: v.shipsLabel }] : [];
      });
    return html`<div
      data-ww-region-sea-air
      class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pb-1.5 text-xs text-white/80"
    >
      ${seen.buildings === "hidden"
        ? ""
        : l.levels.map(
            ([b, n]) =>
              html`<span data-ww-region-level=${b}
                >${translateText(`ww1936.navy.region_${b}`, {
                  n: seen.label(n),
                })}</span
              >`,
          )}
      ${l.bombed === null || seen.buildings === "hidden"
        ? ""
        : html`<span data-ww-region-bombed class="text-red-300"
            >${translateText("ww1936.navy.region_bomb_damage", {
              n: seen.label(l.bombed.stopped),
              pct: l.bombed.repairPct,
            })}</span
          >`}
      ${docked.map(
        (d) =>
          html`<span data-ww-region-docked
            >${translateText("ww1936.navy.region_docked", {
              fleet: d.name,
              n: d.ships,
            })}</span
          >`,
      )}
      ${l.harbor === null
        ? ""
        : html`<span data-ww-region-harbor
              >${translateText("ww1936.navy.region_port_sea", {
                sea: l.harbor,
              })}</span
            >
            <span data-ww-region-sea-sr
              >${translateText("ww1936.navy.region_sea_zone", {
                sr: l.seaSr,
              })}</span
            >`}
      ${l.airZone === ""
        ? ""
        : html`<span data-ww-region-air-zone
            >${translateText("ww1936.navy.region_air_zone", {
              zone: l.airZone,
            })}</span
          >`}
    </div>`;
  }

  /**
   * World War 1936 P2 (spec §15.7): the region's terrain and weather, its
   * fort and railway levels, my side's supply there, its river crossings,
   * the divisions there (mine and the others'), a red line when encircled.
   */
  private renderRegionLand(tile: TileRef) {
    const s = this.game.worldWarScenario();
    const view = this.game.wwLand?.() ?? null;
    const economy = this.game.wwEconomy?.() ?? null;
    if (s === null || view === null || economy === null) return "";
    const region = s.regionAt(tile);
    if (s.region(region) === undefined) return "";
    const me = this.game.myPlayer()?.smallID() ?? 0;
    const sides = landSidesOf(this.game);
    const l = regionLandLines(
      view,
      economy,
      me,
      region,
      today(this.game),
      sides,
    );
    // P6 (spec §8.9, pre-flight A18): forts and railways at the civil
    // band, the other side's divisions at the holder's army band (an
    // unknown owner in my own region: my enemies' lowest).
    const fog = fogModelOf(this.game);
    const seen = fog.regionView(region);
    const holder = view.controller[region] ?? 0;
    const theirs = fog.countLabel(
      sides.sameSide(me, holder) ? 0 : holder,
      l.theirs,
      ID_ARMY,
    );
    return html`<div
      data-ww-region-land
      class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pb-1.5 text-xs text-white/80"
    >
      <span
        >${translateText("ww1936.land.region_terrain")}:
        ${translateText(`ww1936.terrain.${l.land}`)}</span
      >
      <span
        >${translateText("ww1936.land.region_weather")}:
        ${translateText(`ww1936.weather.${l.weather}`)}</span
      >
      <span data-ww-region-fort=${seen.buildings === "exact" ? l.fort : "?"}
        >${translateText("ww1936.land.region_fort")}
        <span class="tracking-tighter text-amber-300"
          >${seen.buildings === "exact"
            ? levelBoxes(l.fort)
            : seen.label(l.fort)}</span
        ></span
      >
      <span data-ww-region-rail=${seen.buildings === "exact" ? l.rail : "?"}
        >${translateText("ww1936.land.region_rail")}
        <span class="tracking-tighter text-amber-300"
          >${seen.buildings === "exact"
            ? levelDots(l.rail)
            : seen.label(l.rail)}</span
        ></span
      >
      ${l.supplyMilli >= 0
        ? html`<span data-ww-region-supply
            >${translateText("ww1936.land.region_supply", {
              have: Math.round(l.supplyMilli / 1000),
              use: Math.round(Math.max(0, l.useMilli) / 1000),
            })}</span
          >`
        : ""}
      ${l.riverEdges > 0
        ? html`<span
            >${translateText("ww1936.land.region_rivers", {
              n: l.riverEdges,
            })}</span
          >`
        : ""}
      <span data-ww-region-divisions
        >${translateText("ww1936.land.region_divisions", {
          ours: l.ours,
          theirs,
        })}</span
      >
      ${l.encircled
        ? html`<span
            data-ww-region-encircled
            class="w-full rounded bg-red-700/80 px-1 font-semibold text-white"
            >${translateText("ww1936.land.region_encircled")}</span
          >`
        : ""}
    </div>`;
  }

  /**
   * World War 1936 P1 (spec §13.5): the region's category, buildings and
   * slots, infrastructure, population, deposits, whether it is occupied,
   * and in my own region "Build here" (the industry drawer, this region).
   */
  private renderRegionEconomy(tile: TileRef) {
    const card = regionCard(this.game, tile);
    if (card === null) return "";
    // P6 (spec §8.9, pre-flight A18): the holder's buildings at the
    // observer's civil band; the slots, people and deposits are the map's.
    const seen = fogModelOf(this.game).regionView(card.id);
    return html`<div
      data-ww-region-economy
      class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pb-1.5 text-xs text-white/80"
    >
      <span>${regionCatName(card.cat)}</span>
      <span class="tabular-nums"
        >${translateText("ww1936.econ.region_buildings", {
          civ: seen.label(card.civ),
          mil: seen.label(card.mil),
          dock: seen.label(card.dock),
          slots: card.slots,
        })}</span
      >
      <span
        >${buildingName("infra")}
        <span class="tracking-tighter text-amber-300"
          >${seen.buildings === "exact"
            ? infraDots(card.infra)
            : seen.label(card.infra)}</span
        ></span
      >
      <span
        >${translateText("ww1936.econ.population", {
          n: populationText(card.pop),
        })}</span
      >
      ${card.res.map(
        (r) =>
          html`<span data-ww-region-res=${r.id}
            >${RESOURCE_ICONS[r.id]} ${resourceName(r.id)} ${r.amount}</span
          >`,
      )}
      ${card.occupied
        ? html`<span class="text-red-300"
            >${translateText("ww1936.econ.occupied_note")}</span
          >`
        : ""}
      ${card.mine && !Platform.isTouch
        ? // On touch the card shows under the radial menu's full-screen
          // overlay, which takes the tap: the menu carries "Build here"
          // there (RadialMenuElements.wwBuildHereElement), as vanilla
          // keeps the card's action buttons off touch screens.
          html`<button
            type="button"
            data-ww-build-here
            class="h-9 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-600"
            @click=${() =>
              this.eventBus.emit(
                new OpenWwIndustryEvent("construction", card.id),
              )}
          >
            ${translateText("ww1936.econ.build_here")}
          </button>`
        : ""}
    </div>`;
  }

  render() {
    if (!this._isActive) {
      return html``;
    }

    const containerClasses = this._isInfoVisible
      ? "opacity-100 visible"
      : "opacity-0 invisible pointer-events-none";

    const leftHalf = this.wwDrawers.size > 0;
    return html`
      <div
        data-info-card-left=${String(leftHalf)}
        class="fixed top-0 left-0 ${leftHalf
          ? "right-auto"
          : "right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"} z-[1001]"
        style="margin-top: ${this.barOffset}px;${leftHalf
          ? ` width: min(${this.showShortcutButtons() ? 598 : 500}px, calc(50vw - 8px));`
          : ""}"
        @click=${() => this.hide()}
        @contextmenu=${(e: MouseEvent) => e.preventDefault()}
      >
        <div
          class="bg-gray-800/92 backdrop-blur-sm shadow-xs min-[1200px]:rounded-lg sm:rounded-b-lg shadow-lg text-white text-lg lg:text-base w-full ${leftHalf
            ? ""
            : this.showShortcutButtons()
              ? "sm:w-[598px]"
              : "sm:w-[500px]"} overflow-hidden ${containerClasses}"
          @mouseenter=${this.onPanelEnter}
          @mouseleave=${this.onPanelLeave}
        >
          ${this.player ? this.renderPlayerInfo(this.player) : ""}
          ${this.player && this.tile !== null
            ? this.renderRegionLine(this.tile)
            : ""}
          ${this.unit ? this.renderUnitInfo(this.unit) : ""}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this; // Disable shadow DOM to allow Tailwind styles
  }
}
