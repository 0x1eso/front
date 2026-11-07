import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GreatWarData,
  GwActView,
  GwCardView,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwFrontView } from "@openfront/engine-api/ww1914/GwWorldView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import type { GwCtx, GwSpot, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import {
  deskPinLayer,
  placeSheet,
} from "../../../src/client/hud/ww1914/GwPlaceSheet";

const envoy: GwActView = {
  id: "deu_a_envoy",
  kind: "order",
  tell: [],
  fields: [
    {
      id: "envoy",
      options: [],
      tones: [],
      people: ["deu_jagow"],
      count: 1,
    },
    {
      id: "where",
      options: ["rome", "stamboul"],
      tones: [],
      people: [],
      count: 1,
    },
  ],
};
const west = {
  id: "west",
  line: "somme",
  lineIndex: 3,
  commander: "deu_heir",
  last: null,
} as unknown as GwFrontView;
const paper = {
  uid: 7,
  scene: "s",
  kind: "report",
  place: "verdun",
  options: [],
  cast: {},
} as unknown as GwCardView;

function ctx(spot: GwSpot, holder: string, o: Partial<GwSeatView> = {}) {
  const sent: GwOrder[] = [];
  const flown: string[] = [];
  const root = document.createElement("div");
  const ui = {
    spot,
    actOpen: null,
    actPicks: {},
    postOpen: null,
    postArmed: null,
    notes: [],
    readerUid: null,
    talkUid: null,
  } as unknown as GwUi;
  const c = {
    data: { date: "1915-03-01", chapter: 9, landMoves: [] },
    seat: {
      tag: "DEU",
      desk: [],
      theatres: [],
      acts: [envoy],
      actsLeft: 2,
      world: {
        side: "central",
        countries: [{ tag: "ITA", side: null, out: false, mob: 0 }],
        fronts: [west],
        generals: ["deu_heir", "deu_mackensen"],
      },
      ...o,
    },
    pack: null,
    ui,
    map: {
      fly: (p: string) => flown.push(p),
      ring: () => undefined,
      spotOfPlace: () => spot,
      holderAt: () => holder,
    },
    tick: 0,
    send: (x: GwOrder) => sent.push(x),
    redraw: () => render(placeSheet(c, c.ui.spot ?? spot), root),
    card: () => undefined,
  } as unknown as GwCtx & { data: GreatWarData };
  c.redraw();
  return { c, sent, flown, root };
}

const tap = (root: HTMLElement, sel: string) =>
  (root.querySelector(sel) as HTMLButtonElement).click();
const rome: GwSpot = { region: 576, tile: 1, place: "rome", name: "로마" };
const verdun: GwSpot = {
  region: 2031,
  tile: 2,
  place: "verdun",
  name: "베르됭",
};

describe("a place tapped on the map", () => {
  test("an envoy starts here, with the place already filled in", () => {
    const { root, sent } = ctx(rome, "ITA");
    expect(root.querySelector("[data-gw-post]")).toBeNull();
    tap(root, '[data-gw-act-open="deu_a_envoy"]');
    tap(root, '[data-gw-act-pick="deu_jagow"]');
    tap(root, "[data-gw-act-go]");
    expect(sent).toEqual([
      { kind: "act", act: "deu_a_envoy", picks: ["deu_jagow", "rome"] },
    ]);
  });

  test("a general goes to the place's front, and not the one already there", () => {
    const { root, sent, c } = ctx(verdun, "FRA");
    tap(root, "[data-gw-post-open]");
    expect(root.querySelector('[data-gw-post-pick="deu_heir"]')).toBeNull();
    tap(root, '[data-gw-post-pick="deu_mackensen"]');
    expect(sent).toEqual([]);
    tap(root, "[data-gw-post-go]");
    expect(sent).toEqual([
      { kind: "post", person: "deu_mackensen", theatre: "west" },
    ]);
    expect(c.ui.notes.length).toBe(1);
  });

  test("with no slot left the general stays home", () => {
    const { root } = ctx(verdun, "FRA", { actsLeft: 0 });
    const b = root.querySelector("[data-gw-post-open]") as HTMLButtonElement;
    expect(b.disabled).toBe(true);
  });

  test("a place with nothing to start says so", () => {
    const { root } = ctx(
      { region: 1, tile: 3, place: null, name: "그린란드" },
      "DNK",
      { acts: [] },
    );
    expect(root.querySelector("[data-gw-spot-none]")).not.toBeNull();
  });

  test("land held by another shows whose it was", () => {
    const { root } = ctx(verdun, "DEU");
    expect(root.querySelector("[data-gw-held]")).not.toBeNull();
  });

  test("the papers from here open from the sheet", () => {
    const { root, c, flown } = ctx(verdun, "FRA", { desk: [paper] });
    tap(root, '[data-gw-spot-card="7"]');
    expect(c.ui.readerUid).toBe(7);
    expect(c.ui.spot).toBeNull();
    expect(flown).toEqual(["verdun"]);
  });
});

describe("pins", () => {
  test("one paper opens itself, two open the place", () => {
    const one = ctx(verdun, "FRA", { desk: [paper] });
    const box = document.createElement("div");
    render(deskPinLayer(one.c), box);
    tap(box, '[data-gw-pin="verdun"]');
    expect(one.c.ui.readerUid).toBe(7);

    const two = ctx(verdun, "FRA", { desk: [paper, { ...paper, uid: 8 }] });
    two.c.ui.spot = null;
    render(deskPinLayer(two.c), box);
    tap(box, '[data-gw-pin="verdun"]');
    expect(two.c.ui.readerUid).toBeNull();
    expect(two.c.ui.spot).toBe(verdun);
  });
});
