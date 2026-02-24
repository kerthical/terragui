"use server";

import { redirect } from "next/navigation";
import db from "~/db";
import { architectures } from "~/db/schema";

type CreateFromScratchInput = Pick<typeof architectures.$inferInsert, "name" | "description">;

export const createFromScratch = async (input: CreateFromScratchInput): Promise<void> => {
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
      sourceType: "scratch",
    })
    .returning()
    .get();

  redirect(`/architecture/${arch.id}`);
};
