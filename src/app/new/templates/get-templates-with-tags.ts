"use server";

import { eq } from "drizzle-orm";
import db from "~/db";
import { templates, templateTags } from "~/db/schema";

type TemplateWithTags = typeof templates.$inferSelect & {
  tags: string[];
};

export const getTemplatesWithTags = async (): Promise<TemplateWithTags[]> => {
  const allTemplates = await db.select().from(templates).all();

  const templatesWithTags = await Promise.all(
    allTemplates.map(async (template) => {
      const tags = await db.select({ tag: templateTags.tag }).from(templateTags).where(eq(templateTags.templateId, template.id)).all();

      return {
        ...template,
        tags: tags.map((tag) => tag.tag),
      };
    }),
  );

  return templatesWithTags;
};
