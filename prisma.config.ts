import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations must use a session connection — Supabase's transaction pooler
    // (port 6543) cannot run them. DIRECT_URL is the session pooler (5432);
    // DATABASE_URL is only a fallback for local/non-pooled setups.
    // The running app connects separately through the adapter in src/lib/db.ts.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
