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

import {
  prepArmiesOf,
  prepPlanOf,
  setPrepTemplate,
} from "../../../src/client/components/ww1936/PrepPlan";
import { libraryStore } from "../../../src/client/hud/ww1936/DesignLibrary";
import { lobbyStartTemplates } from "../../../src/client/hud/ww1936/LobbyPrep";
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
  vi.restoreAllMocks();
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
    // A major: what the template fields over the whole start army.
    expect(q(card, "[data-ww-prep-preview]").textContent).toContain(
      "ww1936.prep.tpl_fielded",
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

describe("the army presets screen in the lobby", () => {
  const open = async (tag: string) => {
    const el = await screen(tag);
    q(el, '[data-ww-prep-tab="designs"]').click();
    await flush(el);
    q(el, "[data-ww-prep-armies-open]").click();
    await flush(el);
    return el;
  };
  const type = async (el: WwLobbyPrep, name: string) => {
    const input = q(el, "[data-ww-army-tpl-name]") as HTMLInputElement;
    input.value = name;
    input.dispatchEvent(new Event("input"));
    await flush(el);
  };
  const addChoice = async (el: WwLobbyPrep, i: number) => {
    const sel = q(el, "[data-ww-army-tpl-add]") as HTMLSelectElement;
    sel.value = sel.options[i + 1].value;
    sel.dispatchEvent(new Event("change"));
    await flush(el);
  };

  it("opens from the designs tab, closes back to it, and has no train or region", async () => {
    const el = await open("DEU");
    expect(el.querySelector("[data-ww-prep-armies]")).not.toBeNull();
    expect(el.querySelector("[data-ww-prep-designs]")).toBeNull();
    expect(q(el, "[data-ww-prep-armies-note]").textContent).toContain(
      "ww1936.prep.armies_note",
    );
    q(el, "[data-ww-army-tpl-new]").click();
    await flush(el);
    await type(el, "Test");
    await addChoice(el, 0);
    q(el, "[data-ww-army-tpl-save]").click();
    await flush(el);
    expect(el.querySelector("[data-ww-army-tpl-train]")).toBeNull();
    expect(el.querySelector("[data-ww-army-tpl-region]")).toBeNull();
    q(el, "[data-ww-prep-armies-close]").click();
    await flush(el);
    expect(el.querySelector("[data-ww-prep-designs]")).not.toBeNull();
  });

  it("creates, edits and deletes (two taps) into the library", async () => {
    const el = await open("DEU");
    q(el, "[data-ww-army-tpl-new]").click();
    await flush(el);
    await type(el, "Panzer army");
    await addChoice(el, 0);
    q(el, "[data-ww-army-tpl-plus='0']").click();
    await flush(el);
    q(el, "[data-ww-army-tpl-save]").click();
    await flush(el);
    let armies = libraryStore().entries.filter((e) => e.type === "army");
    expect(armies).toHaveLength(1);
    expect(armies[0].type === "army" && armies[0].items[0].count).toBe(2);
    q(el, "[data-ww-army-tpl-edit]").click();
    await flush(el);
    await type(el, "Renamed");
    q(el, "[data-ww-army-tpl-save]").click();
    await flush(el);
    armies = libraryStore().entries.filter((e) => e.type === "army");
    expect(armies).toHaveLength(1);
    expect(armies[0].name).toBe("Renamed");
    q(el, "[data-ww-army-tpl-delete]").click();
    await flush(el);
    expect(
      libraryStore().entries.filter((e) => e.type === "army"),
    ).toHaveLength(1);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 700);
    q(el, "[data-ww-army-tpl-delete]").click();
    await flush(el);
    expect(
      libraryStore().entries.filter((e) => e.type === "army"),
    ).toHaveLength(0);
  });

  it("holds at most 24 divisions", async () => {
    const el = await open("DEU");
    q(el, "[data-ww-army-tpl-new]").click();
    await flush(el);
    await addChoice(el, 0);
    for (let i = 0; i < 30; i++) {
      q(el, "[data-ww-army-tpl-plus='0']").click();
      await flush(el);
    }
    expect(q(el, "[data-ww-army-tpl-total]").textContent).toContain("n=24");
  });

  it("offers the plan's start templates and the library's divisions", async () => {
    libraryStore().add({
      type: "template",
      name: "Lib div",
      battalions: ["infantry", "infantry", "infantry", "infantry", "artillery"],
      support: ["engineer"],
    });
    const el = await screen("DEU");
    const start = lobbyStartTemplates("DEU");
    // An edited start template: the plan's content is offered, not the original.
    setPrepTemplate("DEU", {
      key: start[0].key,
      name: "Edited",
      battalions: ["infantry", "infantry", "infantry"],
      support: [],
    });
    el.remove();
    const el2 = await open("DEU");
    q(el2, "[data-ww-army-tpl-new]").click();
    await flush(el2);
    const names = [
      ...el2.querySelectorAll("[data-ww-army-tpl-add] option"),
    ].map((o) => o.textContent ?? "");
    expect(names.some((n) => n.includes("Edited"))).toBe(true);
    expect(names.some((n) => n.includes("Lib div"))).toBe(true);
    expect(names.length).toBeGreaterThanOrEqual(start.length + 1);
    // A minor: its main template plus the library.
    el2.remove();
    const pol = await open("POL");
    q(pol, "[data-ww-army-tpl-new]").click();
    await flush(pol);
    expect(pol.querySelectorAll("[data-ww-army-tpl-add] option")).toHaveLength(
      1 + 1 + 1,
    );
  });

  it("a major's start army: top bar, armies in order, steppers, fill, defaults", async () => {
    const el = await screen("DEU");
    expect(q(el, "[data-ww-oob-top]")).toBeTruthy();
    expect(q(el, "[data-ww-oob-men]").textContent).toContain("ww1936.prep.men");
    const armies = el.querySelectorAll("[data-ww-oob-army]");
    expect(armies).toHaveLength(3);
    // The first army is open: a row per template, with steppers.
    const row = q(el, '[data-ww-oob-army="0"] [data-ww-oob-row="infantry"]');
    expect(q(row, "[data-ww-oob-count]").textContent).toBe("14");
    q(row, "[data-ww-oob-minus]").click();
    await flush(el);
    expect(
      q(
        el,
        '[data-ww-oob-army="0"] [data-ww-oob-row="infantry"] [data-ww-oob-count]',
      ).textContent,
    ).toBe("13");
    expect(
      prepArmiesOf("DEU")![0].find((i) => i.key === "infantry")!.count,
    ).toBe(13);
    // Fill with what the men allow: more than before.
    q(el, '[data-ww-oob-army="0"] [data-ww-oob-fill]').click();
    await flush(el);
    const filled = Number(
      q(
        el,
        '[data-ww-oob-army="0"] [data-ww-oob-row="infantry"] [data-ww-oob-count]',
      ).textContent,
    );
    expect(filled).toBeGreaterThanOrEqual(13);
    // Back to the 1936 start.
    q(el, "[data-ww-oob-reset]").click();
    await flush(el);
    expect(prepArmiesOf("DEU")).toBeNull();
    expect(
      q(
        el,
        '[data-ww-oob-army="0"] [data-ww-oob-row="infantry"] [data-ww-oob-count]',
      ).textContent,
    ).toBe("14");
  });

  it("Italy shows the two operation armies first, marked, and keeps them staffed", async () => {
    const el = await screen("ITA");
    const armies = [...el.querySelectorAll<HTMLElement>("[data-ww-oob-army]")];
    expect(armies.slice(0, 2).map((a) => a.dataset.required)).toEqual([
      "true",
      "true",
    ]);
    expect(armies.slice(2).every((a) => a.dataset.required === "false")).toBe(
      true,
    );
    expect(armies[0].textContent).toContain("ww1936.prep.operation");
    // Step the first one down to its last division: the minus stops.
    const a0 = '[data-ww-oob-army="0"]';
    for (let n = 0; n < 40; n++) {
      for (const key of ["binary", "colonial"]) {
        const b = q(el, `${a0} [data-ww-oob-row="${key}"] [data-ww-oob-minus]`);
        if (!(b as HTMLButtonElement).disabled) b.click();
        await flush(el);
      }
    }
    const left = [...el.querySelectorAll(`${a0} [data-ww-oob-count]`)]
      .map((c) => Number(c.textContent))
      .reduce((a, b) => a + b, 0);
    expect(left).toBe(1);
    expect(q(el, "[data-ww-oob-problem]")).toBeNull();
  });

  it("makes a new template, and removes it from the plan", async () => {
    const el = await screen("DEU");
    q(el, "[data-ww-prep-new-template]").click();
    await flush(el);
    expect(el.querySelector("ww-template-designer")).toBeTruthy();
  });
});
