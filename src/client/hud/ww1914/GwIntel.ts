// ww179: the 정보부 tab. Everything the secret service knows, in one place:
// its chief, what we know of each rival (by front and by country), the codes
// we read, our nets abroad and the rings caught, and the 뒷공작 rows. Only the
// seat's own view: reports as they came, the service as it knows itself.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwReportView,
  GwSourceView,
} from "@openfront/engine-api/ww1914/GwWorldView";
import { html, nothing, TemplateResult } from "lit";
import { applyJosa } from "../../Josa";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { personRow } from "./GwPeople";
import { actRow } from "./GwSchedule";
import { BTN, CHIP, HEAD, MUTED } from "./GwStyle";
import { country, factText } from "./GwText";

const BOX = "space-y-1.5 rounded border border-white/15 bg-black/35 p-2.5";
/** Reports about the seat's own house and allies: they belong elsewhere. */
const HOME_FACTS: readonly string[] = ["plot", "file", "count", "ally"];
/** Facts that are about a front rather than a whole country. */
const FRONT_FACTS: readonly string[] = ["strain", "prep"];

const t = (key: string, params: Record<string, string | number> = {}) =>
  applyJosa(translateText(`gw.intel.${key}`, params));

/** One plain line under a section's title: what it is and why it matters. */
function head(key: string): TemplateResult {
  return html`<h3 class=${HEAD}>${t(`${key}.title`)}</h3>
    <p class="text-sm text-white/70" data-gw-intel-why>${t(`${key}.why`)}</p>`;
}

function empty(key: string): TemplateResult {
  return html`<p class=${MUTED} data-gw-intel-empty>${t(key)}</p>`;
}

/** How old a report is, in words. */
export function ageWord(now: number, chapter: number): string {
  const d = Math.max(0, now - chapter);
  return t(`age.${d === 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : 3}`);
}

/** How a source has done so far, in words; "" before it was ever checked. */
export function trackWord(s: GwSourceView | undefined): string {
  if (s === undefined || s.right + s.wrong === 0) return "";
  if (s.wrong === 0 || s.right >= 2 * s.wrong) return t("track.good");
  if (s.right >= s.wrong) return t("track.mixed");
  return t("track.poor");
}

/** A report: what it says, who said it, how sure we are and how old it is. */
function report(c: GwCtx, r: GwReportView, front: boolean): TemplateResult {
  const src = c.seat.world.sources.find((s) => s.id === r.source);
  const track = trackWord(src);
  const where =
    !front && r.theatre !== null
      ? ` (${translateText(`gw.ui.theatre.${r.theatre}`)})`
      : "";
  const what = `${translateText(`gw.ui.fact.${r.fact}`)}${where}: ${factText(r.fact, r.claim)}`;
  return html`<div class="text-sm" data-gw-intel-report=${r.uid}>
    <p class="text-white/85">${what}</p>
    <p class=${MUTED}>
      <span title=${track}
        >${t("from", { source: translateText(`gw.source.${r.source}`) })}</span
      >
      ·
      <span title=${translateText(`gw.ui.stamp_hint.${r.stamp}`)}
        >${t(`sure.${r.stamp}`)}</span
      >
      · ${ageWord(c.data.chapter, r.chapter)}
    </p>
    ${r.corrected !== null
      ? html`<p class="text-amber-200" data-gw-corrected>
          ${translateText("gw.ui.report_corrected", {
            claim: factText(r.fact, r.corrected),
          })}
        </p>`
      : r.checked
        ? html`<p class=${MUTED}>${t("held")}</p>`
        : nothing}
  </div>`;
}

