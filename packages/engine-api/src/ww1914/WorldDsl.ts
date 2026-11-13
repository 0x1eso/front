// Great War 1914: what a scene can read of the world and do to it. These ride
// in SceneDsl as one condition kind and one effect kind, `world`, so the world
// grows here without touching the narrative's lists. Kinds are APPEND ONLY.
// engine/ww1914/WorldDsl.ts runs them. Conditions may read hidden values: a
// variant can differ on a truth the seat doesn't know. Show those only as text.
import { z } from "zod";
import {
  GW_ACCORD_KINDS,
  GW_AI_KINDS,
  GW_ARMISTICE_KINDS,
  GW_CHAIN_OUTCOMES,
  GW_CLIENTS,
  GW_ERAS,
  GW_FACT_KINDS,
  GW_FIELDS,
  GW_ISSUES,
  GW_LADDER_STEPS,
  GW_OFF_COUNTERS,
  GW_OFF_METHODS,
  GW_OFF_RESULTS,
  GW_OFFICES,
  GW_PLANS,
  GW_REFUSAL_ANSWERS,
  GW_RESULTS,
  GW_RULE_POLICIES,
  GW_SEA_ZONES,
  GW_SECRETS,
  GW_SIDES,
  GW_SOURCES,
  GW_STAMPS,
  GW_TECHS,
  GW_THEATRES,
  GW_THREADS,
  GW_WAR_ENDS,
  GW_WORLD_FLAGS,
  GwAccordKind,
  GwAiKind,
  GwArmisticeKind,
  GwChainOutcome,
  GwClient,
  GwEra,
  GwFactKind,
  GwField,
  GwIdSchema,
  GwIssue,
  GwLadderStep,
  GwOffCounter,
  GwOffice,
  GwOffMethod,
  GwOffResult,
  GwPlan,
  GwRefusalAnswer,
  GwResult,
  GwRulePolicy,
  GwSeaZone,
  GwSecret,
  GwSide,
  GwSource,
  GwStamp,
  GwTech,
  GwTheatre,
  GwThread,
  GwWarEnd,
  GwWorldFlag,
} from "./GreatWarTypes";
import {
  GW_AGENT_CANS,
  GW_PROP_ACTS,
  GW_PROP_CANS,
  GwAgentCan,
  GwPropAct,
  GwPropCan,
} from "./GwAgents";
import { GW_HOLDERS, GwHolder } from "./GwAssumes";
import {
  GW_BUDGET_ITEMS,
  GW_BUDGET_LINES,
  GW_BUDGET_SOURCES,
  GW_MONEY_BILLS,
  GW_TAX_KINDS,
  GwBudgetItem,
  GwBudgetLine,
  GwBudgetSource,
  type GwMoneyBill,
  type GwTaxKind,
} from "./GwBudget";
import { GW_TAGS, GwTag } from "./GwCountries";
import {
  GW_INVENT_STEPS,
  GW_INVENTION_STAGES,
  GW_PROJECT_PHASES,
  GW_PROJECT_STEPS,
  GW_SHORTAGES,
  GwInventionStage,
  GwInventStep,
  GwProjectPhase,
  GwProjectStep,
  GwShortage,
} from "./GwCraft";
import {
  GW_DEAL_FATES,
  GW_DEAL_KINDS,
  type GwDealFate,
  type GwDealKind,
} from "./GwDeals";
import {
  GW_FATES,
  GW_SETTLE_PLANS,
  GW_SIGN_HOWS,
  GwFate,
  GwSettlePlan,
  GwSignHow,
} from "./GwFate";
import {
  GW_ASK_STAGES,
  GW_CHAMBERS,
  GW_FACTION_STATUS,
  GW_LAW_ORIGINS,
  GW_VOTE_BANDS,
  GW_WHIP_WORDS,
  GwAskStage,
  GwChamber,
  GwFactionStatus,
  GwLawOrigin,
  GwVoteBand,
  GwWhipWord,
} from "./GwHouse";
import { GW_BILL_ACTS, GW_LAW_STAGES, GwBillAct, GwLawStage } from "./GwLaw";
import {
  GW_NAVAL_ACTS,
  GW_NAVAL_CANS,
  GwNavalAct,
  GwNavalCan,
} from "./GwNaval";
import {
  GwPlace,
  GwPlaceGroup,
  GwPlaceGroupSchema,
  GwPlaceSchema,
} from "./GwPlaces";
import { GW_AXES, GwAxis } from "./GwSociety";
import { GW_SPY_ACTS, GW_SPY_CANS, GwSpyAct, GwSpyCan } from "./GwSpies";

const GW_BUDGET_WHATS = ["treasury", "load", "prices", "lent"] as const;
type GwBudgetWhat = (typeof GW_BUDGET_WHATS)[number];

/** A person, as in SceneDsl (a role, an office holder, a name). */
export type GwWorldWho =
  | { role: string }
  | { office: GwOffice }
  | { person: string };

interface Range {
  min?: number;
  max?: number;
}

