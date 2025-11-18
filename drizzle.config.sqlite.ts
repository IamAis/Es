import { defineConfig } from "drizzle-kit";
import path from "path";
import os from "os";

// Path per il database SQLite
const DATA_DIR = path.join(os.homedir(), ".app-fatture");
const DB_PATH = path.join(DATA_DIR, "app.db");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${DB_PATH}`,
  },
});
