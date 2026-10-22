import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import {
  type EndgameGame,
  pastConferences,
  type WarCard,
  warCards,
  type WarMemberView,
} from "./EndgameModel";

const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
const CARD = "rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs";
/** Treaty lines a past conference shows before "+N". */
const LINES_SHOWN = 4;

const STATUS_CLASS: Readonly<Record<WarCard["status"], string>> = {
  ongoing: "border-red-400/60 text-red-200",
  ended: "border-white/20 text-white/60",
  conference_pending: "border-amber-300/70 text-amber-200",
};

function flag(url: string | null) {
  return url === null
    ? nothing
    : html`<img
        src=${url}
        alt=""
        class="h-3 w-4 shrink-0 rounded-sm object-cover"
      />`;
}

function member(m: WarMemberView): TemplateResult {
  return html`<li
    data-ww-war-member=${m.id}
    data-state=${m.state}
    class="flex min-w-0 items-center gap-1 ${m.state === "active"
      ? ""
      : "text-white/50"} ${m.me ? "font-semibold text-amber-200" : ""}"
  >
    ${flag(m.flag)}
    <span class="min-w-0 truncate"
      >${translateText("ww1936.peace.shares", {
        country: m.name,
        pct: Math.floor(m.sharePm / 10),
      })}</span
    >
    ${m.state === "active"
      ? nothing
      : html`<span
          class="shrink-0 rounded border border-white/15 px-1 text-white/60"
          >${m.stateName}</span
        >`}
  </li>`;
}

function card(c: WarCard): TemplateResult {
  const pct = c.mySharePm === null ? null : Math.floor(c.mySharePm / 10);
  return html`<li data-ww-war=${c.id} data-status=${c.status} class=${CARD}>
    <div class="flex min-w-0 items-center gap-1.5">
      <b class="min-w-0 flex-1 truncate">${c.name}</b>
      ${c.kind === "normal"
        ? nothing
        : html`<span class="shrink-0 text-white/60"
            >${translateText(`ww1936.war.kind.${c.kind}`)}</span
          >`}
      <span
        data-ww-war-status
        class="shrink-0 rounded border px-1 ${STATUS_CLASS[c.status]}"
        >${translateText(`ww1936.war.${c.status}`)}</span
      >
    </div>
    <p data-ww-war-sides class="m-0 flex items-center gap-1 text-white/70">
      ${flag(c.sides[0]?.flag ?? null)} ${flag(c.sides[1]?.flag ?? null)}
      <span class="min-w-0 truncate"
        >${translateText("ww1936.war.sides", {
          a: c.sides[0]?.name ?? "",
          b: c.sides[1]?.name ?? "",
        })}</span
      >
    </p>
    <div class="mt-1 text-white/60">${translateText("ww1936.war.members")}</div>
    <div class="grid grid-cols-2 gap-x-2">
      ${c.sides.map(
        (s, n) =>
          html`<ul
            data-ww-war-side=${n}
            class="m-0 flex min-w-0 list-none flex-col gap-0.5 p-0"
          >
            ${s.members.map(member)}
          </ul>`,
      )}
    </div>
    ${pct === null
      ? nothing
      : html`<div data-ww-war-share=${pct} class="mt-1">
          <span>${translateText("ww1936.war.my_share_pct", { pct })}</span>
          <div class="mt-0.5 h-1.5 rounded bg-white/10">
            <div
              class="h-1.5 rounded bg-amber-400"
              style="width: ${Math.max(0, Math.min(100, pct))}%"
            ></div>
          </div>
        </div>`}
  </li>`;
}

/**
 * World War 1936 P5 (spec §4, §20.5): the diplomacy drawer's wars tab,
 * first part — the war records: my ongoing wars, the others, my ended
 * ones; each with its name ("German–Polish War (1939)"), its kind and
 * state, both sides' members with their state and share of the side's
 * war score, and my contribution as a bar.
 */
export function warCardsTemplate(
  game: EndgameGame,
  me: number,
): TemplateResult {
  const cards = warCards(game, me);
  return html`<div class=${HEADING}>${translateText("ww1936.war.tab")}</div>
    ${cards.length === 0
      ? html`<p data-ww-war-none class="m-0 text-xs text-white/60">
          ${translateText("ww1936.war.none")}
        </p>`
      : html`<ul
          data-ww-war-cards
          class="m-0 flex list-none flex-col gap-1 p-0"
        >
          ${cards.map(card)}
        </ul>`}`;
}

/** The wars tab's last part (spec §20.5): the last ten peace conferences and their treaties. */
export function pastConferencesTemplate(game: EndgameGame): TemplateResult {
  const past = pastConferences(game);
  return html`<div class=${HEADING}>${translateText("ww1936.peace.past")}</div>
    ${past.length === 0
      ? html`<p class="m-0 text-xs text-white/60">
          ${translateText("ww1936.peace.past_none")}
        </p>`
      : html`<ul
          data-ww-past-conferences
          class="m-0 flex list-none flex-col gap-1 p-0"
        >
          ${past.map(
            (p) =>
              html`<li class=${CARD}>
                <div class="flex min-w-0 gap-2">
                  <span class="shrink-0 text-white/60">${p.date}</span>
                  <b class="min-w-0 truncate">${p.line}</b>
                </div>
                <ul class="m-0 list-none p-0 text-white/70">
                  ${p.lines
                    .slice(0, LINES_SHOWN)
                    .map((l) => html`<li>${l}</li>`)}
                  ${p.lines.length > LINES_SHOWN
                    ? html`<li>
                        ${translateText("ww1936.eventui.more", {
                          n: p.lines.length - LINES_SHOWN,
                        })}
                      </li>`
                    : nothing}
                </ul>
              </li>`,
          )}
        </ul>`}`;
}
