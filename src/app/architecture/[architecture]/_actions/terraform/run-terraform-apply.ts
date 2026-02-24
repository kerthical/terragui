"use server";

import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { isRootTerraformFilePath } from "~/app/architecture/[architecture]/_domains/architecture/files";
import {
  type AwsAuthInput,
  type AzureAuthInput,
  type GcpAuthInput,
  type MultiProviderApplyInput,
  multiProviderApplySchema,
} from "~/app/architecture/[architecture]/_domains/schema/apply-schema";
import { extractProviderBlocks, getUniqueProviders } from "~/app/architecture/[architecture]/_domains/terraform/provider";
import {
  loadArchitectureFiles,
  persistWorkdirFiles,
  restoreWorkdirFiles,
  type TerraformFileEntry,
} from "~/app/architecture/[architecture]/_domains/terraform/terraform-files";
import db from "~/db";
import { architectureApplies, architectureApplyLogs } from "~/db/schema";

const execFileAsync = promisify(execFile);

const appendLog = async (applyId: string, stream: "stdout" | "stderr", message: string): Promise<void> => {
  const lines = message.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return;
  await db.insert(architectureApplyLogs).values(lines.map((line) => ({ applyId, stream, message: line })));
};

const buildEnvForProviders = (input: MultiProviderApplyInput): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (input.aws) {
    const aws = input.aws;
    if (aws.method === "accessKey") {
      env["AWS_ACCESS_KEY_ID"] = aws.accessKey;
      env["AWS_SECRET_ACCESS_KEY"] = aws.secretKey;
      env["AWS_DEFAULT_REGION"] = aws.region;
      env["AWS_REGION"] = aws.region;
      if (aws.sessionToken) {
        env["AWS_SESSION_TOKEN"] = aws.sessionToken;
      }
    } else {
      env["AWS_PROFILE"] = aws.profile;
      env["AWS_DEFAULT_REGION"] = aws.region;
      env["AWS_REGION"] = aws.region;
      if (aws.sharedCredentialsFile) {
        env["AWS_SHARED_CREDENTIALS_FILE"] = aws.sharedCredentialsFile;
      }
    }
  }

  if (input.gcp) {
    env["GOOGLE_APPLICATION_CREDENTIALS"] = input.gcp.credentialsPath;
    env["GOOGLE_PROJECT"] = input.gcp.project;
    env["GOOGLE_REGION"] = input.gcp.region;
  }

  if (input.azure) {
    env["ARM_CLIENT_ID"] = input.azure.clientId;
    env["ARM_CLIENT_SECRET"] = input.azure.clientSecret;
    env["ARM_TENANT_ID"] = input.azure.tenantId;
    env["ARM_SUBSCRIPTION_ID"] = input.azure.subscriptionId;
    if (input.azure.environment) {
      env["ARM_ENVIRONMENT"] = input.azure.environment;
    }
  }

  return env;
};

const validateAwsCredentials = async (aws: AwsAuthInput): Promise<void> => {
  if (aws.method === "accessKey") {
    const env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: aws.accessKey,
      AWS_SECRET_ACCESS_KEY: aws.secretKey,
      ...(aws.sessionToken ? { AWS_SESSION_TOKEN: aws.sessionToken } : {}),
      AWS_DEFAULT_REGION: aws.region,
      AWS_REGION: aws.region,
    };
    await execFileAsync("aws", ["sts", "get-caller-identity"], { env, timeout: 5_000 });
    return;
  }
  const env = { ...process.env, ...(aws.sharedCredentialsFile ? { AWS_SHARED_CREDENTIALS_FILE: aws.sharedCredentialsFile } : {}) };
  await execFileAsync("aws", ["sts", "get-caller-identity", "--profile", aws.profile, "--region", aws.region], {
    env,
    timeout: 5_000,
  });
};

const validateGcpCredentials = async (gcp: GcpAuthInput): Promise<void> => {
  await execFileAsync("gcloud", ["auth", "application-default", "print-access-token", `--key-file=${gcp.credentialsPath}`], { timeout: 7_000 });
};

