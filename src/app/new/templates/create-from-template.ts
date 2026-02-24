"use server";

import { redirect } from "next/navigation";
import db from "~/db";
import { architectures } from "~/db/schema";

type CreateFromTemplateInput = Pick<typeof architectures.$inferInsert, "name" | "description" | "templateId"> & {
  parameters: Record<string, string>;
};

export const createFromTemplate = async (input: CreateFromTemplateInput): Promise<void> => {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const arch = await db
    .insert(architectures)
    .values({
      slug,
      name: input.name,
      description: input.description,
      templateId: input.templateId,
      sourceType: "template",
    })
    .returning()
    .get();

  redirect(`/architecture/${arch.id}`);
};
