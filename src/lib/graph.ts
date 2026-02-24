import { type Edge as FlowEdge, type Node as FlowNode, Position } from "@xyflow/react";
import ELK, { type ElkExtendedEdge, type ElkLabel, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { HclAttributeNode, HclBlockNode, HclDocument, HclExpression, HclNode } from "~/lib/hcl";

export type GraphResourceAddress = {
  resourceType: string;
  name: string;
};

export type NodeLabelDimensions = {
  width: number;
  height: number;
};

export type NodeLabelLayout = NodeLabelDimensions & {
  x: number;
  y: number;
};

export type EdgeLabelLayout = NodeLabelLayout;
export type EdgeLabelPlacement = EdgeLabelLayout & {
  distanceRatio?: number;
  offsetX?: number;
  offsetY?: number;
};

export type GraphNodeMeta = {
  id: string;
  label: string;
  type: ReactFlowNodeType;
  graphNode?: GraphNode;
  width?: number;
  height?: number;
  labelSize?: NodeLabelDimensions;
};

export type GraphDocumentEntry =
  | {
      kind: "resource";
      nodeId: string;
    }
  | {
      kind: "node";
      node: HclNode;
    }
  | {
      kind: "provider";
      nodeId: string;
    };

export type GraphDocumentNode = {
  id: string;
  type: "document";
  data: {
    tokens: HclDocument["tokens"];
    source: string;
    order: GraphDocumentEntry[];
  };
};

export type GraphResourceNode = {
  id: string;
  type: "resource";
  data: {
    address: GraphResourceAddress;
    block: HclBlockNode;
  };
};

export type GraphProviderNode = {
  id: string;
  type: "provider";
  data: {
    name: string;
    alias?: string;
    block: HclBlockNode;
  };
};

export type GraphVirtualGroupNode = {
  id: string;
  type: "group-virtual";
  data: {
    label: string;
  };
};

export type GraphNode = GraphDocumentNode | GraphResourceNode | GraphProviderNode | GraphVirtualGroupNode;

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: "depends_on";
  index?: number;
  via?: string[];
};

export type GraphGroupingMetadata = {
  providerName: string | null;
  region?: string;
  vpcId: string | null;
  subnetIds: string[];
  availabilityZone?: string;
  securityGroupIds: string[];
};

export type ReactFlowNodeData = {
  label?: string;
  graphNode?: GraphNode;
  labelLayout?: NodeLabelLayout;
  hovered?: boolean;
  interactionDisabled?: boolean;
  [key: string]: unknown;
};

export type ReactFlowEdgeData = {
  relation?: GraphEdge["relation"];
  index?: number;
  label?: string;
  via?: string[];
  layout?: EdgeLayout;
  labelLayout?: EdgeLabelPlacement;
  interactionDisabled?: boolean;
  [key: string]: unknown;
};

export type ReactFlowNode = FlowNode<ReactFlowNodeData>;
export type ReactFlowEdge = FlowEdge<ReactFlowEdgeData>;

export type ReactFlowGraph = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
};

export type EdgeLayoutPoint = {
  x: number;
  y: number;
};

export type EdgeLayout = {
  start: EdgeLayoutPoint;
  end: EdgeLayoutPoint;
  bends: EdgeLayoutPoint[];
  sourcePosition?: Position;
  targetPosition?: Position;
};

export type ReactFlowNodeType = "document" | "resource" | "group-real" | "group-virtual";

const elk = new ELK();
const DOCUMENT_NODE_ID = "document";
const RESOURCE_NODE_SIZE = 48;
const RESOURCE_LABEL_CHAR_WIDTH = 7;
const RESOURCE_LABEL_HORIZONTAL_PADDING = 8;
const RESOURCE_LABEL_HEIGHT = 16;
const RESOURCE_LABEL_PLACEMENT = "OUTSIDE V_BOTTOM H_CENTER";
const EDGE_LABEL_CHAR_WIDTH = 7;
const EDGE_LABEL_HORIZONTAL_PADDING = 16;
const EDGE_LABEL_HEIGHT = 22;
const EDGE_LABEL_PLACEMENT = "CENTER";
const EDGE_LABEL_OFFSET_SCALE = 0.55;
const GROUP_NODE_PADDING = "[top=32,left=20,bottom=24,right=20]";
const GROUP_NODE_MINIMUM_SIZE = "(width=128,height=128)";
const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.padding": "[top=16,left=14,bottom=12,right=14]",
  "elk.nodeSize.minimum": "(width=72,height=72)",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.spacing.nodeNode": "14",
  "elk.layered.spacing.nodeNodeBetweenLayers": "40",
  "elk.layered.spacing.edgeNodeBetweenLayers": "10",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "6",
  "elk.layered.mergeEdges": "true",
  "elk.layered.compaction.postCompaction.enabled": "true",
  "elk.layered.nodePlacement.favorStraightEdges": "false",
  "elk.edgeRouting": "ORTHOGONAL",
} as const;

