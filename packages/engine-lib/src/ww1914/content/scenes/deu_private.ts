import type { GwPersonDef } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwScene, GwVariant } from "@openfront/engine-api/ww1914/SceneDsl";

/**
 * Germany: people's private stories (ww143). Ten lines in the ruler's circle
 * that run across the game, apart from work: a talk tagged `private` is called
 * with the chapter's private meeting, or comes as a visit. Each ends by state,
 * and what happens here is remembered in work scenes through `DEU_ECHOES`.
 * Data only; the text is in resources/ww1914/ko/DEU.private.json, the lines
 * laid into other shares' scenes under its `over`.
 *
 * Facts checked, and what is memory or invented, are in `source` below and in
 * /home/eser/dev/ww143-report-DEU.md.
 */

/** Seen only once they have come up: see `unlisted` on GwPersonDef. */
export const DEU_PRIVATE_PEOPLE: readonly GwPersonDef[] = [
  {
    id: "deu_eulenburg",
    tag: "DEU",
    office: null,
    fit: [],
    camps: [],
    rivals: [],
    allies: [],
    unlisted: true,
    temperaments: ["weary", "cunning"],
    fame: 2,
    source:
      "b. 12 Feb 1847; met Prince Wilhelm 19 Apr 1886 at Prökelwitz; 'Phili'; Rosenlieder; Vienna to 1902; Harden from Nov 1906, trial 29 Jun 1908, suspended Aug, for good 1909; Liebenberg, avoided by old friends, worked on his correspondence; d. 17 Sep 1921; son Sigwart 10 Jan 1884-2 Jun 1915, lung wound in Galicia, hospital at Jasło, War Sonata op. 19, opera accepted by Stuttgart, premiered 1915, buried at Liebenberg (de/en.wikipedia). No contact with Wilhelm after 1908 is recorded: the visit and the letters are invented",
  },
  {
    id: "deu_margaret",
    tag: "DEU",
    office: null,
    fit: [],
    camps: [],
    rivals: [],
    allies: [],
    unlisted: true,
    temperaments: ["stubborn", "weary"],
    fame: 1,
    source:
      "Margaret of Prussia, b. 22 Apr 1872; husband wounded Belgium Sep 1914, blood poisoning; Max d. 13 Oct 1914 in a British field hospital, locket by a British doctor killed two days later, his widow, Queen Mary; body hidden by villagers till after the war; Friedrich Wilhelm d. 12 Sep 1916 Kara Orman, found out by his brother Wolfgang, buried at Friedrichshof; the Emperor ordered Philipp and Wolfgang kept from harm; Finnish crown 1918 (historyofroyalwomen.com, en.wikipedia). The name Mossy, the husband's Fischy, the hair in the locket and what she says are memory or invented",
  },
  {
    id: "deu_eliza",
    tag: "DEU",
    office: null,
    fit: [],
    camps: [],
    rivals: [],
    allies: [],
    unlisted: true,
    temperaments: ["stubborn", "anxious"],
    fame: 1,
    source:
      "Eliza, 1859-1932, daughter of Wladimir Count Moltke-Hvitfeld, m. 1878 (deutsche-biographie); Steiner's esoteric pupil; he came to the house from 1904 by his own 1921 account; after-death messages forwarded to her 1916-1922 (Light for the New Millennium listings). The medium's paper is invented, and the woman in the house is memory (Lisbeth Seidler, not confirmed, so not named)",
  },
  {
    id: "deu_cecilie",
    tag: "DEU",
    office: null,
    fit: [],
    camps: [],
    rivals: [],
    allies: [],
    unlisted: true,
    temperaments: ["cold", "stubborn"],
    fame: 1,
    source:
      "Cecilie of Mecklenburg-Schwerin, b. 20 Sep 1886, m. 1905, six children; Alexandrine b. 7 Apr 1915 Berlin, Down syndrome, never hidden, in family photographs (en.wikipedia, historyofroyalwomen.com). The photograph's quarrel is invented: history is that she was not left out",
  },
];

/** How each talks, as GW_VOICE_NOTES. */
export const DEU_PRIVATE_VOICE_NOTES: Readonly<Record<string, string>> = {
  deu_eulenburg:
    "노래를 짓던 궁정인의 말. 부드럽고 정확하며 칼을 꽃으로 싸서 건넨다. 폐하 앞에서 폐하를 설명할 수 있는 마지막 사람. 자기 몰락을 남 얘기처럼 말한다. 음악 말이 섞인다.",
  deu_margaret:
    "오빠에게만 쓰는 말. '빌리', 해요체, 짧고 실용적이다. 기차 시간, 애들, 어머니. 울지 않고 묻는다. 정치를 모르고 정곡만 안다.",
  deu_eliza:
    "보이지 않는 일을 찬장 정리하듯 말한다. 설명을 거절한다. 남편을 '그이'라 부른다. 궁정이 웃는 줄 알고, 그것을 먼저 말한다.",
  deu_cecilie:
    "시아버지에게 쓰는 말. '아버님', 해요체. 이 집 규칙을 모른다고 말하며 규칙을 묻는다. 그 질문이 곧 답이다. 웃지 않고 농담한다.",
};

