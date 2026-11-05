// World War 1936 (ww88 lane X): PeaceAssign's rules on a small hand-made map:
// the two-thirds line, its ties, the connection rule, enclaves, hand-over
// land, compensation and the loser's end.
import {
  AssignIn,
  AssignRegion,
  AssignWinner,
  peaceAssignment,
  settleLosers,
} from "@openfront/engine-lib/ww1936/PeaceAssign";

const L = 9;
const A = 1;
const B = 2;
const C = 3;

const reg = (region: number, o: Partial<AssignRegion> = {}): AssignRegion => ({
  region,
  loser: L,
  value: 10,
  group: 1,
  holder: 0,
  handedTo: 0,
  port: false,
  keyCity: false,
  ...o,
});
const win = (id: number, wsMilli = 100): AssignWinner => ({ id, wsMilli });

/** `edges` as land neighbours; `home` maps regions outside the stake to their owners. */
function map(
  regions: AssignRegion[],
  winners: AssignWinner[],
  edges: [number, number][],
  home: Record<number, number> = {},
  capital = 0,
): AssignIn {
  const near = new Map<number, number[]>();
  for (const [a, b] of edges) {
    near.set(a, [...(near.get(a) ?? []), b]);
    near.set(b, [...(near.get(b) ?? []), a]);
  }
  return {
    regions,
    winners,
    neighbours: (r) => near.get(r) ?? [],
    legal: (r) => home[r] ?? L,
    capitalOf: () => capital,
  };
}
const assigned = (i: AssignIn) => new Map(peaceAssignment(i).assign);

