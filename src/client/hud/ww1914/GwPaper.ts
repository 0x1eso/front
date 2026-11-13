// Great War 1914 (ww196): the departments' and the honours' desk papers
// (`card.paper`): the answer (답신) with what was found and the courses, the
// question back, a stalled task, 부서 소식, the 서훈 명단 with the 서훈식
// picker, a 서훈 상신. Drawn in the existing reader and desk card: no new look.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_LINES,
  GW_THEATRES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCourseView,
  GwNeed,
  GwPaperView,
  GwSlots,
  GwSlotValue,
} from "@openfront/engine-api/ww1914/GwDepts";
import { GW_ANSWER_REDOS } from "@openfront/engine-api/ww1914/GwDeptWords";
import type { GwCardView } from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import {
  canSpend,
  deptName,
  pushButtons,
  stallText,
  taskName,
  topicWord,
} from "./GwDept";
import { grainChip, grainLine } from "./GwDiary";
import { rich } from "./GwDict";
import { officeTitle } from "./GwOffice";
import { BTN, BTN_ON, CHIP, MUTED } from "./GwStyle";
import { country, frontLine, personName } from "./GwText";

const SMALL = "!px-2 !py-1";
export const SIGN =
  "w-full rounded border border-amber-300 bg-amber-300/90 px-3 py-2 text-center text-sm font-bold text-slate-900 hover:bg-amber-200 disabled:opacity-40";
const SECTION = "space-y-1 border-t border-white/10 pt-2";

type Paper<F extends GwPaperView["form"]> = Extract<GwPaperView, { form: F }>;

/** A slot's value in words: a country, a person, a front, a line, a word. */
export function slotWord(c: GwCtx, v: GwSlotValue): string {
  return v.value
    .split(",")
    .map((x) => {
      switch (v.kind) {
        case "tag":
          return country(x);
        case "person":
          return personName(c.pack, x);
        case "theatre":
          return translateText(`gw.theatre.${x}`);
        case "place": {
          const t = GW_THEATRES.find((th: GwTheatre) =>
            GW_LINES[th].includes(x),
          );
          return t === undefined ? x : frontLine(t, x);
        }
        case "word":
          return c.pack?.depts?.words?.[x] ?? x;
      }
    })
    .join(", ");
}

/** A department's line with its {who}, {topic} and {slot}s filled. */
export function fillPaper(
  c: GwCtx,
  text: string,
  p: { by?: string; topic?: string | null; slots?: GwSlots },
): string {
  return applyJosa(
    text.replace(/\{([a-z_]+)\}/g, (whole, key: string) => {
      if (key === "who")
        return p.by === undefined ? whole : personName(c.pack, p.by);
      if (key === "topic") return topicWord(c, p.topic ?? null);
      const v = p.slots?.[key as keyof GwSlots];
      if (v !== undefined) return slotWord(c, v);
      // A paper without that slot (a question, a stall) names its topic.
      if ((key === "country" || key === "front") && p.topic !== undefined) {
        return p.topic === null ? whole : topicWord(c, p.topic);
      }
      return whole;
    }),
  );
}

const honourName = (c: GwCtx, id: string) =>
  c.pack?.depts?.honours?.[id]?.name ?? id;

/** The paper's heading in place of its stub scene's title. */
export function paperTitle(c: GwCtx, card: GwCardView): string | null {
  const p = card.paper;
  if (p === undefined) return null;
  switch (p.form) {
    case "answer": {
      const title = c.pack?.depts?.answers?.[p.rows[0] ?? ""]?.title;
      return title === undefined
        ? taskName(c, null, p.topic, p.type)
        : fillPaper(c, title, p);
    }
    case "question":
    case "stall":
      return translateText(`gw.ui.dept.paper_title.${p.form}`, {
        what: taskName(c, null, p.topic, p.type),
      });
    case "news":
      return null;
    case "honours":
      return translateText("gw.ui.dept.paper_title.honours", {
        what: c.pack?.depts?.occasions?.[p.row]?.name ?? "",
      });
    case "petition":
      return translateText("gw.ui.dept.paper_title.petition", {
        who: personName(c.pack, p.person),
      });
  }
}

