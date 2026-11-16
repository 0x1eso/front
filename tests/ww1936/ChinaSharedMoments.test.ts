// ww229 MA3: CHN and CCP are two lanes of one war. Their shared moments
// happen once, set off by the side that acted: the Xi'an incident stops a
// running war, the clash in southern Anhui and the blockade of the Border
// Region reach the CCP only when the Nationalists order them.
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";

const event = (id: string) => CONTENT.events.find((e) => e.id === id)!;
const fires = (effects: readonly Effect[], id: string) =>
  effects.some(
    (e) =>
      e.kind === "fire_event" &&
      e.id === id &&
      JSON.stringify(e.to) === JSON.stringify({ tag: "CCP" }),
  );

describe("CHN and CCP share their moments", () => {
  it("the Xi'an incident's historical option ends a running war before the pact", () => {
    const a = event("chn_xian_incident").options.find((o) => o.id === "a")!;
    const stop = a.effects.findIndex(
      (e) =>
        e.kind === "if" &&
        e.then.some(
          (x) =>
            x.kind === "end_war" && JSON.stringify(x.of) === '{"tag":"CCP"}',
        ),
    );
    const pact = a.effects.findIndex((e) => e.kind === "nap");
    expect(stop).toBeGreaterThanOrEqual(0);
    expect(stop).toBeLessThan(pact);
  });

  it("no bandit campaign over a pact with the Communists", () => {
    const f = CONTENT.focuses.find((x) => x.id === "chn_bandit_campaign")!;
    expect(f.available).toEqual({
      not: { kind: "nap_with", of: { tag: "CCP" } },
    });
  });

  it("southern Anhui: one incident, fired by the Nationalists' order", () => {
    const clash = event("ccp_new_fourth_clash");
    expect(clash.date).toBeUndefined();
    expect(clash.receivers).toBeUndefined();
    const anhui = event("chn_ev_south_anhui");
    expect(
      fires(anhui.options.find((o) => o.id === "a")!.effects, clash.id),
    ).toBe(true);
    expect(
      fires(anhui.options.find((o) => o.id === "b")!.effects, clash.id),
    ).toBe(false);
  });

  it("the blockade reaches the CCP only through Chongqing's decision", () => {
    const blockade = event("ccp_ev_blockade");
    expect(blockade.receivers).toBeUndefined();
    expect(blockade.trigger).toBeUndefined();
    const d = CONTENT.decisions.find(
      (x) => x.id === "chn_dec_blockade_border_region",
    )!;
    expect(fires(d.effects ?? [], blockade.id)).toBe(true);
    // Only while the united front stands (no 1936 blockade).
    expect(JSON.stringify(d.available)).toContain("chn_sp_front_uneasy");
  });
});
