// Great War 1914 (ww179): the desk's "지금 상황" box. Plain lines read from
// the view alone: war or peace, our propaganda and censorship while they run
// (ww180), the crisis in words, and what waits.
import {
  GW_GAUGE_MAX,
  type GwGauge,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_ECON_GAUGES,
  type GwTrendWord,
  gwTrendWord,
} from "@openfront/engine-api/ww1914/GwEcon";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwGaugeView } from "@openfront/engine-api/ww1914/GwWorldView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import {
  crisisShown,
  gaugeLevel,
  isReadOnly,
  paperCards,
  talkCards,
  tempBand,
} from "./GwModel";
import { CHIP, MUTED } from "./GwStyle";
import { gaugeLineText } from "./GwText";

/** One line of the box: a translation key and its params. */
export interface GwNowLine {
  key: string;
  params: Record<string, string | number>;
}

/** Foes named on the war line; more than this ends in "등". */
const FOES_SHOWN = 3;

/**
 * The lines of the box, in order: war or peace, what the chapter's turn made
 * or used up (ww201), the crisis, what waits. `pack` gives the seat's own
 * wording of a cause.
 */
export function nowLines(
  data: GreatWarData,
  seat: GwSeatView,
  pack: GwPack | null = null,
): GwNowLine[] {
  const w = seat.world;
  const out: GwNowLine[] = [];
  if (data.ended !== null) return out;
  if (w.side === null) {
    out.push({ key: "gw.ui.now.peace", params: {} });
  } else {
    const foes = w.countries
      .filter((n) => n.side !== null && n.side !== w.side && !n.out)
      .map((n) => translateText(`gw.country.${n.tag}`));
    const named = foes.slice(0, FOES_SHOWN).join(", ");
    out.push({
      key:
        foes.length === 0
          ? "gw.ui.now.war_none"
          : foes.length > FOES_SHOWN
            ? "gw.ui.now.war_more"
            : "gw.ui.now.war",
      params: { side: translateText(`gw.ui.side.${w.side}`), foes: named },
    });
  }
  const prop = propLine(seat);
  if (prop !== null) out.push(prop);
  out.push(...stepLines(seat, pack));
  const chain = w.chain ?? null;
  if (crisisShown(data, seat)) {
    const band = tempBand(data.temp);
    out.push({
      key:
        chain === null || chain.topic === "balkan"
          ? "gw.ui.now.crisis"
          : "gw.ui.now.crisis_topic",
      params: {
        word: translateText(`gw.ui.now.temp_word.${band}`),
        what: translateText(`gw.ui.now.temp_means.${band}`),
        topic:
          chain === null ? "" : translateText(`gw.ui.now.topic.${chain.topic}`),
      },
    });
  } else {
    out.push({ key: "gw.ui.now.no_crisis", params: {} });
  }
  const papers = paperCards(seat);
  const decide = papers.filter((p) => !isReadOnly(p)).length;
  const read = papers.length - decide;
  const talks = talkCards(seat).length;
  // ww193: the audience room and the departments' trays wait too.
  const room = (seat.room ?? []).length;
  const trays = (seat.depts ?? []).reduce(
    (n, d) => n + d.ready + d.initiatives,
    0,
  );
  if (decide + read + talks + room + trays === 0) {
    out.push({ key: "gw.ui.now.wait_none", params: {} });
  } else {
    const parts: string[] = [];
    if (decide > 0)
      parts.push(translateText("gw.ui.now.wait_decide", { n: decide }));
    if (read > 0) parts.push(translateText("gw.ui.now.wait_read", { n: read }));
    if (talks > 0)
      parts.push(translateText("gw.ui.now.wait_talk", { n: talks }));
    if (room > 0) parts.push(translateText("gw.ui.now.wait_room", { n: room }));
    if (trays > 0) {
      parts.push(translateText("gw.ui.now.wait_dept", { n: trays }));
    }
    out.push({ key: "gw.ui.now.wait", params: { what: parts.join(", ") } });
  }
  return out;
}

/**
 * ww201: one line for each gauge the production step moved at the chapter's
 * turn: "포탄이 한 칸 늘었다: <why>".
 */
function stepLines(seat: GwSeatView, pack: GwPack | null): GwNowLine[] {
  return (seat.world.gauges ?? []).flatMap((g) => {
    const step = g.step ?? null;
    if (step === null || step.delta === 0) return [];
    const way = step.delta > 0 ? "up" : "down";
    const big = Math.abs(step.delta) >= 2 ? "_big" : "";
    return [
      {
        key: `gw.ui.now.step.${g.gauge}.${way}${big}`,
        params: { why: gaugeLineText(pack, step.key) },
      },
    ];
  });
}

