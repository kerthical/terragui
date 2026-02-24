import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const templates = sqliteTable(
  "templates",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    summary: text("summary").notNull(),
    descriptionMarkdown: text("description_markdown").notNull(),
    tagsJson: text("tags_json"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("templates_slug_unique").on(table.slug)],
);

export const templateParameters = sqliteTable(
  "template_parameters",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    inputType: text("input_type").notNull(),
    isRequired: integer("is_required", { mode: "boolean" }).default(false).notNull(),
    defaultValue: text("default_value"),
    metadataJson: text("metadata_json"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [uniqueIndex("template_parameters_template_key_unique").on(table.templateId, table.key)],
);

export const templateTags = sqliteTable(
  "template_tags",
  {
    id: text("id")
      .primaryKey()
      .$default(() => createId()),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [uniqueIndex("template_tags_template_tag_unique").on(table.templateId, table.tag)],
);
