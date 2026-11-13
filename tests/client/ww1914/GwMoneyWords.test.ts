// ww210 lane C: every money-bill and bargaining id has its words in en.json
// and ko.json; the leader's and the wing man's lines fall back to the common
// ones; due dates read as words.
import {
  GW_CREDITS_BY,
  GW_MONEY_BILLS,
  GW_MONEY_FAILS,
  GW_TAX_KINDS,
} from "@openfront/engine-api/ww1914/GwBudget";
import {
  GW_COUNTER_ANSWERS,
  GW_COUNTER_KINDS,
  GW_DEAL_FATES,
  GW_DEAL_KINDS,
  GW_DEAL_TERMS,
  GW_THREAT_KINDS,
} from "@openfront/engine-api/ww1914/GwDeals";
import { GW_PRICE_KINDS } from "@openfront/engine-api/ww1914/GwLaw";
import {
  GwPackSchema,
  mergeGwPacks,
} from "@openfront/engine-api/ww1914/GwPack";
import { GW_BARGAIN_MOVES } from "@openfront/engine-api/ww1914/GwTable";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import {
  dealDueWord,
  earmarkName,
  leaderLine,
  wingLine,
} from "../../../src/client/hud/ww1914/GwMoneyWords";

const lang = (l: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../../resources/lang/${l}.json`),
      "utf-8",
    ),
  ) as Record<string, unknown>;
const LANGS = { en: lang("en"), ko: lang("ko") };

const at = (o: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (v, k) =>
        v !== null && typeof v === "object"
          ? (v as Record<string, unknown>)[k]
          : undefined,
      o,
    );

const each = (prefix: string, ids: readonly string[]) =>
  ids.map((id) => `gw.${prefix}.${id}`);

describe("ww210 money and bargaining words", () => {
  test("every id has its words in en and ko", () => {
    const keys = [
      ...each("budget.tax", GW_TAX_KINDS),
      ...each("budget.tax_who", GW_TAX_KINDS),
      ...each("money.bill", GW_MONEY_BILLS),
      ...each("money.name", GW_MONEY_BILLS),
      ...each("money.by", GW_CREDITS_BY),
      ...each("money.fail", GW_MONEY_FAILS),
      ...each("deal.term", GW_DEAL_TERMS),
      ...each("deal.counter", GW_COUNTER_KINDS),
      ...each("deal.answer", GW_COUNTER_ANSWERS),
      ...each("deal.threat", GW_THREAT_KINDS),
      ...each("deal.kind", GW_DEAL_KINDS),
      ...each("deal.fate", GW_DEAL_FATES),
      ...each("deal.says", [
        ...GW_COUNTER_ANSWERS.map((a) => `counter_${a}`),
        ...GW_THREAT_KINDS.map((t) => `threat_${t}`),
      ]),
      ...each("deal.wing", ["hello", "take", "leave"]),
      ...each("bargain.move", GW_BARGAIN_MOVES),
      ...each("lobby.price", GW_PRICE_KINDS),
      "gw.vote.beat.defy",
      "gw.vote.beat.defy_by",
    ];
    const missing = Object.entries(LANGS).flatMap(([l, d]) =>
      keys.filter((k) => typeof at(d, k) !== "string").map((k) => `${l} ${k}`),
    );
    expect(missing).toEqual([]);
    expect(at(LANGS.ko, "gw.money.name.budget")).toBe("{year}년도 예산안");
    expect(at(LANGS.ko, "gw.money.name.credits")).toBe("제{n}차 전쟁 공채안");
    expect(at(LANGS.ko, "gw.vote.beat.defy_by")).toBe("{name}, 반대");
  });

  test("a pack's lines win; else the common line", () => {
    const pack = mergeGwPacks([
      GwPackSchema.parse({
        version: 1,
        scenes: {},
        people: {},
        factions: {
          deu_spd: {
            name: "사민당",
            says: { counter_take: "좋소." },
            wing: { hello: "몰래 왔소." },
          },
        },
        money: { mark: { deu_east_prussia: { name: "동프로이센 재건" } } },
      }),
    ]);
    expect(leaderLine(pack, "deu_spd", "counter_take")).toBe("좋소.");
    expect(wingLine(pack, "deu_spd", "hello")).toBe("몰래 왔소.");
    const common = leaderLine(pack, "deu_spd", "threat_file");
    expect(common).not.toBe("");
    expect(leaderLine(null, "deu_spd", "threat_file")).toBe(common);
    expect(wingLine(pack, "deu_zentrum", "take")).toBe(
      wingLine(null, "x", "take"),
    );
    expect(
      earmarkName(pack, "DEU", { id: "deu_east_prussia", line: "relief" }),
    ).toBe("동프로이센 재건");
    expect(
      earmarkName(pack, "DEU", { id: "deu_other", line: "relief" }),
    ).not.toBe("");
  });

  test("due dates are words: none, the armistice, now, soon, later", () => {
    const words = [
      dealDueWord(-1, 10),
      dealDueWord(-2, 10),
      dealDueWord(10, 10),
      dealDueWord(12, 10),
      dealDueWord(20, 10),
    ];
    expect(new Set(words).size).toBe(5);
    expect(words.join(" ")).not.toMatch(/[0-9]/);
  });
});