export type GwWorldCond =
  | { is: "thread"; id: GwThread }
  | { is: "mandate"; id: string }
  /** A secret the seat has found. `secret` (SceneDsl) asks if it exists. */
  | { is: "known"; id: GwSecret }
  /** The open crisis's link. */
  | ({ is: "chain"; short?: boolean } & Range)
  /** How a crisis closed, any crisis this game. */
  | { is: "chain_end"; of: GwChainOutcome[] }
  /** The seat's country is at war with anyone. */
  | { is: "war" }
  /** A country fights, on that side if named. */
  | { is: "entered"; tag: GwTag; side?: GwSide }
  /** A country has left the war. */
  | { is: "out"; tag: GwTag }
  /**
   * A theatre's line stands in a band, both ends included (ww187: both ends
   * are named; gwFirstLine / gwLastLine for an open end).
   */
  | { is: "front"; theatre: GwTheatre; from: string; to: string }
  | { is: "open"; theatre: GwTheatre }
  /** The theatre's last result; `by`: who attacked (seat: the seat's side). */
  | {
      is: "battle";
      theatre: GwTheatre;
      of: GwResult[];
      by?: GwSide | "seat" | "foe";
    }
  | { is: "plan"; of: GwPlan[] }
  | { is: "aside" }
  | ({ is: "mob"; tag: GwTag } & Range)
  | ({ is: "unrest" } & Range)
  | ({ is: "authority" } & Range)
  /** Thousands lost by the seat's country. */
  | ({ is: "casualties" } & Range)
  | ({ is: "manpower" } & Range)
  | ({ is: "uboat" } & Range)
  /** Chapters since the war began. */
  | ({ is: "war_age" } & Range)
  /** Whether the seat's side is ahead: warScore, about -100..100. */
  | ({ is: "score" } & Range)
  | { is: "plan_signed" }
  /** The seat's plan this chapter. */
  | { is: "main"; of: GwTheatre[] }
  /** A resignation letter is open. */
  | { is: "letter"; who: GwWorldWho }
  | { is: "ailing"; who: GwWorldWho }
  | ({ is: "wins"; who: GwWorldWho } & Range)
  | ({ is: "losses"; who: GwWorldWho } & Range)
  // Hidden truths: for variants and reacts, never to grey an option.
  | { is: "ai"; tag: GwTag; of: GwAiKind[] }
  | ({ is: "lean"; tag: GwTag } & Range)
  | ({ is: "force"; tag: GwTag; theatre: GwTheatre } & Range)
  | ({ is: "competence"; who: GwWorldWho; field: GwField } & Range)
  /** This source's last report on the seat's desk is wrong. */
  | { is: "report_wrong"; source: GwSource }
  | ({ is: "source_record"; source: GwSource } & Range)
  /** The form of government of a country, the seat's when no tag is named. */
  | { is: "regime"; tag?: GwTag; of: string[] }
  /** The period of the war. */
  | { is: "era"; of: GwEra[] }
  /** Research has reached this, the seat's country when no tag is named. */
  | { is: "tech"; id: GwTech; tag?: GwTag }
  | ({ is: "blockade" } & Range)
  | ({ is: "shipping" } & Range)
  /** How near America is to coming in, 0..100. */
  | ({ is: "america" } & Range)
  /** The fighting has stopped. */
  | { is: "armistice"; of?: GwArmisticeKind[] }
  /** The seat's side won, lost or neither: from the armistice. */
  | { is: "peace_side"; of: ("won" | "lost" | "even")[] }
  /** Ayes less noes if the cabinet voted on this now. */
  | ({ is: "votes"; issue: GwIssue } & Range)
  /** The last vote on this issue carried; a vote never held does not. */
  | { is: "carried"; issue: GwIssue }
  /** The head of state leads the army himself. */
  | { is: "command" }
  /** Chapters since this country came in, the seat's when no tag is named. */
  | ({ is: "in_war"; tag?: GwTag } & Range)
  /** A country stands neutral. */
  | { is: "neutral"; tag: GwTag }
  /** Which side the seat's country is on. */
  | { is: "side"; of: (GwSide | "neutral")[] }
  /** The game's date, "YYYY-MM", both ends included: any calendar. */
  | { is: "date"; from?: string; to?: string }
  /** The best price on the table for a neutral, from the seat's side. */
  | ({ is: "offered"; tag: GwTag } & Range)
  /**
   * The seat's money. treasury: steps of the money gauge. load: interest as a
   * percent of taxes. prices: percent of June 1914. lent: percent of a year's
   * revenue owed abroad.
   */
  | ({ is: "budget"; what: GwBudgetWhat } & Range)
  /** A bill stands at one of these stages. */
  | { is: "law"; id: string; of: GwLawStage[]; text?: string }
  /** Its count against whoever must pass it: 0 or more carries. */
  | ({ is: "law_count"; id: string } & Range)
  /** The bill can go past the body, and there is the authority to pay for it. */
  | { is: "law_decree"; id: string }
  /** How hot a threat to the government runs, by its row in GovTable. */
  | ({ is: "gov"; id: string } & Range)
  /** An election: the seats past a majority, friends counted. */
  | ({ is: "poll"; id: string } & Range)
  /** The same, the party alone. */
  | ({ is: "poll_own"; id: string } & Range)
  /** An invention stands at one of these stages; `early`: it went in early. */
  | {
      is: "invention";
      id: string;
      of: GwInventionStage[];
      early?: boolean;
    }
  /** A project is at one of these phases; no id: the running one, if any. */
  | { is: "project"; id?: string; of: GwProjectPhase[] }
  /** The country's footing, 0 peace .. 2 total mobilisation. */
  | ({ is: "footing" } & Range)
  /** A shortage is on (the default), or was answered. */
  | { is: "shortage"; id: GwShortage; solved?: boolean }
  // ---- The house (ww158, S1) ----
  /** A faction stands at one of these statuses (any if absent), strength in range. */
  | ({ is: "faction"; id: string; of?: GwFactionStatus[] } & Range)
  /** A faction's temper, 0 따른다 .. 4 말이 없다. */
  | ({ is: "faction_temper"; id: string } & Range)
  /** Its leader has come asking for this bill and has no answer yet. */
  | { is: "faction_asks"; id: string; law: string }
  /** The price its leader names now for the moving bill (a `wants` row id). */
  | { is: "faction_want"; id: string; want: string }
  /** A deal was struck with it on the moving bill. */
  | { is: "deal"; id: string }
  /** It has a text of its own for the moving bill, not the text now. */
  | { is: "amendable"; id: string }
  /** It can be lobbied now: it sits in the moving bill's house. */
  | { is: "lobby"; id: string }
  /** The last vote went one of these ways; on this bill if named. */
  | { is: "vote_band"; of: GwVoteBand[]; law?: string }
  /** Who brought the bill. */
  | { is: "law_origin"; id: string; of: GwLawOrigin[] }
  /** The whip's last word on the moving bill. */
  | { is: "whip_said"; of: GwWhipWord[] }
  /** Times the way round has been used. */
  | ({ is: "around" } & Range)
  /** A chamber sits to vote on the bill now (false: only the way round). */
  | { is: "house_sits"; id: string }
  /**
   * A vote of confidence in the first chamber, counted now as a bill would be
   * (ww166, France's consultations): the chamber's weight plus each faction's
   * seats on its side. `stance`: faction -> -1, 0 or 1; absent factions stay
   * away. Holds at a count of `min` (0 if absent) or more; true with no house.
   */
  | { is: "confidence"; stance: Readonly<Record<string, number>>; min?: number }
  // ---- Plots, the dossier, allies (ww158, S2) ----
  /** Sign scenes of a plot the seat has opened. */
  | ({ is: "plot_signs"; id: string } & Range)
  /** The plot's warning has been opened. */
  | { is: "plot_warned"; id: string }
  /** A file on the person: held (not out) by default; `used`: used at least once. */
  | { is: "file"; who: GwWorldWho; of?: ("held" | "used" | "out")[] }
  /** An ally's ask stands at one of these stages. */
  | { is: "ask"; id: string; of: GwAskStage[] }
  /**
   * The police have reported this plot astir in its present round, with one of
   * these stamps (confirmed if absent): what making it public needs.
   */
  | { is: "plot_report"; id: string; of?: GwStamp[] }
  // ---- Scenes by state, not date (ww170 S3) ----
  /**
   * Whole months of war: since the war began, or with `own` since the seat's
   * country came in. False while there has been no war (or it never came in).
   */
  | ({ is: "war_months"; own?: boolean } & Range)
  /**
   * Whole months since the last crisis closed without a war, while the seat's
   * country has never been at war. False before any crisis has closed.
   */
  | ({ is: "peace_months" } & Range)
  /** The month of the year, 1..12: seasons, Christmas, any year. */
  | { is: "month"; of: number[] }
  /** A crisis of the ladder (ultimatum) between the seat's country and another. */
  | {
      is: "ladder";
      /** The seat's part: it sent the note, or it was sent one. */
      role?: "from" | "to";
      tag?: GwTag;
      of?: GwLadderStep[];
      /** Whose ladders: another country's (absent: the seat's country). */
      nation?: GwTag;
    }
  /** The seat could send this country a note now (eng/ww1914/Ladder). */
  | { is: "ladder_target"; tag: GwTag }
  // ---- War between any pair (ww171 phase 4) ----
  /** The seat may declare war on `tag` now (reachable, a cause, not allied). */
  | { is: "war_target"; tag: GwTag }
  /** The seat is at war with `tag` and may offer it a peace of their own. */
  | { is: "peace_target"; tag: GwTag }
  /**
   * A war between `tag` (absent: the seat's country) and `with` (absent:
   * anyone), on now, begun this many months ago. `outside`: neither in a
   * coalition against the other (a war of their own). `cause`: how it came.
   * `by`: the country that declared it.
   */
  | ({
      is: "pair_war";
      tag?: GwTag;
      with?: GwTag;
      outside?: boolean;
      cause?: string[];
      by?: GwTag;
    } & Range)
  /**
   * As `pair_war`, for a war that ended this many months ago. `how`: a peace
   * one offered (`offer`; `by`: whose offer was taken), one both reached at
   * once (`mutual`), or one of the two fell out of the war (`fell`).
   */
  | ({
      is: "pair_peace";
      tag?: GwTag;
      with?: GwTag;
      how?: GwWarEnd[];
      by?: GwTag;
    } & Range)
  /**
   * A front opened this many months ago and is still open. `tag`: that
   * country fights on it, the months counted from when it came on the line.
   */
  | ({ is: "front_months"; theatre: GwTheatre; tag?: GwTag } & Range)
  /** A peace offer waits for the seat's answer (from `tag`, if given). */
  | { is: "peace_offered"; tag?: GwTag }
  // ---- Occupation and the tables (ww172 phase 5) ----
  /**
   * `tag` (absent: the seat's country) holds land of `from` (absent: anyone
   * else's), taken this many months ago; `capital`: that country's capital.
   * `group` / `place`: only land in one of these groups / these places.
   */
  | ({
      is: "land_taken";
      tag?: GwTag;
      from?: GwTag;
      capital?: boolean;
      group?: GwPlaceGroup[];
      place?: GwPlace[];
    } & Range)
  /**
   * The seat's country's own land is held by `to` (absent: anyone), taken
   * this many months ago; `capital`: its capital. `group` / `place` as above.
   */
  | ({
      is: "land_lost";
      to?: GwTag;
      capital?: boolean;
      group?: GwPlaceGroup[];
      place?: GwPlace[];
    } & Range)
  /**
   * `tag` (absent: anyone) was knocked out of the war this many months ago;
   * `by`: while at war with that country (a war of theirs ended as it fell).
   */
  | ({ is: "beaten"; tag?: GwTag; by?: GwTag } & Range)
  /**
   * The seat's country sat at a bilateral table with `with` (absent: anyone).
   * `open`: true while it sits, false once signed (absent: either). `result`:
   * how it came to it. Months count from the signing, or from the peace while
   * it sits.
   */
  | ({
      is: "pair_table";
      with?: GwTag;
      open?: boolean;
      result?: ("won" | "lost" | "even")[];
    } & Range)
  /**
   * ww173: a front end broke from strain (Stalemate.ts): the seat's own end,
   * or with `foe` the end facing it; on one of `theatre` (absent: any).
   * Months count from the chapter after the collapse (the first that can show
   * it), so `max: 0` holds there on every calendar.
   */
  | ({ is: "collapse"; theatre?: GwTheatre[]; foe?: boolean } & Range)
  // ---- The great offensive (ww173 phase B) ----
  /**
   * An enemy great offensive the seat's country has learned of and not yet
   * answered: on one of `theatre`, by one of `method` (as seen; a feint looks
   * real), `code`: learned through a code the seat reads.
   */
  | {
      is: "foe_offensive";
      theatre?: GwTheatre[];
      method?: GwOffMethod[];
      code?: boolean;
    }
  /**
   * The latest great offensive of the seat's country (`side` "ours", the
   * default) or against it ("foe"), running or ended this chapter or the
   * last: its front, method, latest result; the range is its round (0 while
   * prepared). For the writers' paper and result scenes (ww173 formatb).
   */
  | ({
      is: "offensive";
      side?: "ours" | "foe";
      theatre?: GwTheatre[];
      method?: GwOffMethod[];
      result?: GwOffResult[];
    } & Range)
  /** ww173: the secret war (GwSpies.GW_SPY_CANS). */
  | {
      is: "spy";
      can: GwSpyCan;
      tag?: GwTag;
      /** ww178: true holds only while the seat's country is at peace. */
      peace?: boolean;
    }
  /** ww180: the direction-finding chain at sea (GwNaval.GW_NAVAL_CANS). */
  | { is: "naval"; can: GwNavalCan }
  /** ww180: named agents (GwAgents.GW_AGENT_CANS); `id` a GW_AGENTS id. */
  | { is: "agent"; can: GwAgentCan; id?: string }
  /**
   * ww180: propaganda (GwAgents.GW_PROP_CANS): an act with `tag` where it
   * takes one; ok/out of the newest campaign of `act`.
   */
  | { is: "prop"; can: GwPropCan; tag?: GwTag; act?: GwPropAct }
  // ---- Scenes that match the state (ww187) ----
  /**
   * Who holds a place now, from the seat's chair (GwAssumes.GW_HOLDERS): its
   * own country or an ally, a country at war with it, the place's owner.
   */
  | { is: "held"; place: GwPlace; by: GwHolder }
  /** A chamber of the seat's house sits now: not dissolved, prorogued or gone. */
  | { is: "sits"; id: GwChamber }
  /** The seat's house was dissolved and its election hasn't come yet. */
  | { is: "dissolved" }
  /** A world flag true now, not only once (engine/ww1914/WorldFlags.flagNow). */
  | { is: "flag_now"; flag: GwWorldFlag }
  // ---- The peace years and after (ww190, S1: PeaceYears.ts, Aftermath.ts) ----
  /** How far a country arms past its June 1914 budget, 0..3 (the seat's if no tag). */
  | ({ is: "arming"; tag?: GwTag } & Range)
  /** The seat's country and `tag` are rivals in arms, both arming ≥ 1. */
  | { is: "arms_race"; tag: GwTag }
  /** The seat's country's bond with `tag`, -3..3; false if the pair has none. */
  | ({ is: "bond"; tag: GwTag } & Range)
  /** An accord of the seat's country; `broken`: only broken / only in force. */
  | { is: "accord"; kind?: GwAccordKind; tag?: GwTag; broken?: boolean }
  /** An accord offered to the seat's country, not answered yet. */
  | { is: "accord_offered"; kind?: GwAccordKind; tag?: GwTag }
  /** The best price a side offers the seat's neutral country. */
  | ({ is: "courted"; side?: GwSide } & Range)
  /** The seat offered to mediate and has no answer yet. */
  | { is: "mediating" }
  /** The seat's country (or `tag`) ratified the treaty; `no`: refused it. */
  | { is: "ratified"; tag?: GwTag; no?: boolean }
  /** Whole months since the table signed; false before. */
  | ({ is: "after_months" } & Range)
  /** Demobilisation, 0 hold .. 2 all at once (the seat's country if no tag). */
  | ({ is: "demob"; tag?: GwTag } & Range)
  /** Months since the seat's own peace, while it plays on; false otherwise. */
  | ({ is: "left_war" } & Range)
  // ---- Ruling land, the home front, France, the seas (ww190, S2) ----
  /** The seat's country rules land of `of`; the range is on `hard`. */
  | ({
      is: "rule";
      of?: GwTag;
      policy?: GwRulePolicy;
      client?: GwClient;
    } & Range)
  /** Resistance in land the seat's country rules (the highest), 0..3. */
  | ({ is: "resist"; of?: GwTag } & Range)
  /** The seat's country's land under foreign rule; the range is on `hard`. */
  | ({ is: "ruled"; by?: GwTag; policy?: GwRulePolicy } & Range)
  /** Relief let in: as the ruler of `of`, or as the ruled with no `of`. */
  | { is: "relief"; of?: GwTag }
  /** Prisoners in thousands: `ours` held by the seat's country, `theirs` of it held. */
  | ({ is: "prisoners"; held: "ours" | "theirs"; tag?: GwTag } & Range)
  /** Hunger, 0..3 (the seat's country if no tag). */
  | ({ is: "hunger"; tag?: GwTag } & Range)
  /** Women at work, 0..3. */
  | ({ is: "women_work" } & Range)
  /** Refugees, 0..3. */
  | ({ is: "refugees" } & Range)
  /** The flu's wave now, 0 none .. 3. */
  | ({ is: "flu" } & Range)
  /** Refusals' stage 0..3 in `tag`'s army (France if no tag). */
  | ({
      is: "refusals";
      tag?: GwTag;
      answer?: GwRefusalAnswer;
      pardons?: Range;
    } & Range)
  /** Who holds a sea, from the seat's side. */
  | { is: "sea_hold"; sea: GwSeaZone; by: "us" | "foe" | "none" }
  // ---- ww199: a beaten country's fate ----
  /**
   * A fate a table signed: the seat's country decided it (`as: "by"`, the
   * default), lost the place (`of`), or holds it now (`to`). `tag`: the
   * other party. The range is on whole months since it was signed.
   */
  | ({
      is: "fate";
      fate?: GwFate;
      as?: "by" | "of" | "to";
      tag?: GwTag;
      client?: GwClient;
    } & Range)
  /**
   * A state the seat's country founded (or `by` founded); the range is on
   * its loyalty 0..3. `self`: the seat's own country is such a state.
   */
  | ({
      is: "client_state";
      client?: GwClient;
      by?: GwTag;
      self?: boolean;
    } & Range)
  /**
   * A vassal of the seat's country (or of `by`), cut from `of`; the range is
   * on its loyalty 0..3. `self`: the seat's own country is a vassal.
   */
  | ({ is: "vassal"; by?: GwTag; of?: GwTag; self?: boolean } & Range)
  /**
   * The seat's country's revanche: places it lost by annexation or to a
   * taker's new state or vassal, less those given back; toward `tag` if set.
   * The range is on that count.
   */
  | ({ is: "revanche"; tag?: GwTag } & Range)
  /** A table sits with the seat's country in a chair, the fate of `of` (the beaten) open. */
  | { is: "settle_open"; of?: GwTag }
  // ---- ww207: the society (Society.ts, S1) ----
  /** The seat's country on an axis, in steps -3..3 (minus: the first word). */
  | ({ is: "axis"; axis: GwAxis } & Range)
  /** A faction's support, 0..10. */
  | ({ is: "support"; id: string } & Range)
  /** A faction's trust in the seat, -3..3. */
  | ({ is: "faction_trust"; id: string } & Range)
  /** A community's temper, 0..4. */
  | ({ is: "community"; id: string } & Range)
  /** A community's trust in the seat, -3..3. */
  | ({ is: "community_trust"; id: string } & Range)
  /** Chapters to the chamber's next general election (none due: false). */
  | ({ is: "election_due"; chamber: GwChamber } & Range)
  // ---- ww207: the utopias (Utopia.ts, S2) ----
  /** A faction's affinity, 0..100. */
  | ({ is: "affinity"; id: string } & Range)
  /** That node of the faction's tree is open. */
  | { is: "node"; id: string; node: string }
  /** A utopia has been realised: that faction's if `id`, else any. */
  | { is: "utopia"; id?: string }
  // ---- ww209: the money bills (MoneyBills.ts, S1) ----
  /**
   * The seat's money bill of that kind: `open` on the agenda, `passed` or
   * `failed` its last vote (this meeting, these credits), `stopped`
   * borrowing stopped by refused credits now.
   */
  | {
      is: "money";
      bill: GwMoneyBill;
      now: "open" | "passed" | "failed" | "stopped";
    }
  /** The plan running now taxes that kind. */
  | { is: "tax_kind"; tax: GwTaxKind }
  /** That earmark is in the plan running now. */
  | { is: "earmark"; id: string }
  /** Times a faction's wing has defied its line. */
  | ({ is: "defy"; id: string } & Range)
  /** A faction's split pressure. */
  | ({ is: "split_pressure"; id: string } & Range)
  // ---- ww209: the ledger (Deals.ts, S2) ----
  /** A ledger row of that kind with that faction, of that fate (absent: open). */
  | { is: "ledger"; kind: GwDealKind; id?: string; fate?: GwDealFate };

