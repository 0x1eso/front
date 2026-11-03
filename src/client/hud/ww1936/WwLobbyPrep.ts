// World War 1936 lobby: the preparation screen. Two parts for the picked
// country: its start templates (edit with the template designer, or take a
// library division) and the design library (tank, plane, ship and division
// entries, in draft mode). It hosts the game's own designers on a small
// adapter (LobbyPrep.lobbyGame) instead of a live game. Loaded with import()
// from the country picker, so the homepage never carries hud/.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BattalionId,
  SupportId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import { isMajor } from "@openfront/engine-lib/ww1936/EconomyStart";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  clearPrepTemplate,
  prepPlanOf,
  PrepTemplate,
  setPrepTemplate,
} from "../../components/ww1936/PrepPlan";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";
import { LibEntry, libraryStore } from "./DesignLibrary";
import { battalionSummary } from "./LandModel";
import {
  LIB_DRAFT_ID,
  lobbyGame,
  lobbyResearched,
  lobbyStartTemplates,
  planProblem,
  startPreview,
} from "./LobbyPrep";
import "./WwDesigner";
import type { WwDesigner } from "./WwDesigner";
import "./WwTemplateDesigner";

type Tab = "templates" | "designs";
type Editing =
  | { mode: "start"; index: number }
  | { mode: "library"; draft: TemplateDef | null };

const BTN =
  "min-h-10 shrink-0 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold hover:bg-white/10";

const sameDef = (a: TemplateDef, b: TemplateDef) =>
  a.battalions.join() === b.battalions.join() &&
  a.support.join() === b.support.join();

