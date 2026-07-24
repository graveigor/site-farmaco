import { PrismaClient } from "@prisma/client";

// Reaproveita a instancia entre hot-reloads em desenvolvimento para nao esgotar
// o pool de conexoes.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