export type GwWorldEffect =
  /** Germany's plan for the war to come. */
  | { do: "plan"; plan: GwPlan }
  /** The seat refuses to follow its ally in. */
  | { do: "aside" }
  /** The next link of the crisis waits a chapter. */
  | { do: "hold" }
  /** Closes the open crisis at once. */
  | { do: "close_chain"; outcome: GwChainOutcome }
  | { do: "mobilize"; tag: GwTag; level: number }
  /** The order is recalled: mobilisation comes down to `level`. */
  | { do: "stand_down"; tag: GwTag; level: number }
  /** The seat's country declares war on `tag`, its allies with it. */
  | { do: "declare"; tag: GwTag }
  /** A price for a neutral (1..5), in the seat's side's name. */
  | { do: "offer"; tag: GwTag; value: number }
  /** A neutral's readiness moves. */
  | { do: "readiness"; tag: GwTag; delta: number }
  /** The seat finds a secret. */
  | { do: "reveal"; id: GwSecret }
  /** A report reaches the seat by way of `source`. */
  | {
      do: "report";
      fact: GwFactKind;
      tag: GwTag;
      theatre?: GwTheatre;
      source: GwSource;
    }
  /**
   * Seen with the seat's own eyes: a confirmed report of the truth, and any
   * unchecked report of the same thing is put right now.
   */
  | { do: "inspect"; fact: GwFactKind; tag: GwTag; theatre?: GwTheatre }
  | { do: "thread"; id: GwThread }
  | { do: "command"; who: GwWorldWho; theatre: GwTheatre }
  | { do: "uboat"; level: number }
  /** Hidden strength moves: a seat's choice with a shown price. */
  | { do: "force"; tag: GwTag; theatre: GwTheatre; delta: number }
  | { do: "authority"; delta: number }
  | { do: "manpower"; delta: number }
  /** A resignation letter arrives (it always comes before the leaving). */
  | { do: "letter"; who: GwWorldWho }
  /** The open letter is refused: they stay. */
  | { do: "keep"; who: GwWorldWho }
  /** They go; a successor takes the office at the chapter's close. */
  | { do: "leave"; who: GwWorldWho }
  /** A concession: the ladder steps down. `key`: its reason line, if not the concession's. */
  | { do: "calm"; key?: string }
  /** Results in their field, for what the seat comes to see of them. */
  | { do: "result"; who: GwWorldWho; won: boolean }
  | { do: "news"; key: string; a?: GwTag; b?: GwTag; theatre?: GwTheatre }
  /** The chief of staff's first open paper is signed for this chapter. */
  | { do: "sign_chief" }
  /** The seat's country comes in, on `side`. */
  | { do: "join"; side: GwSide }
  /** The form of government changes (engine/ww1914/Regimes). */
  | { do: "regime"; to: string }
  /** The revolution is met by going on in the next form, if it has one. */
  | { do: "next_regime" }
  /** The ladder at the top: this seat's game ends with its memoir. */
  | { do: "close_seat" }
  /** The head of state takes or gives up the army. */
  | { do: "personal_command"; on: boolean }
  | { do: "blockade"; delta: number }
  | { do: "shipping"; delta: number }
  /** The cabinet votes: dissenters remember, the record says how it went. */
  | { do: "vote"; issue: GwIssue }
  /** Peace is offered to the other side: it answers next chapter. */
  | { do: "talks" }
  /** The seat's country asks for an armistice. */
  | { do: "sue" }
  /** Both sides stop as they stand. */
  | { do: "armistice"; kind: GwArmisticeKind }
  /** The seat's country alone makes peace. */
  | { do: "separate_peace" }
  /** A person's life ends; a neutral line in the record, no more. */
  | { do: "passes"; who: GwWorldWho }
  /** The draft on the table goes to whoever must pass it. */
  | { do: "budget_sign" }
  /** The draft gives a line `delta` points, out of the fattest others. */
  | { do: "budget_tilt"; line: GwBudgetLine; delta: number }
  /** The draft asks `delta` more of a source. */
  | { do: "budget_mix"; source: GwBudgetSource; delta: number }
  /** treasury: percent of a year's revenue; debt, prices: percent of itself. */
  | { do: "budget_item"; item: GwBudgetItem; pct: number }
  /** Interest paid, percent of what is due; lenders shut for `shut` chapters. */
  | { do: "budget_rate"; pct: number; shut: number }
  /** The draft is settled: this text of the bill goes out to be argued. */
  | { do: "law_text"; law: string; text: string; support: number }
  /** A talk or a favour moves the count. */
  | { do: "law_support"; law: string; delta: number }
  /** The bill goes to whoever must pass it. */
  | { do: "law_put"; law: string }
  /** The bill goes past them, at the body's price. */
  | { do: "law_decree"; law: string }
  /** The day is put off: another chapter of argument. */
  | { do: "law_hold"; law: string }
  /** The bill is taken back; it can come again. */
  | { do: "law_withdraw"; law: string }
  /** A threat runs hotter or cooler; it never goes below nothing. */
  | { do: "gov_heat"; id: string; delta: number }
  /** A threat is beaten: it lies quiet for its row's rest. */
  | { do: "gov_beaten"; id: string }
  /** A deal made on a threat: its paper comes soon, whatever the heat. */
  | { do: "gov_soon"; id: string }
  /** The ruler's word on an invention (GwCraft GW_INVENT_STEPS). */
  | { do: "invent"; id: string; step: GwInventStep }
  /** The year's project; `id` names it for `start`, else the running one. */
  | { do: "project"; id?: string; step: GwProjectStep }
  /** Someone else is put in charge of the running project. */
  | { do: "project_lead"; who: GwWorldWho }
  /** The footing moves to `level`: up one step at a time, down at once. */
  | { do: "footing"; level: number }
  /** A shortage comes on, or is answered for good. */
  | { do: "shortage"; id: GwShortage; on: boolean }
  // ---- The house (ww158, S1) ----
  /** A faction's temper: `delta` > 0 heats it, < 0 cools it. */
  | { do: "faction"; id: string; delta: number }
  /** A faction's strength. */
  | { do: "faction_grow"; id: string; delta: number }
  /** Driven underground. */
  | { do: "faction_under"; id: string }
  /**
   * Its leader's price for the moving bill is taken: a promise, his side for
   * it. `want`: which of his prices (ww203: up to three); absent the first.
   */
  | { do: "deal"; id: string; want?: string }
  /** The moving bill takes its text. */
  | { do: "amend"; id: string }
  /** The answer to the bill its leader came asking for. */
  | { do: "bill_answer"; id: string; yes: boolean }
  /** A bill starts in the house: from an ally's ask, a faction, the seat. */
  | { do: "law_start"; law: string; origin: GwLawOrigin }
  /**
   * ww203: a count answer's course on its bill (the task's topic, else the
   * lobbied bill): vote now, withdraw, the sponsor works the biggest
   * waverer, take the first amendment a faction offers.
   */
  | { do: "bill_topic"; act: GwBillAct }
  /** The sovereign signs the bill the house passed, or refuses it. */
  | { do: "house_sign"; yes: boolean }
  // ---- Plots, the dossier, allies (ww158, S2) ----
  /** A plot's sign has been read. */
  | { do: "plot_sign"; id: string }
  /** A plot's warning has been read. */
  | { do: "plot_warn"; id: string }
  /** The police bring a file on the person. */
  | { do: "file"; who: GwWorldWho }
  /**
   * A file is used on the person in this talk (the `hold` reply). Not `hold`:
   * that name is the crisis chain's wait.
   */
  | { do: "use_file"; who: GwWorldWho }
  /** The answer to an ally's ask. */
  | { do: "ask"; id: string; answer: "yes" | "no" }
  /**
   * Agitation in another country (ww169): its order falls by `delta`, unless
   * its police answer it first (a seeded roll on how steady it is).
   */
  | { do: "stir"; tag: GwTag; delta: number }
  // ---- The crisis ladder (ww170 S3) ----
  /** The seat's country sends `tag` an ultimatum. */
  | { do: "ultimatum"; tag: GwTag }
  /** The seat that was sent a note gives way (`yes`) or refuses. */
  | { do: "ladder_answer"; yes: boolean }
  /** The sender, refused: mobilises (`on`) or climbs down. */
  | { do: "ladder_press"; on: boolean }
  // ---- War between any pair (ww171 phase 4) ----
  /** The seat's country declares war on `tag` (to a seat: next chapter). */
  | { do: "declare_war"; tag: GwTag }
  /** The seat offers `tag` a peace of the two alone. */
  | { do: "pair_peace"; tag: GwTag }
  /** The seat answers the peace offer it was sent. */
  | { do: "pair_peace_answer"; yes: boolean }
  // ---- The great offensive (ww173 phase B) ----
  /** The answer to the enemy offensive the seat learned of (`foe_offensive`). */
  | { do: "counter_offensive"; pick: GwOffCounter }
  /** ww173: the secret war (engine/ww1914/Spies; GwSpies.GW_SPY_ACTS). */
  | { do: "spy"; act: GwSpyAct; tag?: GwTag }
  /** ww180: the chain at sea (engine/ww1914/NavalIntel; GwNaval.GW_NAVAL_ACTS). */
  | { do: "naval"; act: GwNavalAct }
  /** ww180: hire a named agent (engine/ww1914/Agents); none named: the best open. */
  | { do: "agent"; id?: string }
  /** ww180: a propaganda campaign (engine/ww1914/Propaganda). */
  | { do: "prop"; act: GwPropAct; tag?: GwTag }
  /** ww187: the seat's house is dissolved: closed until its election (GW_ELECTION_DAYS). */
  | { do: "dissolve" }
  // ---- The peace years and after (ww190, S1) ----
  /** Tilts the running plan's army or navy share, out of works, relief, national. */
  | { do: "arms"; line: "army" | "navy"; delta: number }
  /** The seat's country's bond with `tag`, clamped -3..3. */
  | { do: "bond"; tag: GwTag; delta: number }
  /** An accord offered to `tag`: answered next chapter. */
  | { do: "accord"; kind: GwAccordKind; tag: GwTag }
  /** The answer to the accord offered to the seat. */
  | { do: "accord_answer"; yes: boolean }
  /** An accord of the seat's country ends, with its prices. */
  | { do: "break_accord"; kind: GwAccordKind; tag?: GwTag }
  /** The seat's neutral country offers to mediate: answered next chapter. */
  | { do: "mediate" }
  /** The seat's country ratifies the treaty, or refuses. */
  | { do: "ratify"; yes: boolean }
  /** Demobilisation, 0 hold .. 2 all at once. */
  | { do: "demob"; level: number }
  /** After a separate peace: play on, or close with the memoir. */
  | { do: "play_on"; on: boolean }
  // ---- Ruling land, the home front, France (ww190, S2) ----
  /** How the seat's country rules land of `of`; `hard` is a delta, clamped 0..3. */
  | {
      do: "rule";
      of: GwTag;
      policy?: GwRulePolicy;
      hard?: number;
      relief?: boolean;
      client?: GwClient;
    }
  /** Prisoners swapped with `tag`, a tenth each way. */
  | { do: "exchange"; tag: GwTag }
  /** A reprisal on `tag`'s prisoners. */
  | { do: "reprisal"; tag: GwTag }
  /** The command's answer to the refusals. */
  | { do: "refusals"; answer: Exclude<GwRefusalAnswer, "none"> }
  /** The President's review of the sentences. */
  | { do: "pardon"; many: boolean }
  // ---- ww199: a beaten country's fate ----
  /** The crown of a state the seat founded: a candidate of its row, or "regency". */
  | { do: "crown"; client: GwClient; pick: string }
  /** The seat's ruler signs the treaty now sitting. */
  | { do: "treaty_sign"; how: GwSignHow }
  /** Paints a plan on the beaten country `of` (else the table's beaten). */
  | { do: "settle_plan"; plan: GwSettlePlan; of?: GwTag }
  /**
   * ww199 merge: the loyalty (`by`, a delta) and, for a vassal, the
   * resistance (`resist`, a delta) of the seat's realms: the state `client`,
   * the vassal of `of` (whole or a slot), or with neither every one it holds.
   */
  | {
      do: "loyalty";
      by: number;
      resist?: number;
      client?: GwClient;
      of?: GwTag;
    }
  // ---- ww207: the society (Society.ts, S1) ----
  /** The seat's country's axis, by notches (GW_AXIS_NOTCHES a step). */
  | { do: "axis"; axis: GwAxis; delta: number }
  /** A faction's support. */
  | { do: "support"; id: string; delta: number }
  /** A faction's trust in the seat. */
  | { do: "faction_trust"; id: string; delta: number }
  /** A community's temper: `delta` > 0 heats it. */
  | { do: "community"; id: string; delta: number }
  /** A community's trust in the seat. */
  | { do: "community_trust"; id: string; delta: number }
  /** A general election of the chamber now: after a dissolution, a new regime. */
  | { do: "election"; chamber: GwChamber; cause: "dissolved" | "regime" }
  // ---- ww207: the utopias (Utopia.ts, S2) ----
  /** A faction's affinity. */
  | { do: "affinity"; id: string; delta: number }
  // ---- ww209: the money bills (MoneyBills.ts, S1) ----
  /** An earmark into the plan running and the drafts to come (`on` false: cut). */
  | { do: "earmark"; id: string; on: boolean }
  /** A faction's split pressure. */
  | { do: "split_pressure"; id: string; delta: number }
  // ---- ww209: the ledger (Deals.ts, S2) ----
  /** A ledger row with the faction: he owes a favour, or the seat owes him one. */
  | { do: "ledger"; kind: "owe" | "owed"; id: string };

