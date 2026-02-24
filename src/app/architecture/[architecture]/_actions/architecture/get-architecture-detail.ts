"use server";

import { eq } from "drizzle-orm";
import { dbToReactFlow } from "~/app/architecture/[architecture]/_domains/architecture/architecture-mapper";
import { type ArchitectureFile, isRootTerraformFilePath } from "~/app/architecture/[architecture]/_domains/architecture/files";
import db from "~/db";
import { architectureFiles, architectures } from "~/db/schema";
import type { ReactFlowGraph } from "~/lib/graph";

type ArchitectureRow = typeof architectures.$inferSelect;

type ArchitectureDetail = {
  architecture: ArchitectureRow;
  flowGraph: ReactFlowGraph;
  files: ArchitectureFile[];
  hasTfstate: boolean;
};

export const getArchitectureDetail = async (input: { architectureId: string }): Promise<ArchitectureDetail | null> => {
  const architecture = await db.select().from(architectures).where(eq(architectures.id, input.architectureId)).get();

  if (!architecture) {
    return null;
  }

  const flowGraph = (await dbToReactFlow(architecture.id)) ?? { nodes: [], edges: [] };

  const architectureFilesData = await db.query.architectureFiles.findMany({
    where: eq(architectureFiles.architectureId, architecture.id),
  });

  const hasTfstate = architectureFilesData.some((file) => /\.tfstate$/i.test(file.path));
  const files: ArchitectureFile[] = architectureFilesData
    .filter((file) => isRootTerraformFilePath(file.path))
    .map((file) => ({ path: file.path, content: file.content }));

  return { architecture, flowGraph, files, hasTfstate };
};
