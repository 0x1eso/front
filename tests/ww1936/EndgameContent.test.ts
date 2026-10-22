// World War 1936 P5 (spec §15.2, §17, §19.7; plan decision 30): the
// endgame's other tables. Passes on empty tables; K5 fills them.
import {
  COUNTRY_TAGS,
  DORMANT_TAGS,
} from "@openfront/engine-api/ww1936/Countries";
import { OCCUPATION_LAWS } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  IDEOLOGIES,
  POP_TOTAL,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { BEATS_P5 } from "@openfront/engine-lib/ww1936/content/endgame/beats";
import { DORMANT_POLITICS } from "@openfront/engine-lib/ww1936/content/endgame/dormant";
import { REGION_GROUPS_P5 } from "@openfront/engine-lib/ww1936/content/endgame/groups";
import { HISTORY_BEATS } from "@openfront/engine-lib/ww1936/content/history";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { CONTENT_TARGETS, emptyOrAtLeast } from "./contentUtil";

const TAGS = new Set<string>(COUNTRY_TAGS);

describe("World War 1936 P5: endgame content", () => {
  it("the tables have their planned sizes", () => {
    expect(
      emptyOrAtLeast(REGION_GROUPS_P5.length, CONTENT_TARGETS.p5Groups),
    ).toBe(true);
    expect(emptyOrAtLeast(BEATS_P5.length, CONTENT_TARGETS.p5Beats)).toBe(true);
    expect([0, CONTENT_TARGETS.dormant]).toContain(DORMANT_POLITICS.length);
  });

  it("civil war seeds and occupation defaults name real things", () => {
    for (const s of CONTENT.seeds) {
      expect(TAGS.has(s.tag), s.tag).toBe(true);
      expect(IDEOLOGIES).toContain(s.ideology);
      expect(CONTENT.groupIdx.has(s.group), `${s.tag} ${s.group}`).toBe(true);
    }
    for (const o of CONTENT.occupationDefaults) {
      expect(TAGS.has(o.by) && TAGS.has(o.of), `${o.by} ${o.of}`).toBe(true);
      expect(OCCUPATION_LAWS).toContain(o.law);
      if (o.until !== undefined) {
        expect(dayOfDate(o.until), `${o.by} ${o.of}`).toBeGreaterThan(0);
      }
    }
  });

  it("the P5 beats: unique ids, by date", () => {
    const p3 = new Set(HISTORY_BEATS.map((b) => b.id));
    const ids = BEATS_P5.map((b) => b.id);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
    for (const b of BEATS_P5) {
      expect(p3.has(b.id), b.id).toBe(false);
      expect(TAGS.has(b.actor), b.id).toBe(true);
    }
    for (let i = 1; i < BEATS_P5.length; i++) {
      expect(
        dayOfDate(BEATS_P5[i].date),
        BEATS_P5[i].id,
      ).toBeGreaterThanOrEqual(dayOfDate(BEATS_P5[i - 1].date));
    }
  });

  it("the P5 groups: unique, real regions of one 1936 owner", () => {
    const p3 = new Set(
      CONTENT.groups
        .filter((g) => !REGION_GROUPS_P5.includes(g))
        .map((g) => g.id),
    );
    const ids = REGION_GROUPS_P5.map((g) => g.id);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
    for (const g of REGION_GROUPS_P5) {
      expect(p3.has(g.id), g.id).toBe(false);
      expect(TAGS.has(g.owner1936), g.id).toBe(true);
    }
  });

  it("every dormant slot has its politics (popularity sums to 100, the new pack's tree)", () => {
    if (DORMANT_POLITICS.length === 0) return;
    expect(DORMANT_POLITICS.map((c) => c.tag).sort()).toEqual(
      [...DORMANT_TAGS].sort(),
    );
    for (const c of DORMANT_POLITICS) {
      expect(c.popularity.reduce((a, b) => a + b, 0) * 100, c.tag).toBe(
        POP_TOTAL,
      );
      // P6 K5b: the dormant slots play the "new" pack (generic + pack).
      expect(c.tree, c.tag).toBe("new");
    }
  });
});
