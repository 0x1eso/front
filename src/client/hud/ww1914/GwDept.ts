// Great War 1914 (ww193, ww196): departments at work on the screens. 사람 ›
// 부서 with the work under way and the 할 일 markers, the audience room
// (접견실: petitioners, heads to call, people who press), the department's mark
// on a paper, the one time pool. ww196: nothing is briefed and nothing is
// given as a gift; the papers come to the desk (GwPaper). Existing boxes only.
import type { GwOffice } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_THEATRES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwDeptMoment,
  GwDeptView,
  GwRoomRowView,
  GwStallReason,
  GwTaskOfferView,
  GwTaskPush,
  GwTaskType,
  GwTodoView,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwCardView } from "@openfront/engine-api/ww1914/GwView";
import { GW_TIME_PRICES } from "@openfront/engine-lib/ww1914/TaskRows";
import { html, nothing, TemplateResult } from "lit";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { rich } from "./GwDict";
import { gwFace } from "./GwFace";
import { topicLabel } from "./GwModel";
import { lawTitle } from "./GwMoneyWords";
import { officeTitle } from "./GwOffice";
import { paperTitle } from "./GwPaper";
import { openCard } from "./GwPlaceSheet";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import { cardTitle, country, personName, shortDate } from "./GwText";

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
  const named = translateText(`gw.country.${topic}`);
  if (named !== `gw.country.${topic}`) return named;
  if ((GW_THEATRES as readonly string[]).includes(topic)) {
    return translateText(`gw.theatre.${topic}`);
  }
  // ww203: a count task's topic is a bill (law id); ww213: a money bill too.
  return lawTitle(c, topic);
}

/**
 * How a task reads, with its topic filled in: the row's own name, else its
 * type's ("{topic}에 대한 방침"), else a plain "{topic}에 관한 일".
 */
export function taskName(
  c: GwCtx,
  row: string | null,
  topic: string | null,
  type?: GwTaskType | null,
  /** A picker with a topic still to choose: the blank shows as "…". */
  blank = false,
): string {
  // No topic picked yet: a blank to fill, as the schedule's pickers leave one.
  // A task with no topic at all (the war plans in peace) just drops it.
  const word = topic === null ? (blank ? "…" : "") : topicWord(c, topic);
  const name =
    (row === null ? undefined : c.pack?.depts?.tasks?.[row]?.name) ??
    (type === undefined || type === null
      ? undefined
      : c.pack?.depts?.types?.[type]?.name) ??
    (row === null && (type === undefined || type === null)
      ? translateText("gw.ui.dept.passed_work")
      : topic === null
        ? translateText("gw.ui.dept.task_plain")
        : translateText("gw.ui.dept.task_any", { topic: "{topic}" }));
  return topic === null && !blank
    ? name.replace(/\{topic\}\s*/g, "").trim()
    : name.split("{topic}").join(word);
}

