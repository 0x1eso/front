// World War 1936 P3 (spec §12, §24.2): the events' data. Passes on empty
// tables; the content lanes fill them (plan Task 1 Step 15).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  allEffectLists,
  CONTENT_TARGETS,
  emptyOrAtLeast,
  ENGINE_EVENT_PATTERN,
  ENGINE_EVENTS,
  hasKey,
  walkEffects,
} from "./contentUtil";

const OPTION_IDS = ["a", "b", "c", "d"];

describe("event data", () => {
  const { events } = CONTENT;

  it("every event passes the schemas", () => {
    for (const e of events) {
      if (e.trigger) WwConditionSchema.parse(e.trigger);
      for (const o of e.options) {
        for (const x of o.effects) WwEffectSchema.parse(x);
        if (o.available) WwConditionSchema.parse(o.available);
        for (const m of o.ai.mods ?? []) WwConditionSchema.parse(m.if);
      }
    }
  });

  it("there are as many as planned", () => {
    expect(emptyOrAtLeast(events.length, CONTENT_TARGETS.events)).toBe(true);
  });

  it("options: one to four, a..d in order, at most one history option, a known default", () => {
    for (const e of events) {
      expect(e.options.length >= 1 && e.options.length <= 4, e.id).toBe(true);
      e.options.forEach((o, i) => expect(o.id, e.id).toBe(OPTION_IDS[i]));
      expect(
        e.options.filter((o) => o.history === true).length,
        e.id,
      ).toBeLessThanOrEqual(1);
      if (e.humanDefault !== undefined) {
        expect(
          e.options.map((o) => o.id),
          e.id,
        ).toContain(e.humanDefault);
      }
      if (e.timeoutSec !== undefined) expect([20, 30]).toContain(e.timeoutSec);
    }
  });

  it("dates fall in 1936–1945; a dated event has no receivers (R21)", () => {
    for (const e of events) {
      if (e.date === undefined) continue;
      const d = dayOfDate(e.date.on);
      expect(d >= 0 && d <= dayOfDate("1945-12-31"), e.id).toBe(true);
      expect(e.date.to.length, e.id).toBeGreaterThan(0);
      expect(e.receivers, e.id).toBeUndefined();
    }
  });

  it("a news event has one option and fires nothing", () => {
    for (const e of events) {
      if (e.kind !== "news") continue;
      expect(e.options, e.id).toHaveLength(1);
      walkEffects(e.options[0].effects, (x) =>
        expect(x.kind, e.id).not.toBe("fire_event"),
      );
    }
  });

  it("every event is reached: a date, a trigger, a fire_event, a beat or the engine", () => {
    const fired = new Set<string>();
    const collect = (list: readonly Effect[]) =>
      walkEffects(list, (x) => {
        if (x.kind === "fire_event") fired.add(x.id);
      });
    for (const [, list] of allEffectLists()) collect(list);
    for (const b of CONTENT.beats) {
      if (b.act.kind === "event") fired.add(b.act.id);
    }
    const engine = new Set<string>(ENGINE_EVENTS);
    for (const e of events) {
      const reached =
        e.date !== undefined ||
        e.trigger !== undefined ||
        fired.has(e.id) ||
        engine.has(e.id) ||
        ENGINE_EVENT_PATTERN.test(e.id);
      expect(reached, e.id).toBe(true);
    }
    // What fires an event names one that exists.
    for (const id of fired) expect(CONTENT.eventIdx.has(id), id).toBe(true);
  });

  it("every event has its texts", () => {
    for (const e of events) {
      expect(hasKey(`ww1936.event_title.${e.id}`), e.id).toBe(true);
      expect(hasKey(`ww1936.event_desc.${e.id}`), e.id).toBe(true);
      if (e.kind === "news") {
        expect(hasKey(`ww1936.news.${e.id}`), e.id).toBe(true);
      } else {
        for (const o of e.options) {
          expect(hasKey(`ww1936.event_opt.${e.id}.${o.id}`), e.id).toBe(true);
        }
      }
    }
  });
});
