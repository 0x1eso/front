import {
  extraVoteCost,
  extraVoteCostMilli,
} from "@openfront/engine-lib/congress/CongressBalance";
import { newRing, ringAdd, ringSum } from "@openfront/engine-lib/congress/Ring";
import {
  ballotBlock,
  bOnlyFor,
  conveneBlock,
  conveneWindowOpen,
  isSanctionedIn,
  mayVote,
  tallyVotes,
} from "@openfront/engine-lib/congress/Voting";

describe("the ledger ring", () => {
  test("adds per bucket and sums a sliding window", () => {
    const r = newRing(18);
    ringAdd(r, 0, 5);
    ringAdd(r, 1, 3);
    ringAdd(r, 17, 2);
    expect(ringSum(r, 17, 18)).toBe(10);
    // Bucket 0 is out of an 18-bucket window ending at 18.
    expect(ringSum(r, 18, 18)).toBe(5);
    ringAdd(r, 18, 1);
    expect(ringSum(r, 18, 18)).toBe(6);
    expect(ringSum(r, 18, 2)).toBe(3);
    ringAdd(r, 100, 4);
    expect(ringSum(r, 100, 18)).toBe(4);
  });

  test("ignores a write older than the window", () => {
    const r = newRing(4);
    ringAdd(r, 10, 1);
    ringAdd(r, 6, 9);
    expect(ringSum(r, 10, 4)).toBe(1);
  });
});

describe("voting rules", () => {
  test("the k-th extra vote costs 10·k", () => {
    expect([0, 1, 2, 3, 4, 5].map(extraVoteCost)).toEqual([
      0, 10, 30, 60, 100, 150,
    ]);
    expect(extraVoteCostMilli(2, 4)).toBe(70_000);
  });

  test("more votes win; a tie, or nothing, adopts nothing", () => {
    expect(
      tallyVotes([
        { option: "A", extra: 1 },
        { option: "B", extra: 0 },
      ]),
    ).toEqual({ a: 2, b: 1, adopted: "A" });
    expect(
      tallyVotes([
        { option: "A", extra: 0 },
        { option: "B", extra: 0 },
      ]),
    ).toEqual({ a: 1, b: 1, adopted: null });
    expect(tallyVotes([])).toEqual({ a: 0, b: 0, adopted: null });
  });

  test("ballots are checked in order", () => {
    const ok = {
      open: true,
      itemExists: true,
      eligible: true,
      bOnly: false,
      existing: null,
      option: "A" as const,
      extra: 2,
      influenceMilli: 30_000,
    };
    expect(ballotBlock(ok)).toBeNull();
    expect(ballotBlock({ ...ok, open: false })).toBe("closed");
    expect(ballotBlock({ ...ok, itemExists: false })).toBe("item");
    expect(ballotBlock({ ...ok, eligible: false })).toBe("seat");
    expect(ballotBlock({ ...ok, bOnly: true })).toBe("b_only");
    expect(ballotBlock({ ...ok, existing: { option: "B", extra: 0 } })).toBe(
      "side",
    );
    expect(ballotBlock({ ...ok, existing: { option: "A", extra: 2 } })).toBe(
      "lower",
    );
    expect(ballotBlock({ ...ok, influenceMilli: 29_999 })).toBe("influence");
    // A raise from +1 to +2 costs 20.
    expect(
      ballotBlock({
        ...ok,
        existing: { option: "A", extra: 1 },
        influenceMilli: 20_000,
      }),
    ).toBeNull();
  });

  test("convening needs the window, a seat, no tie to the target and 50 influence", () => {
    const ok = {
      available: true,
      windowOpen: true,
      seated: true,
      isTarget: false,
      friendlyToTarget: false,
      sanctioned: false,
      influenceMilli: 50_000,
    };
    expect(conveneBlock(ok)).toBeNull();
    expect(conveneBlock({ ...ok, available: false })).toBe("unavailable");
    expect(conveneBlock({ ...ok, windowOpen: false })).toBe("window");
    expect(conveneBlock({ ...ok, isTarget: true })).toBe("target");
    expect(conveneBlock({ ...ok, seated: false })).toBe("seat");
    expect(conveneBlock({ ...ok, friendlyToTarget: true })).toBe("friendly");
    expect(conveneBlock({ ...ok, sanctioned: true })).toBe("sanctioned");
    expect(conveneBlock({ ...ok, influenceMilli: 49_999 })).toBe("influence");
  });

  test("no convening while a session votes, during an emergency, or 30 s before a session", () => {
    expect(conveneWindowOpen(1000, false, false, 1400)).toBe(true);
    expect(conveneWindowOpen(1100, false, false, 1400)).toBe(false);
    expect(conveneWindowOpen(1000, true, false, 2000)).toBe(false);
    expect(conveneWindowOpen(1000, false, true, 2000)).toBe(false);
    expect(conveneWindowOpen(1000, false, false, null)).toBe(true);
  });
});

describe("seat and sanction rules shared with the client", () => {
  test("a sanction in force is S1 A naming the player", () => {
    const sanction = {
      resolution: "sanction" as const,
      option: "A" as const,
      targets: [4],
      param: null,
    };
    expect(isSanctionedIn([sanction], 4)).toBe(true);
    expect(isSanctionedIn([sanction], 5)).toBe(false);
    expect(isSanctionedIn([{ ...sanction, option: "B" }], 4)).toBe(false);
    expect(isSanctionedIn([{ ...sanction, resolution: "truce" }], 4)).toBe(
      false,
    );
    expect(isSanctionedIn([], 4)).toBe(false);
  });

  test("a seat or one of the item's targets may vote", () => {
    const item = { resolution: "sanction" as const, targets: [7] };
    expect(mayVote(item, 2, [2, 3])).toBe(true);
    expect(mayVote(item, 7, [2, 3])).toBe(true);
    expect(mayVote(item, 5, [2, 3])).toBe(false);
  });

  test("on an emergency item the target and its friends may only oppose", () => {
    const emergency = { resolution: "emergency" as const, targets: [7] };
    const asked: number[] = [];
    const friendlyTo = (friends: number[]) => (target: number) => {
      asked.push(target);
      return friends.includes(target);
    };
    expect(bOnlyFor(emergency, 7, friendlyTo([]))).toBe(true);
    expect(bOnlyFor(emergency, 3, friendlyTo([7]))).toBe(true);
    expect(bOnlyFor(emergency, 3, friendlyTo([]))).toBe(false);
    expect(asked).toEqual([7, 7]);
    // Other items: anyone with a vote may take either side.
    expect(
      bOnlyFor({ resolution: "sanction", targets: [7] }, 7, friendlyTo([7])),
    ).toBe(false);
    expect(asked).toEqual([7, 7]);
  });
});