/** A task's note, the row's own or its type's. */
function taskNote(c: GwCtx, o: GwTaskOfferView): string | undefined {
  return (
    c.pack?.depts?.tasks?.[o.row]?.note ?? c.pack?.depts?.types?.[o.type]?.note
  );
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

/**
 * The pool can pay for this now. ww196: an audience (a petitioner, 불러서
 * 묻는다) is `petition`; the 서훈식 is `ceremony`. The room is shut on a trip.
 */
export function canSpend(c: GwCtx, what: keyof typeof GW_TIME_PRICES): boolean {
  const t = c.seat.time;
  if (t === undefined) return true;
  if (t.away && what === "petition") return false;
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

/** One status line: the work and its stage, a stall, or idle. */
function statusLine(c: GwCtx, d: GwDeptView): string {
  if (d.head === null) return translateText("gw.ui.dept.empty");
  const parts: string[] = [];
  const t = d.task;
  if (t !== null) {
    // The subject alone: the row's name is how it was offered.
    const what =
      t.topic === null
        ? taskName(c, t.row, null, t.type)
        : topicWord(c, t.topic);
    parts.push(
      translateText("gw.ui.dept.working_stage", {
        what,
        stage: translateText(`gw.ui.dept.stage.${t.stage}`),
      }),
    );
    // A stall shows once: as its 할 일 chip where there is one.
    if (t.stall !== null && !d.todo.some((x) => x.kind === "stall")) {
      parts.push(
        translateText("gw.ui.dept_todo_stall", {
          why: translateText(`gw.ui.dept.stall.${t.stall}`),
        }),
      );
    } else if (t.soon && t.stall === null) {
      parts.push(translateText("gw.ui.dept.soon"));
    }
  }
  if (d.initiatives > 0) {
    parts.push(translateText("gw.ui.dept.initiatives", { n: d.initiatives }));
  }
  if (parts.length > 0) return parts.join(" · ");
  // The muted "한가함 · 일을 맡길 수 있음" chip says it where it is sent.
  return d.todo.some((x) => x.kind === "idle")
    ? ""
    : translateText("gw.ui.dept.idle");
}

/** An amber 할 일 chip; `idle` is muted. A paper's chip opens the paper. */
const TODO =
  "inline-block rounded bg-amber-300/20 px-1.5 py-0.5 text-xs text-amber-100";

export function todoText(t: GwTodoView): string {
  return translateText(`gw.ui.dept_todo_${t.kind}`, {
    why:
      t.reason === undefined
        ? ""
        : translateText(`gw.ui.dept.stall.${t.reason}`),
  });
}

/** The 할 일 markers of a department row or a person row. */
export function todoChips(
  c: GwCtx,
  todo: readonly GwTodoView[] | undefined,
): TemplateResult | typeof nothing {
  if (todo === undefined || todo.length === 0) return nothing;
  return html`<span class="flex flex-wrap gap-1" data-gw-todos>
    ${todo.map((t) => {
      const card =
        t.card === undefined
          ? undefined
          : c.seat.desk.find((x) => x.uid === t.card);
      const cls = t.kind === "idle" ? CHIP : TODO;
      return card === undefined
        ? html`<span class=${cls} data-gw-todo=${t.kind}>${todoText(t)}</span>`
        : html`<button
            class="${cls} hover:bg-amber-300/35"
            data-gw-todo=${t.kind}
            @click=${(e: Event) => {
              e.stopPropagation();
              openCard(c, card);
            }}
          >
            ${todoText(t)}
          </button>`;
    })}
  </span>`;
}

function offerRow(c: GwCtx, d: GwDeptView, o: GwTaskOfferView): TemplateResult {
  const picked = c.ui.deptTask?.row === o.row ? c.ui.deptTask : null;
  const topic = picked?.topic ?? o.topic;
  const ready = picked !== null && (o.topics.length === 0 || topic !== null);
  return html`<div class="space-y-1" data-gw-dept-offer=${o.row}>
    <button
      class="${picked === null ? BTN : BTN_ON} w-full"
      data-gw-dept-task=${o.row}
      @click=${() => {
        c.ui.deptTask = picked === null ? { row: o.row, topic: o.topic } : null;
        c.redraw();
      }}
    >
      ${taskName(c, o.row, topic, o.type, o.topics.length > 0)}
    </button>
    ${picked === null
      ? nothing
      : html`<div class="space-y-1 pl-1">
          ${(() => {
            const note = taskNote(c, o);
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
            ${translateText("gw.ui.dept.give")}
          </button>
        </div>`}
  </div>`;
}

/** People who could be put beside a head: the seat's, not the head himself. */
function staffable(c: GwCtx, head: string): string[] {
  return c.seat.people.filter((x) => x.id !== head).map((x) => x.id);
}

/**
 * The work-under-way buttons (서두르게 한다, 사람을 붙인다, 거둔다, 기다린다,
 * 돈을 더 쓴다), on the department row and on a stall paper. 사람을 붙인다
 * opens the list of people first.
 */
export function pushButtons(
  c: GwCtx,
  office: GwOffice,
  head: string,
  pushes: readonly GwTaskPush[],
  done: () => void,
): TemplateResult | typeof nothing {
  if (pushes.length === 0) return nothing;
  const staffing = c.ui.deptStaff === office;
  return html`<div class="space-y-1" data-gw-pushes=${office}>
    <div class="flex flex-wrap gap-1">
      ${pushes.map(
        (how) =>
          html`<button
            class="${how === "staff" && staffing ? BTN_ON : BTN} ${SMALL}"
            data-gw-push=${how}
            @click=${() => {
              if (how === "staff") {
                c.ui.deptStaff = staffing ? null : office;
                c.redraw();
                return;
              }
              c.send({ kind: "task_push", office, how, person: null });
              done();
            }}
          >
            ${translateText(`gw.ui.dept.push.${how}`)}
          </button>`,
      )}
    </div>
    ${staffing
      ? html`<div class="flex flex-wrap gap-1 pl-1" data-gw-staff-list>
          ${staffable(c, head).map(
            (id) =>
              html`<button
                class="${BTN} ${SMALL}"
                data-gw-staff=${id}
                @click=${() => {
                  c.send({
                    kind: "task_push",
                    office,
                    how: "staff",
                    person: id,
                  });
                  c.ui.deptStaff = null;
                  done();
                }}
              >
                ${personName(c.pack, id)}
              </button>`,
          )}
        </div>`
      : nothing}
  </div>`;
}

/** Why the work stalled, in a line: the pack's, else the plain one. */
export function stallText(
  c: GwCtx,
  reason: GwStallReason,
  by: string,
  topic: string | null,
): string {
  const own = c.pack?.depts?.stalls?.[reason];
  if (own === undefined) {
    return translateText(`gw.ui.dept.stall_line.${reason}`);
  }
  return applyJosa(
    own
      .split("{who}")
      .join(personName(c.pack, by))
      .split("{topic}")
      .join(topicWord(c, topic)),
  );
}

/** The work under way: its stage, who is beside the head, what can be done. */
function workBox(c: GwCtx, d: GwDeptView): TemplateResult | typeof nothing {
  const t = d.task;
  if (t === null || d.head === null) return nothing;
  const head = d.head;
  return html`<div class="space-y-1" data-gw-dept-work data-gw-stage=${t.stage}>
    <p class="text-sm text-white/85">
      ${taskName(c, t.row, t.topic, t.type)} ·
      ${translateText(`gw.ui.dept.stage.${t.stage}`)}
    </p>
    ${t.stall === null
      ? nothing
      : html`<p class="text-sm text-amber-100/90" data-gw-dept-stall>
          ${rich(c, stallText(c, t.stall, head, t.topic))}
        </p>`}
    ${t.staff === null
      ? nothing
      : html`<p class=${MUTED} data-gw-dept-staff>
          ${applyJosa(
            translateText("gw.ui.dept.staffed", {
              who: personName(c.pack, t.staff),
            }),
          )}
        </p>`}
    ${t.hurried
      ? html`<p class=${MUTED}>${translateText("gw.ui.dept.hurried")}</p>`
      : nothing}
    ${pushButtons(c, d.office, head, t.pushes, () => c.redraw())}
  </div>`;
}

/** A past task: its answer's course, else its paper's title, else the task. */
function pastTitle(c: GwCtx, p: GwDeptView["past"][number]): string {
  const name = taskName(c, p.row, p.topic, p.type);
  if (p.course !== undefined && p.course !== null) {
    for (const a of Object.values(c.pack?.depts?.answers ?? {})) {
      const course = a.courses?.[p.course];
      if (course !== undefined) return `${name} · ${course.name}`;
    }
  }
  if (p.type !== undefined) return name;
  return c.pack?.scenes[p.scene]?.title ?? name;
}

function pastRows(c: GwCtx, d: GwDeptView): TemplateResult | typeof nothing {
  if (d.past.length === 0) return nothing;
  return html`<div class="space-y-0.5" data-gw-dept-past>
    <div class=${MUTED}>${translateText("gw.ui.dept.past")}</div>
    ${[...d.past].reverse().map(
      (p) =>
        html`<p class="text-sm text-white/75">
          <span class=${MUTED}>${shortDate(p.date)}</span>
          ${pastTitle(c, p)}
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
        ${(() => {
          const line = statusLine(c, d);
          return line === ""
            ? nothing
            : html`<span
                class="block truncate text-xs text-amber-100/90"
                data-gw-dept-status
                >${line}</span
              >`;
        })()}
        ${wantLine(c, d)}
      </span>
    </button>
    ${head === null ? nothing : todoChips(c, d.todo)}
    ${open && head !== null
      ? html`<div class="mt-2 space-y-2 border-t border-white/10 pt-2">
          ${d.task !== null
            ? workBox(c, d)
            : d.offers.length === 0
              ? html`<p class=${MUTED}>
                  ${translateText("gw.ui.dept.no_offers")}
                </p>`
              : html`<div class="space-y-1">
                  <div class=${MUTED}>
                    ${translateText("gw.ui.dept.offers")}
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

/** Seeing a petitioner: the summons of his topic. */
function meet(c: GwCtx, person: string, topic: string): void {
  c.send({ kind: "summon", person, topic });
  c.ui.summoned = Date.now();
  c.redraw();
}

/** What a person in the room comes for, in words. */
function roomWhat(c: GwCtx, r: GwRoomRowView): string {
  if (r.petition) {
    return translateText("gw.ui.dept.room_petition", {
      what: r.topic === undefined ? "" : topicLabel(c.pack, r.topic),
    });
  }
  const paper =
    r.call === undefined
      ? undefined
      : c.seat.desk.find((x) => x.uid === r.call);
  if (paper !== undefined) {
    return translateText("gw.ui.dept.room_call", {
      what: paperTitle(c, paper) ?? cardTitle(c.pack, paper),
    });
  }
  return translateText(
    r.press === true ? "gw.ui.dept.room_press" : "gw.ui.dept.room_waits",
  );
}

/** His wants in words: up to three, the old single one else. */
function roomWants(c: GwCtx, r: GwRoomRowView): string[] {
  const ids =
    r.wants ?? (r.want === undefined || r.want === null ? [] : [r.want]);
  return ids.slice(0, 3).flatMap((id) => {
    const text = c.pack?.depts?.wants?.[id];
    return text === undefined ? [] : [text];
  });
}

function roomRow(c: GwCtx, r: GwRoomRowView): TemplateResult {
  const name = personName(c.pack, r.person);
  const wants = roomWants(c, r);
  const shut = c.seat.time?.away === true && r.free !== true;
  const afford = r.free === true || canSpend(c, "petition");
  const topic = r.topic;
  const call = r.call;
  return html`<div
    class="flex items-center gap-2 border-t border-white/10 pt-1.5"
    data-gw-room-row=${r.person}
  >
    ${face(c, r.person, "h-9 w-9")}
    <span class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="truncate text-sm font-bold">${name}</span>
        ${r.press === true
          ? html`<span class=${TODO} data-gw-room-press
              >${translateText("gw.ui.dept_todo_asks")}</span
            >`
          : nothing}
        ${r.free === true
          ? html`<span class=${CHIP} data-gw-room-free
              >${translateText("gw.ui.dept.room_free")}</span
            >`
          : nothing}
      </span>
      <span class="${MUTED} block truncate"
        >${r.office === null
          ? nothing
          : html`${deptName(c, r.office)} · `}${roomWhat(c, r)}</span
      >
      ${wants.map(
        (w) =>
          html`<span class="${MUTED} block truncate" data-gw-room-want
            >${translateText("gw.ui.dept.want", { what: w })}</span
          >`,
      )}
    </span>
    ${shut
      ? nothing
      : html`<span class="flex shrink-0 flex-col gap-1">
          ${call !== undefined
            ? html`<button
                class="${BTN} ${SMALL} text-center"
                data-gw-room-call=${r.person}
                ?disabled=${!afford}
                @click=${() => {
                  c.send({ kind: "call", card: call });
                  c.ui.summoned = Date.now();
                  c.redraw();
                }}
              >
                ${translateText("gw.ui.dept.room_call_go")}
              </button>`
            : topic !== undefined
              ? html`<button
                  class="${BTN} ${SMALL} text-center"
                  data-gw-room-meet=${r.person}
                  ?disabled=${!afford}
                  @click=${() => meet(c, r.person, topic)}
                >
                  ${translateText("gw.ui.dept.meet")}
                </button>`
              : nothing}
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
export function roomBox(
  c: GwCtx,
  chip = true,
): TemplateResult | typeof nothing {
  const rows = c.seat.room ?? [];
  const away = c.seat.time?.away === true;
  if (rows.length === 0 && !away) return nothing;
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-2.5"
    data-gw-room
  >
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${translateText("gw.ui.dept.room_title")}</h3>
      ${chip ? html`<span class="ml-auto">${timeChip(c)}</span>` : nothing}
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
  // ww194: the work it answers, so a commission's paper says which one.
  const work =
    d.row !== null
      ? taskName(c, d.row, d.topic)
      : d.topic !== null
        ? topicWord(c, d.topic)
        : null;
  return html`<span class=${CHIP} data-gw-dept-chip=${d.office}
      >${deptName(c, d.office)}</span
    >${work === null
      ? nothing
      : html`<span class=${CHIP} data-gw-dept-work>${work}</span>`}${d.counter
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

/**
 * 다른 부서에 맡긴다 and 묵혀 둔다, under the options of a department's paper
 * or an answer (ww196).
 */
export function deptVerdicts(
  c: GwCtx,
  card: GwCardView,
  close: () => void,
): TemplateResult | typeof nothing {
  // ww196: an answer goes elsewhere or is shelved too; other papers don't.
  const office =
    card.dept?.office ??
    (card.paper?.form === "answer" ? card.paper.office : undefined);
  if (office === undefined) return nothing;
  const open = c.ui.passOpen === card.uid;
  const others = (c.seat.depts ?? []).filter(
    (x) => x.office !== office && x.head !== null,
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
