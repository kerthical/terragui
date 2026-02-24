import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import { memo, useEffect, useState } from "react";
import { useFlowInteraction } from "~/app/architecture/[architecture]/_components/editor/flow-interaction-context";
import iconMap from "~/icons/map.json";
import type { GraphNode, NodeLabelLayout } from "~/lib/graph";

type ResourceNodeData = {
  label: string;
  graphNode: GraphNode;
  labelLayout?: NodeLabelLayout;
  hovered?: boolean;
  interactionDisabled?: boolean;
};

type ResourceFlowNode = Node<ResourceNodeData, "resource">;

const NODE_STYLE: CSSProperties = {
  borderRadius: 8,
  background: "transparent",
  border: "none",
  padding: 0,
  zIndex: 2,
};

const NODE_SELECTED_STYLE: CSSProperties = {
  ...NODE_STYLE,
  filter: "drop-shadow(0 0 4px var(--primary))",
};

const NODE_HOVER_STYLE: CSSProperties = {
  ...NODE_STYLE,
  filter: "drop-shadow(0 0 3px var(--muted-foreground))",
};

export const ResourceNode = memo(function ResourceNode(props: NodeProps<ResourceFlowNode>) {
  const { hoveredNodeId, interactionDisabled } = useFlowInteraction();
  const graphNode = props.data.graphNode;
  const resourceType = graphNode?.type === "resource" ? graphNode.data.address.resourceType : null;
  const [hasError, setHasError] = useState(false);
  const [Icon, setIcon] = useState<ComponentType<SVGProps<SVGSVGElement>> | null>(null);
  const hovered = hoveredNodeId !== null && hoveredNodeId === props.id;
  const fallback = resourceType?.split("_")[0] ?? "?";
  const labelLayout = props.data.labelLayout ?? null;
  const handlesVisible = props.selected === true || props.dragging === true;
  const handleClassName = handlesVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 transition-opacity duration-150";
  const labelBaseClass = "absolute text-xs font-medium leading-tight px-1 whitespace-nowrap overflow-visible flex items-center justify-center";
  const labelClassName = labelLayout ? labelBaseClass : `${labelBaseClass} -bottom-4`;
  const labelStyle = labelLayout ? { left: labelLayout.x, top: labelLayout.y, width: labelLayout.width, height: labelLayout.height } : undefined;

  const filename = resourceType ? (iconMap as Record<string, string>)[resourceType] : null;
  const baseStyle = props.selected ? NODE_SELECTED_STYLE : hovered ? NODE_HOVER_STYLE : NODE_STYLE;
  const pointerEventsNone: CSSProperties["pointerEvents"] = "none";
  const nodeStyle = interactionDisabled ? { ...baseStyle, pointerEvents: pointerEventsNone } : baseStyle;

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
    props.data && (
      <div className="w-full h-full relative flex flex-col items-center justify-center gap-2 text-center" data-active={handlesVisible} style={nodeStyle}>
        <div className="w-full h-full flex items-center justify-center">
          {Icon && !hasError ? (
            <Icon className="w-full h-full object-contain pointer-events-none select-none" />
          ) : (
            <span className="text-xs font-semibold uppercase">{fallback}</span>
          )}
        </div>
        <span className={labelClassName} style={labelStyle}>
          {props.data.label}
        </span>
        <Handle className={handleClassName} id="source-top" position={Position.Top} style={{ cursor: "inherit" }} type="source" />
        <Handle className={handleClassName} id="source-right" position={Position.Right} style={{ cursor: "inherit" }} type="source" />
        <Handle className={handleClassName} id="source-bottom" position={Position.Bottom} style={{ cursor: "inherit" }} type="source" />
        <Handle className={handleClassName} id="source-left" position={Position.Left} style={{ cursor: "inherit" }} type="source" />
      </div>
    )
  );
});
