"use client";

import type * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "~/ui/utils";

function ResizablePanelGroup({ className, orientation, ...props }: React.ComponentProps<typeof Group>) {
  const direction = orientation ?? "horizontal";
  return (
    <Group
      className={cn("group/resizable flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
      data-panel-group-direction={direction}
      data-slot="resizable-panel-group"
      orientation={orientation}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) {
  return (
    <Separator
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden group-data-[panel-group-direction=vertical]/resizable:h-px group-data-[panel-group-direction=vertical]/resizable:w-full group-data-[panel-group-direction=vertical]/resizable:after:left-0 group-data-[panel-group-direction=vertical]/resizable:after:h-1 group-data-[panel-group-direction=vertical]/resizable:after:w-full group-data-[panel-group-direction=vertical]/resizable:after:translate-x-0 group-data-[panel-group-direction=vertical]/resizable:after:-translate-y-1/2 group-data-[panel-group-direction=vertical]/resizable:[&>div]:rotate-90",
        className,
      )}
      data-slot="resizable-handle"
      {...props}
    >
      {withHandle && <div className="bg-border h-6 w-1 rounded-lg z-10 flex shrink-0" />}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
