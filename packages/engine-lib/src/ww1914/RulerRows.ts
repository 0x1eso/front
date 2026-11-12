// Great War 1914: the person at the desk, one row each. A later country adds a
// list. The rule that reads these is engine/ww1914/Ruler. Text: the pack's
// `rulers.<id>`, and reason lines `<id>_age`, `_unseen`, `_toll`, `_praised`,
// `_blamed`, `_failing`, `_shaken`, `_broken`.
//
// Marks, gates and bodies lie over scenes written elsewhere, so a scene's file
// doesn't change.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwRulerSide } from "@openfront/engine-api/ww1914/GwRuler";
import {
  all,
  GwCond,
  GwOption,
  GwScene,
  not,
} from "@openfront/engine-api/ww1914/SceneDsl";

export interface GwRulerRow {
  readonly id: string;
  /** The person in the cast, where there is one. */
  readonly person?: string;
  /** Regimes this row sits in; absent: all of them. */
  readonly regimes?: readonly string[];
  /** A seat flag it needs. The first row that fits is the seat's. */
  readonly flag?: string;
  readonly born: string;
  /** Where the card starts, before the seed's nudge. */
  readonly start: Readonly<Record<GwRulerSide, number>>;
  /** Months between a step of health lost to age and the work. */
  readonly agesEvery: number;
  /** Months unseen before reputation slips; null: nobody expects it. */
  readonly seenEvery: number | null;
  /** Thousands of the country's dead and hurt to a step of conscience. */
  readonly tollEvery: number;
  /** Can die of it. False: the end is the written succession. */
  readonly mortal: boolean;
  /** Can be put out of the chair by it. */
  readonly removable: boolean;
  /** A family at the bottom takes one summons a chapter. */
  readonly familyTakesTime: boolean;
  /** The scenes the three bottoms call. */
  readonly doctors: string | null;
  readonly shaken: string | null;
  readonly broken: string | null;
}

const side = (
  health: number,
  family: number,
  conscience: number,
  reputation: number,
  nerve: number,
) => ({ health, family, conscience, reputation, nerve });

export const GW_RULERS: Readonly<
  Partial<Record<GwTag, readonly GwRulerRow[]>>
