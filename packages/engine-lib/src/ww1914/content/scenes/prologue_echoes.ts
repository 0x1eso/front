// Great War 1914 (ww154): the past coming back. An echo puts a variant first on a
// main-story scene or one of its nodes, so a scene's own file doesn't change.
import type { GwEcho, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

function echoed(scene: GwScene, list: readonly GwEcho[]): GwScene {
  const bodies = list.filter((e) => e.node === undefined);
  const nodes = { ...scene.nodes };
  for (const { node, id, when } of list) {
    if (node === undefined || nodes[node] === undefined) continue;
    nodes[node] = {
      ...nodes[node],
      says: [{ id, when }, ...nodes[node].says],
    };
  }
  return {
    ...scene,
    variants: [
      ...bodies.map(({ id, when }) => ({ id, when })),
      ...scene.variants,
    ],
    ...(scene.nodes === undefined ? {} : { nodes }),
  };
}

/** The scenes with every echo laid over them. */
export function withEchoes(
  scenes: readonly GwScene[],
  echoes: readonly GwEcho[],
): GwScene[] {
  return scenes.map((s) => {
    const mine = echoes.filter((e) => e.scene === s.id);
    return mine.length === 0 ? s : echoed(s, mine);
  });
}
