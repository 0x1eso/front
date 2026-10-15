import { SELF_HOST_API_PREFIX } from "@openfront/shared/SelfHost";
import express from "express";
import http from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, test } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { selfHostApiStub } from "../../src/server/SelfHostApiStub";
import {
  connectingIp,
  proxyToWorkers,
  proxyUpgradeToWorker,
  workerTarget,
  type WorkerRouting,
} from "../../src/server/SelfHostProxy";

const ROUTING: WorkerRouting = {
  numWorkers: 2,
  portOf: (index) => 3001 + index,
  pick: () => 1,
};

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port),
    ),
  );
}

function close(server: http.Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.once("message", (data) => resolve(String(data)));
    ws.once("error", reject);
  });
}

// nginx.conf's worker routing, which the master takes over when self-hosted.
describe("workerTarget", () => {
  test.each([
    ["GET", "/w0/lobbies", { port: 3001, path: "/lobbies" }],
    [
      "GET",
      "/w1/api/game/abcdefgh/exists?x=1",
      { port: 3002, path: "/api/game/abcdefgh/exists?x=1" },
    ],
    ["GET", "/w1", { port: 3002, path: "/" }],
    ["GET", "/w1?a=b", { port: 3002, path: "/?a=b" }],
    ["POST", "/api/create_game", { port: 3002, path: "/api/create_game" }],
    [
      "POST",
      "/api/adminbot/create_pool",
      { port: 3002, path: "/api/adminbot/create_pool" },
    ],
  ])("%s %s goes to a worker", (method, url, target) => {
    expect(workerTarget(method, url, ROUTING)).toEqual(target);
  });

  test.each([
    ["GET", "/"],
    ["GET", "/api/health"],
    ["GET", "/api/create_game"],
    ["GET", "/w2/lobbies"],
    ["GET", "/w0abc"],
    ["GET", "/_assets/images/Emblem.abc.svg"],
  ])("%s %s stays on the master", (method, url) => {
    expect(workerTarget(method, url, ROUTING)).toBeNull();
  });
});

describe("master in front of a worker", () => {
  let worker: http.Server;
  let wss: WebSocketServer;
  let master: http.Server;
  let masterHost: string;
  let enabled: boolean;
  const seen: { method: string; url: string; body: string }[] = [];

  beforeEach(async () => {
    seen.length = 0;
    enabled = true;

    worker = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        seen.push({ method: req.method ?? "", url: req.url ?? "", body });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ from: "worker", url: req.url }));
      });
    });
    wss = new WebSocketServer({ server: worker });
    wss.on("connection", (ws, req) => {
      ws.send(`hello ${req.url}`);
      ws.on("message", (message) => ws.send(`echo ${message}`));
    });
    const workerPort = await listen(worker);

    const routing = (): WorkerRouting => ({
      numWorkers: 1,
      portOf: () => workerPort,
      pick: () => 0,
    });
    const app = express();
    app.use(proxyToWorkers(() => enabled, routing));
    app.use(express.json());
    app.post("/api/echo", (req, res) => {
      res.json({ from: "master", body: req.body });
    });
    app.use(
      SELF_HOST_API_PREFIX,
      selfHostApiStub(() => enabled),
    );
    app.get("/{*splat}", (_req, res) => {
      res.send("master shell");
    });
    master = http.createServer(app);
    master.on("upgrade", (req, socket, head) => {
      if (!enabled || !proxyUpgradeToWorker(req, socket, head, routing())) {
        socket.destroy();
      }
    });
    masterHost = `127.0.0.1:${await listen(master)}`;
  });

  afterEach(async () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
    await close(master);
    await close(worker);
  });

  it("forwards /wN requests with the prefix stripped", async () => {
    const res = await fetch(
      `http://${masterHost}/w0/api/game/abcdefgh/exists?x=1`,
    );
    expect(await res.json()).toEqual({
      from: "worker",
      url: "/api/game/abcdefgh/exists?x=1",
    });
  });

  it("forwards game creation with its body intact", async () => {
    const res = await fetch(`http://${masterHost}/api/create_game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameMap: "World" }),
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual([
      {
        method: "POST",
        url: "/api/create_game",
        body: JSON.stringify({ gameMap: "World" }),
      },
    ]);
  });

  it("leaves the master's own routes and bodies alone", async () => {
    expect(await (await fetch(`http://${masterHost}/`)).text()).toBe(
      "master shell",
    );
    const res = await fetch(`http://${masterHost}/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await res.json()).toEqual({ from: "master", body: { a: 1 } });
    expect(seen).toEqual([]);
  });

  it("proxies a WebSocket upgrade to the worker, prefix stripped", async () => {
    const ws = new WebSocket(`ws://${masterHost}/w0/lobbies?platform=web`);
    expect(await nextMessage(ws)).toBe("hello /lobbies?platform=web");
    ws.send("ping");
    expect(await nextMessage(ws)).toBe("echo ping");
    ws.close();
  });

  it("answers 502 when the worker is down", async () => {
    await close(worker);
    const res = await fetch(`http://${masterHost}/w0/api/game/abcdefgh`);
    expect(res.status).toBe(502);
  });

  it("does nothing when the server is not self-hosted", async () => {
    enabled = false;
    expect(await (await fetch(`http://${masterHost}/w0/lobbies`)).text()).toBe(
      "master shell",
    );
    expect(
      await (
        await fetch(`http://${masterHost}${SELF_HOST_API_PREFIX}/news.json`)
      ).text(),
    ).toBe("master shell");
  });

  it("answers the page's API calls itself", async () => {
    const news = await fetch(
      `http://${masterHost}${SELF_HOST_API_PREFIX}/news.json`,
    );
    expect(news.status).toBe(200);
    expect(await news.json()).toEqual([]);

    for (const [method, path] of [
      ["GET", "/users/@me"],
      ["POST", "/auth/refresh"],
      ["GET", "/cosmetics.json?rail=web"],
    ]) {
      const res = await fetch(
        `http://${masterHost}${SELF_HOST_API_PREFIX}${path}`,
        { method },
      );
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await res.json()).toEqual({ error: "self_hosted" });
    }
  });
});

