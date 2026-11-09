import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { GwShape, warReport, warShape } from "./sim/WarSim";

const run = async (tag: "DEU" | "GBR" | "AUH" | "RUS" | "FRA", n: number) => {
  const out: GwShape[] = [];
  for (let i = 0; i < n; i++) out.push(await warShape(`WS${tag}${i}`, tag));
  return out;
};

describe("war shape", () => {
  test("report", async () => {
    const n = Number(process.env.GW_WAR_N ?? 6);
    const text: string[] = [];
    for (const tag of ["DEU", "GBR", "AUH", "RUS", "FRA"] as const) {
      const shapes = await run(tag, n);
      text.push(`== seat ${tag} ==`, warReport(shapes));
      expect(shapes.length).toBe(n);
      if (process.env.GW_WAR_DUMP !== undefined) {
        text.push(...shapes[Number(process.env.GW_WAR_DUMP)].trace);
      }
    }
    if (process.env.GW_WAR_OUT !== undefined) {
      fs.writeFileSync(process.env.GW_WAR_OUT, text.join("\n"));
    }
  }, 300000);
});
