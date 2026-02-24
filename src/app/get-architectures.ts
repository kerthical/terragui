"use server";

import { desc } from "drizzle-orm";
import db from "~/db";
import { architectures } from "~/db/schema";

type ArchitectureSummary = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
};

export const getArchitectures = async (): Promise<ArchitectureSummary[]> => {
  const rows = await db
    .select({
      id: architectures.id,
      name: architectures.name,
      description: architectures.description,
      sourceType: architectures.sourceType,
      createdAt: architectures.createdAt,
      updatedAt: architectures.updatedAt,
    })
    .from(architectures)
    .orderBy(desc(architectures.updatedAt))
    .all();
  return rows;
};
