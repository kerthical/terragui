"use server";

import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { isRootTerraformFilePath } from "~/app/architecture/[architecture]/_domains/architecture/files";
import {
  type AwsAuthInput,
  type AzureAuthInput,
  type GcpAuthInput,
  type MultiProviderApplyInput,
  multiProviderApplySchema,
} from "~/app/architecture/[architecture]/_domains/schema/apply-schema";
import { loadArchitectureFiles, persistWorkdirFiles, restoreWorkdirFiles } from "~/app/architecture/[architecture]/_domains/terraform/terraform-files";

const execFileAsync = promisify(execFile);

export type PlanResourceChange = {
  address: string;
  action: "create" | "update" | "delete" | "replace" | "read" | "no-op";
  resourceType: string;
  resourceName: string;
};

export type PlanResult = {
  hasChanges: boolean;
  changes: PlanResourceChange[];
  summary: {
    add: number;
    change: number;
    destroy: number;
  };
  logs: string[];
};

export type StartPlanResult = { success: true; plan: PlanResult; credentials: MultiProviderApplyInput } | { success: false; error: string; logs?: string[] };
export type PlanMode = "apply" | "destroy";

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

const runCommandWithLogs = async (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      stderr += error.message;
      resolve({ exitCode: -1, stdout, stderr });
    });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
};