function questionLine(c: GwCtx, p: Paper<"question">): string {
  const own = c.pack?.depts?.questions?.[p.q];
  return own === undefined
    ? translateText(`gw.ui.dept.question.${p.q}`)
    : fillPaper(c, own, p);
}

function stallLine(c: GwCtx, p: Paper<"stall">): string {
  return stallText(c, p.reason, p.by, p.topic);
}

function newsLine(c: GwCtx, l: Paper<"news">["lines"][number]): string {
  const own =
    l.row === null
      ? undefined
      : c.pack?.depts?.answers?.[l.row]?.stages?.[l.stage];
  const said =
    own === undefined
      ? applyJosa(
          translateText(`gw.ui.dept.stage_line.${l.stage}`, {
            what: taskName(c, null, l.topic, l.type),
          }),
        )
      : fillPaper(c, own, l);
  return `${deptName(c, l.office)}: ${said}`;
}

function petitionLine(c: GwCtx, p: Paper<"petition">): string {
  return applyJosa(
    translateText("gw.ui.dept.petition_line", {
      dept: deptName(c, p.office),
      who: personName(c.pack, p.by),
      person: personName(c.pack, p.person),
      honour: honourName(c, p.honour),
    }),
  );
}

function findingText(c: GwCtx, p: Paper<"answer">, row: string, id: string) {
  const t = c.pack?.depts?.answers?.[row]?.findings?.[id];
  return t === undefined ? null : fillPaper(c, t, p);
}

/** What the desk card shows of a paper, in place of the stub's body. */
export function paperGist(c: GwCtx, card: GwCardView): string | null {
  const p = card.paper;
  if (p === undefined) return null;
  switch (p.form) {
    case "answer": {
      const f = p.findings[0];
      return f === undefined ? null : findingText(c, p, f.row, f.id);
    }
    case "question":
      return questionLine(c, p);
    case "stall":
      return stallLine(c, p);
    case "news":
      return p.lines
        .slice(0, 2)
        .map((l) => newsLine(c, l))
        .join(" ");
    case "honours":
      return translateText("gw.ui.dept.honours_gist", {
        names: p.entries.map((e) => entryName(c, e.person)).join(", "),
      });
    case "petition":
      return petitionLine(c, p);
  }
}

/** The chip a desk card of a paper carries beside its kind. */
export function paperChips(
  c: GwCtx,
  card: GwCardView,
): TemplateResult | typeof nothing {
  const p = card.paper;
  if (p === undefined) return nothing;
  const office = "office" in p ? p.office : null;
  return html`<span class=${CHIP} data-gw-paper-form=${p.form}
      >${translateText(`gw.ui.dept.form.${p.form}`)}</span
    >${office === null
      ? nothing
      : html`<span class=${CHIP} data-gw-dept-chip=${office}
          >${deptName(c, office)}</span
        >`}`;
}

/** Whether a paper asks for a word (all but 부서 소식). */
export function paperDecides(card: GwCardView): boolean {
  return card.paper !== undefined && card.paper.form !== "news";
}

const entryName = (c: GwCtx, person: string | null) =>
  person === null
    ? translateText("gw.ui.dept.honour_soldier")
    : personName(c.pack, person);

function needText(c: GwCtx, n: GwNeed): string {
  const what =
    n.kind === "consent"
      ? n.tag === undefined
        ? ""
        : country(n.tag)
      : n.kind === "bill"
        ? n.law === undefined
          ? ""
          : (c.pack?.scenes[`gw_law_${n.law}`]?.title ?? n.law)
        : n.kind === "person"
          ? n.office === undefined
            ? ""
            : officeTitle(c.seat.tag, n.office)
          : n.word === undefined
            ? ""
            : (c.pack?.depts?.words?.[n.word] ?? n.word);
  return translateText(`gw.ui.dept_need_${n.kind}`, { what });
}

