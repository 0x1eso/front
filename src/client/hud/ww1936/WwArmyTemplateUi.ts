// World War 1936: the army-template parts of the army panel's training tab:
// the list ([train], edit, delete), the editor (name, division templates and
// counts, at most 24 in all) and the queue row of a train_army order. Plain
// render functions; the panel owns the state and sends the orders.
import {
  CountryLandDetail,
  TemplateData,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import {
  ArmyContent,
  ArmyEntry,
  ArmyItem,
  armyTotal,
  GroupRow,
} from "./ArmyTemplates";
import type { LibraryStore } from "./DesignLibrary";
import { battalionSummary, templateDef, templateName } from "./LandModel";

export interface ArmyEdit {
  /** The library id being edited; null for a new one. */
  id: string | null;
  name: string;
  items: ArmyItem[];
}

/** The editor's state for an entry, or for a new one (null). */
export function armyEditOf(e: ArmyEntry | null): ArmyEdit {
  return e === null
    ? { id: null, name: "", items: [] }
    : {
        id: e.id,
        name: e.name,
        items: e.items.map((i) => ({
          ...i,
          battalions: [...i.battalions],
          support: [...i.support],
        })),
      };
}

/** [save] in the editor: the entry is replaced (by id) or added; "full" when the library has no room. */
export function saveArmyEdit(store: LibraryStore, ed: ArmyEdit): string {
  if (ed.id !== null) store.remove(ed.id);
  return store.add({
    type: "army",
    name: ed.name.trim().slice(0, 40),
    items: ed.items,
  });
}

export interface ArmyTemplateEnv {
  /** Only the division templates the editor offers. */
  land: Pick<CountryLandDetail, "templates">;
  entries: readonly ArmyEntry[];
  editing: ArmyEdit | null;
  /** The region the new army forms in, as text; "" for none (the lobby). */
  regionText: string;
  /** Block text under the list, "" for none. */
  refused: string;
  /** A line about the last save, "" for none. */
  notice: string;
  /** Absent in the lobby: no [train] button. */
  train?: (e: ArmyEntry) => void;
  edit: (e: ArmyEntry | null) => void;
  change: (next: ArmyEdit | null) => void;
  save: () => void;
  del: (e: ArmyEntry) => void;
  armed: (e: ArmyEntry) => boolean;
}

const BTN =
  "h-10 min-w-10 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10";

export function itemText(i: ArmyItem): string {
  return `${i.name} ×${i.count}`;
}

export function renderArmyTemplates(env: ArmyTemplateEnv): TemplateResult {
  return html`<section data-ww-army-tpls class="mt-2">
    <div class="mb-1 text-xs font-bold uppercase tracking-wide text-white/70">
      ${translateText("ww1936.army_tpl.title")}
    </div>
    ${env.regionText === ""
      ? nothing
      : html`<div data-ww-army-tpl-region class="text-xs text-white/70">
          ${env.regionText}
        </div>`}
    ${env.entries.length === 0
      ? html`<p data-ww-army-tpl-empty class="m-0 mt-1 text-xs text-white/60">
          ${translateText("ww1936.army_tpl.empty")}
        </p>`
      : html`<ul class="m-0 mt-1 flex list-none flex-col gap-1 p-0">
          ${env.entries.map((e) => renderRow(env, e))}
        </ul>`}
    ${env.refused === ""
      ? nothing
      : html`<p data-ww-army-tpl-block class="m-0 mt-1 text-xs text-red-300">
          🔒 ${env.refused}
        </p>`}
    ${env.notice === ""
      ? nothing
      : html`<p data-ww-army-tpl-notice class="m-0 mt-1 text-xs text-sky-200">
          ${env.notice}
        </p>`}
    ${env.editing === null
      ? html`<button
          type="button"
          data-ww-army-tpl-new
          class="${BTN} mt-1 w-full"
          @click=${() => env.edit(null)}
        >
          ${translateText("ww1936.army_tpl.new")}
        </button>`
      : renderEditor(env, env.editing)}
  </section>`;
}

function renderRow(env: ArmyTemplateEnv, e: ArmyEntry): TemplateResult {
  const armed = env.armed(e);
  const train = env.train;
  return html`<li
    data-ww-army-tpl=${e.id}
    class="rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
  >
    <div class="flex items-center gap-1.5">
      <span class="min-w-0 flex-1 truncate text-sm font-bold">${e.name}</span>
      <span class="shrink-0 tabular-nums text-white/70"
        >${translateText("ww1936.land.divisions_of", {
          n: armyTotal(e.items),
          max: WW_MAX_ARMY_DIVISIONS,
        })}</span
      >
    </div>
    <div class="truncate text-white/70">
      ${e.items.map(itemText).join(" · ")}
    </div>
    <div class="mt-1 flex gap-1">
      ${train === undefined
        ? nothing
        : html`<button
            type="button"
            data-ww-army-tpl-train=${e.id}
            class="${BTN} flex-1 border-emerald-400/50 bg-emerald-800/40 hover:bg-emerald-700/50"
            @click=${() => train(e)}
          >
            ${translateText("ww1936.army_tpl.train")}
          </button>`}
      <button
        type="button"
        data-ww-army-tpl-edit=${e.id}
        class="${BTN} flex-1"
        @click=${() => env.edit(e)}
      >
        ${translateText("ww1936.army_tpl.edit")}
      </button>
      <button
        type="button"
        data-ww-army-tpl-delete=${e.id}
        data-armed=${String(armed)}
        class="${BTN} ${armed
          ? "border-red-400 bg-red-900/70"
          : "border-red-400/40"}"
        @click=${() => env.del(e)}
      >
        ${translateText(
          armed ? "ww1936.land.tap_again" : "ww1936.library.delete",
        )}
      </button>
    </div>
  </li>`;
}

function renderEditor(env: ArmyTemplateEnv, ed: ArmyEdit): TemplateResult {
  const total = armyTotal(ed.items);
  const setCount = (at: number, d: number) => {
    const items = ed.items.map((i, k) =>
      k === at ? { ...i, count: i.count + d } : i,
    );
    env.change({
      ...ed,
      items: items.filter((i) => i.count > 0),
    });
  };
  const add = (t: TemplateData) => {
    const def = templateDef(t);
    const at = ed.items.findIndex(
      (i) =>
        i.battalions.join(",") === def.battalions.join(",") &&
        i.support.join(",") === def.support.join(","),
    );
    if (total >= WW_MAX_ARMY_DIVISIONS) return;
    if (at >= 0) return setCount(at, 1);
    const item: ArmyContent["items"][number] = {
      name: templateName(t).slice(0, 40),
      battalions: [...def.battalions],
      support: [...def.support],
      count: 1,
    };
    env.change({ ...ed, items: [...ed.items, item] });
  };
  const canSave = ed.items.length > 0 && ed.name.trim() !== "";
  return html`<div
    data-ww-army-tpl-editor
    class="mt-1 flex flex-col gap-1 rounded-md border border-white/15 bg-black/20 p-1.5 text-xs"
  >
    <input
      type="text"
      data-ww-army-tpl-name
      maxlength="40"
      class="h-10 w-full rounded-md border border-white/15 bg-black/30 px-2 text-sm"
      placeholder=${translateText("ww1936.army_tpl.name_hint")}
      .value=${ed.name}
      @input=${(ev: Event) =>
        env.change({ ...ed, name: (ev.target as HTMLInputElement).value })}
    />
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      ${ed.items.map(
        (i, at) =>
          html`<li data-ww-army-tpl-item=${at} class="flex items-center gap-1">
            <span class="min-w-0 flex-1 truncate font-semibold">${i.name}</span>
            <button
              type="button"
              data-ww-army-tpl-minus=${at}
              class=${BTN}
              aria-label="-1"
              @click=${() => setCount(at, -1)}
            >
              −
            </button>
            <span class="w-6 shrink-0 text-center tabular-nums"
              >${i.count}</span
            >
            <button
              type="button"
              data-ww-army-tpl-plus=${at}
              class="${BTN} ${total >= WW_MAX_ARMY_DIVISIONS
                ? "opacity-40"
                : ""}"
              aria-disabled=${String(total >= WW_MAX_ARMY_DIVISIONS)}
              aria-label="+1"
              @click=${() => {
                if (total < WW_MAX_ARMY_DIVISIONS) setCount(at, 1);
              }}
            >
              +
            </button>
          </li>`,
      )}
    </ul>
    <select
      data-ww-army-tpl-add
      class="h-10 w-full rounded-md border border-white/15 bg-black/30 px-2"
      @change=${(ev: Event) => {
        const sel = ev.target as HTMLSelectElement;
        const t = env.land.templates.find((x) => x.id === Number(sel.value));
        sel.value = "";
        if (t !== undefined) add(t);
      }}
    >
      <option value="">${translateText("ww1936.army_tpl.add")}</option>
      ${env.land.templates.map(
        (t) =>
          html`<option value=${t.id}>
            ${templateName(t)} — ${battalionSummary(templateDef(t))}
          </option>`,
      )}
    </select>
    <div data-ww-army-tpl-total class="text-white/70">
      ${translateText("ww1936.army_tpl.total", {
        n: total,
        max: WW_MAX_ARMY_DIVISIONS,
      })}
    </div>
    <div class="flex gap-1">
      <button
        type="button"
        data-ww-army-tpl-save
        aria-disabled=${String(!canSave)}
        class="${BTN} flex-1 ${canSave
          ? "border-emerald-400/60 bg-emerald-800/50"
          : "opacity-40"}"
        @click=${() => {
          if (canSave) env.save();
        }}
      >
        ${translateText("ww1936.army_tpl.save")}
      </button>
      <button
        type="button"
        data-ww-army-tpl-close
        class="${BTN} flex-1"
        @click=${() => env.change(null)}
      >
        ${translateText("common.cancel")}
      </button>
    </div>
  </div>`;
}

