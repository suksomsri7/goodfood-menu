import { PrismaClient } from "@prisma/client";

// Workaround: Next.js 16 + Turbopack doesn't load .env properly in API routes
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_pWlZjSt9VHk4@ep-delicate-pine-a1m9bfje-pooler.ap-southeast-1.aws.neon.tech/goodfood?sslmode=require";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: DATABASE_URL,
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
