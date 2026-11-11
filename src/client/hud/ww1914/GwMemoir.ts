import type { GwMemoir } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { endingsOf, logByChapter, shelfTotals } from "./GwModel";
import { officeTitle } from "./GwOffice";
import { BTN, CHIP, HEAD, MUTED } from "./GwStyle";
import { countryName, placeName } from "./GwTableModel";
import {
  countInMan,
  endingText,
  endingTitle,
  endingWhy,
  frontLine,
  fullDate,
  personName,
  reasonText,
  rivalLine,
  turnText,
  unknownText,
} from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
const PROSE = "whitespace-pre-line text-sm leading-7 text-white/90";

function ending(c: GwCtx, m: GwMemoir): TemplateResult {
  const text = endingText(c.pack, m, c.data.date);
  const why = endingWhy(m);
  const man = m.rival ?? null;
  const rival = man === null ? null : rich(c, rivalLine(c.pack, man));
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-3"
    data-gw-ending=${m.ending}
  >
    <h3 class="text-base font-bold">${endingTitle(m.ending)}</h3>
    ${why === null
      ? nothing
      : html`<p class="text-sm text-amber-100/90" data-gw-ending-why>
          ${why}
        </p>`}
    <p class=${MUTED}>
      ${translateText("gw.ui.memoir_date", {
        date: fullDate(c.data.date),
        n: m.chapter + 1,
      })}
    </p>
    ${text === null ? nothing : html`<p class=${PROSE}>${rich(c, text)}</p>`}
    ${rival === null
      ? nothing
      : html`<p class=${PROSE} data-gw-rival>${rival}</p>`}
  </section>`;
}

/** What the seat said the war was for, and how that stands at the end. */
function aimBox(c: GwCtx, m: GwMemoir): TemplateResult | typeof nothing {
  if (m.aim === null || m.aim === undefined) return nothing;
  const words = c.pack?.aims?.[m.aim.id];
  const dropped = m.aim.dropped.map((id) => c.pack?.aims?.[id]?.name ?? id);
  return html`<section class=${BOX} data-gw-memoir-aim>
    <h3 class=${HEAD}>${translateText("gw.aim.title")}</h3>
    <p class="text-sm font-bold text-amber-100">${words?.name ?? m.aim.id}</p>
    ${words === undefined
      ? nothing
      : html`<p class=${PROSE}>
          ${rich(c, m.aim.met ? words.met : words.unmet)}
        </p>`}
    ${dropped.length === 0
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.aim.dropped", { list: dropped.join(", ") })}
        </p>`}
  </section>`;
}

/** What the map became: the land by who has it now, what stood in for land. */
function mapBox(c: GwCtx, m: GwMemoir): TemplateResult | typeof nothing {
  const r = m.map;
  if (r === null || r === undefined) return nothing;
  const words = c.pack?.table?.memoir;
  const lines = [
    r.role === null ? undefined : words?.[r.role],
    r.over >= 3 ? words?.over : undefined,
    r.held > 0 ? words?.held : undefined,
  ].filter((x) => x !== undefined);
  const holders = [...new Set(r.moves.map((x) => x.to))];
  return html`<section class=${BOX} data-gw-memoir-map>
    <h3 class=${HEAD}>${translateText("gw.table.map.title")}</h3>
    ${lines.map((l) => html`<p class=${PROSE}>${rich(c, l)}</p>`)}
    ${r.painted.length === 0
      ? nothing
      : html`<p class="text-sm text-amber-100" data-gw-memoir-got>
          ${translateText("gw.table.map.got", {
            n: r.got.length,
            total: r.painted.length,
          })}
        </p>`}
    ${holders.length === 0
      ? html`<p class=${MUTED}>${translateText("gw.table.map.unchanged")}</p>`
      : holders.map(
          (tag) =>
            html`<p class="text-sm text-white/85" data-gw-memoir-holder=${tag}>
              ${translateText("gw.table.map.held_by", {
                country: countryName(tag),
                list: r.moves
                  .filter((x) => x.to === tag)
                  .map((x) => placeName(x.place))
                  .join(", "),
              })}
            </p>`,
        )}
    ${r.trades.map(
      (x) =>
        html`<p class=${MUTED}>
          ${translateText(
            x.mine ? "gw.table.map.trade_mine" : "gw.table.map.trade_theirs",
            {
              place: placeName(x.place),
              country: countryName(x.with),
              trade: translateText(`gw.table.trade.${x.trade}`),
            },
          )}
        </p>`,
    )}
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
            >${translateText("gw.ui.chapter_n", {
              n: Math.min(t.chapter, m.chapter) + 1,
            })}</span
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
          ${translateText("gw.ui.casualties", {
            n: m.casualties,
            man: countInMan(m.casualties),
          })}
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
                : officeTitle(c.seat.tag, p.office)}${p.wins + p.losses > 0
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
              ${rich(c, unknownText(c.pack, u))}
            </p>`,
        )}
  </section>`;
}

function shelfBox(c: GwCtx): TemplateResult {
  const { seat, ui } = c;
  const shelf = ui.shelf;
  const memoir = seat.world.memoir;
  const cast = memoir?.people ?? seat.people;
  const total = shelfTotals(cast.length, seat.tag);
  // The shelf runs across countries; the count is of this one's cast.
  const met = cast.filter((p) => shelf.people.includes(p.id)).length;
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
          n: met,
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
  // How a talk went is told when it ends, and the same small lines come every
  // other chapter of a game: the record keeps what happened.
  const record = logByChapter(
    seat.log.filter(
      (r) =>
        !/^(talk_(fit|clash)_|rival_resents$|report_corrected$)/.test(r.key),
    ),
  ).reverse();
  return html`<div class="space-y-3" data-gw-memoir>
    ${m === null
      ? html`<p class="text-sm text-white/70">
          ${translateText("gw.ui.memoir_open")}
        </p>`
      : html`${ending(c, m)}
        ${c.data.finale === null
          ? nothing
          : html`<button
              class="${BTN} w-full text-center"
              data-gw-finale-open
              @click=${() => {
                c.ui.finale = true;
                c.redraw();
              }}
            >
              ${translateText("gw.diplo.finale_open")}
            </button>`}
        ${mapBox(c, m)} ${aimBox(c, m)} ${mandates(m)} ${turns(m)}
        ${reckoning(m)} ${cast(c, m)} ${unknown(c, m)}`}
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.ui.record_title")}</h3>
      ${record.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.ui.why_none")}</p>`
        : record.map(
            (g) =>
              html`<div>
                <div class=${MUTED}>
                  ${translateText("gw.ui.chapter_n", {
                    // The peace jumps the chapter to the last row.
                    n: Math.min(g.chapter, m?.chapter ?? g.chapter) + 1,
                  })}
                </div>
                ${g.reasons.map(
                  (r) =>
                    html`<p class="text-sm text-white/85">
                      ${rich(c, reasonText(c.pack, r, c.seat.tag))}
                    </p>`,
                )}
              </div>`,
          )}
    </section>
    ${shelfBox(c)}
  </div>`;
}
