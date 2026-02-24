"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import { Plus } from "lucide-react";
import type { IDisposable, editor as MonacoEditor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/ui/utils";

export type CodeEditorFileTab = {
  path: string;
};

type CodeEditorProps = {
  code: string;
  files: CodeEditorFileTab[];
  activePath: string | null;
  readonly?: boolean;
  onChange?: (value: string) => void;
  onActivePathChange?: (path: string) => void;
  onCreateFile?: () => string | null;
  onRenameFile?: (path: string, nextBaseName: string) => void;
  nodeRanges?: CodeEditorNodeRange[];
  revealRequest?: CodeEditorRevealRequest;
  onActiveNodeIdChange?: (nodeId: string | null) => void;
};

export type CodeEditorNodeRange = {
  nodeId: string;
  headerOffset: number;
  rangeStartOffset: number;
  rangeEndOffset: number;
};

export type CodeEditorRevealRequest = {
  nodeId: string | null;
  requestId: number;
};

const getBaseName = (path: string): string => path.replace(/\.tf$/i, "");

export function CodeEditor({
  code,
  files,
  activePath,
  readonly = true,
  onChange,
  onActivePathChange,
  onCreateFile,
  onRenameFile,
  nodeRanges = [],
  revealRequest,
  onActiveNodeIdChange,
}: CodeEditorProps) {
  const [value, setValue] = useState(code);
  const [editorInstance, setEditorInstance] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextCursorSyncRef = useRef(false);
  const lastActiveNodeIdRef = useRef<string | null>(null);
  const lastHandledRevealRequestIdRef = useRef(0);
  const cursorSyncDisposableRef = useRef<IDisposable | null>(null);

  useEffect(() => {
    setValue(code);
  }, [code]);

  useEffect(() => {
    if (editingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingPath]);

  useEffect(() => {
    if (editingPath && !files.some((file) => file.path === editingPath)) {
      setEditingPath(null);
    }
  }, [editingPath, files]);

  useEffect(() => {
    return () => {
      cursorSyncDisposableRef.current?.dispose();
      cursorSyncDisposableRef.current = null;
    };
  }, []);

  const startRename = (path: string): void => {
    setEditingPath(path);
    setEditingValue(getBaseName(path));
    onActivePathChange?.(path);
  };

  const commitRename = (): void => {
    if (!editingPath) {
      return;
    }
    onRenameFile?.(editingPath, editingValue);
    setEditingPath(null);
  };

  const cancelRename = (): void => {
    setEditingPath(null);
  };

  const handleCreateFile = (): void => {
    const created = onCreateFile?.() ?? null;
    if (!created) {
      return;
    }
    setEditingPath(created);
    setEditingValue(getBaseName(created));
    onActivePathChange?.(created);
  };

  useEffect(() => {
    if (!editorInstance) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    if (cursorSyncDisposableRef.current) {
      cursorSyncDisposableRef.current.dispose();
      cursorSyncDisposableRef.current = null;
    }

    if (!onActiveNodeIdChange) {
      return;
    }

    cursorSyncDisposableRef.current = editorInstance.onDidChangeCursorPosition(() => {
      if (suppressNextCursorSyncRef.current) {
        suppressNextCursorSyncRef.current = false;
        return;
      }

      const position = editorInstance.getPosition();
      if (!position) {
        return;
      }
      const offset = model.getOffsetAt(position);
      const match = nodeRanges.find((range) => offset >= range.rangeStartOffset && offset < range.rangeEndOffset) ?? null;
      const nextNodeId = match?.nodeId ?? null;
      if (lastActiveNodeIdRef.current === nextNodeId) {
        return;
      }
      lastActiveNodeIdRef.current = nextNodeId;
      onActiveNodeIdChange(nextNodeId);
    });
  }, [editorInstance, nodeRanges, onActiveNodeIdChange]);

  useEffect(() => {
    if (!editorInstance || !revealRequest || !revealRequest.nodeId) {
      return;
    }
    if (lastHandledRevealRequestIdRef.current === revealRequest.requestId) {
      return;
    }
    const target = nodeRanges.find((range) => range.nodeId === revealRequest.nodeId) ?? null;
    if (!target) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    const nextPosition = model.getPositionAt(target.headerOffset);
    lastActiveNodeIdRef.current = revealRequest.nodeId;
    suppressNextCursorSyncRef.current = true;
    editorInstance.setPosition(nextPosition);
    editorInstance.revealPositionInCenter(nextPosition);
    lastHandledRevealRequestIdRef.current = revealRequest.requestId;
  }, [editorInstance, nodeRanges, revealRequest?.nodeId, revealRequest?.requestId, revealRequest]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-9 items-center border-b bg-muted/20 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {files.map((file) => {
            const isActive = file.path === activePath;
            const isEditing = file.path === editingPath;
            return (
              <button
                className={cn(
                  "flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] transition-colors",
                  isActive
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
                key={file.path}
                onClick={() => {
                  if (!isEditing) {
                    onActivePathChange?.(file.path);
                  }
                }}
                onDoubleClick={() => {
                  if (onRenameFile) {
                    startRename(file.path);
                  }
                }}
                type="button"
              >
                {isEditing ? (
                  <>
                    <input
                      className="w-20 bg-transparent text-[11px] text-foreground outline-none"
                      onBlur={commitRename}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitRename();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                      ref={renameInputRef}
                      value={editingValue}
                    />
                    <span className="text-[10px] text-muted-foreground">.tf</span>
                  </>
                ) : (
                  <>
                    <span className="max-w-[140px] truncate">{getBaseName(file.path)}</span>
                    <span className="text-[10px] text-muted-foreground">.tf</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {onCreateFile ? (
          <button
            className="ml-2 flex size-6 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            onClick={handleCreateFile}
            type="button"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-black/70">
        <Editor
          beforeMount={(monacoInstance: Monaco) => {
            const languages: ReturnType<Monaco["languages"]["getLanguages"]> = monacoInstance.languages.getLanguages();
            const hasHcl = languages.some((language: ReturnType<Monaco["languages"]["getLanguages"]>[number]) => language.id === "hcl");
            if (!hasHcl) {
              monacoInstance.languages.register({ id: "hcl" });
            }
          }}
          height="100%"
          language="hcl"
          onChange={(nextValue) => {
            if (readonly || !onChange) {
              return;
            }
            const next = nextValue ?? "";
            setValue(next);
            onChange(next);
          }}
          onMount={(editor) => {
            setEditorInstance(editor);
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: readonly,
            padding: { top: 12, bottom: 12 },
          }}
          theme="vs-dark"
          value={value}
          width="100%"
        />
      </div>
    </div>
  );
}
