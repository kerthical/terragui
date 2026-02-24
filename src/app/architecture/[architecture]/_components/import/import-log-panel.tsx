"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import { CircleCheck, CircleDashed, CircleX, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { streamImportLogs } from "~/app/architecture/[architecture]/_actions/import/stream-import-logs";
import { Header } from "~/app/header";
import { Badge } from "~/ui/badge";
import { ScrollArea } from "~/ui/scroll-area";

type ImportLog = {
  id: number;
  stream: string;
  message: string;
  createdAt: string;
};

type ImportInfo = {
  id: string;
  provider: string;
  status: string;
  message: string | null;
  completedAt: string | null;
  logs: ImportLog[];
};

type ImportLogPanelProps = {
  architectureId: string;
  initial: ImportInfo;
};

const statusLabel = (status: string) => {
  if (status === "succeeded") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
};

const statusIcon = (status: string) => {
  if (status === "succeeded") return <CircleCheck className="size-4 text-emerald-500" />;
  if (status === "failed") return <CircleX className="size-4 text-destructive" />;
  if (status === "running") return <Radio className="size-4 text-primary animate-pulse" />;
  return <CircleDashed className="size-4 text-muted-foreground" />;
};

export function ImportLogPanel({ architectureId, initial }: ImportLogPanelProps) {
  const [logs, setLogs] = useState<ImportLog[]>(initial.logs ?? []);
  const [status, setStatus] = useState(initial.status);
  const [message, setMessage] = useState<string | null>(initial.message);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastStatusRef = useRef(initial.status);

  useEffect(() => {
    let cancelled = false;

    const startStream = async (): Promise<void> => {
      const lastInitialId = initial.logs.length > 0 ? (initial.logs[initial.logs.length - 1]?.id ?? 0) : 0;
      try {
        const stream = await streamImportLogs(architectureId, lastInitialId);

        for await (const event of readStreamableValue(stream)) {
          if (cancelled || !event) continue;

          if (event.type === "log") {
            setLogs((current) => [...current, event.log]);
          } else if (event.type === "status") {
            setStatus(event.status);
            setMessage(event.message ?? null);
          } else if (event.type === "end" || event.type === "error") {
            break;
          }
        }
      } catch {
        return;
      }
    };

    void startStream();

    return () => {
      cancelled = true;
    };
  }, [architectureId, initial.logs]);

  useEffect(() => {
    if (!isAtBottomRef.current || logs.length === 0) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  useEffect(() => {
    if (lastStatusRef.current !== "succeeded" && status === "succeeded") {
      window.location.reload();
    }
    lastStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 32;
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  const statusColor = useMemo(() => {
    if (status === "succeeded") return "bg-emerald-100 text-emerald-700";
    if (status === "failed") return "bg-destructive/10 text-destructive";
    if (status === "running") return "bg-primary/10 text-primary";
    return "bg-muted text-muted-foreground";
  }, [status]);

  const headerMessage =
    status === "succeeded"
      ? "Import finished. Continue editing if needed."
      : status === "failed"
        ? "Import failed. Please check the logs."
        : "You can close this page; the import continues and updates live.";

  return (
    <div className="flex min-h-screen flex-col bg-background text-[12px] sm:text-[13px]">
      <Header
        actions={
          <Badge className={statusColor} variant="secondary">
            {statusIcon(status)}
            <span className="ml-1">{statusLabel(status)}</span>
          </Badge>
        }
        backHref="/"
        title="Import logs"
      />
      <main className="flex min-h-0 flex-1 flex-col px-2 py-4 sm:px-3">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{headerMessage}</p>
            {message && <p className="text-sm text-destructive">Message: {message}</p>}
          </div>
          <ScrollArea className="flex min-h-0 flex-1 rounded-md border bg-muted/20 p-2" ref={scrollAreaRef}>
            <div className="space-y-1 text-xs font-mono leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">Waiting for logs...</div>
              ) : (
                logs.map((log) => (
                  <div className={log.stream === "stderr" ? "text-destructive" : "text-foreground"} key={log.id}>
                    <span className="text-muted-foreground">[{log.stream}]</span> {log.message}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}
