// The Japanese focus tree after the Step B expansion: size, forks, groups.
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";

describe("JPN focus tree", () => {
  const jpn = CONTENT.focuses.filter((f) => f.tree === "JPN");

  it("has about 96 focuses, each in a group", () => {
    expect(jpn.length).toBe(96);
    for (const f of jpn) expect(f.group, f.id).toBeTruthy();
  });

  it("its big forks are exclusive both ways", () => {
    const pairs = [
      ["jpn_tojo_cabinet", "jpn_konoe_cabinet2"],
      ["jpn_taisei_yokusankai", "jpn_party_revival"],
      ["jpn_surrender_faction", "jpn_last_stand"],
      ["jpn_pearl_harbor_plan", "jpn_oil_negotiation"],
      ["jpn_china_localise", "jpn_china_escalate"],
      ["jpn_control_faction", "jpn_kodoha_faction"],
      ["jpn_state_control", "jpn_zaibatsu_coop"],
      ["jpn_spirit_over_matter", "jpn_firepower_doctrine"],
    ];
    const byId = new Map(jpn.map((f) => [f.id, f]));
    for (const [a, b] of pairs) {
      expect(byId.get(a)?.exclusive, a).toContain(b);
      expect(byId.get(b)?.exclusive, b).toContain(a);
    }
  });
});
