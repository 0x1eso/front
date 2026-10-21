// World War 1936 P4 (plan Task 14): the navy and air screens' texts and the
// notification keys exist in en and ko with the same ICU arguments.
import { AIR_MISSIONS } from "@openfront/engine-api/ww1936/AirTypes";
import {
  CONVOY_USES,
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FLEET_STATES,
  INVASION_STATES,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import fs from "fs";
import IntlMessageFormat from "intl-messageformat";
import path from "path";
import { describe, expect, it } from "vitest";
import { en, hasKey, keyIn, ko } from "./contentUtil";

const EVENTS = [
  "air_superiority",
  "bombed",
  "convoys_lost",
  "convoys_sunk",
  "fleet_out_of_fuel",
  "fleet_scuttled",
  "fuel_shortage",
  "invasion_aborted",
  "invasion_failed",
  "invasion_landed",
  "invasion_launched",
  "invasion_ready",
  "naval_battle",
  "naval_line_done",
  "naval_line_stalled",
  "port_captured",
  "ship_commissioned",
  "ship_sunk",
  "ship_sunk_named",
].map((k) => `events_display.ww1936_${k}`);

const LISTS: string[] = [
  ...SHIP_CLASSES.map((c) => `ww1936.ship_class.${c}`),
  ...SHIP_CLASSES.map((c) => `ww1936.ship_count.${c}`),
  ...[1, 2, 3, 4].map((g) => `ww1936.ship_gen.${g}`),
  ...FLEET_MISSIONS.flatMap((m) => [
    `ww1936.mission.${m}`,
    `ww1936.mission_desc.${m}`,
  ]),
  ...ENGAGE_RULES.flatMap((m) => [
    `ww1936.engage.${m}`,
    `ww1936.engage_desc.${m}`,
  ]),
  ...FLEET_STATES.map((s) => `ww1936.fleet_state.${s}`),
  ...AIR_MISSIONS.map((m) => `ww1936.air_mission.${m}`),
  ...[...CONVOY_USES, "idle"].map((u) => `ww1936.convoy_use.${u}`),
  ...INVASION_STATES.map((s) => `ww1936.invasion_state.${s}`),
  ...["air", "fuel", "landing", "coastal_fort", "shore_bombard"].map(
    (m) => `ww1936.mod.${m}`,
  ),
];

const SCREEN = [
  "navy.dial_navy",
  "navy.band_fuel",
  "navy.btn_mission",
  "navy.btn_move",
  "navy.btn_return",
  "navy.btn_engage",
  "navy.btn_split",
  "navy.btn_merge",
  "navy.btn_port_strike",
  "navy.btn_auto",
  "navy.btn_more",
  "navy.state_on_station",
  "navy.state_sortie",
  "navy.state_battle",
  "navy.state_repairing",
  "navy.state_returning",
  "navy.tab_fleets",
  "navy.tab_shipyards",
  "navy.tab_convoys",
  "navy.tab_admirals",
  "navy.docks_line",
  "navy.next_launch",
  "navy.convoys_line",
  "navy.invasion_prep",
  "navy.invasion_execute",
  "navy.route_chip_ok",
  "navy.route_chip_low",
  "air.dial_air",
  "air.tab_zones",
  "air.tab_planes",
  "air.tab_bases",
  "air.tab_record",
  "air.zone_sup",
  "air.slider_count",
  "air.result_line",
].map((k) => `ww1936.${k}`);

const argNames = (text: string, lang: string): string[] => {
  const out = new Set<string>();
  const walk = (nodes: any[]): void => {
    for (const n of nodes) {
      if (n.type !== 0 && typeof n.value === "string") out.add(n.value);
      if (n.options) {
        for (const o of Object.values<any>(n.options)) walk(o.value);
      }
    }
  };
  walk(new IntlMessageFormat(text, lang).getAst() as any[]);
  return [...out].sort();
};

const screenKeys = (json: unknown): string[] => {
  const out: string[] = [];
  const walk = (o: unknown, at: string) => {
    if (typeof o === "string") out.push(at);
    else if (typeof o === "object" && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    }
  };
  const root = json as Record<string, Record<string, unknown>>;
  for (const g of ["navy", "air"]) walk(root.ww1936[g], `ww1936.${g}`);
  return out;
};

describe("P4 navy and air translations", () => {
  it("every list, screen and notification key has en and ko text", () => {
    for (const k of [...LISTS, ...SCREEN, ...EVENTS]) {
      expect(hasKey(k), k).toBe(true);
    }
  });

  it("en and ko use the same ICU arguments", () => {
    const keys = [...LISTS, ...EVENTS, ...screenKeys(en)];
    for (const k of keys) {
      const e = keyIn(en, k);
      const o = keyIn(ko, k);
      expect(e, `en ${k}`).toBeDefined();
      expect(o, `ko ${k}`).toBeDefined();
      expect(argNames(o!, "ko"), k).toEqual(argNames(e!, "en"));
    }
  });

  it("ko has the same navy and air keys as en", () => {
    expect(screenKeys(ko).sort()).toEqual(screenKeys(en).sort());
  });

  it("every ww1936_ key the engine emits for navy, air and economy has a text", () => {
    const root = path.join(__dirname, "../../packages/engine/src/ww1936");
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith(".ts")) {
          const src = fs.readFileSync(p, "utf8");
          for (const m of src.matchAll(/"(ww1936_[a-z_]+)"/g)) {
            found.add(m[1]);
          }
        }
      }
    };
    for (const d of ["navy", "air", "economy"]) walk(path.join(root, d));
    for (const k of found) {
      expect(hasKey(`events_display.${k}`), k).toBe(true);
    }
  });

  it("no HOI4 doctrine phrase is used", () => {
    const text = [...LISTS, ...EVENTS, ...screenKeys(en)]
      .map((k) => keyIn(en, k))
      .join("\n");
    expect(text).not.toMatch(
      /Air Superiority|Trade Interdiction|Fleet in Being/i,
    );
  });
});
