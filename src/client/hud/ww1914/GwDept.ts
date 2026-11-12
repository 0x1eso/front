// Great War 1914 (ww193): departments at work on the screens. 사람 › 부서, the
// audience room (접견실), a head's briefing, the department's mark on a paper,
// the one time pool. Existing boxes and the talk column only: no new look.
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_THEATRES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwDeptMoment,
  GwDeptView,
  GwRoomRowView,
  GwTaskOfferView,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwCardView } from "@openfront/engine-api/ww1914/GwView";
import { GW_TIME_PRICES } from "@openfront/engine-lib/ww1914/TaskRows";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { gwFace } from "./GwFace";
import { topicLabel } from "./GwModel";
import { officeTitle } from "./GwOffice";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { country, personName, shortDate } from "./GwText";

const SMALL = "!px-2 !py-1";

/** The department's name on this seat ("외무부"), else the office's title. */
export function deptName(c: GwCtx, office: string): string {
  return (
    c.pack?.depts?.names?.[office as GwOffice] ??
    officeTitle(c.seat.tag, office)
  );
}

/** A task's topic in words: a subject, a country, a front. */
export function topicWord(c: GwCtx, topic: string | null): string {
  if (topic === null) return "";
  const own = c.pack?.depts?.topics?.[topic];
  if (own !== undefined) return own;
  if ((GW_TAGS as readonly string[]).includes(topic)) return country(topic);
  if ((GW_THEATRES as readonly string[]).includes(topic)) {
    return translateText(`gw.theatre.${topic}`);
  }
  return topic;
}

/** How a task row reads, with its topic filled in. */
export function taskName(
  c: GwCtx,
  row: string | null,
  topic: string | null,
): string {
  const word = topicWord(c, topic);
  const name =
    row === null
      ? translateText("gw.ui.dept.passed_work")
      : (c.pack?.depts?.tasks?.[row]?.name ?? row);
  return name.split("{topic}").join(word);
}

/** The department's line for a moment: the person's, the office's, the kind's. */
export function deptVoice(
  c: GwCtx,
  d: GwDeptView | undefined,
  moment: GwDeptMoment,
  topic: string | null,
): string | null {
  if (d === undefined || d.head === null) return null;
  const voices = c.pack?.depts?.voices ?? {};
  for (const key of d.voice) {
    const line = voices[key]?.[moment];
    if (line === undefined) continue;
    return line
      .split("{who}")
      .join(personName(c.pack, d.head))
      .split("{topic}")
      .join(topicWord(c, topic));
  }
  return null;
}

/** Time left this chapter: the one pool, or the audiences before ww193. */
export function timeLeft(c: GwCtx): number {
  return c.seat.time?.left ?? c.seat.audiences;
}

/** The pool can pay for this now. */
export function canSpend(c: GwCtx, what: keyof typeof GW_TIME_PRICES): boolean {
  const t = c.seat.time;
  if (t === undefined) return true;
  if (t.away && (what === "brief" || what === "petition")) return false;
  return t.left >= GW_TIME_PRICES[what];
}

/** "남은 일정 n": one chip, the prices in words on hover. */
export function timeChip(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.time;
  if (t === undefined) return nothing;
  const tip = [
    translateText("gw.ui.dept.time_tip"),
    t.carry > 0 ? translateText("gw.ui.dept.time_carry") : "",
  ]
    .filter((x) => x !== "")
    .join(" ");
  return html`<span class=${CHIP} data-gw-time title=${tip}
    >${translateText(t.away ? "gw.ui.dept.time_away" : "gw.ui.dept.time", {
      n: t.left,
    })}</span
  >`;
}

function face(c: GwCtx, id: string, size: string): TemplateResult {
  const name = personName(c.pack, id);
  return gwFace(
    c.faces,
    id,
    translateText("gw.ui.face_alt", { name }),
    size,
    html`<span
      class="flex ${size} shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm font-bold"
      aria-hidden="true"
      >${name.replace(/\s+/g, "").slice(0, 1)}</span
    >`,
  );
}

