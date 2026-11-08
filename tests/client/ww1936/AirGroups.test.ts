// w51: the air group screens' rules (model, tokens, taps, orders, card numbers,
// template editor limits, library entry) against view fixtures; no engine.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_TYPES,
  type AirGroupView,
  WP_BACK,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WW_GROUP_MAX_ZONES,
  WW_MAX_GROUP_PLANES,
} from "@openfront/engine-api/ww1936/AirTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { describe, expect, it } from "vitest";
import {
  disbandOrder,
  draftTotal,
  emptyDraft,
  groupOrder,
  groupStatus,
  memberLines,
  rangeSpread,
  reachLine,
  roleTotals,
  shownGroup,
  stepKeep,
  stepType,
  TEMPLATE_TYPES,
  templateBlock,
  templateOrder,
  togglePriority,
  toggleZone,
  zoneRowsOf,
} from "../../../src/client/hud/ww1936/AirGroupModel";
import { entryStatus } from "../../../src/client/hud/ww1936/DesignLibraryStatus";
import { navyCtx, NavyGame } from "../../../src/client/hud/ww1936/NavyModel";
import {
  WingUi,
  wingUiOf,
  WwSelectGroupEvent,
} from "../../../src/client/hud/ww1936/WingUi";
import { WwWingController } from "../../../src/client/hud/ww1936/WwWingController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import {
  layoutWings,
  pickWingSlot,
  SLOT_AIRGROUP,
  SLOT_BASE,
  SLOT_TOKEN,
  type WingSlot,
} from "../../../src/client/view/WingTokenLayout";
import { REGION } from "../../ww1936/seaFixture";
import { airDetail, sea, seaGame, SID, wingBrief } from "./SeaAirFixture";

const T = (t: string) => AIR_TYPES.indexOf(t as never);
const none = new Set<number>();
const last = <X>(a: X[]): X => a[a.length - 1];

function planes(o: Record<string, number>): number[] {
  const a = AIR_TYPES.map(() => 0);
  for (const [t, n] of Object.entries(o)) a[T(t)] = n;
  return a;
}

function group(over: Partial<AirGroupView> = {}): AirGroupView {
  return {
    id: 7,
    tpl: 1,
    name: "Fighter wing",
    zones: [],
    priority: 0,
    army: 0,
    cls: 0,
    target: 0,
    auto: false,
    night: false,
    base: REGION.london,
    planes: planes({ fighter: 150, bomber: 100 }),
    want: planes({ fighter: 150, bomber: 100 }),
    rangeKm: planes({ fighter: 1500, bomber: 2500 }),
    members: [
      {
        wing: 71,
        type: T("fighter"),
        planes: 150,
        full: 150,
        phase: WP_GROUND,
        until: 0,
        flySr: 0,
        flyMission: -1,
        sr: -1,
        mission: 0,
        kills: 3,
        lost: 1,
        auto: false,
      },
      {
        wing: 72,
        type: T("bomber"),
        planes: 100,
        full: 120,
        phase: WP_GROUND,
        until: 0,
        flySr: 0,
        flyMission: -1,
        sr: -1,
        mission: 0,
        kills: 0,
        lost: 2,
        auto: false,
      },
    ],
    zoneInfo: [],
    ...over,
  };
}

const SR_BERLIN = () => sea.srOfZoneOrRegion(REGION.warsaw);
const SR_PARIS = () => sea.srOfZoneOrRegion(REGION.paris);

function tileOf(region: number): [number, number] {
  const t = sea.centerTile(region);
  return [(t % sea.width) + 0.5, Math.floor(t / sea.width) + 0.5];
}

