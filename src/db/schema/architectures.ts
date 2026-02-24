import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { templates } from "./templates";

export const architectures = sqliteTable(
  "architectures",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sourceType: text("source_type").notNull(),
    templateId: text("template_id").references(() => templates.id, { onDelete: "set null" }),
    importPath: text("import_path"),
    graphJson: text("graph_json"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("architectures_slug_unique").on(table.slug)],
);

export const architectureFiles = sqliteTable(
  "architecture_files",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    architectureId: text("architecture_id")
      .notNull()
      .references(() => architectures.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("architecture_files_architecture_path_unique").on(table.architectureId, table.path)],
);
