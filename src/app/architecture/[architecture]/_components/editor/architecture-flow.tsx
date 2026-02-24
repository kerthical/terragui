"use client";

import { applyEdgeChanges, applyNodeChanges, ConnectionMode, type EdgeChange, type NodeChange, ReactFlow, type ReactFlowInstance } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroupRealNode } from "~/app/architecture/[architecture]/_components/editor/nodes/group-real";
import { GroupVirtualNode } from "~/app/architecture/[architecture]/_components/editor/nodes/group-virtual";
import { ResourceNode } from "~/app/architecture/[architecture]/_components/editor/nodes/resource";
import "@xyflow/react/dist/style.css";
import { FloatingEdge } from "~/app/architecture/[architecture]/_components/editor/edges/step";
import { FlowInteractionProvider } from "~/app/architecture/[architecture]/_components/editor/flow-interaction-context";
import type { ReactFlowEdge, ReactFlowGraph, ReactFlowNode } from "~/lib/graph";

export type ArchitectureFlowFocusRequest = {
  nodeId: string | null;
  requestId: number;
};

const NODE_TYPES = {
  "group-real": GroupRealNode,
  "group-virtual": GroupVirtualNode,
  resource: ResourceNode,
};

const EDGE_TYPES = {
  floating: FloatingEdge,
};

const PRO_OPTIONS: { hideAttribution: boolean } = { hideAttribution: true };
const PAN_ON_DRAG: number[] = [1];

const FLOW_MIN_ZOOM = 0.05;
const FLOW_FOCUS_PADDING_RATIO = 0.12;
const FLOW_FOCUS_PADDING_PX = 24;
const FLOW_FOCUS_DURATION_MS = 500;

type ArchitectureFlowProps = {
  graph: ReactFlowGraph;
  onGraphChange?: (graph: ReactFlowGraph) => void;
  onNodeSelect?: (node: ReactFlowNode | null) => void;
  selectedNodeId?: string | null;
  focusRequest?: ArchitectureFlowFocusRequest;
  interactionDisabled?: boolean;
};

const isHiddenNode = (node: ReactFlowNode): boolean => node.hidden === true || node.type === "document";
const isGroupNodeType = (nodeType?: string | null): boolean => nodeType === "group-real" || nodeType === "group-virtual";

const getDepths = (nodes: ReactFlowNode[]): Map<string, number> => {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const depths = new Map<string, number>();
  const getDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
    if (depths.has(nodeId)) {
      return depths.get(nodeId) ?? 0;
    }
    if (visited.has(nodeId)) {
      depths.set(nodeId, 0);
      return 0;
    }
    visited.add(nodeId);
    const node = map.get(nodeId);
    if (!node || !node.parentId) {
      depths.set(nodeId, 0);
      visited.delete(nodeId);
      return 0;
    }
    const depth = getDepth(node.parentId, visited) + 1;
    depths.set(nodeId, depth);
    visited.delete(nodeId);
    return depth;
  };
  for (const node of nodes) {
    getDepth(node.id);
  }
  return depths;
};