function fixture(
  g: AirGroupView = group(),
  extra: Parameters<typeof seaGame>[0] = {},
) {
  const s = seaGame({
    air: airDetail("GBR", { groups: [g] }),
    wings: [],
    ...extra,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  let slot: WingSlot | null = null;
  const ctl = new WwWingController(
    s.game as unknown as NavyGame,
    bus,
    () => 4,
    () => 0,
    () => slot,
    null,
  );
  ctl.init();
  return { s, bus, sent, ctl, setSlot: (v: WingSlot | null) => (slot = v) };
}

const groupSlot = (id = 7): WingSlot => ({
  kind: SLOT_AIRGROUP,
  wing: id,
  base: REGION.london,
  owner: SID("GBR"),
  x: 0,
  y: 0,
  lod: 0,
  planes: 250,
  wings: 2,
  type: 0,
});

describe("template editor limits", () => {
  it("steps by 25, stops at 600, never offers carrier or transport types", () => {
    let d = emptyDraft();
    const f = T("fighter");
    for (let i = 0; i < 40; i++) d = stepType(d, f, 1);
    expect(d.planes[f]).toBe(WW_MAX_GROUP_PLANES);
    expect(stepType(d, T("bomber"), 1)).toBe(d);
    d = stepType(d, f, -1);
    expect(d.planes[f]).toBe(575);
    expect(stepType(d, T("cv_fighter"), 1)).toBe(d);
    expect(stepType(d, T("transport_plane"), 1)).toBe(d);
    expect(TEMPLATE_TYPES.map((i) => AIR_TYPES[i])).not.toContain("cv_cas");
    expect(stepKeep({ ...d, keep: 20 }, 1).keep).toBe(20);
    expect(stepKeep({ ...d, keep: 0 }, -1).keep).toBe(0);
  });

  it("blocks without a name or planes; builds the order; the 21st template is refused", () => {
    const d = {
      ...emptyDraft(),
      name: "A",
      planes: planes({ fighter: 100 }),
      keep: 2,
    };
    expect(templateBlock({ ...d, name: " " }, [])).toBe("no_name");
    expect(templateBlock(emptyDraft(), [])).toBe("no_name");
    expect(templateBlock({ ...d, planes: planes({}) }, [])).toBe("no_planes");
    expect(templateBlock(d, [])).toBeNull();
    expect(templateOrder(d, [])).toEqual({
      kind: "air_template",
      id: 0,
      name: "A",
      planes: d.planes,
      keep: 2,
    });
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: "x",
      planes: d.planes,
      keep: 0,
    }));
    expect(templateBlock(d, many)).toBe("too_many_templates");
    expect(templateBlock({ ...d, id: 3 }, many)).toBeNull();
  });

  it("totals by role and warns when ranges differ a lot", () => {
    const d = {
      ...emptyDraft(),
      planes: planes({
        fighter: 100,
        heavy_fighter: 50,
        cas: 25,
        strat_bomber: 75,
      }),
    };
    expect(roleTotals(d)).toEqual({ air: 150, ground: 25, bomb: 75, sea: 0 });
    expect(draftTotal(d)).toBe(250);
    const r = AIR_TYPES.map(() => 0);
    r[T("fighter")] = 1000;
    r[T("strat_bomber")] = 3000;
    r[T("cas")] = 1100;
    expect(rangeSpread(d, r)).toEqual({ min: 1000, max: 3000, warn: true });
    expect(
      rangeSpread({ ...d, planes: planes({ fighter: 100, cas: 25 }) }, r)?.warn,
    ).toBe(false);
    expect(
      rangeSpread({ ...d, planes: planes({ fighter: 100 }) }, r),
    ).toBeNull();
  });
});