const parsePlanOutput = (stdout: string): PlanResult => {
  const logs = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const changes: PlanResourceChange[] = [];

  const actionPatterns: Array<{ pattern: RegExp; action: PlanResourceChange["action"] }> = [
    { pattern: /^\s*#\s*([\w_.[\]"]+)\s+will be created$/i, action: "create" },
    { pattern: /^\s*#\s*([\w_.[\]"]+)\s+will be updated in-place$/i, action: "update" },
    { pattern: /^\s*#\s*([\w_.[\]"]+)\s+will be destroyed$/i, action: "delete" },
    { pattern: /^\s*#\s*([\w_.[\]"]+)\s+must be replaced$/i, action: "replace" },
    { pattern: /^\s*#\s*([\w_.[\]"]+)\s+will be read during apply$/i, action: "read" },
  ];

  for (const line of logs) {
    for (const { pattern, action } of actionPatterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const address = match[1];
        const parts = address.split(".");
        const resourceType = parts.slice(0, -1).join(".");
        const resourceName = parts[parts.length - 1] ?? address;
        changes.push({ address, action, resourceType, resourceName });
        break;
      }
    }
  }

  const summaryMatch = stdout.match(/Plan:\s*(\d+)\s+to add,\s*(\d+)\s+to change,\s*(\d+)\s+to destroy/i);
  const summary = summaryMatch
    ? {
        add: parseInt(summaryMatch[1] ?? "0", 10),
        change: parseInt(summaryMatch[2] ?? "0", 10),
        destroy: parseInt(summaryMatch[3] ?? "0", 10),
      }
    : { add: 0, change: 0, destroy: 0 };

  const hasChanges = changes.length > 0 || summary.add > 0 || summary.change > 0 || summary.destroy > 0;

  return { hasChanges, changes, summary, logs };
};

export const startTerraformPlan = async (architectureId: string, input: MultiProviderApplyInput, mode: PlanMode = "apply"): Promise<StartPlanResult> => {
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

  const env = buildEnvForProviders(data);
  const allLogs: string[] = [];
  let workdir: string | null = null;
  let result: StartPlanResult | null = null;
  let persistenceError: string | null = null;
  let shouldPersist = false;

  try {
    workdir = await mkdtemp(join(tmpdir(), "terragui-plan-"));
    await restoreWorkdirFiles(workdir, allFiles);
    shouldPersist = true;

    allLogs.push("Running terraform init...");
    const initResult = await runCommandWithLogs("terraform", ["init", "-no-color"], { cwd: workdir, env });
    allLogs.push(...initResult.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0));
    if (initResult.stderr) {
      allLogs.push(...initResult.stderr.split(/\r?\n/).filter((line) => line.trim().length > 0));
    }

    if (initResult.exitCode !== 0) {
      result = { success: false, error: "terraform init failed", logs: allLogs };
    } else {
      const planArgs = mode === "destroy" ? ["plan", "-destroy", "-no-color"] : ["plan", "-no-color"];
      allLogs.push(mode === "destroy" ? "Running terraform plan (destroy)..." : "Running terraform plan...");
      const planResult = await runCommandWithLogs("terraform", planArgs, { cwd: workdir, env });
      allLogs.push(...planResult.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0));
      if (planResult.stderr) {
        allLogs.push(...planResult.stderr.split(/\r?\n/).filter((line) => line.trim().length > 0));
      }

      if (planResult.exitCode !== 0) {
        result = { success: false, error: "terraform plan failed", logs: allLogs };
      } else {
        const plan = parsePlanOutput(planResult.stdout);
        plan.logs = allLogs;
        result = { success: true, plan, credentials: data };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "terraform plan failed";
    result = { success: false, error: message, logs: allLogs };
  } finally {
    if (workdir) {
      if (shouldPersist) {
        try {
          await persistWorkdirFiles(architectureId, workdir);
        } catch (error) {
          persistenceError = error instanceof Error ? error.message : "Failed to persist terraform workspace";
        }
      }
      try {
        await rm(workdir, { recursive: true, force: true });
      } catch {}
    }
  }

  if (persistenceError) {
    allLogs.push(persistenceError);
    return { success: false, error: persistenceError, logs: allLogs };
  }

  return result ?? { success: false, error: "terraform plan failed", logs: allLogs };
};

type StreamMessage = { type: "log"; stream: "stdout" | "stderr"; message: string } | { type: "error"; error: string } | { type: "complete"; plan: PlanResult };

export const streamTerraformPlan = async (
  architectureId: string,
  input: MultiProviderApplyInput,
  mode: PlanMode = "apply",
): Promise<ReadableStream<Uint8Array>> => {
  const parsed = multiProviderApplySchema.safeParse(input);
  if (!parsed.success) {
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const encoder = new TextEncoder();
        const errorMsg: StreamMessage = { type: "error", error: "Invalid input" };
        controller.enqueue(encoder.encode(`${JSON.stringify(errorMsg)}\n`));
        controller.close();
      },
    });
  }
  const data = parsed.data;

  try {
    await validateCredentials(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credential validation failed";
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const encoder = new TextEncoder();
        const errorMsg: StreamMessage = { type: "error", error: message };
        controller.enqueue(encoder.encode(`${JSON.stringify(errorMsg)}\n`));
        controller.close();
      },
    });
  }

  const allFiles = await loadArchitectureFiles(architectureId);
  const rootFiles = allFiles.filter((file) => isRootTerraformFilePath(file.path));
  if (rootFiles.length === 0) {
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const encoder = new TextEncoder();
        const errorMsg: StreamMessage = { type: "error", error: "No Terraform file found for this architecture" };
        controller.enqueue(encoder.encode(`${JSON.stringify(errorMsg)}\n`));
        controller.close();
      },
    });
  }

  const workdir = await mkdtemp(join(tmpdir(), "terragui-plan-"));
  try {
    await restoreWorkdirFiles(workdir, allFiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore terraform workspace";
    try {
      await rm(workdir, { recursive: true, force: true });
    } catch {}
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const encoder = new TextEncoder();
        const errorMsg: StreamMessage = { type: "error", error: message };
        controller.enqueue(encoder.encode(`${JSON.stringify(errorMsg)}\n`));
        controller.close();
      },
    });
  }

  const env = buildEnvForProviders(data);

  return new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const encoder = new TextEncoder();
      let allStdout = "";
      let planResult: PlanResult | null = null;
      let errorMessage: string | null = null;

      const sendLog = (stream: "stdout" | "stderr", message: string): void => {
        const lines = message.split(/\r?\n/).filter((line) => line.trim().length > 0);
        for (const line of lines) {
          const msg: StreamMessage = { type: "log", stream, message: line };
          controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
        }
      };

      const sendError = (error: string): void => {
        const msg: StreamMessage = { type: "error", error };
        controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
      };

      const sendComplete = (plan: PlanResult): void => {
        const msg: StreamMessage = { type: "complete", plan };
        controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
      };

      const runStreamCommand = async (command: string, args: string[]): Promise<{ exitCode: number; stdout: string }> => {
        return new Promise((resolve) => {
          const child = spawn(command, args, { cwd: workdir, env });
          let stdout = "";

          child.stdout.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            stdout += text;
            sendLog("stdout", text);
          });

          child.stderr.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            sendLog("stderr", text);
          });

          child.on("error", (error) => {
            sendError(error.message);
            resolve({ exitCode: -1, stdout });
          });

          child.on("close", (code) => {
            resolve({ exitCode: code ?? -1, stdout });
          });
        });
      };

      try {
        sendLog("stdout", "Running terraform init...");
        const initResult = await runStreamCommand("terraform", ["init", "-no-color"]);
        if (initResult.exitCode !== 0) {
          errorMessage = "terraform init failed";
        }

        if (!errorMessage) {
          const planArgs = mode === "destroy" ? ["plan", "-destroy", "-no-color"] : ["plan", "-no-color"];
          sendLog("stdout", mode === "destroy" ? "Running terraform plan (destroy)..." : "Running terraform plan...");
          const planStreamResult = await runStreamCommand("terraform", planArgs);
          if (planStreamResult.exitCode !== 0) {
            errorMessage = "terraform plan failed";
          } else {
            allStdout += planStreamResult.stdout;
            planResult = parsePlanOutput(allStdout);
          }
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }

      try {
        await persistWorkdirFiles(architectureId, workdir);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Failed to persist terraform workspace";
      }

      try {
        await rm(workdir, { recursive: true, force: true });
      } catch {}

      if (errorMessage) {
        sendError(errorMessage);
        controller.close();
        return;
      }

      if (planResult) {
        sendComplete(planResult);
      }
      controller.close();
    },
  });
};
