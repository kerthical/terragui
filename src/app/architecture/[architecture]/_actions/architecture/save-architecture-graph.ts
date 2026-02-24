"use server";

import { reactFlowToDB } from "~/app/architecture/[architecture]/_domains/architecture/architecture-mapper";
import type { ArchitectureFile } from "~/app/architecture/[architecture]/_domains/architecture/files";
import type { ReactFlowGraph } from "~/lib/graph";

export const saveArchitectureGraph = async (input: {
  architectureId: string;
  flowGraph: ReactFlowGraph;
  rootFiles: ArchitectureFile[];
}): Promise<{ success: true }> => {
  await reactFlowToDB({
    architectureId: input.architectureId,
    flowGraph: input.flowGraph,
    rootFiles: input.rootFiles,
  });

  return { success: true };
};
