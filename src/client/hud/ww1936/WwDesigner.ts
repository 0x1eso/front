// World War 1936 P6 lane U2 (spec §20.5): the designer drawer. Kind tabs,
// a base-chip row, the slot-card grid (2 columns), the stat column with the
// compare target's ▲▼, the name, the experience cost, [recommended fill]
// and a two-tap [save]; the module list is the bottom sheet over the grid,
// and the designs tab lists what I have saved.
import {
  DESIGN_KINDS,
  DesignKind,
  TankRole,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  staticKeyOfCell,
  staticKeyOfPlaneCell,
} from "@openfront/engine-lib/ww1936/DesignCellKeys";
import { shipBase } from "@openfront/engine-lib/ww1936/DesignRules";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";
import { designerOn } from "./DesignerFlag";
import {
  DESIGNER_CARD_H,
  DESIGNER_CARD_W,
  DESIGNER_GAP,
  DESIGNER_STATS_W,
  designerBarH,
  designerBottomH,
  DesignerGame,
  DesignerModel,
  designerStatusH,
  PLANE_TYPES_LIST,
  PlaneCell,
  TANK_ROLES_LIST,
  TankCell,
} from "./DesignerModel";
import { LibEntry, libraryStore } from "./DesignLibrary";
import { entryName, LibraryAuto } from "./DesignLibraryStatus";
import { blockText as orderBlockText } from "./EconomyModel";
import { StartPrep } from "./LobbyPrep";
import { countryName, TwoTap } from "./WorldWarModel";
import { LibraryUi, renderLibrary } from "./WwDesignLibrary";
import { renderDesignList } from "./WwDesignList";
import {
  chipClass,
  moduleName,
  renderDesignSheet,
  slotName,
} from "./WwDesignSheet";
import { OpenWwIndustryEvent, OpenWwNavyEvent, WwDrawerBase } from "./WwDrawer";
import { wwPanelStyle } from "./WwPanelMode";

type DesignerTab = "design" | "list" | "library";

const BTN =
  "h-7 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const KIND_KEYS: Readonly<Record<DesignKind, string>> = {
  tank: "ww1936.design.tab_tank",
  ship: "ww1936.design.tab_ship",
  plane: "ww1936.design.tab_plane",
};

/** The save button's text: a tank saved over a cell's design says every tank of the cell changes. */
export function saveLabel(
  overwrites: boolean,
  armed: boolean,
  plane = false,
  ship = false,
): string {
  if (ship) {
    // A ship cell's save: new ships and running lines use it, ships in service stay.
    if (overwrites) {
      return armed
        ? "ww1936.design.save_cell_confirm_ship"
        : "ww1936.design.save_cell_ship";
    }
    return armed ? "ww1936.design.save_confirm" : "ww1936.design.save";
  }
  if (overwrites) {
    return armed
      ? plane
        ? "ww1936.design.save_cell_confirm_plane"
        : "ww1936.design.save_cell_confirm"
      : "ww1936.design.save_cell";
  }
  return armed ? "ww1936.design.save_confirm" : "ww1936.design.save";
}

@customElement("ww-designer")
export class WwDesigner extends WwDrawerBase {
  protected readonly drawerId = "designer" as const;
  @state() private tab: DesignerTab = "design";
  private model: DesignerModel | null = null;
  /**
   * Final review C (M1): a tapped locked base chip's reason (the technology
   * and its year), shown for a few seconds in the bottom bar — a title is
   * hover-only, and a phone has none.
   */
  @state() private lockedTip: string | null = null;
  private lockedTipTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly retireTap = new TwoTap();
  private armed = "";
  private readonly store = libraryStore();
  private readonly libTap = new TwoTap();
  private auto: LibraryAuto | null = null;
  private startPrep: StartPrep | null = null;
  /**
   * The lobby's preparation screen hosts this designer on its own adapter
   * game: always a draft (no research lock), no in-game list or save, and a
   * library card edits instead of loads.
   */
  public lobby = false;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  /** The name of the design just saved into a cell no static stands in for (offers a production line). */
  @state() private savedHint: string | null = null;
  private savedHintTimer: ReturnType<typeof setTimeout> | null = null;
  /** A short line when the library made something (shown even with the drawer shut). */
  @state() private notice: string | null = null;
  @state() private libUi: LibraryUi = {
    armed: "",
    message: "",
    code: "",
    importText: "",
  };

