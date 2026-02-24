"use server";

import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type CliAvailability = { terracognita: boolean; aws: boolean; gcloud: boolean; az: boolean };
type CliKey = keyof CliAvailability;
type CliCheckResult = { available: boolean; path: string | null };
type CliStatus = Record<CliKey, CliCheckResult>;

const cliCandidates: Array<{ key: CliKey; args: string[] }> = [
  { key: "terracognita", args: ["version"] },
  { key: "aws", args: ["--version"] },
  { key: "gcloud", args: ["version"] },
  { key: "az", args: ["version"] },
];

const resolveCliPath = async (command: string): Promise<string | null> => {
  const pathEnv: string | undefined = process.env["PATH"];
  if (!pathEnv) return null;
  const pathEntries: string[] = pathEnv.split(delimiter).filter((entry) => entry.length > 0);
  const isWindows: boolean = process.platform === "win32";
  const pathextEnv: string | undefined = isWindows ? process.env["PATHEXT"] : undefined;
  const extensions: string[] = isWindows ? (pathextEnv ? pathextEnv.split(";").filter((ext) => ext.length > 0) : [".EXE", ".CMD", ".BAT", ".COM"]) : [];
  const accessMode: number = isWindows ? fsConstants.F_OK : fsConstants.X_OK;

  for (const entry of pathEntries) {
    if (isWindows && !command.includes(".")) {
      for (const ext of extensions) {
        const candidate: string = join(entry, `${command}${ext}`);
        try {
          await access(candidate, accessMode);
          return candidate;
        } catch {}
      }
      continue;
    }
    const candidate: string = join(entry, command);
    try {
      await access(candidate, accessMode);
      return candidate;
    } catch {}
  }

  return null;
};

type ImportAvailability = {
  terracognita: boolean;
  terracognitaPath: string | null;
  providers: {
    aws: boolean;
    gcp: boolean;
    azure: boolean;
  };
  providerPaths: {
    aws: string | null;
    gcp: string | null;
    azure: string | null;
  };
  cloud: boolean;
};

export const getImportAvailability = async (): Promise<ImportAvailability> => {
  const results: Array<{ key: CliKey; result: CliCheckResult }> = await Promise.all(
    cliCandidates.map(async (candidate) => {
      const resolvedPath: string | null = await resolveCliPath(candidate.key);
      if (!resolvedPath) {
        return { key: candidate.key, result: { available: false, path: null } };
      }
      try {
        await execFileAsync(resolvedPath, candidate.args, { timeout: 3_000 });
        return { key: candidate.key, result: { available: true, path: resolvedPath } };
      } catch {
        return { key: candidate.key, result: { available: false, path: null } };
      }
    }),
  );

  const availability: CliAvailability = { terracognita: false, aws: false, gcloud: false, az: false };
  const status: CliStatus = {
    terracognita: { available: false, path: null },
    aws: { available: false, path: null },
    gcloud: { available: false, path: null },
    az: { available: false, path: null },
  };
  for (const item of results) {
    availability[item.key] = item.result.available;
    status[item.key] = item.result;
  }

  const hasProviderCli = availability.aws || availability.gcloud || availability.az;
  const cloudAvailable = availability.terracognita && hasProviderCli;

  const response: ImportAvailability = {
    terracognita: availability.terracognita,
    terracognitaPath: status.terracognita.available ? status.terracognita.path : null,
    providers: {
      aws: availability.aws,
      gcp: availability.gcloud,
      azure: availability.az,
    },
    providerPaths: {
      aws: status.aws.available ? status.aws.path : null,
      gcp: status.gcloud.available ? status.gcloud.path : null,
      azure: status.az.available ? status.az.path : null,
    },
    cloud: cloudAvailable,
  };
  return response;
};
