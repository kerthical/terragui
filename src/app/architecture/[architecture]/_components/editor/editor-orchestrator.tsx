"use client";
import "allotment/dist/style.css";

import { Allotment } from "allotment";
import { Boxes, Cloud, CloudOff, Code2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getArchitectureHasTfstate } from "~/app/architecture/[architecture]/_actions/architecture/get-architecture-has-tfstate";
import { saveArchitectureGraph } from "~/app/architecture/[architecture]/_actions/architecture/save-architecture-graph";
import { startTerraformApply } from "~/app/architecture/[architecture]/_actions/terraform/run-terraform-apply";
import { startTerraformDestroy } from "~/app/architecture/[architecture]/_actions/terraform/run-terraform-destroy";
import { ApplyCredentialsDialog } from "~/app/architecture/[architecture]/_components/editor/apply-credentials-dialog";
import { ApplyLogPanel } from "~/app/architecture/[architecture]/_components/editor/apply-log-panel";
import { ArchitectureFlow, type ArchitectureFlowFocusRequest } from "~/app/architecture/[architecture]/_components/editor/architecture-flow";
import { CodeEditor, type CodeEditorNodeRange, type CodeEditorRevealRequest } from "~/app/architecture/[architecture]/_components/editor/code-editor";
import { PropertyEditor } from "~/app/architecture/[architecture]/_components/editor/property-editor";
import { type ArchitectureFile, isRootTerraformFilePath } from "~/app/architecture/[architecture]/_domains/architecture/files";
import { findDocumentNode, mergeGraphWithExisting } from "~/app/architecture/[architecture]/_domains/editor/graph-merge";
import { type AttributeUpdateMap, buildBlockTextWithUpdates } from "~/app/architecture/[architecture]/_domains/editor/hcl-block-updater";
import {
  buildCombinedRootSource,
  findOffsetFile,
  getRootFiles,
  makeUniqueBaseName,
  sanitizeBaseName,
  serializeRootFiles,
  stripTerraformExtension,
} from "~/app/architecture/[architecture]/_domains/editor/root-files";
import type { MultiProviderApplyInput } from "~/app/architecture/[architecture]/_domains/schema/apply-schema";
import { extractProviderBlocks, type ProviderBlock } from "~/app/architecture/[architecture]/_domains/terraform/provider";
import { Header } from "~/app/header";
import { astToReactFlow, type ReactFlowGraph, type ReactFlowNode } from "~/lib/graph";
import { hclToAst } from "~/lib/hcl";
import { Button } from "~/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/ui/tooltip";
import { cn } from "~/ui/utils";

type EditorOrchestratorProps = {
  architectureId: string;
  architectureName: string;
  initialGraph: ReactFlowGraph;
  initialFiles: ArchitectureFile[];
  initialHasTfstate: boolean;
};

type DetailPane = "properties" | "terraform";

