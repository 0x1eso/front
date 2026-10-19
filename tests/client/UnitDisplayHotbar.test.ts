import { CongressData } from "@openfront/engine-api/congress/CongressTypes";
import { BuildableUnit, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import { STRATEGIC_ONLY_UNITS } from "@openfront/engine-lib/strategic/Strategic";
import { WARFARE_ONLY_UNITS } from "@openfront/engine-lib/warfare/Warfare";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { UnitDisplay } from "../../src/client/hud/layers/UnitDisplay";
import { TutorialHighlightEvent } from "../../src/client/hud/Tutorial";
import {
  MouseDownEvent,
  ToggleStructureEvent,
} from "../../src/client/InputHandler";
import { SendProduceNukeIntentEvent } from "../../src/client/Transport";
import type { UIState } from "../../src/client/UIState";
import { EMPTY } from "./CongressFixture";

function buildable(type: UnitType, locked = false): BuildableUnit {
  return {
    type: type as BuildableUnit["type"],
    canBuild: locked ? false : 0,
    canUpgrade: false,
    cost: 100n,
    overlappingRailroads: [],
    ghostRailPaths: [],
    locked,
  };
}

interface Mounted {
  el: UnitDisplay;
  uiState: UIState;
  emitted: unknown[];
  handlers: Map<unknown, (e: unknown) => void>;
}

const DOMESTIC_ONLY = new Set<UnitType>([
  UnitType.ResearchInstitute,
  UnitType.AdminOffice,
]);

async function mount(
  buildables: BuildableUnit[],
  opts: {
    domestic?: boolean;
    warfare?: boolean;
    strategic?: StrategicData;
    ports?: number;
    silos?: number;
    airports?: { busy: boolean }[];
    gold?: bigint;
    factories?: { id: number; level: number }[];
    congress?: CongressData;
  } = {},
): Promise<Mounted> {
  const el = document.createElement("unit-display") as UnitDisplay;
  // Using the class as a value keeps its import (and @customElement) alive.
  expect(el).toBeInstanceOf(UnitDisplay);
  const player = {
    smallID: () => 1,
    buildables: vi.fn(() => Promise.resolve(buildables)),
    totalUnitLevels: () => 0,
    gold: () => opts.gold ?? 1_000_000n,
    strategicData: () => opts.strategic ?? null,
    units: (type: UnitType) => {
      switch (type) {
        case UnitType.Port:
          return Array.from({ length: opts.ports ?? 0 }, () => ({}));
        case UnitType.MissileSilo:
          return Array.from({ length: opts.silos ?? 0 }, () => ({}));
        case UnitType.Airport:
          return (opts.airports ?? []).map((a) => ({
            isActive: () => true,
            isUnderConstruction: () => false,
            isInCooldown: () => a.busy,
          }));
        case UnitType.Factory:
          return (opts.factories ?? []).map((f) => ({
            id: () => f.id,
            level: () => f.level,
            isUnderConstruction: () => false,
          }));
        default:
          return [];
      }
    },
    isAlive: () => true,
  };
  el.game = {
    config: () => ({
      isUnitDisabled: (t: UnitType) =>
        (!opts.domestic && DOMESTIC_ONLY.has(t)) ||
        (!opts.warfare && WARFARE_ONLY_UNITS.has(t)) ||
        (opts.strategic === undefined && STRATEGIC_ONLY_UNITS.has(t)),
    }),
    myPlayer: () => player,
    inSpawnPhase: () => false,
    congressData: () => opts.congress ?? null,
  } as unknown as UnitDisplay["game"];
  const emitted: unknown[] = [];
  const handlers = new Map<unknown, (e: unknown) => void>();
  el.eventBus = {
    emit: (e: unknown) => emitted.push(e),
    on: (type: unknown, cb: (e: unknown) => void) => handlers.set(type, cb),
  } as unknown as UnitDisplay["eventBus"];
  const uiState = { ghostStructure: null } as UIState;
  el.uiState = uiState;
  document.body.appendChild(el);
  el.init();
  el.tick();
  await Promise.resolve();
  // The bar redraws on the next tick after the buildables arrive, as in game.
  el.tick();
  await el.updateComplete;
  return { el, uiState, emitted, handlers };
}

async function tap(el: UnitDisplay, key: string): Promise<void> {
  el.querySelector<HTMLButtonElement>(`[data-hotbar="${key}"]`)!.click();
  await el.updateComplete;
}

function card(el: UnitDisplay): HTMLElement | null {
  return el.querySelector<HTMLElement>("[data-hotbar-info]");
}

function button(el: UnitDisplay, key: string): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>(`[data-hotbar="${key}"]`)!;
}

