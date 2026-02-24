"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Cloud } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Header } from "~/app/header";
import { createCloudImport } from "~/app/new/import/cloud/create-cloud-import";
import { type AwsAuthInput, type AzureAuthInput, type CloudImportInput, cloudImportSchema, type GcpAuthInput } from "~/app/new/import/cloud/schema";
import { getImportAvailability } from "~/app/new/import/get-import-availability";
import { Alert, AlertDescription, AlertTitle } from "~/ui/alert";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import { RadioGroup, RadioGroupItem } from "~/ui/radio-group";
import { Textarea } from "~/ui/textarea";

const defaultAwsAuth = (): AwsAuthInput => ({ method: "accessKey", accessKey: "", secretKey: "", region: "", sessionToken: "" });
const defaultGcpAuth = (): GcpAuthInput => ({ credentialsPath: "", project: "", region: "" });
const defaultAzureAuth = (): AzureAuthInput => ({
  clientId: "",
  clientSecret: "",
  tenantId: "",
  subscriptionId: "",
  resourceGroups: "",
  environment: "",
});

const ProviderRadioCard = ({
  value,
  label,
  description,
  disabled,
}: {
  value: CloudImportInput["provider"];
  label: string;
  description: string;
  disabled: boolean;
}) => {
  const inputId = `provider-${value}`;
  const body = (
    <label
      className={`flex w-full cursor-pointer items-center gap-3 rounded-sm border border-transparent px-2 py-1.5 transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted"}`}
      htmlFor={inputId}
    >
      <RadioGroupItem disabled={disabled} id={inputId} value={value} />
      <div className="flex flex-col">
        <div className="text-[12px] font-medium leading-none">{label}</div>
        <div className="text-[10px] text-muted-foreground">{description}</div>
      </div>
    </label>
  );

  if (!disabled) {
    return body;
  }

  return (
    <div className="group relative">
      {body}
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-max -translate-x-1/2 rounded-sm border bg-popover px-2 py-1 text-[10px] text-muted-foreground shadow-sm group-hover:block">
        CLI not found on PATH
      </div>
    </div>
  );
};

const isAwsAuth = (auth: CloudImportInput["auth"]): auth is AwsAuthInput => "method" in auth;
const isGcpAuth = (auth: CloudImportInput["auth"]): auth is GcpAuthInput => "credentialsPath" in auth;
const isAzureAuth = (auth: CloudImportInput["auth"]): auth is AzureAuthInput => "clientId" in auth;

