import {
  DomesticData,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import {
  ChooseGovernmentIntentEvent,
  ProclaimLawIntentEvent,
  ResearchTechIntentEvent,
  SendQueueResearchIntentEvent,
  StartVictoryProjectIntentEvent,
} from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import type { DomesticClientView } from "../../view/DomesticClientView";
import { PlayerView } from "../../view/PlayerView";
import {
  DomesticScreen,
  DomesticScreenShownEvent,
  OpenDomesticScreenEvent,
} from "./DomesticEvents";
import { renderLawsScreen } from "./LawsScreen";
import {
  renderResearchScreen,
  renderTechSheet,
  ResearchScreenContext,
} from "./ResearchScreen";
import { renderVictoryTab } from "./VictoryTab";

const SCREEN_ICONS: Readonly<Record<DomesticScreen, string>> = {
  research: "🔬",
  laws: "📜",
  victory: "🏆",
};

/** Space between the drawer and the HUD around it, in CSS px. */
const DRAWER_GAP = 8;

/**
 * The HUD the open drawer leaves visible and tappable (spec §14a): it sits
 * below the top-right sidebar stack, above the bottom HUD's fixed rows
 * (attack ratio, build bar and the domestic dials that open it) and left of
 * the map buttons. Not above the whole bottom HUD: its events and chat column
 * grows and shrinks all game, and would make the drawer jump. The drawer is
 * drawn over that column (z-[1100]), which it may hide while open.
 */
const KEEP_CLEAR = {
  top: "[data-hud-top-right]",
  bottom: "[data-bottom-hud-rows]",
  right: "map-controls > div",
} as const;

/** At or below this viewport height (phones in landscape) the drawer is full height. */
export const COMPACT_MAX_HEIGHT = 500;

/* The drawer is z-[1100]: above the leaderboard (900), PlayerInfoOverlay (1001) and the bottom HUD (200, tutorial banner). */

/** The scroll area's own bottom padding (pb-3), in CSS px. */
const LIST_PADDING = 12;

export interface DrawerInsets {
  top: number;
  right: number;
  bottom: number;
}

function shownRect(selector: string): DOMRect | null {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return r !== undefined && r.width > 0 && r.height > 0 ? r : null;
}

/** The drawer's offsets from the viewport edges, from where the HUD is now. */
export function drawerInsets(): DrawerInsets {
  const top = shownRect(KEEP_CLEAR.top);
  const bottom = shownRect(KEEP_CLEAR.bottom);
  const right = shownRect(KEEP_CLEAR.right);
  return {
    top: (top?.bottom ?? 0) + DRAWER_GAP,
    bottom: (bottom ? window.innerHeight - bottom.top : 0) + DRAWER_GAP,
    right: (right ? window.innerWidth - right.left : 0) + DRAWER_GAP,
  };
}

/**
 * The domestic drawer (spec §14d): a right-side drawer that opens on the
 * screen of the dial tapped (research, the Book of Laws with the
 * government, or victory) and closes when that dial is tapped again.
 */
@customElement("domestic-panel")
export class DomesticPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private open = false;
  @state() private screen: DomesticScreen = "research";
  @state() private data: DomesticData | null = null;
  /**
   * The game tick, moved on once a game second while open: the cooldown
   * dial counts down without redrawing the drawer every tick.
   */
  @state() private nowTick = 0;
  /** The law card or button waiting for its confirming tap. */
  @state() private armed: string | null = null;
  /** The research node whose detail sheet is open. */
  @state() private selectedTech: TechId | null = null;
  @state() private insets: DrawerInsets = {
    top: DRAWER_GAP,
    right: DRAWER_GAP,
    bottom: DRAWER_GAP,
  };
  /** A short landscape screen: the drawer takes the full height. */
  @state() private compact = false;
  /** The detail sheet's height: the list scrolls its end clear of it. */
  @state() private sheetHeight = 0;
  private resizeObserver: ResizeObserver | null = null;
  private readonly refit = () => {
    this.insets = drawerInsets();
    this.compact = window.innerHeight <= COMPACT_MAX_HEIGHT;
  };

  createRenderRoot() {
    return this;
  }

  private unregisterBack: (() => void) | null = null;

  init() {
    // Back closes the drawer before it asks to leave the game.
    this.unregisterBack?.();
    this.unregisterBack = registerBackClosable(() => {
      if (!this.open) return false;
      this.close();
      return true;
    });
    this.eventBus.on(OpenDomesticScreenEvent, (e) => {
      if (this.open && this.screen === e.screen) this.close();
      else this.show(e.screen);
    });
  }

  /** The screen on show, or null while closed. */
  shownScreen(): DomesticScreen | null {
    return this.open ? this.screen : null;
  }

  private show(screen: DomesticScreen) {
    this.open = true;
    this.screen = screen;
    this.armed = null;
    this.selectedTech = null;
    this.tick();
    this.eventBus.emit(new DomesticScreenShownEvent(screen));
  }

  private close() {
    this.open = false;
    this.armed = null;
    this.selectedTech = null;
    this.eventBus.emit(new DomesticScreenShownEvent(null));
  }

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("open")) return;
    if (this.open) this.startFitting();
    else this.stopFitting();
  }

  protected updated() {
    const sheet = this.querySelector("[data-tech-sheet]");
    const height = sheet?.getBoundingClientRect().height ?? 0;
    if (Math.abs(height - this.sheetHeight) > 1) this.sheetHeight = height;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unregisterBack?.();
    this.unregisterBack = null;
    this.stopFitting();
  }

  /** While open, refit whenever the HUD around the drawer changes size. */
  private startFitting() {
    this.stopFitting();
    this.refit();
    // Again once the drawer is laid out, to see what lies over it.
    void this.updateComplete.then(() => {
      if (this.open) this.refit();
    });
    window.addEventListener("resize", this.refit);
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(this.refit);
    for (const selector of Object.values(KEEP_CLEAR)) {
      const el = document.querySelector(selector);
      if (el) this.resizeObserver.observe(el);
    }
  }

  private stopFitting() {
    window.removeEventListener("resize", this.refit);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  tick() {
    this.data = this.game?.myPlayer()?.domesticData() ?? null;
    if (!this.open) return;
    const now = this.game?.ticks() ?? 0;
    if (Math.floor(now / 10) !== Math.floor(this.nowTick / 10)) {
      this.nowTick = now;
    }
  }

  render() {
    const me = this.game?.myPlayer();
    const view = me?.domestic() ?? null;
    if (!this.open || this.data === null || !me || view === null) return null;
    // A right-side drawer (spec §14a): the map stays visible and playable on
    // the left, so there is no backdrop, and the HUD around it stays clear
    // (KEEP_CLEAR). It stacks above all HUD (z-[1100]); on short landscape
    // screens it takes the full height instead. The dials are its tabs: no tab row here.
    const { top, right, bottom } = this.insets;
    const sheet =
      this.screen === "research" && this.selectedTech !== null
        ? this.researchContext(view, me)
        : null;
    return html`
      <aside
        data-domestic-drawer
        data-screen=${this.screen}
        class="fixed z-[1100] ${this.compact
          ? "w-[min(100vw,520px)] top-[env(safe-area-inset-top,0px)] right-[env(safe-area-inset-right,0px)] bottom-[env(safe-area-inset-bottom,0px)]"
          : "w-[45vw] min-w-[420px] min-h-60"} flex flex-col rounded-lg bg-gray-900/95 backdrop-blur-sm text-white text-base shadow-2xl border border-white/10"
        style=${this.compact
          ? nothing
          : `top: ${top}px; right: ${right}px; bottom: ${bottom}px;`}
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div class="flex items-center gap-2 px-3 pt-3 pb-2">
          <span class="text-xl" aria-hidden="true"
            >${SCREEN_ICONS[this.screen]}</span
          >
          <h2 data-domestic-title class="flex-1 text-xl font-bold">
            ${translateText(`domestic.screen.${this.screen}`)}
          </h2>
          <button
            type="button"
            data-domestic-close
            class="size-11 flex items-center justify-center rounded-md text-2xl hover:bg-white/10"
            aria-label=${translateText("common.close")}
            @click=${() => this.close()}
          >
            ✕
          </button>
        </div>
        <div
          data-domestic-scroll
          class="flex-1 overflow-y-auto px-3"
          style="padding-bottom: ${LIST_PADDING +
          (sheet === null ? 0 : this.sheetHeight)}px;"
        >
          ${this.renderScreen(this.data, view, me)}
        </div>
        ${sheet === null
          ? nothing
          : html`<div
              data-tech-sheet
              class="absolute inset-x-2 max-h-[70%] overflow-y-auto rounded-t-xl bg-gray-800 border border-white/15 shadow-2xl p-3"
              style="bottom: 0px;"
            >
              ${renderTechSheet(sheet)}
            </div>`}
      </aside>
    `;
  }

  private renderScreen(
    d: DomesticData,
    view: DomesticClientView,
    me: PlayerView,
  ): TemplateResult {
    switch (this.screen) {
      case "research":
        return renderResearchScreen(this.researchContext(view, me));
      case "laws":
        return renderLawsScreen({
          view,
          gold: me.gold(),
          infiniteGold: this.game.config().hasInfiniteGold(me),
          nowTick: this.nowTick,
          armed: this.armed,
          arm: (key) => (this.armed = key),
          proclaim: (law, option, payWithGold) =>
            this.eventBus.emit(
              new ProclaimLawIntentEvent(law, option, payWithGold),
            ),
          choose: (government) =>
            this.eventBus.emit(new ChooseGovernmentIntentEvent(government)),
        });
      case "victory":
        return renderVictoryTab(this.game, me, d, (kind, unitId) =>
          this.eventBus.emit(new StartVictoryProjectIntentEvent(kind, unitId)),
        );
    }
  }

  private researchContext(
    view: DomesticClientView,
    me: PlayerView,
  ): ResearchScreenContext {
    return {
      view,
      gold: me.gold(),
      infiniteGold: this.game.config().hasInfiniteGold(me),
      selected: this.selectedTech,
      select: (tech) => {
        this.selectedTech = tech;
        this.armed = null;
      },
      isUnitDisabled: (type) => this.game.config().isUnitDisabled(type),
      armed: this.armed,
      arm: (key) => (this.armed = key),
      research: (tech, payWithGold) =>
        this.eventBus.emit(new ResearchTechIntentEvent(tech, payWithGold)),
      queue: (tech) => {
        this.armed = null;
        this.eventBus.emit(new SendQueueResearchIntentEvent(tech));
      },
    };
  }
}
