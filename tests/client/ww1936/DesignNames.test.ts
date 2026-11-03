// An unnamed design is "@" in the engine; every screen draws the automatic
// name, and an event card's "target" is the country it names.
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { translateText } from "../../../src/client/Utils";
import { depthNoticeParams } from "../../../src/client/hud/ww1936/DepthMiscModel";
import {
  autoNameOf,
  designDisplayName,
  designNameOr,
} from "../../../src/client/hud/ww1936/DesignName";
import { effectLines } from "../../../src/client/hud/ww1936/PoliticsModel";

function flat(o: Record<string, unknown>, p = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") out[p + k] = v;
    else Object.assign(out, flat(v as Record<string, unknown>, `${p}${k}.`));
  }
  return out;
}

const tank = (name: string): DesignDef =>
  ({
    kind: "tank",
    base: "medium_1",
    modules: ["", "", "", "", "", "", ""],
    armorLevel: 0,
    engineLevel: 0,
    name,
  }) as DesignDef;

describe("design names", () => {
  beforeEach(() => {
    const el = document.createElement("lang-selector") as any;
    el.currentLang = "ko";
    el.translations = flat(
      JSON.parse(readFileSync("resources/lang/ko.json", "utf8")),
    );
    el.defaultTranslations = {};
    document.body.appendChild(el);
    (translateText as any).langSelector = null;
  });
  afterEach(() => {
    document.querySelector("lang-selector")?.remove();
    (translateText as any).langSelector = null;
  });

  it("resolves '@' everywhere one resolver is used", () => {
    const auto = designDisplayName(tank("@"));
    expect(auto).toBe(autoNameOf(tank("@")));
    expect(auto).not.toContain("@");
    expect(designDisplayName(tank("My Tiger"))).toBe("My Tiger");
    expect(designNameOr("@x", "fallback")).toBe("fallback");
    expect(designNameOr("Own", "fallback")).toBe("Own");
  });

  it("the saved toast shows the design's automatic name, never '@'", () => {
    const rows = [{ kind: "tank", slot: 3, def: tank("@") }];
    const p = depthNoticeParams(
      "events_display.ww1936_design_saved",
      { name: "@", kind: "tank", slot: 3 },
      rows,
    );
    expect(p.name).toBe(autoNameOf(tank("@")));
    const lost = depthNoticeParams(
      "events_display.ww1936_design_saved",
      { name: "@", kind: "tank", slot: 9 },
      rows,
    );
    expect(lost.name).toBe(translateText("ww1936.design.unnamed"));
    // A licence of an unnamed foreign design names its equipment.
    const lic = depthNoticeParams("events_display.ww1936_licence_granted", {
      design: "@x",
      item: "tank_design",
      gen: 2,
    });
    expect(String(lic.design)).not.toContain("@");
  });

  it("an event option names the country 'target' stands for", () => {
    const fx = [{ kind: "join_war", of: "target" }] as never;
    expect(effectLines(fx, { target: "DEU" })[0].text).toBe(
      `참전 (상대: ${translateText("ww1936.country.DEU")})`,
    );
    expect(effectLines(fx)[0].text).toBe("참전 (상대: 상대국)");
  });
});
