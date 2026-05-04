// generated client v: 2026-04-30c (sprint4: Budget, TrainingCost, ApprovalRequest, googleCalendar)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL!;
const CLIENT_VERSION = "2026-04-30c";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: string | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

// Invalida cache global se a versão deste módulo mudou (re-gen do Prisma client)
if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaVersion !== CLIENT_VERSION
) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaVersion = CLIENT_VERSION;
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
