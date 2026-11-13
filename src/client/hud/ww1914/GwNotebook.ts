import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { diarySection } from "./GwDiary";
import { rich } from "./GwDict";
import { dealsBox } from "./GwLobbyDeals";
import { keyDecisions, promisesInOrder } from "./GwModel";
import { CHIP, HEAD, MUTED } from "./GwStyle";
import {
  askName,
  country,
  decisionLine,
  fileLine,
  fileState,
  fullDate,
  personName,
  promiseText,
} from "./GwText";

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

/**
 * 서류철 (ww158): the files the police brought, as they stamped them, and
 * allies' asks. Absent until there is one: no file, no section.
 */
function dossier(c: GwCtx): TemplateResult | typeof nothing {
  const d = c.seat.world.dossier;
  if (d === undefined) return nothing;
  return html`<section class=${BOX} data-gw-notebook-dossier>
    <h3 class=${HEAD}>${translateText("gw.dossier.title")}</h3>
    ${d.files.length === 0
      ? html`<p class=${MUTED}>${translateText("gw.dossier.none")}</p>`
      : [...d.files].reverse().map(
          (f) =>
            html`<div class="space-y-0.5" data-gw-file=${f.uid}>
              <div class="flex items-center gap-1.5">
                <span class="truncate text-sm font-bold text-white/90"
                  >${personName(c.pack, f.who)}</span
                >
                <span class="${CHIP} ml-auto shrink-0"
                  >${translateText(`gw.stamp.${f.stamp}`)}</span
                >
                <span class="${CHIP} shrink-0">${fileState(f)}</span>
              </div>
              <p class="text-sm ${f.out ? MUTED : "text-white/85"}">
                ${rich(c, fileLine(c.pack, f))}
              </p>
            </div>`,
        )}
    ${d.asks.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.dossier.asks")}</div>
          ${d.asks.map(
            (a) =>
              html`<div class="flex items-center gap-1.5" data-gw-ask=${a.id}>
                <span class="text-sm text-white/85"
                  >${country(a.from)}: ${askName(c.pack, a)}</span
                >
                <span class="${CHIP} ml-auto shrink-0"
                  >${translateText(`gw.dossier.stage.${a.stage}`)}</span
                >
              </div>`,
          )}`}
  </section>`;
}

/**
 * The notebook: his diary (ww196), what was promised to whom and by when,
 * what was decided.
 */
export function notebookTab(c: GwCtx): TemplateResult {
  return html`<div class="space-y-3" data-gw-notebook>
    ${diarySection(c)} ${promises(c)} ${dealsBox(c)} ${dossier(c)}
    ${decisions(c)}
  </div>`;
}
