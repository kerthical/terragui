import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getArchitectureDetail } from "~/app/architecture/[architecture]/_actions/architecture/get-architecture-detail";
import { getArchitectureImport } from "~/app/architecture/[architecture]/_actions/import/get-architecture-import";
import { EditorOrchestrator } from "~/app/architecture/[architecture]/_components/editor/editor-orchestrator";
import { ImportLogPanel } from "~/app/architecture/[architecture]/_components/import/import-log-panel";

type ArchitectureEditorProps = {
  architectureId: string;
};

type ArchitecturePageParams = {
  architecture: string;
};

type ArchitecturePageProps = {
  params: Promise<ArchitecturePageParams>;
};

async function ArchitectureEditor({ architectureId }: ArchitectureEditorProps) {
  const result = await getArchitectureDetail({ architectureId });

  if (!result) {
    notFound();
  }

  const { architecture, flowGraph, files } = result;

  return (
    <EditorOrchestrator
      architectureId={architecture.id}
      architectureName={architecture.name}
      initialFiles={files}
      initialGraph={flowGraph}
      initialHasTfstate={result.hasTfstate}
    />
  );
}

export default async function ArchitecturePage({ params }: ArchitecturePageProps) {
  const { architecture: architectureId } = await params;
  const importInfo = await getArchitectureImport(architectureId);

  if (importInfo && importInfo.status !== "succeeded") {
    return <ImportLogPanel architectureId={architectureId} initial={importInfo} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>}>
        <ArchitectureEditor architectureId={architectureId} />
      </Suspense>
    </div>
  );
}
