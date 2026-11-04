import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
  CountryLandDetail,
  TemplateData,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_TEMPLATES,
  WW_MAX_TRAINING,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import { presetDef } from "@openfront/engine-lib/ww1936/TemplatePresets";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { GoToPositionEvent } from "../../TransformHandler";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwLandView } from "../../view/WwLandView";
import { COMPACT_MAX_HEIGHT } from "../domestic/DomesticPanel";
import {
  armyEntries,
  ArmyEntry,
  compositionOf,
  groupRows,
  planTrain,
  trainDaysFor,
  trainOrder,
} from "./ArmyTemplates";
import { designButton } from "./DesignButton";
import { libraryStore } from "./DesignLibrary";
import { blockText, equipmentName, menText } from "./EconomyModel";
import {
  armyName,
  armyRows,
  armyStatus,
  battalionSummary,
  designer,
  designGroupsOf,
  divisionRows,
  generalRows,
  idleEquipment,
  regionName,
  rosterName,
  rowGeneralName,
  shortTypes,
  templateDef,
  templateName,
  trainingRows,
  trainTarget,
  trainToChoices,
  trainToState,
} from "./LandModel";
import {
  landSelectionOf,
  OpenWwArmyEvent,
  WwArmyTab,
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
import { renderGroupTab } from "./WwArmyGroupTab";
import {
  ArmyEdit,
  armyEditOf,
  renderArmyTemplates,
  renderGroupRow,
  saveArmyEdit,
} from "./WwArmyTemplateUi";
import { autoMaskOf, renderAutoSwitch } from "./WwAutoUi";
import { convertOptions, renderConvertPicker } from "./WwConvertPicker";
import { WwDrawerBase } from "./WwDrawer";
import { WwLandChangedEvent } from "./WwLandController";
import "./WwTemplateDesigner";

export const ARMY_TABS: readonly WwArmyTab[] = [
  "armies",
  "training",
  "templates",
  "generals",
  "groups",
];

const TAB_KEYS: Readonly<Record<WwArmyTab, string>> = {
  armies: "ww1936.land.tab_armies",
  training: "ww1936.land.tab_training",
  templates: "ww1936.land.tab_templates",
  generals: "ww1936.land.tab_generals",
  groups: "ww1936.ag.tab",
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
  /** The "deploy to" choice, kept for the session (0: automatic). */
  private static lastTrainTo = 0;
  protected readonly drawerId = "army" as const;
  @state() private tab: WwArmyTab = "armies";
  /** The template whose designer is open (0: a new one); null: the list. */
  @state() private designing: { id: number; base: number } | null = null;
  @state() private showDivisions = false;
  /** The general whose traits are spelled out. */
  @state() private expanded: number | null = null;
  @state() private refused: { key: string; text: string } | null = null;
  /** The army template being edited (a new one when its id is null). */
  @state() private armyEdit: ArmyEdit | null = null;
  @state() private armyNotice = "";
  /** The template whose divisions the overwrite picker is converting. */
  @state() private convertFrom: number | null = null;
  /** The army whose divisions the overwrite picker is converting (from its card). */
  @state() private convertArmy: number | null = null;
  /** A conversion just sent: offer to delete the old template once unused. */
  @state() private converted: { from: number; to: number } | null = null;
  /** A train waiting for the templates it just asked for. */
  private pendingTrain: {
    entry: ArmyEntry;
    region: number;
    until: number;
  } | null = null;
  private readonly twoTap = new TwoTap();
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(OpenWwArmyEvent, (e) => {
      // The same tab again shuts the drawer; another tab switches to it.
      if (this.open && this.tab === e.tab && e.convertArmy === undefined) {
        this.setOpen(false);
        return;
      }
      this.tab = e.tab;
      this.designing = null;
      this.convertFrom = null;
      this.convertArmy = e.convertArmy ?? null;
      this.converted = null;
      this.setOpen(true);
    });
    this.eventBus.on(WwLandChangedEvent, () => {
      if (this.open) this.requestUpdate();
    });
    libraryStore().subscribe(() => {
      if (this.open) this.requestUpdate();
    });
  }

  protected setOpen(open: boolean) {
    this.refused = null;
    super.setOpen(open);
  }

  tick() {
    this.refitIfOpen();
    this.finishPendingTrain();
    if (!this.open) return;
    const key = [
      this.game.wwLand?.()?.version,
      this.game.wwEconomy?.()?.version,
      this.game.wwDepth?.()?.version,
      landSelectionOf(this.game).version,
      this.game.worldWarScenario() ? today(this.game) : 0,
      // Automation: the head's training switch.
      autoMaskOf(this.game, this.game.myPlayer()?.smallID() ?? 0),
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

  /** The army template's divisions were made first; once they exist, the whole army is ordered. */
  private finishPendingTrain() {
    const p = this.pendingTrain;
    if (p === null) return;
    const land = this.ctx()?.land;
    const order =
      land === undefined ? null : trainOrder(p.entry, land, p.region);
    if (order !== null) {
      this.pendingTrain = null;
      this.send(order);
    } else if (Date.now() > p.until) {
      this.pendingTrain = null;
      this.refused = {
        key: `army:${p.entry.id}`,
        text: translateText("ww1936.army_tpl.timeout"),
      };
      this.requestUpdate();
    }
  }

  private trainArmy(c: Ctx, e: ArmyEntry) {
    const plan = planTrain(e, this.game, c.land, translateText);
    if (!plan.ok) {
      this.refused = { key: `army:${e.id}`, text: plan.reason };
      return;
    }
    this.refused = null;
    const region = trainTarget(c.view, c.me, c.army)?.region ?? 0;
    if (plan.saves.length === 0) {
      const order = trainOrder(e, c.land, region);
      if (order !== null) this.send(order);
      return;
    }
    for (const o of plan.saves) this.send(o);
    this.pendingTrain = { entry: e, region, until: Date.now() + 15_000 };
  }

  private saveArmyEdit() {
    const ed = this.armyEdit;
    if (ed === null) return;
    const r = saveArmyEdit(libraryStore(), ed);
    this.armyEdit = null;
    this.armyNotice = r === "full" ? translateText("ww1936.library.full") : "";
  }

  private editArmyTemplate(e: ArmyEntry | null) {
    this.armyNotice = "";
    this.armyEdit = armyEditOf(e);
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
    const live = html`${head}
    ${renderAutoSwitch(
      "training",
      autoMaskOf(this.game, c.me),
      (o) => this.send(o),
      true,
    )}`;
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
      case "groups":
        body = renderGroupTab({
          game: this.game,
          view: c.view,
          me: c.me,
          day: c.day,
          send: (o) => this.send(o),
          armed: (k) => this.armed(k),
          confirmTap: (k, a) => this.confirmTap(k, a),
          onFront: () => {
            if (window.innerHeight <= COMPACT_MAX_HEIGHT) this.setOpen(false);
          },
        });
        break;
    }
    return this.renderFrame(label, live, tabs, body);
  }

  /** Automation: every army to the AI's command, or every army back. */
  private renderAllAuto(c: Ctx): TemplateResult {
    const rows = armyRows(c.view, c.me);
    const autos = rows.filter((r) => c.view.armies.get(r.id)?.mine?.auto);
    const button = (on: boolean) =>
      html`<button
        type="button"
        data-ww-army-auto-all=${on ? "on" : "off"}
        class="h-9 flex-1 rounded-md border px-2 text-xs font-semibold ${on
          ? "border-emerald-400/60 bg-emerald-900/40 hover:bg-emerald-900/70"
          : "border-white/15 bg-white/5 hover:bg-white/10"}"
        ?disabled=${on ? autos.length === rows.length : autos.length === 0}
        @click=${() => this.send({ kind: "army_auto_all", on })}
      >
        ${on ? "🤖 " : ""}${translateText(
          on ? "ww1936.auto.all_auto" : "ww1936.auto.all_manual",
        )}
      </button>`;
    return html`<div data-ww-army-auto class="mt-2 flex gap-1">
        ${button(true)} ${button(false)}
      </div>
      <p class="m-0 mt-1 text-xs leading-snug text-white/60">
        ${translateText("ww1936.auto.army_hint")}
      </p>`;
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
    return html`${this.renderAllAuto(c)}
      <ul data-ww-armies class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
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
            ${this.showDivisions ? this.renderDivisions(c, chosen) : nothing}
            <button
              type="button"
              data-ww-save-composition
              class="mt-1 h-10 w-full rounded-md border border-white/15 bg-white/10 text-xs font-semibold hover:bg-white/20"
              @click=${() => this.saveComposition(c, chosen)}
            >
              ${translateText("ww1936.army_tpl.save_composition")}
            </button>
            ${this.armyNotice === ""
              ? nothing
              : html`<p
                  data-ww-army-tpl-notice
                  class="m-0 mt-1 text-xs text-sky-200"
                >
                  ${this.armyNotice}
                </p>`}`
        : nothing}`;
  }

  /** [save this composition]: the army's divisions as a new army template. */
  private saveComposition(c: Ctx, army: number) {
    const a = c.view.armies.get(army);
    const content = compositionOf(
      c.land,
      army,
      a === undefined ? "" : armyName(a.nameNo),
    );
    if (content === null) return;
    const r = libraryStore().add(content);
    this.armyNotice =
      r === "full"
        ? translateText("ww1936.library.full")
        : translateText("ww1936.army_tpl.saved", { name: content.name });
    this.requestUpdate();
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
    const choices = trainToChoices(c.view, c.me);
    // A remembered army that is gone reads as automatic again.
    const to = choices.some((a) => a.id === WwArmyPanel.lastTrainTo)
      ? WwArmyPanel.lastTrainTo
      : 0;
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
        ...(to === 0 ? {} : { target: to }),
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
        <label class="flex items-center gap-1.5 text-white/80">
          <span class="shrink-0"
            >${translateText("ww1936.land.deploy_to")}</span
          >
          <select
            data-ww-train-to
            class="h-10 min-w-0 flex-1 rounded-md border border-white/20 bg-slate-900 px-2 text-xs text-white"
            @change=${(ev: Event) => {
              WwArmyPanel.lastTrainTo = Number(
                (ev.target as HTMLSelectElement).value,
              );
              this.requestUpdate();
            }}
          >
            <option value="0" ?selected=${to === 0}>
              ${translateText("ww1936.land.deploy_to_auto")}
            </option>
            ${choices.map(
              (a) =>
                html`<option value=${a.id} ?selected=${to === a.id}>
                  ${translateText("ww1936.land.deploy_to_army", {
                    army: armyName(a.nameNo),
                    n: a.count,
                    max: WW_MAX_ARMY_DIVISIONS,
                  })}
                </option>`,
            )}
          </select>
        </label>
        ${to !== 0
          ? nothing
          : html`<div data-ww-train-target class="text-white/70">
              ${target === null
                ? translateText("ww1936.land.train_new_army")
                : translateText("ww1936.land.train_into", {
                    army: armyName(target.nameNo),
                  })}
            </div>`}
      </div>
      ${renderArmyTemplates({
        land: c.land,
        entries: armyEntries(libraryStore().entries),
        editing: this.armyEdit,
        regionText:
          target === null
            ? translateText("ww1936.army_tpl.region_capital")
            : translateText("ww1936.army_tpl.region", {
                region: regionName(c.view.scenario, target.region),
              }),
        refused: this.refused?.key.startsWith("army:") ? this.refused.text : "",
        notice: this.armyNotice,
        train: (e) => this.trainArmy(c, e),
        edit: (e) => this.editArmyTemplate(e),
        change: (next) => (this.armyEdit = next),
        save: () => this.saveArmyEdit(),
        del: (e) =>
          this.confirmTap(`army_tpl_del:${e.id}`, () =>
            libraryStore().remove(e.id),
          ),
        armed: (e) => this.armed(`army_tpl_del:${e.id}`),
      })}
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
            ${groupRows(c.view, c.me, trainDaysFor(c.economy, c.me)).map((g) =>
              renderGroupRow(
                {
                  armed: (x) => this.armed(`cancel_group:${x.group}`),
                  deploy: (x) =>
                    this.send({ kind: "deploy_now", entry: x.entry }),
                  cancel: (x) =>
                    this.confirmTap(`cancel_group:${x.group}`, () =>
                      this.send({ kind: "cancel_train", entry: x.entry }),
                    ),
                },
                g,
              ),
            )}
            ${trainingRows(c.view, c.me)
              .filter((r) => r.data.group === undefined)
              .map((r) => this.renderEntry(c, r))}
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
    const to = trainToState(c.view, c.me, t.target);
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
        ${army === undefined || to !== null
          ? nothing
          : html`<span class="shrink-0 text-white/60"
              >→ ${armyName(army.nameNo)}</span
            >`}
      </div>
      ${to === null
        ? nothing
        : html`<div
            data-ww-entry-to=${to.gone ? "gone" : to.full ? "full" : "ok"}
            class="${to.gone || to.full ? "text-amber-300" : "text-white/60"}"
          >
            ${to.gone
              ? translateText("ww1936.land.deploy_to_gone")
              : to.full
                ? translateText("ww1936.land.deploy_to_full", {
                    army: armyName(to.nameNo),
                  })
                : translateText("ww1936.land.deploy_to_row", {
                    army: armyName(to.nameNo),
                  })}
          </div>`}
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
    if (this.convertArmy !== null) {
      return this.renderConvertArmy(c, this.convertArmy);
    }
    if (this.convertFrom !== null)
      return this.renderConvert(c, this.convertFrom);
    return html`${designButton(this.eventBus, "tank", this.game)} ${this.renderIdle(c)}
      ${this.renderConverted(c)}
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
              ${t.inUse > 0 && c.land.templates.length > 1
                ? html`<button
                    type="button"
                    data-ww-convert-open=${t.id}
                    class="mt-0.5 h-10 w-full rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20"
                    @click=${() => {
                      this.refused = null;
                      this.converted = null;
                      this.convertFrom = t.id;
                    }}
                  >
                    ${translateText("ww1936.convert.btn_template")}
                  </button>`
                : nothing}
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

  /** The overwrite picker of one template: every division of it becomes the template picked. */
  private renderConvert(c: Ctx, from: number): TemplateResult {
    const t = c.land.templates.find((x) => x.id === from);
    if (t === undefined) {
      this.convertFrom = null;
      return html``;
    }
    const key = (to: number) => `convert:${from}:${to}`;
    return renderConvertPicker({
      scope: `template:${from}`,
      intro: translateText("ww1936.convert.intro_template", {
        name: templateName(t),
        n: t.inUse,
      }),
      options: convertOptions(
        c.land.templates,
        c.land.training,
        new Set(c.economy.detail(c.me)?.researched ?? []),
        new Map([[from, t.inUse]]),
        from,
      ),
      armed: (to) => this.armed(key(to)),
      tap: (to) =>
        this.confirmTap(key(to), () => {
          this.send({ kind: "divisions_convert", to, from });
          this.converted = { from, to };
          this.convertFrom = null;
        }),
      cancel: () => (this.convertFrom = null),
      refused: "",
      queued: c.land.training.some((e) => e.template === from),
    });
  }

  /** The overwrite picker of one army: every division of it becomes the template picked. */
  private renderConvertArmy(c: Ctx, army: number): TemplateResult {
    const rows = divisionRows(c.view, c.me, army);
    const a = c.view.armies.get(army);
    if (a === undefined || rows.length === 0) {
      this.convertArmy = null;
      return html``;
    }
    const moved = new Map<number, number>();
    for (const r of rows) {
      moved.set(r.data.template, (moved.get(r.data.template) ?? 0) + 1);
    }
    const key = (to: number) => `convert_army:${army}:${to}`;
    return renderConvertPicker({
      scope: `army:${army}`,
      intro: translateText("ww1936.convert.intro_army", {
        army: armyName(a.nameNo),
        n: rows.length,
      }),
      options: convertOptions(
        c.land.templates,
        c.land.training,
        new Set(c.economy.detail(c.me)?.researched ?? []),
        moved,
        null,
      ),
      armed: (to) => this.armed(key(to)),
      tap: (to) =>
        this.confirmTap(key(to), () => {
          this.send({ kind: "divisions_convert", to, army });
          this.convertArmy = null;
        }),
      cancel: () => (this.convertArmy = null),
      refused: "",
      queued: false,
    });
  }

  /** After a conversion: delete the old template when nothing uses it any more. */
  private renderConverted(c: Ctx): TemplateResult | typeof nothing {
    const done = this.converted;
    if (done === null) return nothing;
    const to = c.land.templates.find((x) => x.id === done.to);
    const old = c.land.templates.find((x) => x.id === done.from);
    if (to === undefined) return nothing;
    const key = `convert_del:${done.from}`;
    const armed = this.armed(key);
    return html`<div
      data-ww-converted
      class="mt-2 rounded-md border border-emerald-400/40 bg-emerald-900/30 p-1.5 text-xs"
    >
      <p class="m-0">
        ${translateText("ww1936.convert.done", { name: templateName(to) })}
      </p>
      ${old === undefined || old.inUse > 0
        ? nothing
        : html`<button
            type="button"
            data-ww-convert-delete=${old.id}
            data-armed=${String(armed)}
            class="mt-1 h-10 w-full rounded-md border px-2 font-semibold ${armed
              ? "border-red-400 bg-red-900/70"
              : "border-red-400/40 bg-red-900/30"}"
            @click=${() =>
              this.confirmTap(key, () => {
                this.send({ kind: "template_delete", template: old.id });
                this.converted = null;
              })}
          >
            ${translateText(
              armed ? "ww1936.convert.delete_tap" : "ww1936.convert.delete_old",
              { name: templateName(old) },
            )}
          </button>`}
    </div>`;
  }

  /** Equipment in stock that no template uses: a bar that adds the preset which would. */
  private renderIdle(c: Ctx): TemplateResult | typeof nothing {
    const researched = new Set(c.economy.detail(c.me)?.researched ?? []);
    const groups = designGroupsOf(this.game.wwDepth?.()?.detail(c.me)?.designs);
    const idle = idleEquipment(
      c.economy.detail(c.me)?.stock ?? [],
      c.land.templates,
      researched,
      groups,
    );
    if (idle === null) return nothing;
    const name = translateText(`ww1936.tpl.${idle.preset.id}`);
    const add = () => {
      const def = {
        ...presetDef(idle.preset),
        name: name.slice(0, WW_TEMPLATE_NAME_MAX),
      };
      const block =
        c.land.templates.length >= WW_MAX_TEMPLATES
          ? "too_many_templates"
          : designer(def, techTotals(researched), researched).block;
      if (block !== null) {
        this.refused = { key: "idle", text: blockText(block) };
        return;
      }
      this.refused = null;
      this.send({
        kind: "template_save",
        template: 0,
        base: 0,
        name: def.name,
        battalions: [...def.battalions],
        support: [...def.support],
      });
    };
    return html`<div
        data-ww-idle
        class="mt-2 flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-900/30 p-1.5 text-xs"
      >
        <span class="min-w-0 flex-1"
          >${translateText("ww1936.land.idle_equipment", {
            type: equipmentName(idle.type),
            count: idle.count,
          })}</span
        >
        <button
          type="button"
          data-ww-idle-add
          class="h-9 shrink-0 rounded-md border border-emerald-400/60 bg-emerald-800/50 px-2 font-semibold"
          @click=${add}
        >
          ${translateText("ww1936.land.idle_make", { name })}
        </button>
      </div>
      ${this.refused?.key === "idle"
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
        </ul>`}`;
  }
}
