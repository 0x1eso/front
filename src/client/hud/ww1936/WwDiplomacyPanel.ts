import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { DrawerInsets, drawerInsets } from "../domestic/DomesticPanel";
import {
  countryName,
  diplomacyModel,
  FACTION_DOT_CLASS,
  factionName,
  WW_BAND_PX,
} from "./WorldWarModel";
import { ToggleWwDiplomacyEvent } from "./WwTopBand";

/** Camps listed under "if the war ended now" (mine is always added). */
const SHOWN_CAMPS = 6;
/** Space between the drawer and the HUD around it, in CSS px. */
const GAP = 8;

/**
 * World War 1936 (spec §8.2): a right-hand drawer — the factions and their
 * members (capitulated ones struck through), my wars, the camp scores if the
 * game ended now, and the next date of the historical calendar.
 *
 * It keeps the map's centre and the HUD around it clear: right of the
 * screen's middle (at most 22rem wide), below the band and the top-right
 * sidebar, above the bottom HUD's rows (the attack ratio), left of the map
 * buttons — the domestic drawer's insets. Under the hover card (z-1001), so
 * a tapped country's card stays readable.
 */
@customElement("ww-diplomacy-panel")
export class WwDiplomacyPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private open = false;
  @state() private insets: DrawerInsets = {
    top: WW_BAND_PX + GAP,
    right: GAP,
    bottom: GAP,
  };
  private unregisterBack: (() => void) | null = null;
  private readonly refit = () => {
    const i = drawerInsets();
    this.insets = { ...i, top: Math.max(i.top, WW_BAND_PX + GAP) };
  };

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleWwDiplomacyEvent, () => this.setOpen(!this.open));
    // Back closes the drawer before it asks to leave the game.
    this.unregisterBack?.();
    this.unregisterBack = registerBackClosable(() => {
      if (!this.open) return false;
      this.setOpen(false);
      return true;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unregisterBack?.();
    this.unregisterBack = null;
    window.removeEventListener("resize", this.refit);
  }

  isOpen(): boolean {
    return this.open;
  }

  private setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    if (open) {
      this.refit();
      window.addEventListener("resize", this.refit);
    } else {
      window.removeEventListener("resize", this.refit);
    }
  }

  getTickIntervalMs() {
    return 500;
  }

  tick() {
    if (!this.open) return;
    // The HUD around the drawer grows and shrinks during the game.
    this.refit();
    this.requestUpdate();
  }

  private flag(tag: CountryTag) {
    return html`<img
      src=${assetUrl(`flags/${COUNTRIES[tag].flag}.svg`)}
      alt=""
      class="h-3 w-4 shrink-0 rounded-sm object-cover"
    />`;
  }

  render() {
    if (!this.open || !this.game?.worldWarScenario()) return null;
    const m = diplomacyModel(this.game);
    const { top, right, bottom } = this.insets;
    const camps = m.camps.filter((c, i) => i < SHOWN_CAMPS || c.mine);
    const heading =
      "mb-1 text-xs font-bold uppercase tracking-wide text-white/70";
    return html`
      <aside
        data-ww-diplomacy
        class="fixed z-[1000] flex flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/92 text-sm text-white shadow-xl"
        style="top: ${top}px; right: ${right}px; bottom: ${bottom}px; width: min(22rem, calc(50vw - ${right}px));"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div class="flex shrink-0 items-center justify-between px-3 pt-2">
          <h3 class="m-0 text-sm font-bold">
            ${translateText("ww1936.panel.title")}
          </h3>
          <button
            type="button"
            data-ww-diplomacy-close
            class="size-8 rounded-md hover:bg-white/10"
            aria-label=${translateText("common.close")}
            @click=${() => this.setOpen(false)}
          >
            ✕
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          ${m.factions.map(
            (f) =>
              html`<section data-ww-faction=${f.id} class="mb-3">
                <div class="${heading} flex items-center gap-1.5">
                  <span
                    class="size-2 rounded-full ${FACTION_DOT_CLASS[f.id]}"
                  ></span>
                  ${factionName(f.id)}
                </div>
                <ul
                  class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs"
                >
                  ${f.members.map(
                    (x) =>
                      html`<li
                        data-ww-member=${x.tag}
                        class="flex items-center gap-1 ${x.capitulated ||
                        !x.alive
                          ? "text-white/40 line-through"
                          : ""}"
                      >
                        ${this.flag(x.tag)} ${countryName(x.tag)}
                      </li>`,
                  )}
                </ul>
              </section>`,
          )}
          <section class="mb-3">
            <div class=${heading}>${translateText("ww1936.panel.my_wars")}</div>
            ${m.myWars.length === 0
              ? html`<p class="m-0 text-xs text-white/60">
                  ${translateText("ww1936.panel.at_peace")}
                </p>`
              : html`<ul
                  data-ww-my-wars
                  class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs"
                >
                  ${m.myWars.map(
                    (t) =>
                      html`<li class="flex items-center gap-1">
                        ${this.flag(t)} ${countryName(t)}
                      </li>`,
                  )}
                </ul>`}
          </section>
          <section class="mb-3">
            <div class=${heading}>${translateText("ww1936.panel.scores")}</div>
            ${camps.map(
              (c) =>
                html`<div data-ww-camp class="mb-1">
                  <div
                    class="flex justify-between gap-2 text-xs ${c.mine
                      ? "font-bold text-amber-300"
                      : ""}"
                  >
                    <span class="truncate">${c.name}</span
                    ><span class="tabular-nums"
                      >${(c.scoreBp / 100).toFixed(1)}%</span
                    >
                  </div>
                  <div class="h-1.5 rounded bg-white/10">
                    <div
                      class="h-1.5 rounded ${c.mine
                        ? "bg-amber-400"
                        : "bg-white/60"}"
                      style="width: ${c.scoreBp / 100}%"
                    ></div>
                  </div>
                </div>`,
            )}
          </section>
          ${m.nextHistory === null || !this.game.config().historicalAi()
            ? nothing
            : html`<p data-ww-next class="m-0 text-xs text-white/70">
                ${translateText("ww1936.panel.next_history", {
                  date: m.nextHistory,
                })}
              </p>`}
        </div>
      </aside>
    `;
  }
}
