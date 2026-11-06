import type { GwMemoir } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { endingsOf, logByChapter, shelfTotals } from "./GwModel";
import { CHIP, HEAD, MUTED } from "./GwStyle";
import {
  endingText,
  endingTitle,
  frontLine,
  personName,
  reasonText,
  shortDate,
  turnText,
  unknownText,
} from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

function ending(c: GwCtx, m: GwMemoir): TemplateResult {
  const text = endingText(c.pack, m, c.data.date);
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-3"
    data-gw-ending=${m.ending}
  >
    <h3 class="text-base font-bold">${endingTitle(m.ending)}</h3>
    <p class=${MUTED}>
      ${translateText("gw.ui.memoir_date", {
        date: shortDate(c.data.date),
        n: m.chapter + 1,
      })}
    </p>
    ${text === null
      ? nothing
      : html`<p class="text-sm leading-7 text-white/90">${text}</p>`}
  </section>`;
}

function mandates(m: GwMemoir): TemplateResult | typeof nothing {
  if (m.mandates.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-memoir-mandates>
    <h3 class=${HEAD}>${translateText("gw.ui.mandates_title")}</h3>
    ${m.mandates.map(
      (x) =>
        html`<div class="flex justify-between gap-2 text-sm">
          <span class="text-white/85"
            >${translateText(`gw.mandate.${x.id}`)}</span
          >
          <span class=${x.met ? "text-amber-200" : "text-white/50"}
            >${translateText(
              x.met ? "gw.ui.mandate_met" : "gw.ui.mandate_unmet",
            )}</span
          >
        </div>`,
    )}
  </section>`;
}

function turns(m: GwMemoir): TemplateResult | typeof nothing {
  if (m.turns.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-turns>
    <h3 class=${HEAD}>${translateText("gw.ui.turns_title")}</h3>
    ${m.turns.map(
      (t) =>
        html`<div class="flex gap-2 text-sm">
          <span class="${MUTED} w-8 shrink-0"
            >${translateText("gw.ui.chapter_n", { n: t.chapter + 1 })}</span
          >
          <span class="text-white/85">${turnText(t)}</span>
        </div>`,
    )}
  </section>`;
}

function reckoning(m: GwMemoir): TemplateResult | typeof nothing {
  if (m.fronts.length === 0 && m.casualties === 0) return nothing;
  return html`<section class=${BOX} data-gw-reckoning>
    <h3 class=${HEAD}>${translateText("gw.ui.reckoning_title")}</h3>
    ${m.casualties === 0
      ? nothing
      : html`<p class="text-sm text-white/85">
          ${translateText("gw.ui.casualties", { n: m.casualties })}
        </p>`}
    ${m.fronts.map(
      (f) =>
        html`<div class="flex justify-between text-sm">
          <span class="text-white/70"
            >${translateText(`gw.ui.theatre.${f.theatre}`)}</span
          >
          <span>${frontLine(f.theatre, f.line)}</span>
        </div>`,
    )}
  </section>`;
}

function cast(c: GwCtx, m: GwMemoir): TemplateResult {
  const rows = m.people.filter(
    (p) => p.office !== null || p.status !== "active" || p.wins + p.losses > 0,
  );
  return html`<section class=${BOX} data-gw-memoir-people>
    <h3 class=${HEAD}>${translateText("gw.ui.memoir_people")}</h3>
    ${rows.map(
      (p) =>
        html`<div class="flex justify-between gap-2 text-sm">
          <span class="text-white/85">${personName(c.pack, p.id)}</span>
          <span class=${MUTED}
            >${p.status !== "active"
              ? translateText(`gw.ui.person_status.${p.status}`)
              : p.office === null
                ? translateText("gw.ui.no_office")
                : translateText(`gw.office.${p.office}`)}${p.wins + p.losses > 0
              ? ` · ${translateText("gw.ui.person_record", {
                  wins: p.wins,
                  losses: p.losses,
                })}`
              : ""}</span
          >
        </div>`,
    )}
  </section>`;
}

/** The last page: what would have changed the game, and the next one. */
function unknown(c: GwCtx, m: GwMemoir): TemplateResult {
  return html`<section
    class="space-y-1.5 rounded border border-white/25 bg-black/50 p-3"
    data-gw-unknown
  >
    <h3 class=${HEAD}>${translateText("gw.ui.unknown_title")}</h3>
    ${m.unknown.length === 0
      ? html`<p class=${MUTED}>${translateText("gw.ui.unknown_none")}</p>`
      : m.unknown.map(
          (u) =>
            html`<p class="text-sm leading-6 text-white/90">
              ${unknownText(c.pack, u)}
            </p>`,
        )}
  </section>`;
}

function shelfBox(c: GwCtx): TemplateResult {
  const { seat, ui } = c;
  const shelf = ui.shelf;
  const memoir = seat.world.memoir;
  const total = shelfTotals(
    memoir?.people.length ?? seat.people.length,
    seat.tag,
  );
  return html`<section class=${BOX} data-gw-shelf>
    <h3 class=${HEAD}>${translateText("gw.ui.shelf_title")}</h3>
    <p class=${MUTED}>${translateText("gw.ui.shelf_hint")}</p>
    <div class="flex flex-wrap gap-1.5">
      <span class=${CHIP}
        >${translateText("gw.ui.shelf_endings", {
          n: endingsOf(shelf, seat.tag),
          max: total.endings,
        })}</span
      >
      <span class=${CHIP}
        >${translateText("gw.ui.shelf_people", {
          n: shelf.people.length,
          max: total.people,
        })}</span
      >
      <span class=${CHIP}
        >${translateText("gw.ui.shelf_documents", {
          n: shelf.secrets.length,
          max: total.secrets,
        })}</span
      >
      <span class=${CHIP}
        >${translateText("gw.ui.shelf_mandates", {
          n: shelf.mandates.length,
        })}</span
      >
      <span class=${CHIP}
        >${translateText("gw.ui.shelf_runs", { n: shelf.runs.length })}</span
      >
    </div>
  </section>`;
}

/** The memoir tab: the ending, the game's record, what stayed hidden, the shelf. */
export function memoirTab(c: GwCtx): TemplateResult {
  const { seat } = c;
  const m = seat.world.memoir;
  const record = logByChapter(seat.log).reverse();
  return html`<div class="space-y-3" data-gw-memoir>
    ${m === null
      ? html`<p class="text-sm text-white/70">
          ${translateText("gw.ui.memoir_open")}
        </p>`
      : html`${ending(c, m)} ${mandates(m)} ${turns(m)} ${reckoning(m)}
        ${cast(c, m)} ${unknown(c, m)}`}
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.ui.record_title")}</h3>
      ${record.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.ui.why_none")}</p>`
        : record.map(
            (g) =>
              html`<div>
                <div class=${MUTED}>
                  ${translateText("gw.ui.chapter_n", { n: g.chapter + 1 })}
                </div>
                ${g.reasons.map(
                  (r) =>
                    html`<p class="text-sm text-white/85">
                      ${reasonText(c.pack, r)}
                    </p>`,
                )}
              </div>`,
          )}
    </section>
    ${shelfBox(c)}
  </div>`;
}
