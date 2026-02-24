"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Header } from "~/app/header";
import { createFromScratch } from "~/app/new/scratch/create-from-scratch";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import { Textarea } from "~/ui/textarea";

const schema = z.object({
  name: z.string().min(1, "This field is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ArchitectureFromScratchPage() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isSubmitted, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
    mode: "onChange",
  });

  const showErrors = isSubmitted;
  const canSubmit = isValid && !isSubmitting;

  const onSubmit = async (values: FormValues) => {
    await createFromScratch(values);
  };

  const nameValue = watch("name");

  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/new" title="New Project" />
      <main className="flex flex-1 items-start justify-center overflow-auto p-4 sm:pt-16">
        <div className="w-full max-w-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Create from scratch</h2>
            <p className="text-muted-foreground">Start with a clean slate.</p>
          </div>
          <div className="rounded-md border bg-card p-4 shadow-sm">
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input autoFocus className="bg-input" id="name" placeholder="my-infrastructure" {...register("name")} aria-invalid={Boolean(errors.name)} />
                  {showErrors && errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="description">
                    Description
                  </Label>
                  <Textarea className="min-h-[80px] bg-input text-[12px]" id="description" placeholder="Optional description..." {...register("description")} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button disabled={!canSubmit || !nameValue.trim()} type="submit">
                  Create Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
