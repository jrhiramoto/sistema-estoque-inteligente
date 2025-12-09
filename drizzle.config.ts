import { defineConfig } from "drizzle-kit";

// Usar TiDB Cloud próprio do usuário ao invés do banco gerenciado pela Manus
const connectionString = process.env.CUSTOM_DATABASE_URL || 
  "mysql://6XpTpfC3EDPpy61.root:7fhxmAJLgfUUrDu7@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}";

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
