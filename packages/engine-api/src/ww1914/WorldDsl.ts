// Great War 1914: what a scene can read of the world and do to it. These ride
// in SceneDsl as one condition kind and one effect kind, `world`, so the world
// grows here without touching the narrative's lists. Kinds are APPEND ONLY.
// engine/ww1914/WorldDsl.ts runs them. Conditions may read hidden values: a
// variant can differ on a truth the seat doesn't know. Show those only as text.
import { z } from "zod";
import {
  GW_AI_KINDS,
  GW_ARMISTICE_KINDS,
  GW_CHAIN_OUTCOMES,
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
  GW_RESULTS,
  GW_SECRETS,
  GW_SIDES,
  GW_SOURCES,
  GW_STAMPS,
  GW_TECHS,
  GW_THEATRES,
  GW_THREADS,
  GW_WAR_ENDS,
  GwAiKind,
  GwArmisticeKind,
  GwChainOutcome,
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
  GwResult,
  GwSecret,
  GwSide,
  GwSource,
  GwStamp,
  GwTech,
  GwTheatre,
  GwThread,
  GwWarEnd,
} from "./GreatWarTypes";
import {
  GW_BUDGET_ITEMS,
  GW_BUDGET_LINES,
  GW_BUDGET_SOURCES,
  GwBudgetItem,
  GwBudgetLine,
  GwBudgetSource,
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
  GW_ASK_STAGES,
  GW_FACTION_STATUS,
  GW_LAW_ORIGINS,
  GW_VOTE_BANDS,
  GW_WHIP_WORDS,
  GwAskStage,
  GwFactionStatus,
  GwLawOrigin,
  GwVoteBand,
  GwWhipWord,
} from "./GwHouse";
import { GW_LAW_STAGES, GwLawStage } from "./GwLaw";
import {
  GwPlace,
  GwPlaceGroup,
  GwPlaceGroupSchema,
  GwPlaceSchema,
} from "./GwPlaces";
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
  /** A theatre is at or past a named line (`to`: not past it). */
  | { is: "front"; theatre: GwTheatre; from?: string; to?: string }
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
  | { is: "spy"; can: GwSpyCan; tag?: GwTag };

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
  /** Its leader's price for the moving bill is taken: a promise, his side for it. */
  | { do: "deal"; id: string }
  /** The moving bill takes its text. */
  | { do: "amend"; id: string }
  /** The answer to the bill its leader came asking for. */
  | { do: "bill_answer"; id: string; yes: boolean }
  /** A bill starts in the house: from an ally's ask, a faction, the seat. */
  | { do: "law_start"; law: string; origin: GwLawOrigin }
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
  | { do: "spy"; act: GwSpyAct; tag?: GwTag };

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
  is("front", {
    theatre,
    from: GwIdSchema.optional(),
    to: GwIdSchema.optional(),
  }),
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
  is("spy", { can: z.enum(GW_SPY_CANS), tag: tag.optional() }),
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
  act("deal", { id: GwIdSchema }),
  act("amend", { id: GwIdSchema }),
  act("bill_answer", { id: GwIdSchema, yes: z.boolean() }),
  act("law_start", { law: GwIdSchema, origin: z.enum(GW_LAW_ORIGINS) }),
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
]) as unknown as z.ZodType<GwWorldEffect>;

// ---- Authoring helpers ----

export const world = (of: GwWorldCond) => ({ kind: "world" as const, of });
export const doWorld = (of: GwWorldEffect) => ({ kind: "world" as const, of });
