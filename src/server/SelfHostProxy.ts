import type { NextFunction, Request, RequestHandler, Response } from "express";
import http from "http";
import net from "net";
import type { Duplex } from "stream";

/**
 * Stands in for nginx.conf on a self-hosted server, where the tunnel reaches
 * the master's port alone: /w<N>/... goes to worker N with the prefix
 * stripped (nginx's `proxy_pass http://127.0.0.1:$worker_port$2`), the
 * game-creating POSTs go to a worker picked at random (nginx's
 * openfront_workers upstream), and WebSocket upgrades follow the same rule.
 */
export interface WorkerRouting {
  numWorkers: number;
  /** Port worker `index` listens on (ServerEnv.workerPortByIndex). */
  portOf: (index: number) => number;
  /** Worker index for a new game, in [0, numWorkers). */
  pick: () => number;
}

export interface WorkerTarget {
  port: number;
  /** Path and query string to ask the worker for. */
  path: string;
}

// The POSTs nginx spreads across workers (nginx.conf `location =` blocks).
const RANDOM_WORKER_POSTS = new Set([
  "/api/create_game",
  "/api/adminbot/create_game",
  "/api/adminbot/create_pool",
]);

/**
 * The client address the worker should see. Mirrors nginx.conf's
 * `proxy_add_x_forwarded_for`: an incoming X-Forwarded-For (cloudflared sets
 * it) is kept and the connecting socket's address is appended, so the
 * worker's `trust proxy` setting resolves the same client as it did behind
 * nginx. The master is the only public entry point, so an incoming header is
 * trusted no more than nginx trusted it.
 */
export function forwardedFor(req: http.IncomingMessage): string {
  const remote = req.socket.remoteAddress ?? "unknown";
  const incoming = req.headers["x-forwarded-for"];
  const prior = Array.isArray(incoming) ? incoming.join(", ") : incoming;
  return prior ? `${prior}, ${remote}` : remote;
}

/**
 * The address for headers the worker reads directly: Cloudflare's
 * CF-Connecting-IP when present (the worker's WebSocket handler reads it),
 * else the connecting socket, which the worker would otherwise see as the
 * master's own 127.0.0.1.
 */
function connectingIp(req: http.IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  return req.socket.remoteAddress ?? "unknown";
}

/** Which worker serves a request, or null when the master serves it. */
export function workerTarget(
  method: string,
  url: string,
  routing: WorkerRouting,
): WorkerTarget | null {
  const queryStart = url.indexOf("?");
  const pathname = queryStart === -1 ? url : url.slice(0, queryStart);
  const query = queryStart === -1 ? "" : url.slice(queryStart);

  const prefixed = /^\/w(\d+)(\/.*)?$/.exec(pathname);
  if (prefixed !== null) {
    const index = Number(prefixed[1]);
    if (index >= routing.numWorkers) return null;
    return {
      port: routing.portOf(index),
      path: `${prefixed[2] ?? "/"}${query}`,
    };
  }
  if (method === "POST" && RANDOM_WORKER_POSTS.has(pathname)) {
    return { port: routing.portOf(routing.pick()), path: url };
  }
  return null;
}

/**
 * Express middleware forwarding worker requests. Mount it before any body
 * parser: it streams the untouched request body to the worker.
 */
export function proxyToWorkers(
  enabled: () => boolean,
  routing: () => WorkerRouting,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled()) return next();
    const target = workerTarget(req.method, req.url, routing());
    if (target === null) return next();
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: target.port,
        method: req.method,
        path: target.path,
        headers: {
          ...req.headers,
          "x-forwarded-for": forwardedFor(req),
          "cf-connecting-ip": connectingIp(req),
        },
      },
      (workerRes) => {
        res.writeHead(workerRes.statusCode ?? 502, workerRes.headers);
        workerRes.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.status(502).json({ error: "worker unavailable" });
    });
    req.pipe(upstream);
  };
}

/**
 * Hands a WebSocket upgrade to its worker over a raw TCP connection, replaying
 * the request head with the worker path. False when the URL names no worker;
 * the caller then refuses the upgrade.
 */
export function proxyUpgradeToWorker(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  routing: WorkerRouting,
): boolean {
  const target = workerTarget(req.method ?? "GET", req.url ?? "", routing);
  if (target === null) return false;
  const upstream = net.connect(target.port, "127.0.0.1", () => {
    const lines = [`${req.method} ${target.path} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i].toLowerCase();
      if (name === "x-forwarded-for" || name === "cf-connecting-ip") continue;
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    lines.push(`X-Forwarded-For: ${forwardedFor(req)}`);
    lines.push(`CF-Connecting-IP: ${connectingIp(req)}`);
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const closeBoth = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on("error", closeBoth);
  socket.on("error", closeBoth);
  upstream.on("close", () => socket.destroy());
  socket.on("close", () => upstream.destroy());
  return true;
}
