import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { ID_ARMY } from "@openfront/engine-api/ww1936/DepthTypes";
import type { ModLine } from "@openfront/engine-api/ww1936/LandTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { registerBackClosable } from "../../BackGuard";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { fogModelOf } from "./FogModel";
import {
  battleCard,
  BattleCardData,
  landSidesOf,
  regionName,
} from "./LandModel";
import { landSelectionOf, OpenWwBattleEvent } from "./LandSelection";
import { countryName, today } from "./WorldWarModel";
import {
  bpText,
  CARD_MIN_PX,
  CardPlace,
  cardPlace,
  placeStyle,
  samePlace,
} from "./WwArmyCard";
import { WwDrawerEvent } from "./WwDrawer";
import { WwLandChangedEvent } from "./WwLandController";

/**
 * World War 1936 P2 (spec §15.6): a battle's card, opened by tapping its
 * marker — the defending region, its terrain and weather, both sides'
 * flags, lines, widths, org and strength, the modifiers (my own
 * division's when I fight there), and "leave this battle" when I attack
 * there. In the army card's place (bottom centre, left of a drawer); it
 * gives way when an army is chosen.
 */
@customElement("ww-battle-card")
export class WwBattleCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private region: number | null = null;
  @state() private place: CardPlace = {
    bottom: 8,
    right: null,
    maxWidth: 560,
    maxHeight: CARD_MIN_PX,
  };
  private unregisterBack: (() => void) | null = null;
  private redrawKey: readonly unknown[] = [];

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(OpenWwBattleEvent, (e) => this.show(e.region));
    this.eventBus.on(WwLandChangedEvent, () => {
      if (landSelectionOf(this.game).army !== null) this.show(null);
    });
    this.eventBus.on(WwDrawerEvent, () => {
      void this.updateComplete.then(() =>
        requestAnimationFrame(() => this.refit()),
      );
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unregisterBack?.();
    this.unregisterBack = null;
  }

  isOpen(): boolean {
    return this.region !== null;
  }

  private show(region: number | null) {
    this.region = region;
    this.unregisterBack?.();
    this.unregisterBack = null;
    if (region !== null) {
      this.refit();
      this.unregisterBack = registerBackClosable(() => {
        if (this.region === null) return false;
        this.show(null);
        return true;
      });
    }
  }

  private refit() {
    const next = cardPlace();
    if (!samePlace(next, this.place)) this.place = next;
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    if (this.region === null) return;
    this.refit();
    const view = this.game.wwLand?.() ?? null;
    const key = [view?.version, this.game.wwEconomy?.()?.version, this.region];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      // The battle ended: the card goes with it.
      if (view !== null && !view.battles.has(this.region)) this.show(null);
      this.requestUpdate();
    }
  }

  private data(): BattleCardData | null {
    if (
      this.region === null ||
      (this.game?.worldWarScenario() ?? null) === null
    ) {
      return null;
    }
    const view = this.game.wwLand?.() ?? null;
    const economy = this.game.wwEconomy?.() ?? null;
    if (view === null || economy === null) return null;
    const me = this.game.myPlayer()?.smallID() ?? 0;
    return battleCard(
      view,
      economy,
      me,
      this.region,
      today(this.game),
      landSidesOf(this.game),
    );
  }

  render() {
    const d = this.data();
    if (d === null) return nothing;
    const b = d.summary;
    const s = this.game.worldWarScenario()!;
    const name = regionName(s, b.region);
    return html`<section
      data-ww-battle-card=${b.region}
      aria-label=${name}
      class="fixed z-[1001] flex max-h-[25vh] flex-col gap-1 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style="${placeStyle(this.place)} width: ${this.place.maxWidth}px;"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div class="flex items-center gap-1.5">
        <span class="font-bold text-sm">⚔ ${name}</span>
        <span class="text-white/70"
          >${translateText(`ww1936.terrain.${d.land}`)} ·
          ${translateText(`ww1936.weather.${d.weather}`)}</span
        >
        <button
          type="button"
          data-ww-battle-close
          class="ml-auto size-9 shrink-0 rounded-md hover:bg-white/10"
          aria-label=${translateText("common.close")}
          @click=${() => this.show(null)}
        >
          ✕
        </button>
      </div>
      <div
        data-ww-battle-progress=${b.progressPm}
        class="h-1.5 rounded bg-white/10"
      >
        <div
          class="h-1.5 rounded bg-amber-400"
          style="width: ${Math.max(0, Math.min(1000, b.progressPm)) / 10}%"
        ></div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${this.renderSide(
          "attacker",
          b.attacker,
          b.attLine,
          b.attReserve,
          b.attWidth,
          b.width,
          b.attOrgPm,
          b.attStrPm,
          d.attackLines,
        )}
        ${this.renderSide(
          "defender",
          b.defender,
          b.defLine,
          b.defReserve,
          b.defWidth,
          b.width,
          b.defOrgPm,
          b.defStrPm,
          d.defenseLines,
        )}
      </div>
      ${d.mine
        ? html`<button
            type="button"
            data-ww-leave-battle
            class="h-9 rounded-md border border-red-400/60 bg-red-900/50 px-3 font-semibold hover:bg-red-800/60"
            @click=${() => {
              for (const army of d.leaveArmies) {
                this.eventBus.emit(
                  new SendWwOrderIntentEvent({
                    kind: "army_execute",
                    army,
                    on: false,
                  }),
                );
              }
            }}
          >
            ${translateText("ww1936.land.btn_leave_battle")}
          </button>`
        : nothing}
    </section>`;
  }

  private renderSide(
    side: "attacker" | "defender",
    smallID: number,
    line: number,
    reserve: number,
    used: number,
    width: number,
    orgPm: number,
    strPm: number,
    mods: ModLine[],
  ): TemplateResult {
    const tag = this.game.worldWarScenario()?.tagOfSmallId(smallID);
    // P6 (plan decision 19): an enemy side's numbers through the fog.
    const fog = fogModelOf(this.game);
    const enemy = smallID !== (this.game.myPlayer()?.smallID() ?? 0);
    const count = (n: number) =>
      fog.fogOff() || !enemy ? n : fog.countLabel(smallID, n);
    // Spec §8.9: an enemy side's bars from "close" up, its widths only when exact.
    const band = fog.fogOff() || !enemy ? 3 : fog.bandOf(smallID, ID_ARMY);
    const bar = (pm: number, color: string) =>
      band < 2
        ? nothing
        : html`<div class="h-1.5 rounded bg-white/10">
            <div
              class="h-1.5 rounded ${color}"
              style="width: ${Math.max(0, Math.min(1000, pm)) / 10}%"
            ></div>
          </div>`;
    return html`<div
      data-ww-battle-side=${side}
      class="flex min-w-0 flex-col gap-0.5"
    >
      <div class="flex min-w-0 items-center gap-1">
        ${tag === undefined
          ? nothing
          : html`<img
                src=${assetUrl(`flags/${COUNTRIES[tag].flag}.svg`)}
                alt=""
                class="h-3 w-4 shrink-0 rounded-sm object-cover"
              />
              <span class="min-w-0 truncate font-semibold"
                >${countryName(tag)}</span
              >`}
      </div>
      <div class="flex flex-wrap gap-x-2 text-white/70 tabular-nums">
        <span
          >${translateText("ww1936.land.battle_line", { n: count(line) })}</span
        >
        <span
          >${translateText("ww1936.land.battle_reserve", {
            n: count(reserve),
          })}</span
        >
        ${band < 3
          ? nothing
          : html`<span data-ww-battle-width
              >${translateText("ww1936.land.battle_width", {
                used,
                width,
              })}</span
            >`}
      </div>
      ${bar(orgPm, "bg-sky-400")} ${bar(strPm, "bg-emerald-400")}
      <ul data-ww-mods=${side} class="m-0 list-none p-0">
        ${mods.map(
          (m) =>
            html`<li data-ww-mod=${m.id} class="flex justify-between gap-2">
              <span class="truncate"
                >${translateText(`ww1936.mod.${m.id}`)}</span
              >
              <span
                class="tabular-nums ${m.bp < 0
                  ? "text-red-300"
                  : "text-emerald-300"}"
                >${bpText(m.bp)}</span
              >
            </li>`,
        )}
      </ul>
    </div>`;
  }
}
