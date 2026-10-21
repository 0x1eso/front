import {
  EQUIPMENT_TYPES,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BATTALION_IDS,
  BattalionId,
  DivisionStats,
  SUPPORT_IDS,
  SupportId,
  TemplateData,
  TemplateDef,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TEMPLATES,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { BATTALIONS, SUPPORTS } from "@openfront/engine-lib/ww1936/Battalions";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import {
  blockText,
  EQUIPMENT_ICONS,
  equipmentName,
  techName,
} from "./EconomyModel";
import {
  designer,
  researchedOf,
  techOf,
  templateDef,
  templateName,
} from "./LandModel";
import { TWO_TAP_MS, TwoTap } from "./WorldWarModel";

/** Short marks for the grid cells (pre-flight R7.7: no new images). */
export const BATTALION_ICONS: Readonly<Record<BattalionId, string>> = {
  infantry: "✕",
  cavalry: "🐎",
  mountain: "▲",
  marine: "⚓",
  paratrooper: "🪂",
  motorized: "🚚",
  artillery: "💥",
  mot_artillery: "🚛",
  anti_tank: "🎯",
  anti_air: "✈",
  light_armor: "⬭",
  medium_armor: "⬬",
  // P6 (spec §5.2.6).
  heavy_armor: "⬛",
  tank_destroyer: "◣",
  sp_artillery: "💣",
  sp_anti_air: "🔺",
};

export const SUPPORT_ICONS: Readonly<Record<SupportId, string>> = {
  engineer: "⛏",
  recon: "🔭",
  support_artillery: "💥",
  support_anti_tank: "🎯",
  support_anti_air: "✈",
  field_hospital: "✚",
  logistics: "📦",
  signal: "📡",
  // P5 (spec §8.5).
  military_police: "🛡",
};

/** One row of the numbers table: its key and how to show a stat. */
const STAT_ROWS: readonly [string, string, (s: DivisionStats) => string][] = [
  ["width", "ww1936.land.stat_width", (s) => String(s.width)],
  ["men", "ww1936.land.stat_men", (s) => String(s.men)],
  ["soft", "ww1936.land.stat_soft", (s) => (s.soft / 100).toFixed(1)],
  ["hard", "ww1936.land.stat_hard", (s) => (s.hard / 100).toFixed(1)],
  ["defense", "ww1936.land.stat_defense", (s) => (s.def / 100).toFixed(1)],
  [
    "breakthrough",
    "ww1936.land.stat_breakthrough",
    (s) => (s.brk / 100).toFixed(1),
  ],
  ["org", "ww1936.land.stat_org", (s) => (s.orgMilli / 1000).toFixed(1)],
  ["hp", "ww1936.land.stat_hp", (s) => (s.hpMilli / 1000).toFixed(1)],
  ["armor", "ww1936.land.stat_armor", (s) => (s.armor / 100).toFixed(1)],
  ["pierce", "ww1936.land.stat_pierce", (s) => (s.pierce / 100).toFixed(1)],
  [
    "hardness",
    "ww1936.land.stat_hardness",
    (s) => `${Math.round(s.hardnessPm / 10)}%`,
  ],
  ["speed", "ww1936.land.stat_speed", (s) => (s.speedCenti / 100).toFixed(1)],
  [
    "supply",
    "ww1936.land.stat_supply",
    (s) => (s.supplyMilli / 1000).toFixed(2),
  ],
  ["train_days", "ww1936.land.stat_train_days", (s) => String(s.trainDays)],
];

type Pick =
  | { kind: "battalion"; index: number }
  | { kind: "support"; index: number };

/** The template designer leaves (back to the list). */
export class WwDesignerCloseEvent extends Event {
  constructor() {
    super("ww-designer-close", { bubbles: true, composed: true });
  }
}

/**
 * World War 1936 P2 (spec §15.5 tab 3, pre-flight U1): a template's
 * designer inside the army drawer — the 5 × 5 battalion grid and the four
 * support slots (tap an empty one for the list, a full one to change or
 * remove it; locked ones say which tech they need), the numbers table
 * (templateStats, changes in amber), the equipment with its factory-days,
 * the army experience it costs. Save (two taps when it costs experience),
 * copy, delete (two taps, only when no division uses it), the name.
 */
@customElement("ww-template-designer")
export class WwTemplateDesigner extends LitElement {
  @property({ attribute: false }) game: GameView;
  @property({ attribute: false }) eventBus: EventBus;
  /** The template edited; 0: a new one. */
  @property({ attribute: false }) templateId = 0;
  /** The template a new one copies (0: none). */
  @property({ attribute: false }) baseId = 0;
  @state() private draft: TemplateDef = {
    name: "",
    battalions: [],
    support: [],
  };
  @state() private saved: TemplateDef | null = null;
  @state() private picking: Pick | null = null;
  @state() private editingName = false;
  @state() private refused: WwOrderBlock | null = null;
  /** The template this one copies on save (its id), once [Copy] was pressed. */
  private copyOf = 0;
  private editing = 0;
  private readonly twoTap = new TwoTap();

  createRenderRoot() {
    return this;
  }

  private me(): number {
    return this.game?.myPlayer()?.smallID() ?? 0;
  }

  private templates(): TemplateData[] {
    return this.game?.wwLand?.()?.details.get(this.me())?.templates ?? [];
  }

  private template(id: number): TemplateData | null {
    return this.templates().find((t) => t.id === id) ?? null;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("templateId") || changed.has("baseId")) this.load();
  }

  private load() {
    const t = this.template(this.templateId);
    const base = this.template(this.baseId);
    this.editing = t === null ? 0 : t.id;
    this.copyOf = t === null ? (base?.id ?? 0) : 0;
    const from = t ?? base;
    this.saved = from === null ? null : templateDef(from);
    this.draft =
      from === null
        ? { name: "", battalions: [], support: [] }
        : {
            name: templateName(from),
            battalions: [...from.battalions],
            support: [...from.support],
          };
    this.picking = null;
    this.editingName = false;
    this.refused = null;
  }

  private armed(key: string): boolean {
    return this.twoTap.isArmed(key, Date.now());
  }

  private confirmTap(key: string, act: () => void) {
    if (this.twoTap.tap(key, Date.now())) act();
    this.requestUpdate();
    setTimeout(() => this.requestUpdate(), TWO_TAP_MS + 50);
  }

  private close() {
    this.dispatchEvent(new WwDesignerCloseEvent());
  }

  private setBattalion(index: number, id: BattalionId | null) {
    const b = [...this.draft.battalions];
    if (id === null) b.splice(index, 1);
    else if (index < b.length) b[index] = id;
    else b.push(id);
    this.draft = { ...this.draft, battalions: b };
    this.picking = null;
    this.refused = null;
  }

  private setSupport(index: number, id: SupportId | null) {
    const s = [...this.draft.support];
    if (id === null) s.splice(index, 1);
    else if (index < s.length) s[index] = id;
    else s.push(id);
    this.draft = { ...this.draft, support: s };
    this.picking = null;
    this.refused = null;
  }

  /** The name a save sends: the draft's, or a 1936 default's translated name. */
  private saveName(): string {
    return this.draft.name.trim().slice(0, WW_TEMPLATE_NAME_MAX);
  }

  render() {
    const me = this.me();
    const economy = this.game?.wwEconomy?.() ?? null;
    const land = this.game?.wwLand?.()?.details.get(me) ?? null;
    if (economy === null || land === null) return nothing;
    const researched = researchedOf(economy, me);
    const tech = techOf(economy, me);
    const after = { ...this.draft, name: this.saveName() };
    const d = designer(this.saved, after, tech, researched, land.armyXpMilli);
    const beforeStats =
      this.saved === null ? null : templateStats(this.saved, tech, GEN1);
    const isNew = this.editing === 0;
    const block: WwOrderBlock | null =
      after.name === ""
        ? "bad_template"
        : isNew && this.templates().length >= WW_MAX_TEMPLATES
          ? "too_many_templates"
          : d.block;
    return html`<div data-ww-designer class="flex flex-col gap-2 pt-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-ww-designer-back
          class="size-9 shrink-0 rounded-md border border-white/15 hover:bg-white/10"
          aria-label=${translateText("common.back")}
          @click=${() => this.close()}
        >
          ←
        </button>
        ${this.renderName()}
      </div>
      <div
        data-ww-designer-xp
        class="text-xs ${d.xpCost > land.armyXpMilli
          ? "text-red-300"
          : "text-white/80"}"
      >
        ${translateText("ww1936.land.designer_xp", {
          cost: Math.ceil(d.xpCost / 1000),
          have: Math.floor(land.armyXpMilli / 1000),
        })}
      </div>
      ${this.renderGrid()} ${this.renderPicker(researched)}
      ${this.renderStats(d.stats, beforeStats, d.factoryDays)}
      ${this.refused === null
        ? nothing
        : html`<p
            data-ww-block=${this.refused}
            class="m-0 text-xs text-red-300"
          >
            🔒 ${blockText(this.refused)}
          </p>`}
      ${this.renderActions(block, d.xpCost)}
    </div>`;
  }

  private renderName(): TemplateResult {
    if (this.editingName) {
      return html`<input
        data-ww-designer-name-input
        class="h-9 min-w-0 flex-1 rounded-md border border-white/20 bg-gray-800 px-2 text-sm text-white"
        maxlength=${WW_TEMPLATE_NAME_MAX}
        .value=${this.draft.name}
        aria-label=${translateText("ww1936.land.designer_name")}
        @input=${(e: Event) => {
          this.draft = {
            ...this.draft,
            name: (e.target as HTMLInputElement).value,
          };
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") this.editingName = false;
        }}
        @blur=${() => (this.editingName = false)}
      />`;
    }
    return html`<button
      type="button"
      data-ww-designer-name
      class="h-9 min-w-0 flex-1 truncate rounded-md border border-white/15 bg-white/5 px-2 text-left text-sm font-bold"
      aria-label=${translateText("ww1936.land.designer_name")}
      @click=${() => {
        this.editingName = true;
        void this.updateComplete.then(() =>
          this.querySelector<HTMLInputElement>(
            "[data-ww-designer-name-input]",
          )?.focus(),
        );
      }}
    >
      ✎
      ${this.draft.name === ""
        ? translateText("ww1936.land.designer_name")
        : this.draft.name}
    </button>`;
  }

  private cell(
    kind: "battalion" | "support",
    index: number,
    icon: string,
    label: string,
    changed: boolean,
  ): TemplateResult {
    const picked = this.picking?.kind === kind && this.picking.index === index;
    return html`<button
      type="button"
      data-ww-slot-kind=${kind}
      data-ww-slot=${index}
      data-changed=${String(changed)}
      aria-label=${label}
      aria-pressed=${String(picked)}
      class="flex size-9 items-center justify-center rounded-md border text-sm ${changed
        ? "border-yellow-300"
        : "border-white/15"} ${picked
        ? "bg-amber-700/60"
        : icon === ""
          ? "border-dashed bg-transparent"
          : "bg-white/10"}"
      @click=${() => {
        this.picking = picked ? null : ({ kind, index } as Pick);
        this.refused = null;
      }}
    >
      ${icon}
    </button>`;
  }

  private renderGrid(): TemplateResult {
    const b = this.draft.battalions;
    const before = this.saved;
    // The battalions fill the 5 × 5 grid in order; the next empty cell adds one.
    const cells = Math.min(WW_MAX_BATTALIONS, b.length + 1);
    const grid = [];
    for (let i = 0; i < WW_MAX_BATTALIONS; i++) {
      if (i < b.length) {
        grid.push(
          this.cell(
            "battalion",
            i,
            BATTALION_ICONS[b[i]],
            translateText(`ww1936.battalion.${b[i]}`),
            before !== null && before.battalions[i] !== b[i],
          ),
        );
      } else if (i < cells) {
        grid.push(
          this.cell(
            "battalion",
            i,
            "",
            translateText("ww1936.land.slot_empty"),
            before !== null && i < before.battalions.length,
          ),
        );
      } else {
        grid.push(
          html`<span
            class="size-9 rounded-md border border-dashed border-white/5"
          ></span>`,
        );
      }
    }
    const s = this.draft.support;
    const support = [];
    for (let i = 0; i < WW_MAX_SUPPORT; i++) {
      support.push(
        i <= s.length && i < WW_MAX_SUPPORT
          ? this.cell(
              "support",
              i,
              i < s.length ? SUPPORT_ICONS[s[i]] : "",
              i < s.length
                ? translateText(`ww1936.support.${s[i]}`)
                : translateText("ww1936.land.slot_empty"),
              before !== null && before.support[i] !== s[i],
            )
          : html`<span
              class="size-9 rounded-md border border-dashed border-white/5"
            ></span>`,
      );
    }
    return html`<div class="flex gap-3">
      <div data-ww-battalion-grid class="grid grid-cols-5 gap-1">${grid}</div>
      <div data-ww-support-grid class="grid grid-cols-1 content-start gap-1">
        ${support}
      </div>
    </div>`;
  }

  private renderPicker(
    researched: ReadonlySet<WwTechId>,
  ): TemplateResult | typeof nothing {
    const p = this.picking;
    if (p === null) return nothing;
    const filled =
      p.kind === "battalion"
        ? p.index < this.draft.battalions.length
        : p.index < this.draft.support.length;
    const remove = filled
      ? html`<button
          type="button"
          data-ww-slot-remove
          class="h-9 rounded-md border border-red-400/60 bg-red-900/40 px-2 text-xs font-semibold"
          @click=${() =>
            p.kind === "battalion"
              ? this.setBattalion(p.index, null)
              : this.setSupport(p.index, null)}
        >
          ${translateText("ww1936.land.slot_remove")}
        </button>`
      : nothing;
    const option = (
      id: string,
      icon: string,
      name: string,
      facts: string,
      missing: WwTechId | undefined,
      pick: () => void,
    ) =>
      html`<li>
        <button
          type="button"
          data-ww-pick=${id}
          data-locked=${String(missing !== undefined)}
          aria-disabled=${String(missing !== undefined)}
          class="flex min-h-9 w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs ${missing ===
          undefined
            ? "border-white/15 bg-white/5 hover:bg-white/15"
            : "border-white/5 bg-gray-900/60 text-white/45"}"
          @click=${() => {
            if (missing === undefined) pick();
          }}
        >
          <span aria-hidden="true" class="w-5 text-center">${icon}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">${name}</span>
            <span class="block truncate text-[11px] text-white/60"
              >${missing === undefined
                ? facts
                : translateText("ww1936.land.locked_by", {
                    tech: techName(missing),
                  })}</span
            >
          </span>
        </button>
      </li>`;
    if (p.kind === "battalion") {
      return html`<div data-ww-picker="battalion" class="flex flex-col gap-1">
        ${remove}
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          ${BATTALION_IDS.map((id) => {
            const b = BATTALIONS[id];
            return option(
              id,
              BATTALION_ICONS[id],
              translateText(`ww1936.battalion.${id}`),
              `${translateText("ww1936.land.stat_width")} ${b.width} · ${translateText(
                "ww1936.land.stat_soft",
              )} ${b.soft / 100} · ${translateText("ww1936.land.stat_hard")} ${
                b.hard / 100
              } · ${translateText("ww1936.land.stat_defense")} ${b.def / 100}`,
              b.techs.find((t) => !researched.has(t)),
              () => this.setBattalion(p.index, id),
            );
          })}
        </ul>
      </div>`;
    }
    const taken = new Set(this.draft.support.filter((_, i) => i !== p.index));
    return html`<div data-ww-picker="support" class="flex flex-col gap-1">
      ${remove}
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        ${SUPPORT_IDS.filter((id) => !taken.has(id)).map((id) => {
          const s = SUPPORTS[id];
          return option(
            id,
            SUPPORT_ICONS[id],
            translateText(`ww1936.support.${id}`),
            `${translateText("ww1936.land.stat_men")} ${s.men}`,
            s.techs.find((t) => !researched.has(t)),
            () => this.setSupport(p.index, id),
          );
        })}
      </ul>
    </div>`;
  }

  private renderStats(
    s: DivisionStats,
    before: DivisionStats | null,
    factoryDays: number[],
  ): TemplateResult {
    return html`<table data-ww-designer-stats class="w-full text-xs">
      <tbody>
        ${STAT_ROWS.map(([id, key, show]) => {
          const now = show(s);
          const changed = before !== null && show(before) !== now;
          return html`<tr data-ww-stat=${id}>
            <td class="py-0.5 text-white/60">${translateText(key)}</td>
            <td
              data-changed=${String(changed)}
              class="py-0.5 text-right tabular-nums ${changed
                ? "font-semibold text-amber-300"
                : ""}"
            >
              ${now}
            </td>
          </tr>`;
        })}
        <tr>
          <td colspan="2" class="pt-1 text-white/60">
            ${translateText("ww1936.land.stat_equipment")}
          </td>
        </tr>
        ${EQUIPMENT_TYPES.map((t, i) =>
          s.need[i] === 0
            ? nothing
            : html`<tr data-ww-need=${t}>
                <td class="py-0.5">
                  ${EQUIPMENT_ICONS[t]} ${equipmentName(t)}
                </td>
                <td class="py-0.5 text-right tabular-nums">
                  ${s.need[i]} ·
                  ${translateText("ww1936.land.factory_days", {
                    days: factoryDays[i],
                  })}
                </td>
              </tr>`,
        )}
      </tbody>
    </table>`;
  }

  private renderActions(
    block: WwOrderBlock | null,
    xpCost: number,
  ): TemplateResult {
    const id = this.editing;
    const t = this.template(id);
    const saveKey = `save:${id}:${this.copyOf}`;
    const deleteKey = `delete:${id}`;
    const save = () => {
      if (block !== null) {
        this.refused = block;
        return;
      }
      const send = () => {
        this.eventBus.emit(
          new SendWwOrderIntentEvent({
            kind: "template_save",
            template: id,
            base: id === 0 ? this.copyOf : 0,
            name: this.saveName(),
            battalions: [...this.draft.battalions],
            support: [...this.draft.support],
          }),
        );
        this.close();
      };
      // Spending army experience takes a second tap (spec §15.5).
      if (xpCost > 0) this.confirmTap(saveKey, send);
      else send();
    };
    const del = () => {
      if (t === null) return;
      if (t.inUse > 0) {
        this.refused = "template_in_use";
        return;
      }
      this.confirmTap(deleteKey, () => {
        this.eventBus.emit(
          new SendWwOrderIntentEvent({ kind: "template_delete", template: id }),
        );
        this.close();
      });
    };
    const copy = () => {
      if (t === null) return;
      // A new template from this one: saving it costs only what then changes.
      this.copyOf = t.id;
      this.editing = 0;
      const name = `${this.draft.name} 2`.slice(0, WW_TEMPLATE_NAME_MAX);
      this.draft = { ...this.draft, name };
      this.refused = null;
    };
    const saveArmed = this.armed(saveKey);
    const deleteArmed = this.armed(deleteKey);
    const cls = "h-9 flex-1 rounded-md border px-2 text-xs font-semibold";
    return html`<div class="flex gap-1">
      <button
        type="button"
        data-ww-designer-save
        data-armed=${String(saveArmed)}
        aria-disabled=${String(block !== null)}
        class="${cls} ${block !== null
          ? "border-white/5 bg-white/5 text-white/40"
          : saveArmed
            ? "border-amber-300 bg-amber-700/60"
            : "border-emerald-400/60 bg-emerald-800/50"}"
        @click=${save}
      >
        ${translateText(
          saveArmed ? "ww1936.land.tap_again" : "ww1936.land.designer_save",
        )}
      </button>
      ${t === null
        ? nothing
        : html`<button
              type="button"
              data-ww-designer-copy
              class="${cls} border-white/15 bg-white/10"
              @click=${copy}
            >
              ${translateText("ww1936.land.designer_copy")}
            </button>
            <button
              type="button"
              data-ww-designer-delete
              data-armed=${String(deleteArmed)}
              aria-disabled=${String(t.inUse > 0)}
              class="${cls} ${t.inUse > 0
                ? "border-white/5 bg-white/5 text-white/40"
                : deleteArmed
                  ? "border-red-400 bg-red-900/70"
                  : "border-red-400/50 bg-red-900/30"}"
              @click=${del}
            >
              ${translateText(
                deleteArmed
                  ? "ww1936.land.tap_again"
                  : "ww1936.land.designer_delete",
              )}
            </button>`}
    </div>`;
  }
}
