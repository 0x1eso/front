import type { GwScene, GwVariant } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * 「러시아」, private lives (ww143): ten story lines in the Tsar's circle, none
 * of them work. Each runs over the game in four to six scenes and ends by what
 * was done in it. Line ids: bot (Botkin's son), sib (Michael and Olga
 * Alexandrovna), olg (the eldest daughter), kr (K.R. and Oleg), ella, fre
 * (Fredericks), mat (Kschessinska and Sergei Mikhailovich), san (Sandro), nil
 * (Nilov), dmi (Dmitri). Memory keys start `k_p_`.
 *
 * Talks carry the tag `private`: the people tab's private meeting lists them.
 * Data only; the text is in resources/ww1914/ko/RUS.private.json.
 */
export const RUS_PRIVATE_SCENES: readonly GwScene[] = [
  {
    id: "rus_p_bot_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-07",
            to: "1914-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_botkin",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "wea",
            when: {
              kind: "temperament",
              who: {
                role: "p",
              },
              of: ["weary"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "photo",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "son",
          },
          {
            id: "sleep",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sleep",
          },
          {
            id: "scar",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "scar",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      scar: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "photo",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "son",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      son: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "offer",
          },
          {
            id: "proud",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "proud",
          },
          {
            id: "mother",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "mother",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      offer: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "do",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_kept",
              },
            ],
            next: "done",
          },
          {
            id: "drop",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      done: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      proud: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "offer",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      mother: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "offer",
          },
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sleep: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "photo",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "son",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_bot_2",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_bot_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1915-02",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_botkin",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "kept",
        when: {
          kind: "memory",
          key: "k_p_bot_kept",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: {
      kept: "k_open",
    },
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "read",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "read",
          },
          {
            id: "parcel",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_bot_parcel",
              },
            ],
            next: "parcel",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      read: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "parcel",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_bot_parcel",
              },
            ],
            next: "parcel",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      parcel: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      k_open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_sent",
              },
            ],
            next: "k_back",
          },
          {
            id: "hold",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_held",
              },
            ],
            next: "k_hold",
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "k_ask",
          },
        ],
      },
      k_ask: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "back",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_sent",
              },
            ],
            next: "k_back",
          },
          {
            id: "hold",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_held",
              },
            ],
            next: "k_hold",
          },
        ],
      },
      k_back: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      k_hold: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_bot_3",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_bot_2",
        },
        {
          kind: "any",
          of: [
            {
              kind: "not",
              of: {
                kind: "memory",
                key: "k_p_bot_kept",
              },
            },
            {
              kind: "memory",
              key: "k_p_bot_sent",
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-11",
            to: "1915-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_botkin",
      },
    },
    salience: 7,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "sent",
        when: {
          kind: "memory",
          key: "k_p_bot_sent",
        },
      },
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "funeral",
        tell: ["audiences:-1", "court:-1", "trust:+2"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "remember",
            key: "k_p_bot_went",
          },
        ],
      },
      {
        id: "write",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_bot_wrote",
          },
        ],
      },
      {
        id: "cross",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_bot_cross",
          },
        ],
      },
      {
        id: "answer",
        tell: ["trust:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_bot_silent",
          },
        ],
      },
    ],
    fallback: "write",
  },
  {
    id: "rus_p_bot_4",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_bot_2",
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_p_bot_3",
            },
            {
              kind: "memory",
              key: "k_p_bot_held",
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-03",
            to: "1916-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_botkin",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "went",
            when: {
              kind: "memory",
              key: "k_p_bot_went",
            },
          },
          {
            id: "wrote",
            when: {
              kind: "memory",
              key: "k_p_bot_wrote",
            },
          },
          {
            id: "held",
            when: {
              kind: "memory",
              key: "k_p_bot_held",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "tell",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tell",
          },
          {
            id: "boy",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "boy",
          },
          {
            id: "friend",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "friend",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tell: {
        says: [
          {
            id: "cold",
            when: {
              kind: "person_trust",
              who: {
                role: "p",
              },
              max: -1,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "rest",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_bot_told",
              },
            ],
            next: null,
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      boy: {
        says: [
          {
            id: "held",
            when: {
              kind: "memory",
              key: "k_p_bot_held",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      friend: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_friend",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_bot_5",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_bot_4",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_botkin",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "warm",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_p_bot_went",
            },
            {
              kind: "memory",
              key: "k_p_bot_wrote",
            },
          ],
        },
      },
      {
        id: "held",
        when: {
          kind: "memory",
          key: "k_p_bot_held",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    starts: {
      held: "h_open",
      base: "c_open",
    },
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "stay",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_bot_stays",
              },
            ],
            next: null,
          },
          {
            id: "order",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "rest",
          },
        ],
      },
      rest: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_stays",
              },
            ],
            next: null,
          },
        ],
      },
      h_open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "alive",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "h_end",
          },
          {
            id: "forgive",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_forgiven",
              },
            ],
            next: "h_end",
          },
          {
            id: "sorry",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "h_end",
          },
        ],
      },
      h_end: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      c_open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ok",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_bot_gone",
              },
            ],
            next: null,
          },
          {
            id: "keep",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: "c_keep",
          },
        ],
      },
      c_keep: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_sib_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1915-03",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_michael",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "boy",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "boy",
          },
          {
            id: "wife",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wife",
          },
          {
            id: "law",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_sib_law",
              },
            ],
            next: "law",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      boy: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "title",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_sib_title",
              },
            ],
            next: "thanks",
          },
          {
            id: "georgi",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "georgi",
          },
          {
            id: "later",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      georgi: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "title",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_sib_title",
              },
            ],
            next: "thanks",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      thanks: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wife: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "boy",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "boy",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      law: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_sib_2",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-10",
            to: "1915-09",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga_a",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hands",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hands",
          },
          {
            id: "peter",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "peter",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hands: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "peter",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "peter",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      peter: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "more",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ask",
          },
          {
            id: "law",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "law",
          },
        ],
      },
      law: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask2",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ask",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      ask: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["promise", "trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_sib_asked",
              },
              {
                kind: "promise",
                who: {
                  role: "p",
                },
                key: "k_p_sib_annul",
                chapters: 24,
                keep: {
                  kind: "memory",
                  key: "k_p_sib_annulled",
                },
              },
            ],
            next: "after",
          },
          {
            id: "wait",
            stance: "frank",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_sib_asked",
              },
            ],
            next: null,
          },
        ],
      },
      after: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_sib_3",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_sib_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-01",
            to: "1916-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_michael",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "law",
        when: {
          kind: "memory",
          key: "k_p_sib_law",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "title",
            when: {
              kind: "memory",
              key: "k_p_sib_title",
            },
          },
          {
            id: "cold",
            when: {
              kind: "all",
              of: [
                {
                  kind: "memory",
                  key: "k_p_sib_law",
                },
                {
                  kind: "not",
                  of: {
                    kind: "memory",
                    key: "k_p_sib_title",
                  },
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "men",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "men",
          },
          {
            id: "father",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "father",
          },
          {
            id: "title",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_sib_title",
              },
            ],
            next: "gave",
            when: {
              kind: "not",
              of: {
                kind: "memory",
                key: "k_p_sib_title",
              },
            },
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      men: {
        says: [
          {
            id: "cold",
            when: {
              kind: "person_trust",
              who: {
                role: "p",
              },
              max: -1,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_sib_letters",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      father: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      gave: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_sib_4",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "k_p_sib_asked",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga_a",
      },
    },
    salience: 6,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "sign",
        tell: ["trust:+2", "court:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_sib_annulled",
          },
          {
            kind: "keep_promise",
            who: {
              role: "p",
            },
            key: "k_p_sib_annul",
          },
        ],
      },
      {
        id: "sign_misha",
        tell: ["trust:+2", "court:-2"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "person_trust",
            who: {
              person: "rus_michael",
            },
            delta: 1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "remember",
            key: "k_p_sib_annulled",
          },
          {
            kind: "remember",
            key: "k_p_sib_title",
          },
          {
            kind: "keep_promise",
            who: {
              role: "p",
            },
            key: "k_p_sib_annul",
          },
        ],
      },
      {
        id: "hold",
        tell: ["trust:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_sib_refused",
          },
        ],
      },
    ],
    fallback: "sign",
  },
  {
    id: "rus_p_sib_5",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "k_p_sib_annulled",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-03",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_p_sib_6",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_sib_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-09",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_michael",
      },
    },
    salience: 7,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "call",
        tell: ["audiences:-1", "trust:+1"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_sib_read",
          },
        ],
      },
      {
        id: "drawer",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_sib_drawer",
          },
        ],
      },
      {
        id: "show",
        tell: ["court:+1", "trust:-2"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -2,
          },
          {
            kind: "remember",
            key: "k_p_sib_shown",
          },
        ],
      },
    ],
    fallback: "drawer",
  },
  {
    id: "rus_p_olg_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-06",
            to: "1914-08",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "carol",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "carol",
          },
          {
            id: "paper",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "paper",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      carol: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "free",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_free",
              },
            ],
            next: "free",
          },
          {
            id: "duty",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_olg_duty",
              },
            ],
            next: "duty",
          },
          {
            id: "stay",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "stay",
          },
        ],
      },
      free: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      duty: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      stay: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "free",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_free",
              },
            ],
            next: null,
          },
        ],
      },
      paper: {
        says: [
          {
            id: "noshot",
            when: {
              kind: "opening",
              of: ["no_sarajevo"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "read",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_reader",
              },
            ],
            next: null,
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_olg_2",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_olg_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-10",
            to: "1915-08",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "duty",
        when: {
          kind: "memory",
          key: "k_p_olg_duty",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "count",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
          },
          {
            id: "stop",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [],
            next: "stop",
          },
          {
            id: "kiev",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "kiev",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      kiev: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "count",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "count",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      count: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "weekly",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_count",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      stop: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_olg_3",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_olg_2",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-08",
            to: "1916-03",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga",
      },
    },
    salience: 6,
    tags: ["private", "people", "tension_down"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "walk",
            stance: "warm",
            kind: "deal",
            tell: ["audiences:-1", "trust:+1"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_walk",
              },
            ],
            next: "walk",
          },
          {
            id: "office",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_olg_office",
              },
            ],
            next: "office",
          },
          {
            id: "mother",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_olg_alone",
              },
            ],
            next: null,
          },
        ],
      },
      walk: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      office: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_olg_4",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_olg_3",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-11",
            to: "1916-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "transfer",
        tell: ["trust:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_olg_transfer",
          },
        ],
      },
      {
        id: "tell",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_olg_told_mitya",
          },
        ],
      },
      {
        id: "burn",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_olg_burned",
          },
        ],
      },
    ],
    fallback: "burn",
  },
  {
    id: "rus_p_olg_5",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_olg_2",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_olga",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "dead",
        when: {
          kind: "seen",
          scene: "rus_r_friend_dead",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "all",
              of: [
                {
                  kind: "any",
                  of: [
                    {
                      kind: "memory",
                      key: "k_p_olg_alone",
                    },
                    {
                      kind: "memory",
                      key: "k_p_olg_transfer",
                    },
                    {
                      kind: "person_trust",
                      who: {
                        role: "p",
                      },
                      max: -1,
                    },
                  ],
                },
                {
                  kind: "world",
                  of: {
                    is: "regime",
                    of: ["tsar", "crown"],
                  },
                },
              ],
            },
          },
          {
            id: "dead",
            when: {
              kind: "seen",
              scene: "rus_r_friend_dead",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "tell",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tell",
          },
          {
            id: "sign",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tell: {
        says: [
          {
            id: "cold",
            when: {
              kind: "any",
              of: [
                {
                  kind: "memory",
                  key: "k_p_olg_alone",
                },
                {
                  kind: "memory",
                  key: "k_p_olg_transfer",
                },
                {
                  kind: "person_trust",
                  who: {
                    role: "p",
                  },
                  max: -1,
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "right",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_said",
              },
            ],
            next: null,
          },
          {
            id: "hurt",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "last",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      last: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_olg_said",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_kr_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1914-10",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kr",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "oleg",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "oleg",
          },
          {
            id: "wife",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "wife",
          },
          {
            id: "old",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "old",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      old: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "oleg",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "oleg",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      oleg: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "offer",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [],
            next: "offer",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      offer: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_kr_offered",
              },
            ],
            next: null,
          },
          {
            id: "anyway",
            stance: "frank",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "k_p_kr_pressed",
              },
            ],
            next: "anyway",
          },
        ],
      },
      anyway: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      wife: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_kr_2",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_kr_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1914-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kr",
      },
      court: {
        office: "court",
      },
    },
    salience: 8,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "sign",
        tell: ["trust:+2"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "remember",
            key: "k_p_kr_signed",
          },
        ],
      },
      {
        id: "rules",
        tell: ["trust:-1", "stavka:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_kr_rules",
          },
        ],
      },
    ],
    fallback: "sign",
  },
  {
    id: "rus_p_kr_3",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_kr_2",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1915-01",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kr",
      },
      court: {
        office: "court",
      },
    },
    salience: 8,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "signed",
        when: {
          kind: "memory",
          key: "k_p_kr_signed",
        },
      },
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "go",
        tell: ["audiences:-1", "trust:+2", "stavka:-1"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "inst",
            inst: "stavka",
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_kr_funeral",
          },
        ],
      },
      {
        id: "send",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_kr_sent",
          },
        ],
      },
      {
        id: "write",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_kr_wrote",
          },
        ],
      },
    ],
    fallback: "send",
  },
  {
    id: "rus_p_kr_4",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_kr_3",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-02",
            to: "1915-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kr",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "cold",
        when: {
          kind: "memory",
          key: "k_p_kr_rules",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "hill",
            when: {
              kind: "memory",
              key: "k_p_kr_funeral",
            },
          },
          {
            id: "cold",
            when: {
              kind: "memory",
              key: "k_p_kr_rules",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "hear",
          },
          {
            id: "sons",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [],
            next: "sons",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      hear: {
        says: [
          {
            id: "cold",
            when: {
              kind: "memory",
              key: "k_p_kr_rules",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hold",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_kr_warned",
              },
            ],
            next: null,
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sons: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_kr_5",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_kr_3",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-06",
            to: "1915-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_kr",
      },
    },
    salience: 6,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "hill",
        when: {
          kind: "memory",
          key: "k_p_kr_funeral",
        },
      },
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "read",
        tell: [],
        effects: [
          {
            kind: "world",
            of: {
              do: "passes",
              who: {
                person: "rus_kr",
              },
            },
          },
          {
            kind: "remember",
            key: "k_p_kr_gone",
          },
        ],
      },
    ],
    fallback: "read",
  },
  {
    id: "rus_p_ella_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-08",
            to: "1915-05",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_ella",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "pow",
          },
          {
            id: "kal",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "kal",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      pow: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["duma:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_ella_pow",
              },
            ],
            next: "yes",
          },
          {
            id: "quiet",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_ella_pow",
              },
            ],
            next: "quiet",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      yes: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      quiet: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      kal: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "pow",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_ella_sign",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_ella_2",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_ella_1",
        },
        {
          kind: "seen",
          scene: "rus_h_moscow_riot",
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_ella",
      },
    },
    salience: 6,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "go",
        tell: ["audiences:-1", "trust:+2", "court:-1"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_ella_stood",
          },
        ],
      },
      {
        id: "guard",
        tell: ["trust:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_ella_guard",
          },
        ],
      },
      {
        id: "write",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_ella_wrote",
          },
        ],
      },
    ],
    fallback: "write",
  },
  {
    id: "rus_p_ella_3",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_ella_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-09",
            to: "1916-11",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "not",
          of: {
            kind: "seen",
            scene: "rus_r_friend_dead",
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_ella",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "stood",
            when: {
              kind: "memory",
              key: "k_p_ella_stood",
            },
          },
          {
            id: "cold",
            when: {
              kind: "memory",
              key: "k_p_ella_guard",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "friend",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "friend",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      what: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "talk",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_ella_dmitri",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      friend: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_ella_4",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_ella_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-03",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "not",
          of: {
            kind: "any",
            of: [
              {
                kind: "seen",
                scene: "rus_r_friend_dead",
              },
              {
                kind: "flag",
                flag: "f_friend_exiled",
              },
            ],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_p_ella_3",
            },
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 1,
              },
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_ella",
      },
    },
    salience: 7,
    tags: ["private", "people", "tension_down"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "go_in",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_ella_inside",
              },
            ],
            next: "go_in",
          },
          {
            id: "say",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "say",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_ella_out",
              },
            ],
            next: null,
          },
        ],
      },
      go_in: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      say: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "try",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_ella_heard",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_ella_5",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_ella_1",
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_r_friend_dead",
            },
            {
              kind: "flag",
              flag: "f_friend_exiled",
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-03",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_ella",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "heard",
        when: {
          kind: "memory",
          key: "k_p_ella_heard",
        },
      },
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_p_fre_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-06",
            to: "1915-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_fredericks",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "glass",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "glass",
          },
          {
            id: "father",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "father",
          },
          {
            id: "sign",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      glass: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "share",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_fre_glass",
              },
            ],
            next: "share",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      father: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "let",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_fre_let",
              },
            ],
            next: "let",
          },
          {
            id: "fix",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "fix",
          },
        ],
      },
      let: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
            ],
            next: null,
          },
        ],
      },
      fix: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      share: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_fre_2",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_fre_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-03",
            to: "1916-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_fredericks",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "glass",
            when: {
              kind: "memory",
              key: "k_p_fre_glass",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1", "duma:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_fre_kept",
              },
            ],
            next: "keep",
          },
          {
            id: "retire",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [],
            next: "retire",
          },
          {
            id: "voe",
            stance: "cold",
            kind: "ask",
            tell: [],
            effects: [],
            next: "voe",
          },
        ],
      },
      keep: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      retire: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "no",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1", "duma:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_fre_kept",
              },
            ],
            next: "keep",
          },
          {
            id: "yes",
            stance: "frank",
            kind: "deal",
            tell: ["duma:+1", "court:-1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_fre_retired",
              },
            ],
            next: "yes",
          },
        ],
      },
      yes: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      voe: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "warm",
            kind: "deal",
            tell: ["court:+1", "duma:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_fre_kept",
              },
            ],
            next: "keep",
          },
          {
            id: "retire",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [],
            next: "retire",
          },
        ],
      },
    },
  },
  {
    id: "rus_p_fre_3",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "k_p_fre_kept",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-08",
            to: "1917-03",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_fredericks",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sign",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_fre_twice",
              },
            ],
            next: "sign",
          },
          {
            id: "tell",
            stance: "frank",
            kind: "push",
            tell: [],
            effects: [],
            next: "tell",
          },
          {
            id: "mos",
            stance: "cold",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_fre_mosolov",
              },
            ],
            next: "mos",
          },
        ],
      },
      sign: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tell: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_fre_afraid",
              },
            ],
            next: null,
          },
        ],
      },
      mos: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_fre_4",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_p_fre_kept",
            },
            {
              kind: "memory",
              key: "k_p_fre_retired",
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-02",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_fredericks",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "go",
        tell: ["audiences:-1", "trust:+2"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "remember",
            key: "k_p_fre_visit",
          },
        ],
      },
      {
        id: "send",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_fre_flowers",
          },
        ],
      },
      {
        id: "nothing",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_fre_nothing",
          },
        ],
      },
    ],
    fallback: "send",
  },
  {
    id: "rus_p_fre_5",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_fre_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-10",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_p_fre_3",
            },
            {
              kind: "seen",
              scene: "rus_p_fre_4",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_fredericks",
      },
    },
    salience: 6,
    tags: ["private", "people", "tension_down"],
    once: true,
    who: "p",
    variants: [
      {
        id: "ret",
        when: {
          kind: "memory",
          key: "k_p_fre_retired",
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "visit",
            when: {
              kind: "memory",
              key: "k_p_fre_visit",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "stay",
            stance: "warm",
            kind: "ask",
            tell: ["audiences:-1"],
            effects: [
              {
                kind: "audiences",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_fre_end_warm",
              },
            ],
            next: "stay",
          },
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      stay: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      who: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_fre_end_warm",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_mat_1",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-06",
            to: "1914-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["private", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "burn",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_mat_burned",
          },
        ],
      },
      {
        id: "read",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_mat_read",
          },
        ],
      },
      {
        id: "lock",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_mat_locked",
          },
        ],
      },
    ],
    fallback: "lock",
  },
  {
    id: "rus_p_mat_2",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_mat_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-03",
            to: "1916-01",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_sergei_m",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "true",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "true",
          },
          {
            id: "old",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "old",
          },
          {
            id: "order",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1", "duma:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_mat_open",
              },
            ],
            next: "resign",
          },
        ],
      },
      true: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "shield",
            stance: "warm",
            kind: "deal",
            tell: ["duma:-2", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: -2,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_mat_shield",
              },
            ],
            next: "shield",
          },
          {
            id: "let",
            stance: "frank",
            kind: "deal",
            tell: ["duma:+1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_mat_open",
              },
            ],
            next: "let",
          },
        ],
      },
      old: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "true",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "true",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      shield: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      let: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      resign: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_mat_3",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_p_mat_open",
            },
            {
              kind: "memory",
              key: "k_p_mat_shield",
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-06",
            to: "1916-12",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_mathilde",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ask",
          },
          {
            id: "letters",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "letters",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_mat_turned",
              },
            ],
            next: null,
          },
        ],
      },
      ask: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["duma:-1"],
            effects: [
              {
                kind: "inst",
                inst: "duma",
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_mat_spared",
              },
            ],
            next: "yes",
          },
          {
            id: "train",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_mat_train",
              },
            ],
            next: "train",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      yes: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      train: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      letters: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "burn",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_mat_hers_burned",
              },
            ],
            next: "burn",
          },
          {
            id: "keep",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_mat_hers_kept",
              },
            ],
            next: "keep",
          },
        ],
      },
      burn: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ask",
          },
        ],
      },
      keep: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ask",
          },
        ],
      },
    },
  },
  {
    id: "rus_p_mat_4",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_mat_2",
        },
        {
          kind: "world",
          of: {
            is: "command",
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-01",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_sergei_m",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "shield",
            when: {
              kind: "memory",
              key: "k_p_mat_shield",
            },
          },
          {
            id: "cold",
            when: {
              kind: "all",
              of: [
                {
                  kind: "memory",
                  key: "k_p_mat_open",
                },
                {
                  kind: "not",
                  of: {
                    kind: "memory",
                    key: "k_p_mat_train",
                  },
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "war",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "war",
          },
          {
            id: "her",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "her",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      war: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_mat_hope",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      her: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_san_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1915-08",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_sandro",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fly",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "fly",
          },
          {
            id: "xenia",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "xenia",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      fly: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_fly",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      xenia: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "apart",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      apart: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "write",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_xenia",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_san_2",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "k_p_san_xenia",
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {},
    salience: 4,
    tags: ["private", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
  },
  {
    id: "rus_p_san_3",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_san_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-06",
            to: "1915-12",
          },
        },
        {
          kind: "not",
          of: {
            kind: "world",
            of: {
              is: "command",
            },
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_sandro",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
          {
            id: "wife",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "wife",
          },
          {
            id: "ball",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ball",
          },
          {
            id: "go",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      ball: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "why",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "why",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      why: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_command",
              },
            ],
            next: "keep",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      wife: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_san_command",
              },
            ],
            next: null,
          },
        ],
      },
      keep: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_san_4",
    nation: ["RUS"],
    kind: "talk",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_san_1",
        },
        {
          kind: "seen",
          scene: "rus_r_friend_dead",
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_sandro",
      },
    },
    salience: 7,
    tags: ["private", "people", "tension_down"],
    once: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "right",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "right",
          },
          {
            id: "no",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_san_refused",
              },
            ],
            next: "no",
          },
          {
            id: "cover",
            stance: "warm",
            kind: "deal",
            tell: ["court:-1", "trust:+1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_covered",
              },
            ],
            next: "cover",
          },
        ],
      },
      right: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "heard",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_saw",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      no: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      cover: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_san_5",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_san_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-10",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 1,
              },
            },
            {
              kind: "seen",
              scene: "rus_r_trust",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_sandro",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "warm",
        when: {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "k_p_san_fly",
            },
            {
              kind: "memory",
              key: "k_p_san_command",
            },
            {
              kind: "memory",
              key: "k_p_san_saw",
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "all",
              of: [
                {
                  kind: "person_trust",
                  who: {
                    role: "p",
                  },
                  max: -1,
                },
                {
                  kind: "world",
                  of: {
                    is: "regime",
                    of: ["tsar", "crown"],
                  },
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "do",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "do",
          },
          {
            id: "alix",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "alix",
          },
          {
            id: "liv",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "liv",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      liv: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "same",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_livadia",
              },
            ],
            next: "liv2",
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      liv2: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "do",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "do",
          },
        ],
      },
      do: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "think",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_san_last",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      alix: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_nil_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-06",
            to: "1914-08",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_nilov",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "flask",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "flask",
          },
          {
            id: "sea",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "sea",
          },
          {
            id: "tsu",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tsu",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tsu: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yes",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "tsu2",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      tsu2: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_nil_tsushima",
              },
            ],
            next: null,
          },
        ],
      },
      flask: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sip",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_nil_sip",
              },
            ],
            next: "sip",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sip: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sea: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_nil_2",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_nil_1",
        },
        {
          kind: "any",
          of: [
            {
              kind: "chose",
              scene: "rus_c_vodka",
              pick: "whole_war",
            },
            {
              kind: "chose",
              scene: "rus_c_vodka",
              pick: "whole_war_tax",
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_nilov",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "share",
        tell: ["court:-1", "trust:+2"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 2,
          },
          {
            kind: "remember",
            key: "k_p_nil_shared",
          },
        ],
      },
      {
        id: "blind",
        tell: ["trust:+1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_nil_blind",
          },
        ],
      },
      {
        id: "dry",
        tell: ["court:+1", "trust:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_nil_dry",
          },
        ],
      },
    ],
    fallback: "blind",
  },
  {
    id: "rus_p_nil_3",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_nil_1",
        },
        {
          kind: "world",
          of: {
            is: "command",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_nilov",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "dry",
            when: {
              kind: "memory",
              key: "k_p_nil_dry",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "what",
          },
          {
            id: "bed",
            stance: "cold",
            kind: "push",
            tell: [],
            effects: [],
            next: "bed",
          },
          {
            id: "play",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      what: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "frank",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_nil_warned",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      bed: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_nil_4",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_nil_1",
        },
        {
          kind: "seen",
          scene: "rus_h_heir_stavka",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-10",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_nilov",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sea",
            stance: "warm",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_nil_boy",
              },
            ],
            next: "sea",
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "ask",
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sea: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      ask: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_nil_5",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_nil_3",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "any",
          of: [
            {
              kind: "world",
              of: {
                is: "unrest",
                min: 1,
              },
            },
            {
              kind: "memory",
              key: "k_p_nil_warned",
            },
          ],
        },
      ],
    },
    cast: {
      p: {
        person: "rus_nilov",
      },
    },
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "keep",
        tell: ["court:-1", "trust:+1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: -1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_nil_stays",
          },
        ],
      },
      {
        id: "ashore",
        tell: ["court:+1", "trust:-1"],
        effects: [
          {
            kind: "inst",
            inst: "court",
            delta: 1,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_nil_ashore",
          },
        ],
      },
    ],
    fallback: "keep",
  },
  {
    id: "rus_p_dmi_1",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-06",
            to: "1914-09",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_dmitri",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "go",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_dmi_went",
              },
            ],
            next: "go",
          },
          {
            id: "keep",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_dmi_kept",
              },
            ],
            next: "keep",
          },
          {
            id: "father",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "father",
          },
        ],
      },
      father: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_dmi_father",
              },
            ],
            next: "sorry",
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      sorry: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "go",
            stance: "warm",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_dmi_went",
              },
            ],
            next: "go",
          },
          {
            id: "keep",
            stance: "warm",
            kind: "push",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_dmi_kept",
              },
            ],
            next: "keep",
          },
        ],
      },
      go: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      keep: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
          {
            id: "free",
            stance: "frank",
            kind: "deal",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_dmi_went",
              },
            ],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_dmi_2",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_dmi_1",
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1914-09",
            to: "1915-08",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_dmitri",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "kept",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_dmi_kept",
            },
            {
              kind: "not",
              of: {
                kind: "memory",
                key: "k_p_dmi_went",
              },
            },
          ],
        },
      },
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "kept",
            when: {
              kind: "all",
              of: [
                {
                  kind: "memory",
                  key: "k_p_dmi_kept",
                },
                {
                  kind: "not",
                  of: {
                    kind: "memory",
                    key: "k_p_dmi_went",
                  },
                },
              ],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "olga",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "olga",
          },
          {
            id: "war",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "war",
          },
          {
            id: "send",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_dmi_went",
              },
            ],
            next: null,
            when: {
              kind: "all",
              of: [
                {
                  kind: "memory",
                  key: "k_p_dmi_kept",
                },
                {
                  kind: "not",
                  of: {
                    kind: "memory",
                    key: "k_p_dmi_went",
                  },
                },
              ],
            },
          },
          {
            id: "go",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      war: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "say",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "say",
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      say: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "k_p_dmi_heard",
              },
            ],
            next: null,
          },
        ],
      },
      olga: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_dmi_3",
    nation: ["RUS"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_dmi_1",
        },
        {
          kind: "world",
          of: {
            is: "command",
          },
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1915-09",
            to: "1916-11",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
        {
          kind: "not",
          of: {
            kind: "seen",
            scene: "rus_r_friend_dead",
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_dmitri",
      },
    },
    salience: 2,
    tags: ["private"],
    once: true,
    summon: true,
    who: "p",
    variants: [
      {
        id: "base",
      },
    ],
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "ella",
            when: {
              kind: "memory",
              key: "k_p_ella_dmitri",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "who",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "who",
          },
          {
            id: "stop",
            stance: "cold",
            kind: "push",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_dmi_shut",
              },
            ],
            next: "stop",
          },
          {
            id: "away",
            stance: "cold",
            kind: "deal",
            tell: ["court:+1", "trust:-1"],
            effects: [
              {
                kind: "inst",
                inst: "court",
                delta: 1,
              },
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: -1,
              },
              {
                kind: "remember",
                key: "k_p_dmi_away",
              },
            ],
            next: "away",
          },
        ],
      },
      who: {
        says: [
          {
            id: "cand",
            when: {
              kind: "candid",
              who: {
                role: "p",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "warm",
            kind: "deal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "p",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "k_p_dmi_warned",
              },
            ],
            next: null,
          },
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      stop: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "cold",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
      away: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "end",
            stance: "warm",
            kind: "leave",
            tell: [],
            effects: [],
            next: null,
          },
        ],
      },
    },
  },
  {
    id: "rus_p_dmi_4",
    nation: ["RUS"],
    kind: "audience",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_dmi_1",
        },
        {
          kind: "seen",
          scene: "rus_r_friend_dead",
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {
      p: {
        person: "rus_dmitri",
      },
    },
    salience: 6,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    options: [
      {
        id: "walk",
        tell: ["audiences:-1", "court:-2", "trust:+1"],
        effects: [
          {
            kind: "audiences",
            delta: -1,
          },
          {
            kind: "inst",
            inst: "court",
            delta: -2,
          },
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: 1,
          },
          {
            kind: "remember",
            key: "k_p_dmi_saw",
          },
        ],
      },
      {
        id: "line",
        tell: [],
        effects: [
          {
            kind: "remember",
            key: "k_p_dmi_note",
          },
        ],
      },
      {
        id: "silent",
        tell: ["trust:-1"],
        effects: [
          {
            kind: "person_trust",
            who: {
              role: "p",
            },
            delta: -1,
          },
          {
            kind: "remember",
            key: "k_p_dmi_refused",
          },
        ],
      },
    ],
    fallback: "line",
  },
  {
    id: "rus_p_dmi_5",
    nation: ["RUS"],
    kind: "wire",
    stage: ["crisis", "y1914", "war"],
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "rus_p_dmi_1",
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "rus_p_dmi_4",
            },
            {
              kind: "any",
              of: [
                {
                  kind: "seen",
                  scene: "rus_r_friend_dead",
                },
                {
                  kind: "flag",
                  flag: "f_friend_exiled",
                },
              ],
            },
          ],
        },
        {
          kind: "world",
          of: {
            is: "date",
            from: "1916-06",
          },
        },
        {
          kind: "world",
          of: {
            is: "regime",
            of: ["tsar", "crown"],
          },
        },
      ],
    },
    cast: {},
    salience: 5,
    tags: ["private", "people", "tension_down"],
    once: true,
    variants: [
      {
        id: "saw",
        when: {
          kind: "memory",
          key: "k_p_dmi_saw",
        },
      },
      {
        id: "olga",
        when: {
          kind: "memory",
          key: "k_p_olg_walk",
        },
      },
      {
        id: "exiled",
        when: {
          kind: "flag",
          flag: "f_friend_exiled",
        },
      },
      {
        id: "base",
      },
    ],
  },
];

