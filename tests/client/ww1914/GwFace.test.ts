import type { GwTableView } from "@openfront/engine-api/ww1914/GwTable";
import type { GwSeatView } from "@openfront/engine-api/ww1914/GwView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import type { GwCtx, Transcript } from "../../../src/client/hud/ww1914/GwCtx";
import { loadGwFaces } from "../../../src/client/hud/ww1914/GwFace";
import { envoyPerson } from "../../../src/client/hud/ww1914/GwTableModel";
import { talkView } from "../../../src/client/hud/ww1914/GwTalk";

const pack = {
  people: { deu_bethmann: { name: "베트만홀베크", lean: "", bio: "" } },
};
const seat = {
  tag: "DEU",
  people: [{ id: "deu_jagow", office: "foreign", trust: 0 }],
} as unknown as GwSeatView;

const transcript: Transcript = {
  uid: 1,
  who: "deu_bethmann",
  scene: "s",
  cast: {},
  turns: [],
  node: null,
  closed: false,
  logAt: 0,
  reasons: [],
};

function plate(faces?: ReadonlySet<string>): HTMLElement {
  const c = {
    data: { date: "1914-07-05" },
    seat,
    pack,
    faces,
    ui: {},
    redraw: () => {},
  } as unknown as GwCtx;
  const box = document.createElement("div");
  render(talkView(c, transcript, undefined), box);
  return box.querySelector("header")!;
}

describe("faces", () => {
  test("someone with a photograph sits in the circle as a photograph", () => {
    const head = plate(new Set(["deu_bethmann"]));
    const img = head.querySelector<HTMLImageElement>("img[data-gw-face]");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toContain(
      "ww1914/faces/deu_bethmann.webp",
    );
    expect(img!.className).toContain("rounded-full");
    expect(img!.getAttribute("loading")).toBe("lazy");
  });

  test("without one, or before the index came, the initial stays", () => {
    for (const faces of [undefined, new Set<string>(), new Set(["x"])]) {
      const head = plate(faces);
      expect(head.querySelector("img")).toBeNull();
      expect(head.querySelector("[aria-hidden]")!.textContent!.trim()).toBe(
        "베",
      );
    }
  });

  test("the index gives ids; a missing index gives none", async () => {
    const ok = await loadGwFaces(async () => ({
      faces: [{ id: "deu_bethmann" }, { id: "rus_sazonov" }],
    }));
    expect([...ok]).toEqual(["deu_bethmann", "rus_sazonov"]);
    const none = await loadGwFaces(async () => {
      throw new Error("404");
    });
    expect(none.size).toBe(0);
  });

  test("the peace table's speaker is a person, the small chair nobody", () => {
    const t = (losers: string[]) => ({ losers }) as unknown as GwTableView;
    expect(envoyPerson("FRA", t(["DEU"]), seat)).toBe("fra_clemenceau");
    expect(envoyPerson("JPN", t([]), seat)).toBe("jpn_saionji");
    expect(envoyPerson("DEU", t(["DEU"]), { ...seat, tag: "GBR" })).toBe(
      "deu_brockdorff",
    );
    expect(envoyPerson("DEU", t(["AUH"]), { ...seat, tag: "GBR" })).toBe(
      "deu_kuhlmann",
    );
    // The seat's own chair is its foreign minister.
    expect(envoyPerson("DEU", t(["DEU"]), seat)).toBe("deu_jagow");
    expect(envoyPerson("SRB", t([]), seat)).toBeNull();
  });
});