function elkToReactFlow(
  layoutedElk: ElkNode,
  nodeMeta: Map<string, GraphNodeMeta>,
  parentMap: Map<string, string | null>,
  originalEdges: GraphEdge[],
  documentNode: GraphNode | null,
): ReactFlowGraph {
  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];

  const edgeById = new Map(originalEdges.map((edge) => [edge.id, edge]));
  const edgeByPair = new Map(originalEdges.map((edge) => [`${edge.source}|${edge.target}`, edge]));
  const nodeBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  const collectEdges = (node: ElkNode): ElkExtendedEdge[] => {
    const current = node.edges ?? [];
    const children = node.children ?? [];
    const nested = children.flatMap((child) => collectEdges(child));
    return [...current, ...nested];
  };

  if (documentNode) {
    nodes.push({
      id: documentNode.id,
      type: graphNodeToFlowType(documentNode),
      position: { x: 0, y: 0 },
      data: {
        label: graphNodeToLabel(documentNode),
        graphNode: documentNode,
      },
      hidden: true,
    });
  }

  const visitNode = (node: ElkNode): void => {
    if (node.id && node.id !== "root") {
      const meta = nodeMeta.get(node.id);
      if (meta) {
        const width = node.width ?? meta.width;
        const height = node.height ?? meta.height;
        const nodeData: ReactFlowNodeData = {
          label: meta.label,
        };
        if (meta.type === "resource") {
          const label = node.labels?.find((current) => current.id === `label:${meta.id}`) ?? (node.labels ? node.labels[0] : null);
          if (label && typeof label.width === "number" && typeof label.height === "number") {
            nodeData.labelLayout = {
              x: label.x ?? 0,
              y: label.y ?? 0,
              width: label.width,
              height: label.height,
            };
          }
        }
        if (meta.graphNode) {
          nodeData.graphNode = meta.graphNode;
        }
        const reactFlowNode: ReactFlowNode = {
          id: meta.id,
          type: meta.type,
          position: {
            x: node.x ?? 0,
            y: node.y ?? 0,
          },
          data: nodeData,
        };
        const parentId = parentMap.get(meta.id);
        if (parentId) {
          reactFlowNode.parentId = parentId;
        }
        if (typeof width === "number" || typeof height === "number") {
          reactFlowNode.style = {
            width: width ?? meta.width,
            height: height ?? meta.height,
          };
        }
        if (meta.type === "group-real" || meta.type === "group-virtual") {
          reactFlowNode.style = {
            ...(reactFlowNode.style ?? {}),
            pointerEvents: "none",
          };
        }
        nodeBoxes.set(meta.id, {
          x: reactFlowNode.position.x,
          y: reactFlowNode.position.y,
          width: typeof width === "number" ? width : (meta.width ?? 0),
          height: typeof height === "number" ? height : (meta.height ?? 0),
        });
        nodes.push(reactFlowNode);
      }
    }
    if (node.children) {
      for (const child of node.children) {
        visitNode(child);
      }
    }
  };

  if (layoutedElk.children) {
    for (const child of layoutedElk.children) {
      visitNode(child);
    }
  }

  for (const edge of collectEdges(layoutedElk)) {
    const originalEdge = edgeById.get(edge.id ?? "") ?? edgeByPair.get(`${edge.sources?.[0] ?? ""}|${edge.targets?.[0] ?? ""}`);
    const edgeData: ReactFlowEdgeData = {
      relation: originalEdge?.relation ?? "depends_on",
    };
    const layoutIndex = originalEdge?.index;
    if (typeof layoutIndex === "number") {
      edgeData.index = layoutIndex;
    }
    if (originalEdge?.via && originalEdge.via.length > 0) {
      edgeData.via = originalEdge.via;
      edgeData.label = originalEdge.via.join(", ");
    }
    const inferPosition = (point: EdgeLayoutPoint, box: { x: number; y: number; width: number; height: number }): Position | undefined => {
      const tolerance = 1;
      if (Math.abs(point.x - box.x) <= tolerance) {
        return Position.Left;
      }
      if (Math.abs(point.x - (box.x + box.width)) <= tolerance) {
        return Position.Right;
      }
      if (Math.abs(point.y - box.y) <= tolerance) {
        return Position.Top;
      }
      if (Math.abs(point.y - (box.y + box.height)) <= tolerance) {
        return Position.Bottom;
      }
      return undefined;
    };
    const section = edge.sections?.[0];
    if (section?.startPoint && section.endPoint) {
      const sourceId = edge.sources?.[0] ?? "";
      const targetId = edge.targets?.[0] ?? "";
      const start: EdgeLayoutPoint = { x: section.startPoint.x, y: section.startPoint.y };
      const end: EdgeLayoutPoint = { x: section.endPoint.x, y: section.endPoint.y };
      const bends: EdgeLayoutPoint[] = (section.bendPoints ?? []).map((bend) => ({ x: bend.x, y: bend.y }));
      const sourceBox = nodeBoxes.get(sourceId);
      const targetBox = nodeBoxes.get(targetId);
      const sourcePosition = sourceBox ? inferPosition(start, sourceBox) : undefined;
      const targetPosition = targetBox ? inferPosition(end, targetBox) : undefined;
      const layout: EdgeLayout = {
        start,
        end,
        bends,
      };
      if (sourcePosition !== undefined) {
        layout.sourcePosition = sourcePosition;
      }
      if (targetPosition !== undefined) {
        layout.targetPosition = targetPosition;
      }
      edgeData.layout = layout;
      const label = edge.labels?.find((current) => current.id === `label:${edge.id}`) ?? (edge.labels && edge.labels.length > 0 ? edge.labels[0] : null);
      if (label && typeof label.width === "number" && typeof label.height === "number") {
        const placement = buildEdgeLabelPlacement(section, label);
        edgeData.labelLayout = placement;
      }
    }
    edges.push({
      id: edge.id ?? "",
      source: edge.sources?.[0] ?? "",
      target: edge.targets?.[0] ?? "",
      type: "floating",
      data: edgeData,
    });
  }

  return { nodes, edges };
}

