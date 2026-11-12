import type {
  GwCond,
  GwEffect,
  GwNode,
  GwReply,
  GwScene,
  GwStance,
  GwVariant,
  GwWho,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, chose, trustOf } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「영국」, the replay share: second bodies of the scenes that come in most
 * games, and second talks. A talk body opens at its own node, and has its own
 * shape: someone refuses, turns the question round, stops early, or brings a
 * subject of their own. Data only; the text is in the GBR packs, under the
 * scene the body belongs to.
 */

interface MoreTalk {
  id: string;
  when?: GwCond;
  start: string;
  nodes: Record<string, GwNode>;
}

/** A body like an existing one: equal bodies take turns, unseen first. */
type MoreBody = { id: string; like: string } | { id: string; when: GwCond };

/** A reply of the talk's own, with what it pays and where it goes. */
function take(
  s: GwScene,
  id: string,
  change: Partial<GwReply> = {},
  from = "open",
): GwReply {
  const r = s.nodes![from].replies.find((x) => x.id === id);
  if (r === undefined) throw new Error(`${s.id}.${from}: no reply ${id}`);
  const out: GwReply = { ...r, ...change };
  if (out.reacts === undefined) delete out.reacts;
  if (out.miss === undefined) delete out.miss;
  return out;
}

const say = (
  id: string,
  stance: GwStance,
  kind: GwReply["kind"],
  next: string | null,
  more: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell: [], effects: [], next, ...more });

const node = (...replies: GwReply[]): GwNode => ({
  says: [{ id: "base" }],
  replies,
});

/** They hold it against the seat: the door is not open today. */
const sour = (w: GwWho): GwCond => ({ kind: "person_trust", who: w, max: -1 });
const trust = (w: GwWho, d: number): GwEffect => trustOf(w, d);
/** The cabinet has put the vote off at least once. */
const putOff = all(chose("gw_gbr_entry", "wait"), { kind: "chapter", min: 7 });

/** The same question, come back to a cabinet that answered it before. */
const askedLate = all(chose("gbr_f_late_entry"), { kind: "chapter", min: 7 });

const TALKS: Readonly<
  Record<string, (s: GwScene, w: GwWho) => readonly MoreTalk[]>
