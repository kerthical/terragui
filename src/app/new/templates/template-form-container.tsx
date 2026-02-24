import { notFound } from "next/navigation";
import { TemplateForm } from "~/app/new/templates/[template]/create/template-form";
import { getTemplateWithParameters } from "~/app/new/templates/get-template-with-parameters";
import { Skeleton } from "~/ui/skeleton";

type TemplateFormContainerProps = {
  templateId: string;
};

export async function TemplateFormContainer({ templateId }: TemplateFormContainerProps) {
  const result = await getTemplateWithParameters(templateId);

  if (!result) {
    notFound();
  }

  const { template, parameters } = result;

  return <TemplateForm parameters={parameters} templateId={template.id} />;
}

export const TemplateFormSkeleton = () => (
  <div className="space-y-3">
    <div className="space-y-2">
      <div className="border-b pb-2">
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
    <div className="flex justify-end">
      <Skeleton className="h-8 w-20" />
    </div>
  </div>
);
