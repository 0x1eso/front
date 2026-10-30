// World War 1936: the air-raid notice. Strategic bombing, port strikes and
// rockets note what they hit here (victim, attacker, region); once a day
// (WwAir.tick, after the last air zone) each human victim gets one line
// naming the attacker, the region hit hardest and the damage. The same
// attacker on the same victim is told at most every RAID_NOTICE_DAYS days,
// the totals since the last notice. Message-only memory: it is neither
// snapshotted nor hashed (a restore at worst tells once more), and it
// never feeds back into the simulation.
import type { WwAir } from "./WwAir";

export const RAID_NOTICE_KEY = "events_display.ww1936_air_raid" as const;
/** Days between two notices about the same attacker and victim. */
export const RAID_NOTICE_DAYS = 3;

interface Hit {
  /** Damage weight (milli), picks the attacker and region named. */
  w: number;
  f: number;
  s: number;
}

export class RaidNotes {
  /** victim → attacker → region → hits since the attacker's last notice. */
  private pending = new Map<number, Map<number, Map<number, Hit>>>();
  /** victim × 65536 + attacker → the day of the last notice. */
  private last = new Map<number, number>();

  /** A region of `victim` took air damage from `attacker`: `f` factories stopped, `s` ships hit. */
  note(
    air: WwAir,
    victim: number,
    attacker: number,
    region: number,
    f: number,
    s: number,
    w: number,
  ): void {
    if (f <= 0 && s <= 0 && w <= 0) return;
    if (victim === attacker || !air.ww.isHumanControlled(victim)) return;
    let byA = this.pending.get(victim);
    if (byA === undefined) this.pending.set(victim, (byA = new Map()));
    let byR = byA.get(attacker);
    if (byR === undefined) byA.set(attacker, (byR = new Map()));
    const h = byR.get(region) ?? { w: 0, f: 0, s: 0 };
    h.w += w;
    h.f += f;
    h.s += s;
    byR.set(region, h);
  }

  /** The day's notices: one per victim, the attackers not told in the last RAID_NOTICE_DAYS days. */
  flush(air: WwAir, day: number): void {
    if (this.pending.size === 0) return;
    for (const victim of [...this.pending.keys()].sort((a, b) => a - b)) {
      const byA = this.pending.get(victim)!;
      const told = [...byA.keys()]
        .sort((a, b) => a - b)
        .filter((a) => {
          const at = this.last.get(victim * 65536 + a);
          return at === undefined || day - at >= RAID_NOTICE_DAYS;
        });
      if (told.length === 0) continue;
      const regions = new Map<number, number>();
      let f = 0;
      let s = 0;
      let top = told[0];
      let topW = -1;
      for (const a of told) {
        let aw = 0;
        for (const [r, h] of byA.get(a)!) {
          regions.set(r, (regions.get(r) ?? 0) + h.w);
          f += h.f;
          s += h.s;
          aw += h.w;
        }
        if (aw > topW) {
          topW = aw;
          top = a;
        }
        this.last.set(victim * 65536 + a, day);
        byA.delete(a);
      }
      if (byA.size === 0) this.pending.delete(victim);
      let region = 0;
      let rw = -1;
      for (const r of [...regions.keys()].sort((a, b) => a - b)) {
        if (regions.get(r)! > rw) {
          rw = regions.get(r)!;
          region = r;
        }
      }
      air.message(victim, RAID_NOTICE_KEY, {
        attacker: top,
        others: told.length - 1,
        region,
        more: regions.size - 1,
        // 1 factories only, 2 ships only, 3 both
        kind: (f > 0 ? 1 : 0) | (s > 0 ? 2 : 0) || 1,
        f,
        s,
      });
    }
  }
}
