// Great War 1914 (ww209/ww210): the money bills as rows. Who votes a
// country's money, its war credits' rhythm, what losing them does and the way
// round; the earmarks its leaders can be given; the purse a faction's ideals
// give it on money bills. One file per country in content/money/<tag>.ts:
// a later country adds a row, no code. engine/ww1914/MoneyBills runs them
// (S1), engine/ww1914/Deals bargains with them (S2). See
// /home/eser/dev/ww209-format.md.
import type {
  GwInstitution,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwBudgetLine,
  GwCreditsBy,
  GwMoneyBill,
  GwMoneyFail,
  GwTaxKind,
} from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwAround, GwChamber } from "@openfront/engine-api/ww1914/GwHouse";
import type { GwAxis } from "@openfront/engine-api/ww1914/GwSociety";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwSide } from "./HouseRows";

/** The money bills' law ids: `deu_budget`, `deu_credits_3`. */
export const moneyIds = {
  budget: (tag: GwTag) => `${tag.toLowerCase()}_budget`,
  credits: (tag: GwTag, n: number) => `${tag.toLowerCase()}_credits_${n}`,
};

/** A money bill's law id read back; null for any other law. */
export function moneyBillOf(
  law: string,
): { tag: string; kind: GwMoneyBill; n: number } | null {
  const m = /^([a-z]{3})_(budget|credits)(?:_([0-9]+))?$/.exec(law);
  if (m === null) return null;
  if (m[2] === "budget") {
    return m[3] === undefined
      ? { tag: m[1].toUpperCase(), kind: "budget", n: 0 }
      : null;
  }
  if (m[3] === undefined) return null;
  return { tag: m[1].toUpperCase(), kind: "credits", n: Number(m[3]) };
}

/** A rhythm of war credits: the first row that holds is the one in force. */
export interface GwCreditsRow {
  readonly by: GwCreditsBy;
  /** Chapters between credits (a chapter is a month of the full calendar). */
  readonly every: number;
  /** It holds now; absent: always. */
  readonly when?: GwCond;
}

/** Whose a budget line is: who minds it cut or raised (decision 5B). */
export interface GwLineOwner {
  readonly faction?: string;
  readonly community?: string;
  readonly inst?: GwInstitution;
  /** The office whose holder's trust moves (the OHL, Stavka, GQG man). */
  readonly office?: GwOffice;
}

/** Who votes a country's money and what losing it does (design §2.3). */
export interface GwMoneyRow {
  readonly tag: GwTag;
  /** The chambers a money bill meets, in order. */
  readonly houses: readonly GwChamber[];
  /** The war credits' rhythm; empty: the yearly budget only. */
  readonly credits: readonly GwCreditsRow[];
  /** What a budget lost for good does. */
  readonly fail: GwMoneyFail;
  /** A chamber whose no does something else (Budapest: `unpaid`). */
  readonly failBy?: Readonly<Partial<Record<GwChamber, GwMoneyFail>>>;
  /** The way round: a seat flag that carries it, or the house's around door. */
  readonly round?: { readonly flag?: string; readonly around?: GwAround };
  /** The head of government may dissolve over a refused budget (DEU 1906-07). */
  readonly dissolve?: boolean;
  /** Each line's political owner; absent lines have none. */
  readonly owners?: Readonly<Partial<Record<GwBudgetLine, GwLineOwner>>>;
  /**
   * A country whose navy line feeds no repair (GwBudgetRow `navy` null): the
   * fleet's mood. `low`: the scene that comes earlier with the line under the
   * norm (a mutiny); `high`: the one a year with it over (a sea operation).
   */
  readonly fleet?: { readonly low?: string; readonly high?: string };
}

/** Points of a line set aside for a community or region (지역에 돈을 준다). */
export interface GwEarmarkRow {
  /** `rus_galicia_relief`. Text: pack money.mark.<id>. */
  readonly id: string;
  readonly tag: GwTag;
  readonly line: GwBudgetLine;
  /** Points of the line (of 100 shares). */
  readonly points: number;
  /** Whose: the faction that asks for it, the community it feeds. */
  readonly faction?: string;
  readonly community?: string;
  /** It can be given now; absent: always. */
  readonly when?: GwCond;
}

export interface GwMoneyContent {
  readonly rows: readonly GwMoneyRow[];
  readonly earmarks: readonly GwEarmarkRow[];
}

export function joinMoney(parts: readonly GwMoneyContent[]): GwMoneyContent {
  return {
    rows: parts.flatMap((p) => p.rows),
    earmarks: parts.flatMap((p) => p.earmarks),
  };
}

/**
 * A faction's purse from its ideals (design §2.1), before its `purse` rows:
 * for each axis side it holds, the lines it wants over (+1) or under (-1) the
 * norm, the tax kinds it backs or fights, and its side on a budget by decree.
 * S1 sums them; T tunes. Minus is the axis's first word (GwSociety).
 */
export const GW_PURSE_IDEALS: Readonly<
  Partial<
    Record<
      GwAxis,
      Readonly<
        Record<
          "-1" | "1",
          {
            readonly lines?: Readonly<Partial<Record<GwBudgetLine, GwSide>>>;
            readonly taxes?: Readonly<Partial<Record<GwTaxKind, GwSide>>>;
            /** Its side on a budget passed round the house. */
            readonly decree?: GwSide;
          }
        >
      >
    >
  >
> = {
  // 왕권·권위 ↔ 의회: the parliament side votes against a budget by decree.
  rule: { "-1": { decree: 1 }, "1": { decree: -1 } },
  // 재산 ↔ 노동.
  class: {
    "-1": { taxes: { property: -1, income: -1, profits: -1, consumption: 1 } },
    "1": {
      lines: { relief: 1, works: 1 },
      taxes: { consumption: -1, property: 1, income: 1, profits: 1 },
    },
  },
  // DEU 무력 ↔ 협조.
  force: {
    "-1": { lines: { army: 1, navy: 1 } },
    "1": { lines: { army: -1, relief: 1 } },
  },
  // GBR 연합 ↔ 자치, RUS 하나의 러시아 ↔ 민족들, AUH 이원 체제 ↔ 민족들: the
  // national share (Ireland, the borderlands, Hungary's quota).
  union: { "-1": { lines: { army: 1 } }, "1": { lines: { national: 1 } } },
  nations: { "-1": { lines: { army: 1 } }, "1": { lines: { national: 1 } } },
  dual: { "-1": { lines: { national: 1 } }, "1": { lines: { national: -1 } } },
  // FRA 교회 ↔ 세속.
  church: { "-1": { lines: { relief: 1 } }, "1": { lines: { works: 1 } } },
};

/** Notches of the class axis a passed budget of that tax kind pushes (S1, T). */
export const GW_TAX_AXIS: Readonly<Record<GwTaxKind, number>> = {
  consumption: -1,
  income: 1,
  property: 1,
  profits: 1,
};
