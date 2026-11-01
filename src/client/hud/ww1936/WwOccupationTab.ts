import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_OCC_LAW_COST_PP } from "@openfront/engine-api/ww1936/EndgameTypes";
import type { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GoToPositionEvent } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import {
  coreHoldersNow,
  deciWhole,
  egName,
  type EndgameGame,
  garrisonPending,
  garrisonPlan,
  integrateRows,
  isLiveOcc,
  type LawButton,
  lawButtons,
  lawFor,
  myOccRows,
  myZones,
  occLawName,
  type OwnerRow,
  ownerRows,
  pctOf,
  startGarrison,
  summarize,
} from "./EndgameModel";
import { regionName } from "./LandModel";
import { TWO_TAP_MS, TwoTap, wwActive } from "./WorldWarModel";

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const CARD = "rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs";
/** Rows of "our cores others hold" shown at most. */
const CORES_SHOWN = 10;

/**
 * World War 1936 P5 (spec §20.4): the politics drawer's occupation tab —
 * the whole picture (regions, average resistance and compliance, garrison
 * supply / need) with "raise garrison forces" (two taps), the default law,
 * one row per legal owner (its regions, averages and current law; open,
 * one at a time, it shows the three law buttons with cost, lock days and
 * reason, and its regions by resistance — a tap moves the map there), the
 * regions that can be integrated, my occupation zones (control only, a
 * neutral label: the 38th-parallel zones in Korea carry no resistance) and
 * our cores others hold.
 */
@customElement("ww-occupation-tab")
export class WwOccupationTab extends LitElement {
  @property({ attribute: false }) game: EndgameGame | null = null;
  @property({ attribute: false }) eventBus: EventBus | null = null;
  /** Bumped by the drawer whenever what the tab shows may have changed. */
  @property({ type: Number }) stamp = 0;
  /** The legal owner whose row is open; one at a time (spec §20.9). */
  @state() private openOwner: number | null = null;
  private readonly twoTap = new TwoTap();
  private disarmTimer: ReturnType<typeof setTimeout> | null = null;

  createRenderRoot() {
    return this;
  }

  private send(order: WwOrder) {
    this.eventBus?.emit(new SendWwOrderIntentEvent(order));
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    // Redraw once the arming runs out ("tap again" goes back to the label).
    if (this.disarmTimer !== null) clearTimeout(this.disarmTimer);
    this.disarmTimer = setTimeout(() => {
      this.disarmTimer = null;
      this.requestUpdate();
    }, TWO_TAP_MS + 50);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.disarmTimer !== null) clearTimeout(this.disarmTimer);
    this.disarmTimer = null;
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  private goTo(region: number) {
    const sc = this.game?.worldWarScenario() ?? null;
    if (sc === null) return;
    const t = sc.centerTile(region);
    this.eventBus?.emit(
      new GoToPositionEvent(t % sc.width, Math.floor(t / sc.width)),
    );
  }

  render() {
    const game = this.game;
    const me = game?.myPlayer()?.smallID() ?? 0;
    if (game === null || me === 0 || !wwActive(game, me)) return nothing;
    const rows = myOccRows(game, me);
    const zones = myZones(game, me);
    const cores = this.coresHeld(game, me);
    if (rows.length === 0 && zones.length === 0 && cores.length === 0) {
      return html`<p data-ww-occ-none class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.occ.none")}
      </p>`;
    }
    const s = summarize(rows);
    return html`
      ${rows.length === 0
        ? nothing
        : html`<p data-ww-occ-summary class="m-0 mt-2 text-xs text-white/80">
              ${translateText("ww1936.occ.summary", {
                n: s.regions,
                res: pctOf(s.avgResBp),
                comp: pctOf(s.avgCompBp),
                have: deciWhole(s.supDeci),
                need: deciWhole(s.needDeci),
                pct: s.coveredPct,
              })}
            </p>
            ${this.renderGarrisonButton(game, me)}
            ${this.renderDefaultLaw(game, me)}
            <div class=${HEADING}>${translateText("ww1936.occ.law")}</div>
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              ${ownerRows(game, me).map((o) => this.renderOwner(o))}
            </ul>
            ${this.renderIntegrate(game, me)}`}
      ${this.renderZones(game, zones)} ${this.renderCores(game, cores)}
    `;
  }

  private renderGarrisonButton(game: EndgameGame, me: number): TemplateResult {
    const plan = garrisonPlan(game, me);
    const pending = garrisonPending(game);
    const can = plan !== null && plan.picks.length > 0 && !pending;
    const key = "garrison";
    const armed = can && this.armed(key);
    return html`<div class="mt-1 flex items-center gap-2">
      <button
        type="button"
        data-ww-occ-garrison
        data-armed=${String(armed)}
        class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
        ?disabled=${!can}
        @click=${() =>
          this.confirmTap(key, () =>
            startGarrison(game, me, (o) => this.send(o), Date.now()),
          )}
      >
        ${armed
          ? translateText("ww1936.pol.tap_again")
          : translateText("ww1936.occ.make_garrison")}
      </button>
      <span class="min-w-0 text-xs text-white/60"
        >${translateText("ww1936.occ.make_garrison_hint")}</span
      >
    </div>`;
  }

