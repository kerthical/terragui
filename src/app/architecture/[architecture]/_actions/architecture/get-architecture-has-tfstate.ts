"use server";

import { eq } from "drizzle-orm";
import db from "~/db";
import { architectureFiles } from "~/db/schema";

export const getArchitectureHasTfstate = async (architectureId: string): Promise<boolean> => {
  const rows = await db.select({ path: architectureFiles.path }).from(architectureFiles).where(eq(architectureFiles.architectureId, architectureId));
  return rows.some((row) => /\.tfstate$/i.test(row.path));
};