export default function CloudImportPage() {
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof getImportAvailability>> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<CloudImportInput>({
    resolver: zodResolver(cloudImportSchema),
    defaultValues: { provider: "aws", name: "", description: "", auth: defaultAwsAuth() },
  });

  const provider = watch("provider");
  const auth = watch("auth");

  const fallbackAuth: CloudImportInput["auth"] =
    auth ??
    (() => {
      if (provider === "aws") return defaultAwsAuth();
      if (provider === "gcp") return defaultGcpAuth();
      return defaultAzureAuth();
    })();

  const awsMethod = isAwsAuth(fallbackAuth) ? fallbackAuth.method : "accessKey";

  useEffect(() => {
    let cancelled = false;
    const fetchAvailability = async () => {
      try {
        const data = await getImportAvailability();
        if (!cancelled) {
          setAvailability(data);
          const first = data.providers.aws ? "aws" : data.providers.gcp ? "gcp" : data.providers.azure ? "azure" : "aws";
          setValue("provider", first as CloudImportInput["provider"]);
          if (first === "aws") {
            setValue("auth", defaultAwsAuth());
          } else if (first === "gcp") {
            setValue("auth", defaultGcpAuth());
          } else {
            setValue("auth", defaultAzureAuth());
          }
        }
      } catch {
        if (!cancelled) {
          setAvailability({
            terracognita: false,
            terracognitaPath: null,
            providers: { aws: false, gcp: false, azure: false },
            providerPaths: { aws: null, gcp: null, azure: null },
            cloud: false,
          });
        }
      }
    };

    void fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, [setValue]);

  const providerEnabled: { aws: boolean; gcp: boolean; azure: boolean } = availability?.providers ?? { aws: false, gcp: false, azure: false };
  const providerPaths: { aws: string | null; gcp: string | null; azure: string | null } = availability?.providerPaths ?? { aws: null, gcp: null, azure: null };

  const onProviderChange = (next: CloudImportInput["provider"]) => {
    setValue("provider", next);
    if (next === "aws") {
      setValue("auth", defaultAwsAuth());
      return;
    }
    if (next === "gcp") {
      setValue("auth", defaultGcpAuth());
      return;
    }
    setValue("auth", defaultAzureAuth());
    clearErrors();
  };

  const onAwsMethodChange = (next: AwsAuthInput["method"]) => {
    if (next === "accessKey") {
      setValue("auth", defaultAwsAuth());
      clearErrors();
      return;
    }
    setValue("auth", { method: "profile", profile: "", region: "", sharedCredentialsFile: "" });
    clearErrors();
  };

  const onSubmit = async (values: CloudImportInput) => {
    await createCloudImport(values);
  };

  const awsErrors = (errors.auth ?? {}) as Record<string, { message?: string } | undefined>;
  const gcpErrors = (errors.auth ?? {}) as Record<string, { message?: string } | undefined>;
  const azureErrors = (errors.auth ?? {}) as Record<string, { message?: string } | undefined>;
  const formValues = watch();
  const canSubmit = cloudImportSchema.safeParse(formValues).success && !isSubmitting;
  const showErrors = isSubmitted;

  if (!availability) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-[12px]">
        <Header backHref="/new/import" title="Cloud Import" />
        <main className="flex flex-1 items-center justify-center text-muted-foreground">Checking availability...</main>
      </div>
    );
  }

  if (!availability.cloud) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-[12px]">
        <Header backHref="/new/import" title="Cloud Import" />
        <main className="flex flex-1 items-start justify-center p-8">
          <Alert className="max-w-md bg-destructive/10 border-destructive/20 text-destructive" variant="destructive">
            <Cloud className="size-4" />
            <AlertTitle>CLI Tools Missing</AlertTitle>
            <AlertDescription className="mt-2 text-[11px] leading-relaxed opacity-90">
              <p>Please ensure the following are installed and on your PATH:</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>terracognita</li>
                <li>AWS CLI, gcloud CLI, or Azure CLI</li>
              </ul>
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-[12px]">
      <Header backHref="/new/import" title="Cloud Import" />
      <main className="flex flex-1 items-start justify-center overflow-auto p-4 sm:pt-8">
        <div className="w-full max-w-lg space-y-4 mb-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Import from Cloud</h2>
            <p className="text-muted-foreground">Connect to a cloud provider to generate Terraform code.</p>
          </div>

          <div className="rounded-md border bg-card p-4 shadow-sm">
            {" "}
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input className="bg-input" id="name" {...register("name")} aria-invalid={Boolean(errors.name)} />
                  {showErrors && errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="description">
                    Description
                  </Label>
                  <Textarea className="min-h-[60px] bg-input text-[12px]" id="description" {...register("description")} />
                </div>
              </div>

              <div className="space-y-3 border-t border-border/50 pt-4">
                <Label className="text-[11px] font-semibold">Provider</Label>
                <RadioGroup className="gap-2" onValueChange={(value) => onProviderChange(value as CloudImportInput["provider"])} value={provider}>
                  <div className="grid grid-cols-1 gap-1">
                    <ProviderRadioCard
                      description={providerPaths.aws ?? "CLI not found"}
                      disabled={!providerEnabled.aws}
                      label="Amazon Web Services"
                      value="aws"
                    />
                    <ProviderRadioCard
                      description={providerPaths.gcp ?? "CLI not found"}
                      disabled={!providerEnabled.gcp}
                      label="Google Cloud Platform"
                      value="gcp"
                    />
                    <ProviderRadioCard
                      description={providerPaths.azure ?? "CLI not found"}
                      disabled={!providerEnabled.azure}
                      label="Microsoft Azure"
                      value="azure"
                    />
                  </div>
                </RadioGroup>
              </div>

              {provider === "aws" && isAwsAuth(fallbackAuth) && (
                <div className="space-y-4 border-t border-border/50 pt-4 animate-in fade-in-50">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-semibold">Authentication</Label>
                    <RadioGroup className="flex gap-4" onValueChange={(value) => onAwsMethodChange(value as AwsAuthInput["method"])} value={awsMethod}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="auth-key" value="accessKey" />
                        <Label className="font-normal text-foreground" htmlFor="auth-key">
                          Access Keys
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="auth-profile" value="profile" />
                        <Label className="font-normal text-foreground" htmlFor="auth-profile">
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
                          <Input className="bg-input" id="aws-access-key" {...register("auth.accessKey")} aria-invalid={Boolean(awsErrors["accessKey"])} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground" htmlFor="aws-secret-key">
                            Secret Access Key <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            className="bg-input"
                            id="aws-secret-key"
                            type="password"
                            {...register("auth.secretKey")}
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
                          {...register("auth.region")}
                          aria-invalid={Boolean(awsErrors["region"])}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="aws-session-token">
                          Session Token (Optional)
                        </Label>
                        <Input className="bg-input" id="aws-session-token" {...register("auth.sessionToken")} />
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
                            {...register("auth.profile")}
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
                            {...register("auth.region")}
                            aria-invalid={Boolean(awsErrors["region"])}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="aws-credentials-file">
                          Credentials File
                        </Label>
                        <Input className="bg-input" id="aws-credentials-file" placeholder="~/.aws/credentials" {...register("auth.sharedCredentialsFile")} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {provider === "gcp" && isGcpAuth(fallbackAuth) && (
                <div className="space-y-4 border-t border-border/50 pt-4 animate-in fade-in-50">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground" htmlFor="gcp-credentials">
                        Service Account JSON Path <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        className="bg-input"
                        id="gcp-credentials"
                        placeholder="/path/to/key.json"
                        {...register("auth.credentialsPath")}
                        aria-invalid={Boolean(gcpErrors["credentialsPath"])}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="gcp-project">
                          Project ID <span className="text-destructive">*</span>
                        </Label>
                        <Input className="bg-input" id="gcp-project" {...register("auth.project")} aria-invalid={Boolean(gcpErrors["project"])} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="gcp-region">
                          Region <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          className="bg-input"
                          id="gcp-region"
                          placeholder="us-central1"
                          {...register("auth.region")}
                          aria-invalid={Boolean(gcpErrors["region"])}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {provider === "azure" && isAzureAuth(fallbackAuth) && (
                <div className="space-y-4 border-t border-border/50 pt-4 animate-in fade-in-50">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="azure-client-id">
                          Client ID <span className="text-destructive">*</span>
                        </Label>
                        <Input className="bg-input" id="azure-client-id" {...register("auth.clientId")} aria-invalid={Boolean(azureErrors["clientId"])} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="azure-client-secret">
                          Client Secret <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          className="bg-input"
                          id="azure-client-secret"
                          type="password"
                          {...register("auth.clientSecret")}
                          aria-invalid={Boolean(azureErrors["clientSecret"])}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="azure-tenant-id">
                          Tenant ID <span className="text-destructive">*</span>
                        </Label>
                        <Input className="bg-input" id="azure-tenant-id" {...register("auth.tenantId")} aria-invalid={Boolean(azureErrors["tenantId"])} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground" htmlFor="azure-subscription-id">
                          Subscription ID <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          className="bg-input"
                          id="azure-subscription-id"
                          {...register("auth.subscriptionId")}
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
                        {...register("auth.resourceGroups")}
                        aria-invalid={Boolean(azureErrors["resourceGroups"])}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button disabled={!canSubmit || isSubmitting} size="sm" type="submit">
                  {isSubmitting ? "Importing..." : "Start Import"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