  init() {
    super.init();
    this.auto = new LibraryAuto(
      this.store,
      (o) => this.eventBus.emit(new SendWwOrderIntentEvent(o)),
      (text) => this.showNotice(text),
    );
    this.startPrep = this.lobby
      ? null
      : new StartPrep(
          (o) => this.eventBus.emit(new SendWwOrderIntentEvent(o)),
          (text) => this.showNotice(text),
        );
    this.store.subscribe(() => this.requestUpdate());
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "designer" && e.kind !== "designs") return;
      // ww63: designer off, only the library (divisions, armies, air groups) opens.
      const on = this.designerOn();
      if (!on && e.kind === "designer") return;
      const m = this.ensureModel();
      if (e.kind === "designs" && (e.arg?.tab === "library" || !on)) {
        if (this.open && this.tab === "library") return this.setOpen(false);
        this.store.reload();
        this.tab = "library";
      } else if (e.kind === "designs") {
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

  /** Whether the designer is on in this game (ww63: off hides all of it, keeps the library). */
  private designerOn(): boolean {
    return designerOn(this.game);
  }

  /** For tests. */
  designerModel(): DesignerModel {
    return this.ensureModel();
  }

  private ensureModel(): DesignerModel {
    if (this.model === null) {
      this.model = new DesignerModel(this.game as unknown as DesignerGame);
      this.model.onChange = () => this.requestUpdate();
      if (this.lobby) this.model.draftMode = true;
    }
    return this.model;
  }

  private seen = { depth: -1, econ: -1, pol: -1, rev: -1, tab: "", armed: "" };

  private showNotice(text: string): void {
    this.notice = text;
    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice = null;
      this.noticeTimer = null;
    }, 4000);
  }

  tick() {
    this.refitIfOpen();
    // Before the auto-creator: see LobbyPrep.StartPrep.
    this.startPrep?.tick(this.game);
    this.auto?.tick(this.game);
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
    if (!this.open) {
      return this.notice === null
        ? null
        : html`<div
            data-ww-lib-notice
            role="status"
            class="pointer-events-none fixed top-12 left-1/2 z-[1003] -translate-x-1/2 rounded-md border border-emerald-400/50 bg-gray-900/95 px-3 py-2 text-xs font-semibold text-emerald-200"
          >
            ${this.notice}
          </div>`;
    }
    const m = this.ensureModel();
    const on = this.designerOn();
    const tab: DesignerTab = on ? this.tab : "library";
    return html`<aside
      data-ww-drawer="designer"
      aria-label=${translateText("ww1936.design.title")}
      class="fixed z-[1002] flex flex-col overflow-hidden bg-gray-900 text-sm text-white"
      style=${wwPanelStyle(this.minimized)}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${this.renderBar(m)}
      ${tab === "design"
        ? this.renderDesign(m)
        : tab === "list"
          ? this.renderList(m)
          : this.renderLibraryTab()}
      ${this.notice === null
        ? nothing
        : html`<div
            data-ww-lib-notice
            role="status"
            class="pointer-events-none absolute top-10 left-1/2 z-20 -translate-x-1/2 rounded-md border border-emerald-400/50 bg-gray-900/95 px-3 py-2 text-xs font-semibold text-emerald-200"
          >
            ${this.notice}
          </div>`}
    </aside>`;
  }

  private renderBar(m: DesignerModel): TemplateResult {
    return html`<div
      data-ww-designer-bar
      class="flex shrink-0 items-center gap-1 border-b border-white/10 px-1"
      style="height: ${designerBarH(window.innerWidth)}px"
    >
      <span class="shrink-0 pl-2 text-sm font-bold"
        >${translateText("ww1936.design.title")}</span
      >
      <div role="tablist" class="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        ${(this.designerOn() ? DESIGN_KINDS : []).map(
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
        ${this.lobby || !this.designerOn()
          ? nothing
          : html`<button
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
            </button>`}
        <button
          type="button"
          role="tab"
          data-ww-design-tab-library
          aria-selected=${String(!this.designerOn() || this.tab === "library")}
          class="${BTN} ${!this.designerOn() || this.tab === "library"
            ? "border-sky-400/60 bg-sky-500/20"
            : ""}"
          @click=${() => {
            this.store.reload();
            this.tab = "library";
          }}
        >
          ${translateText("ww1936.library.tab")}
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
      ${this.savedHint === null
        ? nothing
        : html`<div
            data-ww-saved-hint
            class="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2 text-xs"
          >
            <span class="min-w-40 flex-1 break-words"
              >${translateText("ww1936.design.saved_no_line", {
                name: this.savedHint,
              })}</span
            >
            <button
              type="button"
              data-ww-saved-line
              class="${BTN} h-10 shrink-0"
              @click=${() => {
                this.savedHint = null;
                this.eventBus.emit(new OpenWwIndustryEvent("production"));
              }}
            >
              ${translateText("ww1936.design.make_line")}
            </button>
          </div>`}
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
        makeLine: (row) => {
          const sb = row.kind === "ship" ? shipBase(row.def.base) : null;
          if (sb !== null) {
            this.eventBus.emit(
              new OpenWwNavyEvent("shipyards", { cls: sb.cls, gen: sb.gen }),
            );
            return;
          }
          this.eventBus.emit(new OpenWwIndustryEvent("production"));
        },
      })}
    </div>`;
  }

  private renderDesign(m: DesignerModel): TemplateResult {
    if (m.kind === "tank") return this.renderTankDesign(m);
    if (m.kind === "plane") return this.renderTankDesign(m);
    const chips = m.baseChips();
    return html`
      <div
        data-ww-base-chips
        class="flex max-h-[45vh] shrink-0 flex-wrap content-start items-center gap-1 overflow-y-auto border-b border-white/10 px-1"
        style="min-height: ${designerBarH(window.innerWidth)}px"
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
              @click=${() => {
                if (!c.locked) {
                  m.setBase(c.id);
                  return;
                }
                if (m.draftMode) m.setBase(c.id);
                if (c.tech !== null) {
                  this.showLockedTip(
                    translateText("ww1936.design.module_locked", {
                      tech: translateText(`ww1936.tech.${c.tech}`),
                      year: c.year,
                    }),
                  );
                }
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

  /**
   * The tank tab: a role selector, the chassis cells of that role (locked /
   * not designed / my design with its score and the old mark), then the
   * draft of the chosen cell. One scrolling column, so a phone needs no
   * sideways scroll; every target is at least 40 px.
   */
  private renderTankDesign(m: DesignerModel): TemplateResult {
    const plane = m.kind === "plane";
    const cells = plane ? m.planeCells() : m.cells();
    const types: readonly string[] = plane ? PLANE_TYPES_LIST : TANK_ROLES_LIST;
    const cur: string = plane ? m.planeTypeSel : m.tankRoleSel;
    return html`
      <div data-ww-scroll class="min-h-0 flex-1 overflow-y-auto px-2 pb-1">
        <div
          data-ww-role-row
          role="tablist"
          class=${plane
            ? "grid grid-cols-2 gap-1 py-1 sm:grid-cols-5"
            : "flex flex-wrap gap-1 py-1"}
        >
          ${types.map(
            (r) =>
              html`<button
                type="button"
                role="tab"
                data-ww-role-tab=${r}
                aria-selected=${String(cur === r)}
                class="${BTN} min-h-10 min-w-0 ${plane
                  ? ""
                  : "flex-1"} ${cur === r
                  ? "border-sky-400/60 bg-sky-500/20"
                  : ""}"
                @click=${() =>
                  plane ? m.setPlaneType(r) : m.setRole(r as TankRole)}
              >
                ${translateText(
                  plane ? `ww1936.equip.${r}` : `ww1936.role.${r}`,
                )}
              </button>`,
          )}
        </div>
        <div data-ww-cells class="grid grid-cols-2 gap-1 sm:grid-cols-3">
          ${cells.map((c) => this.renderCell(m, c))}
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <div class="relative flex min-w-[302px] flex-1 flex-col gap-1">
            ${m.draft === null
              ? html`<p class="m-0 text-xs text-white/60">
                  ${translateText(
                    plane
                      ? "ww1936.design.pick_cell_plane"
                      : "ww1936.design.pick_cell",
                  )}
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
      </div>
      ${this.renderBottom(m)}
    `;
  }

  private renderCell(
    m: DesignerModel,
    c: TankCell | PlaneCell,
  ): TemplateResult {
    return html`<button
      type="button"
      data-ww-cell=${c.base}
      data-locked=${c.locked ? "true" : nothing}
      data-old=${c.old ? "true" : nothing}
      class="flex min-h-10 min-w-0 flex-col justify-center overflow-hidden rounded-md border px-2 py-0.5 text-left text-xs ${c.selected
        ? "border-sky-400/70 bg-sky-500/20"
        : "border-white/15 bg-white/5 hover:bg-white/10"} ${c.locked
        ? "opacity-50"
        : ""}"
      @click=${() => {
        if (!c.locked || m.draftMode) m.setBase(c.base);
        if (c.locked && c.tech !== null) {
          this.showLockedTip(
            translateText("ww1936.design.module_locked", {
              tech: translateText(`ww1936.tech.${c.tech}`),
              year: c.year,
            }),
          );
        }
      }}
    >
      <span class="truncate font-semibold"
        >${c.locked ? "🔒 " : ""}${translateText(c.nameKey)}</span
      >
      <span class="flex items-center gap-1 truncate text-[11px] text-white/70">
        ${c.saved !== null
          ? html`<span data-ww-cell-name class="truncate"
                >${m.displayName(c.saved.def)}</span
              ><span data-ww-cell-score class="shrink-0"
                >${translateText("ww1936.design.cell_score", {
                  n: c.score,
                })}</span
              >${c.old
                ? html`<span
                    data-ww-old
                    class="shrink-0 rounded bg-amber-500/30 px-1 text-amber-200"
                    >${translateText("ww1936.design.old")}</span
                  >`
                : nothing}`
          : c.locked
            ? translateText("ww1936.design.cell_locked")
            : translateText("ww1936.design.cell_unsaved")}
      </span>
    </button>`;
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

  private showLockedTip(text: string): void {
    this.lockedTip = text;
    if (this.lockedTipTimer !== null) clearTimeout(this.lockedTipTimer);
    this.lockedTipTimer = setTimeout(() => {
      this.lockedTip = null;
      this.lockedTipTimer = null;
    }, 3000);
  }

  private renderBottom(m: DesignerModel): TemplateResult {
    const d = m.draft;
    const draft = m.draftMode;
    // Draft mode: only the library's checks count (research lock lifted).
    const block = draft ? m.libraryBlock() : m.block();
    // Final review D (D1): a name the order's schema refuses never saves.
    const badName = d !== null && !m.nameOk();
    const armed = m.isSaveArmed(performance.now());
    return html`<div
      data-ww-designer-bottom
      class="flex shrink-0 flex-col gap-0.5 border-t border-white/10 px-2 py-1"
      style="height: ${designerBottomH(window.innerWidth)}px"
    >
      <div
        data-ww-designer-xprow
        class="flex items-center gap-2 text-xs"
        style="height: ${designerStatusH(window.innerWidth)}px"
      >
        ${d !== null && d.kind === "tank" ? this.renderSteppers(m) : nothing}
        ${this.lockedTip !== null
          ? html`<span
              data-ww-locked-tip
              class="min-w-0 truncate text-amber-300"
              >🔒 ${this.lockedTip}</span
            >`
          : nothing}
        ${this.lockedTip === null && block === null && d?.kind === "ship"
          ? html`<span
              data-ww-ship-save-note
              class="min-w-0 text-[11px] leading-tight text-white/70"
              >${translateText("ww1936.design.ship_save_note")}</span
            >`
          : nothing}
        ${this.lockedTip === null && block !== null && d !== null
          ? html`<span
              data-ww-block=${block}
              class="min-w-0 truncate text-amber-300"
              >🔒
              ${translateText("ww1936.design.save_blocked", {
                reason:
                  block === "design_slots_full" && d.kind !== "ship"
                    ? translateText(
                        d.kind === "plane"
                          ? "ww1936.design.pool_full_plane"
                          : "ww1936.design.pool_full",
                      )
                    : orderBlockText(block),
              })}</span
            >`
          : this.lockedTip === null && d !== null && m.roleMismatch()
            ? html`<span
                data-ww-block="role"
                class="min-w-0 truncate text-amber-300"
                >🔒
                ${translateText("ww1936.design.save_blocked", {
                  reason: translateText("ww1936.design.role_mismatch"),
                })}</span
              >`
            : this.lockedTip === null && badName
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
        ${this.lobby
          ? nothing
          : html`<button
              type="button"
              data-ww-draft-toggle
              role="switch"
              aria-checked=${String(draft)}
              class="${BTN} h-10 min-w-10 ${draft
                ? "border-amber-400/70 bg-amber-500/20"
                : ""}"
              @click=${() => m.setDraftMode(!draft)}
            >
              ${translateText("ww1936.library.draft")}
            </button>`}
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
          data-ww-lib-save
          class="${BTN} h-10"
          ?disabled=${d === null ||
          badName ||
          (block !== null && block !== "design_slots_full")}
          @click=${() => this.saveToLibrary(m)}
        >
          ${translateText("ww1936.library.save")}
        </button>
        ${this.lobby
          ? nothing
          : html`<button
              type="button"
              data-ww-design-save
              class="${BTN} h-10 max-w-40 whitespace-normal leading-tight ${armed
                ? "border-amber-400/70 bg-amber-500/20"
                : ""}"
              ?disabled=${d === null ||
              draft ||
              block !== null ||
              badName ||
              m.roleMismatch()}
              @click=${() => this.onSave(m)}
            >
              ${translateText(
                saveLabel(
                  d !== null &&
                    ((d.kind === "tank" &&
                      m.cellDesign(d.base, m.tankRoleSel) !== null) ||
                      (d.kind === "ship" &&
                        m.shipCellDesign(d.base) !== null) ||
                      (d.kind === "plane" &&
                        m.planeCellDesign(d.base, m.planeTypeSel) !== null)),
                  armed,
                  d !== null && d.kind === "plane",
                  d !== null && d.kind === "ship",
                ),
              )}
            </button>`}
      </div>
    </div>`;
  }

  private saveToLibrary(m: DesignerModel): void {
    const d = m.draft;
    if (d === null || !m.nameOk()) return;
    const lb = m.draftMode ? m.libraryBlock() : m.block();
    if (lb !== null && lb !== "design_slots_full") return;
    const r = this.store.add({
      type: "design",
      def: { ...d, modules: [...d.modules] },
    });
    this.showNotice(
      translateText(
        r === "full"
          ? "ww1936.library.full"
          : r === "renamed"
            ? "ww1936.library.renamed"
            : "ww1936.library.saved",
        { name: m.displayName(d) },
      ),
    );
  }

  private renderLibraryTab(): TemplateResult {
    const ui = this.libUi;
    const set = (p: Partial<LibraryUi>) =>
      (this.libUi = { ...this.libUi, ...p });
    return html`<div data-ww-scroll class="min-h-0 flex-1 overflow-y-auto p-2">
      ${renderLibrary({
        designer: this.designerOn(),
        store: this.store,
        game: this.game as never,
        ui,
        edit: this.lobby ? (e) => this.editEntry(e) : undefined,
        load: (e, s) => {
          if (s.order === null) return;
          this.eventBus.emit(new SendWwOrderIntentEvent(s.order));
          set({
            message: translateText("ww1936.library.sent", {
              name: entryName(e),
            }),
          });
        },
        del: (e) => {
          const key = `del:${e.id}`;
          if (!this.libTap.tap(key, performance.now())) {
            set({ armed: key });
            setTimeout(() => {
              if (this.libUi.armed === key) set({ armed: "" });
            }, 3000);
            return;
          }
          set({ armed: "" });
          this.store.remove(e.id);
        },
        toggleAuto: (e) => {
          const off = this.store.setAuto(e.id, !e.auto);
          if (off.length > 0) {
            this.showNotice(
              translateText("ww1936.library.auto_cell_off", {
                name: entryName(off[0]),
              }),
            );
          }
        },
        share: (ids) => set({ code: this.store.exportCode(ids) }),
        copy: () => {
          const code = this.libUi.code;
          const done = navigator.clipboard?.writeText(code);
          if (done === undefined) {
            set({ message: translateText("ww1936.library.copy_failed") });
            return;
          }
          done.then(
            () => set({ message: translateText("ww1936.library.copied") }),
            () => set({ message: translateText("ww1936.library.copy_failed") }),
          );
        },
        setImportText: (t) => set({ importText: t }),
        doImport: () => {
          const r = this.store.importCode(this.libUi.importText);
          if (!r.ok) {
            set({
              message: translateText(`ww1936.library.import_${r.reason}`),
            });
            return;
          }
          set({
            importText: "",
            message: translateText("ww1936.library.imported", {
              added: r.added,
              known: r.known,
            }),
          });
        },
      })}
    </div>`;
  }

  /** Lobby: a library card opens as a draft (a design here, a division on the screen). */
  private editEntry(e: LibEntry): void {
    if (e.type === "design") {
      if (!this.designerOn()) return;
      this.tab = "design";
      this.ensureModel().open(e.def.kind, { ...e.def } as never);
    } else if (e.type === "template") {
      this.setOpen(false);
      this.dispatchEvent(
        new CustomEvent("ww-lobby-edit-template", {
          detail: e,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private onSave(m: DesignerModel) {
    const d = m.draft;
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
    // A cell with no static partner is built by no line yet: offer one.
    const noPartner =
      d !== null &&
      ((d.kind === "tank" && staticKeyOfCell(d) < 0) ||
        (d.kind === "plane" && staticKeyOfPlaneCell(d) < 0));
    this.savedHint = noPartner ? m.displayName(d) : null;
    if (this.savedHintTimer !== null) clearTimeout(this.savedHintTimer);
    this.savedHintTimer = setTimeout(() => {
      this.savedHint = null;
      this.savedHintTimer = null;
    }, 20000);
  }
}
