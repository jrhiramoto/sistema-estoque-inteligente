import { defineConfig } from "drizzle-kit";

// Supabase Postgres connection
const connectionString = process.env.DATABASE_URL || 
  "postgresql://postgres.vryujlhlsrcdplptzxzi:a7G8vMU0EDCN29Mi@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