const int = z.number().int();
const yearMonth = z.string().regex(/^19[0-9]{2}-[01][0-9]$/);
const range = { min: int.optional(), max: int.optional() };
const tag = z.enum(GW_TAGS);
const theatre = z.enum(GW_THEATRES);
const source = z.enum(GW_SOURCES);
const is = <S extends z.ZodRawShape>(kind: string, shape: S) =>
  z.object({ is: z.literal(kind), ...shape }).strict();
const act = <S extends z.ZodRawShape>(kind: string, shape: S) =>
  z.object({ do: z.literal(kind), ...shape }).strict();

const who: z.ZodType<GwWorldWho> = z.union([
  z.object({ role: GwIdSchema }).strict(),
  z.object({ office: z.enum(GW_OFFICES) }).strict(),
  z.object({ person: GwIdSchema }).strict(),
]);

export const GwWorldCondSchema = z.union([
  is("thread", { id: z.enum(GW_THREADS) }),
  is("mandate", { id: GwIdSchema }),
  is("known", { id: z.enum(GW_SECRETS) }),
  is("chain", { ...range, short: z.boolean().optional() }),
  is("chain_end", { of: z.array(z.enum(GW_CHAIN_OUTCOMES)) }),
  is("war", {}),
  is("entered", { tag, side: z.enum(GW_SIDES).optional() }),
  is("out", { tag }),
  is("front", { theatre, from: GwIdSchema, to: GwIdSchema }),
  is("open", { theatre }),
  is("battle", {
    theatre,
    of: z.array(z.enum(GW_RESULTS)),
    by: z.enum([...GW_SIDES, "seat", "foe"]).optional(),
  }),
  is("plan", { of: z.array(z.enum(GW_PLANS)) }),
  is("aside", {}),
  is("mob", { tag, ...range }),
  is("unrest", range),
  is("authority", range),
  is("casualties", range),
  is("manpower", range),
  is("uboat", range),
  is("war_age", range),
  is("score", range),
  is("plan_signed", {}),
  is("main", { of: z.array(theatre) }),
  is("letter", { who }),
  is("ailing", { who }),
  is("wins", { who, ...range }),
  is("losses", { who, ...range }),
  is("ai", { tag, of: z.array(z.enum(GW_AI_KINDS)) }),
  is("lean", { tag, ...range }),
  is("force", { tag, theatre, ...range }),
  is("competence", { who, field: z.enum(GW_FIELDS), ...range }),
  is("report_wrong", { source }),
  is("source_record", { source, ...range }),
  is("regime", { tag: tag.optional(), of: z.array(GwIdSchema) }),
  is("era", { of: z.array(z.enum(GW_ERAS)) }),
  is("tech", { id: z.enum(GW_TECHS), tag: tag.optional() }),
  is("blockade", range),
  is("shipping", range),
  is("america", range),
  is("armistice", { of: z.array(z.enum(GW_ARMISTICE_KINDS)).optional() }),
  is("peace_side", { of: z.array(z.enum(["won", "lost", "even"])) }),
  is("votes", { issue: z.enum(GW_ISSUES), ...range }),
  is("carried", { issue: z.enum(GW_ISSUES) }),
  is("command", {}),
  is("in_war", { tag: tag.optional(), ...range }),
  is("neutral", { tag }),
  is("side", { of: z.array(z.enum([...GW_SIDES, "neutral"])) }),
  is("date", { from: yearMonth.optional(), to: yearMonth.optional() }),
  is("offered", { tag, ...range }),
  is("budget", { what: z.enum(GW_BUDGET_WHATS), ...range }),
  is("law", {
    id: GwIdSchema,
    of: z.array(z.enum(GW_LAW_STAGES)),
    text: GwIdSchema.optional(),
  }),
  is("law_count", { id: GwIdSchema, ...range }),
  is("law_decree", { id: GwIdSchema }),
  is("gov", { id: GwIdSchema, ...range }),
  is("poll", { id: GwIdSchema, ...range }),
  is("poll_own", { id: GwIdSchema, ...range }),
  is("invention", {
    id: GwIdSchema,
    of: z.array(z.enum(GW_INVENTION_STAGES)),
    early: z.boolean().optional(),
  }),
  is("project", {
    id: GwIdSchema.optional(),
    of: z.array(z.enum(GW_PROJECT_PHASES)),
  }),
  is("footing", range),
  is("shortage", {
    id: z.enum(GW_SHORTAGES),
    solved: z.boolean().optional(),
  }),
  is("faction", {
    id: GwIdSchema,
    of: z.array(z.enum(GW_FACTION_STATUS)).optional(),
    ...range,
  }),
  is("faction_temper", { id: GwIdSchema, ...range }),
  is("faction_asks", { id: GwIdSchema, law: GwIdSchema }),
  is("faction_want", { id: GwIdSchema, want: GwIdSchema }),
  is("deal", { id: GwIdSchema }),
  is("amendable", { id: GwIdSchema }),
  is("lobby", { id: GwIdSchema }),
  is("vote_band", {
    of: z.array(z.enum(GW_VOTE_BANDS)),
    law: GwIdSchema.optional(),
  }),
  is("law_origin", { id: GwIdSchema, of: z.array(z.enum(GW_LAW_ORIGINS)) }),
  is("whip_said", { of: z.array(z.enum(GW_WHIP_WORDS)) }),
  is("around", range),
  is("house_sits", { id: GwIdSchema }),
  is("confidence", {
    stance: z.record(GwIdSchema, int.min(-1).max(1)),
    min: int.optional(),
  }),
  is("plot_signs", { id: GwIdSchema, ...range }),
  is("plot_warned", { id: GwIdSchema }),
  is("file", {
    who,
    of: z.array(z.enum(["held", "used", "out"])).optional(),
  }),
  is("ask", { id: GwIdSchema, of: z.array(z.enum(GW_ASK_STAGES)) }),
  is("plot_report", {
    id: GwIdSchema,
    of: z.array(z.enum(GW_STAMPS)).optional(),
  }),
  is("war_months", { own: z.boolean().optional(), ...range }),
  is("peace_months", range),
  is("month", { of: z.array(int.min(1).max(12)).min(1) }),
  is("ladder", {
    role: z.enum(["from", "to"]).optional(),
    tag: tag.optional(),
    of: z.array(z.enum(GW_LADDER_STEPS)).optional(),
    nation: tag.optional(),
  }),
  is("ladder_target", { tag }),
  is("war_target", { tag }),
  is("peace_target", { tag }),
  is("pair_war", {
    tag: tag.optional(),
    with: tag.optional(),
    outside: z.boolean().optional(),
    cause: z.array(GwIdSchema).optional(),
    by: tag.optional(),
    ...range,
  }),
  is("pair_peace", {
    tag: tag.optional(),
    with: tag.optional(),
    how: z.array(z.enum(GW_WAR_ENDS)).min(1).optional(),
    by: tag.optional(),
    ...range,
  }),
  is("front_months", { theatre, tag: tag.optional(), ...range }),
  is("peace_offered", { tag: tag.optional() }),
  is("land_taken", {
    tag: tag.optional(),
    from: tag.optional(),
    capital: z.boolean().optional(),
    group: z.array(GwPlaceGroupSchema).min(1).optional(),
    place: z.array(GwPlaceSchema).min(1).optional(),
    ...range,
  }),
  is("land_lost", {
    to: tag.optional(),
    capital: z.boolean().optional(),
    group: z.array(GwPlaceGroupSchema).min(1).optional(),
    place: z.array(GwPlaceSchema).min(1).optional(),
    ...range,
  }),
  is("beaten", { tag: tag.optional(), by: tag.optional(), ...range }),
  is("pair_table", {
    with: tag.optional(),
    open: z.boolean().optional(),
    result: z.array(z.enum(["won", "lost", "even"])).optional(),
    ...range,
  }),
  is("collapse", {
    theatre: z.array(theatre).optional(),
    foe: z.boolean().optional(),
    ...range,
  }),
  is("foe_offensive", {
    theatre: z.array(theatre).min(1).optional(),
    method: z.array(z.enum(GW_OFF_METHODS)).min(1).optional(),
    code: z.boolean().optional(),
  }),
  is("offensive", {
    side: z.enum(["ours", "foe"]).optional(),
    theatre: z.array(theatre).min(1).optional(),
    method: z.array(z.enum(GW_OFF_METHODS)).min(1).optional(),
    result: z.array(z.enum(GW_OFF_RESULTS)).min(1).optional(),
    ...range,
  }),
  is("spy", {
    can: z.enum(GW_SPY_CANS),
    tag: tag.optional(),
    peace: z.boolean().optional(),
  }),
  is("naval", { can: z.enum(GW_NAVAL_CANS) }),
  is("agent", { can: z.enum(GW_AGENT_CANS), id: GwIdSchema.optional() }),
  is("prop", {
    can: z.enum(GW_PROP_CANS),
    tag: tag.optional(),
    act: z.enum(GW_PROP_ACTS).optional(),
  }),
  is("held", { place: GwPlaceSchema, by: z.enum(GW_HOLDERS) }),
  is("sits", { id: z.enum(GW_CHAMBERS) }),
  is("dissolved", {}),
  is("flag_now", { flag: z.enum(GW_WORLD_FLAGS) }),
  is("arming", { tag: tag.optional(), ...range }),
  is("arms_race", { tag }),
  is("bond", { tag, ...range }),
  is("accord", {
    kind: z.enum(GW_ACCORD_KINDS).optional(),
    tag: tag.optional(),
    broken: z.boolean().optional(),
  }),
  is("accord_offered", {
    kind: z.enum(GW_ACCORD_KINDS).optional(),
    tag: tag.optional(),
  }),
  is("courted", { side: z.enum(GW_SIDES).optional(), ...range }),
  is("mediating", {}),
  is("ratified", { tag: tag.optional(), no: z.boolean().optional() }),
  is("after_months", range),
  is("demob", { tag: tag.optional(), ...range }),
  is("left_war", range),
  is("rule", {
    of: tag.optional(),
    policy: z.enum(GW_RULE_POLICIES).optional(),
    client: z.enum(GW_CLIENTS).optional(),
    ...range,
  }),
  is("resist", { of: tag.optional(), ...range }),
  is("ruled", {
    by: tag.optional(),
    policy: z.enum(GW_RULE_POLICIES).optional(),
    ...range,
  }),
  is("relief", { of: tag.optional() }),
  is("prisoners", {
    held: z.enum(["ours", "theirs"]),
    tag: tag.optional(),
    ...range,
  }),
  is("hunger", { tag: tag.optional(), ...range }),
  is("women_work", range),
  is("refugees", range),
  is("flu", range),
  is("refusals", {
    tag: tag.optional(),
    answer: z.enum(GW_REFUSAL_ANSWERS).optional(),
    pardons: z.object(range).strict().optional(),
    ...range,
  }),
  is("sea_hold", {
    sea: z.enum(GW_SEA_ZONES),
    by: z.enum(["us", "foe", "none"]),
  }),
  // ww199
  is("fate", {
    fate: z.enum(GW_FATES).optional(),
    as: z.enum(["by", "of", "to"]).optional(),
    tag: tag.optional(),
    client: z.enum(GW_CLIENTS).optional(),
    ...range,
  }),
  is("client_state", {
    client: z.enum(GW_CLIENTS).optional(),
    by: tag.optional(),
    self: z.boolean().optional(),
    ...range,
  }),
  is("vassal", {
    by: tag.optional(),
    of: tag.optional(),
    self: z.boolean().optional(),
    ...range,
  }),
  is("revanche", { tag: tag.optional(), ...range }),
  is("settle_open", { of: tag.optional() }),
  // ww207
  is("axis", { axis: z.enum(GW_AXES), ...range }),
  is("support", { id: GwIdSchema, ...range }),
  is("faction_trust", { id: GwIdSchema, ...range }),
  is("community", { id: GwIdSchema, ...range }),
  is("community_trust", { id: GwIdSchema, ...range }),
  is("election_due", { chamber: z.enum(GW_CHAMBERS), ...range }),
  is("affinity", { id: GwIdSchema, ...range }),
  is("node", { id: GwIdSchema, node: GwIdSchema }),
  is("utopia", { id: GwIdSchema.optional() }),
  // ww209
  is("money", {
    bill: z.enum(GW_MONEY_BILLS),
    now: z.enum(["open", "passed", "failed", "stopped"]),
  }),
  is("tax_kind", { tax: z.enum(GW_TAX_KINDS) }),
  is("earmark", { id: GwIdSchema }),
  is("defy", { id: GwIdSchema, ...range }),
  is("split_pressure", { id: GwIdSchema, ...range }),
  is("ledger", {
    kind: z.enum(GW_DEAL_KINDS),
    id: GwIdSchema.optional(),
    fate: z.enum(GW_DEAL_FATES).optional(),
  }),
]) as unknown as z.ZodType<GwWorldCond>;

