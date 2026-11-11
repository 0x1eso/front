// ww179: the 정보부 tab. Everything the secret service knows, in one place:
// its chief, what we know of each rival (by front and by country), the codes
// we read, our nets abroad and the rings caught, and the 뒷공작 rows. Only the
// seat's own view: reports as they came, the service as it knows itself.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_SERVICE_BRANCHES,
  GW_SERVICE_SHARE_MAX,
  type GwServiceBranch,
} from "@openfront/engine-api/ww1914/GwSpies";
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
import { BTN, BTN_ON, CHIP, HEAD, MUTED } from "./GwStyle";
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
  // ww180: the agents abroad grow too; 1 until the service is funded.
  const abroad =
    c.seat.world.service?.fund?.branches[GW_SERVICE_BRANCHES.indexOf("abroad")]
      ?.level ?? 1;
  const skill = (k: string, level: number) =>
    html`<div
      class="flex justify-between gap-2 text-sm"
      data-gw-intel-skill=${k}
      title=${t(`skill.${k}.hint`)}
    >
      <span class="text-white/70">${t(`skill.${k}.name`)}</span>
      <span>${t(`skill.${k}.${level}`)}</span>
    </div>`;
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
      : html`${(["read", "guard", "hunt"] as const).map((k) =>
          skill(k, levels[k]),
        )}
        ${skill("abroad", abroad)}`}
  </section>`;
}

/** A branch's heading, -1 .. 3, as its word. */
const TREND = ["down", "hold", "up", "fast", "full"] as const;

/** The chief's skill word for each branch the money goes to. */
const BRANCH_SKILL: Record<GwServiceBranch, string> = {
  crypt: "read",
  counter: "hunt",
  secure: "guard",
  abroad: "abroad",
};

/**
 * ww180: the service's money and men. Each branch gets a share in words; a
 * bigger one makes it grow slowly, a cut lets it decay. What the share will
 * bring is not shown before the pick: only where each branch is heading now.
 */
function fund(c: GwCtx): TemplateResult {
  const f = c.seat.world.service?.fund;
  if (f === undefined) {
    return html`<section class=${BOX} data-gw-intel-fund>
      ${head("fund")} ${empty("fund.none")}
    </section>`;
  }
  const shares = Array.from({ length: GW_SERVICE_SHARE_MAX + 1 }, (_, i) => i);
  return html`<section class=${BOX} data-gw-intel-fund>
    ${head("fund")}
    ${f.branches
      .map((b, k) => ({ ...b, id: GW_SERVICE_BRANCHES[k] }))
      .map(
        (b) =>
          html`<div
            class="space-y-1 border-t border-white/10 pt-1.5"
            data-gw-intel-branch=${b.id}
          >
            <div class="flex flex-wrap items-baseline justify-between gap-x-2">
              <span
                class="text-sm text-white/85"
                title=${t(`skill.${BRANCH_SKILL[b.id]}.hint`)}
                >${t(`skill.${BRANCH_SKILL[b.id]}.name`)}</span
              >
              <span
                class=${b.trend < 0 ? "text-xs text-amber-200" : MUTED}
                title=${t("fund.trend_hint")}
                data-gw-intel-trend=${b.trend}
                >${t(`fund.trend.${TREND[b.trend + 1] ?? "hold"}`)}</span
              >
            </div>
            <div class="flex flex-wrap gap-1">
              ${shares.map(
                (v) =>
                  html`<button
                    class="${v === b.share ? BTN_ON : BTN} !px-2 !py-1"
                    data-gw-pick=${`service:${b.id}:${v}`}
                    aria-pressed=${v === b.share ? "true" : "false"}
                    title=${t(`fund.share_hint.${v}`)}
                    @click=${() =>
                      v === b.share
                        ? undefined
                        : c.send({ kind: "service", branch: b.id, share: v })}
                  >
                    ${t(`fund.share.${v}`)}
                  </button>`,
              )}
            </div>
          </div>`,
      )}
    <p class="${MUTED} border-t border-white/10 pt-1.5" data-gw-intel-room>
      ${t(`fund.nets.${Math.min(4, Math.max(1, f.nets))}`)}
    </p>
    ${f.broke
      ? html`<p class="text-sm text-amber-200" data-gw-intel-broke>
          ${t("fund.broke")}
        </p>`
      : nothing}
    <p
      class=${f.air ? "text-sm text-white/85" : MUTED}
      data-gw-intel-air=${f.air ? "yes" : "no"}
      title=${t("fund.air_hint")}
    >
      ${t(f.air ? "fund.air_yes" : "fund.air_no")}
    </p>
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

