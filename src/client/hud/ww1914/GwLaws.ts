import type { GwLawView } from "@openfront/engine-api/ww1914/GwLaw";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { instName } from "./GwOffice";
import { BTN, BTN_ON, HEAD, MUTED } from "./GwStyle";
import { personName } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";

const billName = (c: GwCtx, id: string): string =>
  c.pack?.scenes[`gw_law_${id}`]?.title ?? id;
const billLine = (c: GwCtx, id: string): string | null =>
  c.pack?.scenes[`gw_law_${id}`]?.topic ?? null;

/** What a moving bill looks like today, and who can stop it. */
function standing(v: GwLawView, tag: string): TemplateResult | typeof nothing {
  if (v.body === null) return nothing;
  const body = instName(tag, v.body);
  const stops =
    v.second === null
      ? translateText("gw.law.stops", { body })
      : translateText("gw.law.stops_two", {
          body,
          second: instName(tag, v.second),
        });
  return html`<p class=${MUTED} data-gw-law-stops>
    ${stops}${v.outlook === null
      ? nothing
      : html` ·
          <span data-gw-law-outlook=${v.outlook}
            >${translateText(`gw.law.outlook.${v.outlook}`)}</span
          >`}${v.decree
      ? html` · <span>${translateText("gw.law.by_decree")}</span>`
      : nothing}
  </p>`;
}

/** A house bill: who drafts it, from the cabinet, or the usual minister. */
function sponsorPick(c: GwCtx, v: GwLawView): TemplateResult {
  const draft = (sponsor?: string) => {
    c.ui.armedDraft = null;
    c.send(
      sponsor === undefined
        ? { kind: "law", law: v.id, act: "draft" }
        : { kind: "law", law: v.id, act: "draft", sponsor },
    );
  };
  const cabinet = c.seat.people.filter((p) => p.office !== null);
  return html`<div class="space-y-1" data-gw-law-sponsors=${v.id}>
    <p class=${MUTED}>${translateText("gw.house.pick_sponsor")}</p>
    <div class="flex flex-wrap gap-1">
      <button class=${BTN} data-gw-law-sponsor="" @click=${() => draft()}>
        ${translateText("gw.house.sponsor_default")}
      </button>
      ${cabinet.map(
        (p) =>
          html`<button
            class=${BTN}
            data-gw-law-sponsor=${p.id}
            @click=${() => draft(p.id)}
          >
            ${personName(c.pack, p.id)}
          </button>`,
      )}
    </div>
  </div>`;
}

function takeUp(c: GwCtx, v: GwLawView): TemplateResult {
  if (v.house === true && c.ui.armedDraft === v.id && v.waits === null) {
    return sponsorPick(c, v);
  }
  return html`<button
      class="${BTN} w-full"
      data-gw-law-draft=${v.id}
      ?disabled=${v.waits !== null}
      @click=${() => {
        if (v.house === true) {
          c.ui.armedDraft = v.id;
          c.redraw();
          return;
        }
        c.send({ kind: "law", law: v.id, act: "draft" });
      }}
    >
      ${translateText("gw.law.take")}
    </button>
    ${v.waits === null
      ? nothing
      : html`<p class=${MUTED}>
          ${translateText(`gw.law.waits.${v.waits}`)}
        </p>`}`;
}

function call(c: GwCtx, v: GwLawView): TemplateResult | typeof nothing {
  const t = v.talk;
  if (t === null) return nothing;
  return html`<button
    class="${BTN} w-full"
    data-gw-law-talk=${v.id}
    ?disabled=${c.seat.audiences <= 0}
    @click=${() => {
      c.send({ kind: "summon", person: t.person, topic: t.topic });
      c.ui.summoned = Date.now();
    }}
  >
    ${translateText("gw.law.call", { name: personName(c.pack, t.person) })}
  </button>`;
}

function repeal(c: GwCtx, v: GwLawView): TemplateResult | typeof nothing {
  const r = v.repeal;
  if (r === null) return nothing;
  const armed = c.ui.armedRepeal === v.id;
  return html`<button
    class="${armed ? BTN_ON : BTN} w-full"
    data-gw-law-repeal=${v.id}
    ?disabled=${!r.open}
    @click=${() => {
      if (!armed) {
        c.ui.armedRepeal = v.id;
        c.redraw();
        return;
      }
      c.ui.armedRepeal = null;
      c.ui.notes.push({
        chapter: c.data.chapter,
        title: billName(c, v.id),
        pick: translateText("gw.law.repeal"),
        rest: "",
        tell: r.tell,
      });
      c.send({ kind: "law", law: v.id, act: "repeal" });
    }}
  >
    ${translateText(armed ? "gw.law.repeal_sure" : "gw.law.repeal")}
  </button> `;
}

function line(c: GwCtx, v: GwLawView): TemplateResult {
  const about = billLine(c, v.id);
  const how =
    v.stage === "force" && v.how !== "repealed"
      ? translateText(`gw.law.how.${v.how}`)
      : translateText(`gw.law.stage.${v.stage}`);
  return html`<div class="space-y-1" data-gw-law=${v.id}>
    <div class="flex justify-between gap-2 text-sm">
      <span class="font-bold">${billName(c, v.id)}</span>
      <span class="shrink-0 text-white/70">${how}</span>
    </div>
    ${about === null ? nothing : html`<p class=${MUTED}>${about}</p>`}
    ${v.stage === "force" ? nothing : standing(v, c.seat.tag)}
    ${v.stage === "open" ? takeUp(c, v) : nothing} ${call(c, v)} ${repeal(c, v)}
  </div>`;
}

const ORDER: readonly GwLawView["stage"][] = [
  "sign",
  "vote",
  "persuade",
  "draft",
  "force",
  "open",
];

/** The country tab's lines: what moves first, then what stands, then what can. */
export function lawsSection(c: GwCtx): TemplateResult | typeof nothing {
  const rows = [...c.seat.world.laws].sort(
    (a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage),
  );
  // A country with bills, none open yet, still shows the box (w159).
  if (rows.length === 0 && c.seat.world.lawsAhead !== true) return nothing;
  return html`<section class=${BOX} data-gw-laws>
    <h3 class=${HEAD}>${translateText("gw.law.title")}</h3>
    ${rows.length === 0
      ? html`<p class=${MUTED} data-gw-laws-none>
          ${translateText("gw.law.none_yet")}
        </p>`
      : rows.map((v) => line(c, v))}
  </section>`;
}

/** Under the day's card: how the count stands as it is read. */
export function lawStrip(c: GwCtx, scene: string): TemplateResult {
  const v = c.seat.world.laws.find((x) => `gw_lv_${x.id}` === scene);
  if (v === undefined) return html``;
  return html`<div class=${BOX} data-gw-law-strip>
    ${standing(v, c.seat.tag)}
  </div>`;
}
