// World War 1936 P3 (spec §18.2, plan decision 15): the history beats'
// data. The first 48 are P0's calendar, 1:1; lane K5 adds its beats below
// the marker, sorted on their own (controller ruling R19).
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { HISTORY } from "@openfront/engine-lib/ww1936/History";

describe("history beats", () => {
  const beats = CONTENT.beats;

  it("every P0 calendar entry is a safety beat, in the same order", () => {
    HISTORY.forEach((e, i) => {
      const b = beats[i];
      expect(b, `P0 entry ${i}`).toBeDefined();
      expect(b.date).toBe(e.date);
      expect(b.actor).toBe(e.actor);
      // The Soviet invasion of Poland was undeclared: a join (no
      // guarantees called; controller ruling, lane D fix round 1).
      const kind = b.id === "b1939_09_17_sun_pol" ? "join" : e.kind;
      expect(b.act).toEqual({ kind, target: e.target });
      expect(b.safety).toBe(true);
      expect(b.id).toBe(
        `b${e.date.split("-").join("_")}_${e.actor.toLowerCase()}_${e.target.toLowerCase()}`,
      );
    });
  });

  it("each block is in date order (P0's 48, then the new beats)", () => {
    const blocks = [
      beats.slice(0, HISTORY.length),
      beats.slice(HISTORY.length),
    ];
    for (const block of blocks) {
      for (let i = 1; i < block.length; i++) {
        expect(dayOfDate(block[i].date), block[i].id).toBeGreaterThanOrEqual(
          dayOfDate(block[i - 1].date),
        );
      }
    }
  });

  it("ids are unique and every act names something that exists", () => {
    const ids = beats.map((b) => b.id);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
    for (const b of beats) {
      expect(COUNTRY_TAGS, b.id).toContain(b.actor);
      const a = b.act;
      switch (a.kind) {
        case "declare":
        case "join":
        case "diplo":
          expect(COUNTRY_TAGS, b.id).toContain(a.target);
          expect(a.target, b.id).not.toBe(b.actor);
          break;
        case "decision":
          expect(CONTENT.decisionIdx.has(a.id), b.id).toBe(true);
          if (a.target !== undefined) expect(COUNTRY_TAGS).toContain(a.target);
          break;
        case "event":
          expect(CONTENT.eventIdx.has(a.id), b.id).toBe(true);
          break;
        case "focus":
          expect(CONTENT.focusIdx.has(a.id), b.id).toBe(true);
          break;
      }
      if (b.windowDays !== undefined) {
        expect(b.windowDays, b.id).toBeGreaterThan(0);
      }
      expect(dayOfDate(b.date), b.id).toBeGreaterThanOrEqual(0);
    }
  });
});
