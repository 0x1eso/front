import { SELF_HOST_API_PREFIX } from "@openfront/shared/SelfHost";

/**
 * Whether this page was served by a self-hosted server (SELF_HOSTED=true,
 * README "자체 호스팅"): one with no OpenFront API behind it.
 *
 * Read straight from BOOTSTRAP_CONFIG rather than through ClientEnv: many
 * tests replace ClientEnv with a partial mock, and a gate that called a method
 * those mocks lack would throw in the code paths they exercise. A page with
 * no config reads as not self-hosted, which is upstream's behaviour.
 */
export function isSelfHosted(): boolean {
  return (
    typeof window !== "undefined" &&
    window.BOOTSTRAP_CONFIG?.selfHosted === true
  );
}

/**
 * Where a self-hosted page sends what would have gone to the API: its own
 * server's stub (src/server/SelfHostApiStub.ts).
 */
export function selfHostApiBase(): string {
  return `${window.location.origin}${SELF_HOST_API_PREFIX}`;
}

/** Whether this page asks Cloudflare Turnstile for a token before a join. */
export function turnstileRequired(): boolean {
  return !isSelfHosted();
}