  /** Spec §8.2: of = 0 sets the law for every legal owner without its own. */
  private renderDefaultLaw(game: EndgameGame, me: number): TemplateResult {
    const law = lawFor(game, me, 0).law;
    return html`<section data-ww-occ-default class="mt-2">
      <div class="text-xs text-white/60">
        ${translateText("ww1936.occ.law_default")}
      </div>
      ${this.renderLaws(0, lawButtons(game, me, 0, law))}
    </section>`;
  }

  private renderLaws(of: number, laws: LawButton[]): TemplateResult {
    return html`<div class="mt-1 grid grid-cols-3 gap-1">
        ${laws.map((b) => {
          const key = `law:${of}:${b.law}`;
          const armed = !b.current && b.block === null && this.armed(key);
          return html`<div class="flex min-w-0 flex-col">
            <button
              type="button"
              data-ww-occ-law=${b.law}
              data-state=${b.current
                ? "current"
                : b.block === null
                  ? "open"
                  : "blocked"}
              data-armed=${String(armed)}
              class="min-h-9 rounded-md border px-1 py-1 text-xs ${b.current
                ? "border-emerald-400 bg-emerald-950/60"
                : b.block === null
                  ? "border-white/20 bg-white/5 hover:border-amber-300"
                  : "border-white/5 bg-gray-900/60 text-white/50"} ${armed
                ? "ring-2 ring-red-400"
                : ""}"
              ?disabled=${b.current || b.block !== null}
              @click=${() =>
                this.confirmTap(key, () =>
                  this.send({ kind: "occupation_law", of, law: b.law }),
                )}
            >
              <span class="block truncate font-semibold"
                >${armed ? translateText("ww1936.pol.tap_again") : b.name}</span
              >
              ${b.current
                ? html`<span class="block text-emerald-300"
                    >${translateText("ww1936.pol.law.in_force")}</span
                  >`
                : html`<span data-ww-occ-law-cost class="block text-white/60"
                    >${translateText("ww1936.occ.law_cost", {
                      pp: WW_OCC_LAW_COST_PP,
                    })}</span
                  >`}
            </button>
            ${b.why === null
              ? nothing
              : html`<span
                  data-ww-occ-law-why=${b.block ?? ""}
                  class="text-xs text-red-300"
                  >${b.why}</span
                >`}
          </div>`;
        })}
      </div>
      ${laws
        .filter((b) => b.current)
        .map(
          (b) =>
            html`<p
              data-ww-occ-law-desc
              class="m-0 mt-0.5 text-xs text-white/60"
            >
              ${translateText(`ww1936.occ_law_desc.${b.law}`)}
            </p>`,
        )}`;
  }

  private renderOwner(o: OwnerRow): TemplateResult {
    const open = this.openOwner === o.owner;
    return html`<li data-ww-occ-owner=${o.owner} class=${CARD}>
      <button
        type="button"
        data-ww-occ-toggle
        aria-expanded=${String(open)}
        class="flex min-h-9 w-full items-center gap-2 text-left"
        @click=${() => (this.openOwner = open ? null : o.owner)}
      >
        ${o.flag === null
          ? nothing
          : html`<img
              src=${o.flag}
              alt=""
              class="h-3 w-4 shrink-0 rounded-sm object-cover"
            />`}
        <span class="min-w-0 flex-1">
          <span class="block truncate"
            >${translateText("ww1936.occ.owner_line", {
              country: o.name,
              n: o.regions.length,
              res: pctOf(o.avgResBp),
              comp: pctOf(o.avgCompBp),
            })}</span
          >
          <span class="block text-white/60">${occLawName(o.law)}</span>
        </span>
        <span aria-hidden="true" class="shrink-0 text-white/60"
          >${open ? "▴" : "▾"}</span
        >
      </button>
      ${open
        ? html`${this.renderLaws(o.owner, o.laws)}
            <ul
              data-ww-occ-regions
              class="m-0 mt-1 flex list-none flex-col gap-0.5 p-0"
            >
              ${o.regions.map(
                (r) =>
                  html`<li>
                    <button
                      type="button"
                      data-ww-occ-region=${r.region}
                      class="flex min-h-9 w-full items-center gap-2 rounded px-1 text-left hover:bg-white/10"
                      @click=${() => this.goTo(r.region)}
                    >
                      <span class="min-w-0 flex-1 truncate">${r.name}</span>
                      ${r.autoLeftDays !== null
                        ? html`<span
                            data-ww-occ-annexed
                            class="shrink-0 text-sky-300"
                            >${translateText("ww1936.occ.annexed")} ·
                            ${translateText("ww1936.occ.auto_in", {
                              days: r.autoLeftDays,
                            })}</span
                          >`
                        : nothing}
                      ${r.uprising
                        ? html`<span class="shrink-0 text-red-300"
                            >${translateText("ww1936.occ.uprising_soon")}</span
                          >`
                        : nothing}
                      ${r.short
                        ? html`<span class="shrink-0 text-amber-300"
                            >${translateText("ww1936.occ.garrison_short")}</span
                          >`
                        : nothing}
                      <span class="shrink-0 tabular-nums"
                        >${translateText("ww1936.occ.resistance")}
                        ${pctOf(r.occ.resBp)}%</span
                      >
                      <span class="shrink-0 tabular-nums text-white/60"
                        >${translateText("ww1936.occ.compliance")}
                        ${pctOf(r.occ.compBp)}%</span
                      >
                    </button>
                  </li>`,
              )}
            </ul>`
        : nothing}
    </li>`;
  }

  private renderIntegrate(game: EndgameGame, me: number) {
    const rows = integrateRows(game, me);
    if (rows.length === 0) return nothing;
    return html`<div class=${HEADING}>
        ${translateText("ww1936.occ.integrate")}
      </div>
      <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
        ${rows.map((r) => {
          const key = `integrate:${r.region}`;
          const armed = r.block === null && this.armed(key);
          return html`<li
            data-ww-occ-integrate=${r.region}
            class="flex items-center gap-2"
          >
            <span class="min-w-0 flex-1 truncate">${r.name}</span>
            ${r.why === null
              ? nothing
              : html`<span class="min-w-0 truncate text-red-300"
                  >${r.why}</span
                >`}
            <button
              type="button"
              data-armed=${String(armed)}
              class="${BUTTON} ${armed ? "ring-2 ring-red-400" : ""}"
              ?disabled=${r.block !== null}
              @click=${() =>
                this.confirmTap(key, () =>
                  this.send({ kind: "integrate_region", region: r.region }),
                )}
            >
              ${armed
                ? translateText("ww1936.pol.tap_again")
                : translateText("ww1936.occ.integrate_cost", {
                    pp: r.costPp,
                  })}
            </button>
          </li>`;
        })}
      </ul>`;
  }

  /** My occupation zones: control only, a neutral label. */
  private renderZones(game: EndgameGame, zones: ReturnType<typeof myZones>) {
    const sc = game.worldWarScenario();
    if (zones.length === 0 || sc === null) return nothing;
    return html`<div class=${HEADING}>${translateText("ww1936.occ.zone")}</div>
      <ul
        data-ww-occ-zones
        class="m-0 flex list-none flex-wrap gap-1 p-0 text-xs"
      >
        ${zones.map(
          (z) =>
            html`<li>
              <button
                type="button"
                data-ww-occ-zone=${z.region}
                class=${BUTTON}
                @click=${() => this.goTo(z.region)}
              >
                ${regionName(sc, z.region)}
              </button>
            </li>`,
        )}
      </ul>`;
  }

  /** Our cores others administer (spec §20.3: our side's resistance), highest first. */
  private coresHeld(game: EndgameGame, me: number) {
    const v = game.wwEndgame?.() ?? null;
    if (v === null) return [];
    return [...v.occupation.values()]
      .filter(
        (o) =>
          o.controller !== me &&
          isLiveOcc(game, o) &&
          coreHoldersNow(game, o.region).includes(me),
      )
      .sort((a, b) => b.resBp - a.resBp || a.region - b.region)
      .slice(0, CORES_SHOWN);
  }

  private renderCores(
    game: EndgameGame,
    cores: ReturnType<WwOccupationTab["coresHeld"]>,
  ) {
    const sc = game.worldWarScenario();
    if (cores.length === 0 || sc === null) return nothing;
    return html`<div class=${HEADING}>
        ${translateText("ww1936.occ.cores_held")}
      </div>
      <ul
        data-ww-occ-cores
        class="m-0 flex list-none flex-col gap-0.5 p-0 text-xs"
      >
        ${cores.map(
          (o) =>
            html`<li>
              <button
                type="button"
                data-ww-occ-core=${o.region}
                class="flex min-h-9 w-full items-center gap-2 rounded px-1 text-left hover:bg-white/10"
                @click=${() => this.goTo(o.region)}
              >
                <span class="min-w-0 flex-1 truncate"
                  >${regionName(sc, o.region)} ·
                  ${egName(game, o.controller)}</span
                >
                <span class="shrink-0 tabular-nums"
                  >${translateText("ww1936.occ.resistance")}
                  ${pctOf(o.resBp)}%</span
                >
              </button>
            </li>`,
        )}
      </ul>`;
  }
}
