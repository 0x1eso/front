import net from "net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exitOnListenError } from "../../src/server/ExitOnListenError";
import { ServerEnv } from "../../src/server/ServerEnv";

describe("ServerEnv ports", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the master on 3000 and the workers on 3001+ by default", () => {
    vi.stubEnv("MASTER_PORT", "");
    expect(ServerEnv.masterPort()).toBe(3000);
    expect(ServerEnv.workerPortByIndex(0)).toBe(3001);
    expect(ServerEnv.workerPortByIndex(1)).toBe(3002);
  });

  it("moves the master and the workers after it with MASTER_PORT", () => {
    vi.stubEnv("MASTER_PORT", "9600");
    expect(ServerEnv.masterPort()).toBe(9600);
    expect(ServerEnv.workerPortByIndex(0)).toBe(9601);
    expect(ServerEnv.workerPortByIndex(1)).toBe(9602);
  });

  it("refuses a MASTER_PORT that is not a port", () => {
    for (const bad of ["abc", "0", "70000", "3000.5"]) {
      vi.stubEnv("MASTER_PORT", bad);
      expect(() => ServerEnv.masterPort()).toThrow(/MASTER_PORT/);
    }
  });
});

describe("exitOnListenError", () => {
  const listenError = (code: string) =>
    Object.assign(new Error(`listen ${code}`), { code });

  it("names a taken port in one line and exits 1", () => {
    const server = net.createServer();
    const exit = vi.fn();
    const report = vi.fn();
    exitOnListenError(server, 3000, exit, report);
    server.emit("error", listenError("EADDRINUSE"));
    expect(report).toHaveBeenCalledWith(
      "port 3000 is already in use; stop whatever holds it first",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("reports any other listen error and exits 1", () => {
    const server = net.createServer();
    const exit = vi.fn();
    const report = vi.fn();
    exitOnListenError(server, 80, exit, report);
    server.emit("error", listenError("EACCES"));
    expect(report).toHaveBeenCalledWith(
      "could not listen on port 80: listen EACCES",
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("lets go once the server listens", () => {
    const server = net.createServer();
    const exit = vi.fn();
    exitOnListenError(server, 3000, exit, vi.fn());
    server.emit("listening");
    expect(server.listenerCount("error")).toBe(0);
    expect(exit).not.toHaveBeenCalled();
  });
});
