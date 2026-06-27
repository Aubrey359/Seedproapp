import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRequire } from "module";
import * as schema from "@db/schema";
import * as relations from "@db/relations";
import path from "path";

const require = createRequire(process.cwd() + "/package.json");
const Database = require("better-sqlite3");

const dbPath = path.resolve(process.cwd(), "seedpro.db");
const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    instance = drizzle(sqlite, { schema: fullSchema });
  }
  return instance;
}
