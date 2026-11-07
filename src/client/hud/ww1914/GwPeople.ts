import type { GwPersonView } from "@openfront/engine-api/ww1914/GwView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import {
  appointable,
  dismissal,
  topicLabel,
  trustIndex,
  vacantOffices,
} from "./GwModel";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import {
  personBio,
  personLean,
  personName,
  promiseText,
  shortDate,
} from "./GwText";

/** Seven pips for trust -3..3. */
function pips(trust: number): TemplateResult {
  const at = trustIndex(trust);
  return html`<span class="inline-flex gap-0.5" aria-hidden="true"
    >${Array.from({ length: 7 }, (_, i) => {
      const on = i === at;
      return html`<span
        class="h-2 w-2 rounded-full ${on ? "bg-amber-300" : "bg-white/20"}"
      ></span>`;
    })}</span
  >`;
}

/** What the seat can see of a person: a letter, an illness, their record. */
function marks(c: GwCtx, p: GwPersonView): TemplateResult | typeof nothing {
  const w = c.seat.world.people.find((x) => x.id === p.id);
  if (w === undefined) return nothing;
  const seen = w.wins + w.losses > 0;
  if (!w.letter && !w.ailing && !seen) return nothing;
  return html`<div class="mt-1 flex flex-wrap gap-1">
    ${w.letter
      ? html`<span class=${CHIP} data-gw-letter
          >${translateText("gw.ui.person_letter")}</span
        >`
      : nothing}
    ${w.ailing
      ? html`<span class=${CHIP} data-gw-ailing
          >${translateText("gw.ui.person_ailing")}</span
        >`
      : nothing}
    ${seen
      ? html`<span class=${CHIP}
          >${translateText("gw.ui.person_record", {
            wins: w.wins,
            losses: w.losses,
          })}${w.repute === 0
            ? ""
            : ` · ${translateText(`gw.ui.repute.${w.repute}`)}`}</span
        >`
      : nothing}
  </div>`;
}

function promises(c: GwCtx, id: string): TemplateResult | typeof nothing {
  const mine = (c.seat.promises ?? []).filter((x) => x.who === id);
  if (mine.length === 0) return nothing;
  return html`<div class="space-y-0.5" data-gw-promises>
    <div class=${MUTED}>${translateText("gw.ui.promises_title")}</div>
    ${mine.map(
      (x) =>
        html`<p class="text-sm text-white/80">
          ${promiseText(c.pack, x)}
          <span class=${MUTED}
            >${x.kept
              ? translateText("gw.ui.promise_kept")
              : x.broken
                ? translateText("gw.ui.promise_broken")
                : translateText("gw.ui.promise_due", {
                    date: shortDate(x.due),
                  })}</span
          >
        </p>`,
    )}
  </div>`;
}

function dismissButton(c: GwCtx, p: GwPersonView): TemplateResult {
  const armed = c.ui.armedDismiss === p.id;
  const cost = dismissal(c.seat, p.id);
  const short = cost !== null && !cost.affordable;
  return html`<button
      class="${armed ? BTN_ON : BTN} w-full"
      data-gw-dismiss=${p.id}
      ?disabled=${short}
      @click=${() => {
        if (!armed) {
          c.ui.armedDismiss = p.id;
          c.redraw();
          return;
        }
        c.ui.armedDismiss = null;
        c.send({ kind: "dismiss", person: p.id });
      }}
    >
      ${translateText(armed ? "gw.ui.dismiss_sure" : "gw.ui.dismiss")}
      ${cost === null
        ? nothing
        : html`<span class="${CHIP} ml-1"
            >${translateText("gw.ui.dismiss_price", { n: cost.price })}</span
          >`}
    </button>
    ${short
      ? html`<p class="${MUTED} pl-1" data-gw-dismiss-why>
          ${translateText("gw.ui.block.no_authority")}
        </p>`
      : nothing}`;
}