const validateAzureCredentials = async (azure: AzureAuthInput): Promise<void> => {
  await execFileAsync(
    "az",
    [
      "account",
      "get-access-token",
      "--service-principal",
      "-u",
      azure.clientId,
      "-p",
      azure.clientSecret,
      "--tenant",
      azure.tenantId,
      "--subscription",
      azure.subscriptionId,
    ],
    { timeout: 7_000 },
  );
};

const validateCredentials = async (input: MultiProviderApplyInput): Promise<void> => {
  if (input.aws) {
    await validateAwsCredentials(input.aws);
  }
  if (input.gcp) {
    await validateGcpCredentials(input.gcp);
  }
  if (input.azure) {
    await validateAzureCredentials(input.azure);
  }
};

const runCommand = async (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; applyId: string }): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env });

    child.stdout.on("data", async (chunk: Buffer) => {
      const text = chunk.toString();
      await appendLog(options.applyId, "stdout", text);
    });

    child.stderr.on("data", async (chunk: Buffer) => {
      const text = chunk.toString();
      await appendLog(options.applyId, "stderr", text);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code ?? -1}`));
      }
    });
  });
};

const runTerraformApply = async (params: {
  applyId: string;
  architectureId: string;
  input: MultiProviderApplyInput;
  files: TerraformFileEntry[];
}): Promise<void> => {
  const workdir = await mkdtemp(join(tmpdir(), "terragui-apply-"));
  const env = buildEnvForProviders(params.input);

  try {
    await restoreWorkdirFiles(workdir, params.files);
    await db.update(architectureApplies).set({ status: "running" }).where(eq(architectureApplies.id, params.applyId));

    await appendLog(params.applyId, "stdout", "Running terraform init...");
    await runCommand("terraform", ["init", "-no-color"], { cwd: workdir, env, applyId: params.applyId });

    await appendLog(params.applyId, "stdout", "Running terraform apply...");
    await runCommand("terraform", ["apply", "-auto-approve", "-no-color"], { cwd: workdir, env, applyId: params.applyId });

    try {
      await persistWorkdirFiles(params.architectureId, workdir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to persist terraform workspace";
      throw new Error(message);
    }

    await db.update(architectureApplies).set({ status: "succeeded", completedAt: new Date().toISOString() }).where(eq(architectureApplies.id, params.applyId));
  } finally {
    try {
      await rm(workdir, { recursive: true, force: true });
    } catch {}
  }
};

export type StartApplyResult = { success: true; applyId: string } | { success: false; error: string };

export const startTerraformApply = async (architectureId: string, input: MultiProviderApplyInput): Promise<StartApplyResult> => {
  const parsed = multiProviderApplySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }
  const data = parsed.data;

  try {
    await validateCredentials(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credential validation failed";
    return { success: false, error: message };
  }

  const allFiles = await loadArchitectureFiles(architectureId);
  const rootFiles = allFiles.filter((file) => isRootTerraformFilePath(file.path));

  if (rootFiles.length === 0) {
    return { success: false, error: "No Terraform file found for this architecture" };
  }

  const combinedRoot = rootFiles.map((file) => file.content).join("\n\n");
  const providerBlocks = extractProviderBlocks(combinedRoot);
  const uniqueProviders = getUniqueProviders(providerBlocks);
  const providerString = uniqueProviders.join(",");

  const applyRow = await db.insert(architectureApplies).values({ architectureId, provider: providerString, status: "pending" }).returning().get();

  void runTerraformApply({ applyId: applyRow.id, architectureId, input: data, files: allFiles }).catch(async (error) => {
    const message = error instanceof Error ? error.message : "apply failed";
    await appendLog(applyRow.id, "stderr", message);
    await db
      .update(architectureApplies)
      .set({ status: "failed", message, completedAt: new Date().toISOString() })
      .where(eq(architectureApplies.id, applyRow.id));
  });

  return { success: true, applyId: applyRow.id };
};
