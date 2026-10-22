import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
  CountryLandDetail,
  TemplateData,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
  WW_MAX_TRAINING,
  WW_TITLED_GENERAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { GoToPositionEvent } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import { designButton } from "./DesignButton";
import { blockText, equipmentName, menText } from "./EconomyModel";
import {
  armyName,
  armyRows,
  armyStatus,
  battalionSummary,
  divisionRows,
  generalRows,
  regionName,
  rosterName,
  rowGeneralName,
  shortTypes,
  templateDef,
  templateName,
  trainingRows,
  trainTarget,
} from "./LandModel";
import {
  landSelectionOf,
  OpenWwArmyEvent,
  WwArmyTab,
  WwLandModeEvent,
  WwSelectArmyEvent,
} from "./LandSelection";
import {
  dateLabel,
  today,
  TWO_TAP_MS,
  TwoTap,
  wwActive,
} from "./WorldWarModel";
import { TRAIT_ICONS, traitsOf } from "./WwArmyCard";
import { WwDrawerBase } from "./WwDrawer";
import { WwLandChangedEvent } from "./WwLandController";
import "./WwTemplateDesigner";

export const ARMY_TABS: readonly WwArmyTab[] = [
  "armies",
  "training",
  "templates",
  "generals",
];

const TAB_KEYS: Readonly<Record<WwArmyTab, string>> = {
  armies: "ww1936.land.tab_armies",
  training: "ww1936.land.tab_training",
  templates: "ww1936.land.tab_templates",
  generals: "ww1936.land.tab_generals",
};

const EXP_KEYS = {
  recruit: "ww1936.exp.recruit",
  regular: "ww1936.exp.regular",
  veteran: "ww1936.exp.veteran",
  elite: "ww1936.exp.elite",
} as const;

const EXP_STARS = { recruit: 0, regular: 1, veteran: 2, elite: 3 } as const;

const HEADING =
  "mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-white/70";

interface Ctx {
  view: WwLandView;
  economy: WwEconomyView;
  me: number;
  day: number;
  land: CountryLandDetail;
  army: number | null;
}

/**
 * World War 1936 P2 (spec §15.5): the army drawer — four tabs. Armies: my
 * armies (a row chooses its army and the camera goes there) and the chosen
 * army's divisions. Training: +1 / +5 per template, the queue (progress,
 * what it waits for, deploy now, cancel with two taps), manpower and the
 * equipment it lacks. Templates: the list and the designer. Generals: the
 * roster (who can serve when, traits with their effects); with an army
 * chosen a tap gives it that general.
 */