function buildGraphFromAst(document: HclDocument): {
  documentNode: GraphDocumentNode;
  resourceNodes: GraphResourceNode[];
  providerNodes: GraphProviderNode[];
  edges: GraphEdge[];
  addressToId: Map<string, string>;
} {
  const order: GraphDocumentEntry[] = [];
  const resources: GraphResourceNode[] = [];
  const providers: GraphProviderNode[] = [];
  const addressToId = new Map<string, string>();
  const idUsage = new Map<string, number>();

  for (const node of document.nodes) {
    const providerBlock = extractProviderBlock(node);
    if (providerBlock) {
      const providerData: GraphProviderNode["data"] = {
        name: providerBlock.name,
        block: clone(providerBlock.block),
      };
      if (providerBlock.alias) {
        providerData.alias = providerBlock.alias;
      }
      const providerIdBase = `provider:${providerBlock.name}`;
      const providerId = providerBlock.alias ? `${providerIdBase}.${providerBlock.alias}` : providerIdBase;
      const providerNode: GraphProviderNode = {
        id: providerId,
        type: "provider",
        data: providerData,
      };
      providers.push(providerNode);
      order.push({ kind: "provider", nodeId: providerNode.id });
      continue;
    }
    const resourceBlock = extractResourceBlock(node);
    if (resourceBlock) {
      const key = addressKey(resourceBlock.address);
      if (addressToId.has(key)) {
        throw new Error(`Duplicate resource address ${resourceBlock.address.resourceType}.${resourceBlock.address.name}`);
      }
      const baseId = `resource:${resourceBlock.address.resourceType}.${resourceBlock.address.name}`;
      const usageCount = idUsage.get(baseId) ?? 0;
      idUsage.set(baseId, usageCount + 1);
      const id = usageCount === 0 ? baseId : `${baseId}#${usageCount}`;
      const resourceNode: GraphResourceNode = {
        id,
        type: "resource",
        data: {
          address: resourceBlock.address,
          block: clone(resourceBlock.block),
        },
      };
      resources.push(resourceNode);
      addressToId.set(key, id);
      order.push({ kind: "resource", nodeId: id });
    } else {
      order.push({ kind: "node", node: clone(node) });
    }
  }

  const documentNode: GraphDocumentNode = {
    id: DOCUMENT_NODE_ID,
    type: "document",
    data: {
      tokens: clone(document.tokens),
      source: document.source,
      order,
    },
  };

  const edges = buildDependencyEdges(resources, addressToId);

  return {
    documentNode,
    resourceNodes: resources,
    providerNodes: providers,
    edges,
    addressToId,
  };
}

const GROUP_PRIORITY_ROOT = 0;
const GROUP_PRIORITY_REGION = 15;
const GROUP_PRIORITY_PROVIDER = 10;
const GROUP_PRIORITY_VPC = 20;
const GROUP_PRIORITY_SECURITY_GROUP = 30;
const GROUP_PRIORITY_AVAILABILITY_ZONE = 40;
const GROUP_PRIORITY_SUBNET = 50;