> = {
  DEU: [
    {
      id: "wilhelm",
      regimes: ["empire"],
      born: "1859-01-27",
      start: side(4, 3, 4, 4, 3),
      agesEvery: 16,
      seenEvery: 5,
      tollEvery: 700,
      mortal: true,
      removable: true,
      familyTakesTime: false,
      doctors: "deu_life_doctors",
      shaken: "deu_life_shaken",
      broken: "deu_life_broken",
    },
  ],
  GBR: [
    {
      id: "lloyd_george",
      person: "gbr_lloyd_george",
      flag: "f_pm_lg",
      born: "1863-01-17",
      start: side(4, 3, 3, 3, 5),
      agesEvery: 18,
      seenEvery: null,
      tollEvery: 700,
      mortal: true,
      removable: true,
      familyTakesTime: false,
      doctors: "gbr_life_doctors",
      shaken: "gbr_life_shaken",
      broken: "gbr_life_broken",
    },
    {
      id: "asquith",
      person: "gbr_asquith",
      born: "1852-09-12",
      start: side(4, 4, 4, 4, 4),
      agesEvery: 13,
      seenEvery: null,
      tollEvery: 350,
      mortal: true,
      removable: true,
      familyTakesTime: false,
      doctors: "gbr_life_doctors",
      shaken: "gbr_life_shaken",
      broken: "gbr_life_broken",
    },
  ],
  AUH: [
    {
      id: "franz_joseph",
      regimes: ["dual_monarchy"],
      born: "1830-08-18",
      start: side(3, 3, 4, 5, 4),
      agesEvery: 9,
      seenEvery: 10,
      tollEvery: 500,
      mortal: false,
      removable: false,
      familyTakesTime: false,
      doctors: "auh_life_doctors",
      shaken: null,
      broken: "auh_life_broken",
    },
    {
      id: "karl",
      person: "auh_karl",
      regimes: ["karl"],
      born: "1887-08-17",
      start: side(4, 4, 4, 3, 3),
      agesEvery: 24,
      seenEvery: 6,
      tollEvery: 500,
      mortal: true,
      removable: true,
      familyTakesTime: false,
      doctors: "auh_life_doctors",
      shaken: "auh_life_shaken",
      broken: "auh_life_broken",
    },
    {
      id: "franz_ferdinand",
      person: "auh_ff",
      regimes: ["ff_throne"],
      born: "1863-12-18",
      start: side(3, 4, 3, 2, 4),
      agesEvery: 14,
      seenEvery: null,
      tollEvery: 700,
      mortal: true,
      removable: true,
      familyTakesTime: false,
      doctors: "auh_life_doctors",
      shaken: "auh_life_shaken",
      broken: "auh_life_broken",
    },
  ],
  RUS: [
    {
      id: "nicholas",
      person: "rus_nicholas",
      regimes: ["tsar"],
      born: "1868-05-18",
      start: side(4, 3, 4, 3, 3),
      agesEvery: 18,
      seenEvery: 9,
      tollEvery: 750,
      mortal: true,
      removable: true,
      familyTakesTime: true,
      doctors: "rus_life_doctors",
      shaken: "rus_life_shaken",
      broken: "rus_life_broken",
    },
  ],
  // France: the President, for the whole game. He goes to the front often
  // (seenEvery). Plan §1 allows three losses only: the Élysée row, the
  // Caillaux plot and his health. So reputation never puts him out by
  // itself: a low one feeds the Élysée row (GovTable, fra_idle) instead.
  FRA: [
    {
      id: "poincare",
      person: "fra_poincare",
      born: "1860-08-20",
      start: side(4, 3, 4, 3, 4),
      agesEvery: 18,
      seenEvery: 4,
      tollEvery: 500,
      mortal: true,
      removable: false,
      familyTakesTime: false,
      doctors: "fra_life_doctors",
      shaken: "fra_life_shaken",
      broken: "fra_life_broken",
    },
  ],
};

/** Every scene the rule calls. */
export function gwRulerScenes(): string[] {
  const rows = Object.values(GW_RULERS).flat();
  const all = rows.flatMap((r) => [r.doctors, r.shaken, r.broken]);
  return [...new Set(all.filter((x) => x !== null))];
}

/** What an option already written does to the card. */
export interface GwRulerMark {
  readonly scene: string;
  readonly option: string;
  readonly side: GwRulerSide;
  readonly delta: number;
  /** The reason line. */
  readonly key: string;
}

const mark = (
  scene: string,
  option: string,
  s: GwRulerSide,
  delta: number,
  key: string,
): GwRulerMark => ({ scene, option, side: s, delta, key });

/** Sending one's own men in again, with the names on the desk. */
const sent = (scene: string, option: string, id: string): GwRulerMark =>
  mark(scene, option, "conscience", -1, `${id}_sent`);

