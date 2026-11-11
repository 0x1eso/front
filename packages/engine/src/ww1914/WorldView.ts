import {
  GW_FRONT_UP,
  GW_GAUGE_MAX,
  GW_GAUGES,
  GW_LINES,
  GW_SIDES,
  GwGauge,
  GwOffice,
  GwSeatState,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCountryView,
  GwFrontView,
  GwGaugeView,
  GwIntelView,
  GwPersonWorldView,
  GwReportView,
  GwWorldView,
} from "@openfront/engine-api/ww1914/GwWorldView";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_PREMIER_PICKS } from "@openfront/engine-lib/ww1914/StoryRows";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { tasksShown } from "./Aims";
import { budgetView } from "./Budget";
import { craftView } from "./Craft";
import { dossierView } from "./Dossier";
import { eraOf, researchView } from "./Eras";
import { ownFronts, proposalsFor } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { houseView } from "./House";
import { lawsAhead, lawViews } from "./Laws";
import { prepView } from "./Offensives";
import {
  candidatesFor,
  dismissPrice,
  officeHolder,
  standingOffices,
} from "./People";
import { generalsFor } from "./Post";
import { pressView } from "./Press";
import { holderOf, holds } from "./SceneRun";
import { foeOn, foeRead, fundView, reads, rivalsOf } from "./Spies";
import { endStrain, strainWord } from "./Strain";
import { GW_ACTORS, GW_COMMAND_NAMED_AFTER } from "./Tables";
import { sideIn } from "./Wars";
import { fights, lastOf, ownPeople } from "./World";

const NEWS_SHOWN = 16;
const VOTES_SHOWN = 6;
const REPORTS_SHOWN = 16;
/** Results before people have an opinion of someone. */
const REPUTE_AFTER = 3;

/** Words for a gauge: 0 (gone) .. 3 (plenty); a 0..5 gauge folds into them. */
function wordOf(g: GwGauge, v: number): number {
  return GW_GAUGE_MAX[g] === 3 ? v : Math.floor((v * 3 + 4) / 5);
}

/** A sea scale in the words a paper would use, 0..3. */
const seaWord = (v: number) => Math.min(3, Math.floor((v + 1) / 3));

function gaugeView(gw: GreatWar, seat: GwSeatState): GwGaugeView[] {
  const n = gw.nation(seat.tag)!;
  const last = gw.s.chapter - 1;
  return GW_GAUGES.map((gauge) => ({
    gauge,
    value: n.gauges[gauge],
    word: wordOf(gauge, n.gauges[gauge]),
    lines: seat.lines
      .filter((l) => l.gauge === gauge && l.chapter >= last)
      .map((l) => ({ key: l.key, delta: l.delta })),
  }));
}

/**
 * The name the war tab gives a front. The sea is the navy minister's whoever
 * has it now; a chief of staff filling a gap in the list commands nothing there.
 */
function namedCommander(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwTheatreState,
): string | null {
  if (t.id === "sea") return officeHolder(gw, seat, "navy")?.id ?? null;
  const id = t.commander;
  if (id === null || gw.person(id)?.office === "chief_of_staff") return null;
  const after = GW_COMMAND_NAMED_AFTER[id];
  if (after === undefined) return id;
  return after.some((f) => seat.flags.includes(f)) ? id : null;
}

function frontView(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwTheatreState,
): GwFrontView {
  const side =
    sideIn(gw, t.id, seat.tag) ?? gw.nation(seat.tag)?.side ?? GW_SIDES[0];
  const mine = GW_SIDES.indexOf(side);
  const own = sideIn(gw, t.id, seat.tag);
  const b = lastOf(gw.s.battles.filter((x) => x.theatre === t.id));
  return {
    id: t.id,
    line: GW_LINES[t.id][t.line],
    lineIndex: t.line,
    lineCount: GW_LINES[t.id].length,
    progress: t.progress,
    up: GW_FRONT_UP[t.id],
    trench: t.trench,
    commander: namedCommander(gw, seat, t),
    // Our own end only: the enemy's strain is never the seat's to read.
    ...(own === null ? {} : { strain: strainWord(endStrain(t, own)) }),
    // Only our own great offensive: another's never reaches this view.
    prep: prepView(gw, seat.tag, t.id),
    ...foeLine(gw, seat, t),
    last:
      b === undefined
        ? null
        : {
            result: b.result,
            by: b.by,
            ours: b.lost[mine],
            theirs: b.lost[1 - mine],
            luck: b.luck,
          },
  };
}

