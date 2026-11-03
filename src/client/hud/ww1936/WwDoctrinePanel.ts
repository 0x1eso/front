import type { WwOrder } from "@openfront/engine-api/Schemas";
import { FM_TRAITS } from "@openfront/engine-api/ww1936/DepthTypes";
import { GENERAL_TRAITS } from "@openfront/engine-api/ww1936/LandTypes";
import { THOUGHT_MAX_STEP } from "@openfront/engine-api/ww1936/ThoughtTypes";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";
import {
  DOCTRINE_BLOCK_KEYS,
  DoctrineBlock,
  DoctrineModel,
  ThoughtEnd,
  ThoughtSliderView,
} from "./DoctrineModel";
import { armyName, armyRows } from "./LandModel";
import { TWO_TAP_MS, TwoTap, wwActive } from "./WorldWarModel";
import { autoMaskOf, renderAutoSwitch } from "./WwAutoUi";
import { WwDrawerBase } from "./WwDrawer";

export type WwDoctrineTab = "land" | "naval" | "air" | "command";
export const DOCTRINE_TABS: readonly WwDoctrineTab[] = [
  "land",
  "naval",
  "air",
  "command",
];
const TAB_KEYS: Readonly<Record<WwDoctrineTab, string>> = {
  land: "ww1936.doctrine.tab_land",
  naval: "ww1936.doctrine.tab_naval",
  air: "ww1936.doctrine.tab_air",
  command: "ww1936.doctrine.tab_command",
};
const DOMAIN_TAB: readonly WwDoctrineTab[] = ["land", "naval", "air"];

const HEADING =
  "mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-white/70";
const BTN =
  "min-h-9 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-40";
const CARD = "rounded-md border border-white/10 bg-white/5 p-1.5 text-xs";
/** How long a dragged value stays on screen while the engine takes the order. */
const PENDING_MS = 1500;

/** The slider: a hollow 28px handle you drag (the target); the track and the actual-position dot are drawn under it. */
const SLIDER_STYLE = html`<style>
  .ww-thought-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 44px;
    margin: 0;
    background: transparent;
    touch-action: pan-y;
  }
  .ww-thought-slider::-webkit-slider-runnable-track {
    height: 44px;
    background: transparent;
  }
  .ww-thought-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    margin-top: 8px;
    border-radius: 9999px;
    background: rgb(56 189 248 / 0.25);
    border: 3px solid rgb(56 189 248);
  }
  .ww-thought-slider::-moz-range-track {
    height: 44px;
    background: transparent;
  }
  .ww-thought-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    background: rgb(56 189 248 / 0.25);
    border: 3px solid rgb(56 189 248);
  }
</style>`;

/**
 * World War 1936: the thought drawer (ww9 design §11.1) — land, naval and air
 * tabs hold three sliders each; dragging one is the whole interaction (no
 * confirmation, no cost, nothing is ever required). Then command (the
 * generals' and admirals' traits, which come by themselves, field marshals,
 * medals, which are awarded by themselves).
 */
@customElement("ww-doctrine-panel")
export class WwDoctrinePanel extends WwDrawerBase {
  protected readonly drawerId = "doctrine" as const;
  @state() private tab: WwDoctrineTab = "land";
  @state() private promoting: number | null = null;
  /** Values dragged but not yet in the view, by THOUGHT_SLIDERS index. */
  private readonly drag = new Map<number, number>();
  private model: DoctrineModel | null = null;
  private readonly twoTap = new TwoTap();
  private redrawKey = "";