describe("World War 1936 ww88: PeaceAssign", () => {
  it("a sole winner keeps all it holds, nothing moved and nothing paid", () => {
    const i = map(
      [reg(1, { holder: A }), reg(2, { holder: A, group: 2 }), reg(3)],
      [win(A)],
      [[1, 2]],
    );
    const out = peaceAssignment(i);
    expect(out.assign).toEqual([
      [1, A],
      [2, A],
    ]);
    expect(out.comp).toEqual([]);
  });

  it("two thirds of the value takes the group; a point less leaves each with its holder", () => {
    const edges: [number, number][] = [
      [1, 10],
      [2, 10],
      [3, 11],
    ];
    const home = { 10: A, 11: B };
    const at = (v: number) =>
      map(
        [
          reg(1, { holder: A, value: v }),
          reg(2, { holder: A, value: 10 }),
          reg(3, { holder: B, value: 10 }),
        ],
        [win(A), win(B)],
        edges,
        home,
      );
    expect(assigned(at(10)).get(3)).toBe(A);
    expect(assigned(at(9)).get(3)).toBe(B);
  });

  it("the land counts for the line, then the key city, war score and the smaller id", () => {
    // Both winners hold one region of equal value and neither has two
    // thirds; a loser's group with one holder decides nothing here, so the
    // order shows in who may take a group the top holder can't reach.
    const i = map(
      [
        reg(1, { holder: A, value: 70 }),
        reg(2, { holder: B, value: 15, keyCity: true }),
        reg(3, { holder: C, value: 15 }),
      ],
      [win(A), win(B, 1), win(C, 9)],
      [
        [2, 20],
        [3, 21],
      ],
      { 20: B, 21: C },
    );
    // A has its two thirds but no way there: the next in line is the key
    // city's holder, though C has more war score.
    expect(assigned(i).get(1)).toBe(B);
  });

  it("a port in the group connects a holder across the sea", () => {
    const i = map(
      [
        reg(1, { holder: A, value: 70, port: true }),
        reg(2, { holder: B, value: 30 }),
      ],
      [win(A), win(B)],
      [[2, 20]],
      { 20: B },
    );
    expect(assigned(i).get(2)).toBe(A);
  });

  it("nobody connected: each region stays with its holder", () => {
    const i = map(
      [reg(1, { holder: A, value: 70 }), reg(2, { holder: B, value: 30 })],
      [win(A), win(B)],
      [],
    );
    const a = assigned(i);
    expect([a.get(1), a.get(2)]).toEqual([A, B]);
  });

  it("land it is being assigned connects it too, whatever the order", () => {
    // Group 2 (regions 1, 2) touches A's home; group 1 (region 3, the first
    // by id would be group 2) touches only group 2.
    const i = map(
      [
        reg(1, { holder: A, value: 80, group: 2 }),
        reg(2, { holder: B, value: 20, group: 2 }),
        reg(3, { holder: A, value: 80, group: 1 }),
        reg(4, { holder: B, value: 20, group: 1 }),
      ],
      [win(A), win(B)],
      [
        [1, 10],
        [1, 3],
      ],
      { 10: A },
    );
    const a = assigned(i);
    expect([a.get(2), a.get(4)]).toEqual([A, A]);
  });

  it("a small enclave goes to the surrounder and is paid for; a capital or big city stays", () => {
    const edges: [number, number][] = [
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    const at = (keyCity: boolean) =>
      map(
        [
          reg(1, { holder: B, group: 1, keyCity }),
          reg(2, { holder: A, group: 2 }),
          reg(3, { holder: A, group: 3 }),
        ],
        [win(A), win(B)],
        edges,
      );
    const out = peaceAssignment(at(false));
    expect(new Map(out.assign).get(1)).toBe(A);
    expect(out.comp).toEqual([[B, 10]]);
    expect(assigned(at(true)).get(1)).toBe(B);
  });

  it("a piece touching its owner's home land is no enclave", () => {
    const i = map(
      [
        reg(1, { holder: B, group: 1 }),
        reg(2, { holder: A, group: 2 }),
        reg(3, { holder: A, group: 3 }),
      ],
      [win(A), win(B)],
      [
        [1, 2],
        [1, 3],
        [1, 20],
      ],
      { 20: B },
    );
    expect(assigned(i).get(1)).toBe(B);
  });

  it("hand-over land doesn't count for the two-thirds line and goes to the group's taker", () => {
    const i = map(
      [
        reg(1, { holder: A, value: 70 }),
        reg(2, { holder: B, value: 20 }),
        reg(3, { handedTo: B, value: 10 }),
      ],
      [win(A), win(B)],
      [
        [1, 10],
        [2, 3],
      ],
      { 10: A },
    );
    const a = assigned(i);
    expect([a.get(1), a.get(2), a.get(3)]).toEqual([A, A, A]);
  });

  it("hand-over land falls to the neighbour with most land next to it, its victor only last", () => {
    // Group 2 is all hand-over land to B, next to two of A's and one of B's.
    const i = map(
      [
        reg(1, { holder: A, group: 1 }),
        reg(2, { holder: A, group: 3 }),
        reg(3, { holder: B, group: 4 }),
        reg(4, { handedTo: B, group: 2 }),
        reg(5, { handedTo: B, group: 5 }),
      ],
      [win(A), win(B)],
      [
        [1, 4],
        [2, 4],
        [3, 4],
      ],
    );
    const a = assigned(i);
    expect(a.get(4)).toBe(A);
    // Region 5 touches nothing: the last resort.
    expect(a.get(5)).toBe(B);
  });

  it("no compensation for hand-over land", () => {
    const i = map(
      [reg(1, { holder: A, value: 90 }), reg(2, { handedTo: B, value: 10 })],
      [win(A), win(B)],
      [[1, 10]],
      { 10: A },
    );
    expect(peaceAssignment(i).comp).toEqual([]);
  });

  it("a loser with no capital left is gone: its last regions go to the adjacent winner holding the most", () => {
    const i = map(
      [
        reg(1, { holder: A, value: 30, group: 1, keyCity: true }),
        reg(2, { holder: B, value: 50, group: 2 }),
        reg(3, { value: 20, group: 3 }),
      ],
      [win(A), win(B)],
      [
        [1, 3],
        [2, 3],
      ],
      {},
      1,
    );
    const out = peaceAssignment(i);
    expect(new Map(out.assign).get(3)).toBe(B);
    expect(out.gone).toEqual([L]);
  });

  it("under a tenth of its stake's value it's gone; at a tenth it lives on", () => {
    const at = (kept: number) =>
      map(
        [reg(1, { holder: A, value: 100 - kept }), reg(2, { value: kept })],
        [win(A)],
        [[1, 2]],
        {},
        2,
      );
    expect(peaceAssignment(at(9)).gone).toEqual([L]);
    const out = peaceAssignment(at(10));
    expect(out.gone).toEqual([]);
    expect(new Map(out.assign).has(2)).toBe(false);
  });

  it("the last regions go to the winner next to them, whoever holds more elsewhere", () => {
    // Region 3 is left, under a tenth; B's home is next to it, A isn't.
    const i = map(
      [
        reg(1, { holder: A, value: 95, group: 1 }),
        reg(3, { value: 5, group: 2 }),
      ],
      [win(A), win(B, 500)],
      [[3, 8]],
      { 8: B },
      1,
    );
    const out = peaceAssignment(i);
    expect(new Map(out.assign).get(3)).toBe(B);
    expect(out.gone).toEqual([L]);
  });

  it("a safe loser stays, and regions spoken for count as neither kept nor assigned", () => {
    const i = map(
      [reg(1, { value: 95 }), reg(2, { value: 5 })],
      [win(A)],
      [[1, 2]],
      {},
      2,
    );
    const a = new Map<number, number>();
    expect(settleLosers(i, a, { safe: new Set([L]) })).toEqual([]);
    expect(settleLosers(i, a, { bought: new Set([1]) })).toEqual([L]);
    expect(a.get(2)).toBe(A);
    expect(a.has(1)).toBe(false);
  });
});
