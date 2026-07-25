import path from "node:path";
import { defineConfig } from "prisma/config";

// Substitui a chave `prisma` do package.json, descontinuada no Prisma 7.
// Aponta o schema e o comando de seed.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
