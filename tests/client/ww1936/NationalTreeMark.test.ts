// ww234: the 1936 country picker marks the minors that play their own
// national tree (engine-lib's live nations); majors and generic-tree
// countries get no mark.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => key,
}));

import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { NATIONS } from "@openfront/engine-lib/ww1936/content/nations/index";
import { liveNationTags } from "@openfront/engine-lib/ww1936/content/nations/live";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import "../../../src/client/components/ww1936/CountryPicker";
import type { CountryPicker } from "../../../src/client/components/ww1936/CountryPicker";
import { nationalTreeTags } from "../../../src/client/components/ww1936/NationalTrees";

describe("ww234 national-tree mark", () => {
  it("the live nations are exactly the minors whose content row plays their own tree", () => {
    const live = new Set(liveNationTags());
    expect(live.has("POL")).toBe(true);
    expect(live.has("AFG")).toBe(false);
    for (const n of NATIONS) {
      const row = CONTENT.countries.find((c) => c.tag === n.tag);
      expect(row?.tree === n.tag, n.tag).toBe(live.has(n.tag as CountryTag));
    }
  });

  it("marks a live national-tree country, not a major or a generic-tree one", async () => {
    const tags = await nationalTreeTags();
    for (const t of tags) expect(COUNTRIES[t].major, t).toBe(false);
    const el = document.createElement("ww-country-picker") as CountryPicker;
    document.body.appendChild(el);
    await nationalTreeTags();
    await el.updateComplete;
    const marked = (tag: string) =>
      el.querySelector(`[data-tag="${tag}"] [data-ww-tree-mark]`) !== null;
    expect(el.querySelector(`[data-tag="POL"]`)).not.toBeNull();
    expect(marked("POL")).toBe(true);
    expect(marked("DEU")).toBe(false);
    expect(el.querySelector(`[data-tag="AFG"]`)).not.toBeNull();
    expect(marked("AFG")).toBe(false);
    expect(el.querySelector("[data-ww-tree-legend]")).not.toBeNull();
    el.remove();
  });
});
