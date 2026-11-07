import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { keyDecisions, promisesInOrder } from "./GwModel";
import { CHIP, HEAD, MUTED } from "./GwStyle";
import { decisionLine, fullDate, personName, promiseText } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

function promises(c: GwCtx): TemplateResult {
  const rows = promisesInOrder(c.seat.promises ?? []);
  return html`<section class=${BOX} data-gw-notebook-promises>
    <h3 class=${HEAD}>${translateText("gw.ui.notebook_promises")}</h3>
    ${rows.length === 0
      ? html`<p class=${MUTED}>
          ${translateText("gw.ui.notebook_no_promises")}
        </p>`
      : rows.map((p) => {
          const state = p.broken ? "broken" : p.kept ? "kept" : "open";
          return html`<div class="space-y-0.5" data-gw-promise=${p.key}>
            <div class="flex items-center gap-1.5">
              <span class="${MUTED} truncate"
                >${personName(c.pack, p.who)}</span
              >
              <span class="${CHIP} ml-auto shrink-0"
                >${translateText(`gw.ui.notebook_${state}`)}</span
              >
            </div>
            <p class="text-sm text-white/85">
              ${rich(c, promiseText(c.pack, p))}
            </p>
            ${state === "open"
              ? html`<p class=${MUTED}>
                  ${translateText("gw.ui.notebook_due", {
                    date: fullDate(p.due),
                  })}
                </p>`
              : nothing}
          </div>`;
        })}
  </section>`;
}

function decisions(c: GwCtx): TemplateResult {
  const rows = keyDecisions(c.seat.choices ?? []);
  return html`<section class=${BOX} data-gw-notebook-decisions>
    <h3 class=${HEAD}>${translateText("gw.ui.notebook_decisions")}</h3>
    ${rows.length === 0
      ? html`<p class=${MUTED}>
          ${translateText("gw.ui.notebook_no_decisions")}
        </p>`
      : rows.map((d) => {
          const line = decisionLine(c.pack, d);
          return html`<div data-gw-decision=${d.scene}>
            <div class="flex items-center gap-1.5">
              <span class=${MUTED}>${fullDate(d.date)}</span>
              ${d.proxy
                ? html`<span class=${CHIP}
                    >${translateText("gw.ui.notebook_proxy")}</span
                  >`
                : nothing}
            </div>
            <p class="text-sm font-bold text-white/90">${line.title}</p>
            <p class="text-sm text-white/80">${rich(c, line.pick)}</p>
          </div>`;
        })}
  </section>`;
}

/** The notebook: what was promised to whom and by when, what was decided. */
export function notebookTab(c: GwCtx): TemplateResult {
  return html`<div class="space-y-3" data-gw-notebook>
    ${promises(c)} ${decisions(c)}
  </div>`;
}