/** Scene -> what these lines lay over it: its bodies, a node's lines. */
const RUS_PRIVATE_BACK: Readonly<
  Record<
    string,
    {
      variants: readonly GwVariant[];
      says: Readonly<Record<string, readonly GwVariant[]>>;
    }
  >
> = {
  rus_h_diary: {
    variants: [
      {
        id: "p_kr",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_kr_funeral",
              within: 1,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
      {
        id: "p_bot",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_bot_went",
              within: 1,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
      {
        id: "p_olga",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_olg_walk",
              within: 1,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
      {
        id: "p_fred",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_fre_afraid",
              within: 1,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
      {
        id: "p_nil",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_nil_boy",
              within: 1,
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_h_heir_bleed: {
    variants: [
      {
        id: "p_bot",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_bot_friend",
            },
            {
              kind: "not",
              of: {
                kind: "any",
                of: [
                  {
                    kind: "seen",
                    scene: "rus_r_friend_dead",
                  },
                  {
                    kind: "flag",
                    flag: "f_friend_exiled",
                  },
                ],
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_v_michael_ready: {
    variants: [],
    says: {
      open: [
        {
          id: "p_read",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_sib_read",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
        {
          id: "p_shown",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_sib_shown",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
        {
          id: "p_title",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_sib_title",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
      ],
    },
  },
  rus_r_abdication: {
    variants: [
      {
        id: "p_fred",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_fre_end_warm",
            },
            {
              kind: "holder",
              office: "court",
              person: "rus_fredericks",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar"],
              },
            },
          ],
        },
      },
      {
        id: "p_misha",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_sib_read",
            },
            {
              kind: "memory",
              key: "k_p_sib_letters",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_r_friend_dead: {
    variants: [
      {
        id: "p_warned",
        when: {
          kind: "all",
          of: [
            {
              kind: "any",
              of: [
                {
                  kind: "memory",
                  key: "k_p_dmi_warned",
                },
                {
                  kind: "memory",
                  key: "k_p_ella_heard",
                },
              ],
            },
            {
              kind: "not",
              of: {
                kind: "seen",
                scene: "rus_r_family_letter",
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_h_moscow_riot: {
    variants: [
      {
        id: "p_ella",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_ella_pow",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_t_rodz_shells: {
    variants: [],
    says: {
      who: [
        {
          id: "p_shield",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_mat_shield",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
        {
          id: "p_open",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_mat_open",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
      ],
    },
  },
  rus_t_alex_nurse: {
    variants: [],
    says: {
      girls: [
        {
          id: "p_count",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_olg_count",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
        {
          id: "p_duty",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_olg_duty",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
      ],
    },
  },
  rus_w_command: {
    variants: [
      {
        id: "p_sandro",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_san_command",
            },
            {
              kind: "not",
              of: {
                kind: "world",
                of: {
                  is: "command",
                },
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_v_fred_list: {
    variants: [],
    says: {
      open: [
        {
          id: "p_glass",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_fre_glass",
              },
              {
                kind: "memory",
                key: "k_p_fre_kept",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
        {
          id: "p_mos",
          when: {
            kind: "all",
            of: [
              {
                kind: "memory",
                key: "k_p_fre_mosolov",
              },
              {
                kind: "world",
                of: {
                  is: "regime",
                  of: ["tsar", "crown"],
                },
              },
            ],
          },
        },
      ],
    },
  },
  rus_w_letters: {
    variants: [
      {
        id: "p_misha",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_sib_letters",
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
  rus_r_trust: {
    variants: [
      {
        id: "p_sandro",
        when: {
          kind: "all",
          of: [
            {
              kind: "memory",
              key: "k_p_san_last",
            },
            {
              kind: "not",
              of: {
                kind: "chose",
                scene: "rus_r_trust",
              },
            },
            {
              kind: "world",
              of: {
                is: "regime",
                of: ["tsar", "crown"],
              },
            },
          ],
        },
      },
    ],
    says: {},
  },
};

/**
 * What the private lines leave in the work: the warm or the cold line, added in
 * front of the scene's own. The text is under `over` in RUS.private.json.
 */
export function withRusPrivate(s: GwScene): GwScene {
  const b = RUS_PRIVATE_BACK[s.id];
  if (b === undefined) return s;
  const nodes = Object.fromEntries(
    Object.entries(s.nodes ?? {}).map(([id, n]) => [
      id,
      { ...n, says: [...(b.says[id] ?? []), ...n.says] },
    ]),
  );
  return {
    ...s,
    variants: [...b.variants, ...s.variants],
    ...(s.nodes === undefined ? {} : { nodes }),
  };
}
