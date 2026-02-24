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

export const cloudImportSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("aws"),
    name: z.string().min(1, "This field is required"),
    description: z.string().optional(),
    auth: awsAuthSchema,
  }),
  z.object({
    provider: z.literal("gcp"),
    name: z.string().min(1, "This field is required"),
    description: z.string().optional(),
    auth: gcpAuthSchema,
  }),
  z.object({
    provider: z.literal("azure"),
    name: z.string().min(1, "This field is required"),
    description: z.string().optional(),
    auth: azureAuthSchema,
  }),
]);

export type CloudImportInput = z.infer<typeof cloudImportSchema>;
export type AwsAuthInput = Extract<CloudImportInput, { provider: "aws" }>["auth"];
export type GcpAuthInput = Extract<CloudImportInput, { provider: "gcp" }>["auth"];
export type AzureAuthInput = Extract<CloudImportInput, { provider: "azure" }>["auth"];
