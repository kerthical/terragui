import type { Node, NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import { memo } from "react";
import { useFlowInteraction } from "~/app/architecture/[architecture]/_components/editor/flow-interaction-context";
import type { GraphNode } from "~/lib/graph";

type GroupVirtualNodeData = {
  label: string;
  graphNode: GraphNode;
  hovered?: boolean;
  interactionDisabled?: boolean;
};

type GroupVirtualFlowNode = Node<GroupVirtualNodeData, "group-virtual">;

const NODE_STYLE: CSSProperties = {
  borderRadius: 8,
  background: "transparent",
  border: "2px dashed var(--border)",
  padding: 0,
  color: "var(--muted-foreground)",
  zIndex: 0,
};

const NODE_SELECTED_STYLE: CSSProperties = {
  ...NODE_STYLE,
  filter: "drop-shadow(0 0 4px var(--primary))",
};

const NODE_HOVER_STYLE: CSSProperties = {
  ...NODE_STYLE,
  filter: "drop-shadow(0 0 3px var(--muted-foreground))",
};

const DRAG_BORDER_THICKNESS = 8;

export const GroupVirtualNode = memo(function GroupVirtualNode(props: Readonly<NodeProps<GroupVirtualFlowNode>>) {
  const { hoveredNodeId, interactionDisabled } = useFlowInteraction();
  const nodeData = props.data;
  const hovered = hoveredNodeId !== null && hoveredNodeId === props.id;
  const nodeStyle = props.selected ? NODE_SELECTED_STYLE : hovered ? NODE_HOVER_STYLE : NODE_STYLE;
  const pointerEventsNone: CSSProperties["pointerEvents"] = "none";
  const resolvedStyle = interactionDisabled ? { ...nodeStyle, pointerEvents: pointerEventsNone } : nodeStyle;

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full p-4" style={resolvedStyle}>
        {nodeData && <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{nodeData.label}</div>}
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-full" style={{ width: DRAG_BORDER_THICKNESS, pointerEvents: "auto", cursor: "inherit" }} />
        <div className="absolute right-0 top-0 h-full" style={{ width: DRAG_BORDER_THICKNESS, pointerEvents: "auto", cursor: "inherit" }} />
        <div className="absolute left-0 top-0 w-full" style={{ height: DRAG_BORDER_THICKNESS, pointerEvents: "auto", cursor: "inherit" }} />
        <div className="absolute bottom-0 left-0 w-full" style={{ height: DRAG_BORDER_THICKNESS, pointerEvents: "auto", cursor: "inherit" }} />
      </div>
    </div>
  );
});
