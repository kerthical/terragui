"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Header } from "~/app/header";
import { importFromLocal } from "~/app/new/import/import-from-local";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import { Textarea } from "~/ui/textarea";

const schema = z.object({
  name: z.string().min(1, "This field is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LocalImportPage() {
  const [files, setFiles] = useState<FileList | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitted, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
    mode: "onChange",
  });

  const showErrors = isSubmitted;
  const canSubmit = isValid && files !== null && files.length > 0 && !isSubmitting;

  const onSubmit = async (values: FormValues) => {
    if (!files || files.length === 0) {
      setError("root", { message: "Please select at least one Terraform file" });
      return;
    }
    await importFromLocal(values);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/new/import" title="Import Local Files" />
      <main className="flex flex-1 items-start justify-center overflow-auto p-4 sm:pt-16">
        <div className="w-full max-w-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Import from local</h2>
            <p className="text-muted-foreground">Select Terraform files (.tf, .tfvars) to upload.</p>
          </div>

          <div className="rounded-md border bg-card p-4 shadow-sm">
            {" "}
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input autoFocus className="bg-input" id="name" placeholder="my-imported-infra" {...register("name")} aria-invalid={Boolean(errors.name)} />
                  {showErrors && errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="description">
                    Description
                  </Label>
                  <Textarea className="min-h-[60px] bg-input text-[12px]" id="description" {...register("description")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="files">
                    Files <span className="text-destructive">*</span>
                  </Label>
                  <button
                    className="flex min-h-[100px] w-full cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                    onClick={() => document.getElementById("files")?.click()}
                    type="button"
                  >
                    <Upload className="mb-2 size-5 text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">Click to select files</p>
                    <input
                      accept=".tf,.tfvars"
                      className="hidden"
                      id="files"
                      multiple
                      onChange={(e) => {
                        setFiles(e.target.files);
                        clearErrors("root");
                      }}
                      type="file"
                    />
                  </button>
                  {files && files.length > 0 ? (
                    <div className="text-[11px] text-primary">{files.length} file(s) selected</div>
                  ) : (
                    showErrors && errors.root && <p className="text-[11px] text-destructive">{errors.root.message}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button disabled={!canSubmit} type="submit">
                  {isSubmitting ? "Importing..." : "Import"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
