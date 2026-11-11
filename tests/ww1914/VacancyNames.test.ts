// ww179: an office left empty must have a name to offer in the people tab's
// vacancy box. The box showed ministries and embassies with nobody to pick, and
// at a chapter's close nobody stepped in: the office stayed empty for good.
import { GW_SEAT_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { standingOffices } from "@openfront/engine/ww1914/People";
import { describe, expect, test } from "vitest";

describe("every office of a seat has someone to fill it", () => {
  test.each(GW_SEAT_TAGS)("%s", (tag) => {
    const people = gwContent().people.filter((d) => d.tag === tag);
    const offices = standingOffices(tag);
    expect(offices.length).toBeGreaterThan(0);
    for (const o of offices) {
      const holder = people.find((d) => d.office === o);
      const names = people.filter((d) => d !== holder && d.fit.includes(o));
      expect(
        names.map((d) => d.id),
        `${tag} ${o}`,
      ).not.toHaveLength(0);
    }
  });
});
