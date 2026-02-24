"use server";

import { desc, eq } from "drizzle-orm";
import db from "~/db";
import { architectureImportLogs, architectureImports } from "~/db/schema";

type ArchitectureImportInfo = {
  id: string;
  provider: string;
  status: string;
  message: string | null;
  completedAt: string | null;
  updatedAt: string;
  logs: { id: number; stream: string; message: string; createdAt: string }[];
};

export const getArchitectureImport = async (architectureId: string): Promise<ArchitectureImportInfo | null> => {
  const importRow = await db.query.architectureImports.findFirst({ where: eq(architectureImports.architectureId, architectureId) });
  if (!importRow) {
    return null;
  }

  const latestLogs = await db
    .select()
    .from(architectureImportLogs)
    .where(eq(architectureImportLogs.importId, importRow.id))
    .orderBy(desc(architectureImportLogs.id))
    .limit(200)
    .all();

  const logs = [...latestLogs].reverse().map((log) => ({ id: log.id, stream: log.stream, message: log.message, createdAt: log.createdAt }));

  return {
    id: importRow.id,
    provider: importRow.provider,
    status: importRow.status,
    message: importRow.message ?? null,
    completedAt: importRow.completedAt ?? null,
    updatedAt: importRow.updatedAt,
    logs,
  };
};
