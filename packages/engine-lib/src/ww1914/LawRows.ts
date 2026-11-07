// Great War 1914: what a bill is (brief ww142, lane L). One row per bill, in
// content/laws/<tag>.ts: a later country adds a file of rows and its text, no
// code. Who can stop a bill is the form of government's: its row in
// engine/ww1914/AuthorityTable names one of the bodies here. They live in this
// package so the scenes can print the price the engine will charge.
import type {
  GwGauge,
  GwInstitution,
  GwIssue,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";

export interface GwLawBody {
  /** vote: it can throw a bill out. consent: the same, under another name.
   * decree: the sovereign's word is law, and the body only resents it. */
  readonly kind: "vote" | "consent" | "decree";
  readonly inst: GwInstitution;
  /** The count passes from here. */
  readonly need: number;
  /** A second door behind the first. */
  readonly second?: { readonly inst: GwInstitution; readonly need: number };
  /** Going past them: authority, and who resents it. */
  readonly decree: {
    readonly price: number;
    readonly inst: GwInstitution;
    readonly delta: number;
  } | null;
}

/** Named by the forms of government in AuthorityTable. */
export const GW_LAW_BODIES = {
  // The Bundesrat's wartime powers go round the Reichstag, not through it.
  reichstag: {
    kind: "vote",
    inst: "reichstag",
    need: 0,
    decree: { price: 20, inst: "reichstag", delta: -1 },
  },
  republic: { kind: "vote", inst: "reichstag", need: 0, decree: null },
  // A regulation under the Defence of the Realm Act, for what one can reach.
  commons: {
    kind: "vote",
    inst: "commons",
    need: 0,
    second: { inst: "cabinet", need: -2 },
    decree: { price: 15, inst: "commons", delta: -1 },
  },
  // Paragraph 14 covers Austria's half; Hungary's consent it can't replace.
  hungary: {
    kind: "consent",
    inst: "hungary",
    need: 0,
    decree: { price: 15, inst: "nations", delta: -1 },
  },
  // Article 87: the Duma is asked, or it is told afterwards.
  tsar: {
    kind: "decree",
    inst: "duma",
    need: 0,
    decree: { price: 15, inst: "duma", delta: -1 },
  },
  duma: {
    kind: "vote",
    inst: "duma",
    need: 0,
    decree: { price: 15, inst: "duma", delta: -1 },
  },
} as const satisfies Readonly<Record<string, GwLawBody>>;

/** The door a country's bills meet first: what its scenes print. */
export const GW_LAW_HOME: Readonly<Partial<Record<GwTag, GwLawBody>>> = {
  DEU: GW_LAW_BODIES.reichstag,
  GBR: GW_LAW_BODIES.commons,
  AUH: GW_LAW_BODIES.hungary,
  RUS: GW_LAW_BODIES.tsar,
};

/** What a law in force does, on its months of war. */
export interface GwLawTerm {
  readonly gauge: GwGauge | "manpower";
  readonly delta: number;
  readonly every: number;
  readonly offset?: number;
  /** Only this text of the bill. */
  readonly text?: readonly string[];
}

/** One way of drawing the bill up. The first is what a timer takes. */
export interface GwLawDraft {
  readonly id: string;
  readonly tell: readonly string[];
  readonly effects: readonly GwEffect[];
  /** What it does to the count. */
  readonly support: number;
  readonly when?: GwCond;
}

export interface GwLawRow {
  /** Scenes: gw_law_<id> draft, gw_lv_<id> the day, gw_lt_<id> talk, gw_lf_<id> after. */
  readonly id: string;
  readonly tag: GwTag;
  /** When it can be taken up. */
  readonly opens: GwCond;
  /** How the body takes it before anyone has been talked to. */
  readonly lean: number;
  /** It can go past the body by decree at all. */
  readonly decree: boolean;
  /** A body of its own in place of the form's: no second door then. */
  readonly body?: GwInstitution;
  /** The cabinet's camps count too (GW_ISSUE_TABLE), and it votes. */
  readonly issue?: GwIssue;
  /** The draft card's and the day's people. */
  readonly cast: Readonly<Record<string, GwCastRule>>;
  /** Bodies of the draft card before the base. */
  readonly variants?: readonly GwVariant[];
  readonly draft: readonly GwLawDraft[];
  /** Once, when it becomes law, and the tell of that. */
  readonly passed: readonly GwEffect[];
  readonly passedTell: readonly string[];
  readonly term: readonly GwLawTerm[];
  readonly repeal: {
    readonly authority: number;
    readonly tell: readonly string[];
    readonly effects: readonly GwEffect[];
  };
  /** Who can be argued with and how it goes. */
  readonly talk: {
    readonly who: GwCastRule;
    readonly start: string;
    readonly nodes: Readonly<Record<string, GwNode>>;
  };
  /** What comes of it after so many chapters in force. */
  readonly after?: {
    readonly chapters: number;
    readonly cast?: Readonly<Record<string, GwCastRule>>;
    readonly options: readonly GwOption[];
  };
  /** A decision of the desk that already made this law. */
  readonly settled?: GwCond;
  /** Desk scenes that stand aside once the bill is taken up. */
  readonly replaces?: readonly string[];
  /** A seat flag held while it is law: what the older scenes read. */
  readonly flag?: string;
  /** The censor's level while it is law: up on passing, down on repeal. */
  readonly censor?: number;
}

/** What a law does on its months, as tell words: `steady_bread:+1`. */
export function lawTermTell(row: GwLawRow): string[] {
  const out: string[] = [];
  for (const t of row.term) {
    if (t.text !== undefined) continue;
    const word = `steady_${t.gauge}:${t.delta > 0 ? "+" : ""}${t.delta}`;
    if (!out.includes(word)) out.push(word);
  }
  return out;
}