function wantLine(c: GwCtx, d: GwDeptView): TemplateResult | typeof nothing {
  const text = d.want === null ? undefined : c.pack?.depts?.wants?.[d.want];
  if (text === undefined) return nothing;
  return html`<p class="${MUTED} truncate" data-gw-dept-want>
    ${translateText("gw.ui.dept.want", { what: text })}
  </p>`;
}

/** One status line: at work, papers ready, or idle. */
function statusLine(c: GwCtx, d: GwDeptView): string {
  if (d.head === null) return translateText("gw.ui.dept.empty");
  const parts: string[] = [];
  if (d.task !== null) {
    parts.push(
      translateText(
        d.task.soon ? "gw.ui.dept.working_soon" : "gw.ui.dept.working",
        {
          what: taskName(c, d.task.row, d.task.topic),
        },
      ),
    );
  }
  if (d.ready > 0) {
    parts.push(translateText("gw.ui.dept.ready", { n: d.ready }));
  }
  if (d.initiatives > 0) {
    parts.push(translateText("gw.ui.dept.initiatives", { n: d.initiatives }));
  }
  return parts.length === 0
    ? translateText("gw.ui.dept.idle")
    : parts.join(" · ");
}

function offerRow(c: GwCtx, d: GwDeptView, o: GwTaskOfferView): TemplateResult {
  const picked = c.ui.deptTask?.row === o.row ? c.ui.deptTask : null;
  const topic = picked?.topic ?? o.topic;
  const ready = picked !== null && (o.topics.length === 0 || topic !== null);
  const free = d.price === 0;
  const afford = free || canSpend(c, "task");
  return html`<div class="space-y-1" data-gw-dept-offer=${o.row}>
    <button
      class="${picked === null ? BTN : BTN_ON} w-full"
      data-gw-dept-task=${o.row}
      ?disabled=${!afford}
      @click=${() => {
        c.ui.deptTask = picked === null ? { row: o.row, topic: o.topic } : null;
        c.redraw();
      }}
    >
      ${taskName(c, o.row, o.topics.length > 0 ? null : o.topic)}
    </button>
    ${picked === null
      ? nothing
      : html`<div class="space-y-1 pl-1">
          ${(() => {
            const note = c.pack?.depts?.tasks?.[o.row]?.note;
            return note === undefined
              ? nothing
              : html`<p class="text-sm text-white/75">${rich(c, note)}</p>`;
          })()}
          ${o.topics.length === 0
            ? nothing
            : html`<div class="flex flex-wrap gap-1">
                ${o.topics.map(
                  (t) =>
                    html`<button
                      class="${topic === t ? BTN_ON : BTN} ${SMALL}"
                      data-gw-dept-topic=${t}
                      @click=${() => {
                        c.ui.deptTask = { row: o.row, topic: t };
                        c.redraw();
                      }}
                    >
                      ${topicWord(c, t)}
                    </button>`,
                )}
              </div>`}
          <button
            class="w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-1.5 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40"
            data-gw-dept-give
            ?disabled=${!ready}
            @click=${() => {
              if (!ready) return;
              c.send({
                kind: "task",
                office: d.office,
                row: o.row,
                topic: o.topics.length === 0 ? null : topic,
              });
              c.ui.deptTask = null;
              c.redraw();
            }}
          >
            ${translateText(free ? "gw.ui.dept.give_free" : "gw.ui.dept.give")}
          </button>
        </div>`}
  </div>`;
}

