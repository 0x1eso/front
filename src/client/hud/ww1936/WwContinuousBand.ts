import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { CfocusBand } from "./DepthMiscModel";

/** P6 (spec §12): the continuous-focus band over the tree: 8 chips, the pick lit, the lock days. */
export function renderContinuousBand(
  band: CfocusBand,
  onPick: (id: CfocusBand["chips"][number]["id"], selected: boolean) => void,
): TemplateResult {
  return html`<div
    data-ww-cfocus
    data-open=${String(band.open)}
    class="flex shrink-0 flex-col gap-0.5 border-b border-white/10 px-2 py-1"
  >
    <div class="flex gap-1 overflow-x-auto ${band.open ? "" : "opacity-40"}">
      ${band.chips.map(
        (c) =>
          html`<button
            type="button"
            data-ww-cfocus-chip=${c.id}
            aria-pressed=${String(c.selected)}
            ?disabled=${c.disabled}
            class="h-8 shrink-0 rounded-full px-2 text-[11px] font-semibold disabled:cursor-default ${c.selected
              ? "bg-amber-500/80 text-black"
              : "bg-white/5 text-white/75"}"
            @click=${() => onPick(c.id, c.selected)}
          >
            ${translateText(`ww1936.cf.${c.id}`)}
          </button>`,
      )}
    </div>
    ${!band.open
      ? html`<span data-ww-cfocus-closed class="text-[11px] text-white/60"
          >${translateText("ww1936.cfocus_ui.not_open", {
            date: band.unlockDate,
          })}</span
        >`
      : band.lockLeft > 0
        ? html`<span data-ww-cfocus-lock class="text-[11px] text-amber-200"
            >${translateText("ww1936.cfocus_ui.locked_days", {
              days: band.lockLeft,
            })}</span
          >`
        : nothing}
  </div>`;
}