/**
 * ww201: where the production step takes a gauge, as a word; null for the
 * gauges it doesn't feed (morale, order).
 */
export function trendWordOf(w: GwGaugeView): GwTrendWord | null {
  if (!GW_ECON_GAUGES.some((g) => g === w.gauge)) return null;
  return gwTrendWord(
    w.trend ?? 0,
    gaugeLevel(w.gauge, w.value),
    GW_GAUGE_MAX[w.gauge],
  );
}

/**
 * ww201: the trend's largest cause, when it says something the ▲/▼ lines of
 * the last chapter don't already say; else null.
 */
export function trendCause(w: GwGaugeView): string | null {
  const why = w.why ?? null;
  if (why === null || trendWordOf(w) === null) return null;
  return w.lines.some((l) => l.key === why) ? null : why;
}

/**
 * ww180: what our propaganda and censorship are doing to the picture, in
 * words; null when nothing runs.
 */
function propLine(seat: GwSeatView): GwNowLine | null {
  const v = seat.world.prop;
  if (v === undefined) return null;
  const names = (tags: readonly string[]) =>
    tags.map((t) => translateText(`gw.country.${t}`)).join(", ");
  const parts: string[] = [];
  if (v.home) parts.push(translateText("gw.ui.now.prop_home"));
  if (v.hush) parts.push(translateText("gw.ui.now.prop_hush"));
  if (v.leaflets.length > 0) {
    parts.push(
      translateText("gw.ui.now.prop_leaflets", {
        countries: names(v.leaflets),
      }),
    );
  }
  if (v.papers.length > 0) {
    parts.push(
      translateText("gw.ui.now.prop_papers", { countries: names(v.papers) }),
    );
  }
  if (parts.length === 0) return null;
  return { key: "gw.ui.now.prop", params: { what: parts.join(", ") } };
}

/** The box at the top of the desk. */
export function nowBox(c: GwCtx): TemplateResult | typeof nothing {
  const lines = nowLines(c.data, c.seat, c.pack);
  if (lines.length === 0) return nothing;
  return html`<div
    class="rounded border border-white/10 bg-white/5 p-2"
    data-gw-now
  >
    <div class=${MUTED}>${translateText("gw.ui.now.title")}</div>
    ${lines.map(
      (l) =>
        html`<p class="text-sm text-white/85" data-gw-now-line=${l.key}>
          ${translateText(l.key, l.params)}
        </p>`,
    )}
  </div>`;
}

/** A 0..100 standing as one of five words, low to high. */
export function fifthOf(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n < 20) return 0;
  if (n < 40) return 1;
  if (n < 60) return 2;
  if (n < 80) return 3;
  return 4;
}

/** "권위 60 · 든든함", with a hover line saying what authority is for. */
export function authorityChip(n: number): TemplateResult {
  return html`<span
    class=${CHIP}
    data-gw-authority
    title=${translateText("gw.ui.authority_hint")}
    >${translateText("gw.ui.authority", {
      n,
      word: translateText(`gw.ui.authority_word.${fifthOf(n)}`),
    })}</span
  >`;
}

/** "남은 병력 자원 80 · 넉넉함", with a hover line. */
export function manpowerChip(n: number): TemplateResult {
  return html`<span
    class=${CHIP}
    data-gw-manpower
    title=${translateText("gw.ui.manpower_hint")}
    >${translateText("gw.ui.manpower", {
      n,
      word: translateText(`gw.ui.manpower_word.${fifthOf(n)}`),
    })}</span
  >`;
}

/**
 * A band gauge's hover: what it is, where it is heading and why (ww201), then
 * why it moved in the last chapter, one "▲ reason" a line, as the country tab
 * tells it.
 */
export function gaugeTitle(c: GwCtx, gauge: GwGauge): string {
  const w = c.seat.world.gauges.find((x) => x.gauge === gauge);
  const pack = c.pack ?? null;
  const why = (w?.lines ?? []).map(
    (l) => `${l.delta > 0 ? "▲" : "▼"} ${gaugeLineText(pack, l.key)}`,
  );
  const head = [translateText(`gw.ui.gauge_hint.${gauge}`)];
  const word = w === undefined ? null : trendWordOf(w);
  if (w !== undefined && word !== null) {
    head.push(
      translateText("gw.ui.trend_is", {
        word: translateText(`gw.ui.trend.${word}`),
      }),
    );
    const cause = trendCause(w);
    if (cause !== null) {
      head.push(
        translateText("gw.ui.trend_why", { why: gaugeLineText(pack, cause) }),
      );
    }
  }
  return why.length === 0
    ? head.join("\n")
    : [...head, translateText("gw.ui.gauge_why"), ...why].join("\n");
}
