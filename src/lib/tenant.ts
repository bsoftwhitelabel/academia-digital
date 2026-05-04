import { Tenant } from "@prisma/client";
import prisma from "./prisma";

// In-memory cache map
const tenantCache = new Map<string, { tenant: Tenant; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function getTenantFromRequest(req: Request): Promise<Tenant | null> {
  const url = new URL(req.url);
  const host = req.headers.get("host") || url.host;
  
  // Tentar extrair o slug do path (ex: /oportoforte/catalog -> oportoforte)
  const pathParts = url.pathname.split('/').filter(Boolean);
  const potentialSlug = pathParts[0];

  const cacheKey = `${host}:${potentialSlug || 'no-slug'}`;

  // Verificar na cache
  const cached = tenantCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  // 1. Procurar por domínio personalizado
  let tenant = await prisma.tenant.findUnique({
    where: { domain: host }
  });

  // 2. Se não encontrar por domínio, tentar pelo slug na URL
  if (!tenant && potentialSlug) {
    tenant = await prisma.tenant.findUnique({
      where: { slug: potentialSlug }
    });
  }

  // Atualizar cache
  if (tenant) {
    tenantCache.set(cacheKey, {
      tenant,
      expiresAt: Date.now() + CACHE_TTL
    });
  }

  return tenant;
}