describe("zones and orders", () => {
  it("a tap adds, again removes, at most five; the priority follows the zone out", () => {
    let g = group();
    for (const z of [1, 2, 3, 4, 5]) {
      const e = toggleZone(g, z);
      g = { ...g, zones: e.zones };
    }
    expect(g.zones).toHaveLength(WW_GROUP_MAX_ZONES);
    expect(toggleZone(g, 6)).toMatchObject({
      blocked: "full",
      zones: [1, 2, 3, 4, 5],
    });
    g = { ...g, priority: togglePriority(g, 3) };
    expect(g.priority).toBe(3);
    expect(togglePriority(g, 3)).toBe(0);
    expect(togglePriority(g, 99)).toBe(3);
    expect(toggleZone(g, 3)).toMatchObject({
      zones: [1, 2, 4, 5],
      priority: 0,
    });
  });

  it("the order carries zones, priority, class and flags; an army clears the zones", () => {
    const g = group({ zones: [4, 5], priority: 5, cls: 2, night: true });
    expect(groupOrder(g, {})).toEqual({
      kind: "air_group_order",
      group: 7,
      zones: [4, 5],
      priority: 5,
      cls: "rail",
      night: true,
    });
    expect(groupOrder(g, { army: 9 })).toEqual({
      kind: "air_group_order",
      group: 7,
      zones: [],
      priority: 0,
      army: 9,
      cls: "rail",
      night: true,
    });
    expect(groupOrder(g, { zones: [4], priority: 5 })).toMatchObject({
      zones: [4],
      priority: 0,
    });
    expect(disbandOrder(g)).toEqual({ kind: "air_group_disband", group: 7 });
  });

  it("a just-sent order stands in for the view for a moment", () => {
    const g = group({ zones: [1] });
    const draft = { group: 7, zones: [1, 2], priority: 0, army: 0, at: 1000 };
    expect(shownGroup(g, draft, 1500).zones).toEqual([1, 2]);
    expect(shownGroup(g, draft, 9000).zones).toEqual([1]);
    expect(shownGroup(g, { ...draft, group: 8 }, 1500).zones).toEqual([1]);
  });
});

describe("card numbers", () => {
  it("status: no order, on sortie, rearm days, out of range", () => {
    expect(groupStatus(group(), 100).status).toBe("none");
    const ordered = group({ zones: [SR_BERLIN()] });
    expect(groupStatus(ordered, 100).status).toBe("ready");
    const out = group({
      zones: [1],
      members: group().members.map((m) => ({ ...m, phase: WP_OUT })),
    });
    expect(groupStatus(out, 100).status).toBe("out");
    const rest = group({
      zones: [1],
      members: group().members.map((m) => ({
        ...m,
        phase: WP_REARM,
        until: 115,
      })),
    });
    expect(groupStatus(rest, 100)).toEqual({ status: "rearm", days: 2 });
    const far = group({
      zones: [1],
      zoneInfo: [{ sr: 1, planes: 0, supPm: 0, enemySupPm: 0, reachMask: 0 }],
    });
    expect(groupStatus(far, 100).status).toBe("range");
    expect(groupStatus(group({ auto: true }), 100).status).toBe("auto");
    void WP_BACK;
  });

  it("per-zone planes, superiority and which types reach", () => {
    const s = seaGame();
    const ctx = navyCtx(s.game as unknown as NavyGame)!;
    const g = group({
      zones: [SR_PARIS(), SR_BERLIN()],
      priority: SR_BERLIN(),
      zoneInfo: [
        {
          sr: SR_PARIS(),
          planes: 150,
          supPm: 640,
          enemySupPm: 310,
          reachMask: (1 << T("fighter")) | (1 << T("bomber")),
        },
        {
          sr: SR_BERLIN(),
          planes: 100,
          supPm: 500,
          enemySupPm: 520,
          reachMask: 1 << T("bomber"),
        },
      ],
    });
    const rows = zoneRowsOf(ctx, g);
    expect(
      rows.map((r) => [r.mark, r.planes, r.supPct, r.enemyPct, r.priority]),
    ).toEqual([
      ["①", 150, 64, 31, false],
      ["②", 100, 50, 52, true],
    ]);
    expect(reachLine(rows[0])).toBe("");
    expect(reachLine(rows[1])).not.toBe("");
    expect(memberLines(g)).toMatchObject([
      { type: T("fighter"), planes: 150, full: 150, kills: 3, lost: 1 },
      { type: T("bomber"), planes: 100, full: 120, kills: 0, lost: 2 },
    ]);
  });
});

