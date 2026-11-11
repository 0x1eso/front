import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx, GwUi, Transcript } from "./GwCtx";
import { briefLine, pastLine, rich } from "./GwDict";
import { newPass, TextPass } from "./GwDictModel";
import { gwFace } from "./GwFace";
import { groupReplies, trustIndex } from "./GwModel";
import { officeTitle } from "./GwOffice";
import { BTN, CHIP, MUTED } from "./GwStyle";
import {
  beatOf,
  bodyPlain,
  briefText,
  cardBody,
  cardTitle,
  fillGw,
  optionText,
  pastOf,
  personBio,
  personLean,
  personName,
  reasonText,
  saysText,
  tellText,
} from "./GwText";

/**
 * Keeps one transcript per talk card: a new node adds the person's line, a
 * card that left the desk closes its transcript (the talk ended) and takes
 * the why-lines that came meanwhile. Returns true when anything changed.
 */
export function syncTranscripts(ui: GwUi, seat: GwSeatView): boolean {
  let changed = false;
  const live = new Set<number>();
  for (const card of seat.desk) {
    if (card.kind !== "talk" || card.node === null) continue;
    live.add(card.uid);
    let t = ui.talks.get(card.uid);
    if (t === undefined) {
      t = {
        uid: card.uid,
        who: card.who ?? "",
        scene: card.scene,
        cast: card.cast,
        turns: [],
        node: null,
        closed: false,
        logAt: seat.log.length,
        reasons: [],
      };
      ui.talks.set(card.uid, t);
      changed = true;
    }
    const mine = t.turns[t.turns.length - 1];
    if (
      t.node === card.node &&
      mine?.reply !== null &&
      mine?.sentAt !== undefined &&
      Date.now() - mine.sentAt > 4000
    ) {
      mine.reply = null;
      mine.sentAt = undefined;
      changed = true;
    }
    if (t.node !== card.node) {
      t.node = card.node;
      t.turns.push({ card, reply: null, tell: [] });
      changed = true;
    }
  }
  for (const t of ui.talks.values()) {
    if (live.has(t.uid) || t.closed) continue;
    t.closed = true;
    t.reasons = seat.log.slice(t.logAt);
    changed = true;
  }
  return changed;
}

/** The talk view that should show: the one asked for (open or just ended). */
export function activeTalk(c: GwCtx): {
  t: Transcript;
  card: GwCardView | undefined;
} | null {
  const uid = c.ui.talkUid;
  if (uid === null) return null;
  const t = c.ui.talks.get(uid);
  if (t === undefined) return null;
  return { t, card: c.card(uid) };
}

/** The hour passing, nobody in the room. */
const ALONE = "whitespace-pre-line text-[17px] leading-8 text-white/85";

function monogram(name: string): string {
  return name.replace(/\s+/g, "").slice(0, 1);
}

/** The person's photograph in the 64 px circle, or their initial. */
function face(c: GwCtx, who: string, name: string): TemplateResult {
  return gwFace(
    c.faces,
    who,
    translateText("gw.ui.face_alt", { name }),
    "h-16 w-16",
    html`<div
      class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl font-bold"
      aria-hidden="true"
    >
      ${monogram(name)}
    </div>`,
  );
}

/** Someone in the years before 1914: a name, and who they were then. */
function pastPlate(
  c: GwCtx,
  who: string,
  name: string,
  as: string | null,
): TemplateResult {
  return html`${face(c, who, name)}
    <div class="min-w-0">
      <h2 class="text-xl font-bold leading-tight" data-gw-who>${name}</h2>
      ${as === null
        ? nothing
        : html`<div class="text-sm text-white/70" data-gw-past-as>${as}</div>`}
    </div>`;
}

/** The date and the place in the row, above a prologue scene's title. */
function pastHead(c: GwCtx, first: GwCardView): TemplateResult {
  const { dated } = pastOf(c.pack, first, "");
  return html`<div class="text-center" data-gw-past>
    <div class="${MUTED} tracking-widest" data-gw-past-step>
      ${translateText("gw.ui.past_step", {
        n: first.past ?? 0,
        total: c.seat.prologue?.total ?? 0,
      })}
    </div>
    ${dated === null
      ? nothing
      : html`<div class="mt-1 text-sm text-amber-200/80" data-gw-past-date>
          ${dated}
        </div>`}
  </div>`;
}

/** Who sits across: face, name, office and lean, how they stand with you. */
function plate(
  c: GwCtx,
  who: string,
  name: string,
  lean: string,
  person: GwSeatView["people"][number] | undefined,
  trust: number,
): TemplateResult {
  const office = person?.office ?? null;
  return html`${face(c, who, name)}
    <div class="min-w-0">
      <h2 class="text-xl font-bold leading-tight" data-gw-who>${name}</h2>
      <div class="text-sm text-white/70">
        ${office === null ? nothing : officeTitle(c.seat.tag, office)}
        ${lean === ""
          ? nothing
          : html`<span>${office === null ? "" : " · "}${lean}</span>`}
      </div>
      <div class="${MUTED} mt-0.5" data-gw-trust>
        ${translateText("gw.ui.trust_label")}:
        ${translateText(`gw.ui.trust.${trust}`)}
      </div>
    </div>`;
}