> = {
  gbr_v_haldane_army: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "hear", { stance: "frank" }),
          say("undecided", "cold", "ask", "b_undecided"),
          take(s, "deal"),
          take(s, "leave"),
        ),
        b_undecided: node(take(s, "hear"), say("end", "cold", "leave", null)),
      },
    },
    {
      id: "c",
      start: "c_open",
      nodes: {
        c_open: node(
          take(s, "hear"),
          take(s, "germany"),
          take(s, "deal"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_v_morley_letter: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "read"),
          take(s, "deal"),
          say("go", "warm", "leave", null),
        ),
      },
    },
    {
      id: "c",
      start: "c_open",
      nodes: {
        c_open: node(take(s, "read"), take(s, "old"), take(s, "leave")),
      },
    },
  ],
  gbr_t_hankey_minutes: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "what"),
          say("read", "cold", "ask", "b_three"),
          take(s, "no"),
          take(s, "leave"),
        ),
        b_three: node(take(s, "yes"), say("end", "cold", "leave", null)),
      },
    },
    {
      id: "c",
      start: "c_open",
      nodes: {
        c_open: node(take(s, "yes"), say("no2", "cold", "leave", null)),
      },
    },
  ],
  gbr_t_jellicoe_risk: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("nets", "warm", "deal", "b_nets", {
            effects: [trust(w, 1)],
            tell: ["trust:+1"],
          }),
          take(s, "what_lose"),
          say("admiralty", "cold", "leave", null),
        ),
        b_nets: node(take(s, "no_blame"), say("end", "cold", "leave", null)),
      },
    },
  ],
  gbr_v_lichnowsky_tears: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "hear", { stance: "frank", next: "b_night" }),
          take(s, "deal"),
          take(s, "belgium"),
          take(s, "leave"),
        ),
        b_night: node(say("end", "warm", "leave", null)),
      },
    },
    {
      id: "c",
      start: "c_open",
      nodes: {
        c_open: node(take(s, "hear"), take(s, "deal"), take(s, "leave")),
      },
    },
  ],
  gbr_t_venetia_friday: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("greek", "warm", "ask", "b_greek"),
          say("same", "frank", "ask", "b_same"),
          take(s, "quiet"),
        ),
        b_greek: node(take(s, "ask"), say("end", "warm", "leave", null)),
        b_same: node(take(s, "deal"), say("end", "frank", "leave", null)),
      },
    },
    {
      id: "c",
      start: "c_open",
      nodes: {
        c_open: node(
          say("write", "warm", "leave", null, {
            effects: [trust(w, 1)],
            tell: ["trust:+1"],
          }),
        ),
      },
    },
  ],
  gbr_v_birrell_warn: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "deal"),
          say("yours", "cold", "ask", "b_count"),
          take(s, "leave"),
        ),
        b_count: node(take(s, "deal"), say("end", "cold", "leave", null)),
      },
    },
    {
      id: "c",
      start: "c_open",
      nodes: {
        c_open: node(take(s, "ask"), take(s, "london"), take(s, "leave")),
      },
    },
  ],
  gbr_t_king_cousin: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("nothing", "cold", "ask", "b_nothing"),
          take(s, "deal"),
          take(s, "leave"),
        ),
        b_nothing: node(take(s, "ask"), say("end", "warm", "leave", null)),
      },
    },
  ],
  gbr_v_montagu_asks: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "ask"),
          take(s, "deal"),
          say("go", "cold", "leave", null),
        ),
      },
    },
  ],
  gbr_v_simon_resign: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "ask", { reacts: undefined }),
          say("no_it", "cold", "ask", "b_no"),
          take(s, "deal"),
          take(s, "later"),
        ),
        b_no: node(
          take(s, "ask", { reacts: undefined }),
          say("end", "cold", "leave", null),
        ),
      },
    },
  ],
  gbr_t_carson_lastword: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "ask"),
          say("other", "frank", "ask", "b_other"),
          take(s, "leave"),
        ),
        b_other: node(take(s, "deal"), say("end", "cold", "leave", null)),
      },
    },
  ],
  gbr_v_spring_rice_warn: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "calm"),
          take(s, "cotton"),
          say("end", "warm", "leave", null),
        ),
      },
    },
  ],
  gbr_t_grey_conf: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "deal"), take(s, "why"), take(s, "leave")),
      },
    },
  ],
  gbr_t_grey_leave: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("stay", "frank", "ask", "b_stay"),
          take(s, "deal"),
          take(s, "fear"),
          take(s, "leave"),
        ),
        b_stay: node(take(s, "ask"), say("end", "warm", "leave", null)),
      },
    },
  ],
  gbr_t_carson_war: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "deal"),
          take(s, "ask"),
          take(s, "king"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_grey_eyes: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("read", "warm", "ask", "b_read", {
            effects: [trust(w, 1)],
            tell: ["trust:+1"],
          }),
          take(s, "ask"),
          take(s, "work"),
        ),
        b_read: node(take(s, "deal"), say("end", "warm", "leave", null)),
      },
    },
  ],
  gbr_t_redmond_speech: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "deal"), take(s, "ask"), take(s, "leave")),
      },
    },
  ],
  gbr_t_mckenna_lg: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("why", "frank", "ask", "b_why"),
          say("old", "cold", "push", "wall"),
          take(s, "share"),
        ),
        b_why: node(take(s, "count"), say("end", "warm", "leave", null)),
      },
    },
  ],
  gbr_v_wilson_gossip: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "what_want"),
          take(s, "arm_off"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_balfour_cid: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "thick"),
          say("both", "frank", "ask", "mean"),
          take(s, "pact"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_churchill_fleet: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "plan"),
          take(s, "word"),
          take(s, "hold"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_grey_france: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "deal"), take(s, "ask"), take(s, "leave")),
      },
    },
    {
      id: "shut",
      when: sour(w),
      start: "shut_open",
      nodes: {
        shut_open: node(take(s, "press"), take(s, "leave")),
      },
    },
  ],
  gbr_t_redmond_counties: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "votes"), take(s, "leave")),
      },
    },
    {
      id: "shut",
      when: sour(w),
      start: "shut_open",
      nodes: {
        shut_open: node(take(s, "deal"), take(s, "votes"), take(s, "leave")),
      },
    },
  ],
  gbr_t_carson_clean: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("can", "cold", "ask", "b_can"),
          say("cant", "frank", "ask", "b_cant"),
          take(s, "law"),
          take(s, "leave"),
        ),
        b_can: node(take(s, "ask"), say("end", "cold", "leave", null)),
        b_cant: node(take(s, "deal"), take(s, "ask")),
      },
    },
  ],
  gbr_t_hankey_truth: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "today"), take(s, "chief"), take(s, "leave")),
      },
    },
  ],
  gbr_t_king_letters: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "deal"), take(s, "leave")),
      },
    },
    {
      id: "shut",
      when: sour(w),
      start: "shut_open",
      nodes: {
        shut_open: node(take(s, "stop"), take(s, "leave")),
      },
    },
  ],
  gbr_t_king_ulster: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "listen"),
          take(s, "const"),
          take(s, "deal"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_lg_budget: (s, w): MoreTalk[] => [
    {
      id: "shut",
      when: sour(w),
      start: "shut_open",
      nodes: {
        shut_open: node(take(s, "stand"), take(s, "press"), take(s, "later")),
      },
    },
  ],
  gbr_t_redmond_convention: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "deal"), take(s, "ask"), take(s, "leave")),
      },
    },
  ],
  gbr_t_redmond_volunteers: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "rifles"),
          take(s, "ask"),
          take(s, "deal"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_v_buchanan_warn: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "courage", { next: null }), take(s, "leave")),
      },
    },
  ],
  gbr_t_carson_rifles: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "deal"),
          take(s, "arrest"),
          take(s, "ask"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_grey_house: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "what"), take(s, "deal"), take(s, "leave")),
      },
    },
  ],
  gbr_t_lg_belgium: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("mine", "frank", "ask", "hedge"),
          take(s, "deal"),
          take(s, "push"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_mckenna_police: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "guard"), take(s, "show"), take(s, "leave")),
      },
    },
  ],
  gbr_t_robertson_frocks: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "stand_with"),
          take(s, "who_talks"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_king_assent: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "ask"),
          take(s, "law"),
          take(s, "deal"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_venetia_montagu: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "later"), take(s, "ask"), take(s, "press")),
      },
    },
  ],
  gbr_t_venetia_franchise: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "deal"), take(s, "later")),
      },
    },
  ],
  gbr_t_henderson_cons: (s, w): MoreTalk[] => [
    {
      id: "shut",
      when: sour(w),
      start: "shut_open",
      nodes: {
        shut_open: node(take(s, "deal"), take(s, "later")),
      },
    },
  ],
  gbr_t_kitchener_silence: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "just_me"),
          take(s, "table_asks"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_haig_corps: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("read", "warm", "ask", "chief"),
          take(s, "ask_men"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_haig_tanks: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "what_thing"),
          take(s, "order_more"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_robertson_west: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("no_road", "frank", "ask", "why"),
          take(s, "east_door"),
          take(s, "back_you"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_robertson_men: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "send"), take(s, "how_many"), take(s, "later")),
      },
    },
  ],
  gbr_t_robertson_salonika: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "count"), take(s, "pull"), take(s, "later")),
      },
    },
  ],
  gbr_v_goschen_home: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "day"), take(s, "deal"), take(s, "leave")),
      },
    },
  ],
  gbr_v_french_home: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "how_many"),
          take(s, "quiet_word"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_v_bertie_paris: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "buy"), take(s, "rude"), take(s, "leave")),
      },
    },
  ],
  gbr_t_hankey_landship: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "war"),
          take(s, "when"),
          take(s, "fund"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_redmond_division: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "deal"),
          take(s, "ask"),
          take(s, "army"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_venetia_after: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          say("how", "warm", "ask", "b_how"),
          take(s, "deal"),
          take(s, "later"),
        ),
        b_how: node(say("end", "warm", "leave", null)),
      },
    },
  ],
  gbr_t_balfour_old: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "me"),
          take(s, "cos"),
          take(s, "fin"),
          take(s, "leave"),
        ),
      },
    },
  ],
  gbr_t_law_loan: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "deal"), take(s, "later")),
      },
    },
  ],
  gbr_v_northcliffe_call: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "deal"), take(s, "ask"), take(s, "later")),
      },
    },
  ],
  gbr_t_mckenna_duties: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "why"), take(s, "cover"), take(s, "leave")),
      },
    },
  ],
  gbr_t_law_letter: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "deal"),
          take(s, "ask"),
          take(s, "warn"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_carson_office: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "deal"), take(s, "leave")),
      },
    },
  ],
  gbr_t_lg_ambition: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(
          take(s, "deal"),
          take(s, "ask"),
          take(s, "push"),
          take(s, "later"),
        ),
      },
    },
  ],
  gbr_t_balfour_admiralty: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "will"), take(s, "offer"), take(s, "leave")),
      },
    },
  ],
  gbr_t_mckenna_army: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "what"), take(s, "trade"), take(s, "leave")),
      },
    },
  ],
  gbr_v_asquith_old: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "deal"), take(s, "later")),
      },
    },
  ],
  gbr_t_henderson_after: (s, w): MoreTalk[] => [
    {
      id: "b",
      start: "b_open",
      nodes: {
        b_open: node(take(s, "ask"), take(s, "deal"), take(s, "later")),
      },
    },
  ],
};

