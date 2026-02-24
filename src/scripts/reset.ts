import { sql } from "drizzle-orm";
import db from "~/db";

const tables = await db.all<{
  name: string;
}>(sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);

for (const table of tables) {
  await db.run(sql.raw(`DROP TABLE IF EXISTS "${table.name}"`));
}