function buildSemanticGrouping(
  resourceNodes: GraphResourceNode[],
  providerNodes: GraphProviderNode[],
  addressToId: Map<string, string>,
): {
  nodeMeta: Map<string, GraphNodeMeta>;
  parentMap: Map<string, string | null>;
} {
  const nodeMeta = new Map<string, GraphNodeMeta>();
  const parentMap = new Map<string, string | null>();
  const parentPriority = new Map<string, number>();
  const providerByName = new Map<string, GraphProviderNode>();
  const providerRegionById = new Map<string, string>();
  const regionNodes = new Map<string, GraphVirtualGroupNode>();
  const ensureRegionNode = (providerName: string, region: string): GraphVirtualGroupNode => {
    const key = `${providerName}:${region}`;
    const existing = regionNodes.get(key);
    if (existing) {
      return existing;
    }
    const id = `virtual:region:${providerName}:${region}`;
    const node: GraphVirtualGroupNode = {
      id,
      type: "group-virtual",
      data: {
        label: `Region ${region}`,
      },
    };
    regionNodes.set(key, node);
    nodeMeta.set(id, {
      id,
      label: node.data.label,
      type: "group-virtual",
      graphNode: node,
    });
    assignParent(id, null, GROUP_PRIORITY_ROOT, parentMap, parentPriority);
    return node;
  };
  for (const provider of providerNodes) {
    providerByName.set(provider.data.name, provider);
    const label = graphNodeToLabel(provider);
    nodeMeta.set(provider.id, {
      id: provider.id,
      label,
      type: graphNodeToFlowType(provider),
      graphNode: provider,
    });
    let providerRegion: string | null = null;
    if (provider.data.name === "aws") {
      for (const child of provider.data.block.body) {
        if (child.kind !== "Attribute") {
          continue;
        }
        if (child.name !== "region") {
          continue;
        }
        if (child.expression.kind !== "Literal") {
          continue;
        }
        if (child.expression.literalKind !== "string") {
          continue;
        }
        if (typeof child.expression.value === "string") {
          providerRegion = child.expression.value;
        }
      }
    }
    if (providerRegion) {
      providerRegionById.set(provider.id, providerRegion);
      const regionNode = ensureRegionNode(provider.data.name, providerRegion);
      assignParent(provider.id, regionNode.id, GROUP_PRIORITY_REGION, parentMap, parentPriority);
    } else {
      assignParent(provider.id, null, GROUP_PRIORITY_ROOT, parentMap, parentPriority);
    }
  }

  const resourceMetadata = analyzeResourceMetadata(resourceNodes, addressToId);
  for (const resource of resourceNodes) {
    const label = graphNodeToLabel(resource);
    const nodeType = graphNodeToFlowType(resource);
    const meta: GraphNodeMeta = {
      id: resource.id,
      label,
      type: nodeType,
      graphNode: resource,
    };
    if (nodeType === "resource") {
      const size = getResourceNodeSize();
      meta.width = size.width;
      meta.height = size.height;
      meta.labelSize = getResourceLabelSize(label);
    }
    nodeMeta.set(resource.id, meta);
    assignParent(resource.id, null, GROUP_PRIORITY_ROOT, parentMap, parentPriority);
  }

  for (const metadata of resourceMetadata.values()) {
    if (!(metadata.availabilityZone ?? null) && metadata.subnetIds.length === 1) {
      const subnetMeta = resourceMetadata.get(metadata.subnetIds[0] ?? "");
      const subnetZone = subnetMeta?.availabilityZone ?? null;
      if (subnetZone) {
        metadata.availabilityZone = subnetZone;
      }
    }
    if (!(metadata.region ?? null) && metadata.availabilityZone) {
      const derivedRegion = deriveAwsRegionFromAvailabilityZone(metadata.availabilityZone);
      if (derivedRegion) {
        metadata.region = derivedRegion;
      }
    }
    if (!(metadata.region ?? null) && metadata.providerName) {
      const provider = providerByName.get(metadata.providerName);
      const providerRegion = provider ? (providerRegionById.get(provider.id) ?? null) : null;
      if (providerRegion) {
        metadata.region = providerRegion;
      }
    }
  }

  const regionByVpc = new Map<string, string>();
  for (const metadata of resourceMetadata.values()) {
    const vpcId = metadata.vpcId;
    const region = metadata.region;
    if (!vpcId || !region) {
      continue;
    }
    const current = regionByVpc.get(vpcId);
    if (current === undefined) {
      regionByVpc.set(vpcId, region);
      continue;
    }
    if (current !== region) {
      regionByVpc.set(vpcId, "");
    }
  }
  for (const [vpcId, region] of regionByVpc.entries()) {
    if (!region) {
      continue;
    }
    const vpcMeta = resourceMetadata.get(vpcId);
    if (vpcMeta && !(vpcMeta.region ?? null)) {
      vpcMeta.region = region;
    }
  }
  for (const metadata of resourceMetadata.values()) {
    if (metadata.region ?? null) {
      continue;
    }
    const vpcId = metadata.vpcId ?? null;
    if (!vpcId) {
      continue;
    }
    const vpcMeta = resourceMetadata.get(vpcId);
    const vpcRegion = vpcMeta?.region ?? null;
    if (vpcRegion) {
      metadata.region = vpcRegion;
    }
  }

  const inferredProviderRegion = new Map<string, string>();
  for (const metadata of resourceMetadata.values()) {
    const providerName = metadata.providerName ?? null;
    const region = metadata.region ?? null;
    if (!providerName || !region) {
      continue;
    }
    const current = inferredProviderRegion.get(providerName);
    if (current === undefined) {
      inferredProviderRegion.set(providerName, region);
      continue;
    }
    if (current === "") {
      continue;
    }
    if (current !== region) {
      inferredProviderRegion.set(providerName, "");
    }
  }
  for (const [providerName, region] of inferredProviderRegion.entries()) {
    if (!region) {
      continue;
    }
    const provider = providerByName.get(providerName);
    if (!provider) {
      continue;
    }
    if (providerRegionById.has(provider.id)) {
      continue;
    }
    providerRegionById.set(provider.id, region);
    const regionNode = ensureRegionNode(provider.data.name, region);
    assignParent(provider.id, regionNode.id, GROUP_PRIORITY_REGION, parentMap, parentPriority);
  }

  const subnetSecurityGroupCandidates = new Map<string, Set<string>>();
  for (const metadata of resourceMetadata.values()) {
    if (metadata.securityGroupIds.length === 0) {
      continue;
    }
    if (metadata.subnetIds.length === 0) {
      continue;
    }
    for (const subnetId of metadata.subnetIds) {
      const current = subnetSecurityGroupCandidates.get(subnetId) ?? new Set<string>();
      for (const securityGroupId of metadata.securityGroupIds) {
        current.add(securityGroupId);
      }
      subnetSecurityGroupCandidates.set(subnetId, current);
    }
  }
  const subnetSecurityGroup = new Map<string, string>();
  for (const [subnetId, candidates] of subnetSecurityGroupCandidates.entries()) {
    if (candidates.size === 1) {
      const [securityGroupId] = Array.from(candidates);
      if (securityGroupId) {
        subnetSecurityGroup.set(subnetId, securityGroupId);
      }
    }
  }

  const azNodes = new Map<string, GraphVirtualGroupNode>();
  const ensureAzNode = (vpcId: string | null, providerId: string | null, securityGroupId: string | null, zone: string): GraphVirtualGroupNode => {
    const scope = securityGroupId ?? vpcId ?? providerId ?? "root";
    const key = `${scope}:${zone}`;
    const existing = azNodes.get(key);
    if (existing) {
      return existing;
    }
    const id = `virtual:az:${scope}:${zone}`;
    const azNode: GraphVirtualGroupNode = {
      id,
      type: "group-virtual",
      data: {
        label: `Availability Zone ${zone}`,
      },
    };
    azNodes.set(key, azNode);
    nodeMeta.set(id, {
      id,
      label: azNode.data.label,
      type: "group-virtual",
      graphNode: azNode,
    });
    const parentId = securityGroupId ?? vpcId ?? providerId ?? null;
    const priority = securityGroupId ? GROUP_PRIORITY_SECURITY_GROUP : GROUP_PRIORITY_VPC;
    assignParent(id, parentId, priority, parentMap, parentPriority);
    return azNode;
  };

  for (const resource of resourceNodes) {
    const metadata = resourceMetadata.get(resource.id);
    if (!metadata) {
      continue;
    }
    const provider = metadata.providerName ? (providerByName.get(metadata.providerName) ?? null) : null;
    const providerId = provider?.id ?? null;
    const regionName = metadata.region ?? (providerId ? (providerRegionById.get(providerId) ?? null) : null);
    if (regionName && metadata.providerName) {
      const regionNode = ensureRegionNode(metadata.providerName, regionName);
      assignParent(resource.id, regionNode.id, GROUP_PRIORITY_REGION, parentMap, parentPriority);
    }
    if (provider) {
      assignParent(resource.id, provider.id, GROUP_PRIORITY_PROVIDER, parentMap, parentPriority);
    }
    if (metadata.vpcId) {
      assignParent(resource.id, metadata.vpcId, GROUP_PRIORITY_VPC, parentMap, parentPriority);
    }
    const securityGroupId = metadata.securityGroupIds[0] ?? null;
    if (securityGroupId) {
      assignParent(resource.id, securityGroupId, GROUP_PRIORITY_SECURITY_GROUP, parentMap, parentPriority);
    }
    const availabilityZone = metadata.availabilityZone ?? null;
    if (isSubnetResource(resource.data.address.resourceType)) {
      if (availabilityZone) {
        const subnetSecurityGroupId = subnetSecurityGroup.get(resource.id) ?? null;
        const azNode = ensureAzNode(metadata.vpcId ?? null, providerId, subnetSecurityGroupId, availabilityZone);
        assignParent(resource.id, azNode.id, GROUP_PRIORITY_AVAILABILITY_ZONE, parentMap, parentPriority);
      }
      continue;
    }
    if (metadata.subnetIds.length === 1) {
      const subnetId = metadata.subnetIds[0] ?? null;
      if (subnetId) {
        assignParent(resource.id, subnetId, GROUP_PRIORITY_SUBNET, parentMap, parentPriority);
      }
      continue;
    }
    if (availabilityZone) {
      const azNode = ensureAzNode(metadata.vpcId ?? null, providerId, securityGroupId, availabilityZone);
      assignParent(resource.id, azNode.id, GROUP_PRIORITY_AVAILABILITY_ZONE, parentMap, parentPriority);
    }
    if (metadata.subnetIds.length > 1) {
      const vpcCandidates = new Set<string>();
      for (const subnetId of metadata.subnetIds) {
        const subnetMeta = resourceMetadata.get(subnetId);
        if (subnetMeta?.vpcId) {
          vpcCandidates.add(subnetMeta.vpcId);
        }
      }
      if (vpcCandidates.size === 1) {
        const [vpcId] = Array.from(vpcCandidates);
        if (vpcId) {
          assignParent(resource.id, vpcId, GROUP_PRIORITY_VPC, parentMap, parentPriority);
        }
      }
    }
  }

  for (const azNode of azNodes.values()) {
    if (!parentMap.has(azNode.id)) {
      assignParent(azNode.id, null, GROUP_PRIORITY_ROOT, parentMap, parentPriority);
    }
  }

  for (const meta of nodeMeta.values()) {
    if (!parentMap.has(meta.id)) {
      parentMap.set(meta.id, null);
    }
  }

  const childCounts = new Map<string, number>();
  for (const [_nodeId, parentId] of parentMap.entries()) {
    if (parentId) {
      childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
    }
  }
  for (const resource of resourceNodes) {
    const meta = nodeMeta.get(resource.id);
    if (!meta) {
      continue;
    }
    if (meta.type === "group-real" && (childCounts.get(resource.id) ?? 0) === 0) {
      const size = getResourceNodeSize();
      meta.type = "resource";
      meta.width = size.width;
      meta.height = size.height;
      meta.labelSize = getResourceLabelSize(meta.label);
    }
  }

  for (const [nodeId, meta] of nodeMeta.entries()) {
    if (meta.type !== "group-virtual") {
      continue;
    }
    if (!nodeId.startsWith("virtual:region:")) {
      continue;
    }
    if ((childCounts.get(nodeId) ?? 0) > 0) {
      continue;
    }
    nodeMeta.delete(nodeId);
    parentMap.delete(nodeId);
  }

  return { nodeMeta, parentMap };
}