function pastRows(c: GwCtx, d: GwDeptView): TemplateResult | typeof nothing {
  if (d.past.length === 0) return nothing;
  return html`<div class="space-y-0.5" data-gw-dept-past>
    <div class=${MUTED}>${translateText("gw.ui.dept.past")}</div>
    ${[...d.past].reverse().map(
      (p) =>
        html`<p class="text-sm text-white/75">
          <span class=${MUTED}>${shortDate(p.date)}</span>
          ${c.pack?.scenes[p.scene]?.title ?? taskName(c, p.row, p.topic)}
          <span class=${MUTED}
            >· ${translateText(`gw.ui.dept.verdict.${p.verdict}`)}</span
          >
        </p>`,
    )}
  </div>`;
}

/** What the people tab draws of a head: his talk count, his opened row. */
export interface HeadParts {
  badge(id: string): TemplateResult | typeof nothing;
  body(id: string): TemplateResult | typeof nothing;
}

/** One department as a person row: the head's face, the office, its status. */
export function deptRow(
  c: GwCtx,
  d: GwDeptView,
  parts: HeadParts,
): TemplateResult {
  const open = c.ui.deptOpen === d.office;
  const head = d.head;
  const waiting = d.ready + d.initiatives;
  return html`<section
    data-gw-dept=${d.office}
    class="rounded border border-white/15 bg-black/35 p-2.5 ${head === null
      ? "opacity-60"
      : ""}"
  >
    <button
      class="flex w-full items-center gap-2 text-left"
      @click=${() => {
        c.ui.deptOpen = open ? null : d.office;
        c.ui.deptTask = null;
        c.redraw();
      }}
    >
      ${head === null
        ? html`<span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-white/30 text-sm"
            aria-hidden="true"
          ></span>`
        : face(c, head, "h-9 w-9")}
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-sm font-bold"
            >${deptName(c, d.office)}</span
          >
          ${head === null ? nothing : parts.badge(head)}
        </span>
        <span class="${MUTED} block truncate"
          >${head === null
            ? officeTitle(c.seat.tag, d.office)
            : html`${personName(c.pack, head)} ·
              ${officeTitle(c.seat.tag, d.office)}`}</span
        >
        <span
          class="block truncate text-xs text-amber-100/90"
          data-gw-dept-status
          >${statusLine(c, d)}</span
        >
        ${wantLine(c, d)}
      </span>
    </button>
    ${open && head !== null
      ? html`<div class="mt-2 space-y-2 border-t border-white/10 pt-2">
          ${waiting === 0
            ? nothing
            : html`<button
                class="${BTN} w-full"
                data-gw-dept-brief=${d.office}
                ?disabled=${!canSpend(c, "brief")}
                @click=${() => meet(c, head, d.office, false)}
              >
                ${translateText("gw.ui.dept.brief", {
                  name: personName(c.pack, head),
                })}
              </button>`}
          ${d.task !== null
            ? html`<p class=${MUTED}>${translateText("gw.ui.dept.busy")}</p>`
            : d.offers.length === 0
              ? html`<p class=${MUTED}>
                  ${translateText("gw.ui.dept.no_offers")}
                </p>`
              : html`<div class="space-y-1">
                  <div class=${MUTED}>
                    ${translateText(
                      d.price === 0
                        ? "gw.ui.dept.offers_free"
                        : "gw.ui.dept.offers",
                    )}
                  </div>
                  ${d.offers.map((o) => offerRow(c, d, o))}
                </div>`}
          ${pastRows(c, d)}
          <div class="space-y-2 border-t border-white/10 pt-2">
            ${parts.body(head)}
          </div>
        </div>`
      : nothing}
  </section>`;
}

/** 사람 › 부서: every department, at the top of the people tab. */
export function deptsBox(
  c: GwCtx,
  parts: HeadParts,
): TemplateResult | typeof nothing {
  const depts = c.seat.depts ?? [];
  if (depts.length === 0) return nothing;
  return html`<div class="space-y-1.5" data-gw-depts>
    <h3 class=${HEAD}>${translateText("gw.ui.dept.title")}</h3>
    ${depts.map((d) => deptRow(c, d, parts))}
  </div>`;
}

