import type { Server } from "net";

// A server that cannot listen is useless: say why in one plain line and
// exit 1. Unhandled, the error killed the master with a stack trace, and its
// already-forked workers then failed their first message to it with EPIPE,
// which buried the cause (game-night.sh starting beside a running server).
// Only until the server listens: later errors behave as before.
export function exitOnListenError(
  server: Server,
  port: number,
  exit: (code: number) => void = (code) => process.exit(code),
  report: (line: string) => void = (line) => console.error(line),
): void {
  const onError = (err: NodeJS.ErrnoException) => {
    report(
      err.code === "EADDRINUSE"
        ? `port ${port} is already in use; stop whatever holds it first`
        : `could not listen on port ${port}: ${err.message}`,
    );
    exit(1);
  };
  server.once("error", onError);
  server.once("listening", () => server.off("error", onError));
}
