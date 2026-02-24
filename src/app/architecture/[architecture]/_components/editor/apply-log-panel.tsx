"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import { CircleCheck, CircleDashed, CircleX, Radio, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { streamApplyLogs } from "~/app/architecture/[architecture]/_actions/terraform/stream-apply-logs";
import { Badge } from "~/ui/badge";
import { Button } from "~/ui/button";
import { ScrollArea } from "~/ui/scroll-area";

type ApplyLog = {
  id: number;
  stream: string;
  message: string;
  createdAt: string;
};

type ApplyLogPanelProps = {
  applyId: string;
  onClose: () => void;
  mode?: "apply" | "destroy";
};

const statusLabel = (status: string): string => {
  if (status === "succeeded") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
};

const statusIcon = (status: string): React.ReactNode => {
  if (status === "succeeded") return <CircleCheck className="size-4 text-emerald-500" />;
  if (status === "failed") return <CircleX className="size-4 text-destructive" />;
  if (status === "running") return <Radio className="size-4 text-primary animate-pulse" />;
  return <CircleDashed className="size-4 text-muted-foreground" />;
};

export function ApplyLogPanel({ applyId, onClose, mode = "apply" }: ApplyLogPanelProps) {
  const [logs, setLogs] = useState<ApplyLog[]>([]);
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastStatusRef = useRef("pending");

  useEffect(() => {
    let cancelled = false;

    const startStream = async (): Promise<void> => {
      try {
        const stream = await streamApplyLogs(applyId, 0);

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
  }, [applyId]);

  useEffect(() => {
    if (!isAtBottomRef.current || logs.length === 0) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  useEffect(() => {
    const wasFinished = lastStatusRef.current === "succeeded" || lastStatusRef.current === "failed";
    const isFinished = status === "succeeded" || status === "failed";
    if (!wasFinished && isFinished) {
      onClose();
    }
    lastStatusRef.current = status;
  }, [onClose, status]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (!viewport) return;

    const handleScroll = (): void => {
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
      ? mode === "destroy"
        ? "Destroy completed successfully."
        : "Apply completed successfully."
      : status === "failed"
        ? mode === "destroy"
          ? "Destroy failed. Please check the logs."
          : "Apply failed. Please check the logs."
        : mode === "destroy"
          ? "Destroying infrastructure resources..."
          : "Applying infrastructure changes...";

  return (
    <div className="flex h-full flex-col bg-background text-[12px]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold">{mode === "destroy" ? "Destroy Logs" : "Apply Logs"}</span>
          <Badge className={statusColor} variant="secondary">
            {statusIcon(status)}
            <span className="ml-1">{statusLabel(status)}</span>
          </Badge>
        </div>
        <Button className="size-7" disabled={status === "pending" || status === "running"} onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
        </Button>
      </div>
      <main className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="space-y-1">
            <p className="text-muted-foreground">{headerMessage}</p>
            {message && <p className="text-destructive">Message: {message}</p>}
          </div>
          <ScrollArea className="flex min-h-0 flex-1 rounded-sm border bg-muted/20 p-2" ref={scrollAreaRef}>
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
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
