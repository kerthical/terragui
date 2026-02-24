import { EdgeLabelRenderer, type EdgeProps, getBezierPath, type InternalNode, Position, useInternalNode, useReactFlow, useViewport } from "@xyflow/react";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useFlowInteraction } from "~/app/architecture/[architecture]/_components/editor/flow-interaction-context";
import type { EdgeLayout, ReactFlowEdge, ReactFlowNode } from "~/lib/graph";

type HandleCoordinates = [number, number];
type HandleParams = [number, number, Position];
type EdgeParams = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
};

const BEND_X_PROXIMITY = 48;
const BEND_Y_TOLERANCE = 2;
const ARROW_TIP_OFFSET = 4;

function normalizeEdgeLayout(layout?: EdgeLayout): EdgeLayout | undefined {
  if (!layout) {
    return layout;
  }
  const bends = layout.bends;
  if (bends.length < 4) {
    return layout;
  }
  const first = bends[0];
  const second = bends[1];
  const third = bends[2];
  const fourth = bends[3];
  if (!first || !second || !third) {
    return layout;
  }
  const isXClose = (a: number, b: number): boolean => Math.abs(a - b) <= BEND_X_PROXIMITY;
  const isYClose = (a: number, b: number): boolean => Math.abs(a - b) <= BEND_Y_TOLERANCE;
  if (isYClose(first.y, second.y) && isXClose(first.x, second.x)) {
    const updatedThird = { x: first.x, y: third.y };
    const nextBends = [updatedThird, ...bends.slice(3)];
    return { ...layout, bends: nextBends };
  }
  if (fourth && first.y !== fourth.y && isXClose(first.x, fourth.x)) {
    const updatedFirst = { x: first.x, y: fourth.y };
    const nextBends = [updatedFirst, fourth, ...bends.slice(4)];
    return { ...layout, bends: nextBends };
  }
  return layout;
}

function getParams(nodeA: InternalNode, nodeB: InternalNode): HandleParams {
  const centerA = getNodeCenter(nodeA);
  const centerB = getNodeCenter(nodeB);

  const horizontalDiff = Math.abs(centerA.x - centerB.x);
  const verticalDiff = Math.abs(centerA.y - centerB.y);

  let position: Position;

  if (horizontalDiff > verticalDiff) {
    position = centerA.x > centerB.x ? Position.Left : Position.Right;
  } else {
    position = centerA.y > centerB.y ? Position.Top : Position.Bottom;
  }

  const [x, y] = getHandleCoordsByPosition(nodeA, position);
  return [x, y, position];
}

function getHandleCoordsByPosition(node: InternalNode, handlePosition: Position): HandleCoordinates {
  const handleList = node.internals.handleBounds?.source ?? [];
  const handle = handleList.find((h) => h.position === handlePosition);
  if (!handle) {
    const center = getNodeCenter(node);
    return [center.x, center.y];
  }
  const handleX = handle?.x ?? 0;
  const handleY = handle?.y ?? 0;
  const handleWidth = handle?.width ?? 0;
  const handleHeight = handle?.height ?? 0;

  let offsetX = handleWidth / 2;
  let offsetY = handleHeight / 2;

  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handleWidth;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handleHeight;
      break;
  }

  const x = node.internals.positionAbsolute.x + handleX + offsetX;
  const y = node.internals.positionAbsolute.y + handleY + offsetY;

  return [x, y];
}

function getNodeCenter(node: InternalNode) {
  const measuredWidth = node.measured.width ?? 0;
  const measuredHeight = node.measured.height ?? 0;

  return {
    x: node.internals.positionAbsolute.x + measuredWidth / 2,
    y: node.internals.positionAbsolute.y + measuredHeight / 2,
  };
}

