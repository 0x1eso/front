/**
 * Where a self-hosted page sends what would have gone to OpenFront's API
 * (src/client/SelfHosted.ts), and where the master answers it
 * (src/server/SelfHostApiStub.ts). Same origin, so nothing leaves for an
 * api.<domain> host that does not exist.
 */
export const SELF_HOST_API_PREFIX = "/selfhost-api";
