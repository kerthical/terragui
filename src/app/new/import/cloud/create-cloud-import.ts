"use server";

import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { type CloudImportInput, cloudImportSchema } from "~/app/new/import/cloud/schema";
import { getImportAvailability } from "~/app/new/import/get-import-availability";
import db from "~/db";
import { architectureFiles, architectureImportLogs, architectureImports, architectures } from "~/db/schema";
import { astToReactFlow, type ReactFlowGraph } from "~/lib/graph";
import { type HclDocument, hclToAst } from "~/lib/hcl";

const execFileAsync = promisify(execFile);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const appendLog = async (importId: string, stream: "stdout" | "stderr", message: string) => {
  const lines = message.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return;
  await db.insert(architectureImportLogs).values(lines.map((line) => ({ importId, stream, message: line })));
};

const terracognitaProvider = (provider: CloudImportInput["provider"]): string => {
  if (provider === "aws") return "aws";
  if (provider === "gcp") return "google";
  return "azurerm";
};

const buildTerracognitaArgs = (input: CloudImportInput, hclPath: string, statePath: string): string[] => {
  const args = [terracognitaProvider(input.provider), "--hcl", hclPath, "--tfstate", statePath];

  if (input.provider === "aws") {
    if (input.auth.method === "accessKey") {
      args.push("--aws-access-key", input.auth.accessKey, "--aws-secret-access-key", input.auth.secretKey, "--aws-default-region", input.auth.region);
      if (input.auth.sessionToken) {
        args.push("--aws-session-token", input.auth.sessionToken);
      }
    } else {
      args.push("--aws-profile", input.auth.profile, "--aws-default-region", input.auth.region);
      if (input.auth.sharedCredentialsFile) {
        args.push("--aws-shared-credentials-file", input.auth.sharedCredentialsFile);
      }
    }
  }

  if (input.provider === "gcp") {
    args.push("--credentials", input.auth.credentialsPath, "--project", input.auth.project, "--region", input.auth.region);
  }

  if (input.provider === "azure") {
    args.push(
      "--client-id",
      input.auth.clientId,
      "--client-secret",
      input.auth.clientSecret,
      "--tenant-id",
      input.auth.tenantId,
      "--subscription-id",
      input.auth.subscriptionId,
    );
    const resourceGroups = input.auth.resourceGroups
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    for (const name of resourceGroups) {
      args.push("--resource-group-name", name);
    }
    if (input.auth.environment) {
      args.push("--environment", input.auth.environment);
    }
  }

  return args;
};

const runTerracognita = async (params: { importId: string; architectureId: string; input: CloudImportInput }) => {
  const workdir = await mkdtemp(join(tmpdir(), "terragui-import-"));
  const hclPath = join(workdir, "main.tf");
  const statePath = join(workdir, "terraform.tfstate");
  const args = buildTerracognitaArgs(params.input, hclPath, statePath);

  await db.update(architectureImports).set({ status: "running" }).where(eq(architectureImports.id, params.importId));

  await new Promise<void>((resolve, reject) => {
    const child = spawn("terracognita", args, { cwd: workdir });

    child.stdout.on("data", async (chunk) => {
      const text: string = chunk.toString();
      await appendLog(params.importId, "stdout", text);
    });
    child.stderr.on("data", async (chunk) => {
      const text: string = chunk.toString();
      await appendLog(params.importId, "stderr", text);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`terracognita exited with code ${code ?? -1}`));
      }
    });
  });

  const hclContent = await readFile(hclPath, "utf8");
  let document: HclDocument;
  try {
    document = hclToAst(hclContent);
  } catch (error) {
    const rawMessage: string = error instanceof Error ? error.message : String(error);
    const locationMatch: RegExpMatchArray | null = rawMessage.match(/rowBegin":(\d+),"columnBegin":(\d+)/);
    const lineRaw: string | null = locationMatch?.[1] ?? null;
    const columnRaw: string | null = locationMatch?.[2] ?? null;
    const lineNumber: number | null = lineRaw ? Number(lineRaw) : null;
    const columnNumber: number | null = columnRaw ? Number(columnRaw) : null;
    const tokenMatch: RegExpMatchArray | null = rawMessage.match(/Unable to consume token: ([^\s]+)/);
    const tokenText: string | null = tokenMatch?.[1] ?? null;
    const lines: string[] = hclContent.split(/\r?\n/);
    const lineText: string | null = lineNumber !== null && lineNumber > 0 ? (lines[lineNumber - 1] ?? null) : null;
    const trimmedLine: string | null = lineText ? lineText.trimEnd() : null;
    const snippet: string | null = trimmedLine !== null && trimmedLine.length > 180 ? `${trimmedLine.slice(0, 180)}...` : trimmedLine;
    const locationPart: string | null = lineNumber !== null && columnNumber !== null ? `line ${lineNumber}, column ${columnNumber}` : null;
    const tokenPart: string | null = tokenText ? `token "${tokenText}"` : null;
    const messageParts: string[] = ["HCL parse error"];
    if (locationPart) {
      messageParts.push(locationPart);
    }
    if (tokenPart) {
      messageParts.push(tokenPart);
    }
    if (!locationPart && !tokenPart) {
      messageParts.push(rawMessage);
    }
    const detailMessage: string = messageParts.join(": ");
    const detailWithSnippet: string = snippet ? `${detailMessage} (${snippet})` : detailMessage;
    throw new Error(detailWithSnippet);
  }

  let flow: ReactFlowGraph;
  try {
    flow = await astToReactFlow(document);
  } catch (error) {
    const message: string = error instanceof Error ? error.message : String(error);
    throw new Error(`Graph build failed: ${message}`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(architectures)
      .set({ graphJson: JSON.stringify(flow) })
      .where(eq(architectures.id, params.architectureId));

    await tx
      .insert(architectureFiles)
      .values({ architectureId: params.architectureId, path: "main.tf", content: hclContent })
      .onConflictDoUpdate({ target: [architectureFiles.architectureId, architectureFiles.path], set: { content: hclContent } });

    await tx.update(architectureImports).set({ status: "succeeded", completedAt: new Date().toISOString() }).where(eq(architectureImports.id, params.importId));
  });
};

