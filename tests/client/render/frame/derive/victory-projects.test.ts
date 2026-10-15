import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { describe, expect, it } from "vitest";
import { deriveVictoryProjects } from "../../../../../src/client/render/frame/derive/VictoryProjects";

const RUNNING = {
  kind: "science" as const,
  hostUnitId: 7,
  ticksLeft: 600,
  totalTicks: 2400,
  paused: false,
};

function source(alive: boolean, project?: DomesticData["project"]) {
  const data = (project === undefined ? {} : { project }) as DomesticData;
  return { isAlive: () => alive, domesticData: () => data };
}

describe("deriveVictoryProjects", () => {
  it("maps each running project's host to its progress", () => {
    const map = deriveVictoryProjects([
      source(true, RUNNING),
      source(true),
      { isAlive: () => true, domesticData: () => null },
    ]);
    expect([...map]).toEqual([[7, 0.75]]);
  });

  it("skips dead players", () => {
    expect(deriveVictoryProjects([source(false, RUNNING)]).size).toBe(0);
  });
});
