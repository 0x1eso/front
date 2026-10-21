// World War 1936 P4 (spec §18.4, §18.11): the chosen fleet's card, bottom
// centre like P2's army card, at most a quarter of the map tall — its
// name, admiral, ships by class (the named ones on a tap), bars, fuel a
// day, state, engage rule and return threshold; the order buttons (a
// greyed one says why when tapped, from the same engine-lib judge); the
// preview of a pending map tap. Left of an open drawer, never over it; it
// folds to a strip on a short screen and while an order is being given.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FleetMission,
  RETURN_AT_PCTS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { blockText } from "./EconomyModel";
import { regionName } from "./LandModel";
import {
  ADMIRAL_TRAIT_ICONS,
  admiralName,
  admiralTraits,
  engageName,
  FleetBlock,
  fleetBlockText,
  FleetButton,
  fleetCard,
  FleetCardData,
  fleetFromZone,
  freeAdmirals,
  homePorts,
  MISSION_ICONS,
  missionName,
  missionPreview,
  moveTarget,
  NavyCtx,
  navyCtx,
  NavyGame,
  SHIP_ICONS,
  shipClassName,
  shipGenName,
  shipName,
  splitOrder,
  srName,
  zoneName,
} from "./NavyModel";
import { WwFleetSelectedEvent } from "./SeaAirSelection";
import { isCapitulated } from "./WorldWarModel";
import {
  CARD_FOLD_MAX_HEIGHT,
  CARD_MIN_PX,
  CardPlace,
  cardPlace,
  placeStyle,
  samePlace,
} from "./WwArmyCard";
import { WwDrawerEvent } from "./WwDrawer";
import {
  seaAirOf,
  WwSeaAirChangedEvent,
  WwSeaAirModeEvent,
} from "./WwSeaAirController";

const BUTTON_KEYS: Readonly<Record<FleetButton, string>> = {
  mission: "ww1936.navy.btn_mission",
  move: "ww1936.navy.btn_move",
  return: "ww1936.navy.btn_return",
  engage: "ww1936.navy.btn_engage",
  split: "ww1936.navy.btn_split",
  merge: "ww1936.navy.btn_merge",
  port_strike: "ww1936.navy.btn_port_strike",
  auto: "ww1936.navy.btn_auto",
  more: "ww1936.navy.btn_more",
};

const BUTTON_ICONS: Readonly<Record<FleetButton, string>> = {
  mission: "🎯",
  move: "➜",
  return: "⚓",
  engage: "⚔",
  split: "✂",
  merge: "⊕",
  port_strike: "💥",
  auto: "🤖",
  more: "⋯",
};

/** Spec §9.6 deck shares in tenths: fighter / CAS / torpedo bomber. */
export const DECK_MIXES: readonly [number, number, number][] = [
  [4, 3, 3],
  [6, 2, 2],
  [2, 2, 6],
  [3, 5, 2],
];

type Panel =
  | "main"
  | "missions"
  | "engage"
  | "more"
  | "admiral"
  | "base"
  | "deck";

const GAP = 8;

