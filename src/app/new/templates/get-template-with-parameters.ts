"use server";

import { eq } from "drizzle-orm";
import { getTemplateById } from "~/app/new/templates/get-template-by-id";
import db from "~/db";
import { templateParameters } from "~/db/schema";

type TemplateParameterRow = typeof templateParameters.$inferSelect;

type TemplateWithParameters = {
  template: NonNullable<Awaited<ReturnType<typeof getTemplateById>>>;
  parameters: TemplateParameterRow[];
};

export const getTemplateWithParameters = async (templateId: string): Promise<TemplateWithParameters | null> => {
  const template = await getTemplateById(templateId);

  if (!template) {
    return null;
  }

  const parameters = await db
    .select()
    .from(templateParameters)
    .where(eq(templateParameters.templateId, template.id))
    .orderBy(templateParameters.sortOrder)
    .all();

  return { template, parameters };
};
