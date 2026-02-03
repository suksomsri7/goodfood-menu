import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "schema.prisma"),

  migrate: {
    async adapter() {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not defined");
      }

      const { PrismaPg } = await import("@prisma/adapter-pg");
      const pg = await import("pg");

      const pool = new pg.default.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
      });

      return new PrismaPg(pool);
    },
  },
});
