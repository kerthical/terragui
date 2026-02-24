"use server";

import { eq } from "drizzle-orm";
import db from "~/db";
import { templates } from "~/db/schema";

type TemplateRow = typeof templates.$inferSelect;

export const getTemplateById = async (templateId: string): Promise<TemplateRow | undefined> => {
  return db.select().from(templates).where(eq(templates.id, templateId)).get();
};
