import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { endingsOf, logByChapter, SHELF_TOTALS } from "./GwModel";
import { CHIP, HEAD, MUTED } from "./GwStyle";
import { endingText, endingTitle } from "./GwText";
import { textOrNull } from "./GwTicker";

/** The memoir tab: how the game stands or ended, the record, and the shelf. */
export function memoirTab(c: GwCtx): TemplateResult {
  const { data, seat, ui } = c;
  const shelf = ui.shelf;
  const record = logByChapter(seat.log).reverse();
  const ending = data.ended === null ? null : endingText(c.pack, data.ended);
  return html`<div class="space-y-3" data-gw-memoir>
    ${data.ended === null
      ? html`<p class="text-sm text-white/70">
          ${translateText("gw.ui.memoir_open")}
        </p>`
      : html`<section
          class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-3"
          data-gw-ending
        >
          <h3 class="text-base font-bold">
            ${endingTitle(c.pack, data.ended)}
          </h3>
          ${ending === null
            ? nothing
            : html`<p class="text-sm leading-7 text-white/90">${ending}</p>`}
        </section>`}
    <section
      class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
    >
      <h3 class=${HEAD}>${translateText("gw.ui.record_title")}</h3>
      ${record.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.ui.why_none")}</p>`
        : record.map(
            (g) =>
              html`<div>
                <div class=${MUTED}>
                  ${translateText("gw.ui.chapter_n", { n: g.chapter + 1 })}
                </div>
                ${g.keys.map(
                  (k) =>
                    html`<p class="text-sm text-white/85">
                      ${textOrNull(`gw.reason.${k}`) ?? k}
                    </p>`,
                )}
              </div>`,
          )}
    </section>
    <section
      class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
      data-gw-shelf
    >
      <h3 class=${HEAD}>${translateText("gw.ui.shelf_title")}</h3>
      <p class=${MUTED}>${translateText("gw.ui.shelf_hint")}</p>
      <div class="flex flex-wrap gap-1.5">
        <span class=${CHIP}
          >${translateText("gw.ui.shelf_endings", {
            n: endingsOf(shelf, seat.tag),
            max: SHELF_TOTALS.endings,
          })}</span
        >
        <span class=${CHIP}
          >${translateText("gw.ui.shelf_people", {
            n: shelf.people.length,
            max: SHELF_TOTALS.people,
          })}</span
        >
        <span class=${CHIP}
          >${translateText("gw.ui.shelf_documents", {
            n: shelf.documents.length,
            max: SHELF_TOTALS.documents,
          })}</span
        >
      </div>
    </section>
  </div>`;
}
