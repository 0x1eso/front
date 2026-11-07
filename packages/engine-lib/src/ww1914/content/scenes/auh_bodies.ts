import type {
  GwCond,
  GwNode,
  GwReply,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「오스트리아-헝가리」, the last pass over the four shares: more bodies for the
 * scenes that come in most games, a talk's second opening with a shape of its
 * own, and the fences that keep a scene to the run it belongs to. Data only;
 * the text sits with each scene in resources/ww1914/ko/AUH.*.json.
 */

/** A reply of the scene taken over by id, price and all, with its own words. */
interface GwSameReply {
  same: string;
  next?: string | null;
}
type GwBodyReply = GwSameReply | GwReply;

interface GwBodies {
  /** Added before the scene's own; `like` takes a sibling's `when`. */
  variants?: readonly (GwVariant & { like?: string })[];
  starts?: Readonly<Record<string, string>>;
  nodes?: Readonly<Record<string, { replies: readonly GwBodyReply[] }>>;
  /** Added to the scene's `when`. */
  gate?: GwCond;
}

function sameReply(s: GwScene, x: GwSameReply): GwReply {
  const nodes = Object.values(s.nodes ?? {});
  const from = nodes.flatMap((n) => n.replies).find((r) => r.id === x.same);
  if (from === undefined) throw new Error(`${s.id}: no reply ${x.same}`);
  if (x.next === undefined) return from;
  // A new road: the old reply's detours lead back to the old talk.
  const { reacts: _r, miss: _m, ...rest } = from;
  return { ...rest, next: x.next };
}

function node(s: GwScene, replies: readonly GwBodyReply[]): GwNode {
  return {
    says: [{ id: "base" }],
    replies: replies.map((r) => ("same" in r ? sameReply(s, r) : r)),
  };
}

function apply(s: GwScene, b: GwBodies): GwScene {
  const like = (id: string) => s.variants.find((v) => v.id === id)?.when;
  const added = (b.variants ?? []).map(({ like: l, ...v }): GwVariant => {
    const when = l === undefined ? v.when : like(l);
    return when === undefined ? { id: v.id } : { id: v.id, when };
  });
  const nodes = Object.entries(b.nodes ?? {}).map(
    ([id, n]) => [id, node(s, n.replies)] as const,
  );
  return {
    ...s,
    variants: [...added, ...s.variants],
    ...(b.gate === undefined
      ? {}
      : {
          when:
            s.when === undefined
              ? b.gate
              : ({ kind: "all", of: [s.when, b.gate] } as GwCond),
        }),
    ...(b.starts === undefined ? {} : { starts: { ...s.starts, ...b.starts } }),
    ...(nodes.length === 0
      ? {}
      : { nodes: { ...s.nodes, ...Object.fromEntries(nodes) } }),
  };
}

/** The four shares with this pass laid over them. */
export function withAuhBodies(list: readonly GwScene[]): GwScene[] {
  return list.map((s) => {
    const b = BODIES[s.id];
    return b === undefined ? s : apply(s, b);
  });
}

const BODIES: Readonly<Record<string, GwBodies>> = {
  auh_v_koer_quota: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "both",
            stance: "frank",
            kind: "ask",
            next: "b2n",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_koer_quota",
              },
            ],
          },
          {
            same: "again",
          },
          {
            same: "back",
          },
          {
            same: "bye",
          },
        ],
      },
      b2n: {
        replies: [
          {
            id: "sum2",
            stance: "cold",
            kind: "ask",
            next: "sum",
            tell: [],
            effects: [],
          },
          {
            id: "keep",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_v_night_court: {
    variants: [
      {
        id: "b2",
      },
      {
        id: "b3",
      },
    ],
    starts: {
      b2: "b2",
      b3: "b3",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "name",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
          {
            id: "first",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      b3: {
        replies: [
          {
            id: "know",
            stance: "frank",
            kind: "ask",
            next: "b3a",
            tell: [],
            effects: [],
          },
          {
            id: "sure",
            stance: "cold",
            kind: "push",
            next: "done",
            tell: [],
            effects: [],
          },
          {
            id: "deal2",
            stance: "warm",
            kind: "deal",
            next: "b3a",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  person: "auh_bolfras",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      b3a: {
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
          {
            id: "end2",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_v_tisza_resign: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "keep",
            next: "b2s",
          },
          {
            same: "take",
          },
          {
            same: "threat",
            next: "b2d",
          },
        ],
      },
      b2s: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      b2d: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
          {
            id: "back",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_t_zita_brothers: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "no",
            stance: "frank",
            kind: "ask",
            next: "b2a",
            tell: [],
            effects: [],
          },
          {
            id: "yes",
            stance: "cold",
            kind: "push",
            next: "edge",
            tell: [],
            effects: [],
          },
          {
            same: "post",
          },
          {
            same: "bye",
          },
        ],
      },
      b2a: {
        replies: [
          {
            id: "sixtus",
            stance: "frank",
            kind: "ask",
            next: "six",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_zita_brothers",
              },
            ],
          },
          {
            id: "thanks",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_v_tsch_push: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            id: "yours",
            stance: "frank",
            kind: "ask",
            next: "whose",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tsch_push",
              },
            ],
          },
          {
            same: "deal",
          },
          {
            same: "door",
          },
        ],
      },
    },
  },
  auh_t_tisza_romania: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "still",
            stance: "frank",
            kind: "push",
            next: "b2y",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_tisza_romania",
              },
            ],
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
      b2y: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_v_conrad_resign: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
            next: "b2a",
          },
          {
            same: "deal",
            next: "b2a",
          },
          {
            same: "push",
          },
          {
            same: "leave",
          },
        ],
      },
      b2a: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
    gate: {
      kind: "any",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
  },
  auh_t_bol_conrad: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "push",
            next: "b2o",
          },
          {
            id: "key",
            stance: "warm",
            kind: "deal",
            next: "tells",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bol_conrad",
              },
            ],
          },
          {
            same: "leave",
          },
        ],
      },
      b2o: {
        replies: [
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bol_conrad",
              },
            ],
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_bol_names: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "line",
            stance: "frank",
            kind: "ask",
            next: "field",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bol_names",
              },
            ],
          },
          {
            id: "his",
            stance: "flatter",
            kind: "ask",
            next: "b2f",
            tell: [],
            effects: [],
          },
          {
            same: "swap",
          },
          {
            same: "leave",
          },
        ],
      },
      b2f: {
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bol_names",
              },
            ],
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_cz_price: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "still",
            stance: "frank",
            kind: "ask",
            next: "sum",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_cz_price",
              },
            ],
          },
          {
            same: "name",
          },
          {
            same: "bye",
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_con_moltke: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "ask",
            next: "b2y",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_con_moltke",
              },
            ],
          },
          {
            id: "no",
            stance: "frank",
            kind: "ask",
            next: "count",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_con_moltke",
              },
            ],
          },
          {
            same: "leave",
          },
        ],
      },
      b2y: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
    gate: {
      kind: "any",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
  },
  auh_t_cz_king: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "wait",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_cz_king",
              },
            ],
          },
          {
            id: "eat",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_cz_king",
              },
            ],
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_bol_days: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "health",
          },
          {
            same: "line",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_t_bor_isonzo: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_adl_pulse: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "saw",
            stance: "frank",
            kind: "ask",
            next: "pulse",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_pulse",
              },
            ],
          },
          {
            same: "cold",
            next: "b2c",
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
      b2c: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_t_bil_bill: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "silver",
            stance: "frank",
            kind: "ask",
            next: "b2s",
            tell: [],
            effects: [],
          },
          {
            id: "paper",
            stance: "cold",
            kind: "ask",
            next: "bill",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bil_bill",
              },
            ],
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
      b2s: {
        replies: [
          {
            id: "more",
            stance: "frank",
            kind: "ask",
            next: "bill",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_bil_bill",
              },
            ],
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_t_kar_first: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "no",
            stance: "frank",
            kind: "ask",
            next: "hear",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_kar_met",
              },
            ],
          },
          {
            same: "rebuke",
          },
          {
            same: "seat",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_stu_open: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            same: "threat",
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_bol_heir: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            same: "swap",
          },
          {
            same: "push",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_delayed"],
        },
      ],
    },
  },
  auh_t_con_gina: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "who",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_adl_open: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "czech",
            stance: "frank",
            kind: "ask",
            next: "first",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_adl_open",
              },
            ],
          },
          {
            same: "cold",
            next: "b2n",
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
      b2n: {
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_cz_bucharest: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "treaty",
          },
          {
            same: "pay",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_krob_rail: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            id: "call",
            stance: "warm",
            kind: "ask",
            next: "muddle",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_krob_rail",
              },
            ],
          },
          {
            same: "both",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "any",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
  },
  auh_t_stu_letters: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_bil_bosnia: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            same: "deal",
          },
          {
            same: "leave",
          },
        ],
      },
    },
    gate: {
      kind: "any",
      of: [
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
        {
          kind: "all",
          of: [
            {
              kind: "opening",
              of: ["sarajevo_delayed"],
            },
            {
              kind: "chapter",
              min: 2,
            },
          ],
        },
      ],
    },
  },
  auh_t_tisza_oath: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "ask",
          },
          {
            same: "deal",
          },
          {
            same: "hard",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_t_kar_paris: {
    variants: [
      {
        id: "b2",
      },
    ],
    starts: {
      b2: "b2",
    },
    nodes: {
      b2: {
        replies: [
          {
            same: "terms",
          },
          {
            same: "spy",
          },
          {
            same: "bye",
          },
        ],
      },
    },
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_c_ischl_wire: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_roster: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_who_signs: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_funeral: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_hoyos_mission: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_berlin_answer: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_council_july: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_wiesner: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "spark",
        when: {
          kind: "opening",
          of: ["no_sarajevo"],
        },
      },
    ],
  },
  auh_c_harvest: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_note_draft: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_note_out: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_serb_reply: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_mob_plan: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_no_annex: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_tisza_letter: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_italy_art7: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_c_grey_conference: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "spark",
        when: {
          kind: "opening",
          of: ["no_sarajevo"],
        },
      },
    ],
  },
  auh_c_war_serbia: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_k_old_age: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "peace2",
        like: "peace",
      },
    ],
  },
  auh_w_belgrade_fest: {
    variants: [
      {
        id: "jubilee",
        when: {
          kind: "world",
          of: {
            is: "date",
            from: "1914-12",
            to: "1914-12",
          },
        },
      },
    ],
  },
  auh_w_potiorek: {
    variants: [
      {
        id: "quiet",
        when: {
          kind: "opening",
          of: ["no_sarajevo"],
        },
      },
    ],
  },
  auh_t_bur_rome: {
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_bur_peace: {
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_tisza_franchise: {
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_h_nov_act: {
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_v_land_days: {
    gate: {
      kind: "world",
      of: {
        is: "war",
      },
    },
  },
  auh_t_ber_rome: {
    gate: {
      kind: "any",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "crisis",
          topic: "balkan",
        },
      ],
    },
  },
  auh_t_karl_teschen: {
    gate: {
      kind: "holder",
      office: "chief_of_staff",
      person: "auh_conrad",
    },
  },
  auh_t_karl_xx: {
    gate: {
      kind: "holder",
      office: "chief_of_staff",
      person: "auh_conrad",
    },
  },
  auh_t_tisza_wait: {
    gate: {
      kind: "any",
      of: [
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
        {
          kind: "all",
          of: [
            {
              kind: "opening",
              of: ["sarajevo_delayed"],
            },
            {
              kind: "chapter",
              min: 2,
            },
          ],
        },
      ],
    },
  },
  auh_t_karl_funeral: {
    gate: {
      kind: "any",
      of: [
        {
          kind: "opening",
          of: ["sarajevo", "sarajevo_survived", "sarajevo_failed"],
        },
        {
          kind: "all",
          of: [
            {
              kind: "opening",
              of: ["sarajevo_delayed"],
            },
            {
              kind: "chapter",
              min: 2,
            },
          ],
        },
      ],
    },
  },
};
