// @vitest-environment jsdom
/**
 * World War 1936 client per-tick costs, headless (no browser): see
 * WwClientPerfRun.ts. Skipped unless WW_PERF_FIXTURE names a recording
 * made by WwRecord.ts:
 *
 *   npx tsx tests/perf/client/WwRecord.ts --out /tmp/ww.bin.gz
 *   WW_PERF_FIXTURE=/tmp/ww.bin.gz [WW_PERF_OUT=report.txt] \
 *     [WW_PERF_CHECK=1] [WW_PERF_PROFILE=out.cpuprofile] [WW_PERF_HEAP=1] \
 *     node --max-semi-space-size=256 node_modules/vitest/vitest.mjs run \
 *       tests/perf/client/WwClientPerf.test.ts
 */
import { describe, it } from "vitest";

const FIXTURE = process.env.WW_PERF_FIXTURE ?? "";

describe.skipIf(FIXTURE === "")("World War 1936 client per-tick costs", () => {
  it(
    "replays the recorded game",
    async () => {
      const { runWwClientPerf } = await import("./WwClientPerfRun");
      await runWwClientPerf();
    },
    30 * 60_000,
  );
});
