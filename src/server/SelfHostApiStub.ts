import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * What a self-hosted page gets for every call it would have made to
 * OpenFront's API (getApiBase() points here, src/client/SelfHosted.ts). The
 * client already treats a missing API as an ordinary outcome -- signed out,
 * an empty store, no leaderboard -- so nearly everything is a plain 404.
 * What every page load asks for is answered empty instead, in the shape the
 * client parses, so the console and the network log stay clean: news (also
 * so the client's bundled upstream news, its Discord tournaments and the
 * like, is not shown as this server's own), the cosmetics catalog
 * (CosmeticsSchema) and the live-streams feed (StreamsFeedSchema).
 */
export function selfHostApiStub(enabled: () => boolean): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled()) return next();
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET") {
      switch (req.path) {
        case "/news.json":
          res.json([]);
          return;
        case "/cosmetics.json":
          res.json({ patterns: {}, flags: {} });
          return;
        case "/streams.json":
          res.json({
            verifiedAt: new Date().toISOString(),
            featured: [],
            live: [],
          });
          return;
      }
    }
    res.status(404).json({ error: "self_hosted" });
  };
}

/**
 * Mounted on a path a self-hosted server has no use for (the desktop app's
 * release descriptor, which production builds from a CDN this server lacks):
 * a quiet 404 there instead of an error per request. Not self-hosted, every
 * request passes through.
 */
export function notOnSelfHost(enabled: () => boolean): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!enabled()) return next();
    res.status(404).json({ error: "self_hosted" });
  };
}
