// Imjin sea supremacy (ww175 design §6.3: "Supremacy.ts stays for the AI's
// estimates only"): a sea region's supremacy by side from the tile fleets
// in its zones, in the 1936 shape (WwNavy.setSupremacy), so the kept
// invasion and sea supply code reads the new layer.
import { MT } from "@openfront/engine-lib/imjin/SeaRules";
import { supremacyPm } from "@openfront/engine-lib/ww1936/NavalRules";
import type { WwNavy } from "../../ww1936/navy/WwNavy";
import type { WwImjin } from "../WwImjin";
import { fleetStrength } from "./SeaAi";

export function imjinSupremacyRegion(
  im: WwImjin,
  navy: WwNavy,
  sr: number,
): void {
  const sc = navy.scenario;
  const map = im.mg.map();
  const power = new Map<number, number>();
  for (const f of im.st.sea.fleets) {
    if (f.ships.length === 0 || f.fleeing) continue;
    const t = map.ref(Math.floor(f.x / MT), Math.floor(f.y / MT));
    if (sc.zoneSr(sc.regionAt(t)) !== sr) continue;
    const side = navy.sideOf(f.owner);
    power.set(side, (power.get(side) ?? 0) + fleetStrength(im.st.sea, f));
  }
  const keys = [...power.keys()].sort((a, b) => a - b);
  const members = new Map<number, readonly number[]>();
  for (const x of navy.sideList()) members.set(x.key, x.members);
  const atWar = (a: number, b: number) =>
    (members.get(a) ?? []).some((x) =>
      (members.get(b) ?? []).some((y) => navy.isEnemy(x, y)),
    );
  const out = new Map<number, number>();
  for (const side of keys) {
    let enemies = 0;
    for (const other of keys) {
      if (other !== side && atWar(side, other)) enemies += power.get(other)!;
    }
    out.set(side, supremacyPm(power.get(side)!, enemies));
  }
  navy.setSupremacy(sr, out);
}

/** A country's tile fleets' power (AiNavy.routePower in Imjin). */
export function imjinPowerOf(im: WwImjin, me: number): number {
  let v = 0;
  for (const f of im.st.sea.fleets) {
    if (f.owner === me && f.ships.length > 0) v += fleetStrength(im.st.sea, f);
  }
  return v;
}

/** The enemies' tile fleet power by sea region (AiNavy.enemySupBySr in Imjin). */
export function imjinEnemyPowerBySr(
  im: WwImjin,
  navy: WwNavy,
  me: number,
): Map<number, number> {
  const sc = navy.scenario;
  const map = im.mg.map();
  const out = new Map<number, number>();
  for (const f of im.st.sea.fleets) {
    if (f.ships.length === 0 || !navy.land.isEnemy(me, f.owner)) continue;
    const t = map.ref(Math.floor(f.x / MT), Math.floor(f.y / MT));
    const sr = sc.zoneSr(sc.regionAt(t));
    if (sr === 0) continue;
    out.set(sr, (out.get(sr) ?? 0) + fleetStrength(im.st.sea, f));
  }
  return out;
}