@customElement("ww-fleet-card")
export class WwFleetCard extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /** The button tapped while it was greyed, and why. */
  @state() private refused: { id: string; block: FleetBlock } | null = null;
  @state() private panel: Panel = "main";
  @state() private place: CardPlace = {
    bottom: GAP,
    right: null,
    maxWidth: 560,
    maxHeight: CARD_MIN_PX,
  };
  @state() private collapsed = false;
  @state() private openWhileOrdering = false;
  /** The named ships' list under the class counts. */
  @state() private showShips = false;
  private wasOrdering = false;
  private shownFleet = 0;
  private redrawKey: readonly unknown[] = [];

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(WwSeaAirChangedEvent, () => this.redraw());
    this.eventBus.on(WwDrawerEvent, () => {
      void this.updateComplete.then(() =>
        requestAnimationFrame(() => this.refit()),
      );
    });
  }

  getTickIntervalMs() {
    return 250;
  }

  private get state() {
    return seaAirOf(this.game);
  }

  tick() {
    if ((this.game?.worldWarScenario() ?? null) === null) return;
    const { selection, draft } = this.state;
    if (selection.fleet === 0) {
      if (this.shownFleet !== 0) this.redraw();
      return;
    }
    this.refit();
    const key = [
      selection.version,
      draft.version,
      this.game.wwNavy?.()?.version,
      this.game.wwEconomy?.()?.version,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.sync();
      this.requestUpdate();
    }
  }

  private sync() {
    const { selection, draft } = this.state;
    if (selection.fleet !== this.shownFleet) {
      this.shownFleet = selection.fleet;
      this.panel = "main";
      this.refused = null;
      this.showShips = false;
      this.collapsed = window.innerHeight <= CARD_FOLD_MAX_HEIGHT;
    }
    const ordering = draft.mode !== "none" && draft.mode !== "invade";
    if (ordering !== this.wasOrdering) {
      this.wasOrdering = ordering;
      this.openWhileOrdering = false;
    }
  }

  private redraw() {
    this.sync();
    if (this.state.selection.fleet !== 0) this.refit();
    this.requestUpdate();
  }

  private refit() {
    const next = cardPlace();
    if (!samePlace(next, this.place)) this.place = next;
  }

  private ctx(): { ctx: NavyCtx; card: FleetCardData } | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const p = this.game.myPlayer();
    if (p === null || !p.isAlive() || isCapitulated(this.game, p.smallID())) {
      return null;
    }
    const fleet = this.state.selection.fleet;
    if (fleet === 0) return null;
    const ctx = navyCtx(this.game as unknown as NavyGame);
    const card = ctx === null ? null : fleetCard(ctx, fleet);
    return ctx === null || card === null ? null : { ctx, card };
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  private setMode(
    mode: WwSeaAirModeEvent["mode"],
    mission: FleetMission = "patrol",
  ) {
    this.eventBus.emit(new WwSeaAirModeEvent(mode, mission));
  }

  private ordering(): boolean {
    const m = this.state.draft.mode;
    return m !== "none" && m !== "invade";
  }

  private tapButton(
    c: FleetCardData,
    id: FleetButton,
    block: FleetBlock | null,
  ) {
    if (block !== null) {
      this.refused = { id, block };
      return;
    }
    this.refused = null;
    const f = c.fleet;
    const mode = this.state.draft.mode;
    switch (id) {
      case "mission":
        this.panel = "missions";
        return;
      case "move":
        this.setMode(mode === "move" ? "none" : "move");
        return;
      case "return":
        this.send({ kind: "fleet_return", fleet: f.id });
        return;
      case "engage":
        this.panel = "engage";
        return;
      case "split":
        this.send(splitOrder(f));
        return;
      case "merge":
        if (c.mergeWith.length === 1) {
          this.send({ kind: "fleet_merge", fleet: f.id, into: c.mergeWith[0] });
          this.eventBus.emit(new WwFleetSelectedEvent(c.mergeWith[0]));
        } else {
          this.setMode(mode === "merge" ? "none" : "merge");
        }
        return;
      case "port_strike":
        this.setMode(mode === "port_strike" ? "none" : "port_strike");
        return;
      case "auto":
        this.send({ kind: "fleet_auto", fleet: f.id, on: !c.auto });
        return;
      case "more":
        this.panel = "more";
        return;
    }
  }

  private pickMission(
    c: { ctx: NavyCtx; card: FleetCardData },
    m: FleetMission,
  ) {
    this.panel = "main";
    if (m === "hold") {
      // Hold stays where it is: no region to pick.
      const zone = fleetFromZone(c.ctx, c.card.fleet);
      const sr = c.ctx.scenario.zoneSr(zone);
      if (sr !== 0) {
        this.send({
          kind: "fleet_mission",
          fleet: c.card.fleet.id,
          mission: m,
          sr,
        });
      }
      return;
    }
    this.setMode("mission", m);
  }

  render() {
    const c = this.ctx();
    if (c === null) return nothing;
    const ordering = this.ordering();
    const strip = ordering ? !this.openWhileOrdering : this.collapsed;
    return strip ? this.renderStrip(c, ordering) : this.renderFull(c);
  }

  private renderStrip(
    c: { ctx: NavyCtx; card: FleetCardData },
    ordering: boolean,
  ): TemplateResult {
    const f = c.card.fleet;
    const worst = Math.min(f.hpPm, f.orgPm);
    return html`<section
      data-ww-fleet-card=${f.id}
      data-collapsed="true"
      aria-label=${c.card.name}
      class="fixed z-[1001] flex items-center gap-1.5 rounded-lg border border-white/15 bg-gray-900/70 p-0.5 pl-2 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <span class="shrink-0 font-bold">${c.card.name}</span>
      <span class="shrink-0 tabular-nums text-white/70"
        >${translateText("ww1936.navy.ships_total", {
          n: c.card.numbers.ships,
        })}</span
      >
      <span class="h-1.5 w-12 shrink-0 rounded bg-white/10"
        ><span
          class="block h-1.5 rounded ${worst >= 600
            ? "bg-emerald-400"
            : worst >= 300
              ? "bg-amber-400"
              : "bg-red-500"}"
          style="width: ${Math.max(0, Math.min(1000, worst)) / 10}%"
        ></span
      ></span>
      <span data-ww-strip-line class="min-w-0 flex-1 truncate">
        ${ordering || this.refused !== null
          ? this.renderLine(c, true)
          : translateText(c.card.status.key, c.card.status.params)}
      </span>
      ${ordering
        ? this.button(
            "cancel",
            translateText("ww1936.navy.btn_cancel"),
            "✕",
            () => this.setMode("none"),
          )
        : nothing}
      ${this.foldButton(true)} ${this.closeButton()}
    </section>`;
  }

  private foldButton(folded: boolean): TemplateResult {
    return html`<button
      type="button"
      data-ww-card-fold=${folded ? "open" : "fold"}
      class="size-9 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
      aria-label=${translateText(
        folded ? "ww1936.navy.card_expand" : "ww1936.navy.card_collapse",
      )}
      @click=${() => {
        if (this.ordering()) this.openWhileOrdering = folded;
        else this.collapsed = !folded;
      }}
    >
      ${folded ? "▴" : "▾"}
    </button>`;
  }

  private closeButton(): TemplateResult {
    return html`<button
      type="button"
      data-ww-card-close
      class="size-9 shrink-0 rounded-md border border-white/10 hover:bg-white/10"
      aria-label=${translateText("common.close")}
      @click=${() => this.eventBus.emit(new WwFleetSelectedEvent(0))}
    >
      ✕
    </button>`;
  }

  private renderFull(c: { ctx: NavyCtx; card: FleetCardData }): TemplateResult {
    const d = c.card;
    const f = d.fleet;
    const line = this.renderLine(c);
    return html`<section
      data-ww-fleet-card=${f.id}
      data-collapsed="false"
      aria-label=${d.name}
      class="fixed z-[1001] flex max-h-[25vh] gap-2 overflow-y-auto rounded-lg border border-white/15 bg-gray-900/92 p-1.5 text-xs text-white shadow-xl"
      style=${placeStyle(this.place)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex min-w-0 items-baseline gap-1.5">
          <span class="shrink-0 text-sm font-bold">${d.name}</span>
          ${this.renderAdmiral(d)}
        </div>
        <button
          type="button"
          data-ww-fleet-counts
          aria-expanded=${String(this.showShips)}
          class="flex min-h-9 flex-wrap items-center gap-x-2 text-left tabular-nums"
          @click=${() => (this.showShips = !this.showShips)}
        >
          ${d.counts.map(
            ([cls, n]) =>
              html`<span data-ww-fleet-count=${cls}
                ><span aria-hidden="true">${SHIP_ICONS[cls]}</span>
                <span class="sr-only">${shipClassName(cls)}</span>${n}</span
              >`,
          )}
          <span class="text-white/60">${this.showShips ? "▾" : "▸"}</span>
        </button>
        ${this.showShips ? this.renderShips(c) : nothing}
        ${this.renderBars(f.hpPm, f.orgPm)}
        ${line !== nothing && this.place.maxHeight <= CARD_MIN_PX
          ? nothing
          : html`<div
              data-ww-fleet-status
              class="flex flex-wrap gap-x-2 text-white/80"
            >
              <span>${translateText(d.status.key, d.status.params)}</span>
              ${d.lowFuel
                ? html`<span data-ww-low-fuel class="text-red-300"
                    >${translateText("ww1936.navy.state_no_fuel")}</span
                  >`
                : nothing}
              <span data-ww-fleet-fuel
                >${translateText("ww1936.navy.fuel_day", {
                  n: (d.numbers.fuelPerDayMilli / 1000).toFixed(1),
                })}</span
              >
              <span data-ww-fleet-engage
                >${translateText("ww1936.navy.engage_line", {
                  rule: engageName(f.engage),
                })}</span
              >
              <span data-ww-fleet-return
                >${translateText("ww1936.navy.return_line", {
                  pct: f.returnAtPct,
                })}</span
              >
            </div>`}
        ${line}
      </div>
      <div
        data-ww-card-buttons=${this.panel}
        class="grid shrink-0 grid-cols-5 content-start gap-1"
      >
        ${this.renderPanel(c)}
      </div>
      <div class="flex shrink-0 flex-col gap-1">
        ${this.foldButton(false)} ${this.closeButton()}
      </div>
    </section>`;
  }

  private renderAdmiral(d: FleetCardData): TemplateResult {
    const a = d.admiral;
    if (a === null) {
      return html`<span data-ww-fleet-admiral class="truncate text-white/60"
        >${translateText("ww1936.navy.admiral_none")}</span
      >`;
    }
    return html`<span
      data-ww-fleet-admiral
      class="flex min-w-0 items-baseline gap-1.5"
    >
      <span class="min-w-0 truncate font-semibold">${a.name}</span>
      ${admiralTraits(a.def).map(
        (t) =>
          html`<span
            data-ww-trait=${t}
            role="img"
            class="shrink-0"
            aria-label=${translateText(`ww1936.admiral_trait.${t}`)}
            >${ADMIRAL_TRAIT_ICONS[t]}</span
          >`,
      )}
      ${a.def === null
        ? nothing
        : html`<span class="min-w-0 truncate tabular-nums text-white/60"
            >${translateText("ww1936.navy.admiral_stats", {
              a: a.def.atk,
              d: a.def.def,
              m: a.def.man,
              c: a.def.coord,
            })}</span
          >`}
    </span>`;
  }

  private renderShips(c: {
    ctx: NavyCtx;
    card: FleetCardData;
  }): TemplateResult {
    const ships = [...c.card.fleet.ships].sort((a, b) => a.id - b.id);
    return html`<ul data-ww-fleet-ships class="m-0 list-none p-0">
      ${ships.map(
        (s) =>
          html`<li data-ww-ship=${s.id} class="flex items-center gap-1.5">
            <span aria-hidden="true">${SHIP_ICONS[s.cls]}</span>
            <span class="min-w-0 flex-1 truncate"
              >${shipName(c.ctx.scenario, s)}</span
            >
            <span class="shrink-0 text-white/60">${shipGenName(s.gen)}</span>
            <span class="w-10 shrink-0 text-right tabular-nums"
              >${Math.round(s.hpPm / 10)}%</span
            >
          </li>`,
      )}
    </ul>`;
  }

  private renderBars(hpPm: number, orgPm: number): TemplateResult {
    const bar = (id: string, pm: number, color: string, key: string) =>
      html`<div
        data-ww-bar=${id}
        role="img"
        aria-label=${`${translateText(key)} ${Math.round(pm / 10)}%`}
        class="h-1.5 rounded bg-white/10"
      >
        <div
          class="h-1.5 rounded ${color}"
          style="width: ${Math.max(0, Math.min(1000, pm)) / 10}%"
        ></div>
      </div>`;
    return html`<div class="flex flex-col gap-0.5">
      ${bar("hp", hpPm, "bg-emerald-400", "ww1936.navy.stat_hp")}
      ${bar("org", orgPm, "bg-sky-400", "ww1936.navy.stat_org")}
    </div>`;
  }

  /** The line under the state: a refusal, a pending tap's preview, or the mode's hint. */
  private renderLine(
    c: { ctx: NavyCtx; card: FleetCardData },
    compact = false,
  ): TemplateResult | typeof nothing {
    const cls = `${compact ? "" : "block "}`;
    if (this.refused !== null) {
      return html`<span
        data-ww-block=${this.refused.block}
        class="${cls}text-red-300"
        >🔒 ${fleetBlockText(this.refused.block)}</span
      >`;
    }
    const d = this.state.draft;
    const f = c.card.fleet;
    const sc = c.ctx.scenario;
    switch (d.mode) {
      case "mission": {
        if (d.pending === 0) {
          return html`<span data-ww-hint="mission" class="${cls}text-amber-200"
            >${MISSION_ICONS[d.mission]} ${missionName(d.mission)} ·
            ${translateText(`ww1936.mission_desc.${d.mission}`)} ·
            ${translateText("ww1936.navy.hint_pick_zone")}</span
          >`;
        }
        const p = missionPreview(c.ctx, f, d.mission, d.pending);
        return html`<span
          data-ww-preview="mission"
          class="${compact
            ? "inline-flex max-w-full gap-x-2 whitespace-nowrap"
            : "flex flex-wrap items-baseline gap-x-2"}"
        >
          <span>${MISSION_ICONS[d.mission]} ${srName(sc, p.sr)}</span>
          <span data-ww-preview-sup
            >${translateText("ww1936.navy.preview_sup", {
              pct: Math.floor(p.supPm / 10),
            })}</span
          >
          <span data-ww-preview-enemy
            >${translateText("ww1936.navy.preview_enemy", {
              n: Math.round(p.enemyPower / 100),
            })}</span
          >
          ${p.ratioPm === null
            ? nothing
            : html`<span
                data-ww-preview-odds
                class=${p.ratioPm >= 1000 ? "text-emerald-300" : "text-red-300"}
                >${translateText("ww1936.navy.preview_odds", {
                  ratio: (Math.min(p.ratioPm, 99_000) / 1000).toFixed(2),
                })}</span
              >`}
          ${p.km === null
            ? nothing
            : html`<span data-ww-preview-km
                >${translateText("ww1936.navy.preview_distance", {
                  km: Math.round(p.km),
                  days: p.days,
                })}</span
              >`}
          <span data-ww-preview-fuel
            >${translateText("ww1936.navy.preview_fuel", {
              n: (p.fuelPerDayMilli / 1000).toFixed(1),
            })}</span
          >
          ${p.block === null
            ? html`<span data-ww-tap-again class="font-semibold text-amber-200"
                >${translateText("ww1936.navy.preview_confirm")}</span
              >`
            : html`<span data-ww-block=${p.block} class="text-red-300"
                >🔒 ${blockText(p.block)}</span
              >`}
        </span>`;
      }
      case "move": {
        if (d.pending === 0) {
          return html`<span data-ww-hint="move" class="${cls}text-amber-200"
            >${translateText("ww1936.navy.hint_pick_sea")}</span
          >`;
        }
        const t = moveTarget(c.ctx, f, d.pending);
        return html`<span data-ww-preview="move" class="${cls}"
          >→ ${zoneName(sc, d.pending)}
          ${t.km === null
            ? nothing
            : html` ·
              ${translateText("ww1936.navy.preview_distance", {
                km: Math.round(t.km),
                days: t.days,
              })}`}
          ·
          <span data-ww-tap-again class="font-semibold text-amber-200"
            >${translateText("ww1936.navy.preview_confirm")}</span
          ></span
        >`;
      }
      case "merge":
        return html`<span data-ww-hint="merge" class="${cls}text-amber-200"
          >${translateText("ww1936.navy.hint_merge")}</span
        >`;
      case "port_strike":
        return d.pending === 0
          ? html`<span data-ww-hint="port_strike" class="${cls}text-amber-200"
              >${translateText("ww1936.navy.hint_port_strike")}</span
            >`
          : html`<span
              data-ww-preview="port_strike"
              class="${cls}text-amber-200"
              >${translateText("ww1936.navy.hint_port_confirm", {
                port: regionName(sc, d.pending),
              })}</span
            >`;
      default:
        return nothing;
    }
  }

  private button(
    id: string,
    label: string,
    icon: string,
    act: () => void,
    opts: { grey?: boolean; pressed?: boolean; wide?: boolean } = {},
  ): TemplateResult {
    return html`<button
      type="button"
      data-ww-fleet-btn=${id}
      aria-disabled=${String(opts.grey ?? false)}
      aria-pressed=${opts.pressed === undefined
        ? nothing
        : String(opts.pressed)}
      aria-label=${label}
      class="flex h-9 min-w-9 flex-col items-center justify-center rounded-md border px-1 leading-none ${opts.wide
        ? "col-span-2"
        : ""} ${opts.grey
        ? "border-white/5 bg-white/5 text-white/35"
        : opts.pressed
          ? "border-amber-300 bg-amber-700/50"
          : "border-white/15 bg-white/10 hover:bg-white/20"}"
      @click=${act}
    >
      <span aria-hidden="true" class="text-sm">${icon}</span>
      <span class="max-w-14 truncate text-xs">${label}</span>
    </button>`;
  }

  private back(): TemplateResult {
    return this.button("back", translateText("common.back"), "←", () => {
      this.panel = "main";
    });
  }

  private renderPanel(c: {
    ctx: NavyCtx;
    card: FleetCardData;
  }): TemplateResult[] {
    const d = c.card;
    const f = d.fleet;
    const mode = this.state.draft.mode;
    switch (this.panel) {
      case "missions":
        return [
          ...FLEET_MISSIONS.map((m) =>
            this.button(
              `mission_${m}`,
              missionName(m),
              MISSION_ICONS[m],
              () => this.pickMission(c, m),
              { pressed: f.mission === m },
            ),
          ),
          this.back(),
        ];
      case "engage":
        return [
          ...ENGAGE_RULES.map((r) =>
            this.button(
              `engage_${r}`,
              engageName(r),
              r === "avoid" ? "🛡" : r === "if_stronger" ? "⚖" : "⚔",
              () => {
                this.send({ kind: "fleet_engage", fleet: f.id, rule: r });
                this.panel = "main";
              },
              { pressed: f.engage === r },
            ),
          ),
          this.back(),
        ];
      case "more":
        return [
          this.button(
            "admiral",
            translateText("ww1936.navy.btn_admiral"),
            "🎖",
            () => (this.panel = "admiral"),
          ),
          this.button(
            "base",
            translateText("ww1936.navy.btn_base"),
            "🏠",
            () => (this.panel = "base"),
          ),
          this.button(
            "return_at",
            translateText("ww1936.navy.return_opt", { pct: f.returnAtPct }),
            "↩",
            () => {
              const i = RETURN_AT_PCTS.indexOf(
                f.returnAtPct as (typeof RETURN_AT_PCTS)[number],
              );
              const pct = RETURN_AT_PCTS[(i + 1) % RETURN_AT_PCTS.length];
              this.send({ kind: "fleet_return_at", fleet: f.id, pct });
            },
          ),
          ...(d.numbers.hasCarrier
            ? [
                this.button(
                  "deck",
                  translateText("ww1936.navy.btn_deck_mix"),
                  "✈",
                  () => (this.panel = "deck"),
                ),
              ]
            : []),
          this.back(),
        ];
      case "admiral":
        return [
          ...freeAdmirals(c.ctx)
            .slice(0, 8)
            .map((id) =>
              this.button(`admiral_${id}`, admiralName(id), "🎖", () => {
                this.send({ kind: "fleet_admiral", fleet: f.id, admiral: id });
                this.panel = "main";
              }),
            ),
          ...(f.admiral > 0
            ? [
                this.button(
                  "admiral_0",
                  translateText("ww1936.navy.admiral_none"),
                  "✖",
                  () => {
                    this.send({
                      kind: "fleet_admiral",
                      fleet: f.id,
                      admiral: 0,
                    });
                    this.panel = "main";
                  },
                ),
              ]
            : []),
          this.back(),
        ];
      case "base":
        return [
          ...homePorts(c.ctx)
            .slice(0, 9)
            .map((r) =>
              this.button(
                `base_${r}`,
                regionName(c.ctx.scenario, r),
                "⚓",
                () => {
                  this.send({ kind: "fleet_base", fleet: f.id, port: r });
                  this.panel = "main";
                },
              ),
            ),
          this.back(),
        ];
      case "deck":
        return [
          ...DECK_MIXES.map((mix) =>
            this.button(`deck_${mix.join("")}`, mix.join("/"), "✈", () => {
              this.send({ kind: "carrier_mix", fleet: f.id, mix });
              this.panel = "main";
            }),
          ),
          this.back(),
        ];
      case "main":
        return d.buttons.map(({ id, block }) =>
          this.button(
            id,
            translateText(BUTTON_KEYS[id]),
            BUTTON_ICONS[id],
            () => this.tapButton(d, id, block),
            {
              grey: block !== null,
              pressed:
                id === "auto"
                  ? d.auto
                  : id === "move" || id === "merge" || id === "port_strike"
                    ? mode === id
                    : id === "mission"
                      ? mode === "mission"
                      : undefined,
            },
          ),
        );
    }
  }
}
