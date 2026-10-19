import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  StockpiledNuke,
  StrategicData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { requiredTech } from "@openfront/engine-lib/domestic/Locks";
import { renderNumber } from "@openfront/engine-lib/Format";
import {
  factoryWithFreeLine,
  isStockpiledNuke,
  NUKE_PRODUCTION_TICKS,
} from "@openfront/engine-lib/strategic/Strategic";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { MouseDownEvent, ToggleStructureEvent } from "../../InputHandler";
import { Platform } from "../../Platform";
import { SendProduceNukeIntentEvent } from "../../Transport";
import { UIState } from "../../UIState";
import { UserSettings } from "../../UserSettings";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import {
  bannedBadge,
  bannedReason,
  productionBanned,
} from "../congress/BanLabels";
import { lockedReason } from "../domestic/LockReason";
import {
  adminOfficeIcon,
  airportIcon,
  atomBombIcon,
  bomberIcon,
  cityIcon,
  coastalBarrageIcon,
  coastalBatteryIcon,
  conventionalMissileIcon,
  defensePostIcon,
  factoryIcon,
  goldCoinIcon,
  hydrogenBombIcon,
  mirvIcon,
  missileSiloIcon,
  paradropIcon,
  portIcon,
  researchInstituteIcon,
  samLauncherIcon,
  satelliteIcon,
  warshipIcon,
} from "../HotbarIcons";
import { TutorialHighlight, TutorialHighlightEvent } from "../Tutorial";

export interface HotbarItem {
  type: PlayerBuildableUnitType;
  icon: string;
  /** `unit_type.<key>` and `build_menu.desc.<key>`; also the icon's alt. */
  key: string;
  /** UserSettings keybind action, or "" for units without a build key. */
  keybind: string;
  countable: boolean;
}

/** The build bar, left to right. Disabled units (domestic buildings outside
 *  domestic mode, lobby-disabled units) are left out. */
export const HOTBAR: readonly HotbarItem[] = [
  {
    type: UnitType.City,
    icon: cityIcon,
    key: "city",
    keybind: "buildCity",
    countable: true,
  },
  {
    type: UnitType.Factory,
    icon: factoryIcon,
    key: "factory",
    keybind: "buildFactory",
    countable: true,
  },
  {
    type: UnitType.Port,
    icon: portIcon,
    key: "port",
    keybind: "buildPort",
    countable: true,
  },
  {
    type: UnitType.DefensePost,
    icon: defensePostIcon,
    key: "defense_post",
    keybind: "buildDefensePost",
    countable: true,
  },
  {
    type: UnitType.MissileSilo,
    icon: missileSiloIcon,
    key: "missile_silo",
    keybind: "buildMissileSilo",
    countable: true,
  },
  {
    type: UnitType.SAMLauncher,
    icon: samLauncherIcon,
    key: "sam_launcher",
    keybind: "buildSamLauncher",
    countable: true,
  },
  {
    type: UnitType.Warship,
    icon: warshipIcon,
    key: "warship",
    keybind: "buildWarship",
    countable: true,
  },
  {
    type: UnitType.ResearchInstitute,
    icon: researchInstituteIcon,
    key: "research_institute",
    keybind: "",
    countable: true,
  },
  {
    type: UnitType.AdminOffice,
    icon: adminOfficeIcon,
    key: "admin_office",
    keybind: "",
    countable: true,
  },
  {
    type: UnitType.CoastalBattery,
    icon: coastalBatteryIcon,
    key: "coastal_battery",
    keybind: "",
    countable: true,
  },
  {
    type: UnitType.Airport,
    icon: airportIcon,
    key: "airport",
    keybind: "",
    countable: true,
  },
  {
    type: UnitType.AtomBomb,
    icon: atomBombIcon,
    key: "atom_bomb",
    keybind: "buildAtomBomb",
    countable: false,
  },
  {
    type: UnitType.HydrogenBomb,
    icon: hydrogenBombIcon,
    key: "hydrogen_bomb",
    keybind: "buildHydrogenBomb",
    countable: false,
  },
  {
    type: UnitType.MIRV,
    icon: mirvIcon,
    key: "mirv",
    keybind: "buildMIRV",
    countable: false,
  },
  {
    type: UnitType.ConventionalMissile,
    icon: conventionalMissileIcon,
    key: "conventional_missile",
    keybind: "",
    countable: false,
  },
  {
    type: UnitType.Satellite,
    icon: satelliteIcon,
    key: "satellite",
    keybind: "",
    countable: false,
  },
  {
    type: UnitType.CoastalBarrage,
    icon: coastalBarrageIcon,
    key: "coastal_barrage",
    keybind: "",
    countable: false,
  },
  {
    type: UnitType.Bomber,
    icon: bomberIcon,
    key: "bomber",
    keybind: "",
    countable: false,
  },
  // Paradrop (spec 14c): aimed like a bomb; confirming sends the paradrop
  // intent, not a build.
  {
    type: UnitType.TransportPlane,
    icon: paradropIcon,
    key: "paradrop",
    keybind: "",
    countable: false,
  },
];