/** Seeing someone: a head's briefing, or a petitioner as a summons. */
function meet(
  c: GwCtx,
  person: string,
  office: GwOffice | null,
  petition: boolean,
  topic?: string,
): void {
  if (petition) {
    if (topic === undefined) return;
    c.send({ kind: "summon", person, topic });
  } else {
    if (office === null) return;
    c.send({ kind: "brief", office });
    c.ui.briefing = person;
  }
  c.ui.summoned = Date.now();
  c.redraw();
}

function roomRow(c: GwCtx, r: GwRoomRowView): TemplateResult {
  const name = personName(c.pack, r.person);
  const what = r.petition
    ? translateText("gw.ui.dept.room_petition", {
        what: r.topic === undefined ? "" : topicLabel(c.pack, r.topic),
      })
    : translateText("gw.ui.dept.room_brings", { n: r.brings });
  const want =
    r.want === undefined || r.want === null
      ? undefined
      : c.pack?.depts?.wants?.[r.want];
  const shut = c.seat.time?.away === true;
  const afford = canSpend(c, r.petition ? "petition" : "brief");
  return html`<div
    class="flex items-center gap-2 border-t border-white/10 pt-1.5"
    data-gw-room-row=${r.person}
  >
    ${face(c, r.person, "h-9 w-9")}
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-bold">${name}</span>
      <span class="${MUTED} block truncate"
        >${r.office === null
          ? nothing
          : html`${deptName(c, r.office)} · `}${what}</span
      >
      ${want === undefined
        ? nothing
        : html`<span class="${MUTED} block truncate"
            >${translateText("gw.ui.dept.want", { what: want })}</span
          >`}
    </span>
    ${shut
      ? nothing
      : html`<span class="flex shrink-0 flex-col gap-1">
          <button
            class="${BTN} ${SMALL} text-center"
            data-gw-room-meet=${r.person}
            ?disabled=${!afford}
            @click=${() => meet(c, r.person, r.office, r.petition, r.topic)}
          >
            ${translateText("gw.ui.dept.meet")}
          </button>
          <button
            class="${BTN} ${SMALL} text-center"
            data-gw-room-away=${r.person}
            @click=${() => c.send({ kind: "turn_away", person: r.person })}
          >
            ${translateText("gw.ui.dept.turn_away")}
          </button>
        </span>`}
  </div>`;
}

