// World War 1936 ww8 (lane G, design §8.4, §8.5): the wing card, in the
// army card's place (bottom centre, left clear of the middle of the map).
// Folded it is one line; open it has two rows of 40 px buttons and, below,
// a scrolling block with the numbers. The mission buttons open a row of
// chips; a chip starts the map tap (WwWingController). No hover anywhere:
// a greyed button says why when tapped.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WP_FERRY } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { zoneWeather } from "./AirModel";
import { blockText } from "./EconomyModel";
import { navyCtx, NavyCtx, NavyGame } from "./NavyModel";
import {
  baseName,
  cardNumbers,
  chosenWings,
  fmtTenths,
  GROUP_ICONS,
  groupChips,
  groupsFor,
  inAir,
  missionOf,
  missionOrder,
  orderLine,
  phaseNow,
  standDownOrder,
  stateKeyOf,
  strengthPm,
  underRtb,
  WingChip,
  wingMax,
  wingName,
} from "./WingModel";
import { WingGroup, WingMode, wingUiOf, WwWingChangedEvent } from "./WingUi";
import { isCapitulated, today, TWO_TAP_MIN_MS } from "./WorldWarModel";
import {
  CARD_MIN_PX,
  CardPlace,
  cardPlace,
  placeStyle,
  samePlace,
} from "./WwArmyCard";
import { WwDrawerEvent } from "./WwDrawer";

const GAP = 8;
const BTN =
  "relative flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-xs leading-none";
const IDLE = "border-white/15 bg-white/10 hover:bg-white/20";
const PRESSED = "border-amber-300 bg-amber-700/50";
const GREY = "border-white/5 bg-white/5 text-white/35";