export function ArchitectureFlow({ graph, onGraphChange, onNodeSelect, selectedNodeId, focusRequest, interactionDisabled }: ArchitectureFlowProps) {
  const hiddenNodes = useMemo(() => graph.nodes.filter(isHiddenNode), [graph.nodes]);
  const visibleNodes = useMemo(() => graph.nodes.filter((node) => !isHiddenNode(node)), [graph.nodes]);
  const nodeTypeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node.type ?? "default"])), [graph.nodes]);
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((edge) => {
        if (hiddenNodes.find((node) => node.id === edge.source) || hiddenNodes.find((node) => node.id === edge.target)) {
          return false;
        }
        const sourceType = nodeTypeMap.get(edge.source);
        const targetType = nodeTypeMap.get(edge.target);
        if (isGroupNodeType(sourceType) || isGroupNodeType(targetType)) {
          return false;
        }
        return true;
      }),
    [graph.edges, hiddenNodes, nodeTypeMap],
  );
  const renderNodes = useMemo(() => {
    if (selectedNodeId === undefined) {
      return visibleNodes;
    }
    const targetId = selectedNodeId;
    return visibleNodes.map((node) => {
      const shouldSelect = targetId !== null && node.id === targetId;
      const isSelected = node.selected === true;
      if (isSelected === shouldSelect) {
        return node;
      }
      return { ...node, selected: shouldSelect };
    });
  }, [selectedNodeId, visibleNodes]);
  const visibleNodeMap = useMemo(() => new Map(visibleNodes.map((node) => [node.id, node])), [visibleNodes]);
  const visibleEdgeMap = useMemo(() => new Map(visibleEdges.map((edge) => [edge.id, edge])), [visibleEdges]);
  const hiddenNodeIds = useMemo(() => new Set(hiddenNodes.map((node) => node.id)), [hiddenNodes]);
  const visibleEdgeIds = useMemo(() => new Set(visibleEdges.map((edge) => edge.id)), [visibleEdges]);
  const [spacePressed, setSpacePressed] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const isInteractionDisabled = spacePressed || interactionDisabled === true;
  const [flowInitialized, setFlowInitialized] = useState(false);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<ReactFlowNode, ReactFlowEdge> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.code === "Space") {
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    };
    const handleBlur = (): void => {
      setSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    if (isInteractionDisabled) {
      setHoveredNodeId(null);
    }
  }, [isInteractionDisabled]);

  useEffect(() => {
    if (!focusRequest || !focusRequest.nodeId) {
      return;
    }
    if (!flowInitialized) {
      return;
    }
    const instance = reactFlowInstanceRef.current;
    if (!instance) {
      return;
    }
    const internalNode = instance.getInternalNode(focusRequest.nodeId);
    if (internalNode) {
      const wrapperBounds = wrapperRef.current?.getBoundingClientRect() ?? null;
      const viewportWidth = wrapperBounds?.width ?? 0;
      const viewportHeight = wrapperBounds?.height ?? 0;
      const width =
        (typeof internalNode.measured.width === "number" && internalNode.measured.width > 0 ? internalNode.measured.width : null) ??
        (typeof internalNode.width === "number" && internalNode.width > 0 ? internalNode.width : null) ??
        (typeof internalNode.initialWidth === "number" && internalNode.initialWidth > 0 ? internalNode.initialWidth : null) ??
        0;
      const height =
        (typeof internalNode.measured.height === "number" && internalNode.measured.height > 0 ? internalNode.measured.height : null) ??
        (typeof internalNode.height === "number" && internalNode.height > 0 ? internalNode.height : null) ??
        (typeof internalNode.initialHeight === "number" && internalNode.initialHeight > 0 ? internalNode.initialHeight : null) ??
        0;
      const nodeX = internalNode.internals.positionAbsolute.x;
      const nodeY = internalNode.internals.positionAbsolute.y;
      const centerX = nodeX + width / 2;
      const centerY = nodeY + height / 2;

      if (width <= 0 || height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        void instance.setCenter(centerX, centerY, { duration: FLOW_FOCUS_DURATION_MS });
        return;
      }

      const paddingX = viewportWidth * FLOW_FOCUS_PADDING_RATIO;
      const paddingY = viewportHeight * FLOW_FOCUS_PADDING_RATIO;
      const availableWidth = Math.max(1, viewportWidth - paddingX * 2);
      const availableHeight = Math.max(1, viewportHeight - paddingY * 2);
      const zoomToFit = Math.min(availableWidth / width, availableHeight / height);
      if (!Number.isFinite(zoomToFit) || zoomToFit <= 0) {
        void instance.setCenter(centerX, centerY, { duration: FLOW_FOCUS_DURATION_MS });
        return;
      }

      if (zoomToFit <= FLOW_MIN_ZOOM) {
        void instance.setViewport(
          {
            x: FLOW_FOCUS_PADDING_PX - nodeX * FLOW_MIN_ZOOM,
            y: FLOW_FOCUS_PADDING_PX - nodeY * FLOW_MIN_ZOOM,
            zoom: FLOW_MIN_ZOOM,
          },
          { duration: FLOW_FOCUS_DURATION_MS },
        );
        return;
      }

      const currentZoom = instance.getViewport().zoom;
      const targetZoom = Math.min(currentZoom, zoomToFit);
      if (targetZoom < currentZoom) {
        void instance.setCenter(centerX, centerY, { duration: FLOW_FOCUS_DURATION_MS, zoom: targetZoom });
        return;
      }
      void instance.setCenter(centerX, centerY, { duration: FLOW_FOCUS_DURATION_MS });
      return;
    }
    void instance.fitView({ nodes: [{ id: focusRequest.nodeId }], duration: FLOW_FOCUS_DURATION_MS, padding: "12%" });
  }, [flowInitialized, focusRequest?.nodeId, focusRequest?.requestId, focusRequest]);

  const cursorStyle = spacePressed ? "grab" : "default";
  const flowClassName = spacePressed ? "architecture-flow architecture-flow--panning" : "architecture-flow";
  const interactionState = useMemo(() => ({ hoveredNodeId, interactionDisabled: isInteractionDisabled }), [hoveredNodeId, isInteractionDisabled]);

  const depths = useMemo(() => getDepths(renderNodes), [renderNodes]);
  const orderedNodes = useMemo(() => {
    return [...renderNodes].sort((a, b) => {
      const d = (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0);
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });
  }, [depths, renderNodes]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: ReactFlowNode) => {
      if (isInteractionDisabled) {
        event.preventDefault();
        return;
      }
      onNodeSelect?.(node);
    },
    [isInteractionDisabled, onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: ReactFlowNode) => {
      if (isInteractionDisabled) {
        return;
      }
      setHoveredNodeId(node.id);
    },
    [isInteractionDisabled],
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange<ReactFlowNode>[]) => {
      if (isInteractionDisabled) {
        return;
      }
      if (!onGraphChange) {
        return;
      }
      const meaningfulChanges = changes.filter((change) => change.type !== "select");
      if (meaningfulChanges.length === 0) {
        return;
      }
      const addOrReplaceOnly = meaningfulChanges.every((change) => change.type === "add" || change.type === "replace");
      if (addOrReplaceOnly && meaningfulChanges.length === visibleNodes.length) {
        const matchesProps = meaningfulChanges.every((change) => {
          if (change.type === "add" || change.type === "replace") {
            const current = visibleNodeMap.get(change.item.id);
            return current === change.item;
          }
          return false;
        });
        if (matchesProps) {
          return;
        }
      }
      const removeOnly = meaningfulChanges.every((change) => change.type === "remove");
      if (removeOnly) {
        const removingMissingNodes = meaningfulChanges.every((change) => !visibleNodeMap.has(change.id));
        if (removingMissingNodes) {
          return;
        }
      }
      const updatedVisible = applyNodeChanges(meaningfulChanges, visibleNodes);
      const updatedMap = new Map(updatedVisible.map((node) => [node.id, node]));
      const existingIds = new Set(graph.nodes.map((node) => node.id));
      const nextNodes: ReactFlowNode[] = [];
      for (const node of graph.nodes) {
        if (hiddenNodeIds.has(node.id)) {
          nextNodes.push(node);
          continue;
        }
        const updated = updatedMap.get(node.id);
        if (updated) {
          nextNodes.push(updated);
        }
      }
      for (const node of updatedVisible) {
        if (!existingIds.has(node.id)) {
          nextNodes.push(node);
        }
      }
      onGraphChange({ nodes: nextNodes, edges: graph.edges });
    },
    [graph.edges, graph.nodes, hiddenNodeIds, isInteractionDisabled, onGraphChange, visibleNodeMap, visibleNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<ReactFlowEdge>[]) => {
      if (isInteractionDisabled) {
        return;
      }
      if (!onGraphChange) {
        return;
      }
      const meaningfulChanges = changes.filter((change) => change.type !== "select");
      if (meaningfulChanges.length === 0) {
        return;
      }
      const addOrReplaceOnly = meaningfulChanges.every((change) => change.type === "add" || change.type === "replace");
      if (addOrReplaceOnly && meaningfulChanges.length === visibleEdges.length) {
        const matchesProps = meaningfulChanges.every((change) => {
          if (change.type === "add" || change.type === "replace") {
            const current = visibleEdgeMap.get(change.item.id);
            return current === change.item;
          }
          return false;
        });
        if (matchesProps) {
          return;
        }
      }
      const removeOnly = meaningfulChanges.every((change) => change.type === "remove");
      if (removeOnly) {
        const removingMissingEdges = meaningfulChanges.every((change) => !visibleEdgeMap.has(change.id));
        if (removingMissingEdges) {
          return;
        }
      }
      const updatedVisible = applyEdgeChanges(meaningfulChanges, visibleEdges);
      const updatedMap = new Map(updatedVisible.map((edge) => [edge.id, edge]));
      const existingIds = new Set(graph.edges.map((edge) => edge.id));
      const nextEdges: ReactFlowEdge[] = [];
      for (const edge of graph.edges) {
        if (!visibleEdgeIds.has(edge.id)) {
          nextEdges.push(edge);
          continue;
        }
        const updated = updatedMap.get(edge.id);
        if (updated) {
          nextEdges.push(updated);
        }
      }
      for (const edge of updatedVisible) {
        if (!existingIds.has(edge.id)) {
          nextEdges.push(edge);
        }
      }
      onGraphChange({ nodes: graph.nodes, edges: nextEdges });
    },
    [graph.edges, graph.nodes, isInteractionDisabled, onGraphChange, visibleEdgeIds, visibleEdgeMap, visibleEdges],
  );

  useEffect(() => {
    if (!flowInitialized) {
      return;
    }
    if (initialFitDoneRef.current) {
      return;
    }
    const instance = reactFlowInstanceRef.current;
    const wrapper = wrapperRef.current;
    if (!instance || !wrapper) {
      return;
    }

    const tryFit = (): void => {
      if (initialFitDoneRef.current) {
        return;
      }
      if (orderedNodes.length === 0) {
        return;
      }
      const bounds = wrapper.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      initialFitDoneRef.current = true;
      void instance.fitView({ padding: FLOW_FOCUS_PADDING_RATIO });
    };

    tryFit();
    const observer = new ResizeObserver(() => {
      tryFit();
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, [flowInitialized, orderedNodes.length]);

  return (
    <div className="h-full w-full" ref={wrapperRef}>
      <FlowInteractionProvider state={interactionState}>
        <ReactFlow
          className={flowClassName}
          colorMode="dark"
          connectionMode={ConnectionMode.Loose}
          edges={visibleEdges}
          edgeTypes={EDGE_TYPES}
          elementsSelectable={!isInteractionDisabled}
          minZoom={FLOW_MIN_ZOOM}
          nodes={orderedNodes}
          nodesConnectable={false}
          nodesDraggable={!isInteractionDisabled}
          nodeTypes={NODE_TYPES}
          onEdgesChange={handleEdgesChange}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
            setFlowInitialized(true);
          }}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodesChange={handleNodesChange}
          onPaneClick={onPaneClick}
          panActivationKeyCode="Space"
          panOnDrag={PAN_ON_DRAG}
          proOptions={PRO_OPTIONS}
          selectionOnDrag={!isInteractionDisabled}
          style={{ cursor: cursorStyle }}
        />
      </FlowInteractionProvider>
    </div>
  );
}
