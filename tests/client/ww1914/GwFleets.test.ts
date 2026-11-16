import type { GwFleetTokenView } from "@openfront/engine-api/ww1914/GwFleets";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import { render } from "lit";
import { describe, expect, test, vi } from "vitest";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import {
  gwFleetKey,
  gwFleetRows,
  GwFleetSource,
  hitGwFleet,
  placeGwFleets,
} from "../../../src/client/hud/ww1914/GwFleetModel";
import { fleetSheet } from "../../../src/client/hud/ww1914/GwTokenSheet";
import {
  directFleetFlags,
  KIND_CHIP,
  KIND_TOKEN,
  SHIP_CELL,
  TOKEN_APPROX,
  TOKEN_DOCKED,
  TOKEN_UNKNOWN,
} from "../../../src/client/render/gl/passes/FleetTokenPass";

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

/** Lane F's fixture (ww221-format.md), as Britain sees the North Sea. */
const GBR_VIEW: readonly GwFleetTokenView[] = [
  {
    id: "gbr_battle_north",
    tag: "GBR",
    rel: "own",
    kind: "battle",
    area: "north",
    at: [2015, 585],
    port: false,
    homePort: "scapa_flow",
    ships: 22,
    lo: 22,
    hi: 22,
    sure: 3,
    seen: "own",
    fill: 88,
    mission: "patrol",
    fought: false,
    repair: false,
    moves: [
      { to: "channel", eta: 1, open: true, why: null },
      { to: "med", eta: 2, open: true, why: null },
      { to: "baltic", eta: 1, open: false, why: "sea_shut" },
    ],
    sortie: { open: true, why: null },
  },
  {
    id: "deu_battle_north",
    tag: "DEU",
    rel: "foe",
    kind: "battle",
    area: "north",
    at: [2109, 605],
    port: true,
    homePort: "hamburg",
    ships: 17,
    lo: 13,
    hi: 21,
    sure: 2,
    seen: "last",
    fill: null,
    mission: null,
    fought: false,
    repair: false,
  },
];

/** Germany's own battle fleet on its way to the Baltic. */
const DEU_MOVING: GwFleetTokenView = {
  id: "deu_battle_north",
  tag: "DEU",
  rel: "own",
  kind: "battle",
  area: "north",
  at: [2150, 590],
  port: false,
  homePort: "hamburg",
  ships: 12,
  lo: 12,
  hi: 12,
  sure: 3,
  seen: "own",
  fill: 100,
  mission: "patrol",
  fought: false,
  repair: false,
  to: "baltic",
  eta: 1,
};

const ownerOf = (tag: string) => (tag === "GBR" ? 3 : tag === "DEU" ? 2 : 7);

describe("ww221 §3: fleet tokens from the seat's view", () => {
  test("rows: ours exact, foes ~hi with grey bars, docked in port, ? when unknown", () => {
    const zoom = 4;
    const rows = gwFleetRows(
      placeGwFleets(GBR_VIEW, zoom),
      zoom,
      ownerOf,
      null,
    );
    const gbr = rows.find((r) => r.owner === 3)!;
    expect(gbr).toMatchObject({
      kind: KIND_TOKEN,
      cell: SHIP_CELL.battleship,
      ships: 22,
      hpPm: 880,
      orgPm: -1,
      mission: SHIP_CELL.patrol,
      docked: false,
      approx: false,
      unknown: false,
    });
    const deu = rows.find((r) => r.owner === 2)!;
    expect(deu).toMatchObject({
      ships: 21,
      hpPm: -1,
      mission: -1,
      docked: true,
      approx: true,
    });
    expect(directFleetFlags(deu)).toBe(TOKEN_DOCKED | TOKEN_APPROX);
    // Nothing known: "?" and no "~".
    const blind = { ...GBR_VIEW[1], ships: null, sure: 0 };
    const [q] = gwFleetRows(placeGwFleets([blind], zoom), zoom, ownerOf, null);
    expect(q).toMatchObject({ ships: -1, unknown: true });
    expect(directFleetFlags(q)).toBe(TOKEN_DOCKED | TOKEN_UNKNOWN);
    // LOD as the 1936 fleets: a chip zoomed out. A moving fleet keeps its mission.
    expect(
      gwFleetRows(placeGwFleets(GBR_VIEW, 1), 1, ownerOf, null)[0].kind,
    ).toBe(KIND_CHIP);
    const [mv] = gwFleetRows(
      placeGwFleets([DEU_MOVING], zoom),
      zoom,
      ownerOf,
      null,
    );
    expect(mv).toMatchObject({ ships: 12, approx: false, docked: false });
    // A tap within 24 px takes the nearest; the source keeps its rows.
    const placed = placeGwFleets(GBR_VIEW, zoom);
    const hit = hitGwFleet(placed, 2015.5, 585.5, 24 / zoom);
    expect(hit?.at.key).toBe(gwFleetKey(GBR_VIEW[0]));
    expect(hitGwFleet(placed, 0, 0, 24 / zoom)).toBeNull();
    const src = new GwFleetSource(
      () => ({ fleets: GBR_VIEW, chosen: null }),
      ownerOf,
    );
    expect(src.rows(zoom)).toBe(src.rows(zoom));
  });

  test("the card: both sides of the sea in words, the Admiralty's word, the asks", () => {
    const sent: GwOrder[] = [];
    const ui = { fleet: null, fleetMove: false } as unknown as GwUi;
    const c = {
      seat: {
        tag: "GBR",
        people: [
          { id: "fisher", office: "sea_lord" },
          { id: "churchill", office: "navy" },
        ],
        world: { fronts: [] },
      },
      pack: { people: { fisher: { name: "피셔" } } },
      ui,
      send: (o: GwOrder) => sent.push(o),
      redraw: () => draw(),
    } as unknown as GwCtx;
    const root = document.createElement("div");
    const key = gwFleetKey(GBR_VIEW[0]);
    const draw = () => render(fleetSheet(c, GBR_VIEW, key), root);
    draw();
    const text = root.textContent ?? "";
    expect(text).toContain("북해 · 대함대 (스캐파플로)");
    expect(text).toContain("전함 22척");
    expect(text).toContain("순찰 중");
    expect(text).toContain("대양함대 전함 13~21척");
    expect(text).toContain("함부르크 항구에 있는 것으로 보인다");
    expect(text).toContain("제1해군경 피셔");
    expect(text).toContain("북해를 비우면 봉쇄가 풀립니다.");
    expect(text).not.toContain("gw.fleet");
    root.querySelector<HTMLButtonElement>("[data-gw-fleet-ask]")!.click();
    expect(
      root.querySelector<HTMLButtonElement>('[data-gw-fleet-move="baltic"]')!
        .disabled,
    ).toBe(true);
    expect(root.textContent).toContain("지중해 · 두 달쯤");
    root
      .querySelector<HTMLButtonElement>('[data-gw-fleet-move="med"]')!
      .click();
    expect(sent).toEqual([
      { kind: "move_fleet", fleet: "gbr_battle_north", to: "med" },
    ]);
    expect(root.querySelector("[data-gw-fleet-asked]")).not.toBeNull();
    expect(root.querySelector("[data-gw-fleet-sortie]")).toBeNull();
    // A foe's card has no asks.
    render(fleetSheet(c, GBR_VIEW, gwFleetKey(GBR_VIEW[1])), root);
    expect(root.querySelector("[data-gw-fleet-ask]")).toBeNull();
    expect(root.querySelector("[data-gw-fleet-sortie]")).toBeNull();
  });
});
