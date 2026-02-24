"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CircleMinus, CirclePlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { type PlanResult, streamTerraformPlan } from "~/app/architecture/[architecture]/_actions/terraform/run-terraform-plan";
import {
  type AwsAuthInput,
  defaultAwsAuth,
  defaultAzureAuth,
  defaultGcpAuth,
  type MultiProviderApplyInput,
  multiProviderApplySchema,
} from "~/app/architecture/[architecture]/_domains/schema/apply-schema";
import type { CloudProvider, ProviderBlock } from "~/app/architecture/[architecture]/_domains/terraform/provider";
import { Button } from "~/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/ui/dialog";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import { RadioGroup, RadioGroupItem } from "~/ui/radio-group";
import { ScrollArea } from "~/ui/scroll-area";

type DialogStep = "credentials" | "planResult";

type ApplyCredentialsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  architectureId: string;
  providerBlocks: ProviderBlock[];
  onApply: (input: MultiProviderApplyInput) => void;
  isApplying: boolean;
  applyError: string | null;
  mode?: "apply" | "destroy";
};

const providerLabels: Record<CloudProvider, string> = {
  aws: "Amazon Web Services",
  gcp: "Google Cloud Platform",
  azure: "Microsoft Azure",
};

const getDefaultValues = (providers: CloudProvider[]): MultiProviderApplyInput => {
  const values: MultiProviderApplyInput = {};
  for (const provider of providers) {
    if (provider === "aws") {
      values.aws = defaultAwsAuth();
    } else if (provider === "gcp") {
      values.gcp = defaultGcpAuth();
    } else if (provider === "azure") {
      values.azure = defaultAzureAuth();
    }
  }
  return values;
};

const createValidationSchema = (providers: CloudProvider[]) => {
  return multiProviderApplySchema.refine(
    (data) => {
      for (const provider of providers) {
        if (provider === "aws" && !data.aws) return false;
        if (provider === "gcp" && !data.gcp) return false;
        if (provider === "azure" && !data.azure) return false;
      }
      return true;
    },
    { message: "All provider credentials are required" },
  );
};

const actionColors: Record<string, string> = {
  create: "text-emerald-500",
  update: "text-amber-500",
  delete: "text-red-500",
  replace: "text-orange-500",
  read: "text-blue-500",
  "no-op": "text-muted-foreground",
};

const actionLabels: Record<string, string> = {
  create: "Create",
  update: "Update",
  delete: "Destroy",
  replace: "Replace",
  read: "Read",
  "no-op": "No change",
};