function courseBox(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"answer">,
  o: GwCourseView,
): TemplateResult {
  const text = c.pack?.depts?.answers?.[o.row]?.courses?.[o.id];
  const armed = c.ui.armed?.uid === card.uid && c.ui.armed.option === o.id;
  const fill = (t: string) => rich(c, fillPaper(c, t, p));
  // ww197: against his grain it costs a nerve; with none left, his own line.
  const locked = o.locked === true;
  const why = locked ? grainLine(c, o) : undefined;
  return html`<div class="space-y-0.5" data-gw-course=${o.id}>
    <button
      class="${armed ? BTN_ON : BTN} w-full"
      data-gw-course-pick=${o.id}
      ?disabled=${locked}
      @click=${() => {
        c.ui.armed = armed ? null : { uid: card.uid, option: o.id };
        c.ui.backOpen = false;
        c.ui.redoArmed = null;
        c.redraw();
      }}
    >
      <b>${text === undefined ? o.id : fill(text.name)}</b>
    </button>
    ${locked ? nothing : grainChip(o)}
    ${why === undefined
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-why>${rich(c, why)}</p>`}
    ${o.own || o.by !== p.office
      ? html`<div class="flex flex-wrap gap-1 pl-1">
          <span class=${CHIP} data-gw-course-by=${o.by}
            >${o.own
              ? translateText("gw.ui.dept.course_own")
              : translateText("gw.ui.dept.option", {
                  dept: deptName(c, o.by),
                })}</span
          >
        </div>`
      : nothing}
    <p class="pl-1 text-sm text-white/80" data-gw-course-for>
      <span class=${MUTED}>${translateText("gw.ui.dept.course_for")}</span>
      ${o.for && text !== undefined
        ? fill(text.for)
        : html`<span class=${MUTED}
            >${translateText("gw.ui.dept.course_unsaid")}</span
          >`}
    </p>
    <p class="pl-1 text-sm text-white/80" data-gw-course-against>
      <span class=${MUTED}>${translateText("gw.ui.dept.course_against")}</span>
      ${o.against && text !== undefined
        ? fill(text.against)
        : html`<span class=${MUTED}
            >${translateText("gw.ui.dept.course_unsaid")}</span
          >`}
    </p>
    ${o.needs.length === 0
      ? nothing
      : html`<p class="${MUTED} pl-1" data-gw-course-needs>
          ${translateText("gw.ui.dept.needs")}
          ${o.needs.map((n) => needText(c, n)).join(" · ")}
        </p>`}
  </div>`;
}

function answerBody(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"answer">,
  close: () => void,
): TemplateResult {
  const armed = p.courses.find(
    (o) => c.ui.armed?.uid === card.uid && c.ui.armed.option === o.id,
  );
  return html`<div class="space-y-2" data-gw-answer>
    <div class=${SECTION} data-gw-findings>
      <div class=${MUTED}>${translateText("gw.ui.dept.findings")}</div>
      ${p.findings.map((f) => {
        const t = findingText(c, p, f.row, f.id);
        return html`<p
          class="text-sm text-white/85"
          data-gw-finding=${f.id}
          data-gw-conf=${f.conf}
        >
          <span class="${CHIP} mr-1"
            >${translateText(`gw.ui.dept.conf.${f.conf}`)}</span
          >${f.late === true
            ? html`<span class="${CHIP} mr-1"
                >${translateText("gw.ui.dept.finding_late")}</span
              >`
            : nothing}${t === null ? f.id : rich(c, t)}
        </p>`;
      })}
    </div>
    <div class=${SECTION} data-gw-courses>
      <div class=${MUTED}>${translateText("gw.ui.dept.courses")}</div>
      ${p.courses.map((o) => courseBox(c, card, p, o))}
      ${armed === undefined
        ? nothing
        : html`<button
            class=${SIGN}
            data-gw-sign
            @click=${() => {
              c.send({
                kind: "answer",
                card: card.uid,
                course: armed.id,
                redo: null,
              });
              close();
            }}
          >
            ${translateText(
              armed.own ? "gw.ui.dept.accept" : "gw.ui.dept.course_take",
            )}
          </button>`}
    </div>
    ${p.waited > 0
      ? html`<p class=${MUTED} data-gw-answer-waited>
          ${applyJosa(
            translateText("gw.ui.dept.answer_waited", {
              dept: deptName(c, p.office),
            }),
          )}
        </p>`
      : nothing}
    <div class=${SECTION}>
      ${p.called
        ? html`<p class=${MUTED} data-gw-called>
            ${applyJosa(
              translateText("gw.ui.dept.called", {
                who: personName(c.pack, p.by),
              }),
            )}
          </p>`
        : html`<button
            class="${BTN} w-full"
            data-gw-call=${card.uid}
            ?disabled=${!canSpend(c, "call")}
            @click=${() => {
              c.send({ kind: "call", card: card.uid });
              c.ui.summoned = Date.now();
              close();
            }}
          >
            ${applyJosa(
              translateText("gw.ui.dept.call", {
                who: personName(c.pack, p.by),
              }),
            )}
          </button>`}
      ${redoControl(c, card, p, close)}
    </div>
  </div>`;
}

/** 다시 써 오시오: 더 알아봐라, 다른 안을 가져와라. */
function redoControl(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"answer">,
  close: () => void,
): TemplateResult | typeof nothing {
  const dirs = GW_ANSWER_REDOS.filter((r) => p.redo.includes(r));
  if (dirs.length === 0) return nothing;
  const { ui } = c;
  const armed = ui.redoArmed ?? null;
  return html`<div class="space-y-1" data-gw-redo>
    <button
      class="${ui.backOpen ? BTN_ON : BTN} w-full"
      data-gw-redo-open
      @click=${() => {
        ui.backOpen = !ui.backOpen;
        ui.redoArmed = null;
        ui.armed = null;
        c.redraw();
      }}
    >
      ${translateText("gw.back.open")}
    </button>
    ${ui.backOpen
      ? html`${dirs.map(
          (d) =>
            html`<button
              class="${armed === d ? BTN_ON : BTN} w-full"
              data-gw-redo-dir=${d}
              @click=${() => {
                ui.redoArmed = armed === d ? null : d;
                c.redraw();
              }}
            >
              ${translateText(`gw.ui.dept.redo.${d}`)}
            </button>`,
        )}
        ${armed === null
          ? nothing
          : html`<button
              class=${SIGN}
              data-gw-redo-go
              @click=${() => {
                c.send({
                  kind: "answer",
                  card: card.uid,
                  course: null,
                  redo: armed,
                });
                ui.backOpen = false;
                ui.redoArmed = null;
                close();
              }}
            >
              ${translateText("gw.back.go")}
            </button>`}`
      : nothing}
  </div>`;
}

function pickWord(c: GwCtx, p: Paper<"question">, pick: string): string {
  if (p.q === "person") return personName(c.pack, pick);
  return (
    c.pack?.depts?.picks?.[pick] ?? translateText(`gw.ui.dept.pick.${pick}`)
  );
}

function questionBody(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"question">,
  close: () => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-question=${p.q}>
    <p class="text-[15px] leading-7 text-white/90">
      ${rich(c, questionLine(c, p))}
    </p>
    ${p.picks.map(
      (pick) =>
        html`<button
          class="${BTN} w-full"
          data-gw-reply-pick=${pick}
          @click=${() => {
            c.send({ kind: "dept_reply", card: card.uid, pick });
            close();
          }}
        >
          ${pickWord(c, p, pick)}
        </button>`,
    )}
    ${p.lean === null
      ? nothing
      : html`<p class=${MUTED} data-gw-question-lean>
          ${applyJosa(
            translateText("gw.ui.dept.lean_pick", {
              who: personName(c.pack, p.by),
              what: pickWord(c, p, p.lean),
            }),
          )}
        </p>`}
  </div>`;
}

