"use server";

import { redirect } from "next/navigation";
import db from "~/db";
import { architectures } from "~/db/schema";

type ImportFromLocalInput = Pick<typeof architectures.$inferInsert, "name" | "description">;

export const importFromLocal = async (input: ImportFromLocalInput): Promise<void> => {
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
      sourceType: "local",
    })
    .returning()
    .get();

  redirect(`/architecture/${arch.id}`);
};
