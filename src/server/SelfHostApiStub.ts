import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * What a self-hosted page gets for every call it would have made to
 * OpenFront's API (getApiBase() points here, src/client/SelfHosted.ts). The
 * client already treats a missing API as an ordinary outcome -- signed out,
 * an empty store, no leaderboard -- so nearly everything is a plain 404.
 * News answers an empty list, so the client's bundled upstream news (its
 * Discord tournaments and the like) is not shown as this server's own.
 */
export function selfHostApiStub(enabled: () => boolean): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled()) return next();
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET" && req.path === "/news.json") {
      res.json([]);
      return;
    }
    res.status(404).json({ error: "self_hosted" });
  };
}