function assignParent(
  nodeId: string,
  parentId: string | null,
  priority: number,
  parentMap: Map<string, string | null>,
  priorityMap: Map<string, number>,
): void {
  const current = priorityMap.get(nodeId) ?? Number.NEGATIVE_INFINITY;
  if (priority < current) {
    return;
  }
  priorityMap.set(nodeId, priority);
  parentMap.set(nodeId, parentId ?? null);
}

const SUBNET_REFERENCE_ATTRIBUTES = ["subnet_id", "subnet", "subnet_ids", "subnets", "vpc_zone_identifier"];
const SECURITY_GROUP_REFERENCE_ATTRIBUTES = ["security_group_ids", "security_groups", "vpc_security_group_ids"];

function deriveAwsRegionFromAvailabilityZone(availabilityZone: string): string | null {
  const strictMatch = availabilityZone.match(/^([a-z]{2}-[a-z0-9-]+-[0-9]+)[a-z]$/i);
  if (strictMatch && typeof strictMatch[1] === "string") {
    return strictMatch[1];
  }
  if (/^[a-z0-9-]+[a-z]$/i.test(availabilityZone)) {
    return availabilityZone.slice(0, -1);
  }
  return null;
}

function analyzeResourceMetadata(resourceNodes: GraphResourceNode[], addressToId: Map<string, string>): Map<string, GraphGroupingMetadata> {
  const metadata = new Map<string, GraphGroupingMetadata>();
  for (const resource of resourceNodes) {
    const attributes = new Map<string, HclAttributeNode>();
    for (const node of resource.data.block.body) {
      if (node.kind === "Attribute") {
        attributes.set(node.name, node);
      }
    }
    const resourceType = resource.data.address.resourceType;
    const providerNameIndex = resourceType.indexOf("_");
    const providerName = providerNameIndex === -1 ? null : resourceType.slice(0, providerNameIndex);
    let vpcId: string | null = null;
    for (const name of ["vpc_id"]) {
      const attribute = attributes.get(name);
      if (!attribute) {
        continue;
      }
      const ids = collectReferencedResourceIds(attribute.expression, addressToId);
      if (ids.length > 0) {
        const first = ids[0];
        if (first) {
          vpcId = first;
          break;
        }
      }
    }
    const subnetIds = getReferencesFromAttributes(attributes, SUBNET_REFERENCE_ATTRIBUTES, addressToId);
    const availabilityAttribute = attributes.get("availability_zone");
    let availabilityZone: string | null = null;
    let region: string | null = null;
    if (availabilityAttribute) {
      const expression = availabilityAttribute.expression;
      if (expression.kind === "Literal" && expression.literalKind === "string" && typeof expression.value === "string") {
        availabilityZone = expression.value;
      }
    }
    if (availabilityZone) {
      region = deriveAwsRegionFromAvailabilityZone(availabilityZone);
    }
    const securityGroupIds = getReferencesFromAttributes(attributes, SECURITY_GROUP_REFERENCE_ATTRIBUTES, addressToId);
    const entry: GraphGroupingMetadata = {
      providerName,
      vpcId,
      subnetIds,
      securityGroupIds,
    };
    if (availabilityZone) {
      entry.availabilityZone = availabilityZone;
    }
    if (region) {
      entry.region = region;
    }
    metadata.set(resource.id, entry);
  }
  return metadata;
}

function getReferencesFromAttributes(attributes: Map<string, HclAttributeNode>, names: string[], addressToId: Map<string, string>): string[] {
  const results = new Set<string>();
  for (const name of names) {
    const attribute = attributes.get(name);
    if (!attribute) {
      continue;
    }
    for (const id of collectReferencedResourceIds(attribute.expression, addressToId)) {
      results.add(id);
    }
  }
  return Array.from(results);
}