describe("unit-display build bar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("lists the research institute and admin office in domestic games", async () => {
    const plain = await mount([]);
    expect(
      plain.el.querySelector('[data-hotbar="research_institute"]'),
    ).toBeNull();
    document.body.innerHTML = "";

    const { el } = await mount([], { domestic: true });
    expect(
      el.querySelector('[data-hotbar="research_institute"]'),
    ).not.toBeNull();
    expect(el.querySelector('[data-hotbar="admin_office"]')).not.toBeNull();
    for (const b of el.querySelectorAll("[data-hotbar]")) {
      expect(b.classList.contains("w-11")).toBe(false);
      expect(b.classList.contains("h-9")).toBe(true);
    }
    expect(el.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("the first tap opens the card, the second builds, the third stops", async () => {
    const { el, uiState, emitted } = await mount([buildable(UnitType.City)]);

    await tap(el, "city");
    expect(uiState.ghostStructure).toBeNull();
    const text = card(el)!.textContent!;
    expect(text).toContain("[unit_type.city]");
    expect(text).toContain("[build_menu.desc.city]");
    expect(text).toContain("100");
    expect(text).toContain("[touch_ui.tap_again_to_build]");
    expect(emitted).toContainEqual(new ToggleStructureEvent([UnitType.City]));

    await tap(el, "city");
    expect(uiState.ghostStructure).toBe(UnitType.City);
    expect(card(el)).toBeNull();
    expect(emitted).toContainEqual(new ToggleStructureEvent(null));

    await tap(el, "city");
    expect(uiState.ghostStructure).toBeNull();
  });

  it("the card opens above the HUD box, not over the control panel", async () => {
    const { el } = await mount([buildable(UnitType.City)]);
    await tap(el, "city");
    const info = card(el)!;
    expect(info.classList).toContain("bottom-full");
    // Nothing between the card and <unit-display> is positioned, so the card
    // anchors to the box around the control panel, the bar and the domestic
    // row (index.html; tests/client/HudLayout.test.ts) and opens above it.
    for (let a = info.parentElement; a && a !== el; a = a.parentElement) {
      expect(
        [...a.classList].filter((c) =>
          /^(relative|absolute|fixed|sticky)$/.test(c),
        ),
      ).toEqual([]);
    }
  });

  it("a locked unit names its tech on the icon and never builds", async () => {
    const { el, uiState } = await mount([
      buildable(UnitType.HydrogenBomb, true),
    ]);
    expect(
      el.querySelector('[data-hotbar="hydrogen_bomb"] [data-locked-tech]')!
        .textContent,
    ).toContain("[domestic.tech.thermonuclear.name]");
    // Dimmed like any unit that can't be built.
    expect(
      button(el, "hydrogen_bomb")
        .querySelector("img")!
        .classList.contains("opacity-40"),
    ).toBe(true);

    await tap(el, "hydrogen_bomb");
    await tap(el, "hydrogen_bomb");

    expect(uiState.ghostStructure).toBeNull();
    expect(
      card(el)!.querySelector("[data-hotbar-reason]")!.textContent,
    ).toContain(
      "[domestic.locked_requires] tech=[domestic.tech.thermonuclear.name]",
    );
  });

  it("an unlocked unit shows no lock on its icon or card", async () => {
    const { el } = await mount([buildable(UnitType.Factory, false)]);
    expect(
      button(el, "factory").querySelector("[data-locked-tech]"),
    ).toBeNull();
    expect(
      button(el, "factory")
        .querySelector("img")!
        .classList.contains("opacity-40"),
    ).toBe(false);

    await tap(el, "factory");

    expect(card(el)!.textContent).toContain("[unit_type.factory]");
    expect(card(el)!.querySelector("[data-hotbar-reason]")).toBeNull();
    expect(el.textContent).not.toContain("domestic.locked_requires");
  });

  it("a warship without a port says so instead of building", async () => {
    const { el, uiState } = await mount([buildable(UnitType.Warship)]);

    await tap(el, "warship");
    await tap(el, "warship");

    expect(uiState.ghostStructure).toBeNull();
    expect(
      card(el)!.querySelector("[data-hotbar-reason]")!.textContent,
    ).toContain("[touch_ui.needs_port]");
    // A mouse player keeps the Shift hint and the build key.
    expect(card(el)!.textContent).toContain("[build_menu.warship_shift_hint]");
    expect(card(el)!.textContent).toContain("[7]");
  });

  it("on a touch screen the warship card explains the long-press", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      media: q,
      matches: q === "(pointer: coarse)",
    }));
    const { el } = await mount([buildable(UnitType.Warship)], { ports: 1 });

    await tap(el, "warship");

    expect(card(el)!.textContent).toContain("[touch_ui.warship_long_press]");
    expect(card(el)!.textContent).not.toContain("[7]");
  });

  it("opening another card leaves build mode", async () => {
    const { el, uiState } = await mount([
      buildable(UnitType.City),
      buildable(UnitType.Factory),
    ]);
    await tap(el, "city");
    await tap(el, "city");
    expect(uiState.ghostStructure).toBe(UnitType.City);

    await tap(el, "factory");

    expect(uiState.ghostStructure).toBeNull();
    expect(card(el)!.textContent).toContain("[unit_type.factory]");
  });

  it("pressing the map closes the card", async () => {
    const { el, handlers, emitted } = await mount([buildable(UnitType.City)]);
    await tap(el, "city");

    handlers.get(MouseDownEvent)!(new MouseDownEvent(0, 0));
    await el.updateComplete;

    expect(card(el)).toBeNull();
    expect(emitted).toContainEqual(new ToggleStructureEvent(null));
  });

  it("a build key shows its unit pressed and closes an open card", async () => {
    const { el, uiState, emitted } = await mount([
      buildable(UnitType.City),
      buildable(UnitType.Factory),
    ]);
    await tap(el, "city");

    // InputHandler's build keys set the ghost directly.
    uiState.ghostStructure = UnitType.Factory;
    el.tick();
    await el.updateComplete;

    expect(card(el)).toBeNull();
    expect(emitted).toContainEqual(new ToggleStructureEvent(null));
    expect(button(el, "factory").getAttribute("aria-pressed")).toBe("true");
    expect(button(el, "city").getAttribute("aria-pressed")).toBe("false");

    // Tapping the key-selected unit leaves build mode, as the key would.
    await tap(el, "factory");
    expect(uiState.ghostStructure).toBeNull();
  });

  it("the tutorial still points at a bar button", async () => {
    const { el, handlers } = await mount([buildable(UnitType.City)]);

    handlers.get(TutorialHighlightEvent)!(new TutorialHighlightEvent("city"));
    await el.updateComplete;

    expect(button(el, "city").classList.contains("tutorial-highlight")).toBe(
      true,
    );
  });

  it("lists the warfare units only with expanded warfare, in at most two rows", async () => {
    const plain = await mount([]);
    expect(plain.el.querySelector('[data-hotbar="airport"]')).toBeNull();
    document.body.innerHTML = "";

    const { el } = await mount([], { domestic: true, warfare: true });
    for (const key of [
      "coastal_battery",
      "airport",
      "coastal_barrage",
      "bomber",
    ]) {
      expect(el.querySelector(`[data-hotbar="${key}"]`), key).not.toBeNull();
    }
    // Buildings fill row 1; the row is a grid that shrinks, never wraps.
    const row = el.querySelector('[data-hotbar="airport"]')!.parentElement!;
    expect(row.classList.contains("flex-wrap")).toBe(false);
  });

  const BUILDINGS = [
    "city",
    "factory",
    "port",
    "defense_post",
    "missile_silo",
    "sam_launcher",
    "warship",
    "research_institute",
    "admin_office",
    "coastal_battery",
    "airport",
  ];
  const ATTACKS = [
    "atom_bomb",
    "hydrogen_bomb",
    "mirv",
    "conventional_missile",
    "satellite",
    "coastal_barrage",
    "bomber",
    "paradrop",
  ];
  const keysOf = (row: Element) =>
    [...row.querySelectorAll("[data-hotbar]")].map((b) =>
      b.getAttribute("data-hotbar"),
    );

  it("with every mode on: buildings in row 1, attacks in row 2, no third row", async () => {
    const { el } = await mount([], {
      domestic: true,
      warfare: true,
      strategic: {
        stock: {
          [UnitType.AtomBomb]: 1,
          [UnitType.HydrogenBomb]: 0,
          [UnitType.MIRV]: 0,
        },
        jobs: [],
        satellite: { phase: "none" },
      },
    });
    const rows = [...el.querySelectorAll("[data-hotbar-row]")];
    expect(rows.map((r) => r.getAttribute("data-hotbar-row"))).toEqual([
      "buildings",
      "attacks",
    ]);
    expect(keysOf(rows[0])).toEqual(BUILDINGS);
    expect(keysOf(rows[1])).toEqual(ATTACKS);
    // Every button belongs to one of the two rows, and each row lays its
    // buttons out in one grid row (one column per button) so it can't wrap.
    expect(el.querySelectorAll("[data-hotbar]")).toHaveLength(
      BUILDINGS.length + ATTACKS.length,
    );
    for (const row of rows as HTMLElement[]) {
      expect(row.classList.contains("grid")).toBe(true);
      expect(row.style.gridTemplateColumns).toContain(
        `repeat(${row.querySelectorAll("[data-hotbar]").length},`,
      );
      expect(row.style.gridTemplateColumns).toContain("minmax(0,");
    }
  });

  it("modes that are off leave their buttons out; an empty row disappears", async () => {
    const { el } = await mount([]);
    const rows = [...el.querySelectorAll("[data-hotbar-row]")];
    expect(keysOf(rows[0])).toEqual([
      "city",
      "factory",
      "port",
      "defense_post",
      "missile_silo",
      "sam_launcher",
      "warship",
    ]);
    expect(keysOf(rows[1])).toEqual(["atom_bomb", "hydrogen_bomb", "mirv"]);
  });

  it("a locked tech shows as one compact line, lock icon and short name", async () => {
    const { el } = await mount([buildable(UnitType.Airport, true)], {
      domestic: true,
      warfare: true,
    });
    const lock = button(el, "airport").querySelector("[data-locked-tech]")!;
    expect(lock.textContent).toContain("🔒");
    expect(lock.classList.contains("truncate")).toBe(true);
    expect(lock.classList.contains("line-clamp-2")).toBe(false);
  });

  it("the bomber card asks for an airport, the barrage card for a silo", async () => {
    const { el } = await mount(
      [buildable(UnitType.Bomber), buildable(UnitType.CoastalBarrage)],
      { warfare: true },
    );
    await tap(el, "bomber");
    expect(card(el)?.textContent).toContain("[touch_ui.needs_airport]");
    await tap(el, "coastal_barrage");
    expect(card(el)?.textContent).toContain("[touch_ui.needs_silo]");
  });

  it("a locked airport names industrialization", async () => {
    const { el } = await mount([buildable(UnitType.Airport, true)], {
      domestic: true,
      warfare: true,
    });
    expect(
      button(el, "airport").querySelector("[data-locked-tech]")!.textContent,
    ).toContain("[domestic.tech.industrialization.name]");
  });

  const STRATEGIC = (over: Partial<StrategicData> = {}): StrategicData => ({
    stock: {
      [UnitType.AtomBomb]: 2,
      [UnitType.HydrogenBomb]: 0,
      [UnitType.MIRV]: 0,
    },
    jobs: [],
    satellite: { phase: "none" },
    ...over,
  });

  it("strategic weapons: missile and satellite buttons, stock badges on the nukes", async () => {
    const plain = await mount([]);
    expect(plain.el.querySelector('[data-hotbar="satellite"]')).toBeNull();
    expect(plain.el.querySelector("[data-stock]")).toBeNull();
    document.body.innerHTML = "";

    const { el } = await mount([], { strategic: STRATEGIC() });
    expect(
      el.querySelector('[data-hotbar="conventional_missile"]'),
    ).not.toBeNull();
    expect(el.querySelector('[data-hotbar="satellite"]')).not.toBeNull();
    const badge = (key: string) =>
      button(el, key).querySelector("[data-stock]")!.textContent!.trim();
    expect(badge("atom_bomb")).toBe("2");
    expect(badge("hydrogen_bomb")).toBe("0");
    expect(badge("mirv")).toBe("0");
  });

  it("a nuke card fires from the stockpile and builds with one tap", async () => {
    const { el, emitted } = await mount(
      [buildable(UnitType.AtomBomb), buildable(UnitType.HydrogenBomb)],
      { strategic: STRATEGIC(), silos: 1, factories: [{ id: 5, level: 1 }] },
    );
    await tap(el, "hydrogen_bomb");
    expect(card(el)?.textContent).toContain("[strategic.no_stock]");
    const produce =
      card(el)!.querySelector<HTMLButtonElement>("[data-produce]")!;
    expect(produce.disabled).toBe(false);
    expect(produce.textContent).toContain("[strategic.produce] seconds=40");
    produce.click();
    expect(emitted).toContainEqual(
      new SendProduceNukeIntentEvent(UnitType.HydrogenBomb),
    );

    await tap(el, "atom_bomb");
    expect(card(el)?.textContent).toContain("[strategic.stock] count=2");
    expect(card(el)?.textContent).toContain("[touch_ui.tap_again_to_build]");
  });

  it("says why it can't build, and while the satellite is still up", async () => {
    const { el } = await mount(
      [buildable(UnitType.AtomBomb), buildable(UnitType.Satellite)],
      {
        strategic: STRATEGIC({
          jobs: [
            {
              factoryId: 5,
              type: UnitType.AtomBomb,
              startTick: 0,
              endTick: 200,
            },
          ],
          satellite: { phase: "orbit" },
        }),
        silos: 1,
        factories: [{ id: 5, level: 1 }],
      },
    );
    await tap(el, "atom_bomb");
    expect(
      card(el)!.querySelector("[data-produce]")!.hasAttribute("disabled"),
    ).toBe(true);
    expect(card(el)?.textContent).toContain("[strategic.no_free_line]");
    expect(card(el)?.textContent).toContain("[strategic.producing] count=1");
    await tap(el, "satellite");
    expect(card(el)?.textContent).toContain("[strategic.satellite_used]");
  });

  it("a unit a resolution bans says so on the icon and the card, and never builds", async () => {
    const { el, uiState } = await mount([
      { ...buildable(UnitType.City), canBuild: false, banned: true },
    ]);
    expect(
      button(el, "city").querySelector("[data-banned]")!.textContent,
    ).toContain("[congress.banned]");
    await tap(el, "city");
    await tap(el, "city");
    expect(uiState.ghostStructure).toBeNull();
    expect(
      card(el)!.querySelector("[data-hotbar-reason]")!.textContent,
    ).toContain("[congress.banned_reason]");
  });

  it("an embargo stops new nukes at the factory while the stock still fires", async () => {
    const { el } = await mount([buildable(UnitType.AtomBomb)], {
      strategic: STRATEGIC(),
      silos: 1,
      factories: [{ id: 5, level: 1 }],
      congress: {
        ...EMPTY,
        active: [
          {
            resolution: "arms_embargo",
            option: "A",
            targets: [1],
            param: null,
            sinceTick: 0,
            expires: "next_tally",
          },
        ],
      },
    });
    await tap(el, "atom_bomb");
    expect(
      card(el)!.querySelector("[data-produce]")!.hasAttribute("disabled"),
    ).toBe(true);
    expect(
      card(el)!.querySelector("[data-produce-reason]")!.textContent,
    ).toContain("[congress.banned_reason]");
    expect(card(el)?.textContent).toContain("[touch_ui.tap_again_to_build]");
  });

  describe("paradrop button", () => {
    it("sits right after the bomber, same size as the rest", async () => {
      const { el } = await mount([], { warfare: true });
      const keys = [...el.querySelectorAll("[data-hotbar]")].map((b) =>
        b.getAttribute("data-hotbar"),
      );
      expect(keys[keys.indexOf("bomber") + 1]).toBe("paradrop");
      expect(button(el, "paradrop").classList.contains("h-9")).toBe(true);
      // Absent without expanded warfare.
      document.body.innerHTML = "";
      const plain = await mount([]);
      expect(plain.el.querySelector('[data-hotbar="paradrop"]')).toBeNull();
    });

    it("two taps enter aim mode (the map flow sends the intent)", async () => {
      const { el, uiState } = await mount(
        [buildable(UnitType.TransportPlane)],
        { warfare: true, airports: [{ busy: false }] },
      );
      await tap(el, "paradrop");
      expect(uiState.ghostStructure).toBeNull();
      expect(card(el)!.textContent).toContain("[unit_type.paradrop]");
      expect(card(el)!.querySelector("[data-hotbar-reason]")).toBeNull();
      await tap(el, "paradrop");
      expect(uiState.ghostStructure).toBe(UnitType.TransportPlane);
    });

    it("says on the button why it cannot start, and never aims", async () => {
      const cases: [Parameters<typeof mount>[1], string][] = [
        [{ warfare: true }, "radial_menu.paradrop_no_airport"],
        [
          { warfare: true, airports: [{ busy: true }] },
          "radial_menu.paradrop_no_sortie",
        ],
        [
          { warfare: true, airports: [{ busy: false }], gold: 0n },
          "radial_menu.paradrop_need_gold",
        ],
      ];
      for (const [opts, reason] of cases) {
        document.body.innerHTML = "";
        const { el, uiState } = await mount(
          [buildable(UnitType.TransportPlane)],
          opts,
        );
        expect(
          button(el, "paradrop").querySelector("[data-paradrop-reason]")!
            .textContent,
        ).toContain(reason);
        await tap(el, "paradrop");
        await tap(el, "paradrop");
        expect(uiState.ghostStructure).toBeNull();
        expect(
          card(el)!.querySelector("[data-hotbar-reason]")!.textContent,
        ).toContain(reason);
      }
    });
  });
});