@customElement("ww-wing-card")
export class WwWingCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private place: CardPlace = {
    bottom: GAP,
    right: null,
    maxWidth: 560,
    maxHeight: CARD_MIN_PX,
  };
  /** The numbers block: on a landscape phone it takes the buttons' place. */
  @state() private info = false;
  /** The escort chip was tapped: the bomber wings to escort show instead of the map tap. */
  @state() private escortPick = false;
  /** The button tapped while greyed, and why. */
  @state() private why = "";
  private redrawKey: readonly unknown[] = [];
  private disbandAt = 0;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwWingChangedEvent, () => {
      // The place is also fitted here: tick() does not run while paused.
      this.refit();
      this.requestUpdate();
    });
    this.eventBus.on(WwDrawerEvent, () => {
      void this.updateComplete.then(() =>
        requestAnimationFrame(() => this.refit()),
      );
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const ui = wingUiOf(this.game);
    if (ui.ids.length === 0 && ui.mode !== "field") return;
    this.refit();
    const key = [
      ui.version,
      this.game.wwAir?.()?.version,
      this.game.wwEconomy?.()?.version,
      Math.floor(this.game.ticks() / 3),
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private refit() {
    const next = cardPlace();
    if (!samePlace(next, this.place)) this.place = next;
  }

  private send(o: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(o));
  }

  private changed() {
    wingUiOf(this.game).bump();
    this.eventBus.emit(new WwWingChangedEvent());
  }

  private ctx(): NavyCtx | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const p = this.game.myPlayer();
    if (p === null || !p.isAlive() || isCapitulated(this.game, p.smallID())) {
      return null;
    }
    return navyCtx(this.game as unknown as NavyGame);
  }

  private setMode(mode: WingMode) {
    const ui = wingUiOf(this.game);
    ui.mode = mode;
    ui.pending = 0;
    ui.refused = "";
    this.why = "";
    this.changed();
  }

  private chooseChip(chip: WingChip) {
    const ui = wingUiOf(this.game);
    if (chip.mission === "escort") {
      this.escortPick = true;
      this.requestUpdate();
      return;
    }
    ui.mission = chip.mission;
    ui.cls = chip.cls;
    this.setMode("mission");
  }

  render() {
    // Lit renders the element before the renderer hands it the game.
    if (this.game === undefined) return nothing;
    const ui = wingUiOf(this.game);
    const ctx = this.ctx();
    if (ctx === null) return nothing;
    const wings = chosenWings(ctx, ui);
    if (wings.length === 0) this.escortPick = false;
    // The field strip mode has no wing: its own hint strip.
    if (wings.length === 0) {
      return ui.mode === "field" ? this.renderFieldStrip(ctx) : nothing;
    }
    const many = wings.length > 1;
    const first = wings[0];
    const mode = ui.mode;
    // Room for the numbers under the two rows (a tablet); a phone swaps them in.
    const room = this.place.maxHeight > CARD_MIN_PX + 40;
    const showInfo = this.info && mode === "none";
    const showButtons = mode === "none" && (!showInfo || room);
    return html`<section
      data-ww-wing-card=${first.id}
      data-collapsed=${String(!showInfo)}
      aria-label=${many
        ? translateText("ww1936.wing.many", { n: wings.length })
        : wingName(first)}
      class="fixed z-[1001] flex flex-col gap-1 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${this.renderHead(ctx, wings)}
      ${mode !== "none"
        ? this.renderModeRow(ctx, wings)
        : showButtons
          ? this.renderButtons(ctx, wings)
          : nothing}
      ${showInfo ? this.renderMore(ctx, wings) : nothing}
    </section>`;
  }

  private renderFieldStrip(ctx: NavyCtx): TemplateResult {
    const ui = wingUiOf(this.game);
    return html`<section
      data-ww-wing-card="field"
      class="fixed z-[1001] flex items-center gap-1.5 rounded-lg border border-white/15 bg-gray-900/92 p-1 pl-2 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
    >
      <span class="min-w-0 flex-1"
        >${ui.pending !== 0
          ? translateText("ww1936.wing.hint_field_again", {
              region: ctx.scenario.region(ui.pending)?.name ?? "",
            })
          : translateText("ww1936.wing.hint_field")}</span
      >
      ${this.cancelButton()}
    </section>`;
  }

  private cancelButton(): TemplateResult {
    return html`<button
      type="button"
      data-ww-wing-cancel
      class="${BTN} ${IDLE} w-10"
      aria-label=${translateText("common.cancel")}
      @click=${() => {
        wingUiOf(this.game).reset();
        this.changed();
      }}
    >
      ✕
    </button>`;
  }

  /** Name, planes bar, experience, the order line; fold and close. */
  private renderHead(ctx: NavyCtx, wings: ReturnType<typeof chosenWings>) {
    const many = wings.length > 1;
    const w = wings[0];
    const planes = wings.reduce((a, x) => a + x.planes, 0);
    const max = wings.reduce((a, x) => a + wingMax(x), 0);
    const pm = Math.floor((planes * 1000) / Math.max(1, max));
    const ticks = this.game.ticks();
    const ph = phaseNow(ctx.air, w, ticks);
    const state = many
      ? ""
      : `${translateText(stateKeyOf(ph.phase, w.planes))}${ph.left > 0 ? ` · ${translateText("ww1936.wing.days_left", { d: fmtTenths(Math.floor((ph.left * 100) / 75)) })}` : ""}`;
    return html`<div class="flex shrink-0 items-center gap-1.5">
      <span aria-hidden="true">✈</span>
      <span data-ww-wing-name class="min-w-0 shrink truncate text-sm font-bold"
        >${many
          ? translateText("ww1936.wing.many", { n: wings.length })
          : wingName(w)}</span
      >
      <span data-ww-wing-planes class="shrink-0 tabular-nums text-white/80"
        >${planes}/${max}</span
      >
      <span class="h-1.5 w-10 shrink-0 rounded bg-white/10"
        ><span
          class="block h-1.5 rounded ${pm >= 600
            ? "bg-emerald-400"
            : pm >= 300
              ? "bg-amber-400"
              : "bg-red-500"}"
          style="width: ${Math.min(100, pm / 10)}%"
        ></span
      ></span>
      ${many
        ? nothing
        : html`<span class="shrink-0 text-amber-200"
            >${"★".repeat(cardNumbers(ctx, w).tier)}${w.ace !== 0
              ? " ✪"
              : ""}</span
          >`}
      <span data-ww-wing-line class="min-w-0 flex-1 truncate text-white/80"
        >${many ? "" : orderLine(ctx, w)}
        ${state === "" ? "" : `· ${state}`}</span
      >
      <button
        type="button"
        data-ww-card-fold=${this.info ? "fold" : "open"}
        aria-pressed=${String(this.info)}
        class="${BTN} ${this.info ? PRESSED : IDLE} w-10"
        aria-label=${translateText("ww1936.wing.details")}
        @click=${() => (this.info = !this.info)}
      >
        ℹ
      </button>
      <button
        type="button"
        data-ww-card-close
        class="${BTN} ${IDLE} w-10"
        aria-label=${translateText("common.close")}
        @click=${() => {
          wingUiOf(this.game).clear();
          this.changed();
        }}
      >
        ✕
      </button>
    </div>`;
  }

  /** The second row: the mission groups, [기지], [자동]; or a group's chips. */
  private renderButtons(ctx: NavyCtx, wings: ReturnType<typeof chosenWings>) {
    const ui = wingUiOf(this.game);
    const carrier = wings.some((w) => w.base < 0);
    const grey = carrier || wings.every((w) => w.planes <= 0);
    const group = ui.group;
    if (this.escortPick) return this.renderEscortPick(ctx, wings);
    if (group !== null) {
      const chips = groupChips(group, wings);
      return html`<div
        data-ww-wing-chips=${group}
        class="flex shrink-0 flex-wrap items-center gap-1"
      >
        <button
          type="button"
          data-ww-wing-back
          class="${BTN} ${IDLE}"
          aria-label=${translateText("common.back")}
          @click=${() => {
            ui.group = null;
            this.changed();
          }}
        >
          ◂ ${GROUP_ICONS[group]}
        </button>
        ${chips.map(
          (c) =>
            html`<button
              type="button"
              data-ww-wing-chip=${c.id}
              class="${BTN} ${IDLE}"
              @click=${() => this.chooseChip(c)}
            >
              ${translateText(c.key)}
            </button>`,
        )}
      </div>`;
    }
    const auto = wings.every((w) => w.auto);
    return html`<div
      data-ww-wing-buttons
      class="flex shrink-0 flex-wrap items-center gap-1"
    >
      ${groupsFor(wings).map(
        (g) =>
          html`<button
            type="button"
            data-ww-wing-group=${g}
            aria-disabled=${String(grey)}
            class="${BTN} ${grey ? GREY : IDLE}"
            @click=${() => this.tapGroup(g, grey, carrier)}
          >
            <span aria-hidden="true">${GROUP_ICONS[g]}</span>
            <span>${translateText(`ww1936.wing.group_${g}`)}</span>
          </button>`,
      )}
      <button
        type="button"
        data-ww-wing-base
        aria-disabled=${String(grey)}
        class="${BTN} ${grey ? GREY : IDLE}"
        @click=${() => {
          if (grey) {
            this.why = carrier ? "bad_air_mission" : "no_air_base";
            this.requestUpdate();
            return;
          }
          this.setMode("base");
        }}
      >
        <span aria-hidden="true">🛬</span>
        <span>${translateText("ww1936.wing.btn_base")}</span>
      </button>
      <button
        type="button"
        role="switch"
        data-ww-wing-auto
        aria-checked=${String(auto)}
        class="${BTN} ${auto
          ? "border-emerald-400/70 bg-emerald-900/50 text-emerald-100"
          : IDLE}"
        @click=${() =>
          this.send({
            kind: "wing_auto",
            wings: wings.map((w) => w.id).slice(0, 20),
            on: !auto,
          })}
      >
        <span aria-hidden="true">🤖</span>
        <span>${translateText("ww1936.wing.btn_auto")}</span>
      </button>
      ${this.why === ""
        ? nothing
        : html`<span data-ww-wing-why class="text-amber-300"
            >${blockText(this.why as WwOrderBlock)}</span
          >`}
    </div>`;
  }

  private tapGroup(g: WingGroup, grey: boolean, carrier: boolean) {
    if (grey) {
      this.why = carrier ? "bad_air_mission" : "no_air_base";
      this.requestUpdate();
      return;
    }
    this.why = "";
    const ui = wingUiOf(this.game);
    const wings = chosenWings(this.ctx()!, ui);
    const chips = groupChips(g, wings);
    // A group with one chip goes straight to the map.
    if (chips.length === 1) return this.chooseChip(chips[0]);
    ui.group = g;
    this.changed();
  }

  /** Escort: the bomber wings it may fly with, as chips (no token tap needed). */
  private renderEscortPick(
    ctx: NavyCtx,
    wings: ReturnType<typeof chosenWings>,
  ) {
    const bombers = [...ctx.air.wings.values()].filter(
      (b) =>
        b.owner === ctx.me &&
        b.target !== 0 &&
        b.mission >= 0 &&
        ["strategic_bombing", "port_strike"].includes(missionOf(b.mission)),
    );
    return html`<div
      data-ww-wing-escort
      class="flex shrink-0 flex-wrap items-center gap-1"
    >
      <button
        type="button"
        class="${BTN} ${IDLE}"
        aria-label=${translateText("common.back")}
        @click=${() => {
          this.escortPick = false;
          this.requestUpdate();
        }}
      >
        ◂ ${GROUP_ICONS.air}
      </button>
      ${bombers.length === 0
        ? html`<span class="text-white/70"
            >${translateText("ww1936.wing.escort_none")}</span
          >`
        : bombers.map(
            (b) =>
              html`<button
                type="button"
                data-ww-wing-escort-pick=${b.id}
                class="${BTN} ${IDLE}"
                @click=${() => this.escortWith(ctx, wings, b.id)}
              >
                ${wingName(b)}
              </button>`,
          )}
      ${this.why === ""
        ? nothing
        : html`<span data-ww-wing-why class="text-amber-300"
            >${blockText(this.why as WwOrderBlock)}</span
          >`}
    </div>`;
  }

  private escortWith(
    ctx: NavyCtx,
    wings: ReturnType<typeof chosenWings>,
    bomber: number,
  ) {
    const r = missionOrder(ctx, wings, {
      mission: "escort",
      target: 0,
      army: 0,
      escort: bomber,
      cls: 0,
    });
    if (r.order === null) {
      this.why = r.blocked ?? "bad_air_mission";
      this.requestUpdate();
      return;
    }
    this.why = "";
    this.escortPick = false;
    this.send(r.order);
    wingUiOf(this.game).reset();
    this.changed();
  }

  /** While a tap is awaited: the prompt, the refusal, [stand down] and [cancel]. */
  private renderModeRow(ctx: NavyCtx, wings: ReturnType<typeof chosenWings>) {
    const ui = wingUiOf(this.game);
    let hint: string;
    if (ui.mode === "base") {
      hint =
        ui.pending !== 0
          ? translateText("ww1936.wing.hint_base_again", {
              region: ctx.scenario.region(ui.pending)?.name ?? "",
            })
          : translateText("ww1936.wing.hint_base");
    } else {
      hint = translateText("ww1936.wing.hint_target", {
        mission: translateText(`ww1936.air_mission.${ui.mission}`),
      });
    }
    return html`<div
      data-ww-wing-mode=${ui.mode}
      class="flex shrink-0 items-center gap-1"
    >
      <span data-ww-wing-hint class="min-w-0 flex-1"
        >${hint}
        ${ui.refused === ""
          ? nothing
          : html`<span data-ww-wing-refused class="text-amber-300">
              · ${blockText(ui.refused as WwOrderBlock)}</span
            >`}</span
      >
      ${ui.mode === "mission"
        ? html`<button
            type="button"
            data-ww-wing-standdown
            class="${BTN} ${IDLE}"
            @click=${() => {
              this.send(standDownOrder(wings));
              ui.reset();
              this.changed();
            }}
          >
            ${translateText("ww1936.wing.btn_stand_down")}
          </button>`
        : nothing}
      ${this.cancelButton()}
    </div>`;
  }

  /** The numbers, yesterday, [night] and [disband] (scrolls inside the card). */
  private renderMore(ctx: NavyCtx, wings: ReturnType<typeof chosenWings>) {
    const ui = wingUiOf(this.game);
    const w = wings[0];
    const many = wings.length > 1;
    const n = cardNumbers(ctx, w);
    const sr = w.base > 0 ? ctx.scenario.regionSr(w.base) : 0;
    const weather =
      sr === 0 ? null : zoneWeather(ctx.scenario, sr, today(this.game));
    const ph = phaseNow(ctx.air, w, this.game.ticks());
    const nightOn = wings.every((x) => x.night);
    return html`<div
      data-ww-wing-more
      class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
    >
      ${many
        ? html`<div class="text-white/80">
            ${translateText("ww1936.wing.many_note", { n: wings.length })}
          </div>`
        : html`<div class="flex flex-wrap gap-x-3 gap-y-0.5 text-white/80">
            ${n.effPm <= 0
              ? nothing
              : html`<span data-ww-wing-eff
                  >${translateText("ww1936.wing.eff", {
                    pct: Math.floor(n.effPm / 10),
                  })}</span
                >`}
            ${weather === null
              ? nothing
              : html`<span
                  >${translateText("ww1936.air.zone_weather", {
                    weather: translateText(`ww1936.weather.${weather}`),
                  })}</span
                >`}
            <span
              >${translateText("ww1936.wing.base_at", {
                base: baseName(ctx, w.base),
              })}</span
            >
            ${n.roundDaysX10 === null
              ? nothing
              : html`<span data-ww-wing-cycle
                  >${translateText("ww1936.wing.cycle", {
                    days: fmtTenths(n.roundDaysX10),
                    sorties: fmtTenths(n.sortiesPerDayX10 ?? 0),
                  })}</span
                >`}
            <span
              >${translateText("ww1936.wing.yesterday", {
                kills: w.prevKills,
                lost: w.prevLost,
              })}</span
            >
            <span
              >${translateText("ww1936.wing.tier", {
                tier: translateText(`ww1936.wing.tier_${n.tier}`),
                kills: w.kills,
              })}</span
            >
            ${underRtb(w)
              ? html`<span class="text-amber-300"
                  >${translateText("ww1936.wing.under_strength", {
                    pct: Math.floor(strengthPm(w) / 10),
                  })}</span
                >`
              : nothing}
            ${inAir(ph)
              ? html`<span data-ww-wing-next class="text-sky-300"
                  >${translateText("ww1936.wing.next_sortie")}</span
                >`
              : nothing}
            ${ph.phase === WP_FERRY
              ? html`<span class="text-sky-300"
                  >${translateText("ww1936.wing.ferrying")}</span
                >`
              : nothing}
          </div>`}
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          role="switch"
          data-ww-wing-night
          aria-checked=${String(nightOn)}
          class="${BTN} ${nightOn ? PRESSED : IDLE}"
          @click=${() => {
            for (const x of wings) {
              this.send({ kind: "air_night", deployment: x.id, on: !nightOn });
            }
          }}
        >
          🌙 ${translateText("ww1936.wing.btn_night")}
        </button>
        ${many
          ? nothing
          : html`<button
              type="button"
              data-ww-wing-disband
              class="${BTN} ${ui.disbandAsk
                ? "border-red-400 bg-red-900/60"
                : IDLE}"
              @click=${() => this.tapDisband(w.id)}
            >
              ${ui.disbandAsk
                ? translateText("ww1936.wing.btn_disband_confirm")
                : translateText("ww1936.wing.btn_disband")}
            </button>`}
      </div>
    </div>`;
  }

  /** Disbanding is two taps: the second must not be a double tap. */
  private tapDisband(id: number) {
    const ui = wingUiOf(this.game);
    const now = Date.now();
    if (!ui.disbandAsk) {
      ui.disbandAsk = true;
      this.disbandAt = now;
      this.changed();
      return;
    }
    if (now - this.disbandAt < TWO_TAP_MIN_MS) return;
    this.send({ kind: "wing_disband", wing: id });
    ui.clear();
    this.changed();
  }
}