function createElkGraph(nodeMeta: Map<string, GraphNodeMeta>, parentMap: Map<string, string | null>, edges: GraphEdge[]): ElkNode {
  const elkNodes = new Map<string, ElkNode>();
  for (const meta of nodeMeta.values()) {
    const labels: ElkLabel[] = [];
    if (meta.type === "resource" && meta.labelSize) {
      labels.push({
        id: `label:${meta.id}`,
        text: meta.label,
        width: meta.labelSize.width,
        height: meta.labelSize.height,
        layoutOptions: {
          "elk.nodeLabels.placement": RESOURCE_LABEL_PLACEMENT,
        },
      });
    }
    const base: ElkNode = {
      id: meta.id,
      children: [],
    };
    if (typeof meta.width === "number") {
      base.width = meta.width;
    }
    if (typeof meta.height === "number") {
      base.height = meta.height;
    }
    if (labels.length > 0) {
      base.labels = labels;
    }
    if (meta.type === "group-real" || meta.type === "group-virtual") {
      base.layoutOptions = {
        ...ELK_LAYOUT_OPTIONS,
        "elk.padding": GROUP_NODE_PADDING,
        "elk.nodeSize.minimum": GROUP_NODE_MINIMUM_SIZE,
      };
    }
    elkNodes.set(meta.id, base);
  }
  const root: ElkNode = {
    id: "root",
    children: [],
    layoutOptions: {
      ...ELK_LAYOUT_OPTIONS,
    },
  };
  for (const meta of nodeMeta.values()) {
    const parentId = parentMap.get(meta.id);
    const parentNode = parentId ? (elkNodes.get(parentId) ?? root) : root;
    if (!parentNode.children) {
      parentNode.children = [];
    }
    const current = elkNodes.get(meta.id);
    if (current) {
      parentNode.children.push(current);
    }
  }
  const elkEdges: ElkExtendedEdge[] = edges
    .filter((edge) => nodeMeta.has(edge.source) && nodeMeta.has(edge.target))
    .map((edge) => {
      const via = edge.via ?? [];
      const labelText = via.length > 0 ? via.join(", ") : "";
      const labelSize = labelText.length > 0 ? getEdgeLabelSize(labelText) : null;
      const elkEdge: ElkExtendedEdge = {
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      };
      if (labelSize) {
        elkEdge.labels = [
          {
            id: `label:${edge.id}`,
            text: labelText,
            width: labelSize.width,
            height: labelSize.height,
            layoutOptions: {
              "elk.edgeLabels.placement": EDGE_LABEL_PLACEMENT,
              "elk.edgeLabels.inline": "true",
            },
          } satisfies ElkLabel,
        ];
      }
      return elkEdge;
    });
  root.edges = elkEdges;
  return root;
}

function extractGraphNodes(flowGraph: ReactFlowGraph): {
  documentNode: GraphDocumentNode;
  nodeMap: Map<string, GraphNode>;
} {
  let documentNode: GraphDocumentNode | null = null;
  const nodeMap = new Map<string, GraphNode>();
  for (const node of flowGraph.nodes) {
    const graphNode = node.data?.graphNode;
    if (!graphNode) {
      continue;
    }
    nodeMap.set(graphNode.id, graphNode);
    if (graphNode.type === "document") {
      documentNode = graphNode;
    }
  }
  if (!documentNode) {
    documentNode = {
      id: DOCUMENT_NODE_ID,
      type: "document",
      data: {
        tokens: [],
        source: "",
        order: [],
      },
    };
    nodeMap.set(documentNode.id, documentNode);
  }
  return { documentNode, nodeMap };
}

function getResourceNodeSize(): { width: number; height: number } {
  return {
    width: RESOURCE_NODE_SIZE,
    height: RESOURCE_NODE_SIZE,
  };
}

function getResourceLabelSize(label: string): NodeLabelDimensions {
  const characters = Array.from(label).length;
  const width = Math.max(RESOURCE_NODE_SIZE, RESOURCE_LABEL_HORIZONTAL_PADDING * 2 + characters * RESOURCE_LABEL_CHAR_WIDTH);
  return {
    width,
    height: RESOURCE_LABEL_HEIGHT,
  };
}

function getEdgeLabelSize(label: string): NodeLabelDimensions {
  const characters = Array.from(label).length;
  const width = Math.max(EDGE_LABEL_HORIZONTAL_PADDING * 2, EDGE_LABEL_HORIZONTAL_PADDING * 2 + characters * EDGE_LABEL_CHAR_WIDTH);
  return {
    width,
    height: EDGE_LABEL_HEIGHT,
  };
}

function buildEdgeLabelPlacement(
  section: Required<Pick<NonNullable<ElkExtendedEdge["sections"]>[number], "startPoint" | "endPoint">> & {
    bendPoints?: { x: number; y: number }[];
  },
  label: ElkLabel,
): EdgeLabelPlacement {
  const pathPoints: EdgeLayoutPoint[] = [
    { x: section.startPoint.x, y: section.startPoint.y },
    ...(section.bendPoints ?? []).map((bend) => ({ x: bend.x, y: bend.y })),
    { x: section.endPoint.x, y: section.endPoint.y },
  ];
  const totalLength = pathPoints.reduce((acc, point, index) => {
    if (index === 0) {
      return 0;
    }
    const prev = pathPoints[index - 1] ?? { x: 0, y: 0 };
    return acc + Math.hypot(point.x - prev.x, point.y - prev.y);
  }, 0);
  const labelCenter = {
    x: (label.x ?? 0) + (label.width ?? 0) / 2,
    y: (label.y ?? 0) + (label.height ?? 0) / 2,
  };
  let accumulated = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRatio = 0;
  let bestProjection: EdgeLayoutPoint | null = null;
  for (let index = 1; index < pathPoints.length; index += 1) {
    const start = pathPoints[index - 1] ?? { x: 0, y: 0 };
    const end = pathPoints[index] ?? { x: 0, y: 0 };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength === 0) {
      continue;
    }
    const tNumerator = (labelCenter.x - start.x) * dx + (labelCenter.y - start.y) * dy;
    const t = Math.max(0, Math.min(1, tNumerator / (segmentLength * segmentLength)));
    const projection = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const distance = Math.hypot(labelCenter.x - projection.x, labelCenter.y - projection.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      const along = accumulated + segmentLength * t;
      bestRatio = totalLength === 0 ? 0 : along / totalLength;
      bestProjection = projection;
    }
    accumulated += segmentLength;
  }
  const projectionPoint = bestProjection ?? pathPoints[Math.floor(pathPoints.length / 2)] ?? { x: 0, y: 0 };
  const offsetScale = EDGE_LABEL_OFFSET_SCALE;
  return {
    x: label.x ?? 0,
    y: label.y ?? 0,
    width: label.width ?? 0,
    height: label.height ?? 0,
    distanceRatio: bestRatio,
    offsetX: (labelCenter.x - projectionPoint.x) * offsetScale,
    offsetY: (labelCenter.y - projectionPoint.y) * offsetScale,
  };
}

