import type { Node, NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { useFlowInteraction } from "~/app/architecture/[architecture]/_components/editor/flow-interaction-context";
import iconMap from "~/icons/map.json";
import type { GraphNode, ReactFlowEdge, ReactFlowNode } from "~/lib/graph";

const ICON_SIZE = 20;
const DRAG_BORDER_THICKNESS = 8;

type GroupRealNodeData = {
  label: string;
  graphNode: GraphNode;
  hovered?: boolean;
  interactionDisabled?: boolean;
};

type GroupRealFlowNode = Node<GroupRealNodeData, "group-real">;

export const GroupRealNode = memo(function GroupRealNode(props: Readonly<NodeProps<GroupRealFlowNode>>) {
  const reactFlow = useReactFlow<ReactFlowNode, ReactFlowEdge>();
  const { hoveredNodeId, interactionDisabled } = useFlowInteraction();
  const nodeData = props.data;
  const graphNode = nodeData?.graphNode;
  const resourceType = graphNode?.type === "resource" ? graphNode.data.address.resourceType : graphNode?.type === "provider" ? graphNode.data.name : null;
  const [hasError, setHasError] = useState(false);
  const [Icon, setIcon] = useState<ComponentType<SVGProps<SVGSVGElement>> | null>(null);
  const hovered = hoveredNodeId !== null && hoveredNodeId === props.id;
  const fallbackSource = resourceType ?? nodeData.label ?? "?";
  const fallback = fallbackSource.split("_")[0] ?? fallbackSource;

  const filename = resourceType ? (iconMap as Record<string, string>)[resourceType] : null;

  const depth = useMemo(() => {
    let currentParentId = props.parentId ?? null;
    let level = 0;
    while (currentParentId) {
      level += 1;
      const parent = reactFlow.getNode(currentParentId);
      currentParentId = parent?.parentId ?? null;
    }
    return level;
  }, [props.parentId, reactFlow]);

  const lightness = Math.max(5, 20 - depth * 4);
  const backgroundColor = `hsl(220, 20%, ${lightness}%)`;

  const baseStyle: CSSProperties = {
    borderRadius: 8,
    border: "none",
    padding: 0,
    zIndex: 0,
    backgroundColor,
  };

  const nodeSelectedStyle: CSSProperties = {
    ...baseStyle,
    filter: "drop-shadow(0 0 4px var(--primary))",
  };

  const nodeHoverStyle: CSSProperties = {
    ...baseStyle,
    filter: "drop-shadow(0 0 3px var(--muted-foreground))",
  };
  const resolvedStyle = props.selected ? nodeSelectedStyle : hovered ? nodeHoverStyle : baseStyle;
  const pointerEventsNone: CSSProperties["pointerEvents"] = "none";
  const nodeStyle = interactionDisabled ? { ...resolvedStyle, pointerEvents: pointerEventsNone } : resolvedStyle;

  useEffect(() => {
    let cancelled = false;
    setHasError(false);
    setIcon(null);
    if (!filename) {
      return undefined;
    }
    const load = async (): Promise<void> => {
      try {
        const mod = await import(`~/icons/${filename}`);
        if (!cancelled) {
          setIcon(mod.default);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [filename]);

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full p-4" style={nodeStyle}>
        <div className="flex items-start gap-2">
          <div
            className="flex shrink-0 items-center justify-center rounded-md bg-foreground/10 text-foreground"
            style={{ width: ICON_SIZE + 8, height: ICON_SIZE + 8 }}
          >
            {Icon && !hasError ? (
              <Icon className="h-full w-full select-none object-contain pointer-events-none" height={ICON_SIZE} width={ICON_SIZE} />
            ) : (
              <span className="text-[10px] font-semibold uppercase leading-none">{fallback}</span>
            )}
          </div>
          <div className="min-w-0 text-xs font-semibold leading-tight wrap-break-word">{nodeData.label}</div>
        </div>
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