/** The newest report for each key, newest first. */
function newest(
  rows: readonly GwReportView[],
  key: (r: GwReportView) => string,
): GwReportView[] {
  const seen = new Set<string>();
  const out: GwReportView[] = [];
  for (const r of [...rows].reverse()) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Reports on another country, without the house's own papers. */
function foreign(c: GwCtx): GwReportView[] {
  return c.seat.world.reports.filter(
    (r) =>
      r.tag !== c.seat.tag &&
      !HOME_FACTS.includes(r.fact) &&
      (r.about ?? null) === null,
  );
}

/** Who the service watches: the other camp, and anyone it reports on. */
export function rivalsOf(c: GwCtx): GwTag[] {
  const w = c.seat.world;
  const i = w.service;
  const mine = w.side;
  const named = new Set<string>([
    ...w.fronts.flatMap((f) => (f.foe ? [f.foe.tag] : [])),
    ...foreign(c).map((r) => r.tag),
    ...(i?.rivals ?? []),
    ...(i?.reads.map((x) => x.tag) ?? []),
    ...(i?.nets.map((x) => x.tag) ?? []),
  ]);
  return w.countries
    .filter(
      (n) =>
        n.tag !== c.seat.tag &&
        (named.has(n.tag) ||
          (mine !== null && !n.out && n.side !== null && n.side !== mine)),
    )
    .map((n) => n.tag);
}

/** The chief, and the service's three skills in words. */
function chief(c: GwCtx): TemplateResult {
  const p = c.seat.people.find((x) => x.office === "intelligence");
  const levels = c.seat.world.service?.levels ?? null;
  return html`<section class=${BOX} data-gw-intel-chief>
    ${head("chief")}
    ${p !== undefined
      ? personRow(c, p)
      : c.seat.world.candidates.intelligence === undefined
        ? // Held by someone the opening hasn't shown yet: not a vacancy.
          empty("chief.unmet")
        : html`<p class="text-sm text-amber-100" data-gw-intel-vacant>
              ${t("chief.vacant")}
            </p>
            <button
              class="${BTN} !px-2 !py-1"
              data-gw-intel-to-people
              @click=${() => {
                c.ui.tab = "people";
                c.redraw();
              }}
            >
              ${t("chief.to_people")}
            </button>`}
    ${levels === null
      ? empty("skill.none")
      : (["read", "guard", "hunt"] as const).map(
          (k) =>
            html`<div
              class="flex justify-between gap-2 text-sm"
              data-gw-intel-skill=${k}
              title=${t(`skill.${k}.hint`)}
            >
              <span class="text-white/70">${t(`skill.${k}.name`)}</span>
              <span>${t(`skill.${k}.${levels[k]}`)}</span>
            </div>`,
        )}
  </section>`;
}

/** Per front: the foe's strain and whether he is preparing, from reports. */
function fronts(c: GwCtx): TemplateResult | typeof nothing {
  const w = c.seat.world;
  const watched = w.fronts.filter((f) => f.foe !== undefined);
  if (watched.length === 0) return nothing;
  const rows = foreign(c).filter((r) => FRONT_FACTS.includes(r.fact));
  return html`<section class=${BOX} data-gw-intel-fronts>
    ${head("fronts")}
    ${watched.map((f) => {
      const here = newest(
        rows.filter((r) => r.theatre === f.id),
        (r) => r.fact,
      );
      const foe = f.foe?.tag ?? here[0]?.tag ?? null;
      return html`<div
        class="space-y-1 border-t border-white/10 pt-1.5"
        data-gw-intel-front=${f.id}
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold"
            >${translateText(`gw.ui.theatre.${f.id}`)}</span
          >
          ${foe === null
            ? nothing
            : html`<span class=${CHIP}>${country(foe)}</span>`}
          ${f.reading === true
            ? html`<span class="${MUTED} ml-auto">${t("codes.reading")}</span>`
            : nothing}
        </div>
        ${here.length === 0
          ? empty("fronts.none")
          : here.map((r) => report(c, r, true))}
      </div>`;
    })}
  </section>`;
}

/** Per country: everything else the reports say, newest per fact. */
function countries(c: GwCtx, rivals: readonly GwTag[]): TemplateResult {
  const fronts = new Set<string>(c.seat.world.fronts.map((f) => f.id));
  const rows = foreign(c).filter(
    (r) => r.theatre === null || !fronts.has(r.theatre),
  );
  const known = rivals.map((tag) => ({
    tag,
    rows: newest(
      rows.filter((r) => r.tag === tag),
      (r) => `${r.fact}.${r.theatre ?? ""}`,
    ),
  }));
  // Countries with nothing known fold into one line, with what to do.
  const blank = known.filter((k) => k.rows.length === 0).map((k) => k.tag);
  return html`<section class=${BOX} data-gw-intel-countries>
    ${head("countries")}
    ${rivals.length === 0 ? empty("countries.none") : nothing}
    ${known
      .filter((k) => k.rows.length > 0)
      .map(
        (k) =>
          html`<div
            class="space-y-1 border-t border-white/10 pt-1.5"
            data-gw-intel-country=${k.tag}
          >
            <div class="text-sm font-bold">${country(k.tag)}</div>
            ${k.rows.map((r) => report(c, r, false))}
          </div>`,
      )}
    ${blank.length === 0
      ? nothing
      : html`<p
          class="${MUTED} border-t border-white/10 pt-1.5"
          data-gw-intel-blank=${blank.join(" ")}
        >
          ${t("countries.nothing", {
            countries: blank.map(country).join(", "),
          })}
        </p>`}
  </section>`;
}

/** The codes we read, the risk of using them, and those we can't read. */
function codes(c: GwCtx, rivals: readonly GwTag[]): TemplateResult {
  const reads = c.seat.world.service?.reads ?? [];
  const unread = rivals.filter((x) => !reads.some((r) => r.tag === x));
  return html`<section class=${BOX} data-gw-intel-codes>
    ${head("codes")} ${reads.length === 0 ? empty("codes.none") : nothing}
    ${reads.map(
      (r) =>
        html`<div class="text-sm" data-gw-intel-read=${r.tag}>
          <p class="text-white/85">
            ${t("codes.read", { country: country(r.tag) })}
          </p>
          <p class=${r.named.length > 0 ? "text-amber-200" : MUTED}>
            ${r.named.length > 0
              ? t("codes.risk", {
                  fronts: r.named
                    .map((x) => translateText(`gw.ui.theatre.${x}`))
                    .join(", "),
                })
              : t("codes.quiet")}
          </p>
        </div>`,
    )}
    ${unread.length === 0
      ? nothing
      : html`<p class=${MUTED} data-gw-intel-unread>
          ${t("codes.unread", { countries: unread.map(country).join(", ") })}
        </p>`}
  </section>`;
}

/** Our nets abroad, and the rings caught on either side. */
function nets(c: GwCtx): TemplateResult {
  const i = c.seat.world.service;
  const me = c.seat.tag;
  const exposed = c.seat.world.news.filter(
    (n) =>
      (n.key === "spy_exposed" && (n.a === me || n.b === me)) ||
      // ww178: a country's mobilisation day takes every ring it knew of.
      (n.key === "spy_rolled_up" && n.a !== null),
  );
  const caught = i?.caught ?? [];
  const turned = i?.turned ?? [];
  const rings = caught.length + turned.length + exposed.length;
  return html`<section class=${BOX} data-gw-intel-nets>
    ${head("nets")}
    ${(i?.nets ?? []).length === 0
      ? empty("nets.none")
      : i!.nets.map(
          (n) =>
            html`<div
              class="flex justify-between gap-2 text-sm"
              data-gw-intel-net=${n.tag}
            >
              <span class="text-white/70">${country(n.tag)}</span>
              <span>${t(`nets.size.${Math.min(3, n.size)}`)}</span>
            </div>`,
        )}
    <div class=${MUTED}>${t("rings.title")}</div>
    ${rings === 0 ? empty("rings.none") : nothing}
    ${caught.map(
      (x) =>
        html`<p class="text-sm text-amber-100" data-gw-intel-caught=${x.tag}>
          ${t("rings.caught", { country: country(x.tag) })}
        </p>`,
    )}
    ${turned.map(
      (x) =>
        html`<p class="text-sm text-white/85" data-gw-intel-turned=${x}>
          ${t("rings.turned", { country: country(x) })}
        </p>`,
    )}
    ${exposed.map(
      (n) =>
        html`<p class="text-sm text-white/85" data-gw-intel-exposed>
          ${n.key === "spy_rolled_up"
            ? n.a === me
              ? t("rings.we_rolled_up")
              : t("rings.rolled_up", { country: country(n.a ?? "") })
            : n.a === me
              ? t("rings.we_caught", { country: country(n.b ?? "") })
              : t("rings.ours_caught", { country: country(n.a ?? "") })}
          <span class=${MUTED}>· ${ageWord(c.data.chapter, n.chapter)}</span>
        </p>`,
    )}
  </section>`;
}

/** The 뒷공작 rows, as on the schedule, and how the last ones went. */
function ops(c: GwCtx): TemplateResult {
  const rows = (c.seat.acts ?? []).filter((a) => a.kind === "intrigue");
  const done = [...(c.seat.world.service?.ops ?? [])].reverse();
  return html`<section class=${BOX} data-gw-intel-ops>
    <div class="flex items-center gap-2">
      <h3 class=${HEAD}>${t("ops.title")}</h3>
      <span class="${CHIP} ml-auto"
        >${translateText("gw.act.left", { n: c.seat.actsLeft ?? 0 })}</span
      >
    </div>
    <p class="text-sm text-white/70" data-gw-intel-why>${t("ops.why")}</p>
    ${rows.length === 0 ? empty("ops.none") : rows.map((a) => actRow(c, a))}
    ${done.length === 0
      ? nothing
      : html`<div class=${MUTED}>${t("ops.done")}</div>
          ${done.map(
            (o) =>
              html`<p class="text-sm text-white/85" data-gw-intel-op=${o.act}>
                ${t(`op.${o.act}`)}${o.tag === null
                  ? ""
                  : ` · ${country(o.tag)}`}
                —
                ${o.ok === null
                  ? t("ops.waiting")
                  : t(o.out ? "ops.out" : o.ok ? "ops.ok" : "ops.failed")}
              </p>`,
          )}`}
  </section>`;
}

/** The 정보부 tab. */
export function intelTab(c: GwCtx): TemplateResult {
  const rivals = rivalsOf(c);
  return html`<div class="space-y-2.5" data-gw-intel>
    <p class="text-sm text-white/75">${t("intro")}</p>
    ${chief(c)} ${fronts(c)} ${countries(c, rivals)} ${codes(c, rivals)}
    ${nets(c)} ${ops(c)}
  </div>`;
}