function graphNodeToLabel(node: GraphNode): string {
  if (node.type === "document") {
    return "Document";
  }
  if (node.type === "provider") {
    const alias = node.data.alias ? ` (${node.data.alias})` : "";
    return `Provider ${node.data.name}${alias}`;
  }
  if (node.type === "group-virtual") {
    return node.data.label;
  }
  return `${node.data.address.resourceType}.${node.data.address.name}`;
}

function graphNodeToFlowType(node: GraphNode): ReactFlowNodeType {
  if (node.type === "document") {
    return "document";
  }
  if (node.type === "provider") {
    return "group-real";
  }
  if (node.type === "group-virtual") {
    return "group-virtual";
  }
  return isRealGroupResource(node.data.address.resourceType) ? "group-real" : "resource";
}

const REAL_GROUP_RESOURCE_TYPES = new Set(["aws_vpc", "aws_subnet", "aws_security_group", "aws_db_subnet_group", "aws_elasticache_subnet_group"]);

function isRealGroupResource(resourceType: string): boolean {
  if (REAL_GROUP_RESOURCE_TYPES.has(resourceType)) {
    return true;
  }
  if (resourceType.endsWith("_subnet_group")) {
    return true;
  }
  return false;
}

function isSubnetResource(resourceType: string): boolean {
  if (resourceType.endsWith("_subnet_group")) {
    return false;
  }
  return resourceType.endsWith("_subnet");
}

function extractResourceBlock(node: HclNode): { address: GraphResourceAddress; block: HclBlockNode } | null {
  if (node.kind !== "Block") {
    return null;
  }
  if (node.type !== "resource") {
    return null;
  }
  if (node.labels.length < 2) {
    return null;
  }
  const resourceTypeLabel = node.labels[0];
  const resourceNameLabel = node.labels[1];
  if (!resourceTypeLabel) {
    return null;
  }
  if (!resourceNameLabel) {
    return null;
  }
  const address: GraphResourceAddress = {
    resourceType: getLabelValue(resourceTypeLabel),
    name: getLabelValue(resourceNameLabel),
  };
  return { address, block: node };
}

function extractProviderBlock(node: HclNode): { name: string; alias?: string; block: HclBlockNode } | null {
  if (node.kind !== "Block") {
    return null;
  }
  if (node.type !== "provider") {
    return null;
  }
  if (node.labels.length === 0) {
    return null;
  }
  const providerNameLabel = node.labels[0];
  if (!providerNameLabel) {
    return null;
  }
  const name = getLabelValue(providerNameLabel);
  let alias: string | undefined;
  for (const child of node.body) {
    if (child.kind !== "Attribute") {
      continue;
    }
    if (child.name !== "alias") {
      continue;
    }
    if (child.expression.kind !== "Literal") {
      continue;
    }
    if (child.expression.literalKind !== "string") {
      continue;
    }
    alias = typeof child.expression.value === "string" ? child.expression.value : undefined;
  }
  return alias ? { name, alias, block: node } : { name, block: node };
}

function getLabelValue(label: HclBlockNode["labels"][number]): string {
  return label.kind === "string" ? label.value : label.name;
}

function formatBlockPathSegment(block: HclBlockNode): string {
  const labels = block.labels.map(getLabelValue).filter((label) => label.length > 0);
  if (labels.length === 0) {
    return block.type;
  }
  return `${block.type}[${labels.join(",")}]`;
}

function collectDependencies(block: HclBlockNode, resourceId: string, addressToId: Map<string, string>): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();
  const visitNode = (node: HclNode, path: string[]): void => {
    if (node.kind === "Attribute") {
      const attributePath = path.length === 0 ? node.name : `${path.join(".")}.${node.name}`;
      const referencedIds = collectReferencedResourceIds(node.expression, addressToId);
      if (node.name === "depends_on") {
        for (const inferredId of collectStringReferencesFromDependsOn(node.expression, addressToId)) {
          referencedIds.push(inferredId);
        }
      }
      for (const targetId of referencedIds) {
        if (targetId === resourceId) {
          continue;
        }
        const existing = dependencies.get(targetId) ?? new Set<string>();
        existing.add(attributePath);
        dependencies.set(targetId, existing);
      }
      return;
    }
    if (node.kind === "Block") {
      const segment = formatBlockPathSegment(node);
      const nextPath = path.concat(segment);
      for (const child of node.body) {
        visitNode(child, nextPath);
      }
    }
  };
  for (const child of block.body) {
    visitNode(child, []);
  }
  return dependencies;
}

function buildDependencyEdges(resources: GraphResourceNode[], addressToId: Map<string, string>): GraphEdge[] {
  const edges: GraphEdge[] = [];
  let edgeIndex = 0;

  for (const resource of resources) {
    const dependencies = collectDependencies(resource.data.block, resource.id, addressToId);
    for (const [targetId, paths] of dependencies.entries()) {
      const via = Array.from(paths).sort((left, right) => left.localeCompare(right));
      edges.push({
        id: `e${edgeIndex++}`,
        source: resource.id,
        target: targetId,
        relation: "depends_on",
        via,
      });
    }
  }

  return edges;
}

