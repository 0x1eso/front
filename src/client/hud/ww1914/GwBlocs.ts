import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GwBlocView,
  GwEdition,
  GwHeadline,
  GwPaperView,
  GwPressView,
  GwTieView,
} from "@openfront/engine-api/ww1914/GwPress";
import { GW_SUPPORT_MAX } from "@openfront/engine-api/ww1914/GwPress";
import { html, nothing, TemplateResult } from "lit";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { BTN, BTN_ON, CHIP, fillColor, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

export function paperName(pack: GwPack | null, id: string): string {
  return pack?.press?.papers[id]?.name ?? id;
}

export function blocName(pack: GwPack | null, id: string): string {
  return pack?.press?.blocs[id]?.name ?? id;
}

/** What a paper's headline says: its take, or its gap. */
export function headlineText(
  pack: GwPack | null,
  e: GwEdition,
  h: GwHeadline,
): { head: string; deck: string | null } {
  const press = pack?.press;
  if (h.blank) return { head: press?.gaps[h.paper] ?? h.paper, deck: null };
  const t = press?.heads[e.story]?.[h.paper];
  const who = e.who === null ? "" : personName(pack, e.who);
  const fill = (x: string) => applyJosa(x.replaceAll("{who}", who));
  if (t === undefined) return { head: e.story, deck: null };
  return {
    head: fill(t.head),
    deck: t.deck === undefined ? null : fill(t.deck),
  };
}

function headline(c: GwCtx, e: GwEdition, h: GwHeadline): TemplateResult {
  const { head, deck } = headlineText(c.pack, e, h);
  return html`<div data-gw-head=${h.paper} ?data-gw-blank=${h.blank}>
    <div class=${MUTED}>${paperName(c.pack, h.paper)}</div>
    <p
      class=${h.blank
        ? "text-sm italic text-white/55"
        : "text-sm font-bold text-white"}
    >
      ${head}
    </p>
    ${deck === null
      ? nothing
      : html`<p class="text-sm text-white/75">${deck}</p>`}
    ${h.soft
      ? html`<p class=${MUTED}>${translateText("gw.ui.press.soft")}</p>`
      : nothing}
  </div>`;
}

function rumourLine(c: GwCtx, e: GwEdition): TemplateResult | typeof nothing {
  if (e.rumour === null) return nothing;
  return html`<div data-gw-rumour=${e.rumour}>
    <div class=${MUTED}>${translateText("gw.ui.press.rumour")}</div>
    <p class="text-sm text-amber-200/90">
      ${c.pack?.press?.rumours[e.rumour] ?? e.rumour}
    </p>
  </div>`;
}

/** The chapter's papers: what they are about, then each one's take. */
function frontPage(c: GwCtx, e: GwEdition): TemplateResult {
  const title = e.scene === null ? null : c.pack?.scenes[e.scene]?.title;
  return html`${title === null || title === undefined
    ? nothing
    : html`<p class=${MUTED}>
        ${translateText("gw.ui.press.about", { title })}
      </p>`}
  ${e.heads.map((h) => headline(c, e, h))} ${rumourLine(c, e)}`;
}

/** The papers at the head of the desk; a tap goes to the screen of blocs. */
export function deskPapers(c: GwCtx): TemplateResult | typeof nothing {
  const p = c.seat.world.press;
  if (p === null || p.edition === null) return nothing;
  return html`<section class=${BOX} data-gw-papers>
    <div class="flex items-center">
      <h3 class=${HEAD}>${translateText("gw.ui.press.title")}</h3>
      <button
        class="${MUTED} ml-auto underline"
        data-gw-to-blocs
        @click=${() => {
          c.ui.tab = "blocs";
          c.redraw();
        }}
      >
        ${translateText("gw.ui.press.to_blocs")}
      </button>
    </div>
    ${frontPage(c, p.edition)}
  </section>`;
}

/** A line for the ticker. */
export function tickerHead(c: {
  pack: GwPack | null;
  press: GwPressView | null;
}): string | null {
  const e = c.press?.edition ?? null;
  const h = e?.heads.find((x) => !x.blank);
  if (e === null || e === undefined || h === undefined) return null;
  return `${paperName(c.pack, h.paper)}: ${headlineText(c.pack, e, h).head}`;
}

function trend(b: GwBlocView): TemplateResult | typeof nothing {
  if (b.turning !== null) {
    return html`<span
      class="${CHIP} ${b.turning === "leaving"
        ? "!bg-red-500/40"
        : "!bg-emerald-500/30"}"
      data-gw-turning=${b.turning}
      >${translateText(`gw.ui.press.turning_${b.turning}`)}</span
    >`;
  }
  if (b.delta === 0) return nothing;
  return html`<span class=${MUTED}>${b.delta > 0 ? "▲" : "▼"}</span>`;
}

function blocRow(c: GwCtx, b: GwBlocView): TemplateResult {
  const press = c.pack?.press;
  const fill = (b.support + GW_SUPPORT_MAX) / (2 * GW_SUPPORT_MAX);
  const papers = b.papers.map((x) => paperName(c.pack, x));
  const people = b.people.map((x) => personName(c.pack, x));
  return html`<div class="space-y-0.5" data-gw-bloc=${b.id}>
    <div class="flex items-center gap-1.5 text-sm">
      <span class="text-white">${blocName(c.pack, b.id)}</span>
      ${trend(b)}
      <span class="ml-auto">${translateText(`gw.ui.bloc_word.${b.word}`)}</span>
    </div>
    <span class="block h-1.5 w-full rounded bg-white/15"
      ><span
        class="block h-1.5 rounded ${fillColor(fill)}"
        style="width:${Math.max(6, Math.round(fill * 100))}%"
      ></span
    ></span>
    <p class=${MUTED}>${press?.blocs[b.id]?.who ?? ""}</p>
    ${b.why.map(
      (w) =>
        html`<p class=${MUTED} data-gw-bloc-why=${w.key}>
          ${w.up ? "▲" : "▼"} ${press?.why[w.key] ?? w.key}
        </p>`,
    )}
    ${people.length + papers.length === 0
      ? nothing
      : html`<p class=${MUTED}>${[...people, ...papers].join(" · ")}</p>`}
  </div>`;
}

function tieRow(c: GwCtx, t: GwTieView): TemplateResult {
  const line = c.pack?.press?.ties[t.on ? t.key : `${t.key}_off`] ?? t.key;
  return html`<div data-gw-tie=${t.key} ?data-gw-tie-on=${t.on}>
    <div class="text-sm ${t.on ? "text-white" : "text-white/55"}">
      ${blocName(c.pack, t.a)} ${t.on ? "━" : "╌"} ${blocName(c.pack, t.b)}
    </div>
    <p class=${MUTED}>${line}</p>
  </div>`;
}

function invitePick(c: GwCtx, list: readonly GwPaperView[]): TemplateResult {
  return html`<div class="space-y-1" data-gw-invites>
    ${list.map((p) => {
      const lean = c.pack?.press?.papers[p.id]?.lean ?? "";
      const gain = p.blocs.map((b) => blocName(c.pack, b)).join(", ");
      const hurt = p.foe === null ? null : blocName(c.pack, p.foe);
      return html`<button
        class="${BTN} w-full"
        data-gw-invite=${p.id}
        @click=${() => {
          c.ui.pressPick = null;
          c.send({ kind: "press_invite", paper: p.id });
        }}
      >
        <span class="block">${paperName(c.pack, p.id)}</span>
        <span class="block ${MUTED}">${lean}</span>
        <span class="block ${MUTED}"
          >▲ ${gain}${hurt === null ? "" : ` · ▼ ${hurt}`}</span
        >
      </button>`;
    })}
  </div>`;
}

function leakPick(c: GwCtx): TemplateResult {
  const list = c.seat.people.filter(
    (p) => p.office !== null && !p.office.startsWith("ambassador"),
  );
  return html`<div class="space-y-1" data-gw-leaks>
    ${list.map(
      (p) =>
        html`<button
          class="${BTN} w-full"
          data-gw-leak=${p.id}
          @click=${() => {
            c.ui.pressPick = null;
            c.send({ kind: "press_leak", person: p.id });
          }}
        >
          ${personName(c.pack, p.id)}
          <span class=${MUTED}>${translateText(`gw.office.${p.office}`)}</span>
        </button>`,
    )}
  </div>`;
}

function pickButton(
  c: GwCtx,
  pick: "invite" | "leak",
  disabled: boolean,
): TemplateResult {
  const on = c.ui.pressPick === pick;
  return html`<button
    class="${on ? BTN_ON : BTN} w-full"
    data-gw-press-pick=${pick}
    ?disabled=${disabled}
    @click=${() => {
      c.ui.pressPick = on ? null : pick;
      c.redraw();
    }}
  >
    ${translateText(`gw.ui.press.${pick}`)}
    <span class="block ${MUTED}"
      >${translateText(`gw.ui.press.${pick}_help`)}</span
    >
  </button>`;
}

function policy(c: GwCtx, p: GwPressView): TemplateResult {
  const authority = c.seat.world.authority;
  const tighter =
    !p.acted &&
    p.censor < p.censorCap &&
    p.censorBar === null &&
    authority >= p.censorPrice;
  const invitable = p.papers.filter((x) => x.invitable);
  const friend = p.papers.find((x) => x.friend);
  return html`<section class=${BOX} data-gw-press-policy>
    <h3 class=${HEAD}>${translateText("gw.ui.press.policy_title")}</h3>
    <div class="flex justify-between text-sm">
      <span class="text-white/70">${translateText("gw.ui.press.censor")}</span>
      <span data-gw-censor=${p.censor}
        >${translateText(`gw.ui.press_censor.${p.censor}`)}</span
      >
    </div>
    <div class="flex justify-between text-sm">
      <span class="text-white/70">${translateText("gw.ui.press.rumour")}</span>
      <span data-gw-rumour-level=${p.rumour}
        >${translateText(`gw.ui.press_rumour.${p.rumour}`)}</span
      >
    </div>
    ${friend === undefined
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText("gw.ui.press.friend", {
            paper: paperName(c.pack, friend.id),
          })}
        </p>`}
    ${p.acted
      ? html`<p class="text-sm text-amber-200" data-gw-press-acted>
          ${translateText("gw.ui.press.acted")}
        </p>`
      : nothing}
    <p class=${MUTED}>${translateText("gw.ui.press.censor_help")}</p>
    <div class="grid grid-cols-2 gap-1">
      <button
        class=${BTN}
        data-gw-censor-up
        ?disabled=${!tighter}
        @click=${() => c.send({ kind: "press_censor", up: true })}
      >
        ${translateText("gw.ui.press.tighten", { n: p.censorPrice })}
      </button>
      <button
        class=${BTN}
        data-gw-censor-down
        ?disabled=${p.acted || p.censor === 0}
        @click=${() => c.send({ kind: "press_censor", up: false })}
      >
        ${translateText("gw.ui.press.loosen")}
      </button>
    </div>
    ${p.censorBar === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(`gw.plan_why.${p.censorBar}`)}
        </p>`}
    ${pickButton(c, "invite", p.acted || c.seat.audiences <= 0)}
    ${c.ui.pressPick === "invite" ? invitePick(c, invitable) : nothing}
    ${pickButton(c, "leak", p.acted)}
    ${c.ui.pressPick === "leak" ? leakPick(c) : nothing}
  </section>`;
}

/** The screen of the country's blocs and papers. */
export function blocsTab(c: GwCtx): TemplateResult {
  const p = c.seat.world.press;
  if (p === null) {
    return html`<p class="text-sm text-white/65" data-gw-blocs-none>
      ${translateText("gw.ui.press.none")}
    </p>`;
  }
  return html`<div class="space-y-3" data-gw-blocs>
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.ui.press.blocs_title")}</h3>
      ${p.blocs.map((b) => blocRow(c, b))}
    </section>
    <section class=${BOX}>
      <h3 class=${HEAD}>${translateText("gw.ui.press.ties_title")}</h3>
      ${p.ties.map((t) => tieRow(c, t))}
    </section>
    ${p.edition === null
      ? nothing
      : html`<section class=${BOX} data-gw-front-page>
          <h3 class=${HEAD}>${translateText("gw.ui.press.title")}</h3>
          ${frontPage(c, p.edition)}
        </section>`}
    ${policy(c, p)}
  </div>`;
}