function getEdgeParams(source: InternalNode, target: InternalNode, layout?: EdgeLayout): EdgeParams {
  const [, , defaultSourcePos] = getParams(source, target);
  const [, , defaultTargetPos] = getParams(target, source);
  const hasBends = (layout?.bends?.length ?? 0) > 0;
  const sourcePos = hasBends ? Position.Bottom : (layout?.sourcePosition ?? defaultSourcePos);
  const targetPos = hasBends ? Position.Top : (layout?.targetPosition ?? defaultTargetPos);
  const [sx, sy] = getHandleCoordsByPosition(source, sourcePos);
  const [tx, ty] = getHandleCoordsByPosition(target, targetPos);

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
}

function buildOrthogonalPath(
  layout: EdgeLayout | undefined,
  start: HandleCoordinates,
  end: HandleCoordinates,
): { points: HandleCoordinates[]; bendPoints: HandleCoordinates[] } {
  if (!layout) {
    return { points: [start, end], bendPoints: [] };
  }
  const offsetX = start[0] - layout.start.x;
  const offsetY = start[1] - layout.start.y;
  const translatedBends: HandleCoordinates[] = layout.bends.map((bend) => {
    const x = bend.x + offsetX;
    const y = bend.y + offsetY;
    return [x, y];
  });
  const points: HandleCoordinates[] = [start, ...translatedBends];
  const bendPoints: HandleCoordinates[] = translatedBends;
  const lastPoint = points[points.length - 1];
  if (!lastPoint || lastPoint[0] !== end[0] || lastPoint[1] !== end[1]) {
    points.push(end);
  }
  return { points, bendPoints };
}

function toPathD(points: HandleCoordinates[]): string {
  const head = points[0];
  if (!head) {
    return "";
  }
  const rest = points.slice(1);
  if (rest.length === 0) {
    return `M ${head[0]},${head[1]}`;
  }
  const segments = rest.map(([x, y]) => `L ${x},${y}`).join(" ");
  return `M ${head[0]},${head[1]} ${segments}`;
}

function getPathMidpoint(points: HandleCoordinates[]): HandleCoordinates {
  if (points.length === 0) {
    return [0, 0];
  }
  if (points.length === 1) {
    return points[0] ?? [0, 0];
  }
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1] ?? [0, 0];
    const [x2, y2] = points[index] ?? [0, 0];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  const half = total / 2;
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1] ?? [0, 0];
    const end = points[index] ?? [0, 0];
    const segment = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (traversed + segment >= half) {
      const ratio = segment === 0 ? 0 : (half - traversed) / segment;
      return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
    }
    traversed += segment;
  }
  return points[points.length - 1] ?? points[0] ?? [0, 0];
}