/** ww173: the card's "적의 사정" from the seat's own reports, and its reading. */
function foeLine(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwTheatreState,
): Pick<GwFrontView, "foe" | "reading"> {
  const foe = foeOn(gw, t.id, seat.tag);
  if (foe === null) return { foe: null, reading: false };
  const r = foeRead(gw, seat, t.id, foe);
  return {
    foe: r === null ? null : { tag: foe, ...r },
    reading: reads(gw, seat.tag, foe),
  };
}

/**
 * ww179: the 정보부 tab. Only the seat's own service, read without filling it
 * (`intelOf` would write state). An operation ordered this chapter keeps its
 * result, and a net it planted, until its card comes next chapter.
 */
export function intelView(gw: GreatWar, seat: GwSeatState): GwIntelView {
  const i = gw.nation(seat.tag)?.intel;
  if (i === undefined) {
    return {
      levels: null,
      rivals: rivalsOf(gw, seat.tag),
      reads: [],
      nets: [],
      caught: [],
      turned: [],
      ops: [],
    };
  }
  const now = gw.s.chapter;
  const pending = (o: { chapter: number }) => o.chapter >= now;
  const unseen = (tag: string) =>
    i.ops.filter((o) => pending(o) && o.act === "net" && o.ok && o.tag === tag)
      .length;
  return {
    levels: { read: i.crypt, guard: i.secure, hunt: i.counter },
    rivals: rivalsOf(gw, seat.tag),
    reads: i.reads.map((tag) => ({
      tag,
      named: [
        ...new Set(i.readOn.filter((e) => e.tag === tag).map((e) => e.theatre)),
      ],
    })),
    nets: (Object.keys(i.net) as (keyof typeof i.net)[])
      .map((tag) => ({ tag, size: (i.net[tag] ?? 0) - unseen(tag) }))
      .filter((n) => n.size > 0),
    caught: i.caught.map((c) => ({ tag: c.tag, chapter: c.chapter })),
    turned: [...i.turned],
    ops: i.ops.map((o) => ({
      act: o.act,
      tag: o.tag,
      ok: pending(o) ? null : o.ok,
      out: pending(o) ? null : o.out,
      chapter: o.chapter,
    })),
    fund: fundView(gw, seat.tag),
  };
}

function reportView(gw: GreatWar, seat: GwSeatState): GwReportView[] {
  return gw.s.reports
    .filter((r) => r.smallID === seat.smallID)
    .slice(-REPORTS_SHOWN)
    .map((r) => {
      const checked = r.stamp === "unconfirmed" && r.checkDay === null;
      return {
        uid: r.uid,
        fact: r.fact,
        tag: r.tag,
        theatre: r.theatre,
        source: r.source,
        stamp: r.stamp,
        claim: r.claim,
        chapter: r.chapter,
        checked,
        corrected: checked && r.claim !== r.truth ? r.truth : null,
        about: r.about ?? null,
      };
    });
}

function personView(gw: GreatWar, seat: GwSeatState): GwPersonWorldView[] {
  return ownPeople(gw, seat.tag).map((p) => {
    const seen = p.wins + p.losses;
    const repute =
      seen < REPUTE_AFTER
        ? 0
        : p.wins * 2 >= seen * 1 + 1
          ? p.wins > p.losses * 2
            ? 3
            : 2
          : 1;
    return {
      id: p.id,
      wins: p.wins,
      losses: p.losses,
      repute,
      letter: p.letter !== null,
      ailing: p.ailing !== null,
      dismissPrice: dismissPrice(p.id),
    };
  });
}

const isoOf = (day: number) => formatIsoDate(civilFromDays(day));

