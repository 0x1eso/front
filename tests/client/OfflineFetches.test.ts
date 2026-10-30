import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStreams } from "../../src/client/Api";
import { ClientEnv } from "../../src/client/ClientEnv";
import { fetchCosmetics } from "../../src/client/Cosmetics";
import { setOffline } from "../../src/client/pwa/OfflineState";
import { startSingleplayerHeartbeat } from "../../src/client/SingleplayerHeartbeat";

// Offline, the menu and a solo game must not keep firing requests that can
// only fail (each one is a console error, and some retry on a timer).
describe("requests that cannot work offline are not made", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.BOOTSTRAP_CONFIG = {
      gameEnv: "dev",
      numWorkers: 1,
      turnstileSiteKey: "",
      jwtAudience: "test",
      instanceId: "test",
      gitCommit: "test",
      selfHosted: true,
    };
    ClientEnv.reset();
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));
    setOffline(true);
  });

  afterEach(() => {
    setOffline(false);
    fetchSpy.mockRestore();
    window.BOOTSTRAP_CONFIG = undefined;
    ClientEnv.reset();
  });

  it("control: online, each of them does ask", async () => {
    setOffline(false);
    await getStreams();
    await fetchCosmetics();
    startSingleplayerHeartbeat("AbCdEfGh")();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("the streams feed falls back to the bundled copy", async () => {
    const feed = await getStreams();
    expect(feed.live).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the cosmetics catalog is simply absent", async () => {
    expect(await fetchCosmetics()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a solo game sends no heartbeat", () => {
    const stop = startSingleplayerHeartbeat("AbCdEfGh");
    stop();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
