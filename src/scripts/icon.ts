import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";

type ProviderConfig = {
  name: "aws" | "google" | "azurerm";
  url: string;
  prefix: string;
  address: string;
};

type IconEntry = {
  path: string;
  tokens: string[];
};

type ProviderSchema = {
  provider_schemas: Record<
    string,
    {
      resource_schemas: Record<string, unknown>;
    }
  >;
};

const providers: ProviderConfig[] = [
  {
    name: "aws",
    url: "https://d1.awsstatic.com/webteam/architecture-icons/q1-2025/Asset-Package_02072025.dee42cd0a6eaacc3da1ad9519579357fb546f803.zip",
    prefix: "aws_",
    address: "registry.terraform.io/hashicorp/aws",
  },
  {
    name: "google",
    url: "https://cloud.google.com/icons/files/google-cloud-icons.zip",
    prefix: "google_",
    address: "registry.terraform.io/hashicorp/google",
  },
  {
    name: "azurerm",
    url: "https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V23.zip",
    prefix: "azurerm_",
    address: "registry.terraform.io/hashicorp/azurerm",
  },
];

const iconsDir = path.resolve("src/icons");

const fetchBinary = async (url: string, dest: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(dest, buffer);
};

const extractZip = async (zipPath: string, dest: string): Promise<void> => {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
};

const collectSvgFiles = async (root: string): Promise<string[]> => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "__MACOSX") {
      continue;
    }
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const children = await collectSvgFiles(full);
      files.push(...children);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) {
      files.push(full);
    }
  }
  return files;
};

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 0);
};

const buildIconEntries = (paths: string[]): IconEntry[] => {
  return paths.map((p) => ({
    path: p,
    tokens: tokenize(p),
  }));
};

const calcScore = (resourceTokens: string[], iconTokens: string[], primary: string | undefined, weight: number): number => {
  let score = 0;
  const iconSet = new Set(iconTokens);
  for (const token of resourceTokens) {
    if (iconSet.has(token)) {
      score += 1;
    }
  }
  if (primary && iconSet.has(primary)) {
    score += 2;
  }
  if (iconTokens.join("").includes(resourceTokens.join(""))) {
    score += 1;
  }
  return score + weight;
};

const pickIcon = (resource: string, icons: IconEntry[], prefix: string): IconEntry => {
  if (icons.length === 0) {
    throw new Error("icon list is empty");
  }
  const core = resource.replace(prefix, "");
  const resourceTokens = tokenize(core);
  const primary = resourceTokens.at(0);
  let best: IconEntry | null = null;
  let bestScore = -Infinity;
  for (const icon of icons) {
    const weight = icon.path.includes("/32/") ? 0.01 : 0;
    const score = calcScore(resourceTokens, icon.tokens, primary, weight);
    if (score > bestScore) {
      bestScore = score;
      best = icon;
    }
  }
  if (!best) {
    throw new Error("icon selection failed");
  }
  return best;
};

const execTerraform = async (args: string[], cwd: string): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    execFile("terraform", args, { cwd, env: { ...process.env, TF_IN_AUTOMATION: "1" }, maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
};

const buildProviderConfig = (provider: ProviderConfig): string => {
  const name = provider.prefix.slice(0, -1);
  const providerBlock = provider.name === "azurerm" ? 'provider "azurerm" {\n  features {}\n}' : `provider "${name}" {}`;
  return `terraform {
  required_providers {
    ${name} = { source = "${provider.address}" }
  }
}
${providerBlock}
`;
};

const runTerraformSchema = async (provider: ProviderConfig): Promise<ProviderSchema> => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "tf-schema-"));
  try {
    const tfconfig = buildProviderConfig(provider);
    await fs.writeFile(path.join(work, "main.tf"), tfconfig, "utf8");
    await execTerraform(["init", "-input=false", "-no-color"], work);
    const output = await execTerraform(["providers", "schema", "-json"], work);
    return JSON.parse(output) as ProviderSchema;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
};

const loadResourceTypes = async (provider: ProviderConfig): Promise<string[]> => {
  const schema = await runTerraformSchema(provider);
  const providerSchema = schema.provider_schemas[provider.address];
  if (!providerSchema) {
    throw new Error(`schema missing: ${provider.address}`);
  }
  const resources = Object.keys(providerSchema.resource_schemas).filter((key) => key.startsWith(provider.prefix));
  return resources.sort();
};

const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

type PreparedIcons = {
  entries: IconEntry[];
  cleanup: () => Promise<void>;
};

const prepareIcons = async (provider: ProviderConfig): Promise<PreparedIcons> => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), `${provider.name}-icons-`));
  const zipPath = path.join(work, "icons.zip");
  await fetchBinary(provider.url, zipPath);
  const dest = path.join(work, "unzipped");
  await ensureDir(dest);
  await extractZip(zipPath, dest);
  const files = await collectSvgFiles(dest);
  if (files.length === 0) {
    throw new Error(`svg not found: ${provider.name}`);
  }
  return {
    entries: buildIconEntries(files),
    cleanup: async () => {
      await fs.rm(work, { recursive: true, force: true });
    },
  };
};

const processIcons = async (provider: ProviderConfig, icons: IconEntry[], resources: string[], mapping: Record<string, string>): Promise<void> => {
  const sourceToDest = new Map<string, string>();

  const providerDir = path.join(iconsDir, provider.name);
  await ensureDir(providerDir);

  const usedFilenames = new Set<string>();

  for (const resource of resources) {
    try {
      const icon = pickIcon(resource, icons, provider.prefix);
      let destRelativePath = sourceToDest.get(icon.path);

      if (!destRelativePath) {
        const originalBasename = path.basename(icon.path);
        let destFilename = originalBasename;

        let counter = 1;
        while (usedFilenames.has(destFilename)) {
          const ext = path.extname(originalBasename);
          const name = path.basename(originalBasename, ext);
          destFilename = `${name}_${counter}${ext}`;
          counter++;
        }
        usedFilenames.add(destFilename);

        destRelativePath = `${provider.name}/${destFilename}`;
        sourceToDest.set(icon.path, destRelativePath);

        const svg = await fs.readFile(icon.path, "utf8");
        const destPath = path.join(iconsDir, destRelativePath);
        await fs.writeFile(destPath, svg, "utf8");
      }

      mapping[resource] = destRelativePath;
    } catch (error) {
      void error;
    }
  }
};

const main = async (): Promise<void> => {
  await ensureDir(iconsDir);

  const existing = await fs.readdir(iconsDir);
  for (const name of existing) {
    const fullPath = path.join(iconsDir, name);
    const stat = await fs.lstat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else if (name.endsWith(".svg") || name === "map.json") {
      await fs.unlink(fullPath);
    }
  }

  const mapping: Record<string, string> = {};

  for (const provider of providers) {
    const prepared = await prepareIcons(provider);
    try {
      const resources = await loadResourceTypes(provider);
      await processIcons(provider, prepared.entries, resources, mapping);
    } finally {
      await prepared.cleanup();
    }
  }

  await fs.writeFile(path.join(iconsDir, "map.json"), JSON.stringify(mapping, null, 2), "utf8");
};

main().catch(() => {
  process.exitCode = 1;
});
