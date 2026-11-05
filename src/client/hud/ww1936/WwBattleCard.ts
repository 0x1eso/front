import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { ID_ARMY } from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BattleSummary,
  ModLine,
} from "@openfront/engine-api/ww1936/LandTypes";
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
  battleLuck,
  BattleLuckView,
  landSidesOf,
  regionName,
} from "./LandModel";
import { landSelectionOf, OpenWwBattleEvent } from "./LandSelection";
import { navyCtx, NavyGame } from "./NavyModel";
import { armyPriority, battleAirLine } from "./WingModel";
import { countryName, today } from "./WorldWarModel";
import {
  bpText,
  CARD_MIN_PX,
  CardPlace,
  cardPlace,
  directMaxHeight,
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
    const key = [
      view?.version,
      this.game.wwEconomy?.()?.version,
      this.game.wwAir?.()?.version,
      this.region,
    ];
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
      style="${placeStyle(this.place)} max-height: ${directMaxHeight(
        this.place,
      )}px; width: ${this.place.maxWidth}px;"
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
          class="ml-auto size-10 shrink-0 rounded-md hover:bg-white/10"
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
      ${this.renderAir(d)} ${this.renderLuck(battleLuck(b, this.luckBand(b)))}
      ${(b.runRounds ?? 0) > 0 && this.luckBand(b) >= 3
        ? html`<div data-ww-battle-running class="text-amber-300">
            ${translateText("ww1936.land.battle_running", { n: b.runRounds! })}
          </div>`
        : nothing}
      ${(b.wornLevels ?? 0) > 0 && this.luckBand(b) >= 3
        ? html`<div data-ww-battle-worn class="text-amber-300">
            ${translateText("ww1936.land.battle_worn", { n: b.wornLevels! })}
          </div>`
        : nothing}
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
            class="h-10 rounded-md border border-red-400/60 bg-red-900/50 px-3 font-semibold hover:bg-red-800/60"
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

  /**
   * ww8 (design §8.6): the enemy's air control over the battle and what it
   * costs me, the wings giving close support to each side, and [✈ priority]
   * for my armies attacking there.
   */
  private renderAir(d: BattleCardData): TemplateResult | typeof nothing {
    const air = this.game.wwAir?.();
    if (air?.live !== true) return nothing;
    const ctx = navyCtx(this.game as unknown as NavyGame);
    if (ctx === null) return nothing;
    const b = d.summary;
    const line = battleAirLine(ctx, b.region);
    const cover = (b.casAtt ?? 0) + (b.casDef ?? 0) > 0;
    const on =
      d.leaveArmies.length > 0 &&
      d.leaveArmies.every((a) => armyPriority(ctx, a));
    if (line === null && !cover && !d.mine) return nothing;
    return html`<div
      data-ww-battle-air
      class="flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      ${line === null
        ? nothing
        : html`<span data-ww-battle-sky class="text-amber-300"
            >✈
            ${translateText("ww1936.wing.battle_sky", {
              pct: Math.floor(line.supPm / 10),
              cost: line.penaltyPct,
            })}</span
          >`}
      ${cover
        ? html`<span data-ww-battle-cover class="text-sky-300"
            >${translateText("ww1936.wing.battle_cover", {
              att: b.casAtt ?? 0,
              def: b.casDef ?? 0,
            })}</span
          >`
        : nothing}
      ${d.mine
        ? html`<button
            type="button"
            data-ww-air-priority
            aria-pressed=${String(on)}
            class="ml-auto h-10 rounded-md border px-2 ${on
              ? "border-sky-300 bg-sky-800/60"
              : "border-white/15 bg-white/10 hover:bg-white/20"}"
            @click=${() => {
              for (const army of d.leaveArmies) {
                this.eventBus.emit(
                  new SendWwOrderIntentEvent({
                    kind: "army_air_priority",
                    army,
                    on: !on,
                  }),
                );
              }
            }}
          >
            ✈ ${translateText("ww1936.wing.btn_priority")}
          </button>`
        : nothing}
    </div>`;
  }

  /**
   * The fog's army band on the sides I do not command (3 when the fog is
   * off): the luck numbers are the engine's exact forecast of both armies,
   * so they follow what the screen may show of the enemy.
   */
  private luckBand(b: BattleSummary): number {
    const fog = fogModelOf(this.game);
    if (fog.fogOff()) return 3;
    const me = this.game.myPlayer()?.smallID() ?? 0;
    let band = 3;
    for (const side of [b.attacker, b.defender]) {
      if (side !== me) band = Math.min(band, fog.bandOf(side, ID_ARMY));
    }
    return band;
  }

  /**
   * ww7 (design §2.6): the band the fight is in, the attacker's odds, the
   * ratio at bad / average / good luck, the phase's tactics (and whether the
   * defence cancels the attack), the initiative and the reserve odds. What
   * the engine did not send (or the fog hides) is not drawn.
   */
  private renderLuck(l: BattleLuckView): TemplateResult | typeof nothing {
    const tactic = l.tactics;
    if (
      l.band === null &&
      l.barPct === null &&
      l.range === null &&
      tactic === null &&
      l.initiative === null &&
      l.reinfPct === null
    ) {
      return nothing;
    }
    return html`<div data-ww-luck class="flex flex-col gap-0.5">
      ${l.band === null
        ? nothing
        : html`<div
            data-ww-battle-band=${l.band.n}
            class="flex items-center gap-1.5 text-white/80"
          >
            <span class="tabular-nums"
              >${translateText("ww1936.land.battle_band", {
                n: l.band.n,
                d: l.band.of,
              })}</span
            >
            <span class="flex flex-1 gap-0.5">
              ${Array.from(
                { length: l.band.of },
                (_, i) =>
                  html`<span
                    class="h-1.5 flex-1 rounded-sm ${i < l.band!.n - 1
                      ? "bg-amber-400"
                      : i === l.band!.n - 1
                        ? "bg-amber-200"
                        : "bg-white/15"}"
                  ></span>`,
              )}
            </span>
          </div>`}
      ${l.barPct === null
        ? nothing
        : html`<div class="flex items-center gap-1.5">
            <div
              data-ww-odds=${l.winPct ?? ""}
              class="h-2 flex-1 rounded bg-red-900/70"
            >
              <div
                class="h-2 rounded bg-emerald-400"
                style="width: ${l.barPct}%"
              ></div>
            </div>
            ${l.winPct === null
              ? nothing
              : html`<span data-ww-odds-text class="font-semibold tabular-nums"
                  >${translateText("ww1936.land.battle_odds", {
                    pct: l.winPct,
                  })}</span
                >`}
          </div>`}
      ${l.range === null
        ? nothing
        : html`<div data-ww-range class="tabular-nums text-white/80">
            ${translateText("ww1936.land.battle_range", {
              low: l.range.low,
              mid: l.range.mid,
              high: l.range.high,
            })}
          </div>`}
      ${tactic === null
        ? nothing
        : html`<div data-ww-tactics class="flex flex-wrap gap-x-1.5">
            <span data-ww-tactic-att=${tactic.att}
              >${translateText(`ww1936.tactic.${tactic.att}`)}</span
            >
            <span aria-hidden="true">↔</span>
            <span data-ww-tactic-def=${tactic.def}
              >${translateText(`ww1936.tactic.${tactic.def}`)}</span
            >
            ${tactic.countered
              ? html`<span data-ww-tactic-cancel class="text-amber-300"
                  >${translateText("ww1936.land.battle_tactic_cancel")}</span
                >`
              : nothing}
          </div>`}
      ${l.initiative === null && l.reinfPct === null
        ? nothing
        : html`<div class="flex flex-wrap gap-x-3 tabular-nums text-white/80">
            ${l.initiative === null
              ? nothing
              : html`<span data-ww-initiative
                  >${translateText("ww1936.land.battle_initiative", {
                    att: l.initiative.att,
                    def: l.initiative.def,
                  })}</span
                >`}
            ${l.reinfPct === null
              ? nothing
              : html`<span data-ww-reinforce
                  >${translateText("ww1936.land.battle_reinforce", {
                    pct: l.reinfPct,
                  })}</span
                >`}
          </div>`}
    </div>`;
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
    // Spec §8.9: exact at the exact band, five steps at "close", a gray bar below.
    const bar = (pm: number, color: string) => {
      const shown =
        band >= 3
          ? Math.max(0, Math.min(1000, pm))
          : band === 2
            ? Math.min(1000, Math.ceil(Math.max(0, pm) / 200) * 200)
            : 1000;
      return html`<div class="h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded ${band < 2 ? "bg-gray-500" : color}"
          style="width: ${shown / 10}%"
        ></div>
      </div>`;
    };
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
        ${(band < 3 ? [] : mods).map(
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
