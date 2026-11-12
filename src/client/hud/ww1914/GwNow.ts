// Great War 1914 (ww179): the desk's "지금 상황" box. Plain lines read from
// the view alone: war or peace, our propaganda and censorship while they run
// (ww180), the crisis in words, and what waits.
import type { GwGauge } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { gwName } from "./GwFateModel";
import {
  crisisShown,
  isReadOnly,
  paperCards,
  talkCards,
  tempBand,
} from "./GwModel";
import { CHIP, MUTED } from "./GwStyle";
import { textOrNull } from "./GwText";

/** One line of the box: a translation key and its params. */
export interface GwNowLine {
  key: string;
  params: Record<string, string | number>;
}

/** Foes named on the war line; more than this ends in "등". */
const FOES_SHOWN = 3;

/** The lines of the box, in order: war or peace, the crisis, what waits. */
export function nowLines(data: GreatWarData, seat: GwSeatView): GwNowLine[] {
  const w = seat.world;
  const out: GwNowLine[] = [];
  if (data.ended !== null) return out;
  if (w.side === null) {
    out.push({ key: "gw.ui.now.peace", params: {} });
  } else {
    const foes = w.countries
      .filter((n) => n.side !== null && n.side !== w.side && !n.out)
      .map((n) => gwName(n.tag));
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
 * ww180: what our propaganda and censorship are doing to the picture, in
 * words; null when nothing runs.
 */
function propLine(seat: GwSeatView): GwNowLine | null {
  const v = seat.world.prop;
  if (v === undefined) return null;
  const names = (tags: readonly string[]) =>
    tags.map((t) => gwName(t)).join(", ");
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
  const lines = nowLines(c.data, c.seat);
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
 * A band gauge's hover: what it is, then why it moved in the last chapter,
 * one "▲ reason" a line, as the country tab tells it.
 */
export function gaugeTitle(c: GwCtx, gauge: GwGauge): string {
  const w = c.seat.world.gauges.find((x) => x.gauge === gauge);
  const why = (w?.lines ?? []).map(
    (l) =>
      `${l.delta > 0 ? "▲" : "▼"} ${
        textOrNull(`gw.line.${l.key}`) ?? c.pack?.reasons?.[l.key] ?? l.key
      }`,
  );
  const head = translateText(`gw.ui.gauge_hint.${gauge}`);
  return why.length === 0
    ? head
    : [head, translateText("gw.ui.gauge_why"), ...why].join("\n");
}
