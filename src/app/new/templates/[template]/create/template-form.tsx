"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createFromTemplate } from "~/app/new/templates/create-from-template";
import type { templateParameters } from "~/db/schema";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import { Textarea } from "~/ui/textarea";

type TemplateParameter = typeof templateParameters.$inferSelect;

type TemplateFormProps = {
  templateId: string;
  parameters: TemplateParameter[];
};

const buildSchema = (params: TemplateParameter[]) => {
  const paramsShape: Record<string, z.ZodTypeAny> = {};
  for (const param of params) {
    paramsShape[param.key] = param.isRequired ? z.string().min(1, `${param.label} is required`) : z.string().optional().default("");
  }
  return z.object({
    name: z.string().min(1, "This field is required"),
    description: z.string().optional(),
    params: z.object(paramsShape),
  });
};

export function TemplateForm({ templateId, parameters }: TemplateFormProps) {
  const schema = useMemo(() => buildSchema(parameters), [parameters]);
  type FormValues = z.infer<typeof schema>;

  const defaultParams = useMemo(() => {
    const initial: Record<string, string> = {};
    for (const param of parameters) {
      initial[param.key] = param.defaultValue ?? "";
    }
    return initial;
  }, [parameters]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitted, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", params: defaultParams },
    mode: "onChange",
  });

  const showErrors = isSubmitted;
  const canSubmit = isValid && !isSubmitting;

  const onSubmit = async (values: FormValues) => {
    await createFromTemplate({ templateId, name: values.name, description: values.description, parameters: values.params as Record<string, string> });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground" htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input autoFocus className="bg-input" id="name" {...register("name")} aria-invalid={Boolean(errors.name)} />
          {showErrors && errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground" htmlFor="description">
            Description
          </Label>
          <Textarea className="min-h-[60px] bg-input text-[12px]" id="description" {...register("description")} />
        </div>
      </div>

      {parameters.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="border-b border-border/50 pb-1">
            <h3 className="text-[12px] font-semibold">Parameters</h3>
          </div>
          <div className="grid gap-3">
            {parameters.map((param) => (
              <div className="space-y-1.5" key={param.id}>
                <Label className="text-[11px] text-muted-foreground" htmlFor={param.key}>
                  {param.label} {param.isRequired && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  className="bg-input"
                  id={param.key}
                  {...register(`params.${param.key}`)}
                  aria-invalid={Boolean(errors.params?.[param.key])}
                  placeholder={param.defaultValue ?? ""}
                />
                {showErrors && errors.params && errors.params[param.key] && (
                  <p className="text-[11px] text-destructive">{errors.params[param.key]?.message as string}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button disabled={!canSubmit} size="sm" type="submit">
          {isSubmitting ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
