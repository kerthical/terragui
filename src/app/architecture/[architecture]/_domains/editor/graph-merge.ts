import type { ReactFlowGraph, ReactFlowNode } from "~/lib/graph";

export const mergeGraphWithExisting = (nextGraph: ReactFlowGraph, previousGraph: ReactFlowGraph): ReactFlowGraph => {
  const previousMap = new Map(previousGraph.nodes.map((node) => [node.id, node]));
  const nodes = nextGraph.nodes.map((node) => {
    const previous = previousMap.get(node.id);
    if (!previous) {
      return node;
    }
    const merged = { ...node, position: previous.position };
    if (previous.parentId !== undefined) {
      merged.parentId = previous.parentId;
    } else if (node.parentId !== undefined) {
      merged.parentId = node.parentId;
    }
    if (previous.style !== undefined) {
      merged.style = previous.style;
    } else if (node.style !== undefined) {
      merged.style = node.style;
    }
    if (previous.hidden !== undefined) {
      merged.hidden = previous.hidden;
    }
    return merged;
  });
  return { nodes, edges: nextGraph.edges };
};

export const findDocumentNode = (graph: ReactFlowGraph): ReactFlowNode | null => graph.nodes.find((node) => node.type === "document") ?? null;
