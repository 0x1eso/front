import { GameMode, type Team } from "@openfront/engine-api/game/GameTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import type { EventBus } from "@openfront/shared/EventBus";
import { Colord } from "colord";
import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { Controller } from "../../Controller";
import { themeProvider } from "../../theme/ThemeProvider";
import { getTranslatedPlayerTeamLabel, translateText } from "../../Utils";
import type { GameView } from "../../view";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import { peaceUiOf } from "../ww1936/PeaceModel";
import { WwDrawerEvent, type WwDrawerId } from "../ww1936/WwDrawer";
import { ImmunityBarVisibleEvent } from "./ImmunityTimer";
import "./PlayerStats";
import type { PlayerStats } from "./PlayerStats";
import { SpawnBarVisibleEvent } from "./SpawnTimer";
import "./TeamStats";
import type { TeamStats } from "./TeamStats";
const playerStatsRegularIcon = assetUrl(
  "images/LeaderboardIconRegularWhite.svg",
);
const playerStatsSolidIcon = assetUrl("images/LeaderboardIconSolidWhite.svg");
const teamStatsRegularIcon = assetUrl("images/TeamIconRegularWhite.svg");
const teamStatsSolidIcon = assetUrl("images/TeamIconSolidWhite.svg");

/** Space kept between the leaderboard and an open World War drawer, in CSS px. */
const WW_DRAWER_GAP = 8;

@customElement("game-left-sidebar")
export class GameLeftSidebar extends LitElement implements Controller {
  @state()
  private isPlayerStatsShown = false;
  @state()
  private isTeamStatsShown = false;
  @state()
  private isVisible = false;
  @state()
  private isPlayerTeamLabelVisible = false;
  @state()
  private playerTeam: Team | null = null;
  @state()
  private spawnBarVisible = false;
  @state()
  private immunityBarVisible = false;
  /**
   * World War 1936: the expanded leaderboard folds while a drawer that it
   * would reach under is open (a narrow phone: at 667 px it runs to x 379,
   * the drawer starts at the screen's middle). Its button brings it back.
   */
  @state()
  private yieldToWwDrawer = false;
  /** The World War drawers open now. */
  private readonly wwDrawers = new Set<WwDrawerId>();
  /**
   * World War 1936 P5 (spec §20.9): on a phone the peace conference's map
   * mode wants the whole map — the expanded leaderboard folds while it is
   * on and comes back after. Its button still brings it back.
   */
  @state()
  private yieldToPeaceMap = false;
  /** Brought back by its button during this map mode. */
  private peaceMapReopened = false;