/** ww180: the sea section's own rows (the chain at sea, NavalIntel). */
const SEA_ROW = "gw_a_sea_";

/** ww180: our direction-finding chain at sea: what it is, its use, what it heard. */
function sea(c: GwCtx): TemplateResult | typeof nothing {
  const v = c.seat.world.sea;
  if (v === undefined) return nothing;
  const rows = (c.seat.acts ?? []).filter((a) => a.id.startsWith(SEA_ROW));
  const heard = [...v.log].reverse();
  return html`<section class=${BOX} data-gw-intel-sea>
    ${head("sea")}
    ${v.stations === 0
      ? empty(v.atSea ? "sea.none" : "sea.not_at_sea")
      : html`<div
            class="flex justify-between gap-2 text-sm"
            data-gw-intel-stations=${v.stations}
            title=${t("sea.stations.hint")}
          >
            <span class="text-white/70">${t("sea.stations.name")}</span>
            <span>${t(`sea.stations.${Math.min(3, v.stations)}`)}</span>
          </div>
          <div
            class="flex justify-between gap-2 text-sm"
            data-gw-intel-use=${v.use ?? 0}
            title=${t(`sea.use.${v.use ?? 0}.hint`)}
          >
            <span class="text-white/70">${t("sea.use.name")}</span>
            <span>${t(`sea.use.${v.use ?? 0}.word`)}</span>
          </div>`}
    ${v.stations === 0
      ? nothing
      : heard.length === 0
        ? empty("sea.heard.none")
        : heard.map(
            (h) =>
              html`<p
                class="text-sm text-white/85"
                data-gw-intel-heard=${h.kind}
              >
                ${t(`sea.heard.${h.kind}`, { country: country(h.tag) })}
                ${t(
                  `sea.heard.${h.used ? "used" : "kept"}.${h.kind}`,
                )}${h.decoded
                  ? html` <span
                      class=${MUTED}
                      title=${t("sea.heard.decoded_hint")}
                      >· ${t("sea.heard.decoded")}</span
                    >`
                  : nothing}
                <span class=${MUTED}
                  >· ${ageWord(c.data.chapter, h.chapter)}</span
                >
              </p>`,
          )}
    ${rows.map((a) => actRow(c, a))}
  </section>`;
}

/** ww180: the rows with a section of their own below. */
const AGENT_ACT = "gw_a_agent_hire";
const PROP_ACTS: readonly string[] = [
  "gw_a_prop_home",
  "gw_a_prop_hush",
  "gw_a_prop_leaflets",
  "gw_a_prop_papers",
];

/** An agent's name, with what he does and his story on hover. */
function agentName(id: string): TemplateResult {
  return html`<span
    class="text-sm font-bold"
    title=${translateText(`gw.agent.${id}.bio`)}
    >${translateText(`gw.agent.${id}.name`)}</span
  >`;
}