describe("tokens", () => {
  it("one token per group at its base whatever the lens; its members are not drawn", () => {
    const g = group();
    const s = seaGame({
      air: airDetail("GBR", { groups: [g] }),
      wings: [
        wingBrief({
          id: 71,
          owner: SID("GBR"),
          side: SID("GBR"),
          base: REGION.london,
          planes: 150,
        }),
        wingBrief({
          id: 72,
          owner: SID("GBR"),
          side: SID("GBR"),
          base: REGION.london,
          planes: 100,
        }),
        wingBrief({
          id: 73,
          owner: SID("GBR"),
          side: SID("GBR"),
          base: REGION.london,
          planes: 60,
        }),
        wingBrief({
          id: 74,
          owner: SID("DEU"),
          side: SID("DEU"),
          base: REGION.berlin,
          planes: 80,
        }),
      ],
    });
    const out: WingSlot[] = [];
    for (const airLayer of [false, true]) {
      layoutWings(
        s.air,
        s.navy,
        undefined,
        { zoom: 4, airLayer, chosen: none, expanded: none },
        out,
      );
      const kinds = out.map((o) => [o.kind, o.wing]);
      expect(kinds).toContainEqual([SLOT_AIRGROUP, 7]);
      expect(kinds).toContainEqual([SLOT_TOKEN, 73]);
      expect(kinds).not.toContainEqual([SLOT_TOKEN, 71]);
      expect(out.find((o) => o.kind === SLOT_AIRGROUP)).toMatchObject({
        planes: 250,
        wings: 2,
      });
    }
    // ww162 §3.1: from zoom 6 the group splits into its wings' tokens, each
    // carrying the group (as the army counters split into divisions).
    layoutWings(
      s.air,
      s.navy,
      undefined,
      { zoom: 6, airLayer: true, chosen: none, expanded: none },
      out,
    );
    expect(out.some((o) => o.kind === SLOT_AIRGROUP)).toBe(false);
    expect(
      out
        .filter((o) => o.owner === SID("GBR"))
        .map((o) => [o.kind, o.wing, o.group]),
    ).toEqual([
      [SLOT_TOKEN, 71, 7],
      [SLOT_TOKEN, 72, 7],
      [SLOT_TOKEN, 73, undefined],
    ]);
  });

  it("a chip takes no tap; a token's reach is small", () => {
    const slots: WingSlot[] = [
      {
        kind: SLOT_BASE,
        wing: 1,
        base: 1,
        owner: 1,
        x: 10,
        y: 10,
        lod: 1,
        planes: 9,
        wings: 3,
        type: 0,
      },
      { ...groupSlot(), x: 20, y: 10 },
    ];
    expect(pickWingSlot(slots, 10, 10, 4)).toBeNull();
    expect(pickWingSlot(slots, 20 + 3, 10, 4)?.wing).toBe(7);
    expect(pickWingSlot(slots, 20 + 5, 10, 4)).toBeNull();
  });
});