export const GwWorldEffectSchema = z.union([
  act("plan", { plan: z.enum(GW_PLANS) }),
  act("aside", {}),
  act("hold", {}),
  act("close_chain", { outcome: z.enum(GW_CHAIN_OUTCOMES) }),
  act("mobilize", { tag, level: int.min(0).max(2) }),
  act("declare", { tag }),
  act("offer", { tag, value: int.min(1).max(5) }),
  act("readiness", { tag, delta: int }),
  act("reveal", { id: z.enum(GW_SECRETS) }),
  act("report", {
    fact: z.enum(GW_FACT_KINDS),
    tag,
    theatre: theatre.optional(),
    source,
  }),
  act("thread", { id: z.enum(GW_THREADS) }),
  act("command", { who, theatre }),
  act("uboat", { level: int.min(0).max(2) }),
  act("force", { tag, theatre, delta: int }),
  act("authority", { delta: int }),
  act("manpower", { delta: int }),
  act("letter", { who }),
  act("keep", { who }),
  act("leave", { who }),
  act("calm", { key: GwIdSchema.optional() }),
  act("result", { who, won: z.boolean() }),
  act("news", {
    key: GwIdSchema,
    a: tag.optional(),
    b: tag.optional(),
    theatre: theatre.optional(),
  }),
  act("sign_chief", {}),
  act("join", { side: z.enum(GW_SIDES) }),
  act("regime", { to: GwIdSchema }),
  act("next_regime", {}),
  act("close_seat", {}),
  act("personal_command", { on: z.boolean() }),
  act("blockade", { delta: int }),
  act("shipping", { delta: int }),
  act("vote", { issue: z.enum(GW_ISSUES) }),
  act("talks", {}),
  act("sue", {}),
  act("armistice", { kind: z.enum(GW_ARMISTICE_KINDS) }),
  act("separate_peace", {}),
  act("passes", { who }),
  act("stand_down", { tag, level: int }),
  act("budget_sign", {}),
  act("budget_tilt", { line: z.enum(GW_BUDGET_LINES), delta: int }),
  act("budget_mix", { source: z.enum(GW_BUDGET_SOURCES), delta: int }),
  act("budget_item", { item: z.enum(GW_BUDGET_ITEMS), pct: int }),
  act("budget_rate", { pct: int.min(0).max(100), shut: int.min(0) }),
  act("law_text", { law: GwIdSchema, text: GwIdSchema, support: int }),
  act("law_support", { law: GwIdSchema, delta: int }),
  act("law_put", { law: GwIdSchema }),
  act("law_decree", { law: GwIdSchema }),
  act("law_hold", { law: GwIdSchema }),
  act("law_withdraw", { law: GwIdSchema }),
  act("gov_heat", { id: GwIdSchema, delta: int }),
  act("gov_beaten", { id: GwIdSchema }),
  act("gov_soon", { id: GwIdSchema }),
  act("inspect", {
    fact: z.enum(GW_FACT_KINDS),
    tag,
    theatre: theatre.optional(),
  }),
  act("invent", { id: GwIdSchema, step: z.enum(GW_INVENT_STEPS) }),
  act("project", {
    id: GwIdSchema.optional(),
    step: z.enum(GW_PROJECT_STEPS),
  }),
  act("project_lead", { who }),
  act("footing", { level: int.min(0).max(2) }),
  act("shortage", { id: z.enum(GW_SHORTAGES), on: z.boolean() }),
  act("faction", { id: GwIdSchema, delta: int }),
  act("faction_grow", { id: GwIdSchema, delta: int }),
  act("faction_under", { id: GwIdSchema }),
  act("deal", { id: GwIdSchema, want: GwIdSchema.optional() }),
  act("amend", { id: GwIdSchema }),
  act("bill_answer", { id: GwIdSchema, yes: z.boolean() }),
  act("law_start", { law: GwIdSchema, origin: z.enum(GW_LAW_ORIGINS) }),
  act("bill_topic", { act: z.enum(GW_BILL_ACTS) }),
  act("house_sign", { yes: z.boolean() }),
  act("plot_sign", { id: GwIdSchema }),
  act("plot_warn", { id: GwIdSchema }),
  act("file", { who }),
  act("use_file", { who }),
  act("ask", { id: GwIdSchema, answer: z.enum(["yes", "no"]) }),
  act("stir", { tag, delta: int.min(1).max(2) }),
  act("ultimatum", { tag }),
  act("ladder_answer", { yes: z.boolean() }),
  act("ladder_press", { on: z.boolean() }),
  act("declare_war", { tag }),
  act("pair_peace", { tag }),
  act("pair_peace_answer", { yes: z.boolean() }),
  act("counter_offensive", { pick: z.enum(GW_OFF_COUNTERS) }),
  act("spy", { act: z.enum(GW_SPY_ACTS), tag: tag.optional() }),
  act("naval", { act: z.enum(GW_NAVAL_ACTS) }),
  act("agent", { id: GwIdSchema.optional() }),
  act("prop", { act: z.enum(GW_PROP_ACTS), tag: tag.optional() }),
  act("dissolve", {}),
  act("arms", { line: z.enum(["army", "navy"]), delta: int }),
  act("bond", { tag, delta: int }),
  act("accord", { kind: z.enum(GW_ACCORD_KINDS), tag }),
  act("accord_answer", { yes: z.boolean() }),
  act("break_accord", {
    kind: z.enum(GW_ACCORD_KINDS),
    tag: tag.optional(),
  }),
  act("mediate", {}),
  act("ratify", { yes: z.boolean() }),
  act("demob", { level: int.min(0).max(2) }),
  act("play_on", { on: z.boolean() }),
  act("rule", {
    of: tag,
    policy: z.enum(GW_RULE_POLICIES).optional(),
    hard: int.optional(),
    relief: z.boolean().optional(),
    client: z.enum(GW_CLIENTS).optional(),
  }),
  act("exchange", { tag }),
  act("reprisal", { tag }),
  act("refusals", { answer: z.enum(["courts", "rest", "both"]) }),
  act("pardon", { many: z.boolean() }),
  // ww199
  act("crown", {
    client: z.enum(GW_CLIENTS),
    pick: z.string().regex(/^[a-z][a-z0-9_]*$/),
  }),
  act("treaty_sign", { how: z.enum(GW_SIGN_HOWS) }),
  act("settle_plan", {
    plan: z.enum(GW_SETTLE_PLANS),
    of: tag.optional(),
  }),
  act("loyalty", {
    by: int,
    resist: int.optional(),
    client: z.enum(GW_CLIENTS).optional(),
    of: tag.optional(),
  }),
  // ww207
  act("axis", { axis: z.enum(GW_AXES), delta: int }),
  act("support", { id: GwIdSchema, delta: int }),
  act("faction_trust", { id: GwIdSchema, delta: int }),
  act("community", { id: GwIdSchema, delta: int }),
  act("community_trust", { id: GwIdSchema, delta: int }),
  act("election", {
    chamber: z.enum(GW_CHAMBERS),
    cause: z.enum(["dissolved", "regime"]),
  }),
  act("affinity", { id: GwIdSchema, delta: int }),
  // ww209
  act("earmark", { id: GwIdSchema, on: z.boolean() }),
  act("split_pressure", { id: GwIdSchema, delta: int }),
  act("ledger", { kind: z.enum(["owe", "owed"]), id: GwIdSchema }),
]) as unknown as z.ZodType<GwWorldEffect>;

// ---- Authoring helpers ----

export const world = (of: GwWorldCond) => ({ kind: "world" as const, of });
export const doWorld = (of: GwWorldEffect) => ({ kind: "world" as const, of });