@customElement("ww-army-panel")
export class WwArmyPanel extends WwDrawerBase {
  protected readonly drawerId = "army" as const;
  @state() private tab: WwArmyTab = "armies";
  /** The template whose designer is open (0: a new one); null: the list. */
  @state() private designing: { id: number; base: number } | null = null;
  @state() private showDivisions = false;
  /** The general whose traits are spelled out. */
  @state() private expanded: number | null = null;
  @state() private refused: { key: string; text: string } | null = null;
  private readonly twoTap = new TwoTap();
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwArmyEvent, (e) => {
      // The same tab again shuts the drawer; another tab switches to it.
      if (this.open && this.tab === e.tab) {
        this.setOpen(false);
        return;
      }
      this.tab = e.tab;
      this.designing = null;
      this.setOpen(true);
    });
    this.eventBus.on(WwLandChangedEvent, () => {
      if (this.open) this.requestUpdate();
    });
    // On a short screen the drawer would leave the map too little room to
    // tap the order's region: it steps aside when an order mode begins.
    this.eventBus.on(WwLandModeEvent, (e) => {
      if (
        e.mode !== "none" &&
        this.open &&
        window.innerHeight <= COMPACT_MAX_HEIGHT
      ) {
        this.setOpen(false);
      }
    });
  }

  protected setOpen(open: boolean) {
    this.refused = null;
    super.setOpen(open);
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = [
      this.game.wwLand?.()?.version,
      this.game.wwEconomy?.()?.version,
      landSelectionOf(this.game).version,
      this.game.worldWarScenario() ? today(this.game) : 0,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private ctx(): Ctx | null {
    if ((this.game?.worldWarScenario() ?? null) === null) return null;
    const view = this.game.wwLand?.() ?? null;
    const economy = this.game.wwEconomy?.() ?? null;
    const p = this.game.myPlayer();
    if (view === null || economy === null || p === null) return null;
    const me = p.smallID();
    const land = view.details.get(me) ?? null;
    if (land === null) return null;
    return {
      view,
      economy,
      me,
      day: today(this.game),
      land,
      army: landSelectionOf(this.game).army,
    };
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

  render() {
    if (!this.open) return null;
    const c = this.ctx();
    if (c === null) return null;
    const label = translateText("ww1936.land.dial");
    const head = html`<span aria-hidden="true">⚔</span>
      <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">${label}</h3>`;
    const p = this.game.myPlayer()!;
    // P5 pre-flight §0-1: an exile still commands.
    if (!wwActive(this.game, p.smallID())) {
      return this.renderFrame(
        label,
        head,
        nothing,
        html`<p data-ww-block="dead" class="m-0 mt-2 text-xs text-red-300">
          🔒 ${blockText("dead")}
        </p>`,
      );
    }
    const tabs = this.renderTabs(
      ARMY_TABS,
      this.tab,
      (t) => translateText(TAB_KEYS[t]),
      (t) => {
        this.tab = t;
        this.designing = null;
        this.refused = null;
      },
    );
    let body: TemplateResult;
    switch (this.tab) {
      case "armies":
        body = this.renderArmies(c);
        break;
      case "training":
        body = this.renderTraining(c);
        break;
      case "templates":
        body = this.renderTemplates(c);
        break;
      case "generals":
        body = this.renderGenerals(c);
        break;
    }
    return this.renderFrame(label, head, tabs, body);
  }

  private bars(strengthPm: number, orgPm: number): TemplateResult {
    const bar = (pm: number, color: string) =>
      html`<div class="h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded ${color}"
          style="width: ${Math.max(0, Math.min(1000, pm)) / 10}%"
        ></div>
      </div>`;
    return html`<div class="flex flex-col gap-0.5">
      ${bar(strengthPm, "bg-emerald-400")} ${bar(orgPm, "bg-sky-400")}
    </div>`;
  }

  private empty(key: string): TemplateResult {
    return html`<p data-ww-empty class="m-0 mt-2 text-xs text-white/60">
      ${translateText(key)}
    </p>`;
  }

  // ---- Armies ----

  private choose(c: Ctx, army: number, region: number) {
    this.eventBus.emit(new WwSelectArmyEvent(army));
    const t = c.view.scenario.centerTile(region);
    const w = c.view.scenario.width;
    this.eventBus.emit(new GoToPositionEvent(t % w, Math.floor(t / w)));
  }

  private renderArmies(c: Ctx): TemplateResult {
    const rows = armyRows(c.view, c.me);
    if (rows.length === 0) return this.empty("ww1936.land.no_armies");
    const chosen = c.army;
    return html`<ul
        data-ww-armies
        class="m-0 mt-2 flex list-none flex-col gap-1 p-0"
      >
        ${rows.map((r) => {
          const a = c.view.armies.get(r.id)!;
          const status = armyStatus(c.view, c.me, a, c.day);
          const alert =
            (r.state & ARMY_ENCIRCLED) !== 0
              ? "border-red-500"
              : (r.state & ARMY_BATTLE) !== 0
                ? "border-amber-400/70"
                : chosen === r.id
                  ? "border-amber-300"
                  : "border-white/10";
          return html`<li>
            <button
              type="button"
              data-ww-army-row=${r.id}
              aria-pressed=${String(chosen === r.id)}
              class="flex min-h-11 w-full flex-col gap-0.5 rounded-md border bg-white/5 p-1.5 text-left text-xs hover:bg-white/10 ${alert}"
              @click=${() => this.choose(c, r.id, r.region)}
            >
              <span class="flex w-full items-center gap-1.5">
                <span class="min-w-0 truncate text-sm font-bold"
                  >${armyName(r.nameNo)}</span
                >
                <span class="min-w-0 truncate text-white/70"
                  >${rowGeneralName(r)}</span
                >
                <span class="ml-auto shrink-0 tabular-nums"
                  >${translateText("ww1936.land.divisions_of", {
                    n: r.divisions,
                    max: WW_MAX_ARMY_DIVISIONS,
                  })}</span
                >
              </span>
              <span class="block w-full"
                >${this.bars(r.strengthPm, r.orgPm)}</span
              >
              <span class="flex w-full gap-2 text-white/70">
                <span class="min-w-0 flex-1 truncate"
                  >${translateText(status.key, status.params)}</span
                >
                <span class="shrink-0"
                  >📍 ${regionName(c.view.scenario, r.region)}</span
                >
              </span>
            </button>
          </li>`;
        })}
      </ul>
      ${chosen !== null && c.view.armies.get(chosen)?.owner === c.me
        ? html`<button
              type="button"
              data-ww-show-divisions
              aria-pressed=${String(this.showDivisions)}
              class="mt-2 h-9 w-full rounded-md border border-white/15 bg-white/10 text-xs font-semibold hover:bg-white/20"
              @click=${() => (this.showDivisions = !this.showDivisions)}
            >
              ${translateText("ww1936.land.show_divisions")}
            </button>
            ${this.showDivisions ? this.renderDivisions(c, chosen) : nothing}`
        : nothing}`;
  }

  private renderDivisions(c: Ctx, army: number): TemplateResult {
    return html`<ul
      data-ww-divisions
      class="m-0 mt-1 flex list-none flex-col gap-1 p-0"
    >
      ${divisionRows(c.view, c.me, army).map(
        (d) =>
          html`<li
            data-ww-division=${d.data.id}
            class="rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
          >
            <div class="flex items-center gap-1.5">
              <span class="min-w-0 flex-1 truncate font-semibold"
                >${d.template === null ? "" : templateName(d.template)}</span
              >
              <span
                data-ww-exp=${d.level}
                class="shrink-0 text-amber-300"
                aria-label=${translateText(EXP_KEYS[d.level])}
                >${"★".repeat(EXP_STARS[d.level])}
                ${translateText(EXP_KEYS[d.level])}</span
              >
              ${d.data.equipPm < 1000
                ? html`<span
                    data-ww-short-equipment
                    class="shrink-0 text-red-400"
                    aria-label=${translateText("ww1936.land.equipment_short", {
                      list: `${Math.floor(d.data.equipPm / 10)}%`,
                    })}
                    >🔧 ${Math.floor(d.data.equipPm / 10)}%</span
                  >`
                : nothing}
            </div>
            ${this.bars(d.data.strengthPm, d.data.orgPm)}
            <div class="text-white/60">
              ${translateText("ww1936.land.supply", {
                pct: Math.floor(d.data.supplyPm / 10),
              })}
              · 📍 ${regionName(c.view.scenario, d.data.region)}
            </div>
          </li>`,
      )}
    </ul>`;
  }

  // ---- Training ----

  private renderTraining(c: Ctx): TemplateResult {
    const summary = c.economy.summary(c.me);
    const short = shortTypes(c.view, c.economy, c.me);
    const target = trainTarget(c.view, c.me, c.army);
    const full = c.land.training.length >= WW_MAX_TRAINING;
    const train = (t: TemplateData, count: number) => {
      if (full) {
        this.refused = {
          key: `train:${t.id}`,
          text: blockText("queue_full"),
        };
        return;
      }
      this.refused = null;
      this.send({
        kind: "train",
        template: t.id,
        count,
        army: target?.id ?? 0,
        region: target?.region ?? 0,
      });
    };
    return html`<div class="mt-2 flex flex-col gap-1 text-xs">
        <div data-ww-manpower-pool class="flex flex-wrap gap-x-3">
          <span
            >${translateText("ww1936.land.manpower_pool", {
              n: menText(summary?.manpower ?? 0),
            })}</span
          >
          ${short.length > 0
            ? html`<span data-ww-short class="text-red-300"
                >${translateText("ww1936.land.equipment_short", {
                  list: short.map(equipmentName).join(", "),
                })}</span
              >`
            : nothing}
        </div>
        <div data-ww-train-target class="text-white/70">
          ${target === null
            ? translateText("ww1936.land.train_new_army")
            : translateText("ww1936.land.train_into", {
                army: armyName(target.nameNo),
              })}
        </div>
      </div>
      <ul
        data-ww-train-templates
        class="m-0 mt-1 flex list-none flex-col gap-1 p-0"
      >
        ${c.land.templates.map(
          (t) =>
            html`<li class="flex items-center gap-1">
              <span class="min-w-0 flex-1 truncate text-xs font-semibold"
                >${templateName(t)}</span
              >
              ${[1, 5].map(
                (n) =>
                  html`<button
                    type="button"
                    data-ww-train=${`${t.id}:${n}`}
                    aria-disabled=${String(full)}
                    class="h-9 min-w-11 rounded-md border px-2 text-xs font-bold ${full
                      ? "border-white/5 bg-white/5 text-white/40"
                      : "border-emerald-400/50 bg-emerald-800/40 hover:bg-emerald-700/50"}"
                    @click=${() => train(t, n)}
                  >
                    ${translateText("ww1936.land.train_plus", { n })}
                  </button>`,
              )}
            </li>`,
        )}
      </ul>
      ${this.refused?.key.startsWith("train:")
        ? html`<p data-ww-block class="m-0 mt-1 text-xs text-red-300">
            🔒 ${this.refused.text}
          </p>`
        : nothing}
      <div class=${HEADING}>${translateText("ww1936.land.training_men")}</div>
      ${c.land.training.length === 0
        ? this.empty("ww1936.land.no_training")
        : html`<ul data-ww-queue class="m-0 flex list-none flex-col gap-1 p-0">
            ${trainingRows(c.view, c.me).map((r) => this.renderEntry(c, r))}
          </ul>`}`;
  }

  private renderEntry(
    c: Ctx,
    r: ReturnType<typeof trainingRows>[number],
  ): TemplateResult {
    const t = r.data;
    const key = `cancel_train:${t.id}`;
    const armed = this.armed(key);
    const army = t.army === 0 ? undefined : c.view.armies.get(t.army);
    const waiting =
      t.waiting === "manpower"
        ? translateText("ww1936.land.waiting_manpower")
        : t.waiting === "equipment"
          ? translateText("ww1936.land.waiting_equipment", {
              pct: Math.floor(r.fillPm / 10),
            })
          : "";
    return html`<li
      data-ww-entry=${t.id}
      class="rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
    >
      <div class="flex items-center gap-1.5">
        <span class="min-w-0 flex-1 truncate font-semibold"
          >${r.template === null ? "" : templateName(r.template)}
          ×${t.remaining}</span
        >
        ${army === undefined
          ? nothing
          : html`<span class="shrink-0 text-white/60"
              >→ ${armyName(army.nameNo)}</span
            >`}
      </div>
      <div class="my-1 h-1.5 rounded bg-white/10">
        <div
          class="h-1.5 rounded bg-amber-400"
          style="width: ${r.progress * 100}%"
        ></div>
      </div>
      ${waiting === ""
        ? nothing
        : html`<div data-ww-waiting=${t.waiting} class="text-amber-300">
            ${waiting}
          </div>`}
      <div class="mt-1 flex gap-1">
        <button
          type="button"
          data-ww-deploy=${t.id}
          aria-disabled=${String(t.trainees.length === 0)}
          class="h-9 flex-1 rounded-md border px-2 font-semibold ${t.trainees
            .length === 0
            ? "border-white/5 bg-white/5 text-white/40"
            : "border-sky-400/50 bg-sky-900/40 hover:bg-sky-800/50"}"
          @click=${() => {
            if (t.trainees.length > 0) {
              this.send({ kind: "deploy_now", entry: t.id });
            }
          }}
        >
          ${translateText("ww1936.land.deploy_now")}
        </button>
        <button
          type="button"
          data-ww-cancel=${t.id}
          data-armed=${String(armed)}
          class="h-9 flex-1 rounded-md border px-2 font-semibold ${armed
            ? "border-red-400 bg-red-900/70"
            : "border-red-400/40 bg-red-900/30"}"
          @click=${() =>
            this.confirmTap(key, () =>
              this.send({ kind: "cancel_train", entry: t.id }),
            )}
        >
          ${translateText(armed ? "ww1936.econ.cancel_tap" : "common.cancel")}
        </button>
      </div>
    </li>`;
  }

  // ---- Templates ----

  private renderTemplates(c: Ctx): TemplateResult {
    if (this.designing !== null) {
      return html`<ww-template-designer
        .game=${this.game}
        .eventBus=${this.eventBus}
        .templateId=${this.designing.id}
        .baseId=${this.designing.base}
        @ww-designer-close=${() => (this.designing = null)}
      ></ww-template-designer>`;
    }
    const full = c.land.templates.length >= WW_MAX_TEMPLATES;
    return html`${designButton(this.eventBus, "tank")}
      <ul data-ww-templates class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        ${c.land.templates.map(
          (t) =>
            html`<li>
              <button
                type="button"
                data-ww-template=${t.id}
                class="flex min-h-11 w-full flex-col gap-0.5 rounded-md border border-white/10 bg-white/5 p-1.5 text-left text-xs hover:bg-white/10"
                @click=${() => (this.designing = { id: t.id, base: 0 })}
              >
                <span class="flex w-full items-center gap-2">
                  <span class="min-w-0 flex-1 truncate text-sm font-bold"
                    >${templateName(t)}</span
                  >
                  <span class="shrink-0 text-white/60"
                    >${translateText("ww1936.land.in_use", {
                      n: t.inUse,
                    })}</span
                  >
                </span>
                <span class="block truncate text-white/70"
                  >${battalionSummary(templateDef(t))}</span
                >
              </button>
            </li>`,
        )}
      </ul>
      <button
        type="button"
        data-ww-new-template
        aria-disabled=${String(full)}
        class="mt-2 h-9 w-full rounded-md border text-xs font-semibold ${full
          ? "border-white/5 bg-white/5 text-white/40"
          : "border-emerald-400/50 bg-emerald-800/40 hover:bg-emerald-700/50"}"
        @click=${() => {
          if (full) {
            this.refused = {
              key: "new_template",
              text: blockText("too_many_templates"),
            };
            return;
          }
          this.refused = null;
          this.designing = { id: 0, base: 0 };
        }}
      >
        ${translateText("ww1936.land.new_template")}
      </button>
      ${this.refused?.key === "new_template"
        ? html`<p data-ww-block class="m-0 mt-1 text-xs text-red-300">
            🔒 ${this.refused.text}
          </p>`
        : nothing}`;
  }

  // ---- Generals ----

  private renderGenerals(c: Ctx): TemplateResult {
    // P6 (spec §4.3, lane D): a field marshal leads an army group, not an army.
    const rows = generalRows(c.view, c.me, c.day).filter(
      (r) => r.data.fm !== true,
    );
    const army =
      c.army !== null && c.view.armies.get(c.army)?.owner === c.me
        ? c.view.armies.get(c.army)!
        : null;
    const xp = c.land.armyXpMilli;
    const appoint = () => {
      if (xp < WW_TITLED_GENERAL_XP_MILLI) {
        this.refused = { key: "appoint", text: blockText("no_xp") };
        return;
      }
      this.refused = null;
      this.send({ kind: "appoint_general" });
    };
    return html`${army === null
        ? nothing
        : html`<p data-ww-assign-hint class="m-0 mt-2 text-xs text-amber-200">
            ${translateText("ww1936.land.assign_hint", {
              army: armyName(army.nameNo),
            })}
          </p>`}
      ${rows.length === 0
        ? this.empty("ww1936.land.no_generals")
        : html`<ul
            data-ww-generals
            class="m-0 mt-2 flex list-none flex-col gap-1 p-0"
          >
            ${rows.map((r) => {
              const g = r.data;
              const commands =
                g.army === 0 ? undefined : c.view.armies.get(g.army);
              const open = this.expanded === g.id;
              const tap = () => {
                if (army !== null && r.serving) {
                  this.send({
                    kind: "army_general",
                    army: army.id,
                    general: g.id,
                  });
                  return;
                }
                this.expanded = open ? null : g.id;
              };
              return html`<li>
                <button
                  type="button"
                  data-ww-general=${g.id}
                  data-serving=${String(r.serving)}
                  class="flex min-h-11 w-full flex-col gap-0.5 rounded-md border border-white/10 bg-white/5 p-1.5 text-left text-xs hover:bg-white/10 ${r.serving
                    ? ""
                    : "opacity-50"}"
                  @click=${tap}
                >
                  <span class="flex w-full items-center gap-1.5">
                    <span class="min-w-0 flex-1 truncate text-sm font-bold"
                      >${rosterName(g)}</span
                    >
                    ${traitsOf(g.traits).map(
                      (t) =>
                        html`<span
                          role="img"
                          aria-label=${translateText(`ww1936.trait.${t}`)}
                          >${TRAIT_ICONS[t]}</span
                        >`,
                    )}
                  </span>
                  <span class="flex w-full flex-wrap gap-x-2 text-white/70">
                    <span class="tabular-nums"
                      >${translateText("ww1936.land.general_skills", {
                        a: g.att,
                        d: g.def,
                        p: g.plan,
                        l: g.log,
                      })}</span
                    >
                    <span
                      >${translateText("ww1936.land.general_level", {
                        n: g.level,
                      })}</span
                    >
                    ${commands === undefined
                      ? nothing
                      : html`<span class="text-sky-300"
                          >${translateText("ww1936.land.serving", {
                            army: armyName(commands.nameNo),
                          })}</span
                        >`}
                    ${r.serving
                      ? nothing
                      : html`<span data-ww-unavailable class="text-amber-300"
                          >${g.from >= 0 && c.day < g.from
                            ? translateText("ww1936.land.general_from", {
                                year: dateOfDay(g.from).year,
                              })
                            : translateText("ww1936.land.general_until", {
                                date: dateLabel(g.until),
                              })}</span
                        >`}
                  </span>
                  <span class="block h-1 w-full rounded bg-white/10">
                    <span
                      class="block h-1 rounded bg-amber-400"
                      style="width: ${Math.min(
                        100,
                        (g.xp * 100) / Math.max(1, 100 * g.level),
                      )}%"
                    ></span>
                  </span>
                  ${open
                    ? html`<span data-ww-traits class="flex flex-col gap-0.5">
                        ${traitsOf(g.traits).map(
                          (t) =>
                            html`<span
                              >${TRAIT_ICONS[t]}
                              <b>${translateText(`ww1936.trait.${t}`)}</b>:
                              ${translateText(`ww1936.trait_desc.${t}`)}</span
                            >`,
                        )}
                      </span>`
                    : nothing}
                </button>
              </li>`;
            })}
          </ul>`}
      <button
        type="button"
        data-ww-appoint
        aria-disabled=${String(xp < WW_TITLED_GENERAL_XP_MILLI)}
        class="mt-2 h-9 w-full rounded-md border text-xs font-semibold ${xp <
        WW_TITLED_GENERAL_XP_MILLI
          ? "border-white/5 bg-white/5 text-white/40"
          : "border-amber-300/60 bg-amber-800/40 hover:bg-amber-700/50"}"
        @click=${appoint}
      >
        ${translateText("ww1936.land.appoint_general", {
          cost: WW_TITLED_GENERAL_XP_MILLI / 1000,
        })}
      </button>
      ${this.refused?.key === "appoint"
        ? html`<p data-ww-block class="m-0 mt-1 text-xs text-red-300">
            🔒 ${this.refused.text}
          </p>`
        : nothing}`;
  }
}