/** Row 2 of the build bar (spec §14d); everything else in HOTBAR is row 1. */
const ATTACK_TYPES: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.ConventionalMissile,
  UnitType.Satellite,
  UnitType.CoastalBarrage,
  UnitType.Bomber,
  UnitType.TransportPlane,
]);

/** Largest a build-bar button grows; rows shrink the buttons, never wrap. */
const BUTTON_MAX = "2.5rem";

const NUKES: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
]);

const TUTORIAL_UNITS: Partial<
  Record<TutorialHighlight, PlayerBuildableUnitType>
> = {
  city: UnitType.City,
  port: UnitType.Port,
  defense_post: UnitType.DefensePost,
  factory: UnitType.Factory,
  warship: UnitType.Warship,
  silo: UnitType.MissileSilo,
  atom: UnitType.AtomBomb,
  hydrogen: UnitType.HydrogenBomb,
  mirv: UnitType.MIRV,
  sam: UnitType.SAMLauncher,
};

/** Existing structures to highlight on the map while a card is open. */
function highlightTypes(
  type: PlayerBuildableUnitType,
): PlayerBuildableUnitType[] {
  switch (type) {
    case UnitType.AtomBomb:
    case UnitType.HydrogenBomb:
      return [UnitType.MissileSilo, UnitType.SAMLauncher];
    case UnitType.CoastalBarrage:
      return [UnitType.MissileSilo, UnitType.CoastalBattery];
    case UnitType.Bomber:
      return [UnitType.Airport, UnitType.SAMLauncher];
    case UnitType.TransportPlane:
      return [UnitType.Airport];
    case UnitType.ConventionalMissile:
      return [UnitType.MissileSilo, UnitType.SAMLauncher];
    case UnitType.Satellite:
      return [UnitType.MissileSilo];
    case UnitType.Warship:
      return [UnitType.Port];
    default:
      return [type];
  }
}

/**
 * The build bar (spec §14a). Tap once for the unit's card (description,
 * cost, why it can't be built), tap again to build, tap a third time to
 * stop. Nothing is shown on hover, so it works the same with a finger.
 * The build keys (InputHandler) still set `uiState.ghostStructure`
 * directly; the bar shows that unit pressed and closes any open card.
 */
