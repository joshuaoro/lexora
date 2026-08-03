import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Connections are the scarce resource here, not CPU.
 *
 * Supabase's free tier allows 60 Postgres connections in total. Every warm
 * serverless instance keeps its own pool, and node-postgres defaults to ten
 * per pool — so a handful of instances plus a maintenance script running
 * locally can exhaust the budget, and a page that cannot get a connection
 * fails to render.
 *
 * A small ceiling per instance is the right trade: pages issue four to six
 * queries in parallel, so a few connections keep that fast, while many warm
 * instances still fit inside the limit. Idle connections are released quickly
 * so instances that go quiet hand their share back.
 *
 * Note that `connection_limit` in the Supabase URL is a Prisma parameter and
 * is ignored by node-postgres — the cap has to be set here.
 */
const POOL = {
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  // Must be Supabase's transaction pooler (port 6543) — serverless opens many
  // short-lived connections and the direct port cannot absorb them.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, ...POOL }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