// The worker sees each friend's own address, as it did behind nginx: HTTP
// through Express's `trust proxy` (Worker.ts, 3 hops) on X-Forwarded-For, and
// WebSockets through CF-Connecting-IP else the socket (Worker.ts getClientIp).
describe("client addresses through the master", () => {
  let worker: http.Server;
  let wss: WebSocketServer;
  let master: http.Server;
  let masterPort: number;
  const httpIps: string[] = [];
  const wsIps: string[] = [];

  beforeEach(async () => {
    httpIps.length = 0;
    wsIps.length = 0;
    const app = express();
    app.set("trust proxy", 3);
    app.get("/ip", (req, res) => {
      httpIps.push(req.ip ?? "");
      res.end("ok");
    });
    worker = http.createServer(app);
    wss = new WebSocketServer({ server: worker });
    wss.on("connection", (ws, req) => {
      const cf = req.headers["cf-connecting-ip"];
      wsIps.push(
        typeof cf === "string" && cf ? cf : (req.socket.remoteAddress ?? ""),
      );
      ws.send("hi");
    });
    const workerPort = await listen(worker);
    const routing = (): WorkerRouting => ({
      numWorkers: 1,
      portOf: () => workerPort,
      pick: () => 0,
    });
    const front = express();
    front.use(proxyToWorkers(() => true, routing));
    master = http.createServer(front);
    master.on("upgrade", (req, socket, head) => {
      if (!proxyUpgradeToWorker(req, socket, head, routing())) socket.destroy();
    });
    masterPort = await listen(master);
  });

  afterEach(async () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
    await close(master);
    await close(worker);
  });

  function get(from: string, headers: http.OutgoingHttpHeaders = {}) {
    return new Promise<void>((resolve, reject) => {
      http
        .get(
          {
            host: "127.0.0.1",
            port: masterPort,
            path: "/w0/ip",
            localAddress: from,
            headers,
            agent: false,
          },
          (res) => {
            res.resume();
            res.on("end", resolve);
          },
        )
        .on("error", reject);
    });
  }

  function connect(from: string, headers: http.OutgoingHttpHeaders = {}) {
    const ws = new WebSocket(`ws://127.0.0.1:${masterPort}/w0/lobbies`, {
      localAddress: from,
      headers,
    });
    return nextMessage(ws).then(() => ws.close());
  }

  it("tells the worker apart direct clients on HTTP", async () => {
    await get("127.0.0.2");
    await get("127.0.0.3");
    expect(httpIps).toEqual(["127.0.0.2", "127.0.0.3"]);
  });

  it("tells the worker apart direct clients on WebSocket", async () => {
    await connect("127.0.0.2");
    await connect("127.0.0.3");
    expect(wsIps).toEqual(["127.0.0.2", "127.0.0.3"]);
  });

  it("ignores a forged X-Forwarded-For chain", async () => {
    await get("127.0.0.2", { "x-forwarded-for": "1.2.3.4" });
    await get("127.0.0.1", {
      "x-forwarded-for": "1.2.3.4, 198.51.100.9",
      "cf-connecting-ip": "203.0.113.7",
    });
    expect(httpIps).toEqual(["127.0.0.2", "203.0.113.7"]);

    await connect("127.0.0.2", { "x-forwarded-for": "1.2.3.4" });
    expect(wsIps).toEqual(["127.0.0.2"]);
  });

  it("keeps the client a tunnel reports", async () => {
    await get("127.0.0.1", { "cf-connecting-ip": "203.0.113.7" });
    await get("127.0.0.1", { "cf-connecting-ip": "203.0.113.8" });
    expect(httpIps).toEqual(["203.0.113.7", "203.0.113.8"]);

    await connect("127.0.0.1", { "cf-connecting-ip": "203.0.113.7" });
    await connect("127.0.0.1", { "cf-connecting-ip": "203.0.113.8" });
    expect(wsIps).toEqual(["203.0.113.7", "203.0.113.8"]);
  });
});

describe("master rate limit key", () => {
  it("is the tunnel-reported address, not a forged X-Forwarded-For", () => {
    const req = (headers: Record<string, string>) =>
      ({ headers, socket: { remoteAddress: "127.0.0.9" } }) as never;
    expect(connectingIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBe(
      "127.0.0.9",
    );
    expect(
      connectingIp(
        req({
          "x-forwarded-for": "1.2.3.4",
          "cf-connecting-ip": "203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });
});