const BODIES: Readonly<Record<string, readonly MoreBody[]>> = {
  gbr_w_ledger: [
    { id: "trench2", like: "trench" },
    { id: "trench3", like: "trench" },
    { id: "thin2", like: "thin" },
    { id: "base2", like: "base" },
    { id: "base3", like: "base" },
  ],
  gw_gbr_coalition: [
    { id: "b2", like: "base" },
    { id: "b3", like: "base" },
  ],
  gw_gbr_entry: [
    { id: "belgium2", like: "belgium" },
    { id: "belgium3", like: "belgium" },
    { id: "base2", like: "base" },
    { id: "late1", when: putOff },
    { id: "late2", when: putOff },
    { id: "late3", when: putOff },
  ],
  gbr_c_deputation: [{ id: "base2", like: "base" }],
  gbr_w_french_out: [{ id: "base2", like: "base" }],
  gbr_c_neutrality_league: [
    { id: "base2", like: "base" },
    { id: "base3", like: "base" },
  ],
  gbr_h_engagement: [{ id: "base2", like: "base" }],
  gbr_c_war_office_held: [
    { id: "tired2", like: "tired" },
    { id: "base2", like: "base" },
  ],
  gbr_c_budget_muddle: [
    { id: "sly2", like: "sly" },
    { id: "base2", like: "base" },
  ],
  gbr_c_note_read: [
    { id: "map2", like: "map" },
    { id: "base2", like: "base" },
  ],
  gbr_c_palace: [
    { id: "base2", like: "base" },
    { id: "pressed2", like: "pressed" },
  ],
  gbr_c_cabinet_one: [
    { id: "warned2", like: "warned" },
    { id: "ulster2", like: "ulster_still" },
    { id: "base2", like: "base" },
  ],
  gbr_c_commons: [
    { id: "base2", like: "base" },
    { id: "base3", like: "base" },
  ],
  gbr_c_roster: [
    { id: "ulster2", like: "ulster" },
    { id: "naval2", like: "naval" },
    { id: "base2", like: "base" },
  ],
  gbr_c_cambon: [
    { id: "warned2", like: "warned" },
    { id: "base2", like: "base" },
    { id: "known2", like: "known" },
  ],
  gbr_c_cabinet_two: [
    { id: "base2", like: "base" },
    { id: "base3", like: "base" },
  ],
  gbr_w_lists: [
    { id: "long2", like: "long" },
    { id: "pals2", like: "pals" },
  ],
  gbr_f_peace_ulster: [
    { id: "rifles2", like: "rifles" },
    { id: "base2", like: "base" },
    // ww190 §2: fewer repeats.
    { id: "n2", like: "n" },
    { id: "base3", like: "base" },
  ],
  gbr_c_city: [
    { id: "sly2", like: "sly" },
    { id: "base2", like: "base" },
  ],
  gbr_c_amending: [
    { id: "hot2", like: "hot" },
    { id: "base2", like: "base" },
  ],
  gbr_f_straits_promise: [
    { id: "cold2", like: "cold" },
    { id: "ships2", like: "ships" },
  ],
  gbr_c_ultimatum: [{ id: "base2", like: "base" }],
  gbr_c_sarajevo_wire: [{ id: "base2", like: "base" }],
  gbr_f_peace_notes: [{ id: "behind2", like: "behind" }],
  gbr_c_tyrone: [{ id: "base2", like: "base" }],
  gbr_c_home_rule_act: [{ id: "base2", like: "base" }],
  gbr_c_bef: [
    { id: "liege2", like: "liege" },
    { id: "base2", like: "base" },
  ],
  gbr_c_ulster_rifles: [{ id: "base2", like: "base" }],
  gbr_h_ireland_talks: [
    { id: "after2", like: "after_easter" },
    { id: "base2", like: "base" },
  ],
  gbr_f_house: [{ id: "base2", like: "base" }],
  gw_home_gbr_1: [
    { id: "b2", like: "base" },
    { id: "b3", like: "base" },
  ],
  gbr_f_armistice: [
    { id: "no_america2", like: "no_america" },
    { id: "soil2", like: "france_soil" },
  ],
  gbr_c_retreat: [
    { id: "kit2", like: "kit" },
    { id: "base2", like: "base" },
  ],
  gbr_h_franchise: [{ id: "base2", like: "base" }],
  gbr_f_peace_summer: [
    { id: "base2", like: "base" },
    // ww190 §2: fewer repeats.
    { id: "humbled2", like: "humbled" },
    { id: "base3", like: "base" },
  ],
  gbr_c_naval_talks: [{ id: "base2", like: "base" }],
  gbr_f_dollars: [{ id: "base2", like: "base" }],
  gbr_f_vienna_feeler: [
    { id: "talk2", like: "talk" },
    { id: "base2", like: "base" },
  ],
  gbr_f_conference: [
    { id: "two2", like: "two" },
    { id: "base2", like: "base" },
  ],
  gbr_f_blockade: [{ id: "base2", like: "base" }],
  gbr_w_jutland: [{ id: "base2", like: "base" }],
  gbr_w_new_armies: [{ id: "base2", like: "base" }],
  gbr_h_conscription: [{ id: "irish2", like: "irish_first" }],
  gbr_f_late_entry: [
    { id: "again1", when: askedLate },
    { id: "again2", when: askedLate },
  ],
};

