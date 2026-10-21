// P5 lane A fills this file (plan Task 6): lend-lease (spec §13) and the
// aid orders and effects. The foundation's stub: every aid order is
// refused, no contract runs; aidView lists what the state holds.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  LendLeaseItem,
  WwAidView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwEndgame } from "./WwEndgame";

/** Spec §13.3: the sender's contracts of today (draw, convoys). Stub: nothing. */
export function stepLendLease(
  eg: WwEndgame,
  sender: number,
  day: number,
): void {
  void eg;
  void sender;
  void day;
}

/** Spec §13.3: what arrives today. Stub: nothing. */
export function deliverLendLease(eg: WwEndgame, day: number): void {
  void eg;
  void day;
}

/** lend_lease, _cancel, _request, volunteers_send, _recall, air_volunteers, ships_transfer. Stub: refused. */
export function issueAid(
  eg: WwEndgame,
  smallID: number,
  order: WwOrder,
  tick: number,
): WwOrderBlock | null {
  void eg;
  void smallID;
  void order;
  void tick;
  return "ll_conditions";
}

/**
 * P3 events (plan decision 38): after an applied option — gen_diplo_lend_lease
 * opens its contract (pre-flight §A A: the default contract when none is
 * pending). Stub: nothing.
 */
export function aidEventOption(
  eg: WwEndgame,
  eventId: string,
  optionId: string,
  self: number,
  from: number,
  tick: number,
): void {
  void eg;
  void eventId;
  void optionId;
  void self;
  void from;
  void tick;
}

/** Spec §12.2: where a volunteer army may go. Stub: nowhere. */
export function volunteerCanEnter(
  eg: WwEndgame,
  army: number,
  region: number,
): boolean {
  void eg;
  void army;
  void region;
  return false;
}

/** lend_lease / volunteers / transfer_ships / scuttle_fleet / embargo / end_embargo effects. Stub: nothing. */
export function applyAidEffect(ctx: EffectCtx, e: Effect, actor: number): void {
  void ctx;
  void e;
  void actor;
}

/** The aid tab of `id` (spec §21.4): its contracts, what comes in, its volunteers. */
export function aidView(eg: WwEndgame, id: number): WwAidView {
  const divisions = (army: number) =>
    eg.ww.land.armies.get(army)?.divisions.length ?? 0;
  return {
    smallID: id,
    contracts: eg.lendLease
      .filter((c) => c.from === id)
      .map((c) => ({
        id: c.id,
        to: c.to,
        item: c.item as LendLeaseItem,
        gen: c.gen,
        perMonth: c.perMonth,
        sentMonth: c.sentMonth,
        arrivedMonth: c.arrivedMonth,
        blocked: c.blocked,
      })),
    incoming: eg.inTransit
      .filter((t) => t.to === id)
      .map((t) => ({
        from: t.from,
        item: t.item as LendLeaseItem,
        count: Math.floor(t.countMilli / 1000),
        arriveDay: t.arriveDay,
      })),
    volunteersOut: eg.volunteers
      .filter((v) => v.from === id)
      .map((v) => ({ army: v.army, to: v.to, divisions: divisions(v.army) })),
    volunteersIn: eg.volunteers
      .filter((v) => v.to === id)
      .map((v) => ({
        army: v.army,
        from: v.from,
        divisions: divisions(v.army),
      })),
  };
}
