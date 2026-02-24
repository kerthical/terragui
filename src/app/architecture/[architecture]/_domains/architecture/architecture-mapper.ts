import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { type ArchitectureFile, isRootTerraformFilePath } from "~/app/architecture/[architecture]/_domains/architecture/files";
import db from "~/db";
import { architectureFiles, architectures } from "~/db/schema";
import type { ReactFlowGraph } from "~/lib/graph";

export async function reactFlowToDB({
  architectureId,
  flowGraph,
  rootFiles,
}: {
  architectureId: string;
  flowGraph: ReactFlowGraph;
  rootFiles: ArchitectureFile[];
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(architectures)
      .set({ graphJson: JSON.stringify(flowGraph) })
      .where(eq(architectures.id, architectureId));

    const sanitizedFiles = rootFiles.filter((file) => isRootTerraformFilePath(file.path));
    const rootPaths = new Set(sanitizedFiles.map((file) => file.path));
    const existingPaths = await tx.select({ path: architectureFiles.path }).from(architectureFiles).where(eq(architectureFiles.architectureId, architectureId));
    const stalePaths = existingPaths.map((row) => row.path).filter((path) => isRootTerraformFilePath(path) && !rootPaths.has(path));
    if (stalePaths.length > 0) {
      await tx.delete(architectureFiles).where(and(eq(architectureFiles.architectureId, architectureId), inArray(architectureFiles.path, stalePaths)));
    }
    for (const file of sanitizedFiles) {
      await tx
        .insert(architectureFiles)
        .values({ architectureId, path: file.path, content: file.content })
        .onConflictDoUpdate({ target: [architectureFiles.architectureId, architectureFiles.path], set: { content: file.content } });
    }
  });
}

export async function dbToReactFlow(architectureId: string): Promise<ReactFlowGraph | null> {
  const architecture = await db.query.architectures.findFirst({
    columns: { graphJson: true },
    where: eq(architectures.id, architectureId),
  });

  if (!architecture || !architecture.graphJson) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(architecture.graphJson);
    if (!isReactFlowGraph(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const isReactFlowNode = (value: unknown): value is ReactFlowGraph["nodes"][number] => {
  if (!isRecord(value)) {
    return false;
  }
  const { id, position } = value;
  if (typeof id !== "string" || !isRecord(position)) {
    return false;
  }
  const { x, y } = position;
  return typeof x === "number" && typeof y === "number";
};

const isReactFlowEdge = (value: unknown): value is ReactFlowGraph["edges"][number] => {
  if (!isRecord(value)) {
    return false;
  }
  const { id, source, target } = value;
  return typeof id === "string" && typeof source === "string" && typeof target === "string";
};

const isReactFlowGraph = (value: unknown): value is ReactFlowGraph => {
  if (!isRecord(value)) {
    return false;
  }
  const { nodes, edges } = value;
  return Array.isArray(nodes) && Array.isArray(edges) && nodes.every(isReactFlowNode) && edges.every(isReactFlowEdge);
};
