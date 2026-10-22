// World War 1936 P6 lane U2 (spec §20.5): the designer drawer. Kind tabs,
// a base-chip row, the slot-card grid (2 columns), the stat column with the
// compare target's ▲▼, the name, the experience cost, [recommended fill]
// and a two-tap [save]; the module list is the bottom sheet over the grid,
// and the designs tab lists what I have saved.
import {
  DESIGN_KINDS,
  DesignKind,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";
import {
  DESIGNER_BAR_H,
  DESIGNER_BOTTOM_H,
  DESIGNER_CARD_H,
  DESIGNER_CARD_W,
  DESIGNER_GAP,
  DESIGNER_STATS_W,
  DesignerGame,
  DesignerModel,
} from "./DesignerModel";
import { blockText as orderBlockText } from "./EconomyModel";
import { countryName, TwoTap } from "./WorldWarModel";
import { renderDesignList } from "./WwDesignList";
import {
  chipClass,
  moduleName,
  renderDesignSheet,
  slotName,
} from "./WwDesignSheet";
import { OpenWwIndustryEvent, WwDrawerBase } from "./WwDrawer";

type DesignerTab = "design" | "list";

const BTN =
  "h-7 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const KIND_KEYS: Readonly<Record<DesignKind, string>> = {
  tank: "ww1936.design.tab_tank",
  ship: "ww1936.design.tab_ship",
  plane: "ww1936.design.tab_plane",
};

@customElement("ww-designer")
export class WwDesigner extends WwDrawerBase {
  protected readonly drawerId = "designer" as const;
  @state() private tab: DesignerTab = "design";
  private model: DesignerModel | null = null;
  private readonly retireTap = new TwoTap();
  private armed = "";