export const GW_RULER_MARKS: readonly GwRulerMark[] = [
  sent("deu_w_ypres_boys", "attack", "wilhelm"),
  sent("deu_f_verdun_plan", "sign_major", "wilhelm"),
  sent("deu_f_verdun_third_month", "go_on", "wilhelm"),
  sent("deu_f_spring_plan", "michael", "wilhelm"),
  sent("deu_f_offensive_month", "next_blow", "wilhelm"),
  sent("deu_f_last_classes", "call_class", "wilhelm"),
  mark(
    "deu_f_verdun_third_month",
    "stop_now",
    "conscience",
    1,
    "wilhelm_stopped",
  ),
  mark("deu_w_marne_order", "go_to_front", "reputation", 1, "wilhelm_at_front"),
  mark("deu_f_third_ohl", "call_pair", "reputation", -1, "wilhelm_pair_called"),

  sent("gbr_w_landing", "land", "asquith"),
  sent("gbr_w_somme_first", "agreed_date", "asquith"),
  sent("gbr_w_flanders", "approve", "asquith"),
  sent("gbr_w_kut", "relief", "asquith"),
  sent("gbr_w_march", "boys_of_18", "asquith"),
  mark("gbr_h_coalition", "coalition", "reputation", -1, "asquith_coalition"),
  mark("gbr_h_shells", "deny", "reputation", -1, "asquith_shells_denied"),

  sent("auh_w_lemberg", "hold_lemberg", "franz_joseph"),
  sent("auh_w_przemysl", "relieve_it", "franz_joseph"),
  sent("auh_w_carpathian", "push_on", "franz_joseph"),
  sent("auh_w_piave", "both_prongs", "franz_joseph"),
  sent("auh_w_last_line", "hold_where_you_are", "franz_joseph"),
  mark("auh_k_word_of_honour", "deny", "reputation", -2, "karl_denied"),
  mark("auh_k_word_of_honour", "own_it", "reputation", -1, "karl_owned"),

  sent("rus_w_gorlice", "hold_ground", "nicholas"),
  sent("rus_w_warsaw", "hold_forts", "nicholas"),
  sent("rus_w_naroch", "attack_now", "nicholas"),
  sent("rus_w_kovel", "press_guard", "nicholas"),
  sent("rus_w_berlin_road", "press_on", "nicholas"),
  mark("rus_c_heir_fall", "stay_night", "family", 1, "nicholas_stayed"),
  mark("rus_c_heir_fall", "back_to_desk", "family", -1, "nicholas_left_bed"),
  mark("rus_h_heir_bleed", "back_to_her", "family", 1, "nicholas_stayed"),
  mark("rus_h_heir_bleed", "doctors_only", "family", -1, "nicholas_left_bed"),
  mark("rus_h_heir_stavka", "take_him", "family", -1, "nicholas_took_heir"),
  mark("rus_h_friend_exile", "send_home", "family", -2, "nicholas_sent_friend"),
  mark(
    "rus_h_friend_comes",
    "quietly",
    "reputation",
    -1,
    "nicholas_friend_seen",
  ),
  mark("rus_h_keys", "give_her_keys", "reputation", -1, "nicholas_keys"),
  mark("rus_w_command", "self_command", "reputation", 1, "nicholas_command"),
  mark("rus_w_mogilev", "map_every_day", "health", -1, "nicholas_map"),
];

/** A scene that does something to the card just by coming. */
export interface GwRulerEvent {
  readonly scene: string;
  readonly side: GwRulerSide;
  readonly delta: number;
  readonly key: string;
}

export const GW_RULER_EVENTS: readonly GwRulerEvent[] = [
  {
    scene: "gbr_h_engagement",
    side: "family",
    delta: -1,
    key: "asquith_letter",
  },
  {
    scene: "gbr_h_engagement",
    side: "health",
    delta: -1,
    key: "asquith_letter",
  },
  { scene: "gbr_h_raymond", side: "family", delta: -2, key: "asquith_raymond" },
  {
    scene: "gbr_h_raymond",
    side: "conscience",
    delta: -1,
    key: "asquith_raymond",
  },
];

/**
 * An option the ruler can't bear just now. Greyed with the reason in the pack
 * (`over.<scene>.why.<option>`). A gate names only options with no `when` of
 * their own, and never all of a scene's: another way is always open.
 */
export interface GwRulerGate {
  readonly scene: string;
  readonly option: string;
  /** Open while this holds. */
  readonly open: GwCond;
}

/** With a card, and the side at or under `max`: closed. */
const atMost = (s: GwRulerSide, max: number): GwCond =>
  not({ kind: "ruler", side: s, max });
/**
 * The hand stops before it gives out. Past that it signs again: conscience at
 * the bottom reads as a different person, not as a person who can't.
 */