@customElement("ww-lobby-prep")
export class WwLobbyPrep extends LitElement {
  @property({ attribute: false }) tag: CountryTag = "DEU";
  @state() private tab: Tab = "templates";
  @state() private editing: Editing | null = null;
  @state() private plan: PrepTemplate[] = [];
  @state() private pickKey: string | null = null;
  @state() private note = "";
  private readonly bus = new EventBus();
  private designer: WwDesigner | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.plan = prepPlanOf(this.tag);
    this.bus.on(SendWwOrderIntentEvent, (e) => this.onOrder(e.order));
    const d = document.createElement("ww-designer") as WwDesigner;
    d.lobby = true;
    // The designer's library statuses read the country's own start research.
    d.game = lobbyGame(this.tag, { mode: "start" }) as never;
    d.eventBus = this.bus;
    d.init();
    this.designer = d;
    this.addEventListener("ww-lobby-edit-template", this.onEditTemplate);
    document.documentElement.style.overflow = "hidden";
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("ww-lobby-edit-template", this.onEditTemplate);
    document.documentElement.style.overflow = "";
  }

  private readonly onEditTemplate = (ev: Event) => {
    const e = (ev as CustomEvent<LibEntry>).detail;
    if (e.type !== "template") return;
    this.editing = {
      mode: "library",
      draft: {
        name: e.name,
        battalions: e.battalions as BattalionId[],
        support: e.support as SupportId[],
      },
    };
  };

  private close() {
    this.dispatchEvent(new CustomEvent("ww-lobby-prep-close"));
    this.remove();
  }

  /** What the designers' [save] sends: a start template's edit, or a library division. */
  private onOrder(o: { kind: string } & Record<string, unknown>) {
    if (o.kind !== "template_save") return;
    const def: TemplateDef = {
      name: String(o.name ?? ""),
      battalions: (o.battalions ?? []) as BattalionId[],
      support: (o.support ?? []) as SupportId[],
    };
    const ed = this.editing;
    if (ed === null) return;
    if (ed.mode === "library") {
      const r = libraryStore().add({
        type: "template",
        name: def.name || translateText("ww1936.library.unnamed_division"),
        battalions: [...def.battalions],
        support: [...def.support],
      });
      this.note = translateText(
        r === "full"
          ? "ww1936.library.full"
          : r === "renamed"
            ? "ww1936.library.renamed"
            : "ww1936.library.saved",
        { name: def.name },
      );
      return;
    }
    const st = lobbyStartTemplates(this.tag)[ed.index];
    if (st === undefined) return;
    this.setPlan(st.key, def);
  }

  private setPlan(key: string, def: TemplateDef) {
    const st = lobbyStartTemplates(this.tag).find((x) => x.key === key);
    if (st === undefined) return;
    if (
      sameDef(st.def, def) &&
      (def.name === "" || def.name === translateText(`ww1936.tpl.${key}`))
    ) {
      clearPrepTemplate(this.tag, key);
    } else {
      setPrepTemplate(this.tag, {
        key,
        name: def.name,
        battalions: [...def.battalions],
        support: [...def.support],
      });
    }
    this.plan = prepPlanOf(this.tag);
  }

  private nameOf(key: string, p: PrepTemplate | undefined): string {
    return p === undefined ? translateText(`ww1936.tpl.${key}`) : p.name;
  }

  private renderStart(): TemplateResult {
    const researched = lobbyResearched(this.tag);
    const list = lobbyStartTemplates(this.tag);
    const library = libraryStore().entries.filter((e) => e.type === "template");
    const minor = !isMajor(this.tag);
    return html`<div data-ww-prep-start class="flex flex-col gap-2">
      <p class="m-0 text-xs text-white/70">
        ${translateText("ww1936.prep.start_intro")}
      </p>
      ${minor
        ? html`<p class="m-0 text-xs text-amber-200">
            ${translateText("ww1936.prep.minor_note")}
          </p>`
        : nothing}
      ${list.map((st, index) => {
        const p = this.plan.find((x) => x.key === st.key);
        const def: TemplateDef =
          p === undefined
            ? st.def
            : {
                name: p.name,
                battalions: p.battalions as BattalionId[],
                support: p.support as SupportId[],
              };
        const problem =
          p === undefined ? null : planProblem(def, researched, new Set());
        const prev =
          p === undefined ? null : startPreview(this.tag, st.key, st.def, def);
        const fits = library.filter(
          (e) =>
            e.type === "template" &&
            planProblem(
              {
                name: e.name,
                battalions: e.battalions as BattalionId[],
                support: e.support as SupportId[],
              },
              researched,
              new Set(),
            ) === null,
        );
        return html`<section
          data-ww-prep-tpl=${st.key}
          data-edited=${String(p !== undefined)}
          class="flex flex-col gap-1 rounded-md border p-2 text-xs ${p ===
          undefined
            ? "border-white/10 bg-white/5"
            : "border-amber-400/50 bg-amber-500/10"}"
        >
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-sm font-bold"
              >${this.nameOf(st.key, p)}</span
            >
            ${p === undefined
              ? nothing
              : html`<span class="rounded bg-amber-500/30 px-1 text-amber-200"
                  >${translateText("ww1936.prep.edited")}</span
                >`}
          </div>
          <div class="text-white/70">${battalionSummary(def)}</div>
          ${problem === null
            ? nothing
            : html`<div data-ww-prep-problem class="text-red-300">
                🔒
                ${translateText("ww1936.prep.skipped", {
                  name: def.name,
                  reason: problem,
                })}
              </div>`}
          ${prev === null
            ? p === undefined
              ? nothing
              : html`<div data-ww-prep-preview class="text-white/60">
                  ${translateText("ww1936.prep.preview_unknown")}
                </div>`
            : html`<div data-ww-prep-preview class="text-emerald-300">
                ${translateText("ww1936.prep.preview", {
                  n: prev.count,
                  was: prev.original,
                })}
                <span class="text-white/60"
                  >${translateText("ww1936.prep.approximate")}</span
                >
              </div>`}
          <div class="flex flex-wrap gap-1">
            <button
              type="button"
              data-ww-prep-edit
              class="${BTN} flex-1"
              @click=${() => (this.editing = { mode: "start", index })}
            >
              ${translateText("ww1936.prep.edit")}
            </button>
            <button
              type="button"
              data-ww-prep-from-library
              aria-expanded=${String(this.pickKey === st.key)}
              class="${BTN} flex-1"
              @click=${() =>
                (this.pickKey = this.pickKey === st.key ? null : st.key)}
            >
              ${translateText("ww1936.prep.from_library")}
            </button>
            ${p === undefined
              ? nothing
              : html`<button
                  type="button"
                  data-ww-prep-reset
                  class="${BTN} border-red-400/40"
                  @click=${() => {
                    clearPrepTemplate(this.tag, st.key);
                    this.plan = prepPlanOf(this.tag);
                  }}
                >
                  ${translateText("ww1936.prep.reset")}
                </button>`}
          </div>
          ${this.pickKey !== st.key
            ? nothing
            : html`<ul
                data-ww-prep-pick
                class="m-0 flex list-none flex-col gap-1 p-0"
              >
                ${fits.length === 0
                  ? html`<li class="text-white/60">
                      ${translateText("ww1936.prep.library_none")}
                    </li>`
                  : fits.map((e) =>
                      e.type !== "template"
                        ? nothing
                        : html`<li>
                            <button
                              type="button"
                              data-ww-prep-take=${e.id}
                              class="${BTN} flex w-full flex-col items-start text-left"
                              @click=${() => {
                                this.setPlan(st.key, {
                                  name: e.name,
                                  battalions: e.battalions as BattalionId[],
                                  support: e.support as SupportId[],
                                });
                                this.pickKey = null;
                              }}
                            >
                              <span class="font-bold">${e.name}</span>
                              <span class="text-white/60"
                                >${battalionSummary({
                                  name: e.name,
                                  battalions: e.battalions as BattalionId[],
                                  support: e.support as SupportId[],
                                })}</span
                              >
                            </button>
                          </li>`,
                    )}
              </ul>`}
        </section>`;
      })}
    </div>`;
  }

  private openDesigner(kind: DesignKind | "library") {
    if (kind === "library") {
      this.bus.emit(new WwDepthOpenEvent("designs", { tab: "library" }));
    } else {
      this.bus.emit(new WwDepthOpenEvent("designer", { kind }));
    }
  }

  private renderDesigns(): TemplateResult {
    const kinds: DesignKind[] = ["tank", "plane", "ship"];
    return html`<div data-ww-prep-designs class="flex flex-col gap-2">
      <p
        data-ww-prep-draft-note
        class="m-0 rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-100"
      >
        ${translateText("ww1936.prep.draft_note")}
      </p>
      <p class="m-0 text-xs text-white/70">
        ${translateText("ww1936.prep.designs_intro")}
      </p>
      <div class="grid grid-cols-2 gap-1 sm:grid-cols-5">
        ${kinds.map(
          (k) =>
            html`<button
              type="button"
              data-ww-prep-design=${k}
              class="${BTN}"
              @click=${() => this.openDesigner(k)}
            >
              ${translateText(`ww1936.design.tab_${k}`)}
            </button>`,
        )}
        <button
          type="button"
          data-ww-prep-division
          class="${BTN}"
          @click=${() => (this.editing = { mode: "library", draft: null })}
        >
          ${translateText("ww1936.prep.new_division")}
        </button>
        <button
          type="button"
          data-ww-prep-library
          class="${BTN} border-sky-400/60 bg-sky-500/20"
          @click=${() => this.openDesigner("library")}
        >
          ${translateText("ww1936.library.tab")}
        </button>
      </div>
    </div>`;
  }

  private renderEditor(): TemplateResult {
    const ed = this.editing!;
    const game =
      ed.mode === "start"
        ? lobbyGame(this.tag, { mode: "start", plan: this.plan })
        : lobbyGame(this.tag, { mode: "library", draft: ed.draft });
    const id =
      ed.mode === "start" ? ed.index + 1 : ed.draft === null ? 0 : LIB_DRAFT_ID;
    return html`<div class="p-2">
      ${ed.mode === "library"
        ? html`<p class="m-0 text-xs text-amber-100">
            ${translateText("ww1936.prep.draft_note")}
          </p>`
        : nothing}
      <ww-template-designer
        .game=${game}
        .eventBus=${this.bus}
        .templateId=${id}
        .lobby=${true}
        @ww-designer-close=${() => (this.editing = null)}
      ></ww-template-designer>
      ${this.note === ""
        ? nothing
        : html`<p class="m-0 text-xs text-emerald-300">${this.note}</p>`}
    </div>`;
  }

  render() {
    const tabs: [Tab, string][] = [
      ["templates", "ww1936.prep.tab_templates"],
      ["designs", "ww1936.prep.tab_designs"],
    ];
    return html`<div
      data-ww-lobby-prep
      role="dialog"
      aria-label=${translateText("ww1936.prep.title")}
      class="fixed inset-0 z-[10000] flex flex-col bg-gray-900 text-sm text-white"
    >
      <div
        class="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2"
      >
        <span class="min-w-0 flex-1 truncate text-base font-bold"
          >${translateText("ww1936.prep.title")} ·
          ${translateText(`ww1936.country.${this.tag}`)}</span
        >
        <button
          type="button"
          data-ww-prep-close
          class="size-10 shrink-0 rounded-md hover:bg-white/10"
          aria-label=${translateText("common.close")}
          @click=${() => this.close()}
        >
          ✕
        </button>
      </div>
      ${this.editing !== null
        ? html`<div class="min-h-0 flex-1 overflow-y-auto">
            ${this.renderEditor()}
          </div>`
        : html`<div role="tablist" class="flex shrink-0 gap-1 px-3 py-2">
              ${tabs.map(
                ([t, key]) =>
                  html`<button
                    type="button"
                    role="tab"
                    data-ww-prep-tab=${t}
                    aria-selected=${String(this.tab === t)}
                    class="${BTN} flex-1 ${this.tab === t
                      ? "border-sky-400/60 bg-sky-500/20"
                      : ""}"
                    @click=${() => (this.tab = t)}
                  >
                    ${translateText(key)}
                  </button>`,
              )}
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              ${this.tab === "templates"
                ? this.renderStart()
                : this.renderDesigns()}
              ${this.note === ""
                ? nothing
                : html`<p class="mt-2 text-xs text-emerald-300">
                    ${this.note}
                  </p>`}
            </div>`}
      ${this.designer}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ww-lobby-prep": WwLobbyPrep;
  }
}
