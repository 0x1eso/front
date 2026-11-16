import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwTokenView } from "@openfront/engine-api/ww1914/GwTokens";
import { ARMY_RAIL } from "@openfront/engine-api/ww1936/LandTypes";
import { render } from "lit";
import { describe, expect, test, vi } from "vitest";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import {
  gwTokenKey,
  gwTokenRows,
  GwTokenSource,
  hitGwToken,
  placeGwTokens,
} from "../../../src/client/hud/ww1914/GwTokenModel";
import { tokenSheet } from "../../../src/client/hud/ww1914/GwTokenSheet";
import {
  KIND_CHIP,
  KIND_DOT,
  KIND_TOKEN,
} from "../../../src/client/render/gl/passes/ArmyTokenPass";

vi.mock("../../../src/client/Utils", async (importOriginal) => {
  const { readFileSync } = await import("node:fs");
  const file = `${process.cwd()}/resources/lang/ko.json`;
  const ko = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const lookup = (key: string) =>
    key
      .split(".")
      .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ko);
  return {
    ...(await importOriginal<object>()),
    translateText: (key: string, params: Record<string, unknown> = {}) => {
      const text = lookup(key);
      if (typeof text !== "string") return key;
      return text.replace(/\{(\w+)\}/g, (hole, k) =>
        params[k] === undefined ? hole : String(params[k]),
      );
    },
  };
});

/** Lane T's fixture (ww218-format.md), with a British token and the reserve. */
const GW_TOKEN_FIXTURE: readonly GwTokenView[] = [
  {
    kind: "front",
    tag: "DEU",
    rel: "own",
    theatre: "west",
    side: "central",
    at: [2040, 660],
    divs: 68,
    lo: 68,
    hi: 68,
    sure: 3,
    seen: "own",
    fill: 88,
    order: 70,
    moves: [
      { to: "east", eta: 1, open: true, why: null },
      { to: "balkan", eta: 3, open: false, why: "no_front" },
    ],
  },
  {
    kind: "front",
    tag: "FRA",
    rel: "foe",
    theatre: "west",
    side: "entente",
    at: [2010, 672],
    divs: 48,
    lo: 40,
    hi: 55,
    sure: 2,
    seen: "air",
    fill: null,
    order: null,
  },
  {
    kind: "front",
    tag: "GBR",
    rel: "foe",
    theatre: "west",
    side: "entente",
    at: [2010, 672],
    divs: 14,
    lo: 10,
    hi: 18,
    sure: 1,
    seen: "contact",
    fill: null,
    order: null,
  },
  {
    kind: "moving",
    tag: "DEU",
    rel: "own",
    theatre: "west",
    side: null,
    at: [2150, 640],
    divs: 14,
    lo: 14,
    hi: 14,
    sure: 3,
    seen: "own",
    fill: 100,
    order: null,
    to: "east",
    eta: 1,
  },
  {
    kind: "reserve",
    tag: "DEU",
    rel: "own",
    theatre: null,
    side: null,
    at: [2148, 630],
    divs: 12,
    lo: 12,
    hi: 12,
    sure: 3,
    seen: "own",
    fill: 100,
    order: null,
    eta: 1,
    moves: [
      { to: "west", eta: 1, open: true, why: null },
      { to: "east", eta: 1, open: true, why: null },
    ],
  },
];

const OWNERS: Record<string, number> = { DEU: 3, FRA: 5, GBR: 6 };
const ownerOf = (tag: string) => OWNERS[tag] ?? null;
const tok = (kind: string, tag: string) =>
  GW_TOKEN_FIXTURE.find((t) => t.kind === kind && t.tag === tag)!;

