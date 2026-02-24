import { Suspense } from "react";
import { Header } from "~/app/header";
import { getTemplatesWithTags } from "~/app/new/templates/get-templates-with-tags";
import { TemplateTable } from "~/app/new/templates/template-table";
import { Skeleton } from "~/ui/skeleton";

async function TemplateList() {
  const templatesWithTags = await getTemplatesWithTags();

  const templates = templatesWithTags.map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    provider: template.provider,
    tags: template.tags,
    createdAt: template.createdAt?.split(" ")[0] ?? "—",
  }));

  if (templates.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg bg-muted/10">
        <p className="text-sm text-muted-foreground">No templates available</p>
      </div>
    );
  }

  return <TemplateTable templates={templates} />;
}

function TemplateListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-full max-w-lg" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="overflow-hidden rounded-lg">
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => `template-skeleton-${i}`).map((key) => (
            <div className="grid grid-cols-5 items-center gap-3 rounded-lg bg-muted/10 px-3 py-3" key={key}>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-16" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-4 w-16 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function TemplateSelectionPage() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/new" title="Select Template" />
      <main className="flex-1 overflow-auto px-4 py-4">
        <div className="mx-auto max-w-5xl space-y-4">
          <Suspense fallback={<TemplateListSkeleton />}>
            <TemplateList />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
