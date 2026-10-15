import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { requiredTech } from "@openfront/engine-lib/domestic/Locks";
import { renderNumber } from "@openfront/engine-lib/Format";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { MouseDownEvent, ToggleStructureEvent } from "../../InputHandler";
import { Platform } from "../../Platform";
import { UIState } from "../../UIState";
import { UserSettings } from "../../UserSettings";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import { lockedReason } from "../domestic/LockReason";
import {
  adminOfficeIcon,
  atomBombIcon,
  cityIcon,
  defensePostIcon,
  factoryIcon,
  goldCoinIcon,
  hydrogenBombIcon,
  mirvIcon,
  missileSiloIcon,
  portIcon,
  researchInstituteIcon,
  samLauncherIcon,
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
];

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
    player.buildables(undefined, BuildMenus.types).then((buildables) => {
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

  /** Why the unit can't be built right now, or null when it can. */
  private cannotBuildReason(type: PlayerBuildableUnitType): string | null {
    if (this.locked(type)) return lockedReason(type);
    const player = this.game?.myPlayer();
    if (this.cost(type) > (player?.gold() ?? 0n)) {
      return translateText("build_menu.not_enough_money");
    }
    if (
      NUKES.has(type) &&
      (player?.units(UnitType.MissileSilo).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_silo");
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
      <div class="border-t border-white/10 p-1 w-full">
        ${this.renderInfoCard()}
        <div class="flex justify-center gap-1">
          ${items.map((item) => this.renderItem(item))}
        </div>
      </div>
    `;
  }

  private renderItem(item: HotbarItem) {
    const selected = this.uiState.ghostStructure === item.type;
    const open = this.infoUnit === item.type;
    const tech = this.locked(item.type) ? requiredTech(item.type) : null;
    const count = this.counts.get(item.type);
    return html`
      <button
        type="button"
        data-hotbar=${item.key}
        aria-label=${translateText(`unit_type.${item.key}`)}
        aria-pressed=${String(selected)}
        class="relative w-11 h-14 shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-md border text-white ${selected
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
          class="size-7 ${this.canBuild(item.type) ? "" : "opacity-40"}"
        />
        ${tech !== null
          ? html`<span
              data-locked-tech
              class="w-full px-0.5 text-[9px] leading-tight text-center text-red-300 line-clamp-2"
              >🔒 ${translateText(`domestic.tech.${tech}.name`)}</span
            >`
          : count !== undefined
            ? html`<span class="text-xs leading-none tabular-nums"
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
            class="size-11 -m-2 flex items-center justify-center rounded-md text-xl hover:bg-white/10"
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
        <div class="flex items-center gap-1">
          <img src=${goldCoinIcon} alt="" width="16" height="16" />
          <span class="text-yellow-300 font-bold"
            >${renderNumber(this.cost(type))}</span
          >
        </div>
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
}
