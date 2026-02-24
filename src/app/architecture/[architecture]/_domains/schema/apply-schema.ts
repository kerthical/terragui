import { z } from "zod";

const awsAccessKeyAuthSchema = z.object({
  method: z.literal("accessKey"),
  accessKey: z.string().min(1, "Enter an access key"),
  secretKey: z.string().min(1, "Enter a secret key"),
  region: z.string().min(1, "Enter a region"),
  sessionToken: z.string().optional(),
});

const awsProfileAuthSchema = z.object({
  method: z.literal("profile"),
  profile: z.string().min(1, "Enter a profile name"),
  region: z.string().min(1, "Enter a region"),
  sharedCredentialsFile: z.string().optional(),
});

const awsAuthSchema = z.discriminatedUnion("method", [awsAccessKeyAuthSchema, awsProfileAuthSchema]);

const gcpAuthSchema = z.object({
  credentialsPath: z.string().min(1, "Enter the service account JSON path"),
  project: z.string().min(1, "Enter a project ID"),
  region: z.string().min(1, "Enter a region"),
});

const azureAuthSchema = z.object({
  clientId: z.string().min(1, "Enter a Client ID"),
  clientSecret: z.string().min(1, "Enter a Client Secret"),
  tenantId: z.string().min(1, "Enter a Tenant ID"),
  subscriptionId: z.string().min(1, "Enter a Subscription ID"),
  resourceGroups: z.string().min(1, "Enter resource group names"),
  environment: z.string().optional(),
});

export const multiProviderApplySchema = z.object({
  aws: awsAuthSchema.optional(),
  gcp: gcpAuthSchema.optional(),
  azure: azureAuthSchema.optional(),
});

export type MultiProviderApplyInput = z.infer<typeof multiProviderApplySchema>;
export type AwsAuthInput = z.infer<typeof awsAuthSchema>;
export type GcpAuthInput = z.infer<typeof gcpAuthSchema>;
export type AzureAuthInput = z.infer<typeof azureAuthSchema>;

export const defaultAwsAuth = (): AwsAuthInput => ({
  method: "accessKey",
  accessKey: "",
  secretKey: "",
  region: "",
  sessionToken: "",
});

export const defaultGcpAuth = (): GcpAuthInput => ({
  credentialsPath: "",
  project: "",
  region: "",
});

export const defaultAzureAuth = (): AzureAuthInput => ({
  clientId: "",
  clientSecret: "",
  tenantId: "",
  subscriptionId: "",
  resourceGroups: "",
  environment: "",
});
