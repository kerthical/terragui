"use server";

import { eq } from "drizzle-orm";
import db from "~/db";
import { providerSchemas } from "~/db/schema";

export type ProviderSchemaAttribute = {
  type?: unknown;
  optional?: boolean;
  required?: boolean;
  computed?: boolean;
  sensitive?: boolean;
  description?: string;
  description_kind?: "plain" | "markdown";
};

export type ProviderSchemaBlockType = {
  nesting_mode: "single" | "list" | "set" | "map" | "group";
  min_items?: number;
  max_items?: number;
  block: ProviderSchemaBlock;
};

export type ProviderSchemaBlock = {
  attributes?: Record<string, ProviderSchemaAttribute>;
  block_types?: Record<string, ProviderSchemaBlockType>;
  description?: string;
  description_kind?: "plain" | "markdown";
};

export type ProviderResourceSchema = {
  version: number;
  block: ProviderSchemaBlock;
};

export type ProviderSchema = {
  provider: ProviderResourceSchema;
  resource_schemas?: Record<string, ProviderResourceSchema>;
  data_source_schemas?: Record<string, ProviderResourceSchema>;
};

const versionCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const sortVersionsDesc = (versions: string[]): string[] => [...versions].sort((a, b) => versionCollator.compare(b, a));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isProviderResourceSchema = (value: unknown): value is ProviderResourceSchema => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value["version"] !== "number") {
    return false;
  }
  if (!isRecord(value["block"])) {
    return false;
  }
  return true;
};

const isProviderSchema = (value: unknown): value is ProviderSchema => {
  if (!isRecord(value)) {
    return false;
  }
  if (!isProviderResourceSchema(value["provider"])) {
    return false;
  }
  if (value["resource_schemas"] !== undefined && !isRecord(value["resource_schemas"])) {
    return false;
  }
  if (value["data_source_schemas"] !== undefined && !isRecord(value["data_source_schemas"])) {
    return false;
  }
  return true;
};

const parseProviderSchema = (json: string): ProviderSchema | null => {
  const parsed: unknown = JSON.parse(json);
  if (!isProviderSchema(parsed)) {
    return null;
  }
  return parsed;
};

export type FetchProviderSchemaInput = {
  provider: string;
  version?: string;
};

export type FetchProviderSchemaResult =
  | {
      provider: string;
      version: string;
      schema: ProviderSchema;
    }
  | {
      provider: string;
      version: string | null;
      schema: null;
      error: string;
    };

export const fetchProviderSchema = async (input: FetchProviderSchemaInput): Promise<FetchProviderSchemaResult> => {
  const rows = await db.select().from(providerSchemas).where(eq(providerSchemas.provider, input.provider));
  if (rows.length === 0) {
    return { provider: input.provider, version: input.version ?? null, schema: null, error: "Schema not found" };
  }

  const versionChoices = sortVersionsDesc(rows.map((row) => row.version));
  const targetVersion = input.version ?? versionChoices[0] ?? rows[0]?.version;
  const record = rows.find((row) => row.version === targetVersion);

  if (!record) {
    return { provider: input.provider, version: targetVersion ?? null, schema: null, error: "No schema for the specified version" };
  }

  const schema = parseProviderSchema(record.schemaJson);

  if (!schema) {
    return { provider: input.provider, version: record.version, schema: null, error: "Failed to parse schema" };
  }

  return {
    provider: input.provider,
    version: record.version,
    schema,
  };
};
