import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import db from "~/db";
import { architectureFiles, architectures, providerSchemas, templateParameters, templates, templateTags } from "~/db/schema";
import { astToReactFlow } from "~/lib/graph";
import { hclToAst } from "~/lib/hcl";
import { architectureSeeds } from "~/scripts/seeds";

const execFileAsync = promisify(execFile);
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const schemaWorkdirRoot = "/tmp/terragui/provider-schemas";

type RegistryVersionsResponse = {
  versions?: { version: string }[];
};

type ProviderSchemaDocument = {
  provider_schemas?: Record<string, unknown>;
};

type ProviderTarget = {
  name: string;
  source: string;
};

const providerTargets: ProviderTarget[] = [
  { name: "aws", source: "hashicorp/aws" },
  { name: "google", source: "hashicorp/google" },
  { name: "azurerm", source: "hashicorp/azurerm" },
];

const fetchProviderVersions = async (address: string): Promise<string[]> => {
  const response = await fetch(`https://registry.terraform.io/v1/providers/${address}/versions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch provider versions: ${address}`);
  }
  const body = (await response.json()) as RegistryVersionsResponse;
  const versions = (body.versions ?? []).map((item) => item.version).filter((version) => version.length > 0 && !version.includes("-"));
  versions.sort((a, b) => collator.compare(b, a));
  return versions.slice(0, 5);
};

const fetchProviderSchema = async (provider: ProviderTarget, version: string): Promise<string> => {
  const workdir = join(schemaWorkdirRoot, provider.name, version);
  const cacheDir = join(schemaWorkdirRoot, "plugin-cache");
  await mkdir(workdir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const mainTf = `terraform {\n  required_providers {\n    ${provider.name} = {\n      source  = "${provider.source}"\n      version = "${version}"\n    }\n  }\n}\n\nprovider "${provider.name}" {}\n`;
  await writeFile(join(workdir, "main.tf"), mainTf);
  const env = { ...process.env, TF_PLUGIN_CACHE_DIR: cacheDir, TF_IN_AUTOMATION: "1", TF_INPUT: "0" };
  await execFileAsync("terraform", ["init", "-upgrade=false", "-input=false"], { cwd: workdir, env });
  const { stdout } = await execFileAsync("terraform", ["providers", "schema", "-json"], {
    cwd: workdir,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  const parsed = JSON.parse(stdout) as ProviderSchemaDocument;
  const key = `registry.terraform.io/${provider.source}`;
  const schema = parsed.provider_schemas?.[key];
  if ((schema ?? null) === null) {
    throw new Error(`Failed to fetch provider schema: ${provider.name} ${version}`);
  }
  if (typeof schema !== "object") {
    throw new Error(`Failed to fetch provider schema: ${provider.name} ${version}`);
  }
  return JSON.stringify(schema);
};

const seedProviderSchemas = async (): Promise<void> => {
  for (const provider of providerTargets) {
    const versions = await fetchProviderVersions(provider.source);
    for (const version of versions) {
      const schemaJson = await fetchProviderSchema(provider, version);
      await db.insert(providerSchemas).values({ provider: provider.name, version, schemaJson });
    }
  }
};

await db.run(sql`PRAGMA foreign_keys = OFF`);

const tables = await db.all<{
  name: string;
}>(sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`);

for (const table of tables) {
  await db.run(sql.raw(`DELETE FROM "${table.name}"`));
}

await db.run(sql`PRAGMA foreign_keys = ON`);

await seedProviderSchemas();

const template = await db
  .insert(templates)
  .values({ slug: "sample", name: "Sample Template", provider: "aws", summary: "Sample", descriptionMarkdown: "Sample" })
  .returning()
  .get();

await db.insert(templateParameters).values({ templateId: template.id, key: "param", label: "Parameter", inputType: "text" });

await db.insert(templateTags).values({ templateId: template.id, tag: "sample" });

for (const architectureSeed of architectureSeeds) {
  const architecture = await db
    .insert(architectures)
    .values({
      slug: architectureSeed.slug,
      name: architectureSeed.name,
      description: architectureSeed.description ?? null,
      sourceType: architectureSeed.sourceType,
    })
    .returning()
    .get();

  const combinedHcl = architectureSeed.files.map((file) => file.content).join("\n");
  const flow = await astToReactFlow(hclToAst(combinedHcl));

  await db.transaction(async (tx) => {
    await tx
      .update(architectures)
      .set({ graphJson: JSON.stringify(flow) })
      .where(eq(architectures.id, architecture.id));

    await tx.insert(architectureFiles).values(
      architectureSeed.files.map((file) => ({
        architectureId: architecture.id,
        path: file.path,
        content: file.content,
      })),
    );
  });
}
