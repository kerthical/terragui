"use server";

import { createStreamableValue, type StreamableValue } from "@ai-sdk/rsc";
import { and, eq, gt } from "drizzle-orm";
import db from "~/db";
import { architectureApplies, architectureApplyLogs } from "~/db/schema";

type ApplyLog = {
  id: number;
  stream: string;
  message: string;
  createdAt: string;
};

type StreamEvent =
  | { type: "status"; status: string; message: string | null; completedAt: string | null }
  | { type: "log"; log: ApplyLog }
  | { type: "end"; status: string }
  | { type: "error"; message: string };

export const streamApplyLogs = async (applyId: string, lastLogId: number): Promise<StreamableValue<StreamEvent>> => {
  const applyRow = await db.query.architectureApplies.findFirst({
    where: eq(architectureApplies.id, applyId),
  });

  if (!applyRow) {
    const stream = createStreamableValue<StreamEvent>();
    stream.error(new Error("not found"));
    return stream.value;
  }

  const stream = createStreamableValue<StreamEvent>();
  let currentLogId = lastLogId;
  let currentStatus = applyRow.status;

  stream.update({ type: "status", status: currentStatus, message: applyRow.message, completedAt: applyRow.completedAt });

  const poll = async (): Promise<void> => {
    let busy = false;
    const interval = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const newLogs = await db
          .select()
          .from(architectureApplyLogs)
          .where(and(eq(architectureApplyLogs.applyId, applyRow.id), gt(architectureApplyLogs.id, currentLogId)))
          .orderBy(architectureApplyLogs.id)
          .all();

        for (const logEntry of newLogs) {
          currentLogId = logEntry.id;
          stream.update({
            type: "log",
            log: { id: logEntry.id, stream: logEntry.stream, message: logEntry.message, createdAt: logEntry.createdAt },
          });
        }

        const latest = await db.query.architectureApplies.findFirst({
          where: eq(architectureApplies.id, applyRow.id),
        });

        if (latest && latest.status !== currentStatus) {
          currentStatus = latest.status;
          stream.update({ type: "status", status: latest.status, message: latest.message, completedAt: latest.completedAt });
        }

        if (latest && (latest.status === "succeeded" || latest.status === "failed")) {
          const tailLogs = await db
            .select()
            .from(architectureApplyLogs)
            .where(and(eq(architectureApplyLogs.applyId, applyRow.id), gt(architectureApplyLogs.id, currentLogId)))
            .orderBy(architectureApplyLogs.id)
            .all();

          for (const logEntry of tailLogs) {
            currentLogId = logEntry.id;
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
