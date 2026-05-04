import prisma from "@/lib/prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "LOGIN"
  | "LOGOUT";

export type AuditInput = {
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  changes?: { before?: unknown; after?: unknown } | null;
  /** Request opcional para extrair IP e userAgent. */
  req?: Request | { headers: Headers; ip?: string };
  /** Override directo se já tiveres recolhido. */
  ip?: string;
  userAgent?: string;
  /** Tempo de processamento em ms (opcional). */
  duration?: number;
};

function getIp(req?: AuditInput["req"]): string | null {
  if (!req) return null;
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real;
  return (req as any).ip ?? null;
}

function getUa(req?: AuditInput["req"]): string | null {
  if (!req) return null;
  return req.headers.get("user-agent") ?? null;
}

/**
 * Cria um AuditLog. Não rebenta o fluxo principal se a escrita falhar —
 * a escrita é feita em background com try/catch silencioso.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? null,
        changes: input.changes ? (input.changes as any) : undefined,
        ipAddress: input.ip ?? getIp(input.req) ?? null,
        userAgent: input.userAgent ?? getUa(input.req) ?? null,
        duration: input.duration ?? null,
      },
    });
  } catch (e) {
    // Falha de auditoria não pode partir requests
    console.error("[audit] log failed:", e);
  }
}

/**
 * Calcula um diff superficial dos campos alterados entre dois objectos.
 * Retorna apenas as keys cujo valor mudou. Útil para AuditLog UPDATE.
 */
export function diffFields<T extends Record<string, any>>(
  before: T,
  after: Partial<T>,
  options?: { ignore?: (keyof T)[] }
): { before: Partial<T>; after: Partial<T> } {
  const ignore = new Set<string>([
    "createdAt",
    "updatedAt",
    ...(options?.ignore ? (options.ignore as string[]) : []),
  ]);
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after)) {
    if (ignore.has(key)) continue;
    const bv = (before as any)?.[key];
    const av = (after as any)?.[key];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      (b as any)[key] = bv ?? null;
      (a as any)[key] = av ?? null;
    }
  }
  return { before: b, after: a };
}