function visitExpression(expression: HclExpression, callback: (expression: HclExpression) => void): void {
  callback(expression);

  switch (expression.kind) {
    case "Identifier":
    case "Literal":
      return;
    case "Tuple":
      for (const item of expression.items) {
        visitExpression(item, callback);
      }
      return;
    case "Object":
      for (const item of expression.items) {
        visitExpression(item.key, callback);
        visitExpression(item.value, callback);
      }
      return;
    case "Unary":
      visitExpression(expression.expression, callback);
      return;
    case "Binary":
      visitExpression(expression.left, callback);
      visitExpression(expression.right, callback);
      return;
    case "Conditional":
      visitExpression(expression.condition, callback);
      visitExpression(expression.consequent, callback);
      visitExpression(expression.alternate, callback);
      return;
    case "Call":
      visitExpression(expression.target, callback);
      for (const arg of expression.arguments) {
        visitExpression(arg, callback);
      }
      return;
    case "GetAttr":
      visitExpression(expression.target, callback);
      return;
    case "Index":
      visitExpression(expression.target, callback);
      visitExpression(expression.index, callback);
      return;
    case "Splat":
      visitExpression(expression.target, callback);
      return;
    case "ForTuple":
      visitExpression(expression.collection, callback);
      visitExpression(expression.expression, callback);
      if (expression.condition) {
        visitExpression(expression.condition, callback);
      }
      return;
    case "ForObject":
      visitExpression(expression.collection, callback);
      visitExpression(expression.keyExpression, callback);
      visitExpression(expression.valueExpression, callback);
      if (expression.condition) {
        visitExpression(expression.condition, callback);
      }
      return;
    default:
      throw new Error("Unsupported expression kind");
  }
}

function collectReferencedResourceIds(expression: HclExpression, addressToId: Map<string, string>): string[] {
  const ids = new Set<string>();
  visitExpression(expression, (expr) => {
    const chain = unwrapAccessChain(expr);
    if (!chain) {
      return;
    }
    if (chain.base.kind !== "Identifier") {
      return;
    }
    const resourceName = chain.attributes[0];
    if (!resourceName) {
      return;
    }
    const key = addressKey({ resourceType: chain.base.name, name: resourceName });
    const id = addressToId.get(key);
    if (id) {
      ids.add(id);
    }
  });
  return Array.from(ids);
}

function collectStringReferencesFromDependsOn(expression: HclExpression, addressToId: Map<string, string>): string[] {
  const ids = new Set<string>();
  const visit = (expr: HclExpression): void => {
    if (expr.kind === "Literal" && expr.literalKind === "string" && typeof expr.value === "string") {
      const match = expr.value.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_-]+)/);
      if (match) {
        const key = addressKey({ resourceType: match[1] ?? "", name: match[2] ?? "" });
        const id = addressToId.get(key);
        if (id) {
          ids.add(id);
        }
      }
      return;
    }
    if (expr.kind === "Tuple") {
      for (const item of expr.items) {
        visit(item);
      }
      return;
    }
    if (expr.kind === "Object") {
      for (const item of expr.items) {
        visit(item.value);
      }
    }
  };
  visit(expression);
  return Array.from(ids);
}

type AccessChain = {
  base: HclExpression;
  attributes: string[];
};

function unwrapAccessChain(expression: HclExpression): AccessChain | null {
  const attributes: string[] = [];
  let current: HclExpression = expression;

  while (true) {
    if (current.kind === "GetAttr") {
      attributes.unshift(current.attribute);
      current = current.target;
      continue;
    }
    if (current.kind === "Index") {
      current = current.target;
      continue;
    }
    if (current.kind === "Splat") {
      current = current.target;
      continue;
    }
    break;
  }

  if (attributes.length === 0) {
    return null;
  }

  return { base: current, attributes };
}

function addressKey(address: GraphResourceAddress): string {
  return `${address.resourceType}:${address.name}`;
}

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return value;
}

export async function astToReactFlow(document: HclDocument): Promise<ReactFlowGraph> {
  const { documentNode, resourceNodes, providerNodes, edges, addressToId } = buildGraphFromAst(document);
  const grouping = buildSemanticGrouping(resourceNodes, providerNodes, addressToId);
  const filteredEdges = edges.filter((edge) => {
    const sourceMeta = grouping.nodeMeta.get(edge.source);
    const targetMeta = grouping.nodeMeta.get(edge.target);
    if (!sourceMeta || !targetMeta) {
      return false;
    }
    if (sourceMeta.type !== "resource" || targetMeta.type !== "resource") {
      return false;
    }
    return true;
  });
  const elkGraph = createElkGraph(grouping.nodeMeta, grouping.parentMap, filteredEdges);
  const layoutedElk = await elk.layout(elkGraph);
  return elkToReactFlow(layoutedElk, grouping.nodeMeta, grouping.parentMap, filteredEdges, documentNode);
}

export function reactFlowToAst(flowGraph: ReactFlowGraph): HclDocument {
  const { documentNode, nodeMap } = extractGraphNodes(flowGraph);
  const resourceMap = new Map<string, GraphResourceNode>();
  const providerMap = new Map<string, GraphProviderNode>();
  for (const node of nodeMap.values()) {
    if (node.type === "resource") {
      resourceMap.set(node.id, node);
      continue;
    }
    if (node.type === "provider") {
      providerMap.set(node.id, node);
    }
  }
  const astNodes: HclNode[] = [];
  const order = documentNode.data.order ?? [];
  for (const entry of order) {
    if (entry.kind === "resource") {
      const resourceNode = resourceMap.get(entry.nodeId);
      if (!resourceNode) {
        continue;
      }
      astNodes.push(clone(resourceNode.data.block));
      continue;
    }
    if (entry.kind === "provider") {
      const providerNode = providerMap.get(entry.nodeId);
      if (!providerNode) {
        continue;
      }
      astNodes.push(clone(providerNode.data.block));
      continue;
    }
    astNodes.push(clone(entry.node));
  }
  return {
    type: "Document",
    nodes: astNodes,
    tokens: clone(documentNode.data.tokens),
    source: documentNode.data.source,
  };
}
