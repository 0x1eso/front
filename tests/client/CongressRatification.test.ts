import {
  CongressData,
  WorldGovVerdictData,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  DomesticData,
  VictoryProjectProgress,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GameMode, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/domestic/DomesticDials";
import type { DomesticDials } from "../../src/client/hud/domestic/DomesticDials";
import { renderVictoryTab } from "../../src/client/hud/domestic/VictoryTab";
import type { GameView, PlayerView } from "../../src/client/view";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";
import { EMPTY } from "./CongressFixture";

const DOMESTIC: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 1,
  politicalPerSec: 1,
  techs: [],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 3,
  government: "chiefdom",
  conditions: [],
};

const OFFICE = 7;

function proclamation(ticksLeft: number): VictoryProjectProgress {
  return {
    kind: "political",
    hostUnitId: OFFICE,
    ticksLeft,
    totalTicks: 2400,
    paused: false,
  };
}

/** I (smallID 1) proclaim a world government; `congress` null: the option is off. */
function fakeGame(
  project: VictoryProjectProgress,
  congress: CongressData | null,
): { game: GameView; me: PlayerView } {
  const data = { ...DOMESTIC, project };
  const me = {
    smallID: () => 1,
    isAlive: () => true,
    type: () => PlayerType.Human,
    team: () => null,
    displayName: () => "me",
    numTilesOwned: () => 100,
    goldEarned: () => 0,
    gold: () => 0n,
    units: () => [],
    domestic: () => new DomesticClientView(data),
    domesticData: () => data,
    congressData: () => ({
      influence: 0,
      influencePerSec: 0,
      status: "peaceful",
      ballots: [],
    }),
    isFriendly: () => false,
  };
  const game = {
    myPlayer: () => me,
    playerViews: () => [me],
    playerBySmallID: () => me,
    inSpawnPhase: () => false,
    ticks: () => 900,
    numLandTiles: () => 1000,
    numTilesWithFallout: () => 0,
    elapsedGameSeconds: () => 60,
    congressData: () => congress,
    config: () => ({
      congress: () => congress !== null,
      hasInfiniteGold: () => false,
      conquestPercent: () => 80,
      maxTimerMinutes: () => null,
      gameConfig: () => ({ gameMode: GameMode.FFA }),
    }),
  } as unknown as GameView;
  return { game, me: me as unknown as PlayerView };
}

const verdict = (ratified: boolean): WorldGovVerdictData => ({
  owner: 1,
  host: OFFICE,
  ratified,
});

function victoryTab(project: VictoryProjectProgress, c: CongressData | null) {
  const { game, me } = fakeGame(project, c);
  const root = document.createElement("div");
  render(
    renderVictoryTab(game, me, me.domesticData()!, () => {}),
    root,
  );
  return root.querySelector("[data-awaiting-ratification]");
}

async function trophy(
  project: VictoryProjectProgress,
  c: CongressData | null,
): Promise<HTMLElement> {
  const el = document.createElement("domestic-dials") as DomesticDials;
  el.game = fakeGame(project, c).game;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  return el.querySelector<HTMLElement>('[data-dial="victory"]')!.parentElement!;
}

describe("a complete, unratified world government (spec §10.1)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("the victory tab says it awaits ratification", () => {
    const line = victoryTab(proclamation(0), EMPTY);
    expect(line!.textContent).toContain(
      "[domestic.victory.awaiting_ratification]",
    );
    // A rejection leaves it waiting too.
    expect(
      victoryTab(proclamation(0), { ...EMPTY, verdicts: [verdict(false)] }),
    ).not.toBeNull();
  });

  it("not while it runs, once ratified, or without the congress", () => {
    expect(victoryTab(proclamation(600), EMPTY)).toBeNull();
    expect(
      victoryTab(proclamation(0), { ...EMPTY, verdicts: [verdict(true)] }),
    ).toBeNull();
    expect(victoryTab(proclamation(0), null)).toBeNull();
  });

  it("the trophy dial waits under 100% with an hourglass", async () => {
    const waiting = await trophy(proclamation(0), EMPTY);
    const button = waiting.querySelector<HTMLElement>("[data-dial]")!;
    expect(button.dataset.state).toBe("awaiting");
    expect(button.textContent).toContain("100%");
    expect(
      waiting.querySelector("[data-dial-awaiting]")!.getAttribute("aria-label"),
    ).toBe("[domestic.victory.awaiting_ratification]");
    document.body.innerHTML = "";

    const ratified = await trophy(proclamation(0), {
      ...EMPTY,
      verdicts: [verdict(true)],
    });
    expect(
      ratified.querySelector<HTMLElement>("[data-dial]")!.dataset.state,
    ).toBe("running");
    expect(ratified.querySelector("[data-dial-awaiting]")).toBeNull();
    document.body.innerHTML = "";

    const off = await trophy(proclamation(0), null);
    expect(off.querySelector<HTMLElement>("[data-dial]")!.dataset.state).toBe(
      "running",
    );
  });
});