describe("taps", () => {
  it("a token tap chooses the group", () => {
    const f = fixture();
    const [x, y] = tileOf(REGION.london);
    f.setSlot(groupSlot());
    expect(f.ctl.handleTap(x, y)).toBe(true);
    expect(wingUiOf(f.s.game).airGroup).toBe(7);
  });

  it("ww162: from zoom 6 a tap on one of the group's wings chooses the group; again lets go", () => {
    const f = fixture();
    const [x, y] = tileOf(REGION.london);
    f.setSlot({ ...groupSlot(), kind: SLOT_TOKEN, wing: 71, group: 7 });
    expect(f.ctl.handleTap(x, y)).toBe(true);
    expect(wingUiOf(f.s.game).airGroup).toBe(7);
    expect(f.ctl.handleTap(x, y)).toBe(true);
    expect(wingUiOf(f.s.game).airGroup).toBe(0);
  });

  it("each zone tap adds or removes it and sends the order at once", () => {
    const f = fixture();
    wingUiOf(f.s.game).airGroup = 7;
    const [bx, by] = tileOf(REGION.warsaw);
    const [px, py] = tileOf(REGION.paris);
    expect(f.ctl.handleTap(bx, by)).toBe(true);
    expect(last(f.sent)).toMatchObject({
      kind: "air_group_order",
      group: 7,
      zones: [SR_BERLIN()],
    });
    expect(f.ctl.handleTap(px, py)).toBe(true);
    expect(last(f.sent)).toMatchObject({ zones: [SR_BERLIN(), SR_PARIS()] });
    expect(f.ctl.handleTap(bx, by)).toBe(true);
    expect(last(f.sent)).toMatchObject({ zones: [SR_PARIS()] });
  });

  it("a zone no type reaches is refused with a reason, nothing sent", () => {
    const f = fixture(group({ rangeKm: planes({ fighter: 1, bomber: 1 }) }), {
      air: airDetail("GBR", {
        bases: [{ region: REGION.london, used: 0, cap: 0, damagePm: 0 }],
        groups: [group({ rangeKm: planes({ fighter: 1, bomber: 1 }) })],
      }),
    });
    wingUiOf(f.s.game).airGroup = 7;
    const [bx, by] = tileOf(REGION.moscow);
    f.ctl.handleTap(bx, by);
    expect(f.sent).toHaveLength(0);
    expect(wingUiOf(f.s.game).groupRefused).toBe("range");
  });

  it("tapping my army with a group chosen follows it", () => {
    const f = fixture(group(), {
      armies: [armyAt(REGION.paris)],
    });
    wingUiOf(f.s.game).airGroup = 7;
    const [x, y] = tileOf(REGION.paris);
    expect(f.ctl.handleTap(x, y, 24 / 4)).toBe(true);
    expect(last(f.sent)).toMatchObject({
      kind: "air_group_order",
      group: 7,
      zones: [],
      army: 1,
    });
  });

  it("an army token wins the tap; a truly overlapping pair asks which", () => {
    // Army in the base region: both tokens sit at the same place.
    const f = fixture(group(), { armies: [armyAt(REGION.london)] });
    const [x, y] = tileOf(REGION.london);
    f.setSlot({ ...groupSlot(), x: x - 0.5, y: y - 0.5 });
    f.ctl.handleTap(x, y, 24 / 4);
    expect(wingUiOf(f.s.game).chooser).toEqual({ army: 1, group: 7 });
    expect(wingUiOf(f.s.game).airGroup).toBe(0);

    // Army a few tiles away from the air token: the army's tap, the controller leaves it.
    const g = fixture(group(), { armies: [armyAt(REGION.london)] });
    g.setSlot({ ...groupSlot(), x: x - 0.5 + 5, y: y - 0.5 });
    expect(g.ctl.handleTap(x, y, 24 / 4)).toBe(false);
    expect(wingUiOf(g.s.game).chooser).toBeNull();
  });

  it("the group event chooses it and drops the wing choice", () => {
    const f = fixture();
    wingUiOf(f.s.game).ids = [3];
    f.bus.emit(new WwSelectGroupEvent(7));
    expect(wingUiOf(f.s.game)).toMatchObject({ airGroup: 7, ids: [] });
  });
});

function armyAt(region: number) {
  return {
    id: 1,
    owner: SID("GBR"),
    nameNo: 1,
    general: 0,
    divisions: 3,
    strengthPm: 1000,
    orgPm: 1000,
    state: 0,
    region,
    move: null,
    sum: [0, 0, 0, 0, 0, 0] as never,
    symbol: 0,
    mine: null,
  } as never;
}

describe("library entry", () => {
  it("loads as a new template, is 'have' when one matches, stale when broken", () => {
    const entry = {
      id: "a",
      auto: false,
      type: "airgroup" as const,
      name: "Escort",
      planes: { fighter: 100, bomber: 50 },
    };
    const s = seaGame();
    const st = entryStatus(entry, s.game as never);
    expect(st.state).toBe("ready");
    expect(st.order).toMatchObject({
      kind: "air_template",
      id: 0,
      name: "Escort",
      keep: 0,
    });
    const have = seaGame({
      air: airDetail("GBR", {
        templates: [
          {
            id: 1,
            name: "x",
            planes: planes({ fighter: 100, bomber: 50 }),
            keep: 0,
          },
        ],
      }),
    });
    expect(entryStatus(entry, have.game as never).state).toBe("have");
    expect(
      entryStatus({ ...entry, planes: { fighter: 30 } }, s.game as never).state,
    ).toBe("stale");
    expect(
      entryStatus({ ...entry, planes: { cv_fighter: 100 } }, s.game as never)
        .state,
    ).toBe("stale");
    expect(
      entryStatus({ ...entry, planes: { fighter: 700 } }, s.game as never)
        .state,
    ).toBe("stale");
  });
});

void WingUi;