/** 접견실: who waits, as the vacancy box looks. On the desk and on 사람. */
export function roomBox(c: GwCtx): TemplateResult | typeof nothing {
  const rows = c.seat.room ?? [];
  const away = c.seat.time?.away === true;
  if (rows.length === 0 && !away) return nothing;
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-2.5"
    data-gw-room
  >
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${translateText("gw.ui.dept.room_title")}</h3>
      <span class="ml-auto">${timeChip(c)}</span>
    </div>
    <p class=${MUTED}>
      ${translateText(away ? "gw.ui.dept.room_shut" : "gw.ui.dept.room_hint")}
    </p>
    ${rows.map((r) => roomRow(c, r))}
  </section>`;
}

/** The department's mark on a desk card: who brings it, and why. */
export function deptChips(
  c: GwCtx,
  card: GwCardView,
): TemplateResult | typeof nothing {
  const d = card.dept;
  if (d === undefined) return nothing;
  return html`<span class=${CHIP} data-gw-dept-chip=${d.office}
      >${deptName(c, d.office)}</span
    >${d.counter
      ? html`<span class=${CHIP} data-gw-dept-counter
          >${translateText("gw.ui.dept.counter")}</span
        >`
      : nothing}${d.waited > 0
      ? html`<span class=${CHIP} data-gw-dept-waited
          >${translateText("gw.ui.dept.waited")}</span
        >`
      : nothing}`;
}

/** The stamp a department's band puts over the scene's own. */
export function cardStamp(card: GwCardView): GwCardView["stamp"] {
  return card.dept?.stamp ?? card.stamp;
}

/** Who brings a paper, under its title in the reader. */
export function deptLine(
  c: GwCtx,
  card: GwCardView,
): TemplateResult | typeof nothing {
  const d = card.dept;
  if (d === undefined) return nothing;
  const lines = [
    translateText(
      d.initiative ? "gw.ui.dept.line_own" : "gw.ui.dept.line_task",
      {
        dept: deptName(c, d.office),
        who: personName(c.pack, d.by),
        what: d.row === null ? "" : taskName(c, d.row, d.topic),
      },
    ),
  ];
  if (d.rival !== null && !d.counter) {
    lines.push(
      translateText("gw.ui.dept.line_rival", {
        dept: deptName(c, d.rival.office),
        who: personName(c.pack, d.rival.by),
      }),
    );
  }
  return html`<div class="space-y-0.5" data-gw-dept-line>
    ${lines.map((l) => html`<p class=${MUTED}>${l}</p>`)}
  </div>`;
}

/** "외무부 안 · 확신" beside the department's option, and the rival's on his. */
export function optionMarks(
  c: GwCtx,
  card: GwCardView,
  option: string,
): TemplateResult | typeof nothing {
  const d = card.dept;
  if (d === undefined) return nothing;
  const own = d.option === option;
  const rival = d.rival !== null && d.rival.option === option;
  if (!own && !rival) return nothing;
  return html`<span class="flex flex-wrap gap-1 pl-1">
    ${own
      ? html`<span class=${CHIP} data-gw-dept-option=${option}
          >${translateText("gw.ui.dept.option", {
            dept: deptName(c, d.office),
          })}
          ·
          ${translateText(
            `gw.ui.dept.confidence.${Math.min(3, Math.max(1, d.confidence))}`,
          )}</span
        >`
      : nothing}
    ${rival && d.rival !== null
      ? html`<span class=${CHIP} data-gw-dept-rival-option=${option}
          >${translateText("gw.ui.dept.option", {
            dept: deptName(c, d.rival.office),
          })}</span
        >`
      : nothing}
  </span>`;
}

/** The signature's words on a department's paper: accept, or overrule. */
export function signWord(card: GwCardView, option: string): string {
  const d = card.dept;
  if (d === undefined || d.option === null) return translateText("gw.ui.sign");
  return translateText(
    d.option === option ? "gw.ui.dept.accept" : "gw.ui.dept.overrule",
  );
}

/** 다른 부서에 맡긴다 and 묵혀 둔다, under the options of a department's paper. */
export function deptVerdicts(
  c: GwCtx,
  card: GwCardView,
  close: () => void,
): TemplateResult | typeof nothing {
  const d = card.dept;
  if (d === undefined) return nothing;
  const open = c.ui.passOpen === card.uid;
  const others = (c.seat.depts ?? []).filter(
    (x) => x.office !== d.office && x.head !== null,
  );
  return html`<div class="space-y-1" data-gw-dept-verdicts>
    <div class="flex flex-wrap gap-1">
      ${others.length === 0
        ? nothing
        : html`<button
            class="${open ? BTN_ON : BTN} ${SMALL}"
            data-gw-pass-open
            @click=${() => {
              c.ui.passOpen = open ? null : card.uid;
              c.redraw();
            }}
          >
            ${translateText("gw.ui.dept.pass_on")}
          </button>`}
      <button
        class="${BTN} ${SMALL}"
        data-gw-shelve
        @click=${() => {
          c.send({ kind: "shelve", card: card.uid });
          close();
        }}
      >
        ${translateText("gw.ui.dept.shelve")}
      </button>
    </div>
    ${open
      ? html`<div class="flex flex-wrap gap-1 pl-1">
          ${others.map(
            (x) =>
              html`<button
                class="${BTN} ${SMALL}"
                data-gw-pass-to=${x.office}
                ?disabled=${x.task !== null}
                @click=${() => {
                  c.send({ kind: "pass_on", card: card.uid, office: x.office });
                  c.ui.passOpen = null;
                  close();
                }}
              >
                ${deptName(c, x.office)}
              </button>`,
          )}
        </div>`
      : nothing}
  </div>`;
}

/** Gifts the ruler can give this person now: one each a chapter. */
export function giftButtons(
  c: GwCtx,
  person: string,
): TemplateResult | typeof nothing {
  const rows = (c.seat.levers ?? []).filter((l) => l.people.includes(person));
  if (rows.length === 0) return nothing;
  return html`<div class="space-y-1" data-gw-gifts>
    <div class=${MUTED}>${translateText("gw.ui.dept.gifts")}</div>
    ${rows.map((l) => {
      const text = c.pack?.depts?.levers?.[l.row];
      return html`<div class="space-y-0.5">
        <button
          class="${BTN} w-full"
          data-gw-gift=${l.row}
          @click=${() => c.send({ kind: "gift", row: l.row, person })}
        >
          ${text?.name ?? translateText(`gw.ui.dept.lever.${l.lever}`)}
        </button>
        ${text?.note === undefined
          ? nothing
          : html`<p class="${MUTED} pl-1">${rich(c, text.note)}</p>`}
      </div>`;
    })}
  </div>`;
}

/**
 * A head's briefing, in the talk's column: his face, a line in his voice, then
 * each paper he laid on the desk as its desk card. `box` draws one.
 */
export function briefingView(
  c: GwCtx,
  box: (card: GwCardView) => TemplateResult,
): TemplateResult | typeof nothing {
  const who = c.ui.briefing ?? null;
  if (who === null) return nothing;
  const papers = c.seat.desk.filter((x) => x.dept?.by === who);
  const office =
    papers.find((x) => !x.dept!.counter)?.dept?.office ??
    c.seat.people.find((p) => p.id === who)?.office ??
    null;
  const d = (c.seat.depts ?? []).find((x) => x.office === office);
  const asked = papers.some((x) => x.dept?.row !== null);
  const topic = papers.find((x) => x.dept?.topic !== null)?.dept?.topic ?? null;
  const said = deptVoice(c, d, asked ? "bring" : "initiative", topic);
  const name = personName(c.pack, who);
  const leave = () => {
    c.ui.briefing = null;
    c.redraw();
  };
  return html`<div
    data-gw-briefing=${who}
    class="pointer-events-auto fixed inset-0 z-[999] overflow-y-auto bg-gradient-to-b from-black/65 via-black/75 to-black/90 text-white"
    @click=${(e: Event) => e.target === e.currentTarget && leave()}
  >
    <div
      class="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-4 px-4 pb-8 pt-14"
    >
      <header class="flex items-center gap-4" data-gw-plate>
        ${face(c, who, "h-16 w-16")}
        <div class="min-w-0">
          <h2 class="text-xl font-bold leading-tight" data-gw-who>${name}</h2>
          <div class="text-sm text-white/70">
            ${office === null ? nothing : deptName(c, office)}
          </div>
        </div>
      </header>
      ${said === null
        ? nothing
        : html`<p
            class="border-l-2 border-amber-200/40 pl-3 text-[16px] leading-8 text-white/90"
            data-gw-brief-says
          >
            ${rich(c, said)}
          </p>`}
      ${papers.length === 0
        ? html`<p class=${MUTED} data-gw-brief-empty>
            ${translateText("gw.ui.dept.brief_empty")}
          </p>`
        : papers.map((p) => box(p))}
      ${giftButtons(c, who)}
      <button class="${BTN} self-center" data-gw-brief-leave @click=${leave}>
        ${translateText("gw.ui.dept.brief_leave")}
      </button>
    </div>
  </div>`;
}
