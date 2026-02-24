import { Suspense } from "react";
import { Header } from "~/app/header";
import { TemplateFormContainer, TemplateFormSkeleton } from "~/app/new/templates/template-form-container";

export default async function TemplateDetailPage({ params }: { params: Promise<{ template: string }> }) {
  const { template: templateId } = await params;

  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/new/templates" title="Configure Template" />
      <main className="flex flex-1 items-start justify-center overflow-auto p-4 sm:pt-16">
        <div className="w-full max-w-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Configure details</h2>
            <p className="text-muted-foreground">Customize parameters for your new project.</p>
          </div>
          <div className="rounded-md border bg-card p-4 shadow-sm">
            <Suspense fallback={<TemplateFormSkeleton />}>
              <TemplateFormContainer templateId={templateId} />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
