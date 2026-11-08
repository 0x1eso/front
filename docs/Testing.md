# Testing

## Two tiers

The suite is split in two so the everyday run stays light on a shared machine.

| Command             | Runs                                                  |
| ------------------- | ----------------------------------------------------- |
| `npm test`          | the default tier: vitest projects `client` and `node` |
| `npm run test:slow` | the slow tier: projects `slow-client` and `slow-node` |
| `npm run test:all`  | both (CI runs this, sharded)                          |

The slow tier is the list in `tests/SlowTier.ts`: files that spend 5 s or more
running their tests alone, and the timing benchmarks (`*Perf*`). They are
mostly games played for months or years (World War 1936 AI runs, alt-history
paths, world lockstep, 1914 whole-game runs), long snapshot round trips,
vanilla full-game snapshots, jsdom suites that build whole panels, and the
self-host script test. Nothing in it is skipped for good.

The default tier keeps everything else, including the safety net:
`WorldWarSnapshot` (about 2.5 minutes alone, the slowest file left in the
default tier), `VanillaDigest`, `GreatWarSnapshot`, `LayerBoundaries` and
`TranslationSystem`.

## When to run the slow tier

- Before a deploy whose changes touch shared World War 1936, Great War 1914 or
  server code (`packages/engine` shared systems, `src/server`, the self-host
  scripts).
- When your change is in an area a slow file covers: run that file by name.

## Running one file

Name it directly with vitest; this runs every project, so a slow file runs
too:

```bash
npx vitest tests/ww1936/AiLand.test.ts --run
```

`npm test -- <file>` only looks in the default tier, so it finds nothing for a
slow file.

## Adding to the slow tier

Add the path to `tests/SlowTier.ts` under the group that fits. A glob must end
in `.test.ts`, because the slow projects use these entries as their `include`.
Keep the digest tests and `LayerBoundaries` out of it.
