// World War 1936 P6 (spec §20.6): the intelligence drawer's data.
import type { WwDepthDetail } from "@openfront/engine-api/ww1936/DepthTypes";
import { describe, expect, it } from "vitest";
import { IntelModel } from "../../../src/client/hud/ww1936/IntelModel";
import { fogGame } from "./FogFixture";
import { ID } from "./LandFixture";

function withDetail(over: Partial<WwDepthDetail["intel"]> = {}, level = 0) {
  const g = fogGame({ level });
  const pol = ID("POL");
  const intel: WwDepthDetail["intel"] = {
    agency: true,
    upgrades: 0,
    upId: -1,
    upProgressPm: 0,
    operatives: [
      {
        uid: 7,
        codename: 3,
        skill: 1,
        state: "idle",
        target: 0,
        mission: null,
        op: -1,
        daysLeft: 0,
        capturePm: 0,
      },
    ],
    operations: [],
    cryptoTarget: 0,
    cryptoPm: 0,
    cipher: 0,
    decrypt: 0,
    decrypted: [],
    networks: [[pol, 412]],
    ...over,
  };
  g.depth.apply({
    countries: [{ smallID: pol, agency: false } as never],
    details: [{ smallID: ID("DEU"), intel } as unknown as WwDepthDetail],
    fx: [],
    news: [],
  });
  return { g, m: new IntelModel(g.game as never), pol };
}

describe("IntelModel (spec §20.6)", () => {
  it("an operation row shows each condition", () => {
    const { m, pol } = withDetail();
    const rows = m.operationRows(pol, 7);
    const sabotage = rows.find((r) => r.op === "op_sabotage")!;
    expect(
      sabotage.conditions.map((c) => [c.key, c.have, c.need, c.ok]),
    ).toEqual([
      ["network", 412, 300, true],
      ["operatives", 1, 1, true],
      ["pp", 500, 25, true],
    ]);
    expect(sabotage.ok).toBe(true);
    const capture = rows.find((r) => r.op === "op_capture_cipher")!;
    // Network 412 < 500, one operative < 2.
    expect(capture.conditions.filter((c) => !c.ok).map((c) => c.key)).toEqual([
      "network",
      "operatives",
    ]);
    expect(capture.ok).toBe(false);
    expect(rows.find((r) => r.op === "op_coup")!.successPm).not.toBeNull();
    expect(sabotage.successPm).toBeNull();
    expect(m.opStartOrder("op_capture_cipher", pol, 7)).toBeNull();
    expect(m.opStartOrder("op_sabotage", pol, 7)).toEqual({
      kind: "operation_start",
      op: "op_sabotage",
      target: pol,
      operatives: [7],
    });
  });

  it("level sources add up to the engine level", () => {
    for (const level of [0, 23, 47, 65, 80, 100]) {
      const { m, pol } = withDetail({}, level);
      for (const d of [0, 1, 2, 3]) {
        expect(m.levelTotal(pol, d)).toBe(level);
      }
    }
    // Known lines: base, war, network (412/20 = 20).
    const { m, pol } = withDetail({}, 60);
    const keys = m.levelSources(pol, 1).map((l) => l.key);
    expect(keys).toEqual(expect.arrayContaining(["base", "at_war", "network"]));
    expect(m.levelSources(pol, 1).find((l) => l.key === "network")!.value).toBe(
      20,
    );
  });

  it("builds the four-tap flow's orders and the agency cards", () => {
    const { m, pol } = withDetail({ upgrades: 1, upId: 3, upProgressPm: 400 });
    const cards = m.agencyCards();
    expect(cards).toHaveLength(12);
    expect(cards.find((c) => c.id === "ag_ops_1")!.state).toBe("owned");
    expect(cards.find((c) => c.id === "ag_crypto_1")!.state).toBe("building");
    expect(cards.find((c) => c.id === "ag_ops_3")!.state).toBe("locked");
    expect(m.operativeCards()).toHaveLength(2);
    expect(m.operativeCards()[0].risk).toMatch(/%$/);
    expect(m.missionChips(7, pol).every((c) => c.enabled)).toBe(true);
    expect(m.assignOrder(7, pol, "build_network")).toEqual({
      kind: "operative_assign",
      operative: 7,
      target: pol,
      mission: "build_network",
    });
    expect(m.targetRows()[0].atWar).toBe(true);
  });
});

describe("IntelModel with lane I's view data (batch P6-3 glue)", () => {
  it("reads lane I's level lines, broken codes, capture risk, codenames and recruits", () => {
    const pol = ID("POL");
    const { m } = withDetail({
      operatives: [
        {
          uid: 7,
          codename: 63,
          skill: 1,
          state: "idle",
          target: pol,
          mission: "build_network",
          op: -1,
          daysLeft: 0,
          capturePm: 3,
        },
        {
          uid: 8,
          codename: 4,
          skill: 1,
          state: "idle",
          target: 0,
          mission: null,
          op: -1,
          daysLeft: 12,
          capturePm: 0,
        },
      ],
      levelParts: [
        [pol, 1, "base", 5],
        [pol, 1, "recon", 12],
        [pol, 1, "counter", -4],
        [pol, 2, "base", 5],
      ],
      decrypted: [
        { target: pol, activeUntil: -1 },
        { target: ID("ITA"), activeUntil: 99_999 },
      ],
      decryptLog: [{ target: ID("SUN"), day: 40 }],
      cryptoTarget: pol,
      cryptoDaysLeft: 17,
    });
    // Lane I's own lines, in its order, zero lines left out.
    expect(m.levelSources(pol, 1)).toEqual([
      { key: "base", value: 5 },
      { key: "recon", value: 12 },
      { key: "counter", value: -4 },
    ]);
    // The view's capture chance is ‰: 3‰ a day is 0.3%.
    const [first] = m.operativeCards();
    expect(first.risk).toBe("0.3%");
    // Codename 63 is K5's c3, the second of its name.
    expect(first.codename.endsWith(" 2")).toBe(true);
    // A recruit still training is not free for an operation.
    expect(m.freeOperatives().map((o) => o.uid)).toEqual([7]);
    const crypto = m.cryptoCard();
    expect(crypto.daysLeft).toBe(17);
    expect(crypto.decrypted.map((d) => [d.target, d.exploiting])).toEqual([
      [pol, false],
      [ID("ITA"), true],
    ]);
    expect(crypto.brokenLog).toEqual([{ target: ID("SUN"), day: 40 }]);
  });
});