function withBody(variants: readonly GwVariant[], b: MoreBody): GwVariant[] {
  if ("when" in b) return [{ id: b.id, when: b.when }, ...variants];
  const at = variants.findIndex((v) => v.id === b.like);
  if (at < 0) throw new Error(`no body ${b.like} for ${b.id}`);
  const out = [...variants];
  const { when, assumes } = variants[at];
  out.splice(at, 0, {
    id: b.id,
    ...(when === undefined ? {} : { when }),
    // ww187: a second body takes for granted what the first one does.
    ...(assumes === undefined ? {} : { assumes }),
  });
  return out;
}

/** The scenes with their second bodies in. */
export function withMore(scenes: readonly GwScene[]): GwScene[] {
  return scenes.map((s) => {
    let out = s;
    for (const b of BODIES[s.id] ?? []) {
      out = { ...out, variants: withBody(out.variants, b) };
    }
    const talks = TALKS[s.id];
    if (talks === undefined) return out;
    for (const t of talks(s, { role: s.who! })) {
      const b: MoreBody =
        t.when === undefined
          ? { id: t.id, like: out.variants[out.variants.length - 1].id }
          : { id: t.id, when: t.when };
      out = {
        ...out,
        variants: withBody(out.variants, b),
        starts: { ...out.starts, [t.id]: t.start },
        nodes: { ...out.nodes, ...t.nodes },
      };
    }
    return out;
  });
}