export const DEU_PRIVATE_SCENES: readonly GwScene[] = [
  {
    id: "deu_pv_bet_piano",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "any",
      of: [
        { kind: "chapter", max: 5 },
        { kind: "world", of: { is: "war_months", max: 1 } },
        { kind: "world", of: { is: "peace_months", max: 1 } },
      ],
    },
    cast: {
      who: {
        person: "deu_bethmann",
      },
    },
    salience: 6,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "wartime",
        when: {
          kind: "world",
          of: {
            is: "war",
          },
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "went",
            stance: "frank",
            kind: "ask",
            next: "sorry",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
          {
            id: "home",
            stance: "warm",
            kind: "ask",
            next: "home",
            tell: [],
            effects: [],
          },
          {
            id: "work",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_walk_short",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "grave",
            stance: "warm",
            kind: "deal",
            next: "home",
            tell: ["promise"],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_grave_asked",
                who: {
                  role: "who",
                },
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "pv_beth_grave",
                chapters: 4,
              },
            ],
          },
          {
            id: "on",
            stance: "frank",
            kind: "ask",
            next: "home",
            tell: [],
            effects: [],
          },
        ],
      },
      home: {
        says: [
          {
            id: "war",
            when: {
              kind: "world",
              of: {
                is: "war",
              },
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "leave_it",
            stance: "warm",
            kind: "ask",
            next: "end",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_beth_piano",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "father",
            stance: "frank",
            kind: "ask",
            next: "father",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_father",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "enough",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
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
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      end: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bet_grave",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "memory",
      key: "pv_beth_grave_asked",
    },
    cast: {
      who: {
        person: "deu_bethmann",
      },
    },
    salience: 6,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "son",
            stance: "warm",
            kind: "ask",
            next: "son",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_grave_went",
                who: {
                  role: "who",
                },
              },
              {
                kind: "keep_promise",
                who: {
                  role: "who",
                },
                key: "pv_beth_grave",
              },
            ],
          },
          {
            id: "stand",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_beth_grave_went",
                who: {
                  role: "who",
                },
              },
              {
                kind: "keep_promise",
                who: {
                  role: "who",
                },
                key: "pv_beth_grave",
              },
            ],
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
            id: "hold",
            stance: "warm",
            kind: "deal",
            next: "refuse",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_son_offer",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "no",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      refuse: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "insist",
            stance: "threat",
            kind: "push",
            next: null,
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_son_held",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_beth_son_held",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "withdraw",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_son_free",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bet_petition",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "pv_beth_son_held",
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 1, max: 4 } },
      ],
    },
    cast: {
      who: {
        person: "deu_bethmann",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "warm",
            when: {
              kind: "person_trust",
              who: {
                role: "who",
              },
              min: 2,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "drawer",
            stance: "cold",
            kind: "deal",
            next: "kept",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_son_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "release",
            stance: "frank",
            kind: "ask",
            next: "gone",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_beth_son_free",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "you",
            stance: "warm",
            kind: "ask",
            next: "wish",
            tell: [],
            effects: [],
          },
        ],
      },
      wish: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "drawer",
            stance: "cold",
            kind: "deal",
            next: "kept",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_son_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "release",
            stance: "frank",
            kind: "ask",
            next: "gone",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_son_free",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      kept: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      gone: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bet_december",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 3, max: 8 } },
        {
          kind: "not",
          of: {
            kind: "memory",
            key: "pv_beth_son_kept",
          },
        },
        {
          kind: "at_war",
          tag: "RUS",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 9,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "free",
            when: {
              kind: "memory",
              key: "pv_beth_son_free",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "self",
            stance: "frank",
            kind: "ask",
            next: "self",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_told_himself",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "form",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_wreath_again",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_beth_wreath_again",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      self: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "funeral",
            stance: "warm",
            kind: "deal",
            next: null,
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_funeral_went",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
          },
          {
            id: "no_funeral",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_funeral_none",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bet_isa",
    nation: ["DEU"],
    kind: "talk",
    when: { kind: "world", of: { is: "war_months", min: 7, max: 17 } },
    cast: {
      who: {
        person: "deu_bethmann",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "kept",
        when: {
          kind: "memory",
          key: "pv_beth_son_kept",
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "kept",
            when: {
              kind: "memory",
              key: "pv_beth_son_kept",
            },
          },
          {
            id: "went",
            when: {
              kind: "memory",
              key: "pv_beth_funeral_went",
            },
          },
          {
            id: "cold",
            when: {
              kind: "person_trust",
              who: {
                role: "who",
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
            id: "come",
            stance: "warm",
            kind: "deal",
            next: "come",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_beth_wedding",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "veil",
            stance: "warm",
            kind: "ask",
            next: "veil",
            tell: [],
            effects: [],
          },
          {
            id: "gift",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      come: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      veil: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bet_lid",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_bet_piano",
        },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "deu_pv_bet_december",
            },
            {
              kind: "memory",
              key: "pv_beth_son_kept",
            },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 29 } },
      ],
    },
    cast: {
      who: {
        person: "deu_bethmann",
      },
    },
    salience: 5,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "fallen",
        when: {
          kind: "not",
          of: {
            kind: "holder",
            office: "chancellor",
            person: "deu_bethmann",
          },
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "any",
              of: [
                {
                  kind: "memory",
                  key: "pv_beth_funeral_none",
                },
                {
                  kind: "memory",
                  key: "pv_beth_wreath_again",
                },
              ],
            },
          },
          {
            id: "kept",
            when: {
              kind: "memory",
              key: "pv_beth_son_kept",
            },
          },
          {
            id: "piano",
            when: {
              kind: "memory",
              key: "pv_beth_piano",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "play",
            stance: "warm",
            kind: "ask",
            next: "play",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_beth_end_played",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_beth_end_played",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            next: "owed",
            tell: [],
            effects: [],
          },
          {
            id: "tea",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_beth_end_cold",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      play: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      owed: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "known",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_beth_end_said",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mol_julius",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        { kind: "holder", office: "chief_of_staff", person: "deu_moltke" },
        {
          kind: "any",
          of: [
            { kind: "chapter", max: 5 },
            { kind: "world", of: { is: "war_months", own: true, max: 5 } },
            { kind: "not", of: { kind: "world", of: { is: "war" } } },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_moltke",
      },
    },
    salience: 5,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "war",
        when: {
          kind: "world",
          of: {
            is: "war",
          },
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "book",
            stance: "warm",
            kind: "ask",
            next: "book",
            tell: [],
            effects: [],
          },
          {
            id: "ghost",
            stance: "threat",
            kind: "push",
            next: "ghost",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_mocked",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
          },
          {
            id: "walk",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      ghost: {
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
            next: "book",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
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
      book: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fear",
            stance: "frank",
            kind: "ask",
            next: "fear",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mol_fear_told",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "nothing",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_slept",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      fear: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mol_eliza",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "deu_moltke",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 1, max: 11 } },
      ],
    },
    cast: {
      who: {
        person: "deu_eliza",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "mock",
            when: {
              kind: "memory",
              key: "pv_mol_mocked",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "warm",
            kind: "deal",
            next: "note",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mol_note",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "doctor",
            stance: "frank",
            kind: "ask",
            next: "doctor",
            tell: [],
            effects: [],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_note_refused",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      doctor: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "note",
            stance: "warm",
            kind: "deal",
            next: "note",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mol_note",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_note_refused",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      note: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mol_paper",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mol_eliza",
        },
        { kind: "world", of: { is: "war_months", min: 6, max: 22 } },
      ],
    },
    cast: {
      who: {
        person: "deu_eliza",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "note",
            when: {
              kind: "memory",
              key: "pv_mol_note",
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
            kind: "ask",
            next: "read",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_read",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            next: "what",
            tell: [],
            effects: [],
          },
          {
            id: "away",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_unread",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mol_unread",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "read",
            stance: "warm",
            kind: "ask",
            next: "read",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_read",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "away",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_unread",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      read: {
        says: [
          {
            id: "fear",
            when: {
              kind: "memory",
              key: "pv_mol_fear_told",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "who_told",
            stance: "threat",
            kind: "push",
            next: "told",
            tell: [],
            effects: [],
            when: {
              kind: "memory",
              key: "pv_mol_fear_told",
            },
          },
          {
            id: "keep",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mol_paper_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "back",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      told: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_shaken",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mol_shaken",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mol_goltz",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "chief_of_staff",
            person: "deu_moltke",
          },
        },
        { kind: "world", of: { is: "war_months", min: 18, max: 30 } },
        { kind: "world", of: { is: "entered", tag: "OTT" } },
        {
          kind: "any",
          of: [
            {
              kind: "seen",
              scene: "deu_pv_mol_julius",
            },
            {
              kind: "seen",
              scene: "deu_pv_mol_eliza",
            },
          ],
        },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 9,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
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
            id: "hand",
            stance: "warm",
            kind: "deal",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_last_name",
                who: {
                  role: "who",
                },
              },
              {
                kind: "world",
                of: {
                  do: "passes",
                  who: {
                    person: "deu_moltke",
                  },
                },
              },
              {
                kind: "reason",
                key: "pv_mol_last_name",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "form",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_last_form",
                who: {
                  role: "who",
                },
              },
              {
                kind: "world",
                of: {
                  do: "passes",
                  who: {
                    person: "deu_moltke",
                  },
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mol_after",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "pv_mol_last_name",
            },
            {
              kind: "memory",
              key: "pv_mol_last_form",
            },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 25 } },
      ],
    },
    cast: {
      who: {
        person: "deu_eliza",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "name",
        when: {
          kind: "memory",
          key: "pv_mol_last_name",
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "says",
            stance: "frank",
            kind: "ask",
            next: "says",
            tell: [],
            effects: [],
          },
          {
            id: "paper",
            stance: "frank",
            kind: "ask",
            next: "paper",
            tell: [],
            effects: [],
          },
          {
            id: "rest",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      says: {
        says: [
          {
            id: "name",
            when: {
              kind: "memory",
              key: "pv_mol_last_name",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_end_heard",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      paper: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "yours",
            stance: "warm",
            kind: "deal",
            next: null,
            tell: ["trust:+1", "army:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mol_end_paper_safe",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_mol_end_paper_safe",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "army",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mol_end_paper_taken",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mol_end_paper_taken",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_tir_thanks",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 1, max: 7 } },
        {
          kind: "at_war",
          tag: "GBR",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 5,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cunning",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["cunning"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "fine",
            stance: "warm",
            kind: "ask",
            next: "boy",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_tir_thanks_ok",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "laugh",
            stance: "frank",
            kind: "ask",
            next: "boy",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_thanks_ok",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "enemy",
            stance: "cold",
            kind: "push",
            next: "cold",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_thanks_cold",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
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
            id: "swim",
            stance: "warm",
            kind: "ask",
            next: "swim",
            tell: [],
            effects: [],
          },
          {
            id: "done",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      swim: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      cold: {
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
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_tir_exchange",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_tir_thanks",
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 7, max: 35 } },
      ],
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "any",
              of: [
                {
                  kind: "person_trust",
                  who: {
                    role: "who",
                  },
                  max: -1,
                },
                {
                  kind: "memory",
                  key: "pv_tir_thanks_cold",
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
            id: "write",
            stance: "warm",
            kind: "deal",
            next: "write",
            tell: ["army:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_son_home",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_tir_son_home",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            next: "ask",
            tell: [],
            effects: [],
          },
          {
            id: "drop",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_son_left",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      write: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
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
            id: "left",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_tir_son_left",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_tir_son_left",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "write",
            stance: "warm",
            kind: "deal",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_son_home",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_tir_son_home",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_tir_blasien",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "holder",
            office: "navy",
            person: "deu_tirpitz",
          },
        },
        { kind: "world", of: { is: "war_months", min: 20 } },
      ],
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "home",
            when: {
              kind: "memory",
              key: "pv_tir_son_home",
            },
          },
          {
            id: "left",
            when: {
              kind: "memory",
              key: "pv_tir_son_left",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            next: "fear",
            tell: [],
            effects: [],
          },
          {
            id: "sorry",
            stance: "warm",
            kind: "ask",
            next: "suit",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
          {
            id: "bye",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      fear: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_end_said",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_tir_end_said",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      suit: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_tir_last",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "pv_tir_son_home",
            },
            {
              kind: "memory",
              key: "pv_tir_son_left",
            },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 41 } },
      ],
    },
    cast: {
      who: {
        person: "deu_tirpitz",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "memory",
              key: "pv_tir_thanks_cold",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "son",
            stance: "warm",
            kind: "ask",
            next: "son",
            tell: [],
            effects: [],
          },
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      son: {
        says: [
          {
            id: "home",
            when: {
              kind: "memory",
              key: "pv_tir_son_home",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_tir_end_father",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_eul_letter",
    nation: ["DEU"],
    kind: "talk",
    when: { kind: "chapter", max: 5 },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 8,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
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
            id: "open",
            stance: "frank",
            kind: "ask",
            next: "read",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_read",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "drawer",
            stance: "cold",
            kind: "ask",
            next: "drawer",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_drawer",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "back",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_sent_back",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_eul_sent_back",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "who",
            stance: "frank",
            kind: "ask",
            next: "how",
            tell: [],
            effects: [],
          },
          {
            id: "done",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_burned",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      how: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_eul_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      drawer: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "there",
            stance: "cold",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_eul_sonata",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "not",
          of: {
            kind: "memory",
            key: "pv_eul_sent_back",
          },
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 3, max: 10 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "play",
            stance: "frank",
            kind: "deal",
            next: "play",
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_played",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
          },
          {
            id: "alone",
            stance: "warm",
            kind: "ask",
            next: "alone",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_score_kept",
                who: {
                  role: "who",
                },
              },
            ],
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
      play: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      alone: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_eul_jaslo",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 9, max: 20 } },
        { kind: "at_war", tag: "RUS" },
        {
          kind: "not",
          of: {
            kind: "memory",
            key: "pv_eul_sent_back",
          },
        },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 8,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "played",
            when: {
              kind: "memory",
              key: "pv_eul_played",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hand",
            stance: "frank",
            kind: "deal",
            next: "hand",
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_wrote",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
          },
          {
            id: "printed",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_printed",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_eul_printed",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      hand: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "phili",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_eul_phili",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "prince",
            stance: "cold",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_eul_garden",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "pv_eul_wrote",
        },
        { kind: "world", of: { is: "war_months", min: 13, max: 47 } },
      ],
    },
    cast: {
      who: {
        person: "deu_eulenburg",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "phili",
            when: {
              kind: "memory",
              key: "pv_eul_phili",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            next: "sorry",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_eul_said_it",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "son",
            stance: "warm",
            kind: "ask",
            next: "son",
            tell: [],
            effects: [],
          },
          {
            id: "war",
            stance: "cold",
            kind: "ask",
            next: "truth",
            tell: [],
            effects: [],
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
            id: "son",
            stance: "warm",
            kind: "ask",
            next: "son",
            tell: [],
            effects: [],
          },
          {
            id: "war",
            stance: "frank",
            kind: "ask",
            next: "truth",
            tell: [],
            effects: [],
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
            id: "keep",
            stance: "frank",
            kind: "ask",
            next: "truth",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_past",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      truth: {
        says: [
          {
            id: "played",
            when: {
              kind: "memory",
              key: "pv_eul_played",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "hear",
            stance: "frank",
            kind: "ask",
            next: "last",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_eul_truth",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_eul_truth",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "rage",
            stance: "threat",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_quarrel",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_eul_box",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "pv_eul_read",
            },
            {
              kind: "memory",
              key: "pv_eul_drawer",
            },
            {
              kind: "memory",
              key: "pv_eul_printed",
            },
            {
              kind: "memory",
              key: "pv_eul_wrote",
            },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 31 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "met",
        when: {
          kind: "memory",
          key: "pv_eul_truth",
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "met",
            when: {
              kind: "memory",
              key: "pv_eul_truth",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "burn",
            stance: "cold",
            kind: "ask",
            next: "burn",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_end_burned",
                who: {
                  role: "who",
                },
              },
            ],
            when: {
              kind: "memory",
              key: "pv_eul_truth",
            },
          },
          {
            id: "keep_box",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_end_kept",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_eul_end_kept",
                who: {
                  role: "who",
                },
              },
            ],
            when: {
              kind: "memory",
              key: "pv_eul_truth",
            },
          },
          {
            id: "demand",
            stance: "threat",
            kind: "push",
            next: "demand",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_end_demanded",
                who: {
                  role: "who",
                },
              },
            ],
            when: {
              kind: "not",
              of: {
                kind: "memory",
                key: "pv_eul_truth",
              },
            },
          },
          {
            id: "leave",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_eul_end_left",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_eul_end_left",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "stay",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      demand: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "stop",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "reason",
                key: "pv_eul_end_demanded",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mar_max",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "at_war",
          tag: "GBR",
        },
        { kind: "world", of: { is: "war_months", own: true, max: 4 } },
      ],
    },
    cast: {
      who: {
        person: "deu_margaret",
      },
    },
    salience: 8,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
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
            id: "find",
            stance: "warm",
            kind: "deal",
            next: "find",
            tell: ["trust:+1", "promise"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_search",
                who: {
                  role: "who",
                },
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "pv_mar_search",
                chapters: 4,
              },
            ],
          },
          {
            id: "sit",
            stance: "warm",
            kind: "ask",
            next: "sit",
            tell: [],
            effects: [],
          },
          {
            id: "war",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_cold_first",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mar_cold_first",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      sit: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "find",
            stance: "warm",
            kind: "deal",
            next: "find",
            tell: ["trust:+1", "promise"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_search",
                who: {
                  role: "who",
                },
              },
              {
                kind: "promise",
                who: {
                  role: "who",
                },
                key: "pv_mar_search",
                chapters: 4,
              },
            ],
          },
          {
            id: "war",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_cold_first",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      find: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mar_locket",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mar_max",
        },
        { kind: "world", of: { is: "war_months", min: 5, max: 15 } },
      ],
    },
    cast: {
      who: {
        person: "deu_margaret",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "regiment",
            when: {
              kind: "memory",
              key: "pv_mar_cold_first",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "grave",
            stance: "warm",
            kind: "ask",
            next: "grave",
            tell: [],
            effects: [],
          },
          {
            id: "may",
            stance: "frank",
            kind: "ask",
            next: "may",
            tell: [],
            effects: [],
          },
          {
            id: "hard",
            stance: "cold",
            kind: "push",
            next: "hard",
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_cold_may",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
          },
        ],
      },
      grave: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "may",
            stance: "frank",
            kind: "ask",
            next: "may",
            tell: [],
            effects: [],
          },
          {
            id: "nothing",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      may: {
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
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_letter_ok",
                who: {
                  role: "who",
                },
              },
              {
                kind: "keep_promise",
                who: {
                  role: "who",
                },
                key: "pv_mar_search",
              },
              {
                kind: "reason",
                key: "pv_mar_letter_ok",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "mine",
            stance: "frank",
            kind: "deal",
            next: null,
            tell: ["army:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_letter_both",
                who: {
                  role: "who",
                },
              },
              {
                kind: "keep_promise",
                who: {
                  role: "who",
                },
                key: "pv_mar_search",
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
            ],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_letter_no",
                who: {
                  role: "who",
                },
              },
              {
                kind: "keep_promise",
                who: {
                  role: "who",
                },
                key: "pv_mar_search",
              },
            ],
          },
        ],
      },
      hard: {
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
            next: null,
            tell: [],
            effects: [
              {
                kind: "keep_promise",
                who: {
                  role: "who",
                },
                key: "pv_mar_search",
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mar_sons",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mar_locket",
        },
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 10, max: 25 },
        },
      ],
    },
    cast: {
      who: {
        person: "deu_margaret",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "two",
            stance: "frank",
            kind: "deal",
            next: "two",
            tell: ["army:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_two",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
            ],
          },
          {
            id: "three",
            stance: "warm",
            kind: "deal",
            next: "three",
            tell: ["trust:+1", "army:-2"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_three",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -2,
              },
              {
                kind: "reason",
                key: "pv_mar_three",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "none",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_none",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mar_none",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      two: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      three: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mar_kara",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "not",
          of: {
            kind: "memory",
            key: "pv_mar_three",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 20 } },
        { kind: "world", of: { is: "entered", tag: "ROU" } },
        {
          kind: "seen",
          scene: "deu_pv_mar_max",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_margaret",
      },
    },
    salience: 8,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "none",
            when: {
              kind: "memory",
              key: "pv_mar_none",
            },
          },
          {
            id: "two",
            when: {
              kind: "memory",
              key: "pv_mar_two",
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
            next: "stay",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_stayed",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "sorry",
            stance: "frank",
            kind: "ask",
            next: "fault",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_fault",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "honour",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: ["trust:-2"],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_honour",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -2,
              },
              {
                kind: "reason",
                key: "pv_mar_honour",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      fault: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mar_finland",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mar_max",
        },
        { kind: "world", of: { is: "war_months", min: 47 } },
      ],
    },
    cast: {
      who: {
        person: "deu_margaret",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "any",
              of: [
                {
                  kind: "memory",
                  key: "pv_mar_honour",
                },
                {
                  kind: "memory",
                  key: "pv_mar_cold_may",
                },
              ],
            },
          },
          {
            id: "none_left",
            when: {
              kind: "memory",
              key: "pv_mar_three",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "no",
            stance: "warm",
            kind: "deal",
            next: "no",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_end_stay",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mar_end_stay",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "go",
            stance: "cold",
            kind: "push",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_end_sent",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mar_end_sent",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "you",
            stance: "frank",
            kind: "ask",
            next: "wish",
            tell: [],
            effects: [],
          },
        ],
      },
      wish: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "promise",
            stance: "warm",
            kind: "deal",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mar_end_grave",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mar_end_grave",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "silent",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mar_end_said",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bal_lunch",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 7, max: 14 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ballin",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "weary",
            when: {
              kind: "temperament",
              who: {
                role: "who",
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
            id: "go",
            stance: "warm",
            kind: "deal",
            next: "go",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_bal_lunch_went",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "last",
            stance: "frank",
            kind: "ask",
            next: "last",
            tell: [],
            effects: [],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_lunch_no",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "go",
            stance: "warm",
            kind: "deal",
            next: "go",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_bal_lunch_went",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_lunch_no",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bal_rooms",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_bal_lunch",
        },
        { kind: "world", of: { is: "war_months", min: 19, max: 31 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ballin",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "went",
        when: {
          kind: "memory",
          key: "pv_bal_lunch_went",
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "open",
            stance: "warm",
            kind: "ask",
            next: "coal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_bal_room_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "sleep",
            stance: "frank",
            kind: "ask",
            next: "sleep",
            tell: [],
            effects: [],
          },
          {
            id: "close",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_room_closed",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "open",
            stance: "warm",
            kind: "ask",
            next: "coal",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_bal_room_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "end",
            stance: "frank",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      coal: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bal_line",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_bal_lunch",
        },
        { kind: "world", of: { is: "war_months", min: 30, max: 44 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "no_lunch",
            when: {
              kind: "memory",
              key: "pv_bal_lunch_no",
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
            next: "keep",
            tell: ["army:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_line_kept",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_bal_line_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "cut",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_line_cut",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_bal_line_cut",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "call",
            stance: "warm",
            kind: "ask",
            next: "call",
            tell: [],
            effects: [],
          },
        ],
      },
      call: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "potato",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_line_kept",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_bal_line_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_line_cut",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_bal_door",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_bal_lunch",
        },
        { kind: "world", of: { is: "war_months", min: 44 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ballin",
      },
    },
    salience: 6,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "cut",
        when: {
          kind: "memory",
          key: "pv_bal_line_cut",
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "out",
            stance: "frank",
            kind: "push",
            next: "out",
            tell: ["trust:+1", "army:-1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_bal_alone",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
            ],
          },
          {
            id: "weather",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_weather",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_bal_weather",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      out: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "where",
            stance: "frank",
            kind: "ask",
            next: "where",
            tell: [],
            effects: [],
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
      where: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_bal_end_said",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_bal_end_said",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_gra_birth",
    nation: ["DEU"],
    kind: "talk",
    when: { kind: "world", of: { is: "war_months", min: 8, max: 14 } },
    cast: {
      who: {
        person: "deu_heir",
      },
    },
    salience: 6,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "cold",
            when: {
              kind: "person_trust",
              who: {
                role: "who",
              },
              max: -1,
            },
          },
          {
            id: "cunning",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["cunning"],
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
            next: "what",
            tell: [],
            effects: [],
          },
          {
            id: "see",
            stance: "warm",
            kind: "deal",
            next: "see",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_saw",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "later",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_later",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "see",
            stance: "warm",
            kind: "deal",
            next: "see",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_saw",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "arm",
            stance: "frank",
            kind: "ask",
            next: "arm",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_arm",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      arm: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "nothing",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_saw",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      see: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_gra_photo",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_gra_birth",
        },
        { kind: "world", of: { is: "war_months", min: 14, max: 29 } },
      ],
    },
    cast: {
      who: {
        person: "deu_cecilie",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "front",
            stance: "warm",
            kind: "deal",
            next: "front",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_front",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_gra_front",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "how",
            stance: "frank",
            kind: "ask",
            next: "how",
            tell: [],
            effects: [],
          },
          {
            id: "court",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_left_out",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_gra_left_out",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      how: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "front",
            stance: "frank",
            kind: "deal",
            next: "front",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_front",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_gra_front",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "court",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_left_out",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      front: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_gra_lap",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_gra_photo",
        },
        { kind: "world", of: { is: "war_months", min: 31, max: 50 } },
      ],
    },
    cast: {
      who: {
        person: "deu_cecilie",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "front",
        when: {
          kind: "memory",
          key: "pv_gra_front",
        },
      },
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "stay",
            stance: "warm",
            kind: "ask",
            next: "stay",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_hand",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_gra_hand",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "mother",
            stance: "frank",
            kind: "ask",
            next: "mother",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_mother",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "take",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_hand_away",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "no",
            stance: "warm",
            kind: "ask",
            next: "stay",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_hand",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_gra_after",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_gra_birth",
        },
        { kind: "world", of: { is: "war_months", min: 48 } },
      ],
    },
    cast: {
      who: {
        person: "deu_cecilie",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "safe",
            stance: "warm",
            kind: "deal",
            next: "safe",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_gra_end_safe",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_gra_end_safe",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "nothing",
            stance: "cold",
            kind: "push",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_end_shut",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_gra_end_shut",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "know",
            stance: "frank",
            kind: "ask",
            next: "know",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_gra_end_said",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      safe: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      know: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_lud_franz",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "world",
          of: { is: "war_months", own: true, min: 30, max: 46 },
        },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "anx",
            when: {
              kind: "temperament",
              who: {
                role: "who",
              },
              of: ["anxious"],
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "sit",
            stance: "warm",
            kind: "ask",
            next: "sit",
            tell: [],
            effects: [],
          },
          {
            id: "two",
            stance: "frank",
            kind: "ask",
            next: "two",
            tell: [],
            effects: [],
          },
          {
            id: "table",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_lud_table",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      sit: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "two",
            stance: "frank",
            kind: "ask",
            next: "two",
            tell: [],
            effects: [],
          },
          {
            id: "table",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      two: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_lud_asked",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_lud_erich",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "seen", scene: "deu_f_spring_plan" },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 8,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "asked",
            when: {
              kind: "memory",
              key: "pv_lud_asked",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "heinz",
            stance: "frank",
            kind: "deal",
            next: "heinz",
            tell: ["army:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_lud_heinz_grounded",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "army",
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_lud_heinz_grounded",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "rest",
            stance: "warm",
            kind: "ask",
            next: "rest",
            tell: [],
            effects: [],
          },
          {
            id: "map",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_lud_map",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      heinz: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
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
            id: "done",
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
  {
    id: "deu_pv_lud_roses",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_lud_erich",
        },
        { kind: "world", of: { is: "war_months", min: 48 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "sit",
            stance: "warm",
            kind: "ask",
            next: "sit",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
          {
            id: "son",
            stance: "frank",
            kind: "ask",
            next: "dream",
            tell: [],
            effects: [],
          },
          {
            id: "pass",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      sit: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "rose",
            stance: "warm",
            kind: "ask",
            next: "dream",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_lud_rose",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      dream: {
        says: [
          {
            id: "heinz",
            when: {
              kind: "memory",
              key: "pv_lud_heinz_grounded",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "heard",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_lud_end_truth",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_lud_end_truth",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "no",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_lud_end_unheard",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_lud_end_unheard",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_lud_wife",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "memory",
          key: "pv_lud_heinz_grounded",
        },
        { kind: "world", of: { is: "war_months", min: 49 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ludendorff",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            next: "what",
            tell: [],
            effects: [],
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
      what: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_lud_end_debt",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_lud_end_debt",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_ebe_first",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 24 } },
        { kind: "world", of: { is: "entered", tag: "BGR" } },
      ],
    },
    cast: {
      who: {
        person: "deu_valentini",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
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
            id: "hand",
            stance: "frank",
            kind: "deal",
            next: "hand",
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_wrote",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
            ],
          },
          {
            id: "form",
            stance: "cold",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_form",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "none",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_none",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      hand: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "plain",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_plain",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_ebe_plain",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_ebe_second",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        {
          kind: "seen",
          scene: "deu_pv_ebe_first",
        },
        { kind: "world", of: { is: "war_months", own: true, min: 26 } },
        { kind: "at_war", tag: "FRA" },
      ],
    },
    cast: {
      who: {
        person: "deu_valentini",
      },
    },
    salience: 7,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "wrote",
            when: {
              kind: "memory",
              key: "pv_ebe_wrote",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "again",
            stance: "frank",
            kind: "deal",
            next: null,
            tell: ["court:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_wrote_twice",
                who: {
                  role: "who",
                },
              },
              {
                kind: "inst",
                inst: "court",
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_ebe_wrote_twice",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "pass",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_passed",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_ebe_stable",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "pv_ebe_wrote",
            },
            {
              kind: "memory",
              key: "pv_ebe_wrote_twice",
            },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 36, max: 51 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ebert",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "yes",
            stance: "frank",
            kind: "ask",
            next: "yes",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_ebe_reins",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "son",
            stance: "warm",
            kind: "ask",
            next: "son",
            tell: [],
            effects: [],
          },
          {
            id: "put",
            stance: "cold",
            kind: "push",
            next: "put",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_reins_cold",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "son",
            stance: "warm",
            kind: "ask",
            next: "son",
            tell: [],
            effects: [],
          },
        ],
      },
      son: {
        says: [
          {
            id: "twice",
            when: {
              kind: "memory",
              key: "pv_ebe_wrote_twice",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "none",
            stance: "frank",
            kind: "ask",
            next: "fix",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_fix",
                who: {
                  role: "who",
                },
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
      fix: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "reason",
                key: "pv_ebe_fix",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      put: {
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
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_ebe_end",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "any",
          of: [
            {
              kind: "memory",
              key: "pv_ebe_reins",
            },
            {
              kind: "memory",
              key: "pv_ebe_fix",
            },
            {
              kind: "memory",
              key: "pv_ebe_reins_cold",
            },
          ],
        },
        { kind: "world", of: { is: "war_months", min: 49 } },
      ],
    },
    cast: {
      who: {
        person: "deu_ebert",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "fix",
            when: {
              kind: "memory",
              key: "pv_ebe_fix",
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
            next: "what",
            tell: [],
            effects: [],
          },
          {
            id: "no",
            stance: "threat",
            kind: "push",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_ebe_end_shut",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_ebe_end_shut",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "heard",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_ebe_end_heard",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_ebe_end_heard",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "leave",
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
  {
    id: "deu_pv_mul_walk",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "any",
      of: [
        { kind: "chapter", max: 5 },
        { kind: "world", of: { is: "war_months", max: 7 } },
        { kind: "world", of: { is: "peace_months", max: 8 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 5,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "warm",
            when: {
              kind: "person_trust",
              who: {
                role: "who",
              },
              min: 2,
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "johanna",
            stance: "warm",
            kind: "ask",
            next: "johanna",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mul_johanna",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "what",
            stance: "frank",
            kind: "ask",
            next: "what",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_forgot",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "day",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
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
            id: "sorry",
            stance: "frank",
            kind: "ask",
            next: "johanna",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_johanna",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "day",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      johanna: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "house",
            stance: "warm",
            kind: "ask",
            next: "house",
            tell: [],
            effects: [],
          },
          {
            id: "done",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      house: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "diary",
            stance: "frank",
            kind: "ask",
            next: "diary",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_diary_asked",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      diary: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mul_diary_ok",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mul_sven",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "world",
          of: {
            is: "war",
          },
        },
        { kind: "world", of: { is: "war_months", own: true, min: 5, max: 41 } },
        {
          kind: "seen",
          scene: "deu_pv_mul_walk",
        },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "read",
            stance: "frank",
            kind: "push",
            next: "read",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_sven_read",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "post",
            stance: "warm",
            kind: "ask",
            next: "post",
            tell: [],
            effects: [],
          },
          {
            id: "no",
            stance: "warm",
            kind: "leave",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
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
            id: "right",
            stance: "frank",
            kind: "ask",
            next: "why",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mul_told",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "angry",
            stance: "threat",
            kind: "push",
            next: null,
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_sven_angry",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
              {
                kind: "reason",
                key: "pv_mul_sven_angry",
                who: {
                  role: "who",
                },
              },
            ],
          },
        ],
      },
      post: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
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
            id: "whole",
            stance: "frank",
            kind: "deal",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_whole",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mul_whole",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "done",
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
  {
    id: "deu_pv_mul_ask",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mul_walk",
        },
        { kind: "world", of: { is: "war_months", min: 22, max: 47 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
    start: "open",
    nodes: {
      open: {
        says: [
          {
            id: "whole",
            when: {
              kind: "memory",
              key: "pv_mul_whole",
            },
          },
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "how",
            stance: "frank",
            kind: "ask",
            next: "how",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_asked_him",
                who: {
                  role: "who",
                },
              },
            ],
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
      how: {
        says: [
          {
            id: "warm",
            when: {
              kind: "person_trust",
              who: {
                role: "who",
              },
              min: 2,
            },
          },
          {
            id: "cold",
            when: {
              kind: "person_trust",
              who: {
                role: "who",
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
            id: "who",
            stance: "frank",
            kind: "ask",
            next: "three",
            tell: [],
            effects: [],
          },
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
        ],
      },
      three: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "keep",
            stance: "frank",
            kind: "ask",
            next: null,
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_three_kept",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "cut",
            stance: "cold",
            kind: "push",
            next: null,
            tell: ["trust:-1"],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_three_cut",
                who: {
                  role: "who",
                },
              },
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: -1,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mul_leave",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mul_walk",
        },
        { kind: "world", of: { is: "war_months", min: 41 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 6,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            next: "go",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mul_end_released",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mul_end_released",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "stay",
            stance: "frank",
            kind: "deal",
            next: "stay",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_end_kept",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mul_end_kept",
                who: {
                  role: "who",
                },
              },
            ],
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
      why: {
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
            next: "go",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mul_end_released",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mul_end_released",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "stay",
            stance: "frank",
            kind: "deal",
            next: "stay",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_end_kept",
                who: {
                  role: "who",
                },
              },
              {
                kind: "reason",
                key: "pv_mul_end_kept",
                who: {
                  role: "who",
                },
              },
            ],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
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
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
  {
    id: "deu_pv_mul_1908",
    nation: ["DEU"],
    kind: "talk",
    when: {
      kind: "all",
      of: [
        {
          kind: "seen",
          scene: "deu_pv_mul_walk",
        },
        { kind: "world", of: { is: "war_months", min: 14, max: 40 } },
      ],
    },
    cast: {
      who: {
        person: "deu_muller",
      },
    },
    salience: 4,
    tags: ["people", "private"],
    once: true,
    variants: [
      {
        id: "base",
      },
    ],
    summon: true,
    who: "who",
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
            id: "night",
            stance: "frank",
            kind: "ask",
            next: "night",
            tell: [],
            effects: [
              {
                kind: "remember",
                key: "pv_mul_1908",
                who: {
                  role: "who",
                },
              },
            ],
          },
          {
            id: "reply",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      night: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "laugh",
            stance: "frank",
            kind: "ask",
            next: "laugh",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
            ],
          },
          {
            id: "stop",
            stance: "cold",
            kind: "leave",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
      laugh: {
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
            next: "yes",
            tell: ["trust:+1"],
            effects: [
              {
                kind: "person_trust",
                who: {
                  role: "who",
                },
                delta: 1,
              },
              {
                kind: "remember",
                key: "pv_mul_laughed_at",
                who: {
                  role: "who",
                },
              },
            ],
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
      yes: {
        says: [
          {
            id: "base",
          },
        ],
        replies: [
          {
            id: "done",
            stance: "warm",
            kind: "ask",
            next: null,
            tell: [],
            effects: [],
          },
        ],
      },
    },
  },
];

/** Scene -> what the private lines add: new bodies, a node's new lines. */
const DEU_ECHOES: Readonly<
  Record<
    string,
    {
      body: readonly GwVariant[];
      says: Readonly<Record<string, readonly GwVariant[]>>;
    }
  >
> = {
  deu_t_beth_son: {
    body: [
      {
        id: "kept_after",
        when: {
          kind: "all",
          of: [
            {
              kind: "chapter",
              min: 10,
            },
            {
              kind: "memory",
              key: "pv_beth_son_kept",
            },
          ],
        },
      },
    ],
    says: {
      open: [
        {
          id: "kept_loss",
          when: {
            kind: "all",
            of: [
              {
                kind: "chapter",
                min: 10,
              },
              {
                kind: "memory",
                key: "pv_beth_son_kept",
              },
            ],
          },
        },
        {
          id: "went_loss",
          when: {
            kind: "all",
            of: [
              {
                kind: "chapter",
                min: 10,
              },
              {
                kind: "memory",
                key: "pv_beth_funeral_went",
              },
            ],
          },
        },
        {
          id: "wreath_loss",
          when: {
            kind: "all",
            of: [
              {
                kind: "chapter",
                min: 10,
              },
              {
                kind: "memory",
                key: "pv_beth_wreath_again",
              },
            ],
          },
        },
      ],
    },
  },
  deu_t2_beth_sign: {
    body: [],
    says: {
      open: [
        {
          id: "went",
          when: {
            kind: "memory",
            key: "pv_beth_funeral_went",
          },
        },
        {
          id: "kept",
          when: {
            kind: "memory",
            key: "pv_beth_son_kept",
          },
        },
      ],
    },
  },
  deu_t2_beth_after: {
    body: [],
    says: {
      open: [
        {
          id: "said",
          when: {
            kind: "memory",
            key: "pv_beth_end_said",
          },
        },
      ],
    },
  },
  deu_t2_beth_uboat: {
    body: [],
    says: {
      open: [
        {
          id: "free",
          when: {
            kind: "memory",
            key: "pv_beth_son_free",
          },
        },
        {
          id: "kept2",
          when: {
            kind: "memory",
            key: "pv_beth_son_kept",
          },
        },
      ],
    },
  },
  deu_t_moltke_nerves: {
    body: [],
    says: {
      open: [
        {
          id: "fear",
          when: {
            kind: "memory",
            key: "pv_mol_fear_told",
          },
        },
      ],
    },
  },
  deu_v2_moltke_last: {
    body: [],
    says: {
      open: [
        {
          id: "note",
          when: {
            kind: "memory",
            key: "pv_mol_note",
          },
        },
      ],
    },
  },
  deu_t_moltke_after: {
    body: [],
    says: {
      open: [
        {
          id: "mocked",
          when: {
            kind: "memory",
            key: "pv_mol_mocked",
          },
        },
        {
          id: "told",
          when: {
            kind: "memory",
            key: "pv_mol_fear_told",
          },
        },
      ],
    },
  },
  deu_t2_tirp_son: {
    body: [],
    says: {
      open: [
        {
          id: "thanks",
          when: {
            kind: "memory",
            key: "pv_tir_thanks_ok",
          },
        },
        {
          id: "slight",
          when: {
            kind: "memory",
            key: "pv_tir_thanks_cold",
          },
        },
      ],
    },
  },
  deu_t2_tirp_after: {
    body: [],
    says: {
      open: [
        {
          id: "home",
          when: {
            kind: "memory",
            key: "pv_tir_son_home",
          },
        },
      ],
    },
  },
  deu_v2_buelow_opera: {
    body: [],
    says: {
      open: [
        {
          id: "phili",
          when: {
            kind: "memory",
            key: "pv_eul_truth",
          },
        },
      ],
    },
  },
  deu_t2_muller_diary: {
    body: [],
    says: {
      open: [
        {
          id: "phili",
          when: {
            kind: "memory",
            key: "pv_eul_phili",
          },
        },
        {
          id: "whole",
          when: {
            kind: "memory",
            key: "pv_mul_whole",
          },
        },
      ],
    },
  },
  deu_v2_empress_table: {
    body: [],
    says: {
      open: [
        {
          id: "sister",
          when: {
            kind: "memory",
            key: "pv_mar_honour",
          },
        },
      ],
    },
  },
  deu_v2_empress_heart: {
    body: [],
    says: {
      open: [
        {
          id: "stayed",
          when: {
            kind: "memory",
            key: "pv_mar_stayed",
          },
        },
      ],
    },
  },
  deu_v2_ballin_last: {
    body: [],
    says: {
      open: [
        {
          id: "line",
          when: {
            kind: "memory",
            key: "pv_bal_line_kept",
          },
        },
        {
          id: "cut",
          when: {
            kind: "memory",
            key: "pv_bal_line_cut",
          },
        },
      ],
    },
  },
  deu_t_heir_son: {
    body: [],
    says: {
      open: [
        {
          id: "girl",
          when: {
            kind: "memory",
            key: "pv_gra_front",
          },
        },
        {
          id: "gone",
          when: {
            kind: "memory",
            key: "pv_gra_left_out",
          },
        },
      ],
    },
  },
  deu_t2_heir_father: {
    body: [],
    says: {
      open: [
        {
          id: "arm",
          when: {
            kind: "memory",
            key: "pv_gra_arm",
          },
        },
      ],
    },
  },
  deu_t2_lud_nerves: {
    body: [],
    says: {
      open: [
        {
          id: "debt",
          when: {
            kind: "memory",
            key: "pv_lud_heinz_grounded",
          },
        },
      ],
    },
  },
  deu_t2_ebert_sons: {
    body: [],
    says: {
      open: [
        {
          id: "wrote",
          when: {
            kind: "memory",
            key: "pv_ebe_wrote",
          },
        },
        {
          id: "none",
          when: {
            kind: "memory",
            key: "pv_ebe_none",
          },
        },
      ],
    },
  },
  deu_v2_valentini_paper: {
    body: [],
    says: {
      open: [
        {
          id: "ebert",
          when: {
            kind: "memory",
            key: "pv_ebe_wrote_twice",
          },
        },
      ],
    },
  },
  deu_v_muller_night: {
    body: [],
    says: {
      open: [
        {
          id: "sven",
          when: {
            kind: "memory",
            key: "pv_mul_sven_read",
          },
        },
      ],
    },
  },
  deu_t_muller_mood: {
    body: [],
    says: {
      open: [
        {
          id: "johanna",
          when: {
            kind: "memory",
            key: "pv_mul_johanna",
          },
        },
      ],
    },
  },
};

/** Lays the private lines into the scene as it was written. */
export function withDeuPrivate(scene: GwScene): GwScene {
  const e = DEU_ECHOES[scene.id];
  if (e === undefined) return scene;
  const nodes = { ...scene.nodes };
  for (const [id, more] of Object.entries(e.says)) {
    nodes[id] = { ...nodes[id], says: [...more, ...nodes[id].says] };
  }
  return {
    ...scene,
    variants: [...e.body, ...scene.variants],
    ...(scene.nodes === undefined ? {} : { nodes }),
  };
}
