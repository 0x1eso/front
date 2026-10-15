import { StreamsFeedSchema } from "@openfront/shared/ApiSchemas";
import { CosmeticsSchema } from "@openfront/shared/CosmeticSchemas";
import { SELF_HOST_API_PREFIX } from "@openfront/shared/SelfHost";
import express from "express";
import http from "http";
import net, { type AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, test } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  notOnSelfHost,
  selfHostApiStub,
} from "../../src/server/SelfHostApiStub";
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
      ["GET", "/leaderboard/ranked"],
    ]) {
      const res = await fetch(
        `http://${masterHost}${SELF_HOST_API_PREFIX}${path}`,
        { method },
      );
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await res.json()).toEqual({ error: "self_hosted" });
    }
  });

  // Every page load asks for these. Empty answers in the shapes the client
  // parses keep the console and the network log free of errors.
  it("answers an empty cosmetics catalog and streams feed", async () => {
    const cosmetics = await fetch(
      `http://${masterHost}${SELF_HOST_API_PREFIX}/cosmetics.json?rail=web`,
    );
    expect(cosmetics.status).toBe(200);
    const catalog = CosmeticsSchema.parse(await cosmetics.json());
    expect(catalog.patterns).toEqual({});
    expect(catalog.flags).toEqual({});
    expect(catalog.subscriptions).toBeUndefined();

    const streams = await fetch(
      `http://${masterHost}${SELF_HOST_API_PREFIX}/streams.json`,
    );
    expect(streams.status).toBe(200);
    const feed = StreamsFeedSchema.parse(await streams.json());
    expect(feed.featured).toEqual([]);
    expect(feed.live).toEqual([]);

    const post = await fetch(
      `http://${masterHost}${SELF_HOST_API_PREFIX}/cosmetics.json`,
      { method: "POST" },
    );
    expect(post.status).toBe(404);
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

// A connection that ends early on one side must end on the other: a player
// closing the tab mid-download must not leave the worker streaming into the
// void, an abandoned upload must not leave the worker waiting for the rest,
// and a worker dying mid-response must not leave the player waiting forever.
describe("early endings through the master", () => {
  let worker: http.Server;
  let master: http.Server;
  let masterPort: number;
  const events: string[] = [];

  function waitFor(event: string, ms = 2000): Promise<boolean> {
    return new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (events.includes(event)) return resolve(true);
        if (Date.now() - started > ms) return resolve(false);
        setTimeout(check, 20);
      };
      check();
    });
  }

  beforeEach(async () => {
    events.length = 0;
    worker = http.createServer((req, res) => {
      if (req.url === "/slow") {
        res.writeHead(200);
        const timer = setInterval(() => res.write("x".repeat(1000)), 20);
        res.on("close", () => {
          clearInterval(timer);
          events.push(res.writableFinished ? "slow finished" : "slow cut");
        });
        setTimeout(() => res.end(), 5000);
        return;
      }
      if (req.url === "/die") {
        res.writeHead(200);
        res.write("partial");
        setTimeout(() => req.socket.destroy(), 50);
        return;
      }
      req.on("close", () =>
        events.push(req.complete ? "upload complete" : "upload cut"),
      );
      req.resume();
      req.on("end", () => res.end("ok"));
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
    masterPort = await listen(master);
  });

  afterEach(async () => {
    await close(master);
    await close(worker);
  });

  it("stops the worker's response when the player goes away", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        { host: "127.0.0.1", port: masterPort, path: "/w0/slow", agent: false },
        (res) => {
          res.once("data", () => {
            req.destroy();
            resolve();
          });
        },
      );
      req.on("error", (error) => {
        if (!req.destroyed) reject(error);
      });
    });
    expect(await waitFor("slow cut")).toBe(true);
  });

  it("ends the worker's request when the player abandons an upload", async () => {
    const socket = net.connect(masterPort, "127.0.0.1");
    await new Promise((resolve) => socket.once("connect", resolve));
    socket.write(
      "POST /w0/upload HTTP/1.1\r\nHost: x\r\nContent-Length: 100000\r\n\r\nabc",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    socket.destroy();
    expect(await waitFor("upload cut")).toBe(true);
  });

  it("ends the player's response when the worker dies mid-way", async () => {
    const outcome = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve("hung"), 2000);
      http
        .get(
          {
            host: "127.0.0.1",
            port: masterPort,
            path: "/w0/die",
            agent: false,
          },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => resolve("ended cleanly"));
            res.on("error", () => resolve("cut"));
            res.on("aborted", () => resolve("cut"));
          },
        )
        .on("error", () => resolve("cut"))
        .on("close", () => clearTimeout(timer));
    });
    expect(outcome).toBe("cut");
  });

  it("still forwards a whole upload", async () => {
    const res = await fetch(`http://127.0.0.1:${masterPort}/w0/upload`, {
      method: "POST",
      body: "x".repeat(100_000),
    });
    expect(await res.text()).toBe("ok");
    expect(await waitFor("upload complete")).toBe(true);
  });
});

// The desktop (Steam) release descriptor needs a CDN in production, which a
// self-hosted server has not: it answered 500 and logged an error per poll.
describe("routes a self-hosted server has no use for", () => {
  let server: http.Server;
  let base: string;
  let enabled: boolean;
  let reached: number;

  beforeEach(async () => {
    enabled = true;
    reached = 0;
    const app = express();
    app.use(
      "/desktop",
      notOnSelfHost(() => enabled),
    );
    app.get("/desktop/version.json", (_req, res) => {
      reached++;
      res.status(500).json({ error: "unavailable" });
    });
    server = http.createServer(app);
    base = `http://127.0.0.1:${await listen(server)}`;
  });

  afterEach(async () => {
    await close(server);
  });

  it("answer 404 without reaching their handler", async () => {
    const res = await fetch(`${base}/desktop/version.json`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "self_hosted" });
    expect(reached).toBe(0);
  });

  it("reach their handler when the server is not self-hosted", async () => {
    enabled = false;
    expect((await fetch(`${base}/desktop/version.json`)).status).toBe(500);
    expect(reached).toBe(1);
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
