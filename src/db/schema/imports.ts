import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { architectures } from "~/db/schema/architectures";

export const architectureImports = sqliteTable(
  "architecture_imports",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    architectureId: text("architecture_id")
      .notNull()
      .references(() => architectures.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    message: text("message"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [uniqueIndex("architecture_imports_architecture_id_unique").on(table.architectureId)],
);

export const architectureImportLogs = sqliteTable(
  "architecture_import_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importId: text("import_id")
      .notNull()
      .references(() => architectureImports.id, { onDelete: "cascade" }),
    stream: text("stream").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [index("architecture_import_logs_import_id_index").on(table.importId)],
);
