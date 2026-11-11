// STUB: owner I0a
export type WwScenarioId = "ww1936" | "imjin1590";

export function scenarioOf(cfg: { ww1936Scenario?: string }): WwScenarioId {
  return cfg.ww1936Scenario === "imjin1590" ? "imjin1590" : "ww1936";
}

export function isImjin(cfg: { ww1936Scenario?: string }): boolean {
  return scenarioOf(cfg) === "imjin1590";
}
