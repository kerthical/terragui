"use server";

import { createStreamableValue, type StreamableValue } from "@ai-sdk/rsc";
import { and, eq, gt } from "drizzle-orm";
import db from "~/db";
import { architectureImportLogs, architectureImports } from "~/db/schema";

type ImportLog = {
  id: number;
  stream: string;
  message: string;
  createdAt: string;
};

type StreamEvent =
  | { type: "status"; status: string; message: string | null; completedAt: string | null }
  | { type: "log"; log: ImportLog }
  | { type: "end"; status: string }
  | { type: "error"; message: string };

export const streamImportLogs = async (architectureId: string, lastLogId: number): Promise<StreamableValue<StreamEvent>> => {
  const importRow = await db.query.architectureImports.findFirst({
    where: eq(architectureImports.architectureId, architectureId),
  });

  if (!importRow) {
    const stream = createStreamableValue<StreamEvent>();
    stream.error(new Error("not found"));
    return stream.value;
  }

  const stream = createStreamableValue<StreamEvent>();
  let currentLogId = lastLogId;
  let currentStatus = importRow.status;
  let _sentLogCount = 0;
  let _stderrLogCount = 0;
  let _statusChangeCount = 0;

  stream.update({ type: "status", status: currentStatus, message: importRow.message, completedAt: importRow.completedAt });

  const poll = async (): Promise<void> => {
    let busy = false;
    const interval = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const newLogs = await db
          .select()
          .from(architectureImportLogs)
          .where(and(eq(architectureImportLogs.importId, importRow.id), gt(architectureImportLogs.id, currentLogId)))
          .orderBy(architectureImportLogs.id)
          .all();

        for (const logEntry of newLogs) {
          currentLogId = logEntry.id;
          if (logEntry.stream === "stderr") {
            _stderrLogCount += 1;
          }
          _sentLogCount += 1;
          stream.update({
            type: "log",
            log: { id: logEntry.id, stream: logEntry.stream, message: logEntry.message, createdAt: logEntry.createdAt },
          });
        }

        const latest = await db.query.architectureImports.findFirst({
          where: eq(architectureImports.id, importRow.id),
        });

        if (latest && latest.status !== currentStatus) {
          currentStatus = latest.status;
          _statusChangeCount += 1;
          stream.update({ type: "status", status: latest.status, message: latest.message, completedAt: latest.completedAt });
        }

        if (latest && (latest.status === "succeeded" || latest.status === "failed")) {
          const tailLogs = await db
            .select()
            .from(architectureImportLogs)
            .where(and(eq(architectureImportLogs.importId, importRow.id), gt(architectureImportLogs.id, currentLogId)))
            .orderBy(architectureImportLogs.id)
            .all();

          for (const logEntry of tailLogs) {
            currentLogId = logEntry.id;
            if (logEntry.stream === "stderr") {
              _stderrLogCount += 1;
            }
            _sentLogCount += 1;
            stream.update({
              type: "log",
              log: { id: logEntry.id, stream: logEntry.stream, message: logEntry.message, createdAt: logEntry.createdAt },
            });
          }

          stream.update({ type: "end", status: latest.status });
          clearInterval(interval);
          stream.done();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "stream error";
        stream.update({ type: "error", message: errorMessage });
        clearInterval(interval);
        stream.done();
      } finally {
        busy = false;
      }
    }, 1_000);
  };

  poll();

  return stream.value;
};