describe("ww218 §5: army tokens from the seat's view", () => {
  test("rows: ours exact, foes the top of the range with ~ and grey bars", () => {
    const placed = placeGwTokens(GW_TOKEN_FIXTURE, 4);
    const rows = gwTokenRows(placed, 4, ownerOf, null);
    expect(rows).toHaveLength(GW_TOKEN_FIXTURE.length);
    const at = (tag: string, kind = "front") =>
      rows[placed.findIndex((p) => p.token === tok(kind, tag))];
    const deu = at("DEU");
    expect(deu).toMatchObject({
      kind: KIND_TOKEN,
      owner: 3,
      shown: 68,
      approx: false,
      gray: false,
      orgGray: false,
      strengthPm: 880,
      orgPm: 700,
    });
    const fra = at("FRA");
    expect(fra).toMatchObject({ shown: 55, approx: true, gray: true });
    expect(fra.strengthPm).toBe(0);
    // A moving band carries the rail badge; no order bar of its own.
    expect(at("DEU", "moving")).toMatchObject({
      state: ARMY_RAIL,
      orgGray: true,
    });
    // Nothing known: "?".
    const blind: GwTokenView = { ...tok("front", "FRA"), divs: null, sure: 0 };
    const [q] = gwTokenRows(placeGwTokens([blind], 4), 4, ownerOf, null);
    expect(q).toMatchObject({ shown: -1, approx: false });
    // LOD as 1936: chips from 1.5, dots below.
    expect(gwTokenRows(placed, 2, ownerOf, null)[0].kind).toBe(KIND_CHIP);
    expect(gwTokenRows(placed, 1, ownerOf, null)[0].kind).toBe(KIND_DOT);
  });

  test("tokens on one anchor fan out; a tap within 24 px takes the nearest", () => {
    const zoom = 4;
    const placed = placeGwTokens(GW_TOKEN_FIXTURE, zoom);
    const fra = placed.find((p) => p.token.tag === "FRA")!;
    const gbr = placed.find((p) => p.token.tag === "GBR")!;
    expect(fra.x).toBe(gbr.x);
    expect(Math.abs(fra.y - gbr.y) * zoom).toBeGreaterThanOrEqual(32);
    const hit = hitGwToken(placed, gbr.x + 0.5, gbr.y + 0.5, 24 / zoom);
    expect(hit?.key).toBe(gwTokenKey(gbr.token));
    expect(hitGwToken(placed, 0, 0, 24 / zoom)).toBeNull();
    // The source hands the renderer the same rows until something changes.
    const ui = { chosen: null as string | null };
    const src = new GwTokenSource(
      () => ({ tokens: GW_TOKEN_FIXTURE, chosen: ui.chosen }),
      ownerOf,
    );
    const a = src.rows(zoom);
    expect(src.rows(zoom)).toBe(a);
    ui.chosen = gwTokenKey(tok("front", "DEU"));
    expect(src.rows(zoom).some((r) => r.chosen)).toBe(true);
  });

  test("the card: both ends of the front in words, and the move order", () => {
    const sent: GwOrder[] = [];
    const ui = { token: null, tokenMove: false } as unknown as GwUi;
    const c = {
      seat: {
        tag: "DEU",
        world: { fronts: [{ id: "west", line: "somme" }] },
      },
      ui,
      send: (o: GwOrder) => sent.push(o),
      redraw: () => draw(),
    } as unknown as GwCtx;
    const root = document.createElement("div");
    const key = gwTokenKey(tok("front", "DEU"));
    const draw = () => render(tokenSheet(c, GW_TOKEN_FIXTURE, key), root);
    draw();
    const text = root.textContent ?? "";
    expect(text).toContain("서부 전선 · 솜강");
    expect(text).toContain("68개 사단");
    expect(text).toContain("40~55개 사단");
    expect(text).toContain("꽤 믿을 만하다 (항공 정찰)");
    expect(text).not.toContain("gw.token");
    root.querySelector<HTMLButtonElement>("[data-gw-token-ask]")!.click();
    const closed = root.querySelector<HTMLButtonElement>(
      '[data-gw-token-move="balkan"]',
    )!;
    expect(closed.disabled).toBe(true);
    root
      .querySelector<HTMLButtonElement>('[data-gw-token-move="east"]')!
      .click();
    expect(sent).toEqual([{ kind: "move_band", from: "west", to: "east" }]);
    expect(root.querySelector("[data-gw-token-asked]")).not.toBeNull();
    expect(root.querySelector("[data-gw-token-ask]")).toBeNull();
  });
});
