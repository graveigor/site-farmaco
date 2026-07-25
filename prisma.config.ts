import path from "node:path";
import { defineConfig } from "prisma/config";

// Substitui a chave `prisma` do package.json, descontinuada no Prisma 7.
//
// Quando existe um prisma.config.ts, o Prisma NÃO carrega o .env sozinho. Então
// carregamos manualmente para o desenvolvimento local funcionar. Em produção
// (Vercel) não há arquivo .env — as variáveis vêm do ambiente do projeto — por
// isso a ausência do arquivo é ignorada.
try {
  process.loadEnvFile();
} catch {
  // Sem .env (ex.: build na Vercel): as variáveis já estão em process.env.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