export interface GroupRowEnv {
  armed: (g: GroupRow) => boolean;
  deploy: (g: GroupRow) => void;
  cancel: (g: GroupRow) => void;
}

/** The queue row of one train_army order. */
export function renderGroupRow(env: GroupRowEnv, g: GroupRow): TemplateResult {
  const armed = env.armed(g);
  const waiting =
    g.waiting === "manpower"
      ? translateText("ww1936.land.waiting_manpower")
      : g.waiting === "equipment"
        ? translateText("ww1936.army_tpl.waiting_equipment")
        : "";
  return html`<li
    data-ww-group=${g.group}
    class="rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
  >
    <div class="flex items-center gap-1.5">
      <span class="min-w-0 flex-1 truncate font-semibold"
        >${translateText("ww1936.army_tpl.row", { list: g.list })}</span
      >
      <span class="shrink-0 tabular-nums text-white/70"
        >${translateText("ww1936.army_tpl.progress", {
          done: g.trained,
          total: g.total,
        })}</span
      >
    </div>
    <div class="my-1 h-1.5 rounded bg-white/10">
      <div
        class="h-1.5 rounded bg-amber-400"
        style="width: ${g.total === 0 ? 0 : (g.trained / g.total) * 100}%"
      ></div>
    </div>
    <div class="text-white/70">
      ${translateText("ww1936.army_tpl.days_left", { n: g.daysLeft })}
    </div>
    ${waiting === ""
      ? nothing
      : html`<div data-ww-waiting=${g.waiting} class="text-amber-300">
          ${waiting}
        </div>`}
    <div class="mt-1 flex gap-1">
      <button
        type="button"
        data-ww-group-deploy=${g.group}
        aria-disabled=${String(g.started === 0)}
        class="h-10 flex-1 rounded-md border px-2 font-semibold ${g.started ===
        0
          ? "border-white/5 bg-white/5 text-white/40"
          : "border-sky-400/50 bg-sky-900/40 hover:bg-sky-800/50"}"
        @click=${() => {
          if (g.started > 0) env.deploy(g);
        }}
      >
        ${translateText("ww1936.land.deploy_now")}
      </button>
      <button
        type="button"
        data-ww-group-cancel=${g.group}
        data-armed=${String(armed)}
        class="h-10 flex-1 rounded-md border px-2 font-semibold ${armed
          ? "border-red-400 bg-red-900/70"
          : "border-red-400/40 bg-red-900/30"}"
        @click=${() => env.cancel(g)}
      >
        ${translateText(armed ? "ww1936.econ.cancel_tap" : "common.cancel")}
      </button>
    </div>
  </li>`;
}