export function ApplyCredentialsDialog({
  open,
  onOpenChange,
  architectureId,
  providerBlocks,
  onApply,
  isApplying,
  applyError,
  mode = "apply",
}: ApplyCredentialsDialogProps) {
  const uniqueProviders = useMemo(() => [...new Set(providerBlocks.map((b) => b.provider))], [providerBlocks]);
  const isDestroy = mode === "destroy";
  const actionLabel = isDestroy ? "Destroy" : "Apply";
  const actionVerb = isDestroy ? "Destroying" : "Applying";

  const [step, setStep] = useState<DialogStep>("credentials");
  const [isPlanRunning, setIsPlanRunning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planCredentials, setPlanCredentials] = useState<MultiProviderApplyInput | null>(null);
  const [planLogs, setPlanLogs] = useState<string[]>([]);
  const planLogBottomRef = useRef<HTMLDivElement | null>(null);
  const planLogScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const isPlanLogAtBottomRef = useRef(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    formState: { errors },
    reset,
  } = useForm<MultiProviderApplyInput>({
    resolver: zodResolver(createValidationSchema(uniqueProviders)),
    defaultValues: getDefaultValues(uniqueProviders),
  });

  const awsAuth = watch("aws");
  const awsMethod = awsAuth?.method ?? "accessKey";

  const onAwsMethodChange = (next: AwsAuthInput["method"]): void => {
    if (next === "accessKey") {
      setValue("aws", defaultAwsAuth());
      clearErrors("aws");
      return;
    }
    setValue("aws", { method: "profile", profile: "", region: "", sharedCredentialsFile: "" });
    clearErrors("aws");
  };

  const handlePlanSubmit = useCallback(
    async (values: FieldValues) => {
      const parsed = multiProviderApplySchema.safeParse(values);
      if (!parsed.success) return;

      setIsPlanRunning(true);
      setPlanError(null);
      setPlanLogs([]);
      isPlanLogAtBottomRef.current = true;
      setStep("planResult");
      try {
        const stream = await streamTerraformPlan(architectureId, parsed.data, mode);
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        setPlanCredentials(parsed.data);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const message = JSON.parse(line) as
                | { type: "log"; stream: "stdout" | "stderr"; message: string }
                | { type: "error"; error: string }
                | { type: "complete"; plan: PlanResult };

              if (message.type === "log") {
                setPlanLogs((prev) => [...prev, message.message]);
              } else if (message.type === "error") {
                setPlanError(message.error);
              } else if (message.type === "complete") {
                setPlanResult(message.plan);
              }
            } catch {}
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setPlanError(message);
      } finally {
        setIsPlanRunning(false);
      }
    },
    [architectureId, mode],
  );

  const handleBack = useCallback(() => {
    setStep("credentials");
    setPlanResult(null);
    setPlanError(null);
    setPlanLogs([]);
    isPlanLogAtBottomRef.current = true;
  }, []);

  const handleApplyClick = useCallback(() => {
    if (planCredentials) {
      onApply(planCredentials);
    }
  }, [onApply, planCredentials]);

  const handleDialogClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setStep("credentials");
        setPlanResult(null);
        setPlanError(null);
        setPlanCredentials(null);
        setPlanLogs([]);
        isPlanLogAtBottomRef.current = true;
        reset(getDefaultValues(uniqueProviders));
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, uniqueProviders],
  );

  useEffect(() => {
    if (step !== "planResult") return;
    if (!isPlanLogAtBottomRef.current || planLogs.length === 0) {
      return;
    }
    planLogBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [planLogs.length, step]);

  useEffect(() => {
    if (step !== "planResult") return;
    const viewport = planLogScrollAreaRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (!viewport) return;

    const handleScroll = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      isPlanLogAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 32;
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [step]);

  const formValues = watch();
  const canSubmit = (() => {
    for (const provider of uniqueProviders) {
      if (provider === "aws") {
        const aws = formValues.aws;
        if (!aws) return false;
        if (aws.method === "accessKey") {
          if (!aws.accessKey || !aws.secretKey || !aws.region) return false;
        } else {
          if (!aws.profile || !aws.region) return false;
        }
      }
      if (provider === "gcp") {
        const gcp = formValues.gcp;
        if (!gcp || !gcp.credentialsPath || !gcp.project || !gcp.region) return false;
      }
      if (provider === "azure") {
        const azure = formValues.azure;
        if (!azure || !azure.clientId || !azure.clientSecret || !azure.tenantId || !azure.subscriptionId || !azure.resourceGroups) return false;
      }
    }
    return true;
  })();

  const awsErrors = ((errors.aws as Record<string, { message?: string } | undefined>) ?? {}) as Record<string, { message?: string } | undefined>;
  const gcpErrors = ((errors.gcp as Record<string, { message?: string } | undefined>) ?? {}) as Record<string, { message?: string } | undefined>;
  const azureErrors = ((errors.azure as Record<string, { message?: string } | undefined>) ?? {}) as Record<string, { message?: string } | undefined>;

  const blocksForProvider = (provider: CloudProvider): ProviderBlock[] => providerBlocks.filter((b) => b.provider === provider);

  return (
    <Dialog onOpenChange={handleDialogClose} open={open}>
      <DialogContent className="max-w-lg">
        {step === "credentials" && (
          <>
            <DialogHeader>
              <DialogTitle>{isDestroy ? "Destroy from Cloud" : "Apply to Cloud"}</DialogTitle>
              <DialogDescription>
                {isDestroy
                  ? "Enter credentials for each provider to preview and destroy resources."
                  : "Enter credentials for each provider to preview and apply changes."}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <form className="space-y-6" id="plan-form" onSubmit={handleSubmit(handlePlanSubmit)}>
                {(planError ?? applyError) && (
                  <div className="rounded-sm border border-destructive/20 bg-destructive/10 p-2 text-[11px] text-destructive">{planError ?? applyError}</div>
                )}

                {uniqueProviders.includes("aws") && (
                  <div className="space-y-3 rounded-sm border p-3">
                    <div className="text-[12px] font-semibold">{providerLabels.aws}</div>

                    {blocksForProvider("aws").map((block, index) => (
                      <pre
                        className="overflow-x-auto rounded-sm bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground"
                        key={`aws-${block.alias ?? index}`}
                      >
                        {block.code}
                      </pre>
                    ))}

                    <div className="space-y-3">
                      <Label className="text-[11px] font-semibold">Authentication</Label>
                      <RadioGroup className="flex gap-4" onValueChange={(value) => onAwsMethodChange(value as AwsAuthInput["method"])} value={awsMethod}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem id="aws-auth-key" value="accessKey" />
                          <Label className="font-normal text-foreground" htmlFor="aws-auth-key">
                            Access Keys
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem id="aws-auth-profile" value="profile" />
                          <Label className="font-normal text-foreground" htmlFor="aws-auth-profile">
                            Profile
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {awsMethod === "accessKey" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground" htmlFor="aws-access-key">
                              Access Key ID <span className="text-destructive">*</span>
                            </Label>
                            <Input className="bg-input" id="aws-access-key" {...register("aws.accessKey")} aria-invalid={Boolean(awsErrors["accessKey"])} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground" htmlFor="aws-secret-key">
                              Secret Access Key <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              className="bg-input"
                              id="aws-secret-key"
                              type="password"
                              {...register("aws.secretKey")}
                              aria-invalid={Boolean(awsErrors["secretKey"])}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="aws-region">
                            Region <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            className="bg-input w-32"
                            id="aws-region"
                            placeholder="us-east-1"
                            {...register("aws.region")}
                            aria-invalid={Boolean(awsErrors["region"])}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="aws-session-token">
                            Session Token (Optional)
                          </Label>
                          <Input className="bg-input" id="aws-session-token" {...register("aws.sessionToken")} />
                        </div>
                      </div>
                    )}

                    {awsMethod === "profile" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground" htmlFor="aws-profile">
                              Profile Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              className="bg-input"
                              id="aws-profile"
                              placeholder="default"
                              {...register("aws.profile")}
                              aria-invalid={Boolean(awsErrors["profile"])}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground" htmlFor="aws-profile-region">
                              Region <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              className="bg-input"
                              id="aws-profile-region"
                              placeholder="us-east-1"
                              {...register("aws.region")}
                              aria-invalid={Boolean(awsErrors["region"])}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="aws-credentials-file">
                            Credentials File
                          </Label>
                          <Input className="bg-input" id="aws-credentials-file" placeholder="~/.aws/credentials" {...register("aws.sharedCredentialsFile")} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {uniqueProviders.includes("gcp") && (
                  <div className="space-y-3 rounded-sm border p-3">
                    <div className="text-[12px] font-semibold">{providerLabels.gcp}</div>

                    {blocksForProvider("gcp").map((block, index) => (
                      <pre
                        className="overflow-x-auto rounded-sm bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground"
                        key={`gcp-${block.alias ?? index}`}
                      >
                        {block.code}
                      </pre>
                    ))}

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="gcp-credentials">
                          Service Account JSON Path <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          className="bg-input"
                          id="gcp-credentials"
                          placeholder="/path/to/key.json"
                          {...register("gcp.credentialsPath")}
                          aria-invalid={Boolean(gcpErrors["credentialsPath"])}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="gcp-project">
                            Project ID <span className="text-destructive">*</span>
                          </Label>
                          <Input className="bg-input" id="gcp-project" {...register("gcp.project")} aria-invalid={Boolean(gcpErrors["project"])} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="gcp-region">
                            Region <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            className="bg-input"
                            id="gcp-region"
                            placeholder="us-central1"
                            {...register("gcp.region")}
                            aria-invalid={Boolean(gcpErrors["region"])}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {uniqueProviders.includes("azure") && (
                  <div className="space-y-3 rounded-sm border p-3">
                    <div className="text-[12px] font-semibold">{providerLabels.azure}</div>

                    {blocksForProvider("azure").map((block, index) => (
                      <pre
                        className="overflow-x-auto rounded-sm bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground"
                        key={`azure-${block.alias ?? index}`}
                      >
                        {block.code}
                      </pre>
                    ))}

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="azure-client-id">
                            Client ID <span className="text-destructive">*</span>
                          </Label>
                          <Input className="bg-input" id="azure-client-id" {...register("azure.clientId")} aria-invalid={Boolean(azureErrors["clientId"])} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="azure-client-secret">
                            Client Secret <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            className="bg-input"
                            id="azure-client-secret"
                            type="password"
                            {...register("azure.clientSecret")}
                            aria-invalid={Boolean(azureErrors["clientSecret"])}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="azure-tenant-id">
                            Tenant ID <span className="text-destructive">*</span>
                          </Label>
                          <Input className="bg-input" id="azure-tenant-id" {...register("azure.tenantId")} aria-invalid={Boolean(azureErrors["tenantId"])} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="azure-subscription-id">
                            Subscription ID <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            className="bg-input"
                            id="azure-subscription-id"
                            {...register("azure.subscriptionId")}
                            aria-invalid={Boolean(azureErrors["subscriptionId"])}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="azure-resource-groups">
                          Resource Groups (comma separated) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          className="bg-input"
                          id="azure-resource-groups"
                          placeholder="rg-1, rg-2"
                          {...register("azure.resourceGroups")}
                          aria-invalid={Boolean(azureErrors["resourceGroups"])}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </ScrollArea>

            <DialogFooter>
              <Button disabled={isPlanRunning} onClick={() => handleDialogClose(false)} size="sm" type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={!canSubmit || isPlanRunning} form="plan-form" size="sm" type="submit">
                {isPlanRunning ? "Running Plan..." : "Plan"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "planResult" && (
          <>
            <DialogHeader>
              <DialogTitle>{isPlanRunning ? "Running Plan..." : "Plan Result"}</DialogTitle>
              <DialogDescription>
                {isPlanRunning
                  ? "Executing terraform plan and streaming output..."
                  : isDestroy
                    ? "Review the planned changes before destroying resources in the cloud."
                    : "Review the planned changes before applying to the cloud."}
              </DialogDescription>
            </DialogHeader>

            <div className="min-w-0 space-y-4">
              {applyError && <div className="rounded-sm border border-destructive/20 bg-destructive/10 p-2 text-[11px] text-destructive">{applyError}</div>}
              {planError && <div className="rounded-sm border border-destructive/20 bg-destructive/10 p-2 text-[11px] text-destructive">{planError}</div>}

              {planResult && (
                <>
                  <div className="flex items-center gap-4 rounded-sm border p-3">
                    <div className="flex items-center gap-1.5">
                      <CirclePlus className="size-3.5 text-emerald-500" />
                      <span className="text-[12px] font-semibold text-emerald-500">{planResult.summary.add} to add</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="size-3.5 text-amber-500" />
                      <span className="text-[12px] font-semibold text-amber-500">{planResult.summary.change} to change</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CircleMinus className="size-3.5 text-red-500" />
                      <span className="text-[12px] font-semibold text-red-500">{planResult.summary.destroy} to destroy</span>
                    </div>
                  </div>

                  {planResult.changes.length > 0 && (
                    <div className="min-w-0 space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground">Resource Changes</div>
                      <ScrollArea className="min-w-0 h-32 rounded-sm border p-2">
                        <div className="min-w-max space-y-1">
                          {planResult.changes.map((change) => (
                            <div className="flex items-center gap-2 text-[11px] whitespace-nowrap" key={change.address}>
                              <span className={`font-semibold ${actionColors[change.action] ?? "text-foreground"}`}>
                                {actionLabels[change.action] ?? change.action}
                              </span>
                              <span className="font-mono text-muted-foreground">{change.address}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}

              <div className="min-w-0 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground">Execution Log</div>
                <ScrollArea className="min-w-0 h-48 rounded-sm border p-2" ref={planLogScrollAreaRef}>
                  <div className="min-w-max space-y-0.5 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre">
                    {planLogs.map((log, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: logs don't have unique identifiers
                      <div key={index}>{log}</div>
                    ))}
                    <div ref={planLogBottomRef} />
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button disabled={isApplying || isPlanRunning} onClick={handleBack} size="sm" type="button" variant="outline">
                <ArrowLeft className="mr-1.5 size-3.5" />
                Back
              </Button>
              <Button disabled={isApplying || isPlanRunning || !planResult} onClick={handleApplyClick} size="sm" type="button">
                {isApplying ? `${actionVerb}...` : actionLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