  init() {
    super.init();
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "designer" && e.kind !== "designs") return;
      const m = this.ensureModel();
      if (e.kind === "designs") {
        if (this.open && this.tab === "list") return this.setOpen(false);
        this.tab = "list";
      } else {
        const kind = e.arg?.kind ?? m.kind;
        if (this.open && this.tab === "design" && m.kind === kind) {
          return this.setOpen(false);
        }
        this.tab = "design";
        m.open(kind);
      }
      this.setOpen(true);
    });
  }

  /** For tests. */
  designerModel(): DesignerModel {
    return this.ensureModel();
  }

  private ensureModel(): DesignerModel {
    if (this.model === null) {
      this.model = new DesignerModel(this.game as unknown as DesignerGame);
      this.model.onChange = () => this.requestUpdate();
    }
    return this.model;
  }

  private seen = { depth: -1, econ: -1, pol: -1, rev: -1, tab: "", armed: "" };

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const m = this.ensureModel();
    const g = this.game;
    const depth = g?.wwDepth?.()?.version ?? 0;
    const econ = g?.wwEconomy?.()?.version ?? 0;
    const pol = g?.wwPolitics?.()?.version ?? 0;
    const s = this.seen;
    if (
      s.depth !== depth ||
      s.econ !== econ ||
      s.pol !== pol ||
      s.rev !== m.rev ||
      s.tab !== this.tab ||
      s.armed !== this.armed
    ) {
      s.depth = depth;
      s.econ = econ;
      s.pol = pol;
      s.rev = m.rev;
      s.tab = this.tab;
      s.armed = this.armed;
      this.requestUpdate();
    }
  }

  render() {
    if (!this.open) return null;
    const m = this.ensureModel();
    const { top, right, bottom } = this.insets;
    const width = "min(64vw, 680px)";
    return html`<aside
      data-ww-drawer="designer"
      aria-label=${translateText("ww1936.design.title")}
      class="fixed z-[1002] flex min-h-40 flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900/92 text-sm text-white shadow-xl"
      style="top: ${top}px; right: ${right}px; bottom: ${bottom}px; width: ${width};"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${this.renderBar(m)}
      ${this.tab === "design" ? this.renderDesign(m) : this.renderList(m)}
    </aside>`;
  }

  private renderBar(m: DesignerModel): TemplateResult {
    return html`<div
      data-ww-designer-bar
      class="flex shrink-0 items-center gap-1 border-b border-white/10 px-1"
      style="height: ${DESIGNER_BAR_H}px"
    >
      <div role="tablist" class="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        ${DESIGN_KINDS.map(
          (k) =>
            html`<button
              type="button"
              role="tab"
              data-ww-design-kind=${k}
              aria-selected=${String(this.tab === "design" && m.kind === k)}
              class="${BTN} ${this.tab === "design" && m.kind === k
                ? "border-sky-400/60 bg-sky-500/20"
                : ""}"
              @click=${() => {
                this.tab = "design";
                m.setKind(k);
              }}
            >
              ${translateText(KIND_KEYS[k])}
            </button>`,
        )}
        <button
          type="button"
          role="tab"
          data-ww-design-tab-list
          aria-selected=${String(this.tab === "list")}
          class="${BTN} ${this.tab === "list"
            ? "border-sky-400/60 bg-sky-500/20"
            : ""}"
          @click=${() => (this.tab = "list")}
        >
          ${translateText("ww1936.design.tab_designs")}
        </button>
      </div>
      <button
        type="button"
        data-ww-drawer-close
        class="size-9 shrink-0 rounded-md hover:bg-white/10"
        aria-label=${translateText("common.close")}
        @click=${() => this.setOpen(false)}
      >
        ✕
      </button>
    </div>`;
  }

  private renderList(m: DesignerModel): TemplateResult {
    return html`<div data-ww-scroll class="min-h-0 flex-1 overflow-y-auto p-2">
      ${renderDesignList({
        model: m,
        armed: this.armed,
        copy: (row) => {
          this.tab = "design";
          m.open(row.kind, { ...row.def });
        },
        retire: (row) => {
          const key = `obsolete:${row.kind}:${row.slot}`;
          if (!this.retireTap.tap(key, performance.now())) {
            this.armed = key;
            setTimeout(() => {
              if (this.armed === key) this.armed = "";
            }, 3000);
            return;
          }
          this.armed = "";
          this.eventBus.emit(
            new SendWwOrderIntentEvent({
              kind: "design_obsolete",
              design: row.kind,
              slot: row.slot,
            } as never),
          );
        },
        // Merge glue (U2 -> U4): the licence requests live on the
        // industry drawer's market tab.
        openLicences: () => {
          this.setOpen(false);
          this.eventBus.emit(new WwDepthOpenEvent("market"));
        },
        licenceFrom: this.licenceFrom(m),
        makeLine: () => {
          this.eventBus.emit(new OpenWwIndustryEvent("production"));
        },
      })}
    </div>`;
  }

  private renderDesign(m: DesignerModel): TemplateResult {
    const chips = m.baseChips();
    return html`
      <div
        data-ww-base-chips
        class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 px-1"
        style="height: ${DESIGNER_BAR_H}px"
      >
        ${chips.map(
          (c) =>
            html`<button
              type="button"
              data-ww-base=${c.id}
              data-locked=${c.locked ? "true" : nothing}
              class="${BTN} ${c.selected
                ? "border-sky-400/60 bg-sky-500/20"
                : ""} ${c.locked ? "opacity-50" : ""}"
              title=${c.locked && c.tech !== null
                ? translateText("ww1936.design.module_locked", {
                    tech: translateText(`ww1936.tech.${c.tech}`),
                    year: c.year,
                  })
                : ""}
              @click=${() => {
                if (!c.locked) m.setBase(c.id);
              }}
            >
              ${c.locked ? "🔒 " : ""}${translateText(c.nameKey)}${c.genKey ===
              null
                ? ""
                : ` ${translateText(c.genKey)}`}
            </button>`,
        )}
      </div>
      <div class="flex min-h-0 flex-1 gap-2 px-2">
        <div class="relative flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          ${m.draft === null
            ? html`<p class="m-0 text-xs text-white/60">
                ${translateText(`ww1936.design.base_${m.kind}`)}
              </p>`
            : this.renderGrid(m)}
          ${m.openSlot !== null
            ? renderDesignSheet(
                m,
                m.openSlot,
                Math.floor((this.sheetBase() * 55) / 100),
                (id) => m.setModule(m.openSlot ?? 0, id),
                () => m.selectSlot(m.openSlot),
              )
            : nothing}
        </div>
        ${this.renderStats(m)}
      </div>
      ${this.renderBottom(m)}
    `;
  }

  /** The country asking me for a licence (the first request), or null. */
  private licenceFrom(m: DesignerModel): string | null {
    const id = m.pendingLicenceFrom();
    if (id === null) return null;
    const tag = this.game?.worldWarScenario?.()?.tagOfSmallId(id);
    return tag === undefined || tag === null ? "" : countryName(tag);
  }

  private sheetBase(): number {
    const el = this.querySelector("[data-ww-drawer]");
    return el instanceof HTMLElement && el.clientHeight > 0
      ? el.clientHeight
      : window.innerHeight - 40;
  }

  private renderGrid(m: DesignerModel): TemplateResult {
    const cards = m.slotCards();
    const d = m.draft!;
    return html`<div
      data-ww-slot-grid
      class="grid content-start overflow-y-auto"
      style="grid-template-columns: repeat(2, ${DESIGNER_CARD_W}px); gap: ${DESIGNER_GAP}px; height: ${Math.ceil(
        cards.length / 2,
      ) *
        (DESIGNER_CARD_H + DESIGNER_GAP) -
      DESIGNER_GAP}px"
    >
      ${cards.map(
        (c) =>
          html`<button
            type="button"
            data-ww-slot=${c.index}
            class="flex flex-col justify-between overflow-hidden rounded-md border px-1.5 py-0.5 text-left ${c.open
              ? "border-sky-400/70 bg-sky-500/15"
              : "border-white/15 bg-white/5 hover:bg-white/10"}"
            style="width: ${DESIGNER_CARD_W}px; height: ${DESIGNER_CARD_H}px"
            @click=${() => m.selectSlot(c.index)}
          >
            <span class="truncate text-[10px] leading-3 text-white/60"
              >${slotName(d.kind, c.slotKind)}</span
            >
            <span class="truncate text-xs font-semibold leading-4"
              >${moduleName(c.moduleId)}</span
            >
            <span class="flex gap-1 truncate text-[10px] leading-3">
              ${c.chips.length === 0
                ? html`<span class="text-white/40">—</span>`
                : c.chips.map(
                    (x) =>
                      html`<span class="${chipClass(x.sign)} rounded px-0.5"
                        >${translateText(`ww1936.design.stat.${x.id}`)}
                        ${x.text}</span
                      >`,
                  )}
            </span>
          </button>`,
      )}
    </div> `;
  }

  private renderSteppers(m: DesignerModel): TemplateResult {
    const d = m.draft!;
    const a = d.armorLevel ?? 0;
    const e = d.engineLevel ?? 0;
    const stepper = (
      id: string,
      label: string,
      v: number,
      set: (n: number) => void,
    ) =>
      html`<div class="flex items-center gap-1 text-xs" data-ww-stepper=${id}>
        <span class="truncate">${label}</span>
        <button
          type="button"
          data-ww-step-dec
          class="${BTN} h-6 w-7 px-0"
          ?disabled=${v <= 0}
          @click=${() => set(v - 1)}
        >
          −
        </button>
        <span class="w-4 text-center">${v}</span>
        <button
          type="button"
          data-ww-step-inc
          class="${BTN} h-6 w-7 px-0"
          ?disabled=${v >= 10}
          @click=${() => set(v + 1)}
        >
          +
        </button>
      </div>`;
    return html`<div
      data-ww-steppers
      class="flex shrink-0 items-center gap-x-2"
    >
      ${stepper(
        "armor",
        translateText("ww1936.design.armor_step", { n: a }),
        a,
        (n) => m.setLevel(n, e),
      )}
      ${stepper(
        "engine",
        translateText("ww1936.design.engine_step", { n: e }),
        e,
        (n) => m.setLevel(a, n),
      )}
    </div>`;
  }

  private renderStats(m: DesignerModel): TemplateResult {
    const rows = m.statRows();
    const cost = m.costInfo();
    const role = m.roleKey();
    return html`<div
      data-ww-design-stats
      class="flex shrink-0 flex-col overflow-y-auto"
      style="width: ${DESIGNER_STATS_W}px"
    >
      ${role === null
        ? nothing
        : html`<span
            data-ww-role
            class="mb-1 self-start rounded bg-white/15 px-1.5 text-xs font-bold"
            >${translateText(role)}</span
          >`}
      ${rows.map(
        (r) =>
          html`<div
            data-ww-stat=${r.id}
            class="flex items-baseline gap-1 text-xs"
            style="line-height: 18px"
          >
            <span class="min-w-0 flex-1 truncate text-white/70"
              >${translateText(`ww1936.design.stat.${r.id}`)}</span
            >
            <span class="font-semibold">${r.text}</span>
            <span
              class="w-12 text-right ${r.sign > 0
                ? "text-green-300"
                : r.sign < 0
                  ? "text-red-300"
                  : "text-white/30"}"
              >${r.sign > 0 ? "▲" : r.sign < 0 ? "▼" : ""}${r.diffText}</span
            >
          </div>`,
      )}
      ${cost === null
        ? nothing
        : html`<div data-ww-cost class="mt-1 text-xs text-white/80">
            ${translateText("ww1936.design.cost")}
            ${Math.round(cost.cost * 10) / 10}
            <span
              class=${cost.sign > 0
                ? "text-green-300"
                : cost.sign < 0
                  ? "text-red-300"
                  : ""}
              >${cost.sign > 0 ? "▲" : cost.sign < 0 ? "▼" : ""}</span
            >
            · ${translateText("ww1936.design.fuel")} ${cost.fuelText}
            <div class="text-[11px] text-white/60">
              ${cost.resources
                .map(([id, n]) => `${translateText(`ww1936.res.${id}`)} ${n}`)
                .join(" · ")}
            </div>
          </div>`}
    </div>`;
  }

  private renderBottom(m: DesignerModel): TemplateResult {
    const d = m.draft;
    const block = m.block();
    // Final review D (D1): a name the order's schema refuses never saves.
    const badName = d !== null && !m.nameOk();
    const have = m.xpHave();
    const armed = m.isSaveArmed(performance.now());
    const cost = m.xpCost();
    return html`<div
      data-ww-designer-bottom
      class="flex shrink-0 flex-col gap-0.5 border-t border-white/10 px-2 py-1"
      style="height: ${DESIGNER_BOTTOM_H}px"
    >
      <div
        data-ww-designer-xprow
        class="flex items-center gap-2 text-xs"
        style="height: 24px"
      >
        ${d !== null && d.kind === "tank" ? this.renderSteppers(m) : nothing}
        ${d === null
          ? nothing
          : html`<span
              data-ww-design-xp
              class=${have !== null && cost * 1000 > have ? "text-red-300" : ""}
              >${translateText("ww1936.design.xp_cost", {
                kind: translateText(m.xpKey()),
                cost,
                have: have === null ? "?" : Math.floor(have / 1000),
              })}</span
            >`}
        ${block !== null && block !== "no_xp" && d !== null
          ? html`<span
              data-ww-block=${block}
              class="min-w-0 truncate text-amber-300"
              >🔒
              ${translateText("ww1936.design.save_blocked", {
                reason: orderBlockText(block),
              })}</span
            >`
          : badName
            ? html`<span
                data-ww-block="bad_name"
                class="min-w-0 truncate text-amber-300"
                >🔒
                ${translateText("ww1936.design.save_blocked", {
                  reason: translateText("ww1936.design.bad_name"),
                })}</span
              >`
            : nothing}
      </div>
      <div class="flex items-center gap-1">
        <input
          data-ww-design-name
          type="text"
          maxlength="24"
          class="h-8 min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 text-xs"
          aria-label=${translateText("ww1936.design.name")}
          placeholder=${m.autoName()}
          .value=${d === null || d.name.startsWith("@") ? "" : d.name}
          ?disabled=${d === null}
          @change=${(e: Event) => {
            m.setName((e.target as HTMLInputElement).value);
          }}
        />
        <button
          type="button"
          data-ww-recommend
          class="${BTN} h-8"
          ?disabled=${d === null}
          @click=${() => m.recommend()}
        >
          ${translateText("ww1936.design.recommend")}
        </button>
        <button
          type="button"
          data-ww-design-save
          class="${BTN} h-8 ${armed
            ? "border-amber-400/70 bg-amber-500/20"
            : ""}"
          ?disabled=${d === null || block !== null || badName}
          @click=${() => this.onSave(m)}
        >
          ${translateText(
            armed ? "ww1936.design.save_confirm" : "ww1936.design.save",
          )}
        </button>
      </div>
    </div>`;
  }

  private onSave(m: DesignerModel) {
    const order = m.tapSave(performance.now());
    if (order === null) {
      this.requestUpdate();
      setTimeout(() => this.requestUpdate(), 3100);
      return;
    }
    this.eventBus.emit(new SendWwOrderIntentEvent(order));
    // A kept draft would save a duplicate on the next confirm.
    m.open(m.kind);
    this.tab = "list";
  }
}