function stallBody(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"stall">,
  close: () => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-stall=${p.reason}>
    <p class="text-[15px] leading-7 text-white/90">
      ${rich(c, stallLine(c, p))}
    </p>
    ${pushButtons(c, p.office, p.by, p.pushes, close)}
  </div>`;
}

function newsBody(c: GwCtx, p: Paper<"news">): TemplateResult {
  return html`<div class="space-y-1" data-gw-news>
    ${p.lines.map(
      (l) =>
        html`<p
          class="text-sm text-white/85"
          data-gw-news-line=${l.office}
          data-gw-stage=${l.stage}
        >
          ${rich(c, newsLine(c, l))}
        </p>`,
    )}
  </div>`;
}

/** The picks of the 서훈식: the proposer's honour first, or none. */
function honourPicks(c: GwCtx, card: GwCardView, p: Paper<"honours">) {
  const ui = c.ui;
  if (ui.honourPick?.uid !== card.uid) {
    ui.honourPick = { uid: card.uid, picks: p.entries.map((e) => e.honour) };
  }
  return ui.honourPick;
}

function honoursBody(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"honours">,
  close: () => void,
): TemplateResult {
  const picks = honourPicks(c, card, p);
  const note = c.pack?.depts?.occasions?.[p.row]?.note;
  const give = picks.picks.flatMap((h, at) =>
    h === null ? [] : [{ at, honour: h }],
  );
  return html`<div class="space-y-2" data-gw-honours=${p.row}>
    ${note === undefined
      ? nothing
      : html`<p class="text-sm text-white/80">${rich(c, note)}</p>`}
    ${p.entries.map((e, at) => {
      const picked = picks.picks[at] ?? null;
      return html`<div class=${SECTION} data-gw-honour-entry=${at}>
        <p class="text-sm font-bold">${entryName(c, e.person)}</p>
        <p class=${MUTED}>
          ${translateText(`gw.ui.dept.honour_pool.${e.pool}`)} ·
          ${translateText("gw.ui.dept.honour_proposed", {
            dept: deptName(c, e.from),
            honour: honourName(c, e.honour),
          })}
        </p>
        <div class="flex flex-wrap gap-1">
          ${[...p.orders, null].map(
            (h) =>
              html`<button
                class="${picked === h ? BTN_ON : BTN} ${SMALL}"
                data-gw-honour-pick=${h ?? "none"}
                title=${h === null
                  ? ""
                  : (c.pack?.depts?.honours?.[h]?.note ?? "")}
                @click=${() => {
                  picks.picks[at] = h;
                  c.redraw();
                }}
              >
                ${h === null
                  ? translateText("gw.ui.dept.honour_none")
                  : honourName(c, h)}
              </button>`,
          )}
        </div>
      </div>`;
    })}
    <p class=${MUTED} data-gw-honours-until>
      ${translateText(
        p.until > c.data.chapter
          ? "gw.ui.dept.honours_until_next"
          : "gw.ui.dept.honours_until_now",
      )}
    </p>
    <button
      class=${SIGN}
      data-gw-honours-hold
      ?disabled=${!canSpend(c, "honours")}
      @click=${() => {
        c.send({ kind: "honours", card: card.uid, give });
        c.ui.honourPick = null;
        close();
      }}
    >
      ${translateText("gw.ui.dept.honours_hold")}
    </button>
  </div>`;
}

function petitionBody(
  c: GwCtx,
  card: GwCardView,
  p: Paper<"petition">,
  close: () => void,
): TemplateResult {
  return html`<div class="space-y-1.5" data-gw-petition>
    <p class="text-[15px] leading-7 text-white/90">
      ${rich(c, petitionLine(c, p))}
    </p>
    ${p.answers.map(
      (a) =>
        html`<button
          class="${BTN} w-full"
          data-gw-petition-answer=${a}
          @click=${() => {
            c.send({ kind: "petition_answer", card: card.uid, answer: a });
            close();
          }}
        >
          ${translateText(`gw.ui.dept.petition.${a}`)}
        </button>`,
    )}
  </div>`;
}

/** Who wrote it, under the title: "외무부의 야고가 올린 답신 · <일>". */
function paperFrom(c: GwCtx, p: GwPaperView): TemplateResult | typeof nothing {
  if (!("by" in p) || !("type" in p)) return nothing;
  return html`<p class=${MUTED} data-gw-paper-from>
    ${applyJosa(
      translateText(`gw.ui.dept.paper_from.${p.form}`, {
        dept: deptName(c, p.office),
        who: personName(c.pack, p.by),
        what: taskName(c, null, p.topic, p.type),
      }),
    )}
  </p>`;
}

/** The reader's body for a paper: its sections and its own verdicts. */
export function paperBody(
  c: GwCtx,
  card: GwCardView,
  close: () => void,
): TemplateResult | typeof nothing {
  const p = card.paper;
  if (p === undefined) return nothing;
  const body = (() => {
    switch (p.form) {
      case "answer":
        return answerBody(c, card, p, close);
      case "question":
        return questionBody(c, card, p, close);
      case "stall":
        return stallBody(c, card, p, close);
      case "news":
        return newsBody(c, p);
      case "honours":
        return honoursBody(c, card, p, close);
      case "petition":
        return petitionBody(c, card, p, close);
    }
  })();
  return html`${paperFrom(c, p)} ${body}`;
}
