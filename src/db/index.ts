import { drizzle } from "drizzle-orm/libsql";
import * as schema from "~/db/schema";

const db = drizzle("file:./terragui.db", { schema });
export default db;
