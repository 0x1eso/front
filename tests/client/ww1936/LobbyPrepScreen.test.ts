import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { prepPlanOf } from "../../../src/client/components/ww1936/PrepPlan";
import { libraryStore } from "../../../src/client/hud/ww1936/DesignLibrary";
import "../../../src/client/hud/ww1936/WwLobbyPrep";
import type { WwLobbyPrep } from "../../../src/client/hud/ww1936/WwLobbyPrep";

async function screen(tag: string): Promise<WwLobbyPrep> {
  const el = document.createElement("ww-lobby-prep") as WwLobbyPrep;
  el.tag = tag as never;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: ParentNode, sel: string) => el.querySelector<HTMLElement>(sel)!;
const flush = async (el: WwLobbyPrep) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

beforeEach(() => {
  localStorage.clear();
  libraryStore().reload();
});
afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("the lobby preparation screen", () => {
  it("lists the country's start templates and the draft note on the designs tab", async () => {
    const el = await screen("DEU");
    expect(
      el.querySelectorAll("[data-ww-prep-tpl]").length,
    ).toBeGreaterThanOrEqual(4);
    q(el, '[data-ww-prep-tab="designs"]').click();
    await flush(el);
    expect(q(el, "[data-ww-prep-draft-note]").textContent).toContain(
      "ww1936.prep.draft_note",
    );
  });

  it("a minor gets its main template only, with a note", async () => {
    const el = await screen("POL");
    expect(el.querySelectorAll("[data-ww-prep-tpl]")).toHaveLength(1);
    expect(el.textContent).toContain("ww1936.prep.minor_note");
  });

  it("overwrites a start template from a library division and shows the preview", async () => {
    libraryStore().add({
      type: "template",
      name: "Lib div",
      battalions: ["infantry", "infantry", "infantry", "infantry", "artillery"],
      support: ["engineer"],
    });
    // A division with a part the country never researched is not offered.
    libraryStore().add({
      type: "template",
      name: "Too new",
      battalions: ["sp_anti_air"],
      support: [],
    });
    const el = await screen("DEU");
    q(el, '[data-ww-prep-tpl="infantry"] [data-ww-prep-from-library]').click();
    await flush(el);
    const offered = el.querySelectorAll("[data-ww-prep-take]");
    expect(offered).toHaveLength(1);
    (offered[0] as HTMLElement).click();
    await flush(el);
    const card = q(el, '[data-ww-prep-tpl="infantry"]');
    expect(card.dataset.edited).toBe("true");
    expect(q(card, "[data-ww-prep-preview]").textContent).toContain(
      "ww1936.prep.preview",
    );
    expect(q(card, "[data-ww-prep-preview]").textContent).toContain(
      "ww1936.prep.approximate",
    );
    expect(prepPlanOf("DEU")).toHaveLength(1);
    expect(prepPlanOf("DEU")[0].name).toBe("Lib div");
    q(card, "[data-ww-prep-reset]").click();
    await flush(el);
    expect(prepPlanOf("DEU")).toEqual([]);
  });

  it("edits a start template with the template designer and keeps the edit", async () => {
    const el = await screen("DEU");
    q(el, '[data-ww-prep-tpl="infantry"] [data-ww-prep-edit]').click();
    await flush(el);
    const d = q(el, "ww-template-designer");
    await (d as any).updateComplete;
    // The next empty cell opens the picker; pick another infantry battalion.
    const empty = q(
      d,
      '[data-ww-slot-kind="battalion"][aria-label="[ww1936.land.slot_empty]"]',
    );
    const count = Number(empty.dataset.wwSlot);
    empty.click();
    await (d as any).updateComplete;
    q(d, '[data-ww-pick="infantry"]').click();
    await (d as any).updateComplete;
    // No copy or delete: these templates are not a game's.
    expect(d.querySelector("[data-ww-designer-copy]")).toBeNull();
    expect(d.querySelector("[data-ww-designer-delete]")).toBeNull();
    q(d, "[data-ww-designer-save]").click();
    await flush(el);
    expect(el.querySelector("ww-template-designer")).toBeNull();
    const plan = prepPlanOf("DEU");
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe("infantry");
    expect(plan[0].battalions.length).toBe(count + 1);
  });

  it("a new division goes to the library, not to the plan", async () => {
    const el = await screen("DEU");
    q(el, '[data-ww-prep-tab="designs"]').click();
    await flush(el);
    q(el, "[data-ww-prep-division]").click();
    await flush(el);
    const d = q(el, "ww-template-designer");
    await (d as any).updateComplete;
    q(d, '[data-ww-slot-kind="battalion"][data-ww-slot="0"]').click();
    await (d as any).updateComplete;
    q(d, '[data-ww-pick="infantry"]').click();
    await (d as any).updateComplete;
    q(d, "[data-ww-designer-name]").click();
    await (d as any).updateComplete;
    const input = q(d, "[data-ww-designer-name-input]") as HTMLInputElement;
    input.value = "My div";
    input.dispatchEvent(new Event("input"));
    await (d as any).updateComplete;
    q(d, "[data-ww-designer-save]").click();
    await flush(el);
    expect(
      libraryStore().entries.some(
        (e) => e.type === "template" && e.name === "My div",
      ),
    ).toBe(true);
    expect(prepPlanOf("DEU")).toEqual([]);
  });

  it("opens the designer as a draft: no game list, no draft switch, no game save", async () => {
    const el = await screen("DEU");
    q(el, '[data-ww-prep-tab="designs"]').click();
    await flush(el);
    q(el, '[data-ww-prep-design="tank"]').click();
    await flush(el);
    const drawer = q(el, '[data-ww-drawer="designer"]');
    expect(drawer).not.toBeNull();
    expect(drawer.querySelector("[data-ww-design-tab-list]")).toBeNull();
    expect(drawer.querySelector("[data-ww-draft-toggle]")).toBeNull();
    expect(drawer.querySelector("[data-ww-design-save]")).toBeNull();
    expect(drawer.querySelector("[data-ww-lib-save]")).not.toBeNull();
  });

  it("the library cards edit instead of load", async () => {
    libraryStore().add({
      type: "design",
      def: {
        kind: "ship",
        base: "destroyer_1",
        modules: [],
        name: "Boat",
      },
    });
    libraryStore().add({
      type: "template",
      name: "Lib div",
      battalions: ["infantry"],
      support: [],
    });
    const el = await screen("DEU");
    q(el, '[data-ww-prep-tab="designs"]').click();
    await flush(el);
    q(el, "[data-ww-prep-library]").click();
    await flush(el);
    expect(el.querySelector("[data-ww-lib-load]")).toBeNull();
    const edits = el.querySelectorAll("[data-ww-lib-edit]");
    expect(edits.length).toBe(2);
  });

  it("closes", async () => {
    const el = await screen("DEU");
    q(el, "[data-ww-prep-close]").click();
    expect(document.querySelector("ww-lobby-prep")).toBeNull();
  });
});
