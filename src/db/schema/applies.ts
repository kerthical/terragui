import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { architectures } from "~/db/schema/architectures";

export const architectureApplies = sqliteTable(
  "architecture_applies",
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
  (table) => [index("architecture_applies_architecture_id_index").on(table.architectureId)],
);

export const architectureApplyLogs = sqliteTable(
  "architecture_apply_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    applyId: text("apply_id")
      .notNull()
      .references(() => architectureApplies.id, { onDelete: "cascade" }),
    stream: text("stream").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [index("architecture_apply_logs_apply_id_index").on(table.applyId)],
);
