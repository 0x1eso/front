import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import {
  DictIndex,
  dictIndex,
  dictLines,
  DictRef,
  leanTitle,
  splitTerms,
  TextPass,
} from "./GwDictModel";
import { officeTitle } from "./GwOffice";
import { BTN, GLASS, HEAD, MUTED } from "./GwStyle";
import { personBio, personLean, personName } from "./GwText";

const TERM =
  "cursor-help underline decoration-white/40 decoration-dotted underline-offset-4 hover:decoration-amber-200";

let last: { key: string; pack: unknown; index: DictIndex } | null = null;

/** The index for what the seat knows now; built again only when that changes. */
function indexOf(c: GwCtx): DictIndex {
  const known = c.seat.world.secrets;
  const key = `${c.seat.tag}|${known.join(",")}`;
  if (last === null || last.key !== key || last.pack !== c.pack) {
    last = {
      key,
      pack: c.pack,
      index: dictIndex(c.pack, c.seat.tag, known),
    };
  }
  return last.index;
}

function open(c: GwCtx, ref: DictRef, e: Event): void {
  // A term can sit in an option's button: reading it isn't choosing it.
  e.stopPropagation();
  e.preventDefault();
  c.ui.term = ref;
  c.redraw();
}

/** A person's title as text shows it: their office, else what their lean says. */
function titleOf(c: GwCtx, id: string): string | null {
  const office = c.seat.people.find((p) => p.id === id)?.office;
  if (office !== null && office !== undefined && office !== "court") {
    return officeTitle(c.seat.tag, office);
  }
  return leanTitle(personLean(c.pack, id));
}

/**
 * Text with its names and terms tappable. Pass one `TextPass` through every
 * piece of a card or talk and each name is underlined, and given its title,
 * only the first time.
 */
export function rich(c: GwCtx, text: string, pass?: TextPass): TemplateResult {
  return html`${splitTerms(text, indexOf(c), pass, (id) => titleOf(c, id)).map(
    (p) =>
      p.ref === null
        ? p.text
        : html`<span
            role="button"
            tabindex="0"
            class=${TERM}
            data-gw-term=${`${p.ref.kind}.${p.ref.id}`}
            @click=${(e: Event) => open(c, p.ref!, e)}
            >${p.text}</span
          >`,
  )}`;
}

/** The secretary's note: set apart from the prose, labelled as hers. */
export function briefLine(
  c: GwCtx,
  text: string,
  pass: TextPass,
): TemplateResult {
  return html`<p
    class="rounded-sm border-l-2 border-sky-300/60 bg-sky-300/10 px-2 py-1 text-[13px] leading-6 text-sky-100/90"
    data-gw-brief
  >
    <span class="mr-1 font-bold text-sky-200/90"
      >${translateText("gw.ui.brief_label")}</span
    >${rich(c, text, pass)}
  </p>`;
}

/** The line under a prologue scene's date: the years have no secretary. */
export function pastLine(
  c: GwCtx,
  text: string,
  pass: TextPass,
): TemplateResult {
  return html`<p
    class="text-center text-[15px] leading-7 text-white/70"
    data-gw-past-brief
  >
    ${rich(c, text, pass)}
  </p>`;
}

function personCard(c: GwCtx, id: string) {
  const office = c.seat.people.find((p) => p.id === id)?.office;
  return {
    title: personName(c.pack, id),
    sub:
      office === null || office === undefined
        ? ""
        : officeTitle(c.seat.tag, office),
    lines: [personLean(c.pack, id), personBio(c.pack, id)].filter(
      (x) => x !== "",
    ),
  };
}

function termCard(c: GwCtx, id: string) {
  return {
    title: c.pack?.dict?.[id]?.terms[0] ?? id,
    sub: "",
    lines: dictLines(c.pack, id, c.seat.world.secrets),
  };
}

/** The card a tap opens, over whatever was being read. */
export function dictCard(c: GwCtx): TemplateResult | typeof nothing {
  const ref = c.ui.term;
  if (ref === null) return nothing;
  const card =
    ref.kind === "person" ? personCard(c, ref.id) : termCard(c, ref.id);
  const close = () => {
    c.ui.term = null;
    c.redraw();
  };
  return html`<div
    class="pointer-events-auto fixed inset-0 z-[1100] flex items-end justify-center bg-black/30 p-3 sm:items-center"
    @click=${(e: Event) => e.target === e.currentTarget && close()}
  >
    <section
      data-gw-dict=${ref.id}
      class="${GLASS} w-full max-w-[420px] space-y-2 rounded-md p-4 text-white shadow-2xl"
    >
      <h3 class=${HEAD}>${card.title}</h3>
      ${card.sub === "" ? nothing : html`<p class=${MUTED}>${card.sub}</p>`}
      ${card.lines.map(
        (l) => html`<p class="text-sm leading-6 text-white/85">${l}</p>`,
      )}
      <button class="${BTN} w-full text-center" @click=${close}>
        ${translateText("gw.ui.dict_close")}
      </button>
    </section>
  </div>`;
}
