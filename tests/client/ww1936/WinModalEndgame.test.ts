// @vitest-environment jsdom
// World War 1936 P5 (lane U3): who gets the "you died" screen — an exile and
// a human holding a takeover card play on, controller 0 spectates, and a
// vanilla game is unchanged. The ww branch waits for a second tick.
import { describe, expect, it, vi } from "vitest";
import { WinModal } from "../../../src/client/hud/layers/WinModal";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

function setup(o: { ww: WwEndgameView | null; alive?: boolean }) {
  const modal = new WinModal();
  const me = {
    smallID: () => 5,
    isAlive: () => o.alive ?? false,
    hasSpawned: () => true,
  };
  const m = modal as unknown as Record<string, unknown>;
  m.game = {
    myPlayer: () => me,
    myClientID: () => "c1",
    worldWarScenario: () => (o.ww ? {} : null),
    wwEndgame: () => o.ww,
    inSpawnPhase: () => false,
    updatesSinceLastTick: () => ({}),
    config: () => ({ isReplay: () => true }),
  };
  m.eventBus = { emit: () => {} };
  m.updateXp = async () => {};
  const show = vi.fn();
  m.show = show;
  return { modal, show, title: () => m._title };
}

describe("win modal in World War 1936", () => {
  it("an exile gets no death modal", () => {
    const ww = new WwEndgameView();
    ww.apply({ news: [], exiles: [{ smallID: 5 }] } as never);
    const { modal, show } = setup({ ww });
    modal.tick();
    modal.tick();
    modal.tick();
    expect(show).not.toHaveBeenCalled();
  });

  it("a takeover card holder gets none, even if the card came a tick late", () => {
    const ww = new WwEndgameView();
    const { modal, show } = setup({ ww });
    modal.tick(); // last tile lost, card not here yet
    expect(show).not.toHaveBeenCalled();
    ww.apply({ news: [], takeover: [{ client: "c1" }] } as never);
    modal.tick();
    modal.tick();
    expect(show).not.toHaveBeenCalled();
  });

  it("controller 0 sees the spectate title", () => {
    const ww = new WwEndgameView();
    ww.apply({ news: [], controllers: [["c1", 0]] });
    const { modal, show, title } = setup({ ww });
    modal.tick();
    expect(show).not.toHaveBeenCalled();
    modal.tick();
    expect(show).toHaveBeenCalledTimes(1);
    expect(title()).toBe("[ww1936.takeover.spectate]");
  });

  it("a vanilla game shows the death modal at once", () => {
    const { modal, show, title } = setup({ ww: null });
    modal.tick();
    expect(show).toHaveBeenCalledTimes(1);
    expect(title()).toBe("[win_modal.died]");
  });
});