const handStops: GwCond = not({
  kind: "ruler",
  side: "conscience",
  min: 1,
  max: 2,
});

const gate = (scene: string, option: string, open: GwCond): GwRulerGate => ({
  scene,
  option,
  open,
});

export const GW_RULER_GATES: readonly GwRulerGate[] = [
  gate("deu_f_spring_plan", "michael", handStops),
  gate("deu_f_last_classes", "call_class", handStops),
  gate("deu_s_restrict_order", "order_public", atMost("reputation", 1)),

  gate("gbr_w_flanders", "approve", handStops),
  gate("gbr_w_kut", "relief", handStops),
  gate("gbr_h_palace_call", "stay_and_fight", atMost("health", 1)),

  gate("auh_w_lemberg", "hold_lemberg", handStops),
  gate("auh_w_last_line", "hold_where_you_are", handStops),

  gate("rus_w_command", "self_command", atMost("family", 1)),
  gate("rus_h_friend_exile", "send_home", atMost("family", 1)),
  gate("rus_h_friend_file", "read_it", atMost("family", 1)),
  gate("rus_h_heir_stavka", "take_him", atMost("family", 2)),
  gate("rus_h_peace_heir", "send_to_regiment", atMost("family", 2)),
  gate("rus_w_kovel", "press_guard", handStops),
];

/**
 * Decisions that read differently once conscience has given out: a body
 * `conscience` in the seat's `<TAG>.ruler.json`, under `over`, with its own
 * `optBy`. Scenes of one country only: the text comes with that country's pack.
 */
export const GW_RULER_BODIES: readonly string[] = [
  "deu_f_ledger",
  "deu_f_last_classes",
  "deu_f_new_arms",
  "deu_f_spring_plan",
  "deu_f_black_day",
  "deu_f_offensive_month",
  "gbr_w_ledger",
  "gbr_w_manpower",
  "gbr_w_flanders",
  "gbr_h_committee",
  "gbr_w_evacuate",
  "gbr_h_palace_call",
  "auh_w_ledger_1916",
  "auh_w_ledger_1917",
  "auh_w_ledger_1918",
  "auh_w_last_line",
  "auh_w_piave",
  "auh_k_manifesto",
  "rus_w_ledger",
  "rus_h_wagons",
  "rus_h_grain_levy",
  "rus_r_trust",
  "rus_w_kovel",
  "rus_r_capital",
];

/** The id of the body a broken conscience reads. */
export const GW_BROKEN_BODY = "conscience";

function withOptionRows(s: GwScene, o: GwOption): GwOption {
  const marks = GW_RULER_MARKS.filter(
    (m) => m.scene === s.id && m.option === o.id,
  );
  const gates = GW_RULER_GATES.filter(
    (g) => g.scene === s.id && g.option === o.id,
  );
  if (marks.length === 0 && gates.length === 0) return o;
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const opens = gates.map((g) => g.open);
  return {
    ...o,
    ...(opens.length === 0
      ? {}
      : { when: opens.length === 1 ? opens[0] : all(...opens) }),
    tell: [...o.tell, ...marks.map((m) => `${m.side}:${signed(m.delta)}`)],
    effects: [
      ...o.effects,
      ...marks.map((m) => ({
        kind: "ruler" as const,
        side: m.side,
        delta: m.delta,
        key: m.key,
      })),
    ],
  };
}

/** The scene with the card's rows laid over it. */
export function withRuler(s: GwScene): GwScene {
  const broken = GW_RULER_BODIES.includes(s.id);
  const options = s.options?.map((o) => withOptionRows(s, o));
  return {
    ...s,
    ...(options === undefined ? {} : { options }),
    ...(broken
      ? {
          variants: [
            { id: GW_BROKEN_BODY, when: { kind: "ruler_broken" as const } },
            ...s.variants,
          ],
        }
      : {}),
  };
}