@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private hotkeys: Record<string, string> = {};
  private counts = new Map<PlayerBuildableUnitType, number>();
  /** The unit whose card is open (after the first tap), or null. */
  private infoUnit: PlayerBuildableUnitType | null = null;
  private tutorialHighlight: PlayerBuildableUnitType | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    this.hotkeys = new UserSettings().keybinds(Platform.isMac);
    this.eventBus.on(TutorialHighlightEvent, (e) => {
      this.tutorialHighlight = (e.target && TUTORIAL_UNITS[e.target]) ?? null;
      this.requestUpdate();
    });
    // Pressing the map closes the card, like tapping outside a popover.
    this.eventBus.on(MouseDownEvent, () => {
      if (this.infoUnit === null) return;
      this.closeInfo();
      this.requestUpdate();
    });
    this.requestUpdate();
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    player
      .buildables(undefined, [...BuildMenus.types, UnitType.TransportPlane])
      .then((buildables) => {
        this.playerBuildables = buildables;
      });
    for (const item of HOTBAR) {
      if (item.countable) {
        this.counts.set(item.type, player.totalUnitLevels(item.type));
      }
    }
    // A build key entered build mode while a card was open: the card's
    // "tap again" no longer applies.
    if (
      this.infoUnit !== null &&
      (this.uiState?.ghostStructure ?? null) !== null
    ) {
      this.closeInfo();
    }
    this.requestUpdate();
  }

  private cost(type: UnitType): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === type) {
        return bu.cost;
      }
    }
    return 0n;
  }

  /** Domestic mode: the unit still needs a tech (never true otherwise). */
  private locked(type: UnitType): boolean {
    return (
      this.playerBuildables?.find((bu) => bu.type === type)?.locked === true
    );
  }

  /** World congress: a resolution in force forbids building or buying it. */
  private banned(type: UnitType): boolean {
    return (
      this.playerBuildables?.find((bu) => bu.type === type)?.banned === true
    );
  }

  /** Strategic weapons: my stockpile, lines and satellite; null with the option off. */
  private strategic(): StrategicData | null {
    return this.game?.myPlayer()?.strategicData() ?? null;
  }

  /** The stockpile behind a nuke's button, or null (not a nuke, or the option is off). */
  private stockOf(type: PlayerBuildableUnitType): number | null {
    const s = this.strategic();
    return s !== null && isStockpiledNuke(type) ? s.stock[type] : null;
  }

  /** Why a nuke can't be started at a factory now, or null if it can. */
  private produceReason(type: StockpiledNuke): string | null {
    if (this.locked(type)) return lockedReason(type);
    const me = this.game?.myPlayer();
    if (me && productionBanned(this.game.congressData(), me.smallID(), type)) {
      return bannedReason();
    }
    const player = this.game?.myPlayer();
    const s = this.strategic();
    if (!player || s === null) return null;
    const factories = player
      .units(UnitType.Factory)
      .filter((f) => !f.isUnderConstruction())
      .map((f) => ({ id: f.id(), level: f.level() }));
    if (factories.length === 0) return translateText("strategic.needs_factory");
    if (factoryWithFreeLine(factories, s.jobs) === null) {
      return translateText("strategic.no_free_line");
    }
    if (this.cost(type) > player.gold()) {
      return translateText("build_menu.not_enough_money");
    }
    return null;
  }

  private produce(type: StockpiledNuke): void {
    if (this.produceReason(type) !== null) return;
    this.eventBus?.emit(new SendProduceNukeIntentEvent(type));
  }

  /**
   * Why a paradrop can't be started now (short, shown on its button too),
   * or null when it can: locked, no airport, every airport's sorties in
   * use, or not enough gold.
   */
  private paradropReason(): string | null {
    if (this.locked(UnitType.TransportPlane)) {
      return lockedReason(UnitType.TransportPlane);
    }
    const player = this.game?.myPlayer();
    const airports = (player?.units(UnitType.Airport) ?? []).filter(
      (a) => a.isActive() && !a.isUnderConstruction(),
    );
    if (airports.length === 0) {
      return translateText("radial_menu.paradrop_no_airport");
    }
    if (airports.every((a) => a.isInCooldown())) {
      return translateText("radial_menu.paradrop_no_sortie");
    }
    if (this.cost(UnitType.TransportPlane) > (player?.gold() ?? 0n)) {
      return translateText("radial_menu.paradrop_need_gold");
    }
    return null;
  }

  /** Why the unit can't be built right now, or null when it can. */
  private cannotBuildReason(type: PlayerBuildableUnitType): string | null {
    if (type === UnitType.TransportPlane) return this.paradropReason();
    if (this.locked(type)) return lockedReason(type);
    if (this.banned(type)) return bannedReason();
    const player = this.game?.myPlayer();
    const strategic = this.strategic();
    if (strategic !== null && isStockpiledNuke(type)) {
      // Strategic weapons: a nuke is fired from the stockpile, not bought.
      if (strategic.stock[type] === 0) {
        return translateText("strategic.no_stock");
      }
    } else if (this.cost(type) > (player?.gold() ?? 0n)) {
      return translateText("build_menu.not_enough_money");
    }
    if (
      (NUKES.has(type) ||
        type === UnitType.CoastalBarrage ||
        type === UnitType.ConventionalMissile ||
        type === UnitType.Satellite) &&
      (player?.units(UnitType.MissileSilo).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_silo");
    }
    if (type === UnitType.Satellite && strategic !== null) {
      const phase = strategic.satellite.phase;
      if (phase === "preparing") {
        return translateText("strategic.satellite_busy");
      }
      if (phase !== "none") return translateText("strategic.satellite_used");
    }
    if (
      type === UnitType.Bomber &&
      (player?.units(UnitType.Airport).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_airport");
    }
    if (
      type === UnitType.Warship &&
      (player?.units(UnitType.Port).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_port");
    }
    return null;
  }

  private canBuild(type: PlayerBuildableUnitType): boolean {
    if (this.game?.config().isUnitDisabled(type)) return false;
    return this.cannotBuildReason(type) === null;
  }

  /** "1", "⇧B", … for mouse players; a touch screen has no keys to show. */
  private hotkeyLabel(item: HotbarItem): string {
    if (item.keybind === "" || Platform.isTouch) return "";
    return (this.hotkeys[item.keybind] ?? "")
      .replace("Shift+", "⇧")
      .replace("Digit", "")
      .replace("Numpad", "")
      .replace("Key", "");
  }

  private openInfo(type: PlayerBuildableUnitType) {
    this.infoUnit = type;
    this.eventBus?.emit(new ToggleStructureEvent(highlightTypes(type)));
  }

  private closeInfo() {
    if (this.infoUnit === null) return;
    this.infoUnit = null;
    this.eventBus?.emit(new ToggleStructureEvent(null));
  }

  private onItemTap(item: HotbarItem) {
    if (this.uiState.ghostStructure === item.type) {
      // Tapped while building it: leave build mode.
      this.uiState.ghostStructure = null;
    } else if (this.infoUnit === item.type) {
      // Second tap builds. A unit that can't be built keeps its card, which
      // says why.
      if (this.canBuild(item.type)) {
        this.uiState.ghostStructure = item.type;
        this.closeInfo();
      }
    } else {
      // First tap: the card. Looking at another unit leaves build mode.
      this.uiState.ghostStructure = null;
      this.openInfo(item.type);
    }
    this.requestUpdate();
  }

  render() {
    const myPlayer = this.game?.myPlayer();
    if (
      !this.game ||
      !myPlayer ||
      this.game.inSpawnPhase() ||
      !myPlayer.isAlive()
    ) {
      return null;
    }
    const items = HOTBAR.filter(
      (item) => !this.game.config().isUnitDisabled(item.type),
    );
    if (items.length === 0) return null;

    // The bar is not positioned: the card anchors to the HUD box around it
    // (index.html) and opens above the whole box, clear of the control panel.
    return html`
      <div class="border-t border-white/10 p-1 w-full flex flex-col gap-1">
        ${this.renderInfoCard()}
        ${this.renderRow(
          "buildings",
          items.filter((item) => !ATTACK_TYPES.has(item.type)),
        )}
        ${this.renderRow(
          "attacks",
          items.filter((item) => ATTACK_TYPES.has(item.type)),
        )}
      </div>
    `;
  }

  /**
   * One row of the bar: a grid with exactly one column per button, so it
   * never wraps to another line; at narrow widths the buttons get a little
   * smaller instead (spec §14d). An empty row is left out.
   */
  private renderRow(row: "buildings" | "attacks", items: HotbarItem[]) {
    if (items.length === 0) return null;
    return html`
      <div
        data-hotbar-row=${row}
        class="grid justify-center gap-1"
        style="grid-template-columns: repeat(${items.length}, minmax(0, ${BUTTON_MAX}));"
      >
        ${items.map((item) => this.renderItem(item))}
      </div>
    `;
  }

  private renderItem(item: HotbarItem) {
    const selected = this.uiState.ghostStructure === item.type;
    const open = this.infoUnit === item.type;
    const tech = this.locked(item.type) ? requiredTech(item.type) : null;
    const count = this.counts.get(item.type);
    const stock = this.stockOf(item.type);
    return html`
      <button
        type="button"
        data-hotbar=${item.key}
        aria-label=${translateText(`unit_type.${item.key}`)}
        aria-pressed=${String(selected)}
        class="relative min-w-0 h-9 flex flex-col items-center justify-center rounded-md border text-white ${selected
          ? "border-sky-400 bg-sky-700/60"
          : open
            ? "border-white bg-white/15"
            : "border-slate-500 bg-gray-900/40"} ${this.tutorialHighlight ===
        item.type
          ? "tutorial-highlight"
          : ""}"
        @click=${() => this.onItemTap(item)}
      >
        <img
          src=${item.icon}
          alt=${item.key}
          class="size-5 max-w-full ${this.canBuild(item.type)
            ? ""
            : "opacity-40"}"
        />
        ${stock !== null
          ? html`<span
              data-stock
              class="absolute -top-1 -right-1 min-w-3.5 px-0.5 rounded-full bg-sky-600 text-[9px] leading-3.5 text-center tabular-nums"
              >${stock}</span
            >`
          : null}
        ${item.type === UnitType.TransportPlane && !this.canBuild(item.type)
          ? html`<span
              data-paradrop-reason
              class="w-full px-0.5 text-[8px] leading-none text-center text-red-300 truncate"
              >${this.paradropReason()}</span
            >`
          : tech !== null
            ? html`<span
                data-locked-tech
                class="w-full px-0.5 text-[8px] leading-none text-center text-red-300 truncate"
                >🔒 ${translateText(`domestic.tech.${tech}.name`)}</span
              >`
            : this.banned(item.type)
              ? html`<span
                  data-banned
                  class="w-full px-0.5 text-[8px] leading-none text-center text-amber-300 truncate"
                  >${bannedBadge()}</span
                >`
              : count !== undefined
                ? html`<span class="text-[10px] leading-none tabular-nums"
                    >${renderNumber(count)}</span
                  >`
                : null}
      </button>
    `;
  }

  private renderInfoCard() {
    const type = this.infoUnit;
    if (type === null) return null;
    const item = HOTBAR.find((i) => i.type === type);
    if (item === undefined) return null;
    const reason = this.cannotBuildReason(type);
    const stock = this.stockOf(type);
    const hotkey = this.hotkeyLabel(item);
    return html`
      <div
        data-hotbar-info
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-[90vw] z-[100] flex flex-col gap-2 p-3 rounded-lg bg-gray-800 border border-white/10 shadow-xl text-white text-sm"
      >
        <div class="flex items-start gap-2">
          <div class="flex-1 text-base font-bold">
            ${translateText(`unit_type.${item.key}`)}${hotkey === ""
              ? ""
              : ` [${hotkey}]`}
          </div>
          <button
            type="button"
            class="size-6 shrink-0 flex items-center justify-center rounded-md text-sm hover:bg-white/10"
            aria-label=${translateText("common.close")}
            @click=${() => {
              this.closeInfo();
              this.requestUpdate();
            }}
          >
            ✕
          </button>
        </div>
        <div class="text-gray-200">
          ${translateText(`build_menu.desc.${item.key}`)}
        </div>
        ${stock !== null
          ? this.renderProduction(type as StockpiledNuke, stock)
          : html`<div class="flex items-center gap-1">
              <img src=${goldCoinIcon} alt="" width="16" height="16" />
              <span class="text-yellow-300 font-bold"
                >${renderNumber(this.cost(type))}</span
              >
            </div>`}
        ${type === UnitType.Warship
          ? html`<div class="text-cyan-300">
              ${Platform.isTouch
                ? translateText("touch_ui.warship_long_press")
                : translateText("build_menu.warship_shift_hint")}
            </div>`
          : null}
        ${reason !== null
          ? html`<div data-hotbar-reason class="text-red-300 font-semibold">
              ${reason}
            </div>`
          : html`<div class="text-sky-300 font-semibold">
              ${translateText("touch_ui.tap_again_to_build")}
            </div>`}
      </div>
    `;
  }

  /** Strategic weapons: stock, lines in use, and the one-tap "Build" button (not a map action). */
  private renderProduction(type: StockpiledNuke, stock: number) {
    const producing =
      this.strategic()?.jobs.filter((j) => j.type === type).length ?? 0;
    const reason = this.produceReason(type);
    return html`
      <div data-strategic class="flex flex-col gap-2">
        <div class="font-semibold">
          ${translateText("strategic.stock", { count: stock })}${producing > 0
            ? ` · ${translateText("strategic.producing", { count: producing })}`
            : ""}
        </div>
        <div class="flex items-center gap-2">
          <img src=${goldCoinIcon} alt="" width="16" height="16" />
          <span class="text-yellow-300 font-bold"
            >${renderNumber(this.cost(type))}</span
          >
          <button
            type="button"
            data-produce
            class="ml-auto px-3 py-1 rounded-md text-sm font-semibold bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
            ?disabled=${reason !== null}
            @click=${() => this.produce(type)}
          >
            ${translateText("strategic.produce", {
              seconds: NUKE_PRODUCTION_TICKS[type] / 10,
            })}
          </button>
        </div>
        ${reason !== null
          ? html`<div data-produce-reason class="text-amber-300">
              ${reason}
            </div>`
          : null}
      </div>
    `;
  }
}
