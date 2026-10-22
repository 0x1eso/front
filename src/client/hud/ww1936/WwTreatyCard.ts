import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { TreatyRows } from "./DepthMiscModel";

const BUTTON =
  "min-h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";

/** P6 (spec §13.3): the naval treaty — members, the limit and [Leave] (two taps). */
export function renderTreaty(
  t: TreatyRows,
  canAct: boolean,
  armed: boolean,
  onLeave: () => void,
  flag: (tag: TreatyRows["members"][number]["tag"]) => TemplateResult,
): TemplateResult {
  if (t.members.length === 0) return html`${nothing}`;
  return html`<section data-ww-naval-treaty class="mt-2">
    <div class="mb-1 text-xs font-bold uppercase text-white/70">
      ${translateText("ww1936.treaty.title")}
    </div>
    <ul class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs">
      ${t.members.map(
        (m) =>
          html`<li class="flex items-center gap-1">
            ${flag(m.tag)} ${m.name}
          </li>`,
      )}
    </ul>
    <p data-ww-treaty-limit class="m-0 mt-1 text-xs text-white/70">
      ${translateText(
        t.escalated ? "ww1936.treaty.limit_raised" : "ww1936.treaty.limit",
      )}
    </p>
    <p class="m-0 text-xs text-white/50">
      ${translateText("ww1936.treaty.ends", { date: t.endDate })}
    </p>
    ${t.member && canAct && !t.ended
      ? html`<button
          type="button"
          data-ww-treaty-leave
          data-armed=${String(armed)}
          class="${BUTTON} mt-1 ${armed ? "ring-2 ring-red-400" : ""}"
          @click=${onLeave}
        >
          ${armed
            ? translateText("ww1936.pol.tap_again")
            : translateText("ww1936.treaty.leave")}
        </button>`
      : nothing}
  </section>`;
}