export function EditorOrchestrator({ architectureId, architectureName, initialGraph, initialFiles, initialHasTfstate }: EditorOrchestratorProps) {
  const [currentGraph, setCurrentGraph] = useState<ReactFlowGraph>(initialGraph);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNode | null>(null);
  const [codeRevealRequest, setCodeRevealRequest] = useState<CodeEditorRevealRequest>({ nodeId: null, requestId: 0 });
  const [flowFocusRequest, setFlowFocusRequest] = useState<ArchitectureFlowFocusRequest>({ nodeId: null, requestId: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [files, setFiles] = useState<ArchitectureFile[]>(initialFiles);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(() => initialFiles.find((file) => isRootTerraformFilePath(file.path))?.path ?? null);
  const [activeDetailPane, setActiveDetailPane] = useState<DetailPane | null>("properties");
  const [detailPreferredSize, setDetailPreferredSize] = useState<number | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [currentApplyId, setCurrentApplyId] = useState<string | null>(null);
  const [destroyDialogOpen, setDestroyDialogOpen] = useState(false);
  const [destroySubmitting, setDestroySubmitting] = useState(false);
  const [destroyError, setDestroyError] = useState<string | null>(null);
  const [currentDestroyId, setCurrentDestroyId] = useState<string | null>(null);
  const [hasTfstate, setHasTfstate] = useState(initialHasTfstate);
  const graphRef = useRef<ReactFlowGraph>(initialGraph);
  const lastSavedGraphRef = useRef<ReactFlowGraph>(initialGraph);
  const lastSavedFilesRef = useRef<string>(serializeRootFiles(getRootFiles(initialFiles)));
  const filesRef = useRef<ArchitectureFile[]>(initialFiles);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeChangeRequestIdRef = useRef(0);

  const rootFiles = useMemo<ArchitectureFile[]>(() => getRootFiles(files), [files]);
  const combinedRoot = useMemo(() => buildCombinedRootSource(rootFiles), [rootFiles]);
  const providerBlocks = useMemo<ProviderBlock[]>(() => extractProviderBlocks(combinedRoot.source), [combinedRoot.source]);
  const hasProviders = providerBlocks.length > 0;
  const canDestroy = hasProviders && hasTfstate;
  const isOperationLocked = applySubmitting || destroySubmitting;
  const canEdit = !isOperationLocked;
  const activeFile = useMemo(() => rootFiles.find((file) => file.path === activeFilePath) ?? null, [activeFilePath, rootFiles]);

  useEffect(() => {
    if (rootFiles.length === 0) {
      if (activeFilePath !== null) {
        setActiveFilePath(null);
      }
      return;
    }
    if (!activeFilePath || !rootFiles.some((file) => file.path === activeFilePath)) {
      setActiveFilePath(rootFiles[0]?.path ?? null);
    }
  }, [activeFilePath, rootFiles]);

  const refreshTfstate = useCallback(async (): Promise<void> => {
    try {
      const nextHasTfstate = await getArchitectureHasTfstate(architectureId);
      setHasTfstate(nextHasTfstate);
    } catch {
      return;
    }
  }, [architectureId]);

  const handleApplySubmit = useCallback(
    async (input: MultiProviderApplyInput) => {
      setApplySubmitting(true);
      setApplyError(null);
      try {
        const result = await startTerraformApply(architectureId, input);
        if (result.success) {
          setApplyDialogOpen(false);
          setCurrentApplyId(result.applyId);
        } else {
          setApplyError(result.error);
        }
      } finally {
        setApplySubmitting(false);
      }
    },
    [architectureId],
  );

  const handleApplyLogClose = useCallback(() => {
    setCurrentApplyId(null);
    void refreshTfstate();
  }, [refreshTfstate]);

  const handleDestroySubmit = useCallback(
    async (input: MultiProviderApplyInput) => {
      setDestroySubmitting(true);
      setDestroyError(null);
      try {
        const result = await startTerraformDestroy(architectureId, input);
        if (result.success) {
          setDestroyDialogOpen(false);
          setCurrentDestroyId(result.applyId);
        } else {
          setDestroyError(result.error);
        }
      } finally {
        setDestroySubmitting(false);
      }
    },
    [architectureId],
  );

  const handleDestroyLogClose = useCallback(() => {
    setCurrentDestroyId(null);
    void refreshTfstate();
  }, [refreshTfstate]);

  useEffect(() => {
    graphRef.current = currentGraph;
  }, [currentGraph]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const graphsEqual = useCallback((a: ReactFlowGraph, b: ReactFlowGraph): boolean => {
    if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) {
      return false;
    }
    for (let index = 0; index < a.nodes.length; index += 1) {
      const left = a.nodes[index];
      const right = b.nodes[index];
      if (!left || !right) {
        return false;
      }
      if (left.id !== right.id) {
        return false;
      }
      if (left.position.x !== right.position.x || left.position.y !== right.position.y) {
        return false;
      }
      if (left.parentId !== right.parentId) {
        return false;
      }
    }
    const positionsEqual = (left: { x: number; y: number } | undefined, right: { x: number; y: number } | undefined): boolean => {
      if (!left && !right) {
        return true;
      }
      if (!left || !right) {
        return false;
      }
      return left.x === right.x && left.y === right.y;
    };

    for (let index = 0; index < a.edges.length; index += 1) {
      const left = a.edges[index];
      const right = b.edges[index];
      if (!left || !right) {
        return false;
      }
      if (left.id !== right.id || left.source !== right.source || left.target !== right.target) {
        return false;
      }

      const leftLayout = left.data?.layout;
      const rightLayout = right.data?.layout;
      if (!leftLayout && !rightLayout) {
        continue;
      }
      if (!leftLayout || !rightLayout) {
        return false;
      }
      if (!positionsEqual(leftLayout.start, rightLayout.start) || !positionsEqual(leftLayout.end, rightLayout.end)) {
        return false;
      }
      if (leftLayout.sourcePosition !== rightLayout.sourcePosition || leftLayout.targetPosition !== rightLayout.targetPosition) {
        return false;
      }
      if (leftLayout.bends.length !== rightLayout.bends.length) {
        return false;
      }
      for (let bendIndex = 0; bendIndex < leftLayout.bends.length; bendIndex += 1) {
        const leftBend = leftLayout.bends[bendIndex];
        const rightBend = rightLayout.bends[bendIndex];
        if (!positionsEqual(leftBend, rightBend)) {
          return false;
        }
      }
    }
    return true;
  }, []);

  const setFilesState = useCallback((updater: (current: ArchitectureFile[]) => ArchitectureFile[]) => {
    const next = updater(filesRef.current);
    filesRef.current = next;
    setFiles(next);
    return next;
  }, []);

  const scheduleSave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      const graphToSave = graphRef.current;
      const rootFilesToSave = getRootFiles(filesRef.current);
      const rootSnapshot = serializeRootFiles(rootFilesToSave);
      const hasGraphChanges = !graphsEqual(graphToSave, lastSavedGraphRef.current);
      const hasFileChanges = rootSnapshot !== lastSavedFilesRef.current;

      if (!hasGraphChanges && !hasFileChanges) {
        return;
      }

      setIsSaving(true);
      try {
        await saveArchitectureGraph({
          architectureId,
          flowGraph: graphToSave,
          rootFiles: rootFilesToSave,
        });
        lastSavedGraphRef.current = graphToSave;
        lastSavedFilesRef.current = rootSnapshot;
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, [architectureId, graphsEqual]);

  const handleGraphChange = useCallback(
    (graph: ReactFlowGraph) => {
      const prev = graphRef.current;
      if (graphsEqual(prev, graph)) {
        return;
      }
      setCurrentGraph(graph);
      setSelectedNode((current) => {
        if (!current) {
          return null;
        }
        return graph.nodes.find((node) => node.id === current.id) ?? current;
      });

      scheduleSave();
    },
    [graphsEqual, scheduleSave],
  );

  const handleCreateFile = useCallback((): string | null => {
    const existingBases = new Set(getRootFiles(filesRef.current).map((file) => stripTerraformExtension(file.path)));
    const base = makeUniqueBaseName("newfile", existingBases);
    const newPath = `${base}.tf`;
    setFilesState((current) => [...current, { path: newPath, content: "" }]);
    setActiveFilePath(newPath);
    scheduleSave();
    return newPath;
  }, [scheduleSave, setFilesState]);

  const handleRenameFile = useCallback(
    (path: string, nextBaseName: string) => {
      const sanitized = sanitizeBaseName(nextBaseName);
      if (!sanitized) {
        return;
      }
      const existingBases = new Set(getRootFiles(filesRef.current).map((file) => stripTerraformExtension(file.path)));
      existingBases.delete(stripTerraformExtension(path));
      const uniqueBase = makeUniqueBaseName(sanitized, existingBases);
      const nextPath = `${uniqueBase}.tf`;
      if (nextPath === path) {
        return;
      }
      setFilesState((current) => current.map((file) => (file.path === path ? { ...file, path: nextPath } : file)));
      if (activeFilePath === path) {
        setActiveFilePath(nextPath);
      }
      scheduleSave();
    },
    [activeFilePath, scheduleSave, setFilesState],
  );

  const handleCodeChange = useCallback(
    async (nextCode: string) => {
      if (!activeFilePath) {
        return;
      }
      const nextFiles = setFilesState((current) => current.map((file) => (file.path === activeFilePath ? { ...file, content: nextCode } : file)));
      scheduleSave();
      const requestId = codeChangeRequestIdRef.current + 1;
      codeChangeRequestIdRef.current = requestId;
      try {
        const document = hclToAst(buildCombinedRootSource(getRootFiles(nextFiles)).source);
        const nextGraph = await astToReactFlow(document);
        if (codeChangeRequestIdRef.current !== requestId) {
          return;
        }
        const mergedGraph = mergeGraphWithExisting(nextGraph, graphRef.current);
        setCurrentGraph(mergedGraph);
        setSelectedNode((current) => {
          if (!current) {
            return null;
          }
          return mergedGraph.nodes.find((node) => node.id === current.id) ?? null;
        });
        scheduleSave();
      } catch (error) {
        if (codeChangeRequestIdRef.current !== requestId) {
          return;
        }
        if (error instanceof Error) {
          return;
        }
      }
    },
    [activeFilePath, scheduleSave, setFilesState],
  );

  const nodeFileMap = useMemo(() => {
    const map = new Map<string, string>();
    const documentNode = findDocumentNode(currentGraph);
    const documentGraphNode = documentNode?.data?.graphNode;
    if (!documentGraphNode || documentGraphNode.type !== "document") {
      return map;
    }
    const tokens = documentGraphNode.data.tokens;
    for (const flowNode of currentGraph.nodes) {
      const graphNode = flowNode.data?.graphNode;
      if (!graphNode || (graphNode.type !== "resource" && graphNode.type !== "provider")) {
        continue;
      }
      const block = graphNode.data.block;
      const headerToken = tokens[block.headerRange.start];
      if (!headerToken) {
        continue;
      }
      const fileInfo = findOffsetFile(headerToken.position.index, combinedRoot.offsets);
      if (!fileInfo) {
        continue;
      }
      map.set(flowNode.id, fileInfo.path);
    }
    return map;
  }, [combinedRoot.offsets, currentGraph]);

  const handleNodeSelect = useCallback(
    (node: ReactFlowNode | null) => {
      setSelectedNode(node);
      if (node) {
        const nextPath = nodeFileMap.get(node.id) ?? null;
        if (nextPath && nextPath !== activeFilePath) {
          setActiveFilePath(nextPath);
        }
      }
      setCodeRevealRequest((current) => ({ nodeId: node?.id ?? null, requestId: current.requestId + 1 }));
    },
    [activeFilePath, nodeFileMap],
  );

  const handleActiveNodeIdChange = useCallback((nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNode(null);
      return;
    }
    const graph = graphRef.current;
    const nextNode = graph.nodes.find((node) => node.id === nodeId) ?? null;
    setSelectedNode(nextNode);
    setFlowFocusRequest((current) => ({ nodeId, requestId: current.requestId + 1 }));
  }, []);

  const handleToggleDetailPane = useCallback((pane: DetailPane) => {
    setActiveDetailPane((current) => (current === pane ? null : pane));
  }, []);

  const handleDetailPaneResize = useCallback(
    (sizes: number[]) => {
      if (!activeDetailPane) {
        return;
      }
      const detailSize = sizes[1];
      if (detailSize !== undefined) {
        setDetailPreferredSize(detailSize);
      }
    },
    [activeDetailPane],
  );

  useEffect(
    () => () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    },
    [],
  );

  const handleApplyNodeUpdates = useCallback(
    async (nodeId: string, updates: AttributeUpdateMap) => {
      if (isOperationLocked) {
        return;
      }
      if (Object.keys(updates).length === 0) {
        return;
      }
      const graph = graphRef.current;
      const targetNode = graph.nodes.find((node) => node.id === nodeId);
      const targetGraphNode = targetNode?.data?.graphNode;
      if (!targetNode || !targetGraphNode) {
        return;
      }
      if (targetGraphNode.type !== "resource" && targetGraphNode.type !== "provider") {
        return;
      }
      const documentNode = findDocumentNode(graph);
      const documentGraphNode = documentNode?.data?.graphNode;
      if (!documentGraphNode || documentGraphNode.type !== "document") {
        return;
      }
      const tokens = documentGraphNode.data.tokens;
      const block = targetGraphNode.data.block;
      const blockText = buildBlockTextWithUpdates(block, tokens, updates);
      if (!blockText) {
        return;
      }
      const headerToken = tokens[block.headerRange.start];
      const startToken = tokens[block.range.start];
      const endToken = tokens[block.range.end - 1];
      if (!headerToken || !startToken || !endToken) {
        return;
      }
      const fileInfo = findOffsetFile(headerToken.position.index, combinedRoot.offsets);
      if (!fileInfo) {
        return;
      }
      const startIndex = startToken.position.index - fileInfo.start;
      const endIndex = endToken.position.index + endToken.text.length - fileInfo.start;
      if (startIndex < 0 || endIndex < startIndex) {
        return;
      }
      const nextFiles = setFilesState((current) =>
        current.map((file) => {
          if (file.path !== fileInfo.path) {
            return file;
          }
          if (startIndex > file.content.length || endIndex > file.content.length) {
            return file;
          }
          const nextContent = `${file.content.slice(0, startIndex)}${blockText}${file.content.slice(endIndex)}`;
          return { ...file, content: nextContent };
        }),
      );
      scheduleSave();
      const requestId = codeChangeRequestIdRef.current + 1;
      codeChangeRequestIdRef.current = requestId;
      try {
        const updatedAst = hclToAst(buildCombinedRootSource(getRootFiles(nextFiles)).source);
        const nextGraph = await astToReactFlow(updatedAst);
        if (codeChangeRequestIdRef.current !== requestId) {
          return;
        }
        const mergedGraph = mergeGraphWithExisting(nextGraph, graph);
        setCurrentGraph(mergedGraph);
        setSelectedNode(mergedGraph.nodes.find((node) => node.id === nodeId) ?? null);
        scheduleSave();
      } catch (error) {
        if (codeChangeRequestIdRef.current !== requestId) {
          return;
        }
        if (error instanceof Error) {
          return;
        }
      }
    },
    [combinedRoot.offsets, isOperationLocked, scheduleSave, setFilesState],
  );

  const codeEditorNodeRanges = useMemo<CodeEditorNodeRange[]>(() => {
    if (!activeFilePath) {
      return [];
    }
    const activeOffset = combinedRoot.offsets.find((offset) => offset.path === activeFilePath) ?? null;
    if (!activeOffset) {
      return [];
    }
    const documentNode = findDocumentNode(currentGraph);
    const documentGraphNode = documentNode?.data?.graphNode;
    if (!documentGraphNode || documentGraphNode.type !== "document") {
      return [];
    }
    const tokens = documentGraphNode.data.tokens;
    const ranges: CodeEditorNodeRange[] = [];
    for (const flowNode of currentGraph.nodes) {
      const graphNode = flowNode.data?.graphNode;
      if (!graphNode || (graphNode.type !== "resource" && graphNode.type !== "provider")) {
        continue;
      }
      const block = graphNode.data.block;
      const headerToken = tokens[block.headerRange.start];
      const startToken = tokens[block.range.start];
      const endToken = tokens[block.range.end - 1];
      if (!headerToken || !startToken || !endToken) {
        continue;
      }
      const fileInfo = findOffsetFile(headerToken.position.index, combinedRoot.offsets);
      if (!fileInfo || fileInfo.path !== activeFilePath) {
        continue;
      }
      ranges.push({
        nodeId: flowNode.id,
        headerOffset: headerToken.position.index - activeOffset.start,
        rangeStartOffset: startToken.position.index - activeOffset.start,
        rangeEndOffset: endToken.position.index + endToken.text.length - activeOffset.start,
      });
    }
    return ranges;
  }, [activeFilePath, combinedRoot.offsets, currentGraph]);

  const codeEditorHandlers = canEdit ? { onChange: handleCodeChange, onCreateFile: handleCreateFile, onRenameFile: handleRenameFile } : {};

  if (currentApplyId) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <ApplyLogPanel applyId={currentApplyId} mode="apply" onClose={handleApplyLogClose} />
      </div>
    );
  }

  if (currentDestroyId) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <ApplyLogPanel applyId={currentDestroyId} mode="destroy" onClose={handleDestroyLogClose} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <Header
        actions={
          <div className="flex items-center gap-2">
            {hasProviders && (
              <Button disabled={isOperationLocked} onClick={() => setApplyDialogOpen(true)} size="sm" variant="default">
                <Cloud className="mr-1.5 size-3.5" />
                Apply to Cloud
              </Button>
            )}
            {canDestroy && (
              <Button disabled={isOperationLocked} onClick={() => setDestroyDialogOpen(true)} size="sm" variant="destructive">
                <CloudOff className="mr-1.5 size-3.5" />
                Destroy from Cloud
              </Button>
            )}
            <div className="text-[11px] font-medium text-muted-foreground">{isSaving ? "Saving..." : "Auto-saved"}</div>
          </div>
        }
        backHref="/"
        title={`${architectureName} - Architecture Editor`}
      />
      {hasProviders && (
        <ApplyCredentialsDialog
          applyError={applyError}
          architectureId={architectureId}
          isApplying={applySubmitting}
          mode="apply"
          onApply={handleApplySubmit}
          onOpenChange={setApplyDialogOpen}
          open={applyDialogOpen}
          providerBlocks={providerBlocks}
        />
      )}
      {canDestroy && (
        <ApplyCredentialsDialog
          applyError={destroyError}
          architectureId={architectureId}
          isApplying={destroySubmitting}
          mode="destroy"
          onApply={handleDestroySubmit}
          onOpenChange={setDestroyDialogOpen}
          open={destroyDialogOpen}
          providerBlocks={providerBlocks}
        />
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_32px]">
          <Allotment className="h-full min-w-0" defaultSizes={[75, 25]} onChange={handleDetailPaneResize}>
            <Allotment.Pane minSize={440}>
              <div className="h-full">
                <ArchitectureFlow
                  focusRequest={flowFocusRequest}
                  graph={currentGraph}
                  interactionDisabled={isOperationLocked}
                  onGraphChange={handleGraphChange}
                  onNodeSelect={handleNodeSelect}
                  selectedNodeId={selectedNode?.id ?? null}
                />
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={320} preferredSize={detailPreferredSize ?? 320} visible={activeDetailPane !== null}>
              {activeDetailPane === "properties" ? (
                <div className="flex h-full flex-col border-l bg-muted/20">
                  <PropertyEditor disabled={isOperationLocked} onApply={handleApplyNodeUpdates} selectedNode={selectedNode} />
                </div>
              ) : null}
              {activeDetailPane === "terraform" ? (
                <div className="flex h-full flex-col border-l bg-muted/20">
                  <CodeEditor
                    activePath={activeFile?.path ?? null}
                    code={activeFile?.content ?? ""}
                    files={rootFiles}
                    nodeRanges={codeEditorNodeRanges}
                    onActiveNodeIdChange={handleActiveNodeIdChange}
                    onActivePathChange={setActiveFilePath}
                    readonly={!activeFile || !canEdit}
                    revealRequest={codeRevealRequest}
                    {...codeEditorHandlers}
                  />
                </div>
              ) : null}
            </Allotment.Pane>
          </Allotment>
          <div className="flex w-8 shrink-0 flex-col border-l bg-muted/20">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-pressed={activeDetailPane === "properties"}
                    className={cn(
                      "flex h-8 w-full items-center justify-center border-b text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground",
                      activeDetailPane === "properties" ? "bg-background text-foreground" : "",
                    )}
                    onClick={() => handleToggleDetailPane("properties")}
                    type="button"
                  >
                    <Boxes className="size-3.5" />
                    <span className="sr-only">Resources</span>
                  </button>
                }
              />
              <TooltipContent side="left">Resources</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-pressed={activeDetailPane === "terraform"}
                    className={cn(
                      "flex h-8 w-full items-center justify-center border-b text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      activeDetailPane === "terraform" ? "bg-background text-foreground" : "",
                    )}
                    onClick={() => handleToggleDetailPane("terraform")}
                    type="button"
                  >
                    <Code2 className="size-3.5" />
                    <span className="sr-only">Code</span>
                  </button>
                }
              />
              <TooltipContent side="left">Code</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