const validateAwsCredentials = async (input: Extract<CloudImportInput, { provider: "aws" }>) => {
  if (input.auth.method === "accessKey") {
    const env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: input.auth.accessKey,
      AWS_SECRET_ACCESS_KEY: input.auth.secretKey,
      ...(input.auth.sessionToken ? { AWS_SESSION_TOKEN: input.auth.sessionToken } : {}),
      AWS_DEFAULT_REGION: input.auth.region,
      AWS_REGION: input.auth.region,
    };
    await execFileAsync("aws", ["sts", "get-caller-identity"], { env, timeout: 5_000 });
    return;
  }
  const env = { ...process.env, ...(input.auth.sharedCredentialsFile ? { AWS_SHARED_CREDENTIALS_FILE: input.auth.sharedCredentialsFile } : {}) };
  await execFileAsync("aws", ["sts", "get-caller-identity", "--profile", input.auth.profile, "--region", input.auth.region], {
    env,
    timeout: 5_000,
  });
};

const validateGcpCredentials = async (input: Extract<CloudImportInput, { provider: "gcp" }>) => {
  await execFileAsync("gcloud", ["auth", "application-default", "print-access-token", `--key-file=${input.auth.credentialsPath}`], { timeout: 7_000 });
};

const validateAzureCredentials = async (input: Extract<CloudImportInput, { provider: "azure" }>) => {
  await execFileAsync(
    "az",
    [
      "account",
      "get-access-token",
      "--service-principal",
      "-u",
      input.auth.clientId,
      "-p",
      input.auth.clientSecret,
      "--tenant",
      input.auth.tenantId,
      "--subscription",
      input.auth.subscriptionId,
    ],
    { timeout: 7_000 },
  );
};

const validateCredentials = async (input: CloudImportInput) => {
  if (input.provider === "aws") {
    await validateAwsCredentials(input);
    return;
  }
  if (input.provider === "gcp") {
    await validateGcpCredentials(input);
    return;
  }
  await validateAzureCredentials(input);
};

export const createCloudImport = async (input: CloudImportInput): Promise<void> => {
  const parsed = cloudImportSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }
  const data = parsed.data;

  const availability = await getImportAvailability();
  if (!availability.terracognita || !availability.providers[data.provider]) {
    throw new Error("Required CLI tools are not available");
  }

  await validateCredentials(data);

  const slug = slugify(data.name);

  const architecture = await db
    .insert(architectures)
    .values({ slug, name: data.name, description: data.description, sourceType: `cloud:${data.provider}` })
    .returning()
    .get();

  const importRow = await db
    .insert(architectureImports)
    .values({ architectureId: architecture.id, provider: data.provider, status: "pending" })
    .returning()
    .get();

  void runTerracognita({ importId: importRow.id, architectureId: architecture.id, input: data }).catch(async (error) => {
    const message: string = error instanceof Error ? error.message : "import failed";
    await appendLog(importRow.id, "stderr", message);
    await db
      .update(architectureImports)
      .set({ status: "failed", message, completedAt: new Date().toISOString() })
      .where(eq(architectureImports.id, importRow.id));
  });

  redirect(`/architecture/${architecture.id}`);
};
