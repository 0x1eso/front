// World War 1936 P6 lane U2 (spec §20.5): the designer's bottom sheet, the
// module list of one slot. One tap on a row puts the module in. It covers
// the slot grid only; the stats column stays.
import { slotKinds } from "@openfront/engine-lib/ww1936/DesignRules";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import {
  DesignerModel,
  ModuleBlock,
  ModuleRow,
  StatChip,
} from "./DesignerModel";

export function moduleName(id: string): string {
  if (id !== "") return translateText(`ww1936.module.${id}`);
  return translateText("ww1936.design.slot_empty");
}

export function slotName(kind: string, slotKind: string): string {
  return translateText(`ww1936.module_slot.${kind}.${slotKind}`);
}

export function chipClass(sign: number): string {
  return sign > 0
    ? "bg-green-500/20 text-green-300"
    : sign < 0
      ? "bg-red-500/20 text-red-300"
      : "bg-white/10 text-white/70";
}

export function renderChip(c: StatChip): TemplateResult {
  return html`<span
    data-ww-design-chip=${c.id}
    class="rounded px-1 text-[11px] leading-4 ${chipClass(c.sign)}"
    >${translateText(`ww1936.design.stat.${c.id}`)} ${c.text}</span
  >`;
}

/** Why a module is shut: its tech and year, a project, or a copy of one in another slot. */
export function blockText(b: ModuleBlock): string {
  if (b.duplicate) return translateText("ww1936.design.module_dup");
  if (b.tech !== null) {
    return translateText("ww1936.design.module_locked", {
      tech: translateText(`ww1936.tech.${b.tech}`),
      year: b.year,
    });
  }
  return translateText("ww1936.design.module_project", {
    project: translateText(`ww1936.project.${b.project ?? ""}`),
  });
}

function renderRow(
  kind: "tank" | "ship" | "plane",
  r: ModuleRow,
  pick: (id: string) => void,
): TemplateResult {
  const diff =
    r.costDiff === 0
      ? ""
      : `${r.costDiff > 0 ? "+" : ""}${Math.round(r.costDiff * 10) / 10}`;
  return html`<button
    type="button"
    data-ww-module-row=${r.id}
    data-ww-blocked=${r.block === null ? nothing : "true"}
    aria-disabled=${r.block === null ? "false" : "true"}
    class="flex min-h-11 w-full shrink-0 flex-col gap-0.5 rounded-md border px-2 py-1 text-left text-xs ${r.current
      ? "border-sky-400/60 bg-sky-500/10"
      : "border-white/10 bg-white/5"} ${r.block === null
      ? "hover:bg-white/10"
      : "opacity-50"}"
    @click=${() => {
      if (r.block === null) pick(r.id);
    }}
  >
    <span class="flex items-center gap-1">
      <span class="min-w-0 flex-1 truncate font-semibold"
        >${r.block === null ? "" : "🔒 "}${moduleName(r.id)}</span
      >
      ${diff === ""
        ? nothing
        : html`<span
            class="shrink-0 ${r.costDiff > 0
              ? "text-red-300"
              : "text-green-300"}"
            >${translateText("ww1936.design.module_cost_diff", {
              value: diff,
            })}</span
          >`}
    </span>
    ${r.block === null
      ? html`<span class="flex flex-wrap gap-1"
          >${r.chips.map(renderChip)}</span
        >`
      : html`<span class="text-[11px] text-amber-300"
          >${blockText(r.block)}</span
        >`}
  </button>`;
}

export function renderDesignSheet(
  model: DesignerModel,
  slot: number,
  heightPx: number,
  pick: (id: string) => void,
  close: () => void,
): TemplateResult | typeof nothing {
  const d = model.draft;
  if (d === null) return nothing;
  const slotKind = slotKinds(d)[slot] ?? "";
  return html`<div
    data-ww-design-sheet
    class="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-lg border border-white/15 bg-gray-900/98 shadow-2xl"
    style="height: ${heightPx}px"
  >
    <div class="flex shrink-0 items-center gap-2 px-2 pt-1">
      <span class="min-w-0 flex-1 truncate text-xs font-bold"
        >${slotName(d.kind, slotKind)}</span
      >
      <button
        type="button"
        data-ww-sheet-close
        class="size-9 rounded-md hover:bg-white/10"
        aria-label=${translateText("common.close")}
        @click=${close}
      >
        ✕
      </button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
      ${model.moduleRows(slot).map((r) => renderRow(d.kind, r, pick))}
    </div>
  </div>`;
}