function row(c: GwCtx, p: GwPersonView): TemplateResult {
  const open = c.ui.openPerson === p.id;
  const lean = personLean(c.pack, p.id);
  const bio = personBio(c.pack, p.id);
  const offices = appointable(c.seat, p);
  return html`<section
    data-gw-person=${p.id}
    class="rounded border border-white/15 bg-black/35 p-2.5"
  >
    <button
      class="flex w-full items-center gap-2 text-left"
      @click=${() => {
        c.ui.openPerson = open ? null : p.id;
        c.ui.armedDismiss = null;
        c.redraw();
      }}
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-bold"
          >${personName(c.pack, p.id)}</span
        >
        <span class="${MUTED} block truncate"
          >${p.office === null
            ? translateText("gw.ui.no_office")
            : translateText(`gw.office.${p.office}`)}${lean === ""
            ? nothing
            : html` · ${lean}`}</span
        >
      </span>
      <span class="flex flex-col items-end gap-0.5">
        ${pips(p.trust)}
        <span class=${MUTED}
          >${translateText(`gw.ui.trust.${trustIndex(p.trust)}`)}</span
        >
      </span>
    </button>
    ${marks(c, p)}
    ${open
      ? html`<div class="mt-2 space-y-2 border-t border-white/10 pt-2">
          ${bio === ""
            ? nothing
            : html`<p class="text-sm text-white/80">${bio}</p>`}
          ${p.rivals.length === 0
            ? nothing
            : html`<p class=${MUTED}>
                ${translateText("gw.ui.rivals")}:
                ${p.rivals.map((r) => personName(c.pack, r)).join(", ")}
              </p>`}
          ${promises(c, p.id)}
          <div class="space-y-1">
            ${p.topics.length === 0
              ? html`<p class=${MUTED}>${translateText("gw.ui.no_topics")}</p>`
              : p.topics.map(
                  (t) =>
                    html`<button
                      class="${BTN} w-full"
                      data-gw-topic=${t}
                      ?disabled=${c.seat.audiences <= 0}
                      @click=${() => {
                        c.send({ kind: "summon", person: p.id, topic: t });
                        c.ui.summoned = Date.now();
                      }}
                    >
                      ${topicLabel(c.pack, t)}
                    </button>`,
                )}
          </div>
          ${offices.map(
            (o) =>
              html`<button
                class="${BTN} w-full"
                data-gw-appoint=${o}
                @click=${() =>
                  c.send({ kind: "appoint", person: p.id, office: o })}
              >
                ${translateText("gw.ui.appoint", {
                  office: translateText(`gw.office.${o}`),
                })}
              </button>`,
          )}
          ${p.office === null ? nothing : dismissButton(c, p)}
        </div>`
      : nothing}
  </section>`;
}

/** Offices nobody holds: a successor is named at the chapter's close. */
function vacancies(c: GwCtx): TemplateResult | typeof nothing {
  const offices = vacantOffices(c.seat);
  if (offices.length === 0) return nothing;
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-2.5"
    data-gw-vacant
  >
    <h3 class=${HEAD}>${translateText("gw.ui.vacant_title")}</h3>
    <p class=${MUTED}>${translateText("gw.ui.vacant_hint")}</p>
    ${offices.map((o) => {
      const names = c.seat.world.candidates[o] ?? [];
      return html`<div data-gw-vacant-office=${o}>
        <div class="text-sm">${translateText(`gw.office.${o}`)}</div>
        <div class="mt-1 flex flex-wrap gap-1">
          ${names.map(
            (id) =>
              html`<button
                class="${BTN} !px-2 !py-1"
                data-gw-appoint-name=${id}
                @click=${() =>
                  c.send({ kind: "appoint", person: id, office: o })}
              >
                ${personName(c.pack, id)}
              </button>`,
          )}
        </div>
      </div>`;
    })}
  </section>`;
}

/** "사적으로 만나기": only what the state has opened, across all the people. */
function privateMeetings(c: GwCtx): TemplateResult | typeof nothing {
  const { seat } = c;
  const open = seat.people.flatMap((p) =>
    (p.privateTopics ?? []).map((topic) => ({ who: p.id, topic })),
  );
  if (open.length === 0) return nothing;
  const left = seat.privates ?? 0;
  const shown = c.ui.privateOpen;
  return html`<section
    class="rounded border border-amber-200/25 bg-black/35 p-2.5"
    data-gw-private
  >
    <button
      class="flex w-full items-center gap-2 text-left"
      data-gw-private-toggle
      @click=${() => {
        c.ui.privateOpen = !shown;
        c.redraw();
      }}
    >
      <span class="min-w-0 flex-1 text-sm font-bold"
        >${translateText("gw.ui.private_title")}</span
      >
      <span class=${CHIP}
        >${translateText("gw.ui.private_left", { n: left })}</span
      >
    </button>
    ${shown
      ? html`<div class="mt-2 space-y-1 border-t border-white/10 pt-2">
          <p class=${MUTED}>${translateText("gw.ui.private_hint")}</p>
          ${open.map(
            (x) =>
              html`<button
                class="${BTN} w-full"
                data-gw-private-topic=${x.topic}
                ?disabled=${left <= 0}
                @click=${() => {
                  c.send({ kind: "summon", person: x.who, topic: x.topic });
                  c.ui.summoned = Date.now();
                }}
              >
                ${personName(c.pack, x.who)} · ${topicLabel(c.pack, x.topic)}
              </button>`,
          )}
        </div>`
      : nothing}
  </section>`;
}

/** The people tab: the cabinet and the court, summons left, who to call. */
export function peopleTab(c: GwCtx): TemplateResult {
  const { seat } = c;
  const office = seat.people.filter((p) => p.office !== null);
  const rest = seat.people.filter((p) => p.office === null);
  return html`<div class="space-y-2.5" data-gw-people>
    <div class="flex items-center gap-2">
      <span class=${CHIP} data-gw-audiences
        >${translateText("gw.ui.audiences", { n: seat.audiences })}</span
      >
      <span class=${CHIP} data-gw-authority
        >${translateText("gw.ui.authority", { n: seat.world.authority })}</span
      >
      <span class=${MUTED}>${translateText("gw.ui.audiences_hint")}</span>
    </div>
    ${privateMeetings(c)} ${vacancies(c)} ${office.map((p) => row(c, p))}
    ${rest.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.ui.outside")}</div>
          ${rest.map((p) => row(c, p))}`}
  </div>`;
}
