// World War 1936 P5 (plan Task 1 Step 16): the appended lists keep their
// order (wire, snapshot and content enums: append only).
import { WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  COUNTRY_TAGS,
  DORMANT_TAGS,
  isDormantTag,
  PICK_ORDER,
} from "@openfront/engine-api/ww1936/Countries";
import {
  WW_ORDER_BLOCKS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  COUNTRY_STATES,
  DEMAND_KINDS,
  ENDGAME_ORDER_KINDS,
  LINE_PEACE_ORDER_KINDS,
  MEMBER_STATES,
  OCCUPATION_LAWS,
  SUBJECT_LEVELS,
  WAR_KINDS,
  WHITE_PEACE_ORDER_KINDS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  ARMY_ORDER_KINDS,
  SUPPORT_IDS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  CONVOY_USE_PRIORITY,
  CONVOY_USES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  CONDITION_KINDS,
  EFFECT_KINDS,
  effectGroup,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  FOCUS_TREES,
  WW_STAT_KEYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { DECLARE_WAR_BLOCKS } from "@openfront/engine-api/ww1936/WorldWarTypes";

const after = <T extends string>(list: readonly T[], anchor: T): T[] =>
  list.slice(list.indexOf(anchor) + 1);

describe("World War 1936 P5 lists", () => {
  it("the 14 dormant slots are the last 14 tags, in order, and never picked", () => {
    expect(DORMANT_TAGS).toHaveLength(14);
    expect(COUNTRY_TAGS.slice(-14)).toEqual([...DORMANT_TAGS]);
    expect(DORMANT_TAGS.every(isDormantTag)).toBe(true);
    expect(isDormantTag("DEU")).toBe(false);
    expect(PICK_ORDER.some((t) => isDormantTag(t))).toBe(false);
  });

  it("the 13 endgame orders follow air_auto in the ww_order union", () => {
    const kinds = WwOrderSchema.options.map(
      (o) => (o.shape.kind as { value: string }).value,
    );
    expect(ENDGAME_ORDER_KINDS).toHaveLength(13);
    // P6 (plan decision 4) appends its 57 after army_garrison.
    expect(after(kinds, "air_auto").slice(0, 13)).toEqual([
      ...ENDGAME_ORDER_KINDS,
    ]);
  });

  it("the refusals, stats, effects and conditions are appended", () => {
    // P6 appends its own after subject_restricted.
    expect(after(WW_ORDER_BLOCKS, "bad_zone").slice(0, 15)).toEqual([
      "not_participant",
      "conference_closed",
      "too_many_demands",
      "bad_demand",
      "law_locked",
      "not_integrable",
      "ll_conditions",
      "ll_limit",
      "volunteer_conditions",
      "volunteer_limit",
      "not_volunteer",
      "ships_not_owned",
      "no_takeover",
      "disarmed",
      "subject_restricted",
    ]);
    expect(after(WW_STAT_KEYS, "paradropPrepPct").slice(0, 7)).toEqual([
      "capturePct",
      "resistanceTargetPct",
      "complianceGainPct",
      "garrisonNeedPct",
      "autonomyGainPct",
      "legitimacyGainPct",
      "occupationOutputPp",
    ]);
    // Spec §16.4's 23 and the pre-flight's navy_xp.
    // P6 (plan decision 27) appends 11 after navy_xp.
    const fx = after(EFFECT_KINDS, "fuel").slice(0, 24);
    expect(fx).toHaveLength(24);
    expect(fx[0]).toBe("release");
    expect(fx[22]).toBe("restore_country");
    expect(fx[23]).toBe("navy_xp");
    // Lane E appended borders_group (the content's "next to a group" gap);
    // P6 (plan decision 27, pre-flight §0-11) appends 10 after it.
    const cond = after(CONDITION_KINDS, "fuel_ratio_below").slice(0, 14);
    expect(cond).toHaveLength(14);
    expect(cond[0]).toBe("is_exile");
    expect(cond[12]).toBe("legitimacy_ge");
    expect(cond[13]).toBe("borders_group");
    expect(effectGroup("release")).toBe("endgame");
    expect(effectGroup("navy_xp")).toBe("endgame");
    expect(effectGroup("ships")).toBe("navy");
    expect(effectGroup("annex")).toBe("territory");
  });

  it("the other appended values sit after their anchors", () => {
    // P6 (spec §13.1) appends congress.
    // White peace appends truce_active.
    expect(after(DECLARE_WAR_BLOCKS, "isolation")).toEqual([
      "subject_restricted",
      "exile",
      "congress",
      "truce_active",
    ]);
    expect(after(WW_ORDER_BLOCKS, "railgun_limit")).toEqual([
      "peace_too_early",
      "peace_cooldown",
      "peace_war_kind",
      "peace_pending",
      "peace_no_offer",
      "no_invasion_port",
      // Negotiated peace appends its five.
      "peace_bad_terms",
      "peace_capital",
      "peace_too_much",
      "zone_only",
      "claim_only",
      // The research overhaul appends its two.
      "exclusive",
      "no_project",
      // Research grants append theirs.
      "bonus_held",
    ]);
    const kinds = WwOrderSchema.options.map(
      (o) => (o.shape.kind as { value: string }).value,
    );
    // The automation lane appends auto_set and army_auto_all after them,
    // peace on the current line its one after those, the research
    // overhaul research_lean and the research grants research_grant last.
    expect(kinds.slice(-7, -5)).toEqual([...WHITE_PEACE_ORDER_KINDS]);
    expect(kinds.slice(-5, -3)).toEqual(["auto_set", "army_auto_all"]);
    expect(kinds.slice(-3, -2)).toEqual([...LINE_PEACE_ORDER_KINDS]);
    expect(kinds.slice(-2)).toEqual(["research_lean", "research_grant"]);
    expect(after(ARMY_ORDER_KINDS, "invade")).toEqual(["garrison"]);
    expect(after(SUPPORT_IDS, "signal")).toEqual(["military_police"]);
    expect(after(WW_TECH_IDS, "synthetic_oil_2")[0]).toBe("military_police");
    expect(after(CONVOY_USES, "trade")).toEqual(["lend_lease"]);
    expect(CONVOY_USE_PRIORITY.lend_lease).toBe(30);
    expect(after(FOCUS_TREES, "SUN").slice(0, 4)).toEqual([
      "ITA",
      "JPN",
      "FRA",
      "USA",
    ]);
  });

  it("the endgame's own lists", () => {
    expect([...COUNTRY_STATES]).toEqual(["dormant", "active", "gone"]);
    expect([...WAR_KINDS]).toEqual(["normal", "civil", "independence"]);
    expect([...MEMBER_STATES]).toEqual([
      "active",
      "capitulated",
      "exiled",
      "left",
    ]);
    expect([...SUBJECT_LEVELS]).toEqual([
      "integrated",
      "puppet",
      "colony",
      "dominion",
    ]);
    expect([...OCCUPATION_LAWS]).toEqual([
      "occ_civil",
      "occ_military",
      "occ_martial",
    ]);
    expect(DEMAND_KINDS).toHaveLength(14);
  });
});
