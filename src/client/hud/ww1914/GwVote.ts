// Great War 1914: the vote scene (ww203 §5), the one new visual. An overlay in
// the HUD's dark glass: the chamber's seats as dots in its shape, cast block
// by block as the engine's ballot record says (the government's friends, then
// the waverers, then the lobbied), the tally under it, and the stamp the
// moment the line is crossed. A second chamber plays shorter. Skippable;
// reduced motion shows the end at once; on a phone the chamber sits on top.
import type {
  GwBallot,
  GwBallotBlock,
  GwBallotCast,
} from "@openfront/engine-api/ww1914/GwHouse";
import { html, nothing, svg, TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { translateText } from "../../Utils";
import { billName, textName } from "./GwBook";
import type { GwCtx } from "./GwCtx";
import { factionName } from "./GwHouse";
import { defyLine } from "./GwMoneyWords";
import { CAST_COLOR, GLASS, HEAD, MUTED } from "./GwStyle";
import { fullDate, personName } from "./GwText";
import {
  tallyAt,
  VOTE_H,
  VOTE_W,
  votePlan,
  type GwVoteDot,
  type GwVotePlan,
} from "./GwVoteModel";

/**
 * Who brings the ruler the count (ww203 §5): the Kaiser, the Tsar and the
 * Emperor hear the chancellor's or premier's report, Poincaré is told by the
 * premier, Asquith sits on the front bench.
 */
function frameLine(c: GwCtx): string | null {
  if (c.seat.tag === "GBR") return translateText("gw.vote.frame.bench");
  const head = c.seat.people.find((p) => p.office === "chancellor");
  if (head === undefined) return null;
  const name = personName(c.pack, head.id);
  return c.seat.tag === "FRA"
    ? translateText("gw.vote.frame.told", { name })
    : translateText("gw.vote.frame.report", { name });
}

const castWord = (cast: GwBallotCast): string =>
  translateText(`gw.vote.${cast}`);

/** A chamber after the first plays at this pace. */
const SHORTER = 0.6;
/** The pause between two chambers, ms. */
const GAP = 600;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The scene's clock: which ballot plays, from when, and whether it is over. */
export class GwVote {
  ballot: GwBallot | null = null;
  plans: GwVotePlan[] = [];
  /** Skipped, played out, or reduced motion: every chamber as it ended. */
  still = false;
  private start = 0;
  /** The last uid offered: each plays once. */
  private seen: number | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {}

  get active(): boolean {
    return this.ballot !== null;
  }

  /**
   * A fresh view's ballot. A new uid plays; the one standing when the screen
   * first loads (a reload, a save) is only remembered.
   */
  offer(
    b: GwBallot | null,
    blocOf: (faction: string) => string | null,
  ): boolean {
    const first = this.seen === null;
    if (b === null) {
      this.seen ??= -1;
      return false;
    }
    if (b.uid === this.seen) return false;
    this.seen = b.uid;
    if (first) return false;
    this.ballot = b;
    this.plans = b.chambers.map((ch, i) =>
      votePlan(ch, blocOf, i === 0 ? 1 : SHORTER),
    );
    this.start = this.now();
    this.still = reducedMotion() || this.plans.length === 0;
    return true;
  }

  /** The chamber playing and ms into it; null once all have played. */
  at(): { k: number; t: number } | null {
    if (this.ballot === null || this.still) return null;
    let t = this.now() - this.start;
    for (let k = 0; k < this.plans.length; k++) {
      const len = this.plans[k].end + (k < this.plans.length - 1 ? GAP : 0);
      if (t < len) return { k, t };
      t -= len;
    }
    return null;
  }

  /** On the panel's tick: true while the screen must redraw. */
  tick(): boolean {
    if (this.ballot === null || this.still) return false;
    if (this.at() === null) this.still = true;
    return true;
  }

  skip(): void {
    if (this.ballot !== null) this.still = true;
  }

  close(): void {
    this.ballot = null;
    this.plans = [];
    this.still = false;
  }
}

// ---- Drawing ----

const KEYFRAMES = html`<style>
  @keyframes gwvdraw {
    from {
      stroke-dashoffset: 400;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes gwvcast {
    from {
      fill: transparent;
      stroke: var(--s0);
    }
    to {
      fill: var(--f1);
      stroke: var(--s1);
    }
  }
  @keyframes gwvpromise {
    from {
      fill: transparent;
      stroke: var(--s0);
    }
    to {
      fill: var(--fa);
      stroke: var(--fa);
    }
  }
  @keyframes gwvpulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.3;
    }
  }
  @keyframes gwvwalk {
    to {
      transform: translate(var(--dx), var(--dy));
    }
  }
  @keyframes gwvfade {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes gwvstamp {
    from {
      opacity: 0;
      transform: rotate(-8deg) scale(1.8);
    }
    to {
      opacity: 1;
      transform: rotate(-8deg) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-gw-vote] * {
      animation: none !important;
    }
  }
</style>`;

const WAVER_STROKE = "#94a3b8";
const EMPTY = "#475569";

/** A dot's look once cast: for solid in its bloc's tint, against a red ring, away grey. */
function castLook(d: GwVoteDot): { fill: string; stroke: string } {
  switch (d.cast) {
    case "for":
      return { fill: d.color, stroke: d.color };
    case "against":
      return { fill: "rgba(248,113,113,0.18)", stroke: CAST_COLOR.against };
    case "away":
      return { fill: "#334155", stroke: EMPTY };
    default:
      return { fill: "transparent", stroke: EMPTY };
  }
}

const ms = (n: number): string => `${Math.round(n)}ms`;

function dotAnimated(d: GwVoteDot, r: number, sw: number) {
  if (d.cast === null) {
    return svg`<circle cx=${d.x} cy=${d.y} r=${r} fill="transparent"
      stroke=${EMPTY} stroke-width=${sw} opacity="0.5" />`;
  }
  const look = castLook(d);
  const s0 = d.waver ? WAVER_STROKE : d.color;
  const anim: string[] = [];
  if (d.waver) {
    // Grey and pulsing until it decides.
    const n = Math.max(1, Math.floor(d.at / 350));
    anim.push(`gwvpulse 350ms ease-in-out 0ms ${n} alternate`);
  }
  if (d.from !== null) anim.push(`gwvpromise 200ms ${ms(d.from)} both`);
  anim.push(
    `gwvcast 250ms ${ms(d.at)} ${d.from === null ? "both" : "forwards"}`,
  );
  let walk = "";
  if (d.to !== null) {
    anim.push(`gwvwalk 600ms ease-in-out ${ms(d.at)} forwards`);
    walk = `--dx:${d.to.x - d.x}px;--dy:${d.to.y - d.y}px;`;
  }
  const style =
    `--s0:${s0};--f1:${look.fill};--s1:${look.stroke};--fa:${d.color};` +
    `${walk}fill:transparent;stroke:${s0};animation:${anim.join(",")}`;
  return svg`<circle cx=${d.x} cy=${d.y} r=${r} stroke-width=${sw}
    style=${style} />`;
}

function dotStill(d: GwVoteDot, r: number, sw: number) {
  const look = castLook(d);
  const p = d.to ?? d;
  return svg`<circle cx=${p.x} cy=${p.y} r=${r} fill=${look.fill}
    stroke=${look.stroke} stroke-width=${sw}
    opacity=${d.cast === null ? 0.5 : 1} />`;
}

/** The room's lines: a hemicycle, the benches and lobbies, the table. */
function outline(plan: GwVotePlan, animated: boolean) {
  const style = animated
    ? "stroke-dasharray:400;animation:gwvdraw 500ms ease-out both"
    : "";
  if (plan.shape === "benches") {
    const label = (x: number, key: string) =>
      svg`<text x=${x} y="103" font-size="5" text-anchor="middle"
        fill="rgba(255,255,255,0.6)">${translateText(key)}</text>`;
    return svg`<g fill="none" stroke="rgba(255,255,255,0.35)"
        stroke-width="0.4" style=${style}>
        <rect x="44" y="6" width="112" height="42" rx="1" pathLength="400" />
        <rect x="44" y="60" width="112" height="42" rx="1" pathLength="400" />
        <rect x="1" y="6" width="40" height="90" rx="1" pathLength="400" />
        <rect x="159" y="6" width="40" height="90" rx="1" pathLength="400" />
      </g>
      ${label(21, "gw.vote.lobby_against")} ${label(179, "gw.vote.lobby_for")}`;
  }
  if (plan.shape === "table") {
    return svg`<rect x="46" y="32" width="108" height="46" rx="2"
      pathLength="400" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)"
      stroke-width="0.4" style=${style} />`;
  }
  const cx = VOTE_W / 2;
  const cy = VOTE_H - 6;
  return svg`<path
    d=${`M ${cx - 99} ${cy} A 99 99 0 0 1 ${cx + 99} ${cy} M ${cx - 30} ${cy} A 30 30 0 0 1 ${cx + 30} ${cy} M ${cx - 99} ${cy} L ${cx + 99} ${cy}`}
    pathLength="400" fill="none" stroke="rgba(255,255,255,0.35)"
    stroke-width="0.4" style=${style} />`;
}

function stampWord(plan: GwVotePlan): string {
  return translateText(
    `gw.vote.stamp.${plan.pass ? "pass" : plan.delay ? "delay" : "fail"}`,
  );
}

function stamp(plan: GwVotePlan, animated: boolean): TemplateResult {
  const color = plan.pass
    ? "border-amber-300 text-amber-300"
    : "border-red-400 text-red-400";
  const style = animated
    ? `animation:gwvstamp 350ms cubic-bezier(.2,1.4,.4,1) ${ms(plan.stampAt)} both`
    : "transform:rotate(-8deg)";
  return html`<div
    class="pointer-events-none absolute inset-0 flex justify-center ${plan.shape ===
    "arc"
      ? "items-end pb-[6%]"
      : "items-center"}"
  >
    <span
      class="${color} rounded-sm border-[3px] bg-slate-950/70 px-3 py-0.5 text-2xl font-black tracking-[0.3em] sm:text-3xl"
      data-gw-vote-stamp=${plan.pass ? "pass" : plan.delay ? "delay" : "fail"}
      style=${style}
      >${stampWord(plan)}</span
    >
  </div>`;
}

function blockName(c: GwCtx, b: GwBallotBlock): string {
  if (b.faction === null) return translateText("gw.vote.others");
  // ww209: a wing voting apart (defying its line, or met apart) is part of it.
  return b.wing === true
    ? translateText("gw.vote.wing_of", { faction: factionName(c, b.faction) })
    : factionName(c, b.faction);
}

function leaderOf(c: GwCtx, faction: string | null): string | null {
  if (faction === null) return null;
  const f = c.seat.world.house?.factions.find((x) => x.id === faction);
  return f?.leader === null || f?.leader === undefined
    ? null
    : personName(c.pack, f.leader);
}

/** One block's line in the log: who, how many, which way; the promise kept or broken. */
function logLine(
  c: GwCtx,
  b: GwBallotBlock,
  at: number,
  animated: boolean,
): TemplateResult {
  const cast = castWord(b.cast);
  // Who the log names: the leader who broke his word, or (ww209) the man of
  // a wing who stood up against his own party's line.
  const name =
    b.beat === "betray"
      ? leaderOf(c, b.faction)
      : b.beat === "defy" && b.person !== undefined
        ? personName(c.pack, b.person)
        : null;
  const beat =
    b.beat === "firm"
      ? null
      : b.beat === "defy"
        ? defyLine(name)
        : name !== null
          ? translateText("gw.vote.beat.betray_by", { name })
          : translateText(`gw.vote.beat.${b.beat}`);
  return html`<li
    class="flex items-baseline gap-1.5 text-xs"
    data-gw-vote-line=${b.beat}
    style=${animated ? `animation:gwvfade 300ms ${ms(at)} both` : ""}
  >
    <span
      class="inline-block h-2 w-2 shrink-0 rounded-full"
      style="background:${CAST_COLOR[b.cast]}"
    ></span>
    <span class="text-white/85">${blockName(c, b)}</span>
    <span class="text-white/55"
      >${translateText("gw.lobby.seats", { n: b.seats })} ${cast}</span
    >
    ${beat === null
      ? nothing
      : html`<span
          class=${b.beat === "betray" || b.beat === "defy"
            ? "font-bold text-red-300"
            : b.beat === "swing"
              ? "font-bold text-amber-200"
              : "text-white/45"}
          >${beat}</span
        >`}
  </li>`;
}

function tallyBox(
  c: GwCtx,
  plan: GwVotePlan,
  t: number,
  block: number,
  animated: boolean,
): TemplateResult {
  const n = tallyAt(plan, t);
  const present = Math.max(1, plan.present);
  const pct = (x: number) => `${Math.min(100, (x / present) * 100)}%`;
  const cell = (cast: GwBallotCast, v: number) =>
    html`<div class="flex-1 text-center" data-gw-vote-tally=${cast}>
      <div class="text-lg font-bold" style="color:${CAST_COLOR[cast]}">
        ${v}
      </div>
      <div class=${MUTED}>${castWord(cast)}</div>
    </div>`;
  return html`<div class="min-w-0 space-y-2 sm:w-56 sm:shrink-0">
    <div
      class="flex gap-1"
      role="group"
      aria-label=${translateText("gw.vote.tally", { ...n })}
    >
      ${cell("for", n.for)} ${cell("against", n.against)}
      ${cell("away", n.away)}
    </div>
    <div class="relative h-2.5 overflow-hidden rounded bg-white/10">
      <div
        class="absolute inset-y-0 left-0 transition-[width] duration-100"
        style="width:${pct(n.for)};background:${CAST_COLOR.for}"
      ></div>
      <div
        class="absolute inset-y-0 right-0 transition-[width] duration-100"
        style="width:${pct(n.against)};background:${CAST_COLOR.against}"
      ></div>
      <div class="absolute inset-y-0 left-1/2 w-px bg-white"></div>
    </div>
    <p class=${MUTED} data-gw-vote-need>
      ${translateText("gw.vote.line", { n: plan.need })}${block > 0
        ? ` · ${translateText("gw.vote.block_line", { n: block })}`
        : ""}
    </p>
    <ul class="max-h-36 space-y-0.5 overflow-y-auto sm:max-h-56">
      ${plan.lines.map((l) => logLine(c, l.block, l.at, animated))}
    </ul>
  </div>`;
}

function chamberView(
  c: GwCtx,
  b: GwBallot,
  k: number,
  plan: GwVotePlan,
  t: number | null,
): TemplateResult {
  const animated = t !== null;
  const ch = b.chambers[k];
  const sw = Math.max(0.2, plan.r * 0.4);
  return html`<div class="space-y-1.5" data-gw-vote-chamber=${ch.chamber}>
    <div class="flex items-baseline gap-2 text-sm">
      <span class="font-bold text-white"
        >${translateText("gw.vote.title", {
          chamber: translateText(`gw.house.chamber.${ch.chamber}`),
        })}</span
      >
      <span class=${MUTED}
        >${translateText("gw.lobby.seats", { n: ch.size })}</span
      >
      ${b.chambers.length > 1
        ? html`<span class="${MUTED} ml-auto"
            >${k + 1}/${b.chambers.length}</span
          >`
        : nothing}
    </div>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div class="relative min-w-0 flex-1">
        <svg
          viewBox="0 0 ${VOTE_W} ${VOTE_H}"
          class="block h-auto w-full"
          role="img"
          aria-label=${translateText(`gw.house.chamber.${ch.chamber}`)}
        >
          ${outline(plan, animated)}
          ${plan.dots.map((d) =>
            animated ? dotAnimated(d, plan.r, sw) : dotStill(d, plan.r, sw),
          )}
        </svg>
        ${stamp(plan, animated)}
      </div>
      ${tallyBox(c, plan, t ?? Infinity, ch.block, animated)}
    </div>
    ${ch.delay
      ? html`<p class="text-sm text-amber-100/90">
          ${translateText("gw.agenda.why.lords")}
        </p>`
      : nothing}
  </div>`;
}

/** The overlay; nothing while no vote plays. */
export function voteOverlay(
  c: GwCtx,
  v: GwVote,
): TemplateResult | typeof nothing {
  const b = v.ballot;
  if (b === null) return nothing;
  const now = v.at();
  const frame = frameLine(c);
  const how = translateText(`gw.vote.how.${b.how}`);
  return html`${KEYFRAMES}
    <div
      class="pointer-events-auto fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 p-2"
      data-gw-vote=${b.uid}
    >
      <div
        class="${GLASS} max-h-full w-full max-w-3xl space-y-2 overflow-y-auto rounded p-3 text-white"
      >
        <div class="space-y-0.5">
          ${frame === null ? nothing : html`<p class=${MUTED}>${frame}</p>`}
          <h3 class="${HEAD} !text-base">
            ${billName(c, b.law)}${b.text === null
              ? nothing
              : html` ·
                  <span class="font-normal"
                    >${textName(c, b.law, b.text)}</span
                  >`}
          </h3>
          <p class=${MUTED}>${fullDate(c.data.date)} · ${how}</p>
        </div>
        ${now === null
          ? b.chambers.map((_, k) => chamberView(c, b, k, v.plans[k], null))
          : keyed(
              `${b.uid}:${now.k}`,
              chamberView(c, b, now.k, v.plans[now.k], now.t),
            )}
        <div class="flex justify-end pt-1">
          <button
            class="rounded border border-amber-300/70 bg-amber-300/20 px-4 py-2 text-sm text-white hover:bg-amber-300/30"
            data-gw-vote-act=${now === null ? "close" : "skip"}
            @click=${() => {
              if (now === null) v.close();
              else v.skip();
              c.redraw();
            }}
          >
            ${translateText(now === null ? "gw.vote.close" : "gw.vote.skip")}
          </button>
        </div>
      </div>
    </div>`;
}
