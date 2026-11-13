import {
  GW_GAUGE_MAX,
  GW_INSTITUTIONS,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { budgetSummary } from "./GwBudget";
import { craftSection, researchBox } from "./GwCraft";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { gwName } from "./GwFateModel";
import { govBox } from "./GwGov";
import { houseSection } from "./GwHouse";
import { lawsSection } from "./GwLaws";
import { gaugeFill, gaugeLevel, instBand, logByChapter } from "./GwModel";
import { authorityChip, manpowerChip, trendCause, trendWordOf } from "./GwNow";
import { instName } from "./GwOffice";
import { rulerCard } from "./GwRuler";
import { CHIP, fillColor, HEAD, MUTED } from "./GwStyle";
import {
  countInMan,
  factText,
  gaugeLineText,
  reasonText,
  reportText,
} from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

/** ww179: one plain line under a section's title, saying what it shows. */
const sub = (key: string): TemplateResult =>
  html`<p class=${MUTED} data-gw-sub>${translateText(key)}</p>`;

function bar(fill: number): TemplateResult {
  return html`<span class="block h-1.5 w-full rounded bg-white/15"
    ><span
      class="block h-1.5 rounded ${fillColor(fill)}"
      style="width:${Math.max(6, Math.round(fill * 100))}%"
    ></span
  ></span>`;
}

function gauges(c: GwCtx): TemplateResult {
  return html`<section class=${BOX}>
    <h3 class=${HEAD}>${translateText("gw.ui.gauges_title")}</h3>
    ${sub("gw.ui.gauges_sub")}
    ${c.seat.world.gauges.map((w) => {
      const v = gaugeLevel(w.gauge, w.value);
      // ww201: beside the level, where the production step is taking it.
      const trend = trendWordOf(w);
      const cause = trendCause(w);
      return html`<div class="space-y-0.5" data-gw-gauge=${w.gauge}>
        <div class="flex justify-between gap-2 text-sm">
          <span class="shrink-0 text-white/70"
            >${translateText(`gw.ui.gauge_name.${w.gauge}`)}</span
          >
          <span class="text-right"
            >${translateText(`gw.ui.gauge.${w.gauge}.${v}`)}${trend === null
              ? nothing
              : html`<span class="text-white/60" data-gw-trend=${trend}>
                  · ${translateText(`gw.ui.trend.${trend}`)}</span
                >`}</span
          >
        </div>
        ${bar(gaugeFill(w.gauge, v))}
        <span class="sr-only">${v}/${GW_GAUGE_MAX[w.gauge]}</span>
        ${cause === null
          ? nothing
          : html`<p class=${MUTED} data-gw-trend-why=${cause}>
              ${translateText("gw.ui.trend_why", {
                why: gaugeLineText(c.pack, cause),
              })}
            </p>`}
        ${w.lines.map(
          (l) =>
            html`<p class=${MUTED} data-gw-line=${l.key}>
              ${l.delta > 0 ? "▲" : "▼"} ${gaugeLineText(c.pack, l.key)}
            </p>`,
        )}
      </div>`;
    })}
  </section>`;
}

function standing(c: GwCtx): TemplateResult {
  const w = c.seat.world;
  return html`<div class="flex flex-wrap gap-1.5" data-gw-standing>
    ${authorityChip(w.authority)} ${manpowerChip(w.manpower)}
    ${w.casualties === 0
      ? nothing
      : html`<span class=${CHIP}
          >${translateText("gw.ui.casualties", {
            n: w.casualties,
            man: countInMan(w.casualties),
          })}</span
        >`}
  </div>`;
}

function list(
  title: string,
  rows: readonly string[],
  attr: string,
  subKey: string | null = null,
): TemplateResult | typeof nothing {
  if (rows.length === 0) return nothing;
  return html`<section class=${BOX} data-gw-list=${attr}>
    <h3 class=${HEAD}>${translateText(title)}</h3>
    ${subKey === null ? nothing : sub(subKey)}
    ${rows.map((r) => html`<p class="text-sm text-white/85">${r}</p>`)}
  </section>`;
}

/** The reports on the desk, newest first: the stamp is all the seat is told. */
function reports(c: GwCtx): TemplateResult | typeof nothing {
  const { reports: all, sources } = c.seat.world;
  if (all.length === 0) return nothing;
  const known = sources.filter((s) => s.right + s.wrong > 0);
  return html`<section class=${BOX} data-gw-reports>
    <h3 class=${HEAD}>${translateText("gw.ui.reports_title")}</h3>
    ${[...all].reverse().map(
      (r) =>
        html`<div class="text-sm" data-gw-report=${r.uid}>
          <div class="flex items-center gap-1.5">
            <span class=${CHIP}>${translateText(`gw.stamp.${r.stamp}`)}</span>
            <span class="${MUTED} truncate"
              >${translateText(`gw.source.${r.source}`)}</span
            >
          </div>
          <p class="text-white/85">${reportText(r, c.pack)}</p>
          ${r.corrected === null
            ? nothing
            : html`<p class="text-amber-200" data-gw-corrected>
                ${translateText("gw.ui.report_corrected", {
                  claim: factText(r.fact, r.corrected),
                })}
              </p>`}
        </div>`,
    )}
    ${known.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.ui.sources_title")}</div>
          ${known.map(
            (s) =>
              html`<p class=${MUTED}>
                ${translateText("gw.ui.source_record", {
                  source: translateText(`gw.source.${s.id}`),
                  right: s.right,
                  wrong: s.wrong,
                })}
              </p>`,
          )}`}
  </section>`;
}

/** Who stands where, as anyone can see it. */
function powers(c: GwCtx): TemplateResult {
  return html`<section class=${BOX} data-gw-powers>
    <h3 class=${HEAD}>${translateText("gw.ui.powers_title")}</h3>
    ${sub("gw.ui.powers_sub")}
    ${c.seat.world.countries.map(
      (n) =>
        html`<div class="flex justify-between text-sm">
          <span class="text-white/70">${gwName(n.tag)}</span>
          <span
            >${translateText(
              n.out ? "gw.ui.side.out" : `gw.ui.side.${n.side ?? "neutral"}`,
            )}
            · ${factText("mob", n.mob)}</span
          >
        </div>`,
    )}
  </section>`;
}

/** The war at large: its period, the sea, America, what was reached and voted. */
function war(c: GwCtx): TemplateResult {
  const v = c.seat.world.war;
  const row = (label: string, value: string, hint: string) =>
    html`<div class="flex justify-between text-sm" title=${hint}>
      <span class="text-white/70">${translateText(label)}</span>
      <span>${value}</span>
    </div>`;
  return html`<section class=${BOX} data-gw-war>
    <h3 class=${HEAD}>${translateText("gw.ui.war_title")}</h3>
    ${sub("gw.ui.war_sub")}
    ${v.regime === ""
      ? nothing
      : row(
          "gw.ui.regime",
          translateText(`gw.regime.${v.regime}`),
          translateText("gw.ui.regime_hint"),
        )}
    ${row(
      "gw.ui.era",
      translateText(`gw.era.${v.era}`),
      translateText("gw.ui.era_hint"),
    )}
    ${row(
      "gw.ui.blockade",
      translateText(`gw.ui.sea.${v.blockade}`),
      translateText("gw.ui.blockade_hint"),
    )}
    ${row(
      "gw.ui.shipping",
      translateText(`gw.ui.sea.${v.shipping}`),
      translateText("gw.ui.shipping_hint"),
    )}
    ${row(
      "gw.ui.uboats",
      translateText(`gw.ui.uboat.${v.uboat}`),
      translateText("gw.ui.uboats_hint"),
    )}
    ${row(
      "gw.ui.america",
      translateText(`gw.ui.america_word.${v.america}`),
      translateText("gw.ui.america_hint"),
    )}
    ${v.command
      ? html`<p class=${MUTED}>${translateText("gw.ui.command_self")}</p>`
      : nothing}
    ${v.research !== undefined
      ? nothing
      : v.techs.map(
          (t) => html`<p class=${MUTED}>${translateText(`gw.tech.${t}`)}</p>`,
        )}
    ${v.votes.map(
      (x) =>
        html`<p class=${MUTED}>
          ${translateText("gw.ui.vote_line", {
            issue: translateText(`gw.issue.${x.issue}`),
            ayes: x.ayes,
            noes: x.noes,
          })}
        </p>`,
    )}
  </section>`;
}

/** The country tab: gauges and why, the bodies that can say no, what is known. */
export function countryTab(c: GwCtx): TemplateResult {
  const { seat } = c;
  const w = seat.world;
  const insts = GW_INSTITUTIONS.filter((i) => seat.inst[i] !== undefined);
  const log = logByChapter(seat.log);
  return html`<div class="space-y-3" data-gw-country>
    ${rulerCard(c)} ${standing(c)} ${govBox(c)} ${budgetSummary(c)}
    ${houseSection(c)} ${lawsSection(c)} ${craftSection(c)} ${researchBox(c)}
    ${war(c)} ${gauges(c)}
    ${insts.length === 0
      ? nothing
      : html`<section class=${BOX}>
          <h3 class=${HEAD}>${translateText("gw.ui.inst_title")}</h3>
          ${sub("gw.ui.inst_sub")}
          ${insts.map(
            (i) =>
              html`<div class="flex justify-between text-sm" data-gw-inst=${i}>
                <span class="text-white/70">${instName(seat.tag, i)}</span>
                <span
                  >${translateText(
                    `gw.ui.inst.${instBand(seat.inst[i] ?? 0)}`,
                  )}</span
                >
              </div>`,
          )}
        </section>`}
    ${list(
      "gw.ui.mandates_title",
      w.mandates.map((m) => translateText(`gw.mandate.${m}`)),
      "mandates",
      "gw.ui.mandates_title_sub",
    )}
    ${reports(c)}
    ${list(
      "gw.ui.secrets_title",
      w.secrets.map((m) => translateText(`gw.secret.${m}`)),
      "secrets",
    )}
    ${list(
      "gw.ui.threads_title",
      w.threads.map((m) => translateText(`gw.thread.${m}`)),
      "threads",
      "gw.ui.threads_title_sub",
    )}
    ${powers(c)}
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.ui.why_title")}</h3>
      ${sub("gw.ui.why_sub")}
      ${log.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.ui.why_none")}</p>`
        : log.map(
            (g) =>
              html`<div data-gw-why-chapter=${g.chapter}>
                <div class=${MUTED}>
                  ${translateText("gw.ui.chapter_n", { n: g.chapter + 1 })}
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
  </div>`;
}
