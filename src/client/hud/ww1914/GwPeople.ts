import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPersonView } from "@openfront/engine-api/ww1914/GwView";
import { GW_PREMIER_PICKS } from "@openfront/engine-lib/ww1914/StoryRows";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import {
  canSpend,
  deptsBox,
  giftButtons,
  roomBox,
  timeChip,
  timeLeft,
} from "./GwDept";
import { rich } from "./GwDict";
import { gwFace } from "./GwFace";
import {
  appointable,
  appointBlock,
  dismissal,
  talkTopics,
  topicLabel,
  trustIndex,
  vacantOffices,
} from "./GwModel";
import { authorityChip } from "./GwNow";
import { officeTitle } from "./GwOffice";
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
import {
  country,
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
          ${rich(c, promiseText(c.pack, x))}
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

/** The head names only the premier (France): the rest he can only press for. */
const premierPicks = (c: GwCtx) =>
  GW_PREMIER_PICKS[c.seat.tag as GwTag] !== undefined;
const pressOnly = (c: GwCtx, o: string) =>
  premierPicks(c) && o !== "chancellor";

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
      ${translateText(
        armed
          ? "gw.ui.dismiss_sure"
          : premierPicks(c)
            ? "gw.ui.dismiss_ask"
            : "gw.ui.dismiss",
      )}
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

/** A 36 px face beside the name, or the initial in the same circle. */
function rowFace(c: GwCtx, id: string, name: string): TemplateResult {
  return gwFace(
    c.faces,
    id,
    translateText("gw.ui.face_alt", { name }),
    "h-9 w-9",
    html`<span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm font-bold"
      aria-hidden="true"
      >${name.replace(/\s+/g, "").slice(0, 1)}</span
    >`,
  );
}

/** How many talks they could be called on now; nothing at none. */
function topicBadge(n: number): TemplateResult | typeof nothing {
  if (n === 0) return nothing;
  const label = translateText("gw.ui.topic_count", { n });
  return html`<span
    class="shrink-0 rounded-full bg-amber-300/90 px-1.5 text-xs font-bold text-slate-900"
    data-gw-topic-count
    title=${label}
    aria-label=${label}
    >${n}</span
  >`;
}

/** What an opened person row holds: bio, rivals, promises, talks, posts. */
export function personDetails(c: GwCtx, p: GwPersonView): TemplateResult {
  const bio = personBio(c.pack, p.id);
  const offices = appointBlock(c.data) === null ? appointable(c.seat, p) : [];
  const topics = talkTopics(p);
  return html`${bio === ""
      ? nothing
      : html`<p class="text-sm text-white/80">${bio}</p>`}
    ${p.rivals.length === 0
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.ui.rivals")}:
          ${p.rivals.map((r) => personName(c.pack, r)).join(", ")}
        </p>`}
    ${promises(c, p.id)} ${giftButtons(c, p.id)}
    <div class="space-y-1">
      ${topics.length === 0
        ? html`<p class=${MUTED}>${translateText("gw.ui.no_topics")}</p>`
        : topics.map(
            (t) =>
              html`<button
                class="${BTN} w-full"
                data-gw-topic=${t}
                ?disabled=${timeLeft(c) <= 0 || !canSpend(c, "petition")}
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
          @click=${() => c.send({ kind: "appoint", person: p.id, office: o })}
        >
          ${translateText(
            pressOnly(c, o) ? "gw.ui.appoint_ask" : "gw.ui.appoint",
            { office: officeTitle(c.seat.tag, o) },
          )}
        </button>`,
    )}
    ${p.office === null || (p.office === "chancellor" && premierPicks(c))
      ? nothing
      : dismissButton(c, p)}`;
}

export function personRow(c: GwCtx, p: GwPersonView): TemplateResult {
  const open = c.ui.openPerson === p.id;
  const lean = personLean(c.pack, p.id);
  const name = personName(c.pack, p.id);
  const topics = talkTopics(p);
  // Nobody to talk to about anything now: the row steps back until opened.
  const empty = topics.length === 0 && !open;
  return html`<section
    data-gw-person=${p.id}
    ?data-gw-no-topics=${topics.length === 0}
    class="rounded border border-white/15 bg-black/35 p-2.5 ${empty
      ? "opacity-60"
      : ""}"
  >
    <button
      class="flex w-full items-center gap-2 text-left"
      @click=${() => {
        c.ui.openPerson = open ? null : p.id;
        c.ui.armedDismiss = null;
        c.redraw();
      }}
    >
      ${rowFace(c, p.id, name)}
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-sm font-bold">${name}</span>
          ${topicBadge(topics.length)}
        </span>
        <span class="${MUTED} block truncate"
          >${p.office === null
            ? translateText("gw.ui.no_office")
            : officeTitle(c.seat.tag, p.office)}${lean === ""
            ? nothing
            : html` · ${lean}`}</span
        >
      </span>
      <span
        class="flex flex-col items-end gap-0.5"
        data-gw-trust-col
        title=${translateText("gw.ui.trust_hint")}
      >
        ${pips(p.trust)}
        <span class=${MUTED}
          >${translateText(`gw.ui.trust.${trustIndex(p.trust)}`)}</span
        >
      </span>
    </button>
    ${marks(c, p)}
    ${open
      ? html`<div class="mt-2 space-y-2 border-t border-white/10 pt-2">
          ${personDetails(c, p)}
        </div>`
      : nothing}
  </section>`;
}

/** Offices nobody holds: a successor is named at the chapter's close. */
function vacancies(c: GwCtx): TemplateResult | typeof nothing {
  const offices = vacantOffices(c.seat);
  if (offices.length === 0) return nothing;
  const block = appointBlock(c.data);
  return html`<section
    class="space-y-1.5 rounded border border-amber-200/40 bg-amber-200/10 p-2.5"
    data-gw-vacant
  >
    <h3 class=${HEAD}>${translateText("gw.ui.vacant_title")}</h3>
    <p class=${MUTED}>${translateText("gw.ui.vacant_hint")}</p>
    ${block === null
      ? nothing
      : html`<p class=${MUTED} data-gw-block>
          ${translateText(`gw.ui.block.${block}`)}
        </p>`}
    ${offices.map((o) => {
      const names = block === null ? (c.seat.world.candidates[o] ?? []) : [];
      return html`<div data-gw-vacant-office=${o}>
        <div class="text-sm">${officeTitle(c.seat.tag, o)}</div>
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

/** ww180: our named agents abroad, with their story; hired in 정보부. */
function agents(c: GwCtx): TemplateResult | typeof nothing {
  const mine = c.seat.world.agents?.mine ?? [];
  const pool = c.seat.world.agents?.pool ?? [];
  if (mine.length === 0 && pool.length === 0) return nothing;
  return html`<section
    class="space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5"
    data-gw-people-agents
  >
    <h3 class=${HEAD}>${translateText("gw.ui.agents_title")}</h3>
    <p class="text-sm text-white/70">${translateText("gw.ui.agents_hint")}</p>
    ${mine.length === 0
      ? html`<p class=${MUTED}>
          ${translateText("gw.intel.agents.mine_none")}
        </p>`
      : mine.map(
          (a) =>
            html`<div
              class="space-y-0.5 border-t border-white/10 pt-1.5"
              data-gw-people-agent=${a.id}
            >
              <div class="flex items-center gap-2">
                ${rowFace(c, a.id, translateText(`gw.agent.${a.id}.name`))}
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold"
                    >${translateText(`gw.agent.${a.id}.name`)}</span
                  >
                  <span class="${MUTED} block truncate"
                    >${translateText("gw.intel.agents.at", {
                      country: country(a.at),
                    })}</span
                  >
                </span>
                <span class=${CHIP}
                  >${translateText(
                    `gw.intel.agents.fate.${a.fate ?? "working"}`,
                  )}</span
                >
              </div>
              <p class="text-sm text-white/80">
                ${translateText(`gw.agent.${a.id}.bio`)}
              </p>
            </div>`,
        )}
    <button
      class="${BTN} !px-2 !py-1"
      data-gw-people-to-intel
      @click=${() => {
        c.ui.tab = "intel";
        c.redraw();
      }}
    >
      ${translateText("gw.ui.agents_to_intel")}
    </button>
  </section>`;
}

/** The people tab: the cabinet and the court, summons left, who to call. */
export function peopleTab(c: GwCtx): TemplateResult {
  const { seat } = c;
  // ww193: a department's head is its row in 부서; the other office holders follow.
  const heads = new Set((seat.depts ?? []).map((d) => d.head));
  const office = seat.people.filter(
    (p) => p.office !== null && !heads.has(p.id),
  );
  const rest = seat.people.filter((p) => p.office === null);
  return html`<div class="space-y-2.5" data-gw-people>
    <div class="flex items-center gap-2">
      ${seat.time === undefined
        ? html`<span
            class=${CHIP}
            data-gw-audiences
            title=${translateText("gw.ui.audiences_tip")}
            >${translateText("gw.ui.audiences", { n: seat.audiences })}</span
          >`
        : timeChip(c)}
      ${authorityChip(seat.world.authority)}
      <span class=${MUTED}>${translateText("gw.ui.audiences_hint")}</span>
    </div>
    ${roomBox(c, false)}
    ${deptsBox(c, {
      badge: (id) => {
        const p = seat.people.find((x) => x.id === id);
        return p === undefined ? nothing : topicBadge(talkTopics(p).length);
      },
      body: (id) => {
        const p = seat.people.find((x) => x.id === id);
        return p === undefined
          ? nothing
          : html`${marks(c, p)} ${personDetails(c, p)}`;
      },
    })}
    ${privateMeetings(c)} ${vacancies(c)} ${office.map((p) => personRow(c, p))}
    ${rest.length === 0
      ? nothing
      : html`<div class=${MUTED}>${translateText("gw.ui.outside")}</div>
          ${rest.map((p) => personRow(c, p))}`}
    ${agents(c)}
  </div>`;
}