describe("screens render", () => {
  it("the card shows the zones with numbers, and the star sends the priority", async () => {
    await import("../../../src/client/hud/ww1936/WwAirGroupCard");
    const g = group({
      zones: [SR_PARIS(), SR_BERLIN()],
      zoneInfo: [
        {
          sr: SR_PARIS(),
          planes: 150,
          supPm: 640,
          enemySupPm: 310,
          reachMask: 3 << 0,
        },
        {
          sr: SR_BERLIN(),
          planes: 100,
          supPm: 500,
          enemySupPm: 520,
          reachMask: 0,
        },
      ],
    });
    const f = fixture(g);
    const el = document.createElement("ww-air-group-card") as HTMLElement & {
      game: unknown;
      eventBus: EventBus;
      init(): void;
      updateComplete: Promise<unknown>;
    };
    el.game = f.s.game;
    el.eventBus = f.bus;
    el.init();
    document.body.append(el);
    wingUiOf(f.s.game).airGroup = 7;
    (el as unknown as { requestUpdate(): void }).requestUpdate();
    await el.updateComplete;
    expect(el.querySelectorAll("[data-ww-group-zone]")).toHaveLength(2);
    expect(el.querySelectorAll("[data-ww-group-type]")).toHaveLength(2);
    expect(el.querySelector("[data-ww-group-planes]")?.textContent).toContain(
      "250/250",
    );
    (
      el.querySelector(
        `[data-ww-group-priority="${SR_BERLIN()}"]`,
      ) as HTMLElement
    ).click();
    expect(last(f.sent)).toMatchObject({
      kind: "air_group_order",
      priority: SR_BERLIN(),
    });
    (el.querySelector("[data-ww-group-stop]") as HTMLElement).click();
    expect(last(f.sent)).toMatchObject({ zones: [], priority: 0 });
    el.remove();
  });

  it("the template editor: steppers in 25s, the total, a warning for far ranges, save", async () => {
    const { render, html } = await import("lit");
    const { renderTemplatesTab } =
      await import("../../../src/client/hud/ww1936/WwAirGroupTabs");
    const s = seaGame();
    const ctx = navyCtx(s.game as unknown as NavyGame)!;
    const root = document.createElement("div");
    const sent: WwOrder[] = [];
    let draft = { ...emptyDraft(), name: "Mix" };
    const draw = () =>
      render(
        html`${renderTemplatesTab({
          ctx,
          draft,
          setDraft: (d) => {
            draft = d ?? emptyDraft();
            draw();
          },
          send: (o) => sent.push(o),
          armedDrop: 0,
          armDrop: () => {},
        })}`,
        root,
      );
    draw();
    const click = (sel: string) =>
      (root.querySelector(sel) as HTMLElement).click();
    click('[data-ww-tpl-inc="fighter"]');
    click('[data-ww-tpl-inc="fighter"]');
    click('[data-ww-tpl-inc="strat_bomber"]');
    expect(
      root.querySelector('[data-ww-tpl-type="fighter"] [data-ww-tpl-n]')
        ?.textContent,
    ).toBe("50");
    expect(draftTotal(draft)).toBe(75);
    click("[data-ww-tpl-save]");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: "air_template",
      id: 0,
      name: "Mix",
      keep: 0,
    });
    expect((sent[0] as { planes: number[] }).planes[T("strat_bomber")]).toBe(
      25,
    );
  });
});

describe("grouped wings take no direct orders (in_group)", () => {
  it("only recon stays on the old card; [auto] wings are free", async () => {
    const { groupChips, inGroupLocked } =
      await import("../../../src/client/hud/ww1936/WingModel");
    const w = (over: object) =>
      ({ id: 1, type: T("fighter"), group: 7, auto: false, ...over }) as never;
    expect(inGroupLocked([w({})])).toBe(true);
    expect(inGroupLocked([w({ auto: true })])).toBe(false);
    expect(inGroupLocked([w({ group: 0 })])).toBe(false);
    expect(groupChips("air", [w({})]).map((c) => c.mission)).toEqual(["recon"]);
    expect(
      groupChips("air", [w({ group: 0 })]).map((c) => c.mission),
    ).toContain("interception");
  });
});
