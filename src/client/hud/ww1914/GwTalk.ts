import type {
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx, GwUi, Transcript } from "./GwCtx";
import { groupReplies, trustIndex } from "./GwModel";
import { BTN, CHIP, MUTED } from "./GwStyle";
import {
  fillGw,
  optionText,
  personBio,
  personLean,
  personName,
  saysText,
  tellText,
} from "./GwText";
import { textOrNull } from "./GwTicker";

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
    t.reasons = seat.log.slice(t.logAt).map((r) => r.key);
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

function monogram(name: string): string {
  return name.replace(/\s+/g, "").slice(0, 1);
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
  const name = personName(c.pack, t.who);
  const person = c.seat.people.find((p) => p.id === t.who);
  const lean = personLean(c.pack, t.who);
  const bio = personBio(c.pack, t.who);
  const trust = person === undefined ? 3 : trustIndex(person.trust);
  const leave = () => {
    c.ui.talkUid = null;
    if (t.closed) c.ui.talks.delete(t.uid);
    c.redraw();
  };
  const groups = card === undefined ? [] : groupReplies(card.replies);
  return html`<div
    data-gw-talk=${t.scene}
    class="pointer-events-auto fixed inset-0 z-[1001] overflow-y-auto bg-gradient-to-b from-black/50 via-black/70 to-black/85 text-white"
  >
    <div
      class="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-4 pb-8 pt-14"
    >
      <header class="flex items-center gap-4">
        <div
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl font-bold"
          aria-hidden="true"
        >
          ${monogram(name)}
        </div>
        <div class="min-w-0">
          <h2 class="text-xl font-bold leading-tight" data-gw-who>${name}</h2>
          <div class="text-sm text-white/70">
            ${person?.office === null || person === undefined
              ? nothing
              : translateText(`gw.office.${person.office}`)}
            ${lean === "" ? nothing : html`<span> · ${lean}</span>`}
          </div>
          <div class="${MUTED} mt-0.5" data-gw-trust>
            ${translateText("gw.ui.trust_label")}:
            ${translateText(`gw.ui.trust.${trust}`)}
          </div>
        </div>
        <button class="${BTN} ml-auto shrink-0" data-gw-leave @click=${leave}>
          ${t.closed
            ? translateText("gw.ui.talk_done")
            : translateText("gw.ui.talk_step_out")}
        </button>
      </header>
      ${bio === "" || t.turns.length > 1
        ? nothing
        : html`<p class="${MUTED} italic">${bio}</p>`}
      <div class="flex flex-1 flex-col gap-3" data-gw-turns>
        ${t.turns.map((turn, i) => {
          const last = i === t.turns.length - 1;
          return html`<div class="space-y-2">
            <blockquote
              class="${last
                ? "animate-[gwfade_.7s_ease-out]"
                : ""} rounded-r-md border-l-4 border-amber-200/70 bg-white/8 px-4 py-3 text-[17px] leading-8 ${last
                ? "text-white"
                : "text-white/70"}"
              data-gw-says
            >
              ${fillGw(
                saysText(c.pack, turn.card),
                c.pack,
                turn.card,
                c.seat,
                c.data.date,
              )}
            </blockquote>
            ${turn.reply === null
              ? nothing
              : html`<div class="ml-auto max-w-[85%] space-y-1 text-right">
                  <p
                    class="rounded-l-md border-r-4 border-sky-300/70 bg-sky-300/10 px-4 py-2 text-[15px] leading-7 text-white/85"
                  >
                    ${fillGw(
                      optionText(c.pack, turn.card, turn.reply),
                      c.pack,
                      turn.card,
                      c.seat,
                      c.data.date,
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
      ${t.closed
        ? html`<div
            class="space-y-1 rounded border border-white/15 bg-black/30 p-3"
            data-gw-after
          >
            <div class=${MUTED}>${translateText("gw.ui.talk_ended")}</div>
            ${t.reasons
              .flatMap((k) => textOrNull(`gw.reason.${k}`) ?? [])
              .map((r) => html`<p class="text-sm text-white/80">${r}</p>`)}
          </div>`
        : t.turns[t.turns.length - 1]?.reply !== null
          ? html`<p class="${MUTED} animate-pulse" data-gw-waiting>
              ${translateText("gw.ui.talk_waiting", { name })}
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
                          <span class="${CHIP} mr-2"
                            >${translateText(`gw.ui.stance.${r.stance}`)}</span
                          >${fillGw(text, c.pack, card!, c.seat, c.data.date)}
                          ${r.tell.length === 0
                            ? nothing
                            : html`<span class="mt-1 flex flex-wrap gap-1"
                                >${r.tell.map(
                                  (x) =>
                                    html`<span class=${CHIP}
                                      >${tellText(x)}</span
                                    >`,
                                )}</span
                              >`}
                        </button>
                        ${why === undefined
                          ? nothing
                          : html`<p class="${MUTED} pl-1">${why}</p>`}
                      </div>`;
                    })}
                  </div>`,
              )}
            </div>`}
    </div>
  </div>`;
}
