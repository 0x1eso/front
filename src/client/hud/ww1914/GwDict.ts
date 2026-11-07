import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import {
  DictIndex,
  dictIndex,
  DictRef,
  dictLines,
  splitTerms,
} from "./GwDictModel";
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

/** Text with its names and terms tappable. */
export function rich(c: GwCtx, text: string): TemplateResult {
  return html`${splitTerms(text, indexOf(c)).map((p) =>
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

function personCard(c: GwCtx, id: string) {
  const office = c.seat.people.find((p) => p.id === id)?.office;
  return {
    title: personName(c.pack, id),
    sub: office === null || office === undefined
      ? ""
      : translateText(`gw.office.${office}`),
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