function countries(gw: GreatWar): GwCountryView[] {
  return GW_ACTORS.flatMap((tag) => {
    const n = gw.nation(tag);
    if (n === null) return [];
    return [
      {
        tag,
        side: n.side,
        out: n.out,
        mob: n.mob,
        mobFrom: n.mobFrom === null ? null : isoOf(n.mobFrom),
        mobFull: n.mobFull === null ? null : isoOf(n.mobFull),
      },
    ];
  });
}

/** Offices that don't exist until the war makes them. */
const OFFICE_FROM: Partial<Record<GwOffice, string>> = { munitions: "1915-05" };

export function worldView(gw: GreatWar, seat: GwSeatState): GwWorldView {
  const s = gw.s;
  const n = gw.nation(seat.tag)!;
  const candidates: GwWorldView["candidates"] = Object.fromEntries(
    [
      ...new Set([
        ...standingOffices(seat.tag),
        ...(Object.keys(OFFICE_FROM) as GwOffice[]),
      ]),
    ].flatMap((o) => {
      const from = OFFICE_FROM[o];
      const ctx = { gw, seat, cast: {} };
      if (from !== undefined && !holds(ctx, world({ is: "date", from }))) {
        return [];
      }
      // France's premier comes from the consultations, not the vacancy list.
      if (o === "chancellor" && GW_PREMIER_PICKS[seat.tag] !== undefined) {
        return [];
      }
      // Only an office nobody holds. The client reads vacancies off the people
      // it is shown, and a first game's opening hides holders not yet met: a
      // list for a held office showed it as vacant, and a pick quietly
      // replaced the unseen minister with another unseen man.
      if (holderOf(gw, seat, o) !== null) return [];
      const list = candidatesFor(gw, seat, o);
      return list.length > 0 ? [[o, list]] : [];
    }),
  );
  const usa = gw.nation("USA");
  const laws = lawViews(gw, seat);
  return {
    war: {
      era: eraOf(gw).id,
      regime: n.regime,
      command: n.command,
      blockade: seaWord(s.blockade),
      shipping: seaWord(s.shipping),
      uboat: s.uboat,
      america: usa === null ? 0 : Math.min(3, Math.floor(usa.readiness / 25)),
      techs: n.techs,
      research: {
        track: seat.alloc.research,
        active: fights(n),
        tracks: researchView(gw, n),
      },
      armistice: s.armistice?.kind ?? null,
      votes: seat.votes.slice(-VOTES_SHOWN),
    },
    gauges: gaugeView(gw, seat),
    authority: n.authority,
    manpower: n.manpower,
    casualties: n.casualties,
    unrest: n.unrest,
    side: n.side,
    plan: s.plan,
    signed: seat.signed === s.chapter,
    proposals: proposalsFor(gw, seat),
    tempo: seat.tempo ?? null,
    fronts: ownFronts(gw, seat).map((t) => frontView(gw, seat, t)),
    generals: generalsFor(gw, seat),
    chain:
      s.chain === null
        ? null
        : { topic: s.chain.topic, step: s.chain.step, hold: s.chain.hold },
    chainEnds: s.chains.map((c) => ({ topic: c.topic, outcome: c.outcome })),
    reports: reportView(gw, seat),
    service: intelView(gw, seat),
    sources: s.sources.map((x) => ({
      id: x.id,
      right: x.right,
      wrong: x.wrong,
    })),
    mandates: tasksShown(gw, seat) ? seat.mandates : [],
    secrets: seat.known as GwWorldView["secrets"],
    threads: s.threads,
    people: personView(gw, seat),
    candidates,
    countries: countries(gw),
    news: s.news.slice(-NEWS_SHOWN),
    memoir: seat.memoir,
    budget: budgetView(gw, seat),
    laws,
    ...(laws.length === 0 && lawsAhead(gw, seat)
      ? { lawsAhead: true as const }
      : {}),
    press: pressView(gw, seat),
    craft: craftView(gw, seat),
    house: houseView(gw, seat),
    dossier: dossierView(gw, seat),
  };
}
