// World War 1936 P6 lane U2 (spec §20.5): the designer drawer's "designs"
// tab: my saved designs as cards. [Edit into a new one] opens the designer
// on a copy, [Retire] needs two taps; a pending licence request is shown
// as a card that opens the market tab.
import { WwDesignSlotData } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { autoNameOf, DesignerModel, numText } from "./DesignerModel";

export interface DesignListEnv {
  model: DesignerModel;
  /** The key that is armed for a second tap (`obsolete:<kind>:<slot>`), or "". */
  armed: string;
  copy: (row: WwDesignSlotData) => void;
  retire: (row: WwDesignSlotData) => void;
  openLicences: () => void;
  /** The licence requests waiting for my answer. */
  licenceFrom: string | null;
  makeLine: (row: WwDesignSlotData) => void;
}

const ORIGIN_KEYS = {
  own: "",
  captured: "ww1936.design.source_captured",
  received: "ww1936.design.source_gift",
  licensed: "ww1936.design.source_licence",
} as const;

/** "Lines 2 · Stock 340 · Divisions 61" for one saved design. */
export function designUse(
  model: DesignerModel,
  row: WwDesignSlotData,
): { lines: number; stock: number; users: number } {
  const detail = model.view
    .wwEconomy?.()
    ?.detail(model.view.myPlayer()?.smallID() ?? 0);
  if (row.kind === "ship" || detail === null || detail === undefined) {
    return { lines: 0, stock: 0, users: row.inUse };
  }
  const type = row.kind === "tank" ? "tank_design" : "plane_design";
  const key = equipKey(type, row.slot);
  const lines = detail.lines.filter(
    (l) => l.equipment === type && l.gen === row.slot,
  ).length;
  return { lines, stock: detail.stock[key] ?? 0, users: row.inUse };
}

function renderCard(env: DesignListEnv, row: WwDesignSlotData): TemplateResult {
  const { model } = env;
  const def = row.def;
  const stats = model.statsOf(def);
  const use = designUse(model, row);
  const name = def.name.startsWith("@") ? autoNameOf(def) : def.name;
  const key = `obsolete:${row.kind}:${row.slot}`;
  const origin = ORIGIN_KEYS[row.origin as keyof typeof ORIGIN_KEYS] ?? "";
  return html`<li
    data-ww-design-card=${`${row.kind}:${row.slot}`}
    class="flex flex-col gap-1 rounded-md border border-white/10 bg-white/5 p-2 text-xs ${row.obsolete
      ? "opacity-50"
      : ""}"
  >
    <div class="flex items-center gap-1">
      <span class="min-w-0 flex-1 truncate font-bold">${name}</span>
      ${origin === ""
        ? nothing
        : html`<span
            data-ww-origin=${row.origin}
            class="shrink-0 rounded bg-white/10 px-1 text-[11px]"
            >⚑ ${translateText(origin)}</span
          >`}
    </div>
    <div class="text-white/70">
      ${model.baseLabel(def)} · ${model.roleLabel(def)}
    </div>
    <div class="flex flex-wrap gap-1">
      ${stats.map(
        (s) =>
          html`<span class="rounded bg-white/10 px-1 text-[11px]"
            >${translateText(`ww1936.design.stat.${s.id}`)}
            ${numText(s.raw, s.div)}</span
          >`,
      )}
    </div>
    <div data-ww-design-use class="text-white/60">
      ${translateText("ww1936.design.list_line", {
        line: use.lines,
        stock: use.stock,
        divisions: use.users,
      })}
    </div>
    <div class="flex flex-wrap gap-1">
      <button
        type="button"
        data-ww-design-copy
        class="h-9 min-w-24 flex-1 rounded-md border border-white/15 bg-white/5 px-2 font-semibold hover:bg-white/10"
        @click=${() => env.copy(row)}
      >
        ${translateText("ww1936.design.edit_new")}
      </button>
      ${row.kind === "ship" || row.obsolete
        ? nothing
        : html`<button
            type="button"
            data-ww-design-line
            class="h-9 min-w-24 flex-1 rounded-md border border-white/15 bg-white/5 px-2 font-semibold hover:bg-white/10"
            @click=${() => env.makeLine(row)}
          >
            ${translateText("ww1936.design.make_line")}
          </button>`}
      ${row.obsolete
        ? nothing
        : html`<button
            type="button"
            data-ww-design-retire
            class="h-9 min-w-24 flex-1 rounded-md border border-white/15 bg-white/5 px-2 font-semibold hover:bg-white/10"
            @click=${() => env.retire(row)}
          >
            ${translateText(
              env.armed === key
                ? "ww1936.design.retire_confirm"
                : "ww1936.design.retire",
            )}
          </button>`}
    </div>
  </li>`;
}

export function renderDesignList(env: DesignListEnv): TemplateResult {
  const rows = env.model.view
    .wwDepth?.()
    ?.detail(env.model.view.myPlayer()?.smallID() ?? 0)?.designs;
  return html`<div data-ww-design-list class="flex flex-col gap-2">
    ${env.licenceFrom !== null
      ? html`<button
          type="button"
          data-ww-licence-request
          class="rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-2 text-left text-xs font-semibold"
          @click=${env.openLicences}
        >
          ${translateText("ww1936.design.licence_waiting", {
            country: env.licenceFrom ?? "",
          })}
        </button>`
      : nothing}
    ${rows === undefined || rows.length === 0
      ? html`<p class="m-0 text-xs text-white/60">
          ${translateText("ww1936.design.list_empty")}
        </p>`
      : html`<ul
          class="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2"
        >
          ${rows.map((r) => renderCard(env, r))}
        </ul>`}
  </div>`;
}