  init() {
    super.init();
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "doctrine") return;
      const tab = (e.arg?.tab as WwDoctrineTab | undefined) ?? null;
      if (this.open && (tab === null || tab === this.tab)) {
        this.setOpen(false);
        return;
      }
      if (tab !== null && DOCTRINE_TABS.includes(tab)) this.tab = tab;
      this.setOpen(true);
    });
  }

  private m(): DoctrineModel {
    return (this.model ??= new DoctrineModel(this.game));
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = this.m().version();
    if (key !== this.redrawKey) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private send(order: WwOrder) {
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  private blockText(b: DoctrineBlock, days = 0): string {
    return translateText(DOCTRINE_BLOCK_KEYS[b], { days });
  }

  render() {
    if (!this.open) return null;
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const label = translateText("ww1936.thought.title");
    const me = this.game.myPlayer();
    const head = html`<span aria-hidden="true">⚖</span>
      <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">${label}</h3>
      ${me === null
        ? nothing
        : renderAutoSwitch(
            "thought",
            autoMaskOf(this.game, me.smallID()),
            (o) => this.send(o),
            true,
          )}`;
    if (me === null || !wwActive(this.game, me.smallID())) {
      return this.renderFrame(label, head, nothing, html``);
    }
    const model = this.m();
    const tabs = this.renderTabs(
      DOCTRINE_TABS,
      this.tab,
      (t) => translateText(TAB_KEYS[t]),
      (t) => {
        this.tab = t;
      },
    );
    let body: TemplateResult;
    if (!model.ready()) body = html``;
    else if (this.tab === "command") body = this.renderCommand(model);
    else body = this.renderThought(model, DOMAIN_TAB.indexOf(this.tab));
    return this.renderFrame(label, head, tabs, body);
  }

  // ---- Land / naval / air: the sliders ----

  private renderThought(model: DoctrineModel, domain: number): TemplateResult {
    const sliders = model.sliders(domain, this.drag);
    for (const s of sliders) {
      if (this.drag.get(s.index) === s.target) this.drag.delete(s.index);
    }
    return html`${SLIDER_STYLE}
      <div
        data-ww-domain=${DOMAIN_TAB[domain]}
        class="flex flex-col gap-1.5 pt-2"
      >
        ${sliders.map((s) => this.renderSlider(model, s))}
      </div>`;
  }

  private renderEnd(s: ThoughtSliderView, e: ThoughtEnd): TemplateResult {
    const right = e.end === 1;
    const toward = right ? s.target > 0 : s.target < 0;
    return html`<div
      data-ww-thought-end=${e.id}
      class="min-w-0 ${right ? "text-right" : "text-left"} ${right
        ? "order-2 min-[700px]:order-3"
        : "order-1"}"
    >
      <div class="font-bold ${toward ? "text-sky-300" : "text-white/80"}">
        ${translateText(`ww1936.thought.${right ? "right" : "left"}.${s.id}`)}
      </div>
      ${e.lines.map((l) =>
        l.now === "" && l.goal === ""
          ? nothing
          : html`<div class="text-white/80">
              ${l.now}${l.goal !== "" && l.goal !== l.now
                ? html`<span class="text-sky-300"> → ${l.goal}</span>`
                : nothing}
            </div>`,
      )}
      <div
        data-ww-thought-star=${e.star.lit ? "lit" : "dim"}
        class="${e.star.lit
          ? "text-amber-300"
          : e.star.goalLit
            ? "text-amber-300/60"
            : "text-white/40"}"
      >
        ★ ${translateText(`ww1936.thought.edge.${e.id}`)}
        <span class="${e.star.lit ? "text-amber-100" : ""}"
          >${e.star.lines.join(", ")}</span
        >
      </div>
    </div>`;
  }

  private renderSlider(
    model: DoctrineModel,
    s: ThoughtSliderView,
  ): TemplateResult {
    const span = 2 * THOUGHT_MAX_STEP;
    const at = (milli: number) =>
      Math.max(
        0,
        Math.min(100, ((milli + THOUGHT_MAX_STEP * 1000) / span / 1000) * 100),
      );
    const cur = at(s.curMilli);
    const goal = at(s.target * 1000);
    const band = { from: Math.min(cur, goal), to: Math.max(cur, goal) };
    return html`<div
      data-ww-thought=${s.id}
      data-moving=${String(s.moving)}
      class="${CARD} grid grid-cols-2 gap-x-3 gap-y-1 min-[700px]:grid-cols-[1fr_1.5fr_1fr]"
    >
      ${this.renderEnd(s, s.left)} ${this.renderEnd(s, s.right)}
      <div
        class="order-3 col-span-2 min-w-0 min-[700px]:order-2 min-[700px]:col-span-1"
      >
        <div class="relative mx-[14px] h-11">
          <div
            class="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded bg-white/15"
          ></div>
          <div
            class="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white/40"
            style="left: 50%"
          ></div>
          <div
            class="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded bg-sky-400/60"
            style="left: ${band.from}%; width: ${band.to - band.from}%"
          ></div>
          <div
            data-ww-thought-now
            class="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style="left: ${cur}%"
          ></div>
          <input
            type="range"
            data-ww-thought-slider=${s.id}
            class="ww-thought-slider absolute -left-[14px] top-0 w-[calc(100%+28px)]"
            min=${-THOUGHT_MAX_STEP}
            max=${THOUGHT_MAX_STEP}
            step="1"
            .value=${String(s.target)}
            aria-label=${`${translateText(`ww1936.thought.left.${s.id}`)} / ${translateText(`ww1936.thought.right.${s.id}`)}`}
            @input=${(e: Event) => this.preview(s.index, e)}
            @change=${(e: Event) => this.commit(model, s.index, e)}
          />
        </div>
        <div
          data-ww-thought-status
          class="text-center text-[11px] ${s.moving
            ? "text-sky-300"
            : "text-white/50"}"
        >
          ${s.moving
            ? translateText("ww1936.thought.moving_days", { days: s.days })
            : translateText("ww1936.thought.arrived")}
        </div>
      </div>
    </div>`;
  }

  /** While dragging only the screen follows; nothing is sent. */
  private preview(index: number, e: Event) {
    this.drag.set(index, Number((e.target as HTMLInputElement).value));
    this.requestUpdate();
  }

  /** Letting go sends the one order; there is nothing to confirm and dragging back undoes it. */
  private commit(model: DoctrineModel, index: number, e: Event) {
    const pos = Number((e.target as HTMLInputElement).value);
    this.drag.set(index, pos);
    this.send(model.thoughtOrder(index, pos));
    this.requestUpdate();
    setTimeout(() => {
      if (this.drag.get(index) === pos) this.drag.delete(index);
      this.requestUpdate();
    }, PENDING_MS);
  }

  // ---- Command ----

  private traitName(t: string, admiral: boolean): string {
    return translateText(
      admiral && !isGeneralTrait(t)
        ? `ww1936.admiral_trait.${t}`
        : `ww1936.trait.${t}`,
    );
  }

  private renderCommand(model: DoctrineModel): TemplateResult {
    const bar = model.marshalCap();
    if (bar === null) return html``;
    const people = model.commandPeople();
    const marshals = model.marshalRows();
    const promo = model.promoteCandidates();
    return html`<div data-ww-command class="flex flex-col gap-1 pt-2">
      <div class=${HEADING}>${translateText("ww1936.command.generals")}</div>
      ${people.length === 0
        ? html`<p class="m-0 text-xs text-white/60">
            ${translateText("ww1936.command.none")}
          </p>`
        : people.map((p) => this.renderPerson(p))}

      <div class=${HEADING}>${translateText("ww1936.command.marshals")}</div>
      <p class="m-0 text-xs text-white/60">
        ${translateText("ww1936.command.marshal_cap", {
          n: bar.marshals,
          max: bar.cap,
        })}
      </p>
      ${marshals.map(
        (f) =>
          html`<div data-ww-marshal=${f.id} class=${CARD}>
            <div class="flex items-center gap-2">
              <span class="font-bold">${f.name}</span>
              ${f.group > 0
                ? html`<span class="ml-auto text-white/60"
                    >${translateText("ww1936.ag.number", {
                      n: f.group,
                    })}</span
                  >`
                : nothing}
            </div>
            ${f.traits.map(
              (t) =>
                html`<div class="text-white/70">
                  <span class="font-semibold"
                    >${translateText(`ww1936.fm_trait.${t}`)}</span
                  >
                  <span class="text-white/60">
                    ${translateText(`ww1936.fm_trait_desc.${t}`)}</span
                  >
                </div>`,
            )}
          </div>`,
      )}
      ${promo.map((g) => this.renderPromote(model, g))}

      <div class=${HEADING}>${translateText("ww1936.command.medals")}</div>
      <p class="m-0 text-xs text-white/60">
        ${translateText("ww1936.command.medals_auto")}
      </p>
      ${this.renderMedalWaits(model)}
    </div>`;
  }

  /** The armies still waiting out their medal cooldown (medals are awarded by themselves). */
  private renderMedalWaits(model: DoctrineModel): TemplateResult {
    const land = this.game.wwLand?.() ?? null;
    const me = this.game.myPlayer()!.smallID();
    const rows = land === null ? [] : armyRows(land, me);
    return html`${model.medalRows().map((m) => {
      const r = rows.find((x) => x.id === m.army);
      return html`<div data-ww-medal-wait=${m.army} class="${CARD} flex gap-2">
        <span class="min-w-0 flex-1 truncate font-bold"
          >${r === undefined ? `#${m.army}` : armyName(r.nameNo)}</span
        >
        <span class="shrink-0 text-white/60"
          >${translateText("ww1936.doctrine.locked_days", {
            days: m.days,
          })}</span
        >
      </div>`;
    })}`;
  }

  private renderPerson(
    p: ReturnType<DoctrineModel["commandPeople"]>[number],
  ): TemplateResult {
    const key = `${p.admiral ? "a" : "g"}${p.id}`;
    return html`<div data-ww-person=${key} class=${CARD}>
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-bold"
          >${p.admiral ? "⚓ " : ""}${p.name}</span
        >
        <span class="shrink-0 text-white/60"
          >${translateText("ww1936.doctrine.level_short", { level: p.level })} ·
          ${translateText("ww1936.command.trait_slots", {
            free: p.slots - p.used,
            total: p.slots,
          })}</span
        >
      </div>
      <div class="text-white/70">
        ${p.traits.map((t) => this.traitName(t, p.admiral)).join(", ")}
      </div>
    </div>`;
  }

  private renderPromote(
    model: DoctrineModel,
    g: ReturnType<DoctrineModel["promoteCandidates"]>[number],
  ): TemplateResult {
    const open = this.promoting === g.id;
    return html`<div data-ww-promote=${g.id} class=${CARD}>
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-bold">${g.name}</span>
        <button
          type="button"
          ?disabled=${g.block !== null}
          class=${BTN}
          @click=${() => (this.promoting = open ? null : g.id)}
        >
          ${translateText("ww1936.command.promote")}
        </button>
      </div>
      ${g.block === null
        ? nothing
        : html`<p class="m-0 text-red-300">🔒 ${this.blockText(g.block)}</p>`}
      ${open
        ? html`<div class="mt-1 flex flex-col gap-1">
            <div class="text-white/70">
              ${translateText("ww1936.command.pick_trait")}
            </div>
            ${FM_TRAITS.map((t) => {
              const key = `fm${g.id}${t}`;
              return html`<button
                type="button"
                data-ww-promote-trait=${t}
                class="${BTN} text-left ${this.armed(key)
                  ? "border-amber-300 bg-amber-500/30"
                  : ""}"
                @click=${() =>
                  this.confirmTap(key, () => {
                    this.send(model.promoteOrder(g.id, t));
                    this.promoting = null;
                  })}
              >
                ${this.armed(key)
                  ? translateText("ww1936.doctrine.tap_again")
                  : translateText(`ww1936.fm_trait.${t}`)}
              </button>`;
            })}
          </div>`
        : nothing}
    </div>`;
  }
}

function isGeneralTrait(t: string): boolean {
  return (GENERAL_TRAITS as readonly string[]).includes(t);
}