  private playerColor: Colord = new Colord("#FFFFFF");
  @property({ attribute: false }) public game: GameView | null = null;
  @property({ attribute: false }) public eventBus: EventBus | null = null;
  @query("player-stats") private playerStats?: PlayerStats;
  @query("team-stats") private teamStats?: TeamStats;
  private showPlayerStatsAfterSpawn = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.isVisible = true;
    this.eventBus?.on(SpawnBarVisibleEvent, (e) => {
      this.spawnBarVisible = e.visible;
    });
    this.eventBus?.on(ImmunityBarVisibleEvent, (e) => {
      this.immunityBarVisible = e.visible;
    });
    this.eventBus?.on(WwDrawerEvent, (e) => {
      if (e.open) this.wwDrawers.add(e.drawer);
      else this.wwDrawers.delete(e.drawer);
      // Once the drawer has drawn (and after a switch between drawers, which
      // closes one as the other opens, so the board doesn't flicker). The
      // conference map mode closes the drawers as it opens on a phone.
      requestAnimationFrame(() => {
        this.fitWwDrawer();
        this.fitPeaceMap();
      });
    });
    if (this.isTeamGame) {
      this.isPlayerTeamLabelVisible = true;
    }
    // One layout at every width (spec §14a): the leaderboard opens after spawn.
    this.showPlayerStatsAfterSpawn = true;
  }

  getTickIntervalMs() {
    return 1000;
  }

  tick() {
    if (this.game === null) return;

    const team = this.game.myPlayer()?.team();
    if (this.playerTeam === null && team !== null && team !== undefined) {
      this.playerTeam = team;
      this.playerColor = themeProvider.current().teamColor(team);
    }

    if (this.showPlayerStatsAfterSpawn && !this.game.inSpawnPhase()) {
      this.showPlayerStatsAfterSpawn = false;
      this.isPlayerStatsShown = true;
    }

    if (!this.game.inSpawnPhase() && this.isPlayerTeamLabelVisible) {
      this.isPlayerTeamLabelVisible = false;
    }

    this.fitPeaceMap();
    this.playerStats?.refresh();
    this.teamStats?.refresh();
  }

  /** Fold the leaderboard while the conference map mode is on, on a phone. */
  private fitPeaceMap(): void {
    const game = this.game;
    const on =
      game !== null &&
      (game.worldWarScenario?.() ?? null) !== null &&
      window.innerHeight <= COMPACT_MAX_HEIGHT &&
      peaceUiOf(game).map;
    if (!on) this.peaceMapReopened = false;
    const fold = on && !this.peaceMapReopened;
    if (fold !== this.yieldToPeaceMap) this.yieldToPeaceMap = fold;
  }

  private get barOffset(): number {
    return (this.spawnBarVisible ? 7 : 0) + (this.immunityBarVisible ? 7 : 0);
  }

  /** Fold the leaderboard while it would reach under an open World War drawer. */
  private fitWwDrawer(): void {
    if (this.wwDrawers.size === 0) {
      this.yieldToWwDrawer = false;
      return;
    }
    if (this.yieldToWwDrawer || !this.isPlayerStatsShown) return;
    const board = this.querySelector("aside")?.getBoundingClientRect();
    const drawer = document
      .querySelector("[data-ww-drawer], [data-ww-diplomacy]")
      ?.getBoundingClientRect();
    if (!board || !drawer || board.width === 0 || drawer.width === 0) return;
    if (board.right + WW_DRAWER_GAP > drawer.left) this.yieldToWwDrawer = true;
  }

  private togglePlayerStats(): void {
    // Folded for the conference map: the button brings it back over it.
    if (this.yieldToPeaceMap) {
      this.peaceMapReopened = true;
      this.yieldToPeaceMap = false;
      this.isPlayerStatsShown = true;
      return;
    }
    // Folded for a World War drawer: the button brings it back over it.
    if (this.yieldToWwDrawer) {
      this.yieldToWwDrawer = false;
      this.isPlayerStatsShown = true;
      return;
    }
    this.isPlayerStatsShown = !this.isPlayerStatsShown;
  }

  /** The player leaderboard shows (not folded for a World War drawer). */
  private get playerStatsVisible(): boolean {
    return (
      this.isPlayerStatsShown && !this.yieldToWwDrawer && !this.yieldToPeaceMap
    );
  }

  private toggleTeamStats(): void {
    this.isTeamStatsShown = !this.isTeamStatsShown;
  }

  private get isTeamGame(): boolean {
    return this.game?.config().gameConfig().gameMode === GameMode.Team;
  }

  render() {
    return html`
      <aside
        class=${`fixed top-0 left-0 z-900 flex flex-col max-h-[calc(100vh-80px)] overflow-y-auto p-2 bg-gray-800/92 backdrop-blur-sm shadow-xs rounded-br-lg transition-all duration-300 ease-out transform ${
          this.isVisible ? "translate-x-0" : "hidden"
        }`}
        style="margin-top: ${this.barOffset}px;"
      >
        <div class="flex items-center gap-4 xl:gap-6 text-white">
          <div
            class="cursor-pointer p-0.5 bg-gray-700/50 hover:bg-gray-600 border rounded-md border-slate-500 transition-colors"
            @click=${this.togglePlayerStats}
            role="button"
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " " || e.code === "Space") {
                e.preventDefault();
                this.togglePlayerStats();
              }
            }}
          >
            <img
              src=${this.playerStatsVisible
                ? playerStatsSolidIcon
                : playerStatsRegularIcon}
              alt=${translateText("help_modal.icon_alt_player_leaderboard") ||
              "Player Leaderboard Icon"}
              width="20"
              height="20"
            />
          </div>
          ${this.isTeamGame
            ? html`
                <div
                  class="cursor-pointer p-0.5 bg-gray-700/50 hover:bg-gray-600 border rounded-md border-slate-500 transition-colors"
                  @click=${this.toggleTeamStats}
                  role="button"
                  tabindex="0"
                  @keydown=${(e: KeyboardEvent) => {
                    if (
                      e.key === "Enter" ||
                      e.key === " " ||
                      e.code === "Space"
                    ) {
                      e.preventDefault();
                      this.toggleTeamStats();
                    }
                  }}
                >
                  <img
                    src=${this.isTeamStatsShown
                      ? teamStatsSolidIcon
                      : teamStatsRegularIcon}
                    alt=${translateText(
                      "help_modal.icon_alt_team_leaderboard",
                    ) || "Team Leaderboard Icon"}
                    width="20"
                    height="20"
                  />
                </div>
              `
            : null}
          ${this.playerStatsVisible || this.isTeamStatsShown
            ? html`<span
                class="ml-auto text-[10px] text-slate-500 select-all leading-none self-start"
                title=${translateText("help_modal.game_id_tooltip")}
                >${this.game?.gameID() ?? ""}</span
              >`
            : null}
        </div>
        ${this.isPlayerTeamLabelVisible
          ? html`
              <div
                class="flex items-center w-full text-white mt-2"
                @contextmenu=${(e: Event) => e.preventDefault()}
              >
                ${translateText("help_modal.ui_your_team")}
                <span
                  style="--color: ${this.playerColor.toRgbString()}"
                  class="text-(--color)"
                >
                  &nbsp;${getTranslatedPlayerTeamLabel(
                    this.playerTeam,
                    this.game?.teamClanTag(this.playerTeam),
                  )}
                  &#10687;
                </span>
              </div>
            `
          : null}
        <div class="flex flex-col gap-2 min-w-0 w-full">
          <player-stats
            class=${this.playerStatsVisible ? "block min-w-0" : "hidden"}
            .game=${this.game}
            .domesticMode=${this.game?.config().gameConfig().domesticMode ===
            true}
            .strategicWeapons=${this.game?.config().gameConfig()
              .strategicWeapons === true}
            .congress=${this.game?.config().congress() === true}
            .eventBus=${this.eventBus}
            .visible=${this.playerStatsVisible}
          ></player-stats>
          <team-stats
            class=${this.isTeamStatsShown && this.isTeamGame
              ? "block min-w-0"
              : "hidden"}
            .game=${this.game}
            .domesticMode=${this.game?.config().gameConfig().domesticMode ===
            true}
            .strategicWeapons=${this.game?.config().gameConfig()
              .strategicWeapons === true}
            .visible=${this.isTeamStatsShown && this.isTeamGame}
          ></team-stats>
        </div>
        <slot></slot>
      </aside>
    `;
  }
}