/** ww180: our named agents, and whom the service could still hire. */
function agents(c: GwCtx): TemplateResult {
  const v = c.seat.world.agents;
  const mine = v?.mine ?? [];
  const pool = v?.pool ?? [];
  const row = (c.seat.acts ?? []).find((a) => a.id === AGENT_ACT);
  return html`<section class=${BOX} data-gw-intel-agents>
    ${head("agents")}
    ${mine.length === 0 && pool.length === 0
      ? empty("agents.none")
      : html`<div class=${MUTED}>${t("agents.mine")}</div>
          ${mine.length === 0 ? empty("agents.mine_none") : nothing}`}
    ${mine.map(
      (a) =>
        html`<div class="text-sm" data-gw-intel-agent=${a.id}>
          <div class="flex items-center gap-2">
            ${agentName(a.id)}
            <span class="${CHIP} ml-auto"
              >${t(`agents.fate.${a.fate ?? "working"}`)}</span
            >
          </div>
          <p class=${MUTED}>
            ${t("agents.at", { country: country(a.at) })} ·
            ${translateText(`gw.agent.${a.id}.work`)}
          </p>
        </div>`,
    )}
    ${pool.length === 0
      ? nothing
      : html`<div class=${MUTED}>${t("agents.pool")}</div>`}
    ${pool.map(
      (p) =>
        html`<div class="space-y-0.5 text-sm" data-gw-intel-pool=${p.id}>
          <div class="flex items-center gap-2">
            ${agentName(p.id)}
            <span class="${MUTED} ml-auto">${country(p.at)}</span>
          </div>
          <p class="text-white/75">${translateText(`gw.agent.${p.id}.work`)}</p>
          ${p.open && row !== undefined
            ? html`<button
                class="${BTN} !px-2 !py-1"
                data-gw-intel-hire=${p.id}
                ?disabled=${(c.seat.actsLeft ?? 0) <= 0}
                @click=${() => {
                  c.ui.actOpen = AGENT_ACT;
                  c.ui.actPicks = { who: [p.id] };
                  c.redraw();
                }}
              >
                ${t("agents.hire")}
              </button>`
            : html`<p class=${p.open ? "text-amber-100" : MUTED}>
                ${p.open
                  ? t("agents.open")
                  : t(`agents.wait.${p.wait ?? "gone"}`, {
                      country: country(p.at),
                    })}
              </p>`}
        </div>`,
    )}
    ${row === undefined ? nothing : actRow(c, row)}
  </section>`;
}

/** ww180: propaganda and censorship: what runs, the rows, how it went. */
function propaganda(c: GwCtx): TemplateResult {
  const v = c.seat.world.prop;
  const rows = (c.seat.acts ?? []).filter((a) => PROP_ACTS.includes(a.id));
  const on: string[] = [];
  if (v?.home === true) on.push(t("prop.home_on"));
  if (v?.hush === true) on.push(t("prop.hush_on"));
  if ((v?.leaflets.length ?? 0) > 0) {
    on.push(
      t("prop.leaflets_on", { countries: v!.leaflets.map(country).join(", ") }),
    );
  }
  if ((v?.papers.length ?? 0) > 0) {
    on.push(
      t("prop.papers_on", { countries: v!.papers.map(country).join(", ") }),
    );
  }
  const done = [...(v?.ops ?? [])].reverse();
  // A campaign still on that has done nothing yet hasn't failed.
  const still = (o: { act: string; tag: string | null }) =>
    v !== undefined &&
    (o.act === "home"
      ? v.home
      : o.act === "hush"
        ? v.hush
        : o.act === "leaflets"
          ? v.leaflets.some((x) => x === o.tag)
          : v.papers.some((x) => x === o.tag));
  return html`<section class=${BOX} data-gw-intel-prop>
    ${head("prop")}
    ${on.length === 0
      ? empty("prop.idle")
      : on.map(
          (x) =>
            html`<p class="text-sm text-white/85" data-gw-intel-prop-on>
              ${x}
            </p>`,
        )}
    ${rows.length === 0 ? empty("prop.none") : rows.map((a) => actRow(c, a))}
    ${done.length === 0
      ? nothing
      : html`<div class=${MUTED}>${t("prop.done")}</div>
          ${done.map(
            (o) =>
              html`<p
                class="text-sm text-white/85"
                data-gw-intel-prop-op=${o.act}
              >
                ${t(`op.${o.act}`)}${o.tag === null
                  ? ""
                  : ` · ${country(o.tag)}`}
                —
                ${o.ok === null
                  ? t("ops.waiting")
                  : o.out
                    ? t("ops.out")
                    : o.ok
                      ? t("ops.ok")
                      : still(o) &&
                          o ===
                            done.find((x) => x.act === o.act && x.tag === o.tag)
                        ? t("prop.running")
                        : t("ops.failed")}
              </p>`,
          )}`}
  </section>`;
}

/** The 뒷공작 rows, as on the schedule, and how the last ones went. */
function ops(c: GwCtx): TemplateResult {
  const rows = (c.seat.acts ?? []).filter(
    (a) =>
      a.kind === "intrigue" &&
      !a.id.startsWith(SEA_ROW) &&
      a.id !== AGENT_ACT &&
      !PROP_ACTS.includes(a.id),
  );
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
    ${chief(c)} ${fund(c)} ${fronts(c)} ${countries(c, rivals)}
    ${codes(c, rivals)} ${sea(c)} ${nets(c)} ${agents(c)} ${ops(c)}
    ${propaganda(c)}
  </div>`;
}
