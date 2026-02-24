import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const providerSchemas = sqliteTable(
  "provider_schemas",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    provider: text("provider").notNull(),
    version: text("version").notNull(),
    schemaJson: text("schema_json").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("provider_schemas_provider_version_unique").on(table.provider, table.version)],
);