/** The hour and the room before a node's words, in a big scene. */
function beat(c: GwCtx, card: GwCardView, pass: TextPass) {
  const { at, room } = beatOf(c.pack, card);
  return html`${at === null
    ? nothing
    : html`<div
        class="pt-3 text-center text-sm tracking-widest text-amber-200/80"
        data-gw-at
      >
        ${fillGw(at, c.pack, card, c.seat, c.data.date)}
      </div>`}
  ${room === null
    ? nothing
    : html`<p class="text-[15px] italic leading-7 text-white/70" data-gw-beat>
        ${rich(c, fillGw(room, c.pack, card, c.seat, c.data.date), pass)}
      </p>`}`;
}

/**
 * Sitting across from someone: the person's plate, the talk so far as it was
 * said, their line, and your replies by kind. Their reaction never shows as a
 * number; it is the next thing they say.
 */
export function talkView(
  c: GwCtx,
  t: Transcript,
  card: GwCardView | undefined,
): TemplateResult {
  const now = t.turns[t.turns.length - 1]?.card;
  const big = now?.big === true;
  // A big scene's plate is whoever is in the room; nobody, while the hour passes.
  const who = big ? (now.who ?? "") : t.who;
  const name = who === "" ? "" : personName(c.pack, who);
  const person = c.seat.people.find((p) => p.id === who);
  const lean = who === "" ? "" : personLean(c.pack, who);
  const bio = big ? "" : personBio(c.pack, t.who);
  const trust = person === undefined ? 3 : trustIndex(person.trust);
  const first = t.turns[0]?.card;
  const leave = () => {
    c.ui.talkUid = null;
    if (t.closed) {
      c.ui.talks.delete(t.uid);
      // What a big scene leaves behind comes straight after it.
      if (big) c.ui.readerUid = c.seat.desk.find((x) => x.silent)?.uid ?? null;
      // Asked from a decision: the decision comes back, as it stands now.
      const from = first?.askFrom;
      if (from !== undefined && c.seat.desk.some((x) => x.uid === from)) {
        c.ui.readerUid = from;
      }
    }
    c.redraw();
  };
  const past = first?.past !== undefined;
  // The person across the table is introduced by the plate above.
  const pass = newPass(who === "" ? [] : [who], past);
  const brief =
    first === undefined ? null : briefText(c.pack, first, c.seat, c.data.date);
  const groups = card === undefined ? [] : groupReplies(card.replies);
  return html`<div
    data-gw-talk=${t.scene}
    ?data-gw-big=${big}
    class="pointer-events-auto fixed inset-0 z-[1001] overflow-y-auto ${big
      ? "bg-black"
      : "bg-gradient-to-b from-black/65 via-black/75 to-black/90"} text-white"
  >
    <div
      class="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 px-4 pb-8 pt-14"
    >
      ${past ? pastHead(c, first) : nothing}
      ${big && first !== undefined
        ? html`<h2 class="text-center text-lg font-bold" data-gw-big-title>
            ${cardTitle(c.pack, first)}
          </h2>`
        : nothing}
      <header class="flex flex-wrap items-center gap-x-4 gap-y-2">
        ${who === ""
          ? nothing
          : html`<div
              class="flex min-w-0 flex-1 items-center gap-4 max-sm:basis-full"
              data-gw-plate
            >
              ${past
                ? pastPlate(c, who, name, pastOf(c.pack, first, who).as)
                : plate(c, who, name, lean, person, trust)}
            </div>`}
        ${past
          ? nothing
          : html`<button
              class="${BTN} ml-auto shrink-0 max-sm:ml-0"
              data-gw-leave
              @click=${leave}
            >
              ${t.closed
                ? translateText("gw.ui.talk_done")
                : translateText("gw.ui.talk_step_out")}
            </button>`}
      </header>
      ${brief === null
        ? nothing
        : past
          ? pastLine(c, brief, pass)
          : briefLine(c, brief, pass)}
      ${bio === "" || t.turns.length > 1
        ? nothing
        : html`<p class="${MUTED} italic">${rich(c, bio, pass)}</p>`}
      ${t.turns.length === 0
        ? nothing
        : html`<p class="text-[15px] leading-7 text-white/75" data-gw-room>
            ${rich(
              c,
              bodyPlain(
                fillGw(
                  cardBody(c.pack, t.turns[0].card),
                  c.pack,
                  t.turns[0].card,
                  c.seat,
                  c.data.date,
                ),
              ),
              pass,
            )}
          </p>`}
      <div class="flex flex-col gap-3" data-gw-turns>
        ${t.turns.map((turn, i) => {
          const last = i === t.turns.length - 1;
          const said = rich(
            c,
            fillGw(
              saysText(c.pack, turn.card),
              c.pack,
              turn.card,
              c.seat,
              c.data.date,
            ),
            pass,
          );
          const speaker = turn.card.who;
          return html`<div class="space-y-2">
            ${big ? beat(c, turn.card, pass) : nothing}
            ${big && speaker !== null
              ? html`<div class=${MUTED} data-gw-speaker>
                  ${personName(c.pack, speaker)}
                </div>`
              : nothing}
            ${big && speaker === null
              ? html`<p class=${ALONE} data-gw-alone>${said}</p>`
              : html`<blockquote
                  class="${last
                    ? "animate-[gwfade_.7s_ease-out]"
                    : ""} rounded-r-md border-l-4 border-amber-200/70 bg-white/8 px-4 py-3 text-[17px] leading-8 ${last
                    ? "text-white"
                    : "text-white/70"}"
                  data-gw-says
                >
                  ${said}
                </blockquote>`}
            ${turn.reply === null
              ? nothing
              : html`<div class="ml-auto max-w-[85%] space-y-1 text-right">
                  <p
                    class="rounded-l-md border-r-4 border-sky-300/70 bg-sky-300/10 px-4 py-2 text-[15px] leading-7 text-white/85"
                  >
                    ${rich(
                      c,
                      fillGw(
                        optionText(c.pack, turn.card, turn.reply),
                        c.pack,
                        turn.card,
                        c.seat,
                        c.data.date,
                      ),
                      pass,
                    )}
                  </p>
                  ${turn.tell.length === 0
                    ? nothing
                    : html`<div class="flex flex-wrap justify-end gap-1">
                        ${turn.tell.map(
                          (x) =>
                            html`<span class=${CHIP}>${tellText(x)}</span>`,
                        )}
                      </div>`}
                </div>`}
          </div>`;
        })}
      </div>
      ${t.closed && past
        ? html`<button
            class="${BTN} mx-auto px-6"
            data-gw-past-next
            @click=${leave}
          >
            ${translateText("gw.ui.past_next")}
          </button>`
        : t.closed
          ? html`<div
              class="space-y-1 rounded border border-white/15 bg-black/30 p-3"
              data-gw-after
            >
              <div class=${MUTED}>${translateText("gw.ui.talk_ended")}</div>
              ${t.reasons.map(
                (r) =>
                  html`<p class="text-sm text-white/80">
                    ${rich(c, reasonText(c.pack, r), pass)}
                  </p>`,
              )}
            </div>`
          : t.turns[t.turns.length - 1]?.reply !== null
            ? html`<p class="${MUTED} animate-pulse" data-gw-waiting>
                ${name === ""
                  ? translateText("gw.ui.big_waiting")
                  : translateText("gw.ui.talk_waiting", { name })}
              </p>`
            : html`<div class="space-y-3" data-gw-replies>
                ${groups.map(
                  (g) =>
                    html`<div class="space-y-1.5">
                      <div class=${MUTED}>
                        ${translateText(`gw.ui.reply.${g.kind}`)}
                      </div>
                      ${g.replies.map((r) => {
                        const text = optionText(c.pack, card!, r.id);
                        const why = r.open
                          ? undefined
                          : c.pack?.scenes[card!.scene]?.why?.[r.id];
                        return html`<div>
                          <button
                            class="${BTN} w-full"
                            data-gw-reply=${r.id}
                            ?disabled=${!r.open}
                            @click=${() => {
                              const turn = t.turns[t.turns.length - 1];
                              // A visitor can wait on the desk: what came before
                              // the first word isn't this talk's doing.
                              if (t.turns.length === 1) {
                                t.logAt = c.seat.log.length;
                              }
                              turn.reply = r.id;
                              turn.tell = r.tell;
                              turn.sentAt = Date.now();
                              c.send({
                                kind: "reply",
                                card: card!.uid,
                                reply: r.id,
                              });
                              c.redraw();
                            }}
                          >
                            ${r.kind === "decide"
                              ? nothing
                              : html`<span class="${CHIP} mr-2"
                                  >${translateText(
                                    `gw.ui.stance.${r.stance}`,
                                  )}</span
                                >`}${rich(
                              c,
                              fillGw(text, c.pack, card!, c.seat, c.data.date),
                              pass,
                            )}
                          </button>
                          ${why === undefined
                            ? nothing
                            : html`<p class="${MUTED} pl-1">
                                ${rich(c, why, pass)}
                              </p>`}
                        </div>`;
                      })}
                    </div>`,
                )}
              </div>`}
    </div>
  </div>`;
}
