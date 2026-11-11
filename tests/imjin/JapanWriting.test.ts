// ww177 I6b: Japan's writing in the Imjin content (JapanWriting.ts and the
// I4b scenes it reviewed): the data passes the schemas, every scene is
// called by the state, every text exists in both languages, and the
// scenes speak in words, not numbers.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { imjinContent } from "@openfront/engine-lib/imjin/Content";
import { JP_SCENE } from "@openfront/engine-lib/imjin/JapanContent";
import {
  IMJIN_JPW_DECISIONS,
  IMJIN_JPW_EVENTS,
  IMJIN_JPW_PERSONS,
  IMJIN_JPW_SPIRITS,
} from "@openfront/engine-lib/imjin/JapanWriting";
import { describe, expect, it } from "vitest";
import { en, hasKey, keyIn, ko, walkConds } from "../ww1936/contentUtil";

const SCENES = [
  ...IMJIN_JPW_EVENTS.map((e) => e.id),
  ...Object.values(JP_SCENE),
];

describe("Imjin: Japan's writing", () => {
  const reg = imjinContent();

  it("is in the Imjin registry and passes the schemas", () => {
    for (const e of IMJIN_JPW_EVENTS) {
      expect(reg.eventIdx.has(e.id), e.id).toBe(true);
      WwConditionSchema.parse(e.trigger);
      e.options.forEach((o, i) => {
        expect(o.id, e.id).toBe("abcd"[i]);
        for (const x of o.effects) WwEffectSchema.parse(x);
      });
    }
    for (const d of IMJIN_JPW_DECISIONS) {
      for (const x of [...(d.effects ?? []), ...(d.completeEffects ?? [])]) {
        WwEffectSchema.parse(x);
      }
      if (d.available) WwConditionSchema.parse(d.available);
    }
  });

  it("calls every scene by state: a trigger for Japan, never a date", () => {
    for (const e of IMJIN_JPW_EVENTS) {
      expect(e.receivers, e.id).toEqual(["JPN"]);
      expect(e.date, e.id).toBeUndefined();
      walkConds(e.trigger, (c: Condition) => {
        if (!("kind" in c)) return;
        expect(["date_ge", "date_lt"], e.id).not.toContain(c.kind);
        if (c.kind === "controls_group") {
          expect(reg.groupIdx.has(c.group), c.group).toBe(true);
        }
      });
    }
  });

  it("has every text in English and Korean, scenes in words", () => {
    for (const id of SCENES) {
      for (const part of ["event_title", "event_desc"]) {
        const k = `ww1936.${part}.${id}`;
        expect(hasKey(k), k).toBe(true);
        expect(keyIn(en, k), k).not.toMatch(/\d/);
        expect(keyIn(ko, k), k).not.toMatch(/\d/);
      }
      const e = reg.events[reg.eventIdx.get(id)!];
      for (const o of e.options) {
        const k = `ww1936.event_opt.${id}.${o.id}`;
        expect(hasKey(k), k).toBe(true);
        expect(keyIn(ko, k), k).not.toMatch(/\d/);
      }
    }
    for (const d of IMJIN_JPW_DECISIONS) {
      expect(hasKey(`ww1936.decision.${d.id}`), d.id).toBe(true);
      expect(hasKey(`ww1936.decision_desc.${d.id}`), d.id).toBe(true);
    }
    for (const s of IMJIN_JPW_SPIRITS) {
      expect(hasKey(`ww1936.spirit.${s.id}`), s.id).toBe(true);
      expect(hasKey(`ww1936.spirit_desc.${s.id}`), s.id).toBe(true);
    }
  });

  it("names its people, with a source and no 1936 dates", () => {
    expect(IMJIN_JPW_PERSONS.length).toBeGreaterThanOrEqual(35);
    const ids = new Set<string>();
    for (const p of IMJIN_JPW_PERSONS) {
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      expect(hasKey(p.nameKey), p.nameKey).toBe(true);
      expect(p.source.length, p.id).toBeGreaterThan(0);
      expect(p.from ?? p.until, p.id).toBeUndefined();
      // merge 3: the registry's row adds the real dates (PersonDates).
      expect(reg.personIdx.get(p.id), p.id).toMatchObject(p);
    }
  });
});
