// ww170 S3 (design ww168 B4): no scene waits for a date it doesn't need. A
// calendar scene may keep its date; the ones the hand lanes haven't re-gated
// yet are pending, and a pending one that no longer waits fails, so the list
// only shrinks.
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  dateGates,
  GW_CALENDAR_SCENES,
  GW_REGATE_PENDING,
} from "@openfront/engine-lib/ww1914/content/Regate";
import { describe, expect, test } from "vitest";

const C = gwContent();
const items = [
  ...C.scenes.filter((s) => s.scheduledOnly !== true),
  ...(C.acts ?? []),
];

describe("scenes come by state, not by date", () => {
  test("only calendar and pending scenes wait for a date", () => {
    const waiting = items
      .filter((x) => dateGates(x).length > 0)
      .filter(
        (x) =>
          !GW_REGATE_PENDING.has(x.id) && !GW_CALENDAR_SCENES.includes(x.id),
      )
      .map((x) => `${x.id}: ${dateGates(x).join(", ")}`);
    expect(waiting).toEqual([]);
  });

  test("a pending id is still a date gate: take it out once re-gated", () => {
    const byId = new Map(items.map((x) => [x.id, x]));
    const stale = [...GW_REGATE_PENDING].filter((id) => {
      const x = byId.get(id);
      return x === undefined || dateGates(x).length === 0;
    });
    expect(stale).toEqual([]);
  });

  test("the rule: what is a date and what is the opening", () => {
    const date = {
      kind: "world",
      of: { is: "date", from: "1916-01" },
    } as const;
    expect(dateGates({ when: date })).toEqual(["date 1916-01.."]);
    expect(dateGates({ when: { kind: "chapter", max: 5 } })).toEqual([]);
    expect(dateGates({ when: { kind: "chapter", min: 2 } })).toEqual([]);
    expect(dateGates({ when: { kind: "chapter", min: 7 } })).toEqual([
      "chapter 7..",
    ]);
    expect(dateGates({ stage: ["crisis"] })).toEqual([]);
    expect(dateGates({ stage: ["y1914"] })).toEqual(["stage y1914"]);
    expect(
      dateGates({
        stage: ["crisis", "y1914"],
        when: { kind: "chapter", max: 3 },
      }),
    ).toEqual([]);
    expect(dateGates({ stage: ["y1914", "war"] })).toEqual([]);
    const months = { kind: "world", of: { is: "war_months", min: 5 } } as const;
    expect(dateGates({ when: months, stage: ["war"] })).toEqual([]);
  });
});
