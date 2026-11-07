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
  voices?: GwScene["voices"];
}

function sameReply(s: GwScene, x: GwSameReply): GwReply {
  const nodes = Object.values(s.nodes ?? {});
  const from = nodes.flatMap((n) => n.replies).find((r) => r.id === x.same);
  if (from === undefined) throw new Error(`${s.id}: no reply ${x.same}`);
  if (x.next === undefined) return from;
  // A new road: the old reply's detours lead back to the old talk.
  const road: GwReply = { ...from, next: x.next };
  delete road.reacts;
  delete road.miss;
  return road;
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
    ...(b.voices === undefined ? {} : { voices: b.voices }),
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
      b3: {
        replies: [
          {
            id: "thanks",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
          {
            same: "take",
          },
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            next: "why",
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
      b3: {
        replies: [
          {
            id: "rebuked",
            stance: "frank",
            kind: "ask",
            next: "wants",
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
  auh_t_tisza_romania: {
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
      b3: {
        replies: [
          {
            id: "medal",
            stance: "warm",
            kind: "ask",
            next: "want",
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
      b3: {
        replies: [
          {
            same: "health",
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
      b3: {
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
  },
  auh_t_bil_bill: {
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
      b3: {
        replies: [
          {
            id: "answer",
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
            same: "deal",
          },
          {
            id: "no",
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
      b3: {
        replies: [
          {
            same: "hear",
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
      b3: {
        replies: [
          {
            same: "ask",
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
  auh_t_kar_land: {
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
            same: "how",
          },
          {
            same: "own",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_karl_hungary: {
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
            same: "oath",
          },
          {
            same: "warn",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_karl_peace: {
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
            id: "lost",
            stance: "frank",
            kind: "ask",
            next: "plan",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_karl_peace",
              },
            ],
          },
          {
            same: "test",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_hoyos_young: {
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
  },
  auh_t_kar_split: {
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
            same: "count",
          },
          {
            same: "stay",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_stu_closed: {
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
  },
  auh_t_hoyos_halt: {
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
      kind: "seen",
      scene: "auh_c_serb_reply",
    },
  },
  auh_t_tisza_terms: {
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
            same: "press",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_t_bol_halt: {
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
        ],
      },
    },
  },
  auh_t_bur_between: {
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
  },
  auh_t_ber_clause: {
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
  },
  auh_t_bil_inquiry: {
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
  },
  auh_t_con_wait: {
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
            id: "late",
            stance: "frank",
            kind: "ask",
            next: "lose",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_con_wait",
              },
            ],
          },
          {
            same: "order",
          },
          {
            same: "trade",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_t_ber_rome: {
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
  auh_v_pil_terms: {
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
            same: "words",
          },
          {
            same: "no",
          },
        ],
      },
    },
  },
  auh_t_stu_decree: {
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
  },
  auh_t_kar_vote: {
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
            same: "how",
          },
          {
            same: "doubt",
          },
          {
            same: "say",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_v_ff_program: {
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
            same: "warm",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_v_rival_complaint: {
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
            same: "hear",
          },
          {
            same: "deal",
          },
          {
            same: "out",
          },
        ],
      },
    },
  },
  auh_v_night_court_k: {
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
      b3: {
        replies: [
          {
            id: "sit",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
          {
            id: "one",
            stance: "frank",
            kind: "ask",
            next: "worst",
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  auh_t_ber_after: {
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
  },
  auh_t_hoyos_term: {
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
  },
  auh_t_tisza_wait: {
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
            same: "fear",
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
  auh_t_karl_funeral: {
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
            same: "why",
          },
          {
            same: "terms",
          },
          {
            same: "no",
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
  auh_t_krob_harvest: {
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
            same: "budget",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_t_hoyos_partition: {
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
  },
  auh_v_land_days: {
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
  auh_v_lam_plan: {
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
            same: "read",
          },
          {
            same: "short",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_kra_amnesty: {
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
  },
  auh_t_bor_socks: {
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
          },
          {
            same: "deal",
          },
          {
            same: "ask",
          },
          {
            same: "leave",
          },
        ],
      },
    },
  },
  auh_v_kor_may: {
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
            same: "show",
          },
          {
            same: "first",
          },
          {
            same: "bye",
          },
        ],
      },
    },
  },
  auh_t_ber_brake: {
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
  },
  auh_t_tisza_grain: {
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
    voices: {
      court: [
        {
          id: "on",
          when: {
            kind: "opening",
            of: ["sarajevo"],
          },
        },
        {
          id: "off",
        },
      ],
    },
  },
  auh_c_roster: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_who_signs: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_funeral: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_hoyos_mission: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_berlin_answer: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_council_july: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
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
          kind: "all",
          of: [
            {
              kind: "opening",
              of: ["no_sarajevo"],
            },
            {
              kind: "crisis",
              topic: "balkan",
            },
          ],
        },
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_harvest: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
    gate: {
      kind: "chapter",
      max: 5,
    },
  },
  auh_c_note_draft: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_note_out: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_serb_reply: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_mob_plan: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_no_annex: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_tisza_letter: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_c_italy_art7: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
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
          kind: "all",
          of: [
            {
              kind: "opening",
              of: ["no_sarajevo"],
            },
            {
              kind: "crisis",
              topic: "balkan",
            },
          ],
        },
      },
      {
        id: "base3",
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
  auh_k_new_form: {
    gate: {
      kind: "world",
      of: {
        is: "date",
        from: "1917-07",
      },
    },
  },
  auh_c_note_timing: {
    variants: [
      {
        id: "base2",
      },
    ],
    gate: {
      kind: "chapter",
      max: 5,
    },
  },
  auh_c_decree: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_k_peace_vote: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_h_peace_ausgleich: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
  auh_k_coronation: {
    variants: [
      {
        id: "peace2",
        like: "peace",
      },
    ],
  },
  auh_k_succession: {
    variants: [
      {
        id: "peace2",
        like: "peace",
      },
    ],
  },
  auh_k_new_men: {
    variants: [
      {
        id: "peace2",
        like: "peace",
      },
    ],
  },
  auh_w_lists: {
    variants: [
      {
        id: "long2",
        like: "long",
      },
      {
        id: "long3",
        like: "long",
      },
      {
        id: "base2",
      },
    ],
  },
  auh_w_regiments: {
    variants: [
      {
        id: "fear2",
        like: "fear",
      },
    ],
  },
  auh_h_grain_border: {
    variants: [
      {
        id: "again2",
        like: "again",
      },
    ],
  },
  auh_h_strike_1: {
    variants: [
      {
        id: "again2",
        like: "again",
      },
    ],
  },
  gw_auh_quota: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
      {
        id: "base4",
      },
      {
        id: "base5",
      },
    ],
  },
  gw_home_auh_1: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "base3",
      },
    ],
  },
  auh_w_ledger_1915: {
    variants: [
      {
        id: "base2",
      },
      {
        id: "thin2",
        like: "thin",
      },
    ],
  },
  auh_w_ledger_1916: {
    variants: [
      {
        id: "base2",
      },
    ],
  },
};

/** A summer with no shot: what the desk has instead. */
export const AUH_QUIET_SCENES: readonly GwScene[] = [
  {
    nation: ["AUH"],
    stage: ["crisis", "y1914"],
    tags: ["foreign"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    id: "auh_c_q_constanta",
    kind: "report",
    when: {
      kind: "all",
      of: [
        {
          kind: "opening",
          of: ["no_sarajevo"],
        },
        {
          kind: "not",
          of: {
            kind: "crisis",
            topic: "balkan",
          },
        },
        {
          kind: "chapter",
          min: 1,
          max: 3,
        },
      ],
    },
    cast: {
      fm: {
        office: "foreign",
      },
    },
    salience: 6,
    stamp: "confirmed",
    source: "staff",
  },
  {
    nation: ["AUH"],
    stage: ["crisis", "y1914"],
    tags: ["home"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    id: "auh_c_q_bosnia_rail",
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        {
          kind: "opening",
          of: ["no_sarajevo"],
        },
        {
          kind: "not",
          of: {
            kind: "crisis",
            topic: "balkan",
          },
        },
        {
          kind: "chapter",
          min: 2,
          max: 4,
        },
      ],
    },
    cast: {
      fin: {
        office: "finance",
      },
      fm: {
        office: "foreign",
      },
    },
    salience: 6,
    options: [
      {
        id: "shelve",
        tell: [],
        effects: [],
      },
      {
        id: "hungary_line",
        tell: ["hungary:+1", "money:-1"],
        effects: [
          {
            kind: "inst",
            inst: "hungary",
            delta: 1,
          },
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
        ],
      },
      {
        id: "army_line",
        tell: ["army:+1", "hungary:-1", "temp:+1"],
        effects: [
          {
            kind: "inst",
            inst: "army",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "hungary",
            delta: -1,
          },
          {
            kind: "temp",
            delta: 1,
          },
        ],
      },
    ],
    fallback: "shelve",
  },
  {
    nation: ["AUH"],
    stage: ["crisis", "y1914"],
    tags: ["home", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    id: "auh_c_q_bohemia",
    kind: "proposal",
    when: {
      kind: "all",
      of: [
        {
          kind: "opening",
          of: ["no_sarajevo"],
        },
        {
          kind: "not",
          of: {
            kind: "crisis",
            topic: "balkan",
          },
        },
        {
          kind: "chapter",
          min: 2,
          max: 5,
        },
      ],
    },
    cast: {
      chancellor: {
        office: "chancellor",
      },
    },
    salience: 6,
    options: [
      {
        id: "leave",
        tell: ["nations:-1"],
        effects: [
          {
            kind: "inst",
            inst: "nations",
            delta: -1,
          },
        ],
      },
      {
        id: "talks",
        tell: ["nations:+1", "chancellor:-1"],
        effects: [
          {
            kind: "inst",
            inst: "nations",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "chancellor",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "visit",
        tell: ["money:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: -1,
          },
        ],
      },
    ],
    fallback: "leave",
  },
  {
    nation: ["AUH"],
    stage: ["crisis", "y1914"],
    tags: ["war", "people"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    id: "auh_c_q_manoeuvre",
    kind: "audience",
    when: {
      kind: "all",
      of: [
        {
          kind: "opening",
          of: ["no_sarajevo"],
        },
        {
          kind: "not",
          of: {
            kind: "crisis",
            topic: "balkan",
          },
        },
        {
          kind: "chapter",
          min: 3,
          max: 5,
        },
      ],
    },
    cast: {
      cos: {
        office: "chief_of_staff",
      },
      ff: {
        person: "auh_ff",
      },
    },
    salience: 6,
    options: [
      {
        id: "ff_on_top",
        tell: ["cos:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "ff",
            },
            delta: 1,
          },
        ],
      },
      {
        id: "chief_runs",
        tell: ["cos:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "cos",
            },
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "ff",
            },
            delta: -1,
          },
        ],
      },
      {
        id: "cut_short",
        tell: ["money:+1", "army:-1"],
        effects: [
          {
            kind: "gauge",
            gauge: "money",
            delta: 1,
          },
          {
            kind: "inst",
            inst: "army",
            delta: -1,
          },
        ],
      },
    ],
    fallback: "ff_on_top",
  },
  {
    nation: ["AUH"],
    stage: ["crisis", "y1914"],
    tags: ["home", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    id: "auh_c_q_birthday",
    kind: "wire",
    when: {
      kind: "all",
      of: [
        {
          kind: "opening",
          of: ["no_sarajevo"],
        },
        {
          kind: "not",
          of: {
            kind: "crisis",
            topic: "balkan",
          },
        },
        {
          kind: "chapter",
          min: 4,
          max: 6,
        },
      ],
    },
    cast: {
      court: {
        office: "court",
      },
    },
    salience: 6,
  },
];
