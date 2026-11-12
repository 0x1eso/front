// Great War 1914 (ww196 §0): you are that person. The desk heading ("<장소> ·
// <날짜> · <누가> 서류를 들고 들어온다"), who hands in each paper and how, the
// diary card atop the next desk and 수첩 › 일기. Words from pack `persona`;
// the rows are the engine's (lane P). Existing boxes only.
import type { GwDiaryView } from "@openfront/engine-api/ww1914/GwPersona";
import type {
  GwCardView,
  GwOptionView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { CHIP, HEAD, MUTED } from "./GwStyle";
import { fullDate, personName, shortDate } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

/** A bearer's name: his text, else the person he is. */
export function bearerName(c: GwCtx, id: string): string {
  return c.pack?.persona?.bearers?.[id]?.name ?? personName(c.pack, id);
}

/** One of his manner lines, the same for the same paper. */
function mannerLine(c: GwCtx, id: string, n: number): string | null {
  const lines = c.pack?.persona?.bearers?.[id]?.manner ?? [];
  return lines.length === 0 ? null : lines[Math.abs(n) % lines.length];
}

/** The desk's heading: where he sits today, the date, who comes in. */
export function deskHeading(c: GwCtx): TemplateResult | typeof nothing {
  const h = c.seat.head;
  if (h === undefined) return nothing;
  const place =
    h.place === null ? undefined : c.pack?.persona?.places?.[h.place];
  const date = fullDate(c.data.date);
  const manner =
    h.bearer === null ? null : mannerLine(c, h.bearer, c.data.chapter);
  return html`<header class="space-y-0.5" data-gw-desk-head>
    <h3 class=${HEAD} data-gw-desk-place=${h.place ?? ""}>
      ${place === undefined ? date : `${place} · ${date}`}
    </h3>
    ${h.bearer === null
      ? nothing
      : html`<p class=${MUTED} data-gw-desk-bearer=${h.bearer}>
          ${applyJosa(
            translateText("gw.ui.persona.comes_in", {
              who: bearerName(c, h.bearer),
            }),
          )}${manner === null ? nothing : html` ${rich(c, manner)}`}
        </p>`}
  </header>`;
}

/** "<누가> 올린 서류" on a desk card; in the reader with his manner. */
export function bearerLine(
  c: GwCtx,
  card: GwCardView,
  manner = false,
): TemplateResult | typeof nothing {
  const b = card.bearer;
  if (b === undefined) return nothing;
  const how = manner ? mannerLine(c, b, card.uid) : null;
  return html`<p class=${MUTED} data-gw-bearer=${b}>
    ${applyJosa(
      translateText("gw.ui.persona.brought", { who: bearerName(c, b) }),
    )}${how === null ? nothing : html` · ${rich(c, how)}`}
  </p>`;
}

/** A diary line with its {who}, {scene}, {front} and {topic} filled. */
export function diaryText(c: GwCtx, d: GwDiaryView): string | null {
  const text = c.pack?.persona?.diary?.[d.row];
  if (text === undefined) return null;
  const scene = d.scene === null ? "" : (c.pack?.scenes[d.scene]?.title ?? "");
  return applyJosa(
    text
      .split("{who}")
      .join(d.who === null ? "" : personName(c.pack, d.who))
      .split("{scene}")
      .join(scene)
      .split("{topic}")
      .join(scene)
      .split("{front}")
      .join(d.theatre === null ? "" : translateText(`gw.theatre.${d.theatre}`)),
  );
}

/** "니콜라이의 일기": the seat's form, else the plain word. */
function diaryForm(c: GwCtx): string {
  return (
    c.pack?.persona?.forms?.[c.seat.tag] ?? translateText("gw.ui.persona.diary")
  );
}

function diaryRows(c: GwCtx, rows: readonly GwDiaryView[]): TemplateResult[] {
  return rows.flatMap((d) => {
    const text = diaryText(c, d);
    return text === null
      ? []
      : [
          html`<p class="text-sm text-white/85" data-gw-diary-row=${d.row}>
            <span class=${MUTED}>${shortDate(d.date)}</span> ${rich(c, text)}
          </p>`,
        ];
  });
}

/** The last chapter's lines, a read-only card at the top of the desk. */
export function diaryCard(c: GwCtx): TemplateResult | typeof nothing {
  const all = c.seat.diary ?? [];
  const last = all.length === 0 ? null : all[all.length - 1].chapter;
  if (last === null || last < c.data.chapter - 1) return nothing;
  const rows = diaryRows(
    c,
    all.filter((d) => d.chapter === last),
  );
  if (rows.length === 0) return nothing;
  return html`<section
    class="space-y-1 rounded border border-white/10 bg-white/5 p-2"
    data-gw-diary-card
  >
    <div class=${MUTED}>${diaryForm(c)}</div>
    ${rows}
  </section>`;
}

/** 수첩 › 일기: every line kept, the newest first. */
export function diarySection(c: GwCtx): TemplateResult | typeof nothing {
  const all = c.seat.diary;
  if (all === undefined) return nothing;
  const rows = diaryRows(c, [...all].reverse());
  return html`<section class=${BOX} data-gw-notebook-diary>
    <h3 class=${HEAD}>${diaryForm(c)}</h3>
    ${rows.length === 0
      ? html`<p class=${MUTED}>${translateText("gw.ui.persona.no_diary")}</p>`
      : rows}
  </section>`;
}

/** The person's line against an option's grain (`persona.grain`), if any. */
export function grainLine(c: GwCtx, o: GwOptionView): string | undefined {
  return o.grain === undefined ? undefined : c.pack?.persona?.grain?.[o.grain];
}

/** "마음에 걸린다": an open option that goes against him costs him. */
export function grainChip(o: GwOptionView): TemplateResult | typeof nothing {
  if (o.grain === undefined) return nothing;
  return html`<span class="pl-1"
    ><span
      class=${CHIP}
      data-gw-grain=${o.id}
      title=${translateText("gw.ui.persona.grain_tip")}
      >${translateText("gw.ui.persona.grain")}</span
    ></span
  >`;
}