export function FloatingEdge({ id, source, target, markerEnd, style, data, selected }: EdgeProps<ReactFlowEdge>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const reactFlow = useReactFlow<ReactFlowNode, ReactFlowEdge>();
  const { interactionDisabled } = useFlowInteraction();
  const [edgeHover, setEdgeHover] = useState(false);
  const [labelHover, setLabelHover] = useState(false);
  const [hoveredHandleIndex, setHoveredHandleIndex] = useState<number | null>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [focusedHandleIndex, setFocusedHandleIndex] = useState<number | null>(null);
  const { zoom } = useViewport();
  const bendScale = zoom === 0 ? 1 : 1 / zoom;

  const baseLayout = data?.layout;
  const layout = useMemo(() => normalizeEdgeLayout(baseLayout), [baseLayout]);
  const sourceSelected = sourceNode?.selected === true;
  const targetSelected = targetNode?.selected === true;
  const edgeActive = interactionDisabled ? false : sourceSelected || targetSelected || selected === true;
  const handleHover = hoveredHandleIndex !== null;
  const hoverActive = interactionDisabled ? false : edgeHover || labelHover || handleHover || focusWithin;
  const baseStroke = typeof style?.stroke === "string" ? style.stroke : "var(--muted-foreground)";
  const resolvedStroke = baseStroke;
  const baseFilter = typeof style?.filter === "string" ? style.filter : undefined;
  const glowFilter = edgeActive ? "drop-shadow(0 0 4px var(--primary))" : hoverActive ? "drop-shadow(0 0 3px var(--muted-foreground))" : undefined;
  const resolvedFilter = glowFilter ?? baseFilter;
  const styleStrokeWidth = style?.strokeWidth;
  const baseStrokeWidth = typeof styleStrokeWidth === "number" ? styleStrokeWidth : Number.parseFloat(`${styleStrokeWidth ?? ""}`) || 1.5;
  const resolvedStrokeWidth = edgeActive ? 2.25 : hoverActive ? 2 : baseStrokeWidth;
  const scaledStrokeWidth = resolvedStrokeWidth * bendScale;
  const resolvedOpacity = edgeActive || hoverActive ? 1 : (style?.opacity ?? 0.5);
  const edgeStyle = useMemo(
    (): CSSProperties => ({
      ...(style ?? {}),
      stroke: resolvedStroke,
      strokeWidth: scaledStrokeWidth,
      opacity: resolvedOpacity,
      filter: resolvedFilter,
    }),
    [resolvedFilter, resolvedOpacity, resolvedStroke, scaledStrokeWidth, style],
  );
  const edgeParams = useMemo(() => {
    if (!sourceNode || !targetNode) {
      return null;
    }
    return getEdgeParams(sourceNode, targetNode, layout);
  }, [layout, sourceNode, targetNode]);
  const { points: layoutPathPoints, bendPoints } = useMemo(() => {
    if (!edgeParams) {
      return { points: [] as HandleCoordinates[], bendPoints: [] as HandleCoordinates[] };
    }
    return buildOrthogonalPath(layout, [edgeParams.sx, edgeParams.sy], [edgeParams.tx, edgeParams.ty]);
  }, [edgeParams, layout]);
  const label = typeof data?.label === "string" ? data.label : Array.isArray(data?.via) ? data.via.join(", ") : "";
  const labelLayout = data?.labelLayout;
  const labelPathPoints =
    layoutPathPoints.length > 0
      ? layoutPathPoints
      : edgeParams
        ? ([
            [edgeParams.sx, edgeParams.sy],
            [edgeParams.tx, edgeParams.ty],
          ] as HandleCoordinates[])
        : [];
  const layoutLabelCenter = useMemo(() => {
    if (!labelLayout || labelLayout.distanceRatio === undefined) {
      return null;
    }
    if (labelPathPoints.length < 2) {
      const offsetX = labelLayout.offsetX ?? 0;
      const offsetY = labelLayout.offsetY ?? 0;
      return [offsetX, offsetY];
    }
    let total = 0;
    for (let index = 1; index < labelPathPoints.length; index += 1) {
      const prev = labelPathPoints[index - 1] ?? [0, 0];
      const current = labelPathPoints[index] ?? [0, 0];
      total += Math.hypot(current[0] - prev[0], current[1] - prev[1]);
    }
    if (total === 0) {
      const offsetX = labelLayout.offsetX ?? 0;
      const offsetY = labelLayout.offsetY ?? 0;
      const [baseX, baseY] = labelPathPoints[0] ?? [0, 0];
      return [baseX + offsetX, baseY + offsetY];
    }
    const target = total * labelLayout.distanceRatio;
    let traversed = 0;
    for (let index = 1; index < labelPathPoints.length; index += 1) {
      const start = labelPathPoints[index - 1] ?? [0, 0];
      const end = labelPathPoints[index] ?? [0, 0];
      const segment = Math.hypot(end[0] - start[0], end[1] - start[1]);
      if (segment === 0) {
        continue;
      }
      if (traversed + segment >= target) {
        const ratio = (target - traversed) / segment;
        const baseX = start[0] + (end[0] - start[0]) * ratio;
        const baseY = start[1] + (end[1] - start[1]) * ratio;
        const offsetX = labelLayout.offsetX ?? 0;
        const offsetY = labelLayout.offsetY ?? 0;
        return [baseX + offsetX, baseY + offsetY];
      }
      traversed += segment;
    }
    const last = labelPathPoints[labelPathPoints.length - 1] ?? [0, 0];
    const offsetX = labelLayout.offsetX ?? 0;
    const offsetY = labelLayout.offsetY ?? 0;
    return [last[0] + offsetX, last[1] + offsetY];
  }, [labelLayout, labelPathPoints]);
  const hasLayoutPath = layout !== undefined && edgeParams !== null;
  const pathInfo = useMemo(() => {
    if (hasLayoutPath) {
      const path = toPathD(layoutPathPoints);
      const [lx, ly] = layoutLabelCenter ?? getPathMidpoint(layoutPathPoints);
      return { edgePath: path, labelX: lx, labelY: ly };
    }
    if (edgeParams) {
      const smooth = getBezierPath({
        sourceX: edgeParams.sx,
        sourceY: edgeParams.sy,
        sourcePosition: edgeParams.sourcePos,
        targetPosition: edgeParams.targetPos,
        targetX: edgeParams.tx,
        targetY: edgeParams.ty,
      });
      const [lx, ly] = layoutLabelCenter ?? [smooth[1] ?? 0, smooth[2] ?? 0];
      return { edgePath: smooth[0] ?? "", labelX: lx, labelY: ly };
    }
    return { edgePath: "", labelX: 0, labelY: 0 };
  }, [edgeParams, hasLayoutPath, layoutLabelCenter, layoutPathPoints]);
  const { edgePath, labelX, labelY } = pathInfo;
  const sx = edgeParams?.sx ?? 0;
  const sy = edgeParams?.sy ?? 0;

  const arrow = useMemo(() => {
    if (labelPathPoints.length === 0) {
      return { x: labelX, y: labelY, angle: 0 };
    }
    if (labelPathPoints.length === 1) {
      const single = labelPathPoints[0];
      if (!single) {
        return { x: labelX, y: labelY, angle: 0 };
      }
      const [singleX, singleY] = single;
      return { x: singleX, y: singleY, angle: 0 };
    }
    const endIndex = labelPathPoints.length - 1;
    const endPoint = labelPathPoints[endIndex];
    if (!endPoint) {
      return { x: labelX, y: labelY, angle: 0 };
    }
    let startIndex = endIndex - 1;
    let startPoint = startIndex >= 0 ? labelPathPoints[startIndex] : undefined;
    while (startIndex >= 0 && startPoint && startPoint[0] === endPoint[0] && startPoint[1] === endPoint[1]) {
      startIndex -= 1;
      startPoint = startIndex >= 0 ? labelPathPoints[startIndex] : undefined;
    }
    const resolvedStart = startPoint ?? endPoint;
    const [startX, startY] = resolvedStart;
    const [endX, endY] = endPoint;
    const dx = endX - startX;
    const dy = endY - startY;
    const segmentLength = Math.hypot(dx, dy);
    const angle = segmentLength === 0 ? 0 : Math.atan2(dy, dx);
    const tipOffset = segmentLength === 0 ? 0 : ARROW_TIP_OFFSET;
    const x = endX - Math.cos(angle) * tipOffset;
    const y = endY - Math.sin(angle) * tipOffset;
    return { x, y, angle };
  }, [labelPathPoints, labelX, labelY]);

  const updateBend = useCallback(
    (index: number, clientX: number, clientY: number) => {
      if (!edgeParams) {
        return;
      }
      const point = reactFlow.screenToFlowPosition({ x: clientX, y: clientY });
      reactFlow.setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== id) {
            return edge;
          }
          const currentData = (edge.data as ReactFlowEdge["data"]) ?? {};
          const normalizedLayout = normalizeEdgeLayout(currentData.layout);
          const bends = normalizedLayout?.bends ?? [];
          if (!normalizedLayout || !bends[index]) {
            return edge;
          }
          const translatedBend = {
            x: normalizedLayout.start.x + (point.x - sx),
            y: normalizedLayout.start.y + (point.y - sy),
          };
          const nextBends = bends.map((bend, bendIndex): { x: number; y: number } => (bendIndex === index ? translatedBend : bend));
          const nextLayout: EdgeLayout = {
            start: normalizedLayout.start,
            end: normalizedLayout.end,
            bends: nextBends,
          };
          if (normalizedLayout.sourcePosition !== undefined) {
            nextLayout.sourcePosition = normalizedLayout.sourcePosition;
          }
          if (normalizedLayout.targetPosition !== undefined) {
            nextLayout.targetPosition = normalizedLayout.targetPosition;
          }
          const nextData = { ...currentData, layout: nextLayout };
          return { ...edge, data: nextData };
        }),
      );
    },
    [edgeParams, id, reactFlow, sx, sy],
  );

  const removeBend = useCallback(
    (index: number) => {
      if (!edgeParams) {
        return;
      }
      setFocusedHandleIndex(null);
      reactFlow.setEdges((current) =>
        current.flatMap((edge) => {
          if (edge.id !== id) {
            return [edge];
          }
          const currentData = (edge.data as ReactFlowEdge["data"]) ?? {};
          const normalizedLayout = normalizeEdgeLayout(currentData.layout);
          if (!normalizedLayout || !normalizedLayout.bends[index]) {
            return [edge];
          }
          const nextBends = normalizedLayout.bends.filter((_, bendIndex) => bendIndex !== index);
          if (nextBends.length < 2) {
            return [];
          }
          const nextLayout: EdgeLayout = {
            start: normalizedLayout.start,
            end: normalizedLayout.end,
            bends: nextBends,
          };
          if (normalizedLayout.sourcePosition !== undefined) {
            nextLayout.sourcePosition = normalizedLayout.sourcePosition;
          }
          if (normalizedLayout.targetPosition !== undefined) {
            nextLayout.targetPosition = normalizedLayout.targetPosition;
          }
          const nextData = { ...currentData, layout: nextLayout };
          return [{ ...edge, data: nextData }];
        }),
      );
      setDraggingIndex(null);
    },
    [edgeParams, id, reactFlow],
  );

  useEffect(() => {
    if (draggingIndex === null) {
      return undefined;
    }
    const handleMove = (event: PointerEvent): void => {
      event.preventDefault();
      updateBend(draggingIndex, event.clientX, event.clientY);
    };
    const handleUp = (): void => {
      setDraggingIndex(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingIndex, updateBend]);

  const isSameEdgeTarget = useCallback(
    (target: EventTarget | null): boolean => target instanceof Element && target.closest(`[data-edge-id="${id}"]`) !== null,
    [id],
  );

  useEffect(() => {
    const handleGlobalPointerDown = (event: PointerEvent): void => {
      if (isSameEdgeTarget(event.target)) {
        return;
      }
      setFocusWithin(false);
      setFocusedHandleIndex(null);
      setHoveredHandleIndex(null);
      if (draggingIndex === null) {
        setEdgeHover(false);
        setLabelHover(false);
      }
    };
    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () => {
      window.removeEventListener("pointerdown", handleGlobalPointerDown);
    };
  }, [draggingIndex, isSameEdgeTarget]);

  const handleSelectedVisibility =
    !interactionDisabled && (selected === true || edgeHover || labelHover || handleHover || focusWithin || draggingIndex !== null) && bendPoints.length > 0;
  useEffect(() => {
    if (!interactionDisabled) {
      return;
    }
    setEdgeHover(false);
    setLabelHover(false);
    setHoveredHandleIndex(null);
    setFocusWithin(false);
    setDraggingIndex(null);
    setFocusedHandleIndex(null);
  }, [interactionDisabled]);

  useEffect(() => {
    if (!handleSelectedVisibility) {
      setFocusedHandleIndex(null);
    }
  }, [handleSelectedVisibility]);

  if (!edgeParams) {
    return null;
  }

  return (
    <>
      <path
        aria-hidden="true"
        className="react-flow__edge-interaction"
        d={edgePath}
        data-edge-id={id}
        fill="none"
        onMouseEnter={() => setEdgeHover(true)}
        onMouseLeave={() => setEdgeHover(false)}
        pointerEvents={interactionDisabled ? "none" : "stroke"}
        stroke="transparent"
        strokeLinecap="round"
        strokeWidth={14 * bendScale}
        tabIndex={-1}
      />
      <path
        aria-hidden="true"
        className="react-flow__edge-path"
        d={edgePath}
        data-edge-id={id}
        id={id}
        markerEnd={markerEnd}
        onMouseEnter={() => {
          if (!interactionDisabled) {
            setEdgeHover(true);
          }
        }}
        onMouseLeave={() => setEdgeHover(false)}
        pointerEvents={interactionDisabled ? "none" : undefined}
        strokeWidth={scaledStrokeWidth}
        style={edgeStyle}
        tabIndex={-1}
      />
      {label.length > 0 && (
        <EdgeLabelRenderer>
          <button
            className="px-1 text-[11px] font-medium text-foreground"
            data-edge-id={id}
            onBlur={(event) => {
              if (!isSameEdgeTarget(event.relatedTarget)) {
                setFocusWithin(false);
              }
            }}
            onFocus={() => {
              if (!interactionDisabled) {
                setFocusWithin(true);
              }
            }}
            onMouseEnter={() => {
              if (!interactionDisabled) {
                setLabelHover(true);
              }
            }}
            onMouseLeave={() => setLabelHover(false)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: interactionDisabled ? "none" : "auto",
              zIndex: 30,
              outline: "none",
              WebkitTapHighlightColor: "transparent",
              cursor: "inherit",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              backdropFilter: "none",
            }}
            tabIndex={interactionDisabled ? -1 : 0}
            type="button"
          >
            {label}
          </button>
        </EdgeLabelRenderer>
      )}
      {handleSelectedVisibility && (
        <EdgeLabelRenderer>
          {bendPoints.map(([x, y], index) => {
            const bendLayout = layout?.bends?.[index];
            const key = bendLayout ? `handle-${id}-${bendLayout.x}-${bendLayout.y}` : `handle-${id}-${x}-${y}`;
            const isHandleFocused = focusedHandleIndex === index;
            const isHandleHovered = hoveredHandleIndex === index;
            const isHandleActive = isHandleFocused || isHandleHovered;
            return (
              <button
                aria-label="Adjust edge bend position"
                data-edge-id={id}
                key={key}
                onBlur={(event) => {
                  setHoveredHandleIndex(null);
                  setFocusedHandleIndex(null);
                  if (!isSameEdgeTarget(event.relatedTarget)) {
                    setFocusWithin(false);
                  }
                }}
                onFocus={() => {
                  setFocusWithin(true);
                  setFocusedHandleIndex(index);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" || event.key === "Delete") {
                    event.preventDefault();
                    removeBend(index);
                  }
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setFocusWithin(true);
                  setDraggingIndex(index);
                }}
                onMouseEnter={() => {
                  if (!interactionDisabled) {
                    setHoveredHandleIndex(index);
                  }
                }}
                onMouseLeave={() => setHoveredHandleIndex(null)}
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${bendScale})`,
                  transformOrigin: "center",
                  width: 12,
                  height: 12,
                  borderRadius: "9999px",
                  background: isHandleActive ? "var(--primary)" : "var(--background)",
                  border: "2px solid var(--primary)",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
                  cursor: "inherit",
                  zIndex: 1000,
                  pointerEvents: interactionDisabled ? "none" : "auto",
                  outline: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
                tabIndex={interactionDisabled ? -1 : 0}
                type="button"
              />
            );
          })}
        </EdgeLabelRenderer>
      )}
      <EdgeLabelRenderer>
        <div
          aria-hidden="true"
          data-edge-id={id}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${arrow.x}px, ${arrow.y}px) rotate(${arrow.angle}rad)`,
            pointerEvents: "none",
            zIndex: 25,
            filter: glowFilter,
          }}
        >
          <svg height={16} viewBox="0 0 24 24" width={16}>
            <title>dependency direction</title>
            <path d="M12 7l6 5-6 5" fill="none" stroke={resolvedStroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
          </svg>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
